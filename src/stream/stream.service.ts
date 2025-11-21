import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import * as fs from 'fs';

export enum VideoState {
  WELCOME = 'welcome',
  IDLE = 'idle',
  SPEAKING = 'speaking',
  PROCESSING = 'processing'
}

class InstantVideoSwitcher {
  outputUrl: string;
  currentProcess: ChildProcess | null;
  switchQueue: string[];
  isSwitching: boolean;

  constructor(outputUrl) {
    this.outputUrl = outputUrl;
    this.currentProcess = null;
    this.switchQueue = [];
    this.isSwitching = false;
  }

  // 创建带有强制关键帧的流
  createStreamWithKeyframes(videoPath) {
    const args = [
      '-re',
      '-i', videoPath,
      '-c:v', 'libx264',
      '-g', '30',                    // GOP大小，更短的关键帧间隔
      '-keyint_min', '30',           // 最小关键帧间隔
      '-x264-params', 'scenecut=40', // 场景切换敏感度
      '-force_key_frames', 'expr:gte(t,n_forced*2)', // 强制关键帧
      '-acodec', 'aac', // AAC audio codec
      '-vcodec', 'libx264', // H.264 video codec
      '-profile:v', 'baseline', // Baseline profile for compatibility
      '-level', '3.1', // Level 3.1
      '-r', '30', // Frame rate
      '-s', '720x1280', // Video size
      '-pix_fmt', 'yuv420p', // Pixel format
      '-b:v', '1200k', // Video bitrate
      '-maxrate', '1200k', // Maximum bitrate
      '-bufsize', '1800k', // Buffer size
      '-ar', '16000', // Audio sample rate
      '-ac', '1', // Audio channels
      '-b:a', '64k', // Audio bitrate
      '-preset', 'ultrafast', // Faster encoding for real-time
      '-tune', 'zerolatency', // Zero latency tuning for real-time
      '-flags', '+low_delay', // Low delay flags
      '-f', 'flv', // Output format for RTMP
      '-flvflags', 'no_duration_filesize', // Prevent issues with duration/filesize updates
      '-fflags', '+genpts', // Generate PTS
      '-avoid_negative_ts', 'make_zero', // Avoid negative timestamps
      this.outputUrl
    ];

    const process = spawn('ffmpeg', args);

    process.stderr.on('data', (data) => {
      const output = data.toString();
      // 监听关键帧信息
      if (output.includes('keyframe')) {
        console.log('关键帧生成:', output);
      }
    });

    return process;
  }

  // 立即切换视频
  async switchInstantly(newVideoPath) {
    // 如果正在切换，加入队列
    if (this.isSwitching) {
      this.switchQueue.push(newVideoPath);
      return;
    }

    this.isSwitching = true;
    console.log(`立即切换到: ${newVideoPath}`);

    // 1. 先启动新流
    const newProcess = this.createStreamWithKeyframes(newVideoPath);

    newProcess.on('spawn', () => {
      console.log('新流启动成功');

      // 2. 给新流一点时间建立连接和发送关键帧
      setTimeout(() => {
        // 3. 关闭旧流
        if (this.currentProcess) {
          this.currentProcess.kill('SIGKILL'); // 强制立即关闭
        }

        this.currentProcess = newProcess;
        this.isSwitching = false;
        console.log('切换完成');

        // 4. 处理队列中的下一个切换请求
        if (this.switchQueue.length > 0) {
          const nextVideo = this.switchQueue.shift();
          this.switchInstantly(nextVideo);
        }
      }, 500); // 500ms延迟确保新流已开始发送数据
    });

    newProcess.on('error', (error) => {
      console.error('新流启动失败:', error);
      this.isSwitching = false;
    });
  }

  // 开始轮播（可随时中断切换）
  startRotation() {
    let currentIndex = 0;

    const videos = [
      join(process.cwd(), 'videos', 'welcome.mp4'),
      join(process.cwd(), 'videos', 'idle.mp4')
    ];


    // 初始播放
    this.switchInstantly(videos[0]);

    // 模拟外部事件触发切换（比如API调用）
    setInterval(() => {
      currentIndex = (currentIndex + 1) % videos.length;
      this.switchInstantly(videos[currentIndex]);
    }, 10000); // 每10秒切换一次，实际中由你的业务逻辑触发
  }
}

@Injectable()
export class StreamService {
  private readonly logger = new Logger(StreamService.name);
  private rtmpUrl: string;
  private currentVideoState: VideoState = VideoState.WELCOME;
  private ffmpegProcess: ChildProcess | null = null;
  private transitionInProgress = false;
  private processTerminationPromise: Promise<void> | null = null;

  constructor() {
    // Use the original RTMP URL since we need to maintain the same stream key
    this.rtmpUrl = 'rtmps://rtmp.icommu.cn:4433/live/livestream';
  }

  /**
   * Start streaming with the welcome video
   */
  async startStreaming(): Promise<void> {
    this.logger.log('Starting streaming with welcome video');
    this.currentVideoState = VideoState.WELCOME;
    // await this.streamVideo('welcome.mp4');
    const switcher = new InstantVideoSwitcher(this.rtmpUrl);
    switcher.startRotation();
  }

  /**
   * Switch to idle video (when user isn't speaking)
   */
  async switchToIdle(): Promise<void> {
    if (this.currentVideoState === VideoState.IDLE || this.transitionInProgress) {
      return;
    }

    this.logger.log('Switching to idle video');
    this.transitionInProgress = true;
    this.currentVideoState = VideoState.IDLE;
    await this.streamVideo('idle.mp4');
    this.transitionInProgress = false;
  }

  /**
   * Switch to speaking video (when user is speaking)
   */
  async switchToSpeaking(): Promise<void> {
    if (this.currentVideoState === VideoState.SPEAKING || this.transitionInProgress) {
      return;
    }

    this.logger.log('Switching to speaking video');
    this.transitionInProgress = true;
    this.currentVideoState = VideoState.SPEAKING;
    await this.streamVideo('speaking.mp4');
    this.transitionInProgress = false;
  }

  /**
   * Switch to processing state (waiting for AI response)
   */
  async switchToProcessing(): Promise<void> {
    if (this.currentVideoState === VideoState.PROCESSING || this.transitionInProgress) {
      return;
    }

    this.logger.log('Switching to processing state');
    this.transitionInProgress = true;
    this.currentVideoState = VideoState.PROCESSING;
    await this.streamVideo('idle.mp4'); // Using idle video during processing
    this.transitionInProgress = false;
  }

  /**
   * Play response video with synthesized speech
   * @param responseText The text response from AI
   */
  async playResponseVideo(responseText: string): Promise<void> {
    this.logger.log(`Playing response video for text: ${responseText}`);
    // In a real implementation, you would synthesize speech from text
    // and combine it with the speaking video
    this.transitionInProgress = true;
    this.currentVideoState = VideoState.SPEAKING;
    await this.streamVideo('speaking.mp4');
    this.transitionInProgress = false;
  }

  /**
   * Stream a video file to RTMP server with seamless transition
   * @param videoFileName The name of the video file to stream
   */
  private async streamVideo(videoFileName: string): Promise<void> {
    // Wait for any ongoing process termination
    if (this.processTerminationPromise) {
      await this.processTerminationPromise;
    }

    // Create a new promise for process termination
    this.processTerminationPromise = this.terminateProcess();

    // Wait for process termination
    await this.processTerminationPromise;

    // Clear the termination promise
    this.processTerminationPromise = null;

    // Add a small delay to ensure complete cleanup before starting new process
    await new Promise(resolve => setTimeout(resolve, 200));

    // Start the new streaming process
    return this.startStreamingProcess(videoFileName);
  }

  /**
   * Terminate the current FFmpeg process gracefully with enhanced cleanup
   */
  private terminateProcess(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ffmpegProcess) {
        // No process to terminate
        resolve();
        return;
      }

      this.logger.log('Terminating FFmpeg process with enhanced cleanup');

      // Set a timeout to force kill if graceful termination takes too long
      const forceKillTimeout = setTimeout(() => {
        if (this.ffmpegProcess) {
          this.logger.warn('Force killing FFmpeg process');
          this.ffmpegProcess.kill('SIGKILL');
        }
        this.ffmpegProcess = null;
        resolve();
      }, 3000); // 3 second timeout for more thorough cleanup

      // Listen for the close event
      this.ffmpegProcess.once('close', (code, signal) => {
        clearTimeout(forceKillTimeout);
        this.logger.log(`FFmpeg process closed with code: ${code}, signal: ${signal}`);
        this.ffmpegProcess = null;
        // Add extra delay after process closure for complete resource cleanup
        setTimeout(() => resolve(), 300);
      });

      // Send termination signal
      this.ffmpegProcess.kill('SIGTERM');
    });
  }

  /**
   * Start the actual streaming process with enhanced parameters
   * @param videoFileName The name of the video file to stream
   */
  private startStreamingProcess(videoFileName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const videoPath = join(process.cwd(), 'videos', videoFileName);

      // Check if video file exists
      if (!fs.existsSync(videoPath)) {
        this.logger.error(`Video file not found: ${videoPath}`);
        reject(new Error(`Video file not found: ${videoPath}`));
        return;
      }

      this.logger.log(`Streaming video: ${videoPath} to ${this.rtmpUrl}`);

      // Build ffmpeg command with enhanced settings for stable RTMP streaming
      const args = [
        '-re', // Read input at native frame rate
        '-stream_loop', '-1', // Loop the video indefinitely
        '-i', videoPath, // Input file
        '-acodec', 'aac', // AAC audio codec
        '-vcodec', 'libx264', // H.264 video codec
        '-profile:v', 'baseline', // Baseline profile for compatibility
        '-level', '3.1', // Level 3.1
        '-g', '50', // GOP size
        '-r', '30', // Frame rate
        '-s', '720x1280', // Video size
        '-pix_fmt', 'yuv420p', // Pixel format
        '-b:v', '1200k', // Video bitrate
        '-maxrate', '1200k', // Maximum bitrate
        '-bufsize', '1800k', // Buffer size
        '-ar', '16000', // Audio sample rate
        '-ac', '1', // Audio channels
        '-b:a', '64k', // Audio bitrate
        '-preset', 'ultrafast', // Faster encoding for real-time
        '-tune', 'zerolatency', // Zero latency tuning for real-time
        '-flags', '+low_delay', // Low delay flags
        '-f', 'flv', // Output format for RTMP
        '-flvflags', 'no_duration_filesize', // Prevent issues with duration/filesize updates
        '-fflags', '+genpts', // Generate PTS
        '-avoid_negative_ts', 'make_zero', // Avoid negative timestamps
        '-reconnect', '1', // Enable reconnection
        '-reconnect_at_eof', '1', // Reconnect at EOF
        '-reconnect_streamed', '1', // Reconnect streamed
        '-reconnect_delay_max', '2', // Max reconnect delay
        '-threads', '0', // Let FFmpeg choose optimal thread count
        this.rtmpUrl     // RTMP output URL (same stream key)
      ];

      // Spawn ffmpeg process using system-installed ffmpeg
      this.ffmpegProcess = spawn('ffmpeg', args);

      if (this.ffmpegProcess) {
        let processStarted = false;

        this.ffmpegProcess.on('spawn', () => {
          this.logger.log('FFmpeg process started successfully');
          processStarted = true;
          // Give a longer delay to ensure process is fully initialized
          setTimeout(() => {
            resolve();
          }, 500);
        });

        this.ffmpegProcess.on('error', (err) => {
          this.logger.error('FFmpeg process error: ' + err.message);
          this.ffmpegProcess = null;
          if (!processStarted) {
            reject(err);
          }
        });

        this.ffmpegProcess.on('close', (code, signal) => {
          this.logger.log(`FFmpeg process closed with code: ${code}, signal: ${signal}`);
          this.ffmpegProcess = null;
          // Only reject if the process closed unexpectedly and we haven't resolved yet
          if (!processStarted) {
            reject(new Error(`FFmpeg process closed unexpectedly with code: ${code}`));
          }
        });

        // Log ffmpeg output for debugging
        this.ffmpegProcess.stdout?.on('data', (data) => {
          this.logger.debug(`FFmpeg stdout: ${data}`);
        });

        this.ffmpegProcess.stderr?.on('data', (data) => {
          // Only log errors/warnings to avoid spam
          const dataStr = data.toString();
          if (dataStr.includes('error') || dataStr.includes('Error') || dataStr.includes('warning')) {
            this.logger.warn(`FFmpeg stderr: ${dataStr}`);
          }
        });
      } else {
        this.logger.error('Failed to spawn FFmpeg process');
        reject(new Error('Failed to spawn FFmpeg process'));
      }
    });
  }

  /**
   * Stop streaming
   */
  async stopStreaming(): Promise<void> {
    this.logger.log('Stopping streaming');
    await this.terminateProcess();
    this.currentVideoState = VideoState.WELCOME;
    this.transitionInProgress = false;
  }
}