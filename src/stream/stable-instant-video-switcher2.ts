import { spawn, ChildProcessByStdio } from 'child_process';
import { Readable } from 'stream';
import { join } from 'path';
import * as fs from 'fs';
import { SwitcherOptions } from './switcher-option';


export class InstantVideoSwitcher2 {
    private outputUrl: string;
    private currentProcess: ChildProcessByStdio<null, Readable, Readable> | null = null;
    private switchQueue: string[] = [];
    private isSwitching = false;
    private lastVideoPath: string | null = null;
    private options: Required<SwitcherOptions>;
    private logger = console;
    private pendingStartPromise: Promise<void> | null = null;
    private processStartTime: number = 0;

    constructor(opts: SwitcherOptions) {
        this.options = {
            outputUrl: opts.outputUrl,
            safeIntervalMs: opts.safeIntervalMs ?? 3000, // 增加到 3 秒确保完全释放
            gracefulTimeoutMs: opts.gracefulTimeoutMs ?? 7000,
            spawnTimeoutMs: opts.spawnTimeoutMs ?? 1000,
            retryLimit: opts.retryLimit ?? 3,
            useStreamLoop: opts.useStreamLoop ?? false,
        };
        this.outputUrl = opts.outputUrl;
    }

    public requestSwitch(videoPath: string) {
        if (this.switchQueue.length && this.switchQueue[this.switchQueue.length - 1] === videoPath) {
            return;
        }

        const existingIndex = this.switchQueue.findIndex(p => p === videoPath);
        if (existingIndex !== -1) {
            this.switchQueue.splice(existingIndex, 1);
        }

        this.switchQueue.push(videoPath);
        void this.processQueue();
    }

    private async processQueue() {
        if (this.isSwitching) return;
        if (this.switchQueue.length === 0) return;

        this.isSwitching = true;
        const next = this.switchQueue.shift()!;
        try {
            await this._switchTo(next);
        } catch (err) {
            this.logger.error('切换失败: ', err);
            // 失败时重试一次
            if (this.switchQueue.length === 0) {
                this.switchQueue.unshift(next);
            }
        } finally {
            this.isSwitching = false;
            if (this.switchQueue.length > 0) {
                setImmediate(() => void this.processQueue());
            }
        }
    }

    private async _switchTo(videoPath: string) {
        if (!videoPath) throw new Error('videoPath empty');

        // 检查文件存在性
        const videoFullPath = join(process.cwd(), 'videos', videoPath);
        if (!fs.existsSync(videoFullPath)) {
            throw new Error(`视频文件不存在: ${videoFullPath}`);
        }

        // 1. 终止当前进程
        await this.terminateCurrentProcess();

        // 2. 关键：等待足够长时间确保 RTMP 连接完全释放
        await this.wait(this.options.safeIntervalMs);

        // 3. 启动新进程
        await this.startNewProcessWithRetry(videoFullPath);

        this.lastVideoPath = videoPath;
        this.processStartTime = Date.now();
    }

    private async startNewProcessWithRetry(videoFullPath: string) {
        let attempt = 0;
        let lastError: any = null;
        const max = this.options.retryLimit;

        while (attempt <= max) {
            try {
                await this.startProcess(videoFullPath);
                return;
            } catch (err) {
                lastError = err;
                attempt++;
                const backoff = 500 * attempt;
                this.logger.warn(`启动 FFmpeg 失败 (attempt=${attempt}): ${err}. backoff=${backoff}ms`);
                await this.wait(backoff);

                // 每次重试前都重新终止可能残留的进程
                await this.terminateCurrentProcess();
                await this.wait(1000);
            }
        }

        throw lastError ?? new Error('无法启动 FFmpeg');
    }

    private startProcess(videoFullPath: string): Promise<void> {
        if (this.pendingStartPromise) return this.pendingStartPromise;

        this.pendingStartPromise = new Promise((resolve, reject) => {
            const args = [
                '-re',
                '-i', videoFullPath,

                // 关键修复：强制重置时间戳和流状态
                '-fflags', '+genpts+discardcorrupt',
                '-flags', '+global_header',
                '-avioflags', 'direct',
                '-avoid_negative_ts', 'make_zero',
                '-vsync', 'cfr',
                '-copytb', '1',

                // 视频编码配置
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-tune', 'zerolatency',
                '-profile:v', 'baseline',
                '-level', '3.1',
                '-r', '30',
                '-s', '720x1280',
                '-pix_fmt', 'yuv420p',
                '-b:v', '1200k',
                '-maxrate', '1200k',
                '-bufsize', '1800k',
                '-g', '60',
                '-keyint_min', '60',
                '-x264-params', 'scenecut=0:open_gop=0:min-keyint=60:keyint=60',

                // 音频编码配置 - 彻底修复音频问题
                '-c:a', 'aac',
                '-ar', '44100',
                '-ac', '2',
                '-b:a', '128k',
                '-af', 'aresample=async=1:min_comp=0.1:first_pts=0',

                // 输出格式和流配置
                '-f', 'flv',
                '-flvflags', 'no_duration_filesize+no_sequence_end',
                '-metadata', `streamId=switch_${Date.now()}`,

                // 重连配置
                '-reconnect', '1',
                '-reconnect_at_eof', '1',
                '-reconnect_streamed', '1',
                '-reconnect_delay_max', '2',

                this.outputUrl
            ];

            // 可选：使用 stream_loop 避免重复启动相同视频
            if (this.options.useStreamLoop) {
                args.splice(3, 0, '-stream_loop', '-1'); // 在 -i 参数后插入
            }

            this.logger.log('启动 FFmpeg:', args.join(' '));

            const proc = spawn('ffmpeg', args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false // 确保进程能正确被终止
            });

            let started = false;
            let stderrBuf = '';
            let successSignalReceived = false;

            const cleanup = () => {
                proc.stdout?.removeAllListeners();
                proc.stderr?.removeAllListeners();
                proc.removeAllListeners();
            };

            const successTimeout = setTimeout(() => {
                if (!started) {
                    cleanup();
                    this.pendingStartPromise = null;
                    const err = new Error(`FFmpeg 启动超时，stderr: ${stderrBuf}`);
                    reject(err);
                }
            }, 10000); // 10 秒总超时

            // 成功信号：当看到特定的输出时认为启动成功
            const checkSuccess = (data: string) => {
                if (data.includes('frame=') || data.includes('Press [q] to stop') ||
                    data.includes('Opening') || data.includes('Stream mapping')) {
                    if (!successSignalReceived) {
                        successSignalReceived = true;
                        this.logger.log('FFmpeg 启动成功信号收到');
                    }
                }
            };

            proc.stderr.on('data', (data: Buffer) => {
                const text = data.toString();
                stderrBuf += text;
                checkSuccess(text);

                // 记录错误和警告
                if (text.includes('error') || text.includes('Error') || text.includes('failed')) {
                    this.logger.error('FFmpeg 错误:', text);
                }
            });

            proc.on('spawn', () => {
                this.logger.log('FFmpeg 进程已生成');
            });

            proc.on('error', (error) => {
                cleanup();
                clearTimeout(successTimeout);
                this.pendingStartPromise = null;
                this.logger.error('FFmpeg 进程错误:', error);
                reject(error);
            });

            proc.on('close', (code, signal) => {
                cleanup();
                clearTimeout(successTimeout);

                if (!started) {
                    this.pendingStartPromise = null;
                    const err = new Error(`FFmpeg 过早退出 code=${code}, signal=${signal}, stderr=${stderrBuf}`);
                    reject(err);
                } else {
                    if (this.currentProcess === proc) {
                        this.currentProcess = null;
                    }
                    this.logger.log(`FFmpeg 进程退出 code=${code}, signal=${signal}`);
                }
            });

            // 主要启动成功检测：进程存活 + 超时后没有错误
            setTimeout(() => {
                if (proc.exitCode === null && !proc.killed) {
                    started = true;
                    clearTimeout(successTimeout);
                    this.currentProcess = proc;
                    this.pendingStartPromise = null;

                    // 附加运行时的监听器
                    this.attachProcessListeners(proc);
                    resolve();
                }
            }, this.options.spawnTimeoutMs);

        });

        return this.pendingStartPromise;
    }

    private terminateCurrentProcess(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.currentProcess) {
                resolve();
                return;
            }

            const proc = this.currentProcess;
            this.currentProcess = null;
            let killed = false;

            const cleanup = () => {
                if (killed) return;
                killed = true;
                proc.removeAllListeners();
                resolve();
            };

            const forceKillTimeout = setTimeout(() => {
                this.logger.warn('强制终止 FFmpeg 进程');
                try {
                    proc.kill('SIGKILL');
                } catch (e) { }
                cleanup();
            }, this.options.gracefulTimeoutMs);

            proc.once('close', (code, signal) => {
                clearTimeout(forceKillTimeout);
                this.logger.log(`FFmpeg 进程已终止 code=${code}, signal=${signal}`);
                cleanup();
            });

            // 先尝试优雅终止
            try {
                proc.kill('SIGTERM');
            } catch (e) {
                this.logger.warn('SIGTERM 失败，使用 SIGKILL');
                try {
                    proc.kill('SIGKILL');
                } catch (e) { }
            }
        });
    }

    private attachProcessListeners(proc: ChildProcessByStdio<null, Readable, Readable>) {
        let errorCount = 0;
        const maxErrors = 10;

        proc.stderr.on('data', (data: Buffer) => {
            const text = data.toString();

            // 监控关键错误
            if (text.includes('error') || text.includes('Error') || text.includes('failed')) {
                errorCount++;
                this.logger.warn(`FFmpeg 运行时错误 [${errorCount}]:`, text.trim());

                if (errorCount > maxErrors) {
                    this.logger.error('FFmpeg 错误过多，尝试重启');
                    if (this.lastVideoPath) {
                        this.requestSwitch(this.lastVideoPath);
                    }
                }
            }
        });

        proc.on('close', (code, signal) => {
            this.logger.log(`FFmpeg 进程关闭: code=${code}, signal=${signal}`);

            // 如果是意外退出且运行时间超过 5 秒，尝试恢复
            const runtime = Date.now() - this.processStartTime;
            if (code !== 0 && runtime > 5000 && this.lastVideoPath) {
                this.logger.log('检测到意外退出，尝试恢复播放');
                setTimeout(() => {
                    if (this.switchQueue.length === 0 && this.lastVideoPath) {
                        this.requestSwitch(this.lastVideoPath);
                    }
                }, 2000);
            }
        });
    }

    private wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public async shutdown() {
        this.logger.log('关闭 InstantVideoSwitcher');
        this.switchQueue = [];
        await this.terminateCurrentProcess();
    }

    // 新增：获取当前状态
    public getStatus() {
        return {
            isPlaying: !!this.currentProcess,
            currentVideo: this.lastVideoPath,
            queueLength: this.switchQueue.length,
            isSwitching: this.isSwitching
        };
    }
}