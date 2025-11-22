import fs from "fs";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { join } from "path";

export class StreamSwitcher {
    FIFO_PATH = join(process.cwd(), 'videos', "stream_fifo.mp4");
    RTMP_URL = "rtmps://rtmp.icommu.cn:4433/live/livestream";

    ffmpeg: ChildProcessWithoutNullStreams | null = null;
    isSwitching = false;
    switchQueue: string[] = [];
    currentVideoPath: string | null = null;

    constructor() {
        this.ensureFIFO();
        this.startFFmpeg();
    }

    // --------- 确保 FIFO 存在 ----------
    ensureFIFO(): void {
        try {
            // 如果 FIFO 已存在，先删除它
            if (fs.existsSync(this.FIFO_PATH)) {
                fs.unlinkSync(this.FIFO_PATH);
            }
            console.log("[FIFO] Creating...");
            // 创建新的 FIFO
            spawn("mkfifo", [this.FIFO_PATH]).on('close', (code) => {
                if (code === 0) {
                    console.log("[FIFO] Created successfully.");
                } else {
                    console.error("[FIFO] Create failed with code:", code);
                }
            });
        } catch (err) {
            console.error("[FIFO] Create failed:", err);
        }
    }

    // --------- 启动 FFmpeg 推流 ----------
    startFFmpeg() {
        console.log("[FFmpeg] Starting...");

        this.ffmpeg = spawn("ffmpeg", [
            "-re",
            "-i", this.FIFO_PATH,
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
            this.RTMP_URL
        ]);

        this.ffmpeg.stderr.on("data", (d) => {
            console.log("[FFmpeg] data====", d.toString());
        });

        this.ffmpeg.on("exit", (code) => {
            console.log(`[FFmpeg] Exit code ${code}`);
            // 如果不是主动停止，尝试重启
            if (code !== 0) {
                console.log("[FFmpeg] Restarting in 500ms...");
                setTimeout(() => this.startFFmpeg(), 500);
            }
        });
        
        this.ffmpeg.on("error", (err) => {
            console.error("[FFmpeg] Error:", err);
        });
    }

    // --------- 动态写入视频（核心功能） ----------
    requestSwitch(filePath: string): void {
        // 去重：如果队列末尾就是同一个则不再加入
        if (this.switchQueue.length && this.switchQueue[this.switchQueue.length - 1] === filePath) {
            return;
        }

        // 替换队列中已有的相同路径为最新请求（保持队列短）
        const existingIndex = this.switchQueue.findIndex(p => p === filePath);
        if (existingIndex !== -1) {
            this.switchQueue.splice(existingIndex, 1);
        }

        this.switchQueue.push(filePath);
        console.log("[PUSH] Queued:", filePath);
        
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
            console.error('[PUSH] Switch failed:', err);
        } finally {
            this.isSwitching = false;
            // 如果队列还有，递归处理（但不阻塞事件循环）
            if (this.switchQueue.length > 0) {
                setImmediate(() => void this.processQueue());
            }
        }
    }

    private async _switchTo(filePath: string): Promise<void> {
        console.log("[PUSH] Start:", filePath);
        
        // 检查文件是否存在
        const fullPath = join(process.cwd(), 'videos', filePath);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`[PUSH] File not found: ${fullPath}`);
        }

        return new Promise((resolve, reject) => {
            console.log("[PUSH] Full path:", fullPath);

            // 创建读取流
            const source = fs.createReadStream(fullPath);
            
            // 创建写入流到 FIFO
            const fifo = fs.createWriteStream(this.FIFO_PATH);

            source.on("error", (err) => {
                console.error("[PUSH] Read error:", err);
                reject(err);
            });

            fifo.on("error", (err) => {
                console.error("[PUSH] FIFO write error:", err);
                reject(err);
            });

            fifo.on("finish", () => {
                console.log("[PUSH] Done:", filePath);
                this.currentVideoPath = filePath;
                resolve();
            });

            // 管道传输
            source.pipe(fifo);
        });
    }

    // --------- 停止推流 ----------
    stop(): void {
        console.log("[FFmpeg] Stopping...");
        if (this.ffmpeg) {
            this.ffmpeg.kill('SIGTERM');
            this.ffmpeg = null;
        }
        
        // 清空队列
        this.switchQueue = [];
        this.isSwitching = false;
        this.currentVideoPath = null;
    }
}