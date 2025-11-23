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
    inputSource: string = 'audio_0.mp4',
  ): Promise<{ sessionId: string; initialOffset: number }> {
    // 设置初始状态为 pending
    this.streamStates.set(streamKey, 'pending');

    // 检查是否已有活跃会话
    const existingSession = this.activeSessions.get(streamKey);
    console.log(JSON.stringify(this.activeSessions));

    let initialOffset = 0;

    if (existingSession) {
      // 如果存在活跃会话，使用上次的最后时间戳 + 缓冲
      initialOffset = existingSession.lastTimestamp; // 增加1秒缓冲
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

    // 不再在启动后立即切换到空闲状态，避免音频问题
    // 让调用者决定何时切换状态

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
    // 对于相同视频文件，重置时间戳以从头开始播放
    return await this.switchVideo(streamKey, 'idle2.mp4', true);
  }

  /**
   * 切换到说话状态
   */
  async switchToSpeaking(streamKey: string): Promise<boolean> {
    this.streamStates.set(streamKey, 'speaking');
    // 对于相同视频文件，重置时间戳以从头开始播放
    // return await this.switchVideo(streamKey, 'speaking1.mp4', true);
    // return await this.switchVideo(streamKey, 'audio_0.mp4', true);
    return await this.switchVideo(streamKey, 'speaking3.mp4', true);
  }

  async switchToWelcome(streamKey: string): Promise<boolean> {
    this.streamStates.set(streamKey, 'welcome');
    // 对于相同视频文件，重置时间戳以从头开始播放
    return await this.switchVideo(streamKey, 'welcome1.mp4', true);
  }

  /**
   * 切换视频源
   */
  private async switchVideo(
    streamKey: string,
    videoFile: string,
    resetTimestamp: boolean = false,
  ): Promise<boolean> {
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
        // 发送 SIGTERM 信号优雅地终止进程
        existingProcess.kill('SIGTERM');

        // 等待进程完全终止，最多等待1秒
        let attempts = 0;
        const maxAttempts = 10; // 最多等待1秒 (10 * 100ms)
        while (this.ffmpegProcesses.has(streamKey) && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }

        // 如果进程仍未退出，强制终止
        if (this.ffmpegProcesses.has(streamKey)) {
          existingProcess.kill('SIGKILL');
          // 等待一小段时间确保进程被杀死
          // await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // 确定初始偏移量
      let initialOffset = 0;
      if (!resetTimestamp) {
        // 如果不需要重置时间戳，则使用累积的时间戳
        initialOffset = session.lastTimestamp;
      }

      // 等待一小段时间确保前一个进程完全终止
      // await new Promise(resolve => setTimeout(resolve, 100));

      // 启动新的 FFmpeg 推流
      this.startFFmpegStream(session, videoFile, initialOffset);

      this.logger.log(
        `成功切换流 ${streamKey} 到 ${videoFile}，初始偏移: ${initialOffset}`,
      );
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
    console.log('videoPath', videoPath);

    // 检查文件是否存在
    if (!this.checkFileAvailability(videoPath)) {
      this.logger.error(`输入文件不存在: ${videoPath}`);
      return;
    }

    // Base arguments for all streams
    const baseArgs = [
      '-re', // 以本地帧速率读取输入
      '-stream_loop',
      '-1',
      '-i',
      videoPath, // 输入源

      // Force consistent video properties for all inputs
      '-vf',
      'scale=720:1280,fps=30,setsar=1:1,format=yuv420p',
      '-colorspace',
      'bt709',
      '-color_range',
      'tv',
      '-color_primaries',
      'bt709',
      '-color_trc',
      'bt709',

      // 视频编码参数
      '-c:v',
      'libx264', // 使用 H.264 编码器
      '-profile:v',
      'baseline', // Baseline profile for better compatibility
      '-level',
      '3.1', // Level 3.1
      '-pix_fmt',
      'yuv420p', // Pixel format
      '-s',
      '720x1280', // Resolution
      '-r',
      '30', // Frame rate
      '-g',
      '60', // GOP size
      '-b:v',
      '1200k', // Video bitrate
      '-maxrate',
      '1200k', // Maximum bitrate
      '-bufsize',
      '1800k', // Buffer size
    ];

    // 使用优化的 FFmpeg 参数确保流稳定性，添加音频重采样参数防止重复播放时的音频问题
    var audioArgs = [
      // 音频编码参数 - 添加更多兼容性选项
      '-c:a',
      'aac', // 使用 AAC 音频编码器
      '-ar',
      '16000', // Audio sample rate
      '-ac',
      '1', // Audio channels
      '-b:a',
      '64k', // Audio bitrate
      // Force audio stream creation even if input lacks audio
      // '-shortest',
      // '-af', 'aresample=async=1:first_pts=0,silencedetect=n=-50dB:d=1',
      //  inputSource.startsWith("idle") ? "" : "",
      '-af',
      'aresample=async=1:first_pts=0', // 音频重采样以处理时间戳问题
      // '-strict', 'experimental', // Allows experimental audio encoders if needed
    ];

    // Output and formatting arguments
    const outputArgs = [
      // 编码器预设和调优
      '-preset',
      'medium', // Encoding preset
      '-tune',
      'zerolatency', // Tune for low latency
      '-avoid_negative_ts',
      'make_zero', // 避免负时间戳

      // 输出格式和目标 - 添加更多流稳定性参数
      '-f',
      'flv', // Output format
      '-flags',
      '+low_delay', // Low delay flags
      '-initial_offset',
      `${initialOffset}`,
      '-flush_packets',
      '1', // Flush packets immediately
      '-fflags',
      '+genpts', // 生成缺失的时间戳
      '-reconnect',
      '1', // 启用重新连接
      '-reconnect_at_eof',
      '1', // 在EOF时重新连接
      '-reconnect_streamed',
      '1', // 重新连接流媒体
      '-reconnect_delay_max',
      '2', // 最大重新连接延迟
      '-y',
      'rtmps://rtmp.icommu.cn:4433/live/livestream', // RTMP destination
    ];

    // const args = [
    //   '-re',                    // 以本地帧速率读取输入
    //   '-stream_loop', '-1',
    //   '-i', videoPath,          // 输入源

    //   // Force consistent video properties for all inputs
    //   '-vf', 'scale=720:1280,fps=30,setsar=1:1,format=yuv420p',
    //   '-colorspace', 'bt709',
    //   '-color_range', 'tv',
    //   '-color_primaries', 'bt709',
    //   '-color_trc', 'bt709',

    //   // 视频编码参数
    //   '-c:v', 'libx264',        // 使用 H.264 编码器
    //   '-profile:v', 'baseline', // Baseline profile for better compatibility
    //   '-level', '3.1',          // Level 3.1
    //   '-pix_fmt', 'yuv420p',    // Pixel format
    //   '-s', '720x1280',         // Resolution
    //   '-r', '30',               // Frame rate
    //   '-g', '60',               // GOP size
    //   '-b:v', '1200k',          // Video bitrate
    //   '-maxrate', '1200k',      // Maximum bitrate
    //   '-bufsize', '1800k',      // Buffer size

    //   inputSource.startsWith("idle") ? "" : audioArgs,

    //   // 编码器预设和调优
    //   '-preset', 'medium',      // Encoding preset
    //   '-tune', 'zerolatency',   // Tune for low latency
    //   '-avoid_negative_ts', 'make_zero', // 避免负时间戳

    //   // 输出格式和目标 - 添加更多流稳定性参数
    //   '-f', 'flv',              // Output format
    //   '-flags', '+low_delay',   // Low delay flags
    //   '-initial_offset', `${initialOffset}`,
    //   '-flush_packets', '1',     // Flush packets immediately
    //   '-fflags', '+genpts',     // 生成缺失的时间戳
    //   '-reconnect', '1',        // 启用重新连接
    //   '-reconnect_at_eof', '1', // 在EOF时重新连接
    //   '-reconnect_streamed', '1', // 重新连接流媒体
    //   '-reconnect_delay_max', '2', // 最大重新连接延迟
    //   '-y',
    //   'rtmps://rtmp.icommu.cn:4433/live/livestream'  // RTMP destination
    // ];

    const args = [...baseArgs];
    // if(!inputSource.startsWith("idle")){
    args.push(...audioArgs);
    // }
    args.push(...outputArgs);

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
      console.log('totalMs', totalMs);
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
      // 发送 SIGTERM 信号优雅地终止进程
      process.kill('SIGTERM');

      // 等待进程完全终止，最多等待2秒
      let attempts = 0;
      const maxAttempts = 20; // 最多等待2秒 (20 * 100ms)
      while (this.ffmpegProcesses.has(streamKey) && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }

      // 如果进程仍未退出，强制终止
      if (this.ffmpegProcesses.has(streamKey)) {
        this.logger.warn(`强制终止 FFmpeg 进程: ${streamKey}`);
        process.kill('SIGKILL');
        // 等待一小段时间确保进程被杀死
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

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

  /**
   * 检查文件是否存在以及是否包含音频轨道
   */
  private checkFileAvailability(filePath: string): boolean {
    try {
      const fs = require('fs');
      return fs.existsSync(filePath);
    } catch (error) {
      this.logger.error(`检查文件可用性时出错: ${error.message}`);
      return false;
    }
  }
}
