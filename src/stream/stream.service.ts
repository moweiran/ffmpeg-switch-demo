import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { StreamSession } from './entities/stream-session.entity';
import path, { join } from 'path';

@Injectable()
export class StreamService {
  private readonly logger = new Logger(StreamService.name);

  // 存储活跃的流会话
  private activeSessions: Map<string, StreamSession> = new Map();

  // 存储 FFmpeg 进程
  private ffmpegProcesses: Map<string, ChildProcess> = new Map();

  // 存储当前流的状态
  private streamStates: Map<string, string> = new Map(); // 'pending' | 'idle' | 'speaking'

  // 转换锁，防止并发转换
  private transitionLocks: Map<string, boolean> = new Map();

  /**
   * 开始推流
   */
  async startStream(
    streamKey: string,
    inputSource: string = 'welcome.mp4',
  ): Promise<{ sessionId: string; initialOffset: number }> {
    // 设置初始状态为 pending
    this.streamStates.set(streamKey, 'pending');

    // 检查是否已有活跃会话
    const existingSession = this.activeSessions.get(streamKey);
    console.log(JSON.stringify(this.activeSessions));

    let initialOffset = 0;

    if (existingSession) {
      // 如果存在活跃会话，使用上次的最后时间戳 + 缓冲
      initialOffset = existingSession.lastTimestamp + 1000; // 增加1秒缓冲
      this.logger.log(`接续流 ${streamKey}，初始偏移: ${initialOffset}ms`);
      // 停止之前的推流进程
      await this.stopStream(streamKey);
    } else {
      this.logger.log(`开始新流 ${streamKey}`);
    }

    // 创建新会话
    const session = new StreamSession(streamKey);
    session.lastTimestamp = initialOffset;
    this.activeSessions.set(streamKey, session);

    // 启动 FFmpeg 推流
    this.startFFmpegStream(session, inputSource, initialOffset);

    return {
      sessionId: session.id,
      initialOffset,
    };
  }

  /**
   * 切换到空闲状态
   */
  async switchToIdle(streamKey: string): Promise<boolean> {
    this.streamStates.set(streamKey, 'idle');
    return await this.switchVideo(streamKey, 'idle.mp4');
  }

  /**
   * 切换到说话状态
   */
  async switchToSpeaking(streamKey: string): Promise<boolean> {
    this.streamStates.set(streamKey, 'speaking');
    return await this.switchVideo(streamKey, 'speaking.mp4');
  }

  async switchToWelcome(streamKey: string): Promise<boolean> {
    this.streamStates.set(streamKey, 'welcome');
    return await this.switchVideo(streamKey, 'welcome.mp4');
  }

  /**
   * 切换视频源
   */
  private async switchVideo(streamKey: string, videoFile: string): Promise<boolean> {
    // 检查是否正在转换中
    if (this.transitionLocks.get(streamKey)) {
      this.logger.warn(`流 ${streamKey} 正在转换中，请稍后再试`);
      return false;
    }

    // 设置转换锁
    this.transitionLocks.set(streamKey, true);

    try {
      // 获取现有会话
      console.log('activeSessions', JSON.stringify(this.activeSessions));
      const session = this.activeSessions.get(streamKey);
      if (!session) {
        this.logger.warn(`未找到活跃的流会话: ${streamKey}`);
        return false;
      } else {
        this.logger.log(`找到活跃的流会话: ${streamKey}`);
      }

      // 终止现有 FFmpeg 进程
      const existingProcess = this.ffmpegProcesses.get(streamKey);
      if (existingProcess) {
        existingProcess.kill('SIGTERM');

        // 等待进程完全终止
        // await new Promise(resolve => setTimeout(resolve, 300));
      }

      // 等待资源释放
      // await new Promise(resolve => setTimeout(resolve, 500));

      // 启动新的 FFmpeg 进程
      // await new Promise(resolve => setTimeout(resolve, 200));

      // 启动新的 FFmpeg 推流
      this.startFFmpegStream(session, videoFile, session.lastTimestamp);

      this.logger.log(`成功切换流 ${streamKey} 到 ${videoFile}`);
      return true;
    } catch (error) {
      this.logger.error(`切换流 ${streamKey} 失败: ${error.message}`);
      return false;
    } finally {
      // 释放转换锁
      this.transitionLocks.set(streamKey, false);
    }
  }

  /**
   * 启动 FFmpeg 推流进程
   */
  private startFFmpegStream(
    session: StreamSession,
    inputSource: string,
    initialOffset: number,
  ): void {
    const { spawn } = require('child_process');
    const videoPath = join(process.cwd(), 'videos', inputSource);

    // 使用优化的 FFmpeg 参数确保流稳定性
    const args = [
      '-re', // 以本地帧速率读取输入
      '-stream_loop', '-1', // 循环播放输入源
      '-i', videoPath, // 输入源
      '-c:v', 'libx264', // 视频编码器
      '-profile:v', 'baseline', // H.264 基准配置
      '-level', '3.1', // H.264 级别
      '-g', '60', // GOP 大小
      '-r', '30', // 帧率
      '-s', '720x1280', // 分辨率
      '-pix_fmt', 'yuv420p', // 像素格式
      '-b:v', '1200k', // 视频比特率
      '-maxrate', '1200k', // 最大比特率
      '-bufsize', '1800k', // 缓冲区大小
      '-c:a', 'aac', // 音频编码器
      '-ar', '16000', // 音频采样率
      '-ac', '1', // 音频通道数
      '-b:a', '64k', // 音频比特率
      '-preset', 'medium', // 编码预设
      '-flags', '+low_delay', // 低延迟标志
      '-fflags', '+genpts', // 强制生成 pts
      '-avoid_negative_ts', 'make_zero', // 避免负时间戳
      '-initial_offset', initialOffset.toString(), // 设置初始时间戳偏移
      // '-initial_offset', '0',
      '-flush_packets', '1', // 立即刷新包
      '-flvflags', 'no_duration_filesize', // FLV 标志
      '-f', 'flv', // 输出格式
      'rtmps://rtmp.icommu.cn:4433/live/livestream', // RTMP 地址
    ];

    this.logger.log(`启动 FFmpeg: ffmpeg ${args.join(' ')}`);

    const ffmpegProcess = spawn('ffmpeg', args);

    // 存储进程引用
    this.ffmpegProcesses.set(session.streamKey, ffmpegProcess);

    // 处理标准输出
    ffmpegProcess.stdout.on('data', (data) => {
      this.logger.debug(`FFmpeg stdout: ${data}`);
    });

    // 处理错误输出
    ffmpegProcess.stderr.on('data', (data) => {
      const output = data.toString();
      this.logger.debug(`FFmpeg stderr: ${output}`);

      // 从 FFmpeg 输出中解析时间戳信息（简化示例）
      this.parseTimestampFromOutput(session, output);
    });

    // 处理进程退出
    ffmpegProcess.on('close', (code) => {
      this.logger.log(`FFmpeg 进程退出，代码: ${code}`);
      this.ffmpegProcesses.delete(session.streamKey);

      // 更新会话状态
      const currentSession = this.activeSessions.get(session.streamKey);
      if (currentSession && currentSession.id === session.id) {
        currentSession.stop();
      }
    });

    ffmpegProcess.on('error', (error) => {
      this.logger.error(`FFmpeg 进程错误: ${error.message}`);
    });
  }

  /**
   * 从 FFmpeg 输出解析时间戳（简化实现）
   */
  private parseTimestampFromOutput(
    session: StreamSession,
    output: string,
  ): void {
    // 这里需要根据实际的 FFmpeg 输出格式来解析时间戳
    // 这是一个简化的示例，实际应用中需要更复杂的解析逻辑

    // 示例：匹配时间信息 "time=00:01:23.45"
    const timeMatch = output.match(/time=(\d+):(\d+):(\d+).(\d+)/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const seconds = parseInt(timeMatch[3]);
      const ms = parseInt(timeMatch[4]);

      const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000 + ms;

      // 更新会话的最后时间戳（加上初始偏移）
      session.updateTimestamp(totalMs);
    }

    // 或者可以定期从外部获取流的时间戳信息
  }

  /**
   * 停止推流
   */
  async stopStream(streamKey: string): Promise<boolean> {
    // 清除状态
    this.streamStates.delete(streamKey);

    const process = this.ffmpegProcesses.get(streamKey);

    if (process) {
      process.kill('SIGTERM');
      this.ffmpegProcesses.delete(streamKey);
      this.logger.log(`已停止流: ${streamKey}`);
      return true;
    }

    this.logger.warn(`未找到活跃的流进程: ${streamKey}`);
    return false;
  }

  /**
   * 手动更新时间戳（用于外部监控）
   */
  updateStreamTimestamp(streamKey: string, timestamp: number): void {
    const session = this.activeSessions.get(streamKey);
    if (session) {
      session.updateTimestamp(timestamp);
      this.logger.debug(`更新流 ${streamKey} 时间戳: ${timestamp}`);
    }
  }

  /**
   * 获取流会话信息
   */
  getStreamSession(streamKey: string): StreamSession | null {
    return this.activeSessions.get(streamKey) || null;
  }

  /**
   * 获取所有活跃会话
   */
  getAllActiveSessions(): StreamSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * 清理非活跃会话
   */
  cleanupInactiveSessions(): number {
    let cleanedCount = 0;

    for (const [streamKey, session] of this.activeSessions.entries()) {
      if (!session) {
        this.activeSessions.delete(streamKey);
        this.streamStates.delete(streamKey);
        cleanedCount++;
      }
    }

    this.logger.log(`清理了 ${cleanedCount} 个非活跃会话`);
    return cleanedCount;
  }
}