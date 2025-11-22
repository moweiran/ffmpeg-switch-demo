import { spawn, ChildProcessByStdio } from 'child_process';
import { Readable } from 'stream';
import { join } from 'path';
import * as fs from 'fs';
import { SwitcherOptions } from './switcher-option';

/**
 * 稳定版 InstantVideoSwitcher
 * 特点：
 * - 不使用 FFmpeg 的 -stream_loop（每次只推一次视频）
 * - 在旧进程关闭后强制等待 RTMP 释放（默认 2000ms，可配置）
 * - 自动重试与指数回退
 * - 队列去重与合并（避免重复请求）
 * - 在 spawn 前确保文件存在
 * - 使用 -fflags +genpts 与 -avoid_negative_ts make_zero 来保证时间戳健康
 */



export class InstantVideoSwitcher {
    private outputUrl: string;
    private currentProcess: ChildProcessByStdio<null, Readable, Readable> | null = null;
    private switchQueue: string[] = [];
    private isSwitching = false;
    private lastVideoPath: string | null = null;
    private options: Required<SwitcherOptions>;
    private logger = console; // 可替换为更复杂的 logger
    private pendingStartPromise: Promise<void> | null = null;

    constructor(opts: SwitcherOptions) {
        this.options = {
            outputUrl: opts.outputUrl,
            safeIntervalMs: opts.safeIntervalMs ?? 2500, // Increased from 2000ms to ensure RTMP server releases connection
            gracefulTimeoutMs: opts.gracefulTimeoutMs ?? 7000,
            spawnTimeoutMs: opts.spawnTimeoutMs ?? 700,
            retryLimit: opts.retryLimit ?? 3,
            useStreamLoop: opts.useStreamLoop ?? false,
        };
    }

    /**
     * 将切换请求入队，会去重合并
     */
    public requestSwitch(videoPath: string) {
        // 去重：如果队列末尾就是同一个则不再加入
        if (this.switchQueue.length && this.switchQueue[this.switchQueue.length - 1] === videoPath) {
            return;
        }

        // 替换队列中已有的相同路径为最新请求（保持队列短）
        const existingIndex = this.switchQueue.findIndex(p => p === videoPath);
        if (existingIndex !== -1) {
            this.switchQueue.splice(existingIndex, 1);
        }

        this.switchQueue.push(videoPath);
        // 立即触发处理（如果当前不在切换中）
        void this.processQueue();
    }

    /**
     * 处理队列（串行）
     */
    private async processQueue() {
        if (this.isSwitching) return;
        if (this.switchQueue.length === 0) return;

        this.isSwitching = true;
        const next = this.switchQueue.shift()!;
        try {
            await this._switchTo(next);
        } catch (err) {
            this.logger.error('切换失败: ', err);
        } finally {
            this.isSwitching = false;
            // 如果队列还有，递归处理（但不阻塞事件循环）
            if (this.switchQueue.length > 0) {
                setImmediate(() => void this.processQueue());
            }
        }
    }

    /**
     * 真正的切换逻辑：终止旧进程 -> 等待 safe interval -> 启动新进程
     */
    private async _switchTo(videoPath: string) {
        if (!videoPath) throw new Error('videoPath empty');

        // 如果与当前播放相同，短路
        if (this.lastVideoPath === videoPath && this.currentProcess) {
            this.logger.log('请求的视频与当前正在播放相同，忽略');
            return;
        }

        // 确认文件存在
        const videoFullPath = join(process.cwd(), 'videos', videoPath);
        if (!fs.existsSync(videoFullPath)) {
            throw new Error(`视频文件不存在: ${videoFullPath}`);
        }

        // 1) 先优雅终止当前进程
        await this.terminateCurrentProcess();

        // 2) 等待 RTMP 服务释放旧连接（最关键）
        await this.wait(this.options.safeIntervalMs);

        // 3) 额外等待一小段时间确保完全清理
        await this.wait(300); // 增加300ms确保资源完全释放

        // 4) 启动新进程并等待成功
        await this.startNewProcessWithRetry(videoFullPath);

        this.lastVideoPath = videoPath;
    }

    /**
     * 启动新进程（带重试）
     */
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
                const backoff = 300 * attempt; // 简单线性回退
                this.logger.warn(`启动 FFmpeg 失败 (attempt=${attempt}): ${err}. backoff=${backoff}ms`);
                await this.wait(backoff);
            }
        }

        throw lastError ?? new Error('无法启动 FFmpeg');
    }

    /**
     * spawn ffmpeg 并保证在 spawnTimeoutMs 后认为启动成功
     */
    private startProcess(videoFullPath: string): Promise<void> {
        if (this.pendingStartPromise) return this.pendingStartPromise;

        this.pendingStartPromise = new Promise((resolve, reject) => {

            // 构建唯一的标识符以避免流状态冲突
            const timestamp = Date.now();
            const uniqueId = Math.random().toString(36).substr(2, 9);
            const args = [
                '-re', // 保持以真实速率读入（如果你想由 Node 控制速度，可去掉）
                '-i', videoFullPath,
                '-c:v', 'libx264',
                '-g', '30',
                '-keyint_min', '30',
                '-x264-params', 'scenecut=40',
                // 注意：保留 keyframe 控制可能会影响时间戳稳定性，若仍有问题可逐步移除
                // '-force_key_frames', 'expr:gte(t,n_forced*2)',
                '-acodec', 'aac',
                '-vcodec', 'libx264',
                '-profile:v', 'baseline',
                '-level', '3.1',
                '-r', '30',
                '-s', '720x1280',
                '-pix_fmt', 'yuv420p',
                '-b:v', '1200k',
                '-maxrate', '1200k',
                '-bufsize', '1800k',
                '-ar', '16000',
                '-ac', '1',
                '-b:a', '64k',
                '-preset', 'ultrafast',
                '-tune', 'zerolatency',
                '-flags', '+low_delay',
                '-f', 'flv',
                '-flvflags', 'no_duration_filesize',
                '-fflags', '+genpts',
                '-avoid_negative_ts', 'make_zero',
                '-reconnect', '1',
                '-reconnect_at_eof', '1',
                '-reconnect_streamed', '1',
                '-reconnect_delay_max', '2',
                // '-af', 'aresample=async=1:first_pts=0', // 音频重采样
                '-async', '1',
                '-metadata', `comment=${timestamp}_${uniqueId}`, // 添加唯一元数据
                this.options.outputUrl,
            ];

            this.logger.log('Spawn ffmpeg with args:', args.join(' '));

            const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

            let started = false;
            let stderrBuf = '';

            const cleanupListeners = () => {
                proc.stdout?.removeAllListeners();
                proc.stderr?.removeAllListeners();
                proc.removeAllListeners();
            };

            proc.on('spawn', () => {
                this.logger.log('FFmpeg spawn event');
                started = true;
                // 等待一段短时间，确认没有立即崩溃
                setTimeout(() => {
                    this.currentProcess = proc;
                    this.pendingStartPromise = null;
                    this.attachProcessListeners(proc);
                    resolve();
                }, this.options.spawnTimeoutMs);
            });

            proc.on('error', (err) => {
                stderrBuf += `\nPROC_ERROR:${err}`;
                cleanupListeners();
                if (!started) {
                    this.pendingStartPromise = null;
                    reject(err);
                }
            });

            proc.stderr?.on('data', (d) => {
                const s = d.toString();
                stderrBuf += s;
                // 如果出现关键错误，早退
                if (/error|Invalid|failed|refused/i.test(s)) {
                    this.logger.warn('FFmpeg stderr:', s);
                }
            });

            proc.stdout?.on('data', (d) => {
                // 很少输出，保留用于调试
            });

            // 如果进程在短时间内结束，认为启动失败
            proc.once('close', (code, signal) => {
                cleanupListeners();
                if (!started) {
                    this.pendingStartPromise = null;
                    const err = new Error(`ffmpeg closed early. code=${code} signal=${signal} stderr=${stderrBuf}`);
                    reject(err);
                } else {
                    // 正常结束：将 currentProcess 清理（如果是预期的 stop，会在 terminateCurrentProcess 中处理）
                    if (this.currentProcess === proc) this.currentProcess = null;
                    // 如果是意外退出，打印日志
                    this.logger.warn(`ffmpeg exited. code=${code} signal=${signal}`);
                }
            });
        });

        return this.pendingStartPromise;
    }

    /**
     * 终止当前进程（优雅 + 强杀）
     */
    private terminateCurrentProcess(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.currentProcess) {
                resolve();
                return;
            }

            const proc = this.currentProcess;
            this.currentProcess = null; // 先断开引用，避免 race

            let finished = false;

            const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
                if (finished) return;
                finished = true;
                this.logger.log(`FFmpeg terminated (code=${code} signal=${signal})`);
                // 添加额外延迟确保资源完全释放
                setTimeout(() => resolve(), 300);
            };

            proc.once('close', onClose);

            // 先尝试优雅退出
            try {
                proc.kill('SIGTERM');
            } catch (e) {
                this.logger.warn('SIGTERM failed, force kill');
                try { proc.kill('SIGKILL'); } catch (e) { }
            }

            // 设置强制 kill 的超时
            setTimeout(() => {
                if (!finished) {
                    this.logger.warn('进程未在超时内退出，强制 SIGKILL');
                    try { proc.kill('SIGKILL'); } catch (e) { }
                    // 等待短时间让 close 触发
                    setTimeout(() => {
                        if (!finished) {
                            finished = true;
                            resolve();
                        }
                    }, 500);
                }
            }, this.options.gracefulTimeoutMs);
        });
    }

    /**
     * 将必要的监听器绑定到进程上（用于自动恢复 / 处理意外退出）
     */
    private attachProcessListeners(proc: ChildProcessByStdio<null, Readable, Readable>) {
        proc.stderr?.on('data', (d) => {
            const s = d.toString();
            // 记录 warning / error
            if (/error|invalid|failed|refused/i.test(s)) {
                this.logger.warn('ffmpeg stderr:', s);
            }
        });

        proc.on('close', (code, signal) => {
            this.logger.log(`FFmpeg process closed. code=${code} signal=${signal}`);
            // 如果是非主动切换导致的退出，尝试重启同一视频（指数退避）
            if (this.lastVideoPath) {
                // 如果队列里已有新请求，则不重启当前视频
                if (this.switchQueue.length === 0) {
                    // 将当前视频重新入队进行重试
                    this.logger.log('无新队列任务，尝试重启当前视频: ', this.lastVideoPath);
                    this.switchQueue.unshift(this.lastVideoPath);
                    // 递延处理队列，避免深度递归
                    setTimeout(() => void this.processQueue(), 500);
                } else {
                    this.logger.log('队列中有任务，优先处理队列');
                }
            }
        });
    }

    private wait(ms: number) {
        return new Promise<void>(resolve => setTimeout(resolve, ms));
    }

    /**
     * 停止并清理（对外调用）
     */
    public async shutdown() {
        this.logger.log('Shutdown InstantVideoSwitcher');
        // 清空队列
        this.switchQueue = [];
        await this.terminateCurrentProcess();
    }
}


// Usage 示例（不要在库里执行，建议在你的 Nest service 中创建实例并调用 requestSwitch）
/*
const sw = new InstantVideoSwitcher({ outputUrl: 'rtmps://rtmp.icommu.cn:4433/live/livestream' });

// 切换到 welcome
sw.requestSwitch('welcome.mp4');

// 稍后切换到 speaking
setTimeout(() => sw.requestSwitch('speaking.mp4'), 15000);
*/
