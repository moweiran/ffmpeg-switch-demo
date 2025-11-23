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

  /**
   * 开始推流
   */
  async startStream(
    streamKey: string,
    inputSource: string,
  ): Promise<{ sessionId: string; initialOffset: number }> {
    // 检查是否已有活跃会话
    const existingSession = this.activeSessions.get(streamKey);

    let initialOffset = 0;

    if (existingSession && existingSession.isActive) {
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
   * 启动 FFmpeg 推流进程
   */
  private startFFmpegStream(
    session: StreamSession,
    inputSource: string,
    initialOffset: number,
  ): void {
    const { spawn } = require('child_process');
    const videoPath = join(process.cwd(), 'videos', "welcome.mp4")
    // FFmpeg 命令参数
    const args = [
      '-i',
      videoPath, // 输入源
      '-c',
      'copy', // 流拷贝，不重新编码
      '-f',
      'flv', // 输出格式
      '-initial_offset',
      initialOffset.toString(), // 关键：设置初始时间戳偏移
      '-flush_packets',
      '1', // 立即刷新包
      '-y', // 覆盖输出文件
      `rtmps://rtmp.icommu.cn:4433/live/livestream`, // RTMP 地址
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
    if (session && session.isActive) {
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
    return Array.from(this.activeSessions.values()).filter(
      (session) => session.isActive,
    );
  }

  /**
   * 清理非活跃会话
   */
  cleanupInactiveSessions(): number {
    let cleanedCount = 0;

    for (const [streamKey, session] of this.activeSessions.entries()) {
      if (!session.isActive) {
        this.activeSessions.delete(streamKey);
        cleanedCount++;
      }
    }

    this.logger.log(`清理了 ${cleanedCount} 个非活跃会话`);
    return cleanedCount;
  }
}
