import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import * as fs from 'fs';
import { InstantVideoSwitcher } from './stable-instant-video-switcher1';
import { InstantVideoSwitcher2 } from './stable-instant-video-switcher2';

export enum VideoState {
  WELCOME = 'welcome',
  IDLE = 'idle',
  SPEAKING = 'speaking',
  PROCESSING = 'processing'
}

// class InstantVideoSwitcher {
//   outputUrl: string;
//   currentProcess: ChildProcess | null;
//   switchQueue: string[];
//   isSwitching: boolean;
//   lastVideoPath: string | null; // 记录上一个视频路径

//   constructor(outputUrl) {
//     this.outputUrl = outputUrl;
//     this.currentProcess = null;
//     this.switchQueue = [];
//     this.isSwitching = false;
//     this.lastVideoPath = null;
//   }

//   // 创建带有强制关键帧的流
//   createStreamWithKeyframes(videoPath) {
//     // 构建唯一的标识符以避免流状态冲突
//     const timestamp = Date.now();
//     const uniqueId = Math.random().toString(36).substr(2, 9);

//     const args = [
//       '-re',
//       // '-stream_loop', '-1', // 循环播放视频
//       '-i', videoPath,
//       '-c:v', 'libx264',
//       '-g', '30',
//       '-keyint_min', '30',
//       '-x264-params', 'scenecut=40',
//       '-force_key_frames', 'expr:gte(t,n_forced*2)',
//       '-acodec', 'aac',
//       '-vcodec', 'libx264',
//       '-profile:v', 'baseline',
//       '-level', '3.1',
//       '-r', '30',
//       '-s', '720x1280',
//       '-pix_fmt', 'yuv420p',
//       '-b:v', '1200k',
//       '-maxrate', '1200k',
//       '-bufsize', '1800k',
//       '-ar', '16000',
//       '-ac', '1',
//       '-b:a', '64k',
//       '-preset', 'ultrafast',
//       '-tune', 'zerolatency',
//       '-flags', '+low_delay',
//       '-f', 'flv',
//       '-flvflags', 'no_duration_filesize',
//       '-fflags', '+genpts',
//       '-avoid_negative_ts', 'make_zero',
//       '-reconnect', '1',
//       '-reconnect_at_eof', '1',
//       '-reconnect_streamed', '1',
//       '-reconnect_delay_max', '2',
//       '-af', 'aresample=async=1:first_pts=0', // 音频重采样
//       '-async', '1',
//       '-metadata', `comment=${timestamp}_${uniqueId}`, // 添加唯一元数据
//       this.outputUrl
//     ];

//     const process = spawn('ffmpeg', args);

//     process.stderr.on('data', (data) => {
//       const output = data.toString();
//       // 监听关键帧信息和错误
//       if (output.includes('keyframe')) {
//         console.log('关键帧生成:', output);
//       }
//       if (output.includes('error') || output.includes('Error')) {
//         console.error('FFmpeg错误:', output);
//       }
//     });

//     return process;
//   }

//   // 彻底终止当前进程
//   async terminateCurrentProcess(): Promise<void> {
//     if (!this.currentProcess) {
//       return Promise.resolve();
//     }

//     const processToTerminate = this.currentProcess;
//     this.currentProcess = null;

//     return new Promise((resolve) => {
//       // 设置超时强制终止
//       const timeout = setTimeout(() => {
//         if (processToTerminate && !processToTerminate.killed) {
//           processToTerminate.kill('SIGKILL');
//         }
//         resolve();
//       }, 3000); // 3秒超时

//       // 监听进程关闭
//       processToTerminate.on('close', (code, signal) => {
//         clearTimeout(timeout);
//         console.log(`FFmpeg进程已关闭，退出码: ${code}, 信号: ${signal}`);
//         resolve();
//       });

//       // 发送终止信号
//       processToTerminate.kill('SIGTERM');
//     });
//   }

//   // 立即切换视频
//   async switchInstantly(newVideoPath) {
//     // 如果正在切换，加入队列
//     if (this.isSwitching) {
//       // 如果队列中已经有相同的视频请求，则替换它
//       const existingIndex = this.switchQueue.findIndex(path => path === newVideoPath);
//       if (existingIndex !== -1) {
//         this.switchQueue[existingIndex] = newVideoPath;
//       } else {
//         this.switchQueue.push(newVideoPath);
//       }
//       return;
//     }

//     this.isSwitching = true;
//     console.log(`立即切换到: ${newVideoPath}`);

//     try {
//       // 1. 先终止当前进程（如果存在）
//       if (this.currentProcess) {
//         await this.terminateCurrentProcess();
//         // 额外等待确保资源释放
//         await new Promise(resolve => setTimeout(resolve, 500));
//       }

//       // 2. 启动新流
//       const newProcess = this.createStreamWithKeyframes(newVideoPath);

//       // 添加错误监听器
//       newProcess.on('error', (error) => {
//         console.error('FFmpeg进程启动失败:', error);
//         if (this.currentProcess === newProcess) {
//           this.isSwitching = false;
//         }
//         // 尝试处理队列中的下一个请求
//         if (this.switchQueue.length > 0) {
//           const nextVideo = this.switchQueue.shift();
//           // 使用延迟避免递归调用过深
//           setTimeout(() => this.switchInstantly(nextVideo), 1000);
//         }
//       });

//       newProcess.on('spawn', () => {
//         console.log('新流启动成功');

//         // 等待一段时间确保流稳定
//         setTimeout(() => {
//           // 双重检查确保没有其他切换正在进行
//           if (this.isSwitching && !newProcess.killed) {
//             this.currentProcess = newProcess;
//             this.lastVideoPath = newVideoPath;
//             this.isSwitching = false;
//             console.log('切换完成');

//             // 处理队列中的下一个切换请求
//             if (this.switchQueue.length > 0) {
//               const nextVideo = this.switchQueue.shift();
//               // 使用延迟避免递归调用过深
//               setTimeout(() => this.switchInstantly(nextVideo), 1000);
//             }
//           }
//         }, 1000); // 1秒延迟确保流稳定
//       });

//       // 监听进程异常退出
//       newProcess.on('close', (code, signal) => {
//         if (this.currentProcess === newProcess) {
//           console.log(`FFmpeg进程意外关闭，退出码: ${code}, 信号: ${signal}`);
//           this.currentProcess = null;

//           // 如果仍在切换状态，重置状态
//           if (this.isSwitching) {
//             this.isSwitching = false;
//           }

//           // 如果有队列任务，继续处理
//           if (this.switchQueue.length > 0) {
//             const nextVideo = this.switchQueue.shift();
//             // 使用延迟避免递归调用过深
//             setTimeout(() => this.switchInstantly(nextVideo), 1000);
//           }
//         }
//       });
//     } catch (error) {
//       console.error('切换过程中发生错误:', error);
//       this.isSwitching = false;

//       // 尝试处理队列中的下一个请求
//       if (this.switchQueue.length > 0) {
//         const nextVideo = this.switchQueue.shift();
//         // 使用延迟避免递归调用过深
//         setTimeout(() => this.switchInstantly(nextVideo), 1000);
//       }
//     }
//   }

//   // 开始轮播（可随时中断切换）
//   startRotation() {
//     let currentIndex = 0;

//     const videos = [
//       join(process.cwd(), 'videos', 'welcome.mp4'),
//       join(process.cwd(), 'videos', 'welcome.mp4'), // 保持使用相同视频进行测试
//     ];

//     // 初始播放
//     this.switchInstantly(videos[0]);

//     // 模拟外部事件触发切换（比如API调用）
//     setInterval(() => {
//       currentIndex = (currentIndex + 1) % videos.length;
//       this.switchInstantly(videos[currentIndex]);
//     }, 20000); // 20秒切换一次，给足够时间观察效果
//   }
// }

@Injectable()
export class StreamService {
  private readonly logger = new Logger(StreamService.name);
  private rtmpUrl: string;
  private currentVideoState: VideoState = VideoState.WELCOME;
  // private sw = new InstantVideoSwitcher({ 
  //   outputUrl: 'rtmps://rtmp.icommu.cn:4433/live/livestream',
  //   safeIntervalMs: 2500 // Ensure proper cleanup timing
  // });
  private sw = new InstantVideoSwitcher2({
    outputUrl: 'rtmps://rtmp.icommu.cn:4433/live/livestream',
    safeIntervalMs: 3000, // Ensure proper cleanup timing
    useStreamLoop: false, // 如果问题依旧，可以尝试设为 true
  });

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
    // const switcher = new InstantVideoSwitcher(this.rtmpUrl);
    // switcher.startRotation();
    // 切换到 welcome
    this.sw.requestSwitch('welcome.mp4');
  }

  /**
   * Switch to idle video (when user isn't speaking)
   */
  async switchToIdle(): Promise<void> {
    this.logger.log('Switching to idle video');
    this.currentVideoState = VideoState.IDLE;
    this.sw.requestSwitch('idle.mp4');
  }

  /**
   * Switch to speaking video (when user is speaking)
   */
  async switchToSpeaking(): Promise<void> {
    this.logger.log('Switching to speaking video');
    this.currentVideoState = VideoState.SPEAKING;
    this.sw.requestSwitch('speaking.mp4');
  }

  /**
   * Switch to processing state (waiting for AI response)
   */
  async switchToProcessing(): Promise<void> {
    this.logger.log('Switching to processing state');
    this.currentVideoState = VideoState.PROCESSING;
    this.sw.requestSwitch('idle.mp4'); // Using idle video during processing
  }

  /**
   * Play response video with synthesized speech
   * @param responseText The text response from AI
   */
  async playResponseVideo(responseText: string): Promise<void> {
    this.logger.log(`Playing response video for text: ${responseText}`);
    // In a real implementation, you would synthesize speech from text
    // and combine it with the speaking video
    this.currentVideoState = VideoState.SPEAKING;
    this.sw.requestSwitch('speaking.mp4');
  }

  // Removed unused methods that were using the old approach

  /**
   * Stop streaming
   */
  async stopStreaming(): Promise<void> {
    this.logger.log('Stopping streaming');
    // The InstantVideoSwitcher handles cleanup automatically
    this.currentVideoState = VideoState.WELCOME;
  }
}