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

@Injectable()
export class StreamService {
  private readonly logger = new Logger(StreamService.name);
  private rtmpUrl: string;
  private currentVideoState: VideoState = VideoState.WELCOME;
  private ffmpegProcess: ChildProcess | null = null;
  private transitionInProgress = false;

  constructor() {
    // Set your RTMP server URL here
    this.rtmpUrl = 'rtmps://rtmp.icommu.cn:4433/live/livestream';
  }

  /**
   * Start streaming with the welcome video
   */
  startStreaming(): void {
    this.logger.log('Starting streaming with welcome video');
    this.currentVideoState = VideoState.WELCOME;
    this.streamVideo('welcome.mp4');
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
    this.streamVideo('idle.mp4');
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
    this.streamVideo('speaking.mp4');
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
    this.streamVideo('idle.mp4'); // Using idle video during processing
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
    this.streamVideo('speaking.mp4');
    this.transitionInProgress = false;
  }

  /**
   * Stream a video file to RTMP server with seamless transition
   * @param videoFileName The name of the video file to stream
   */
  private streamVideo(videoFileName: string): void {
    // Kill previous ffmpeg process if exists
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
    }

    const videoPath = join(process.cwd(), 'videos', videoFileName);
    
    // Check if video file exists
    if (!fs.existsSync(videoPath)) {
      this.logger.error(`Video file not found: ${videoPath}`);
      return;
    }
    
    this.logger.log(`Streaming video: ${videoPath} to ${this.rtmpUrl}`);
    
    // Build ffmpeg command with optimized settings for stable RTMP streaming
    const args = [
      '-re', // Read input at native frame rate
      '-stream_loop', '-1', // Loop the video indefinitely
      '-i', videoPath, // Input file
      '-acodec', 'aac', // AAC audio codec
      '-vcodec', 'libx264', // H.264 video codec
      '-profile:v', 'baseline', // Baseline profile for compatibility
      '-level', '3.1', // Level 3.1
      '-g', '60', // GOP size
      '-r', '30', // Frame rate
      '-s', '720x1280', // Video size
      '-pix_fmt', 'yuv420p', // Pixel format
      '-b:v', '1200k', // Video bitrate
      '-maxrate', '1200k', // Maximum bitrate
      '-bufsize', '1800k', // Buffer size
      '-ar', '16000', // Audio sample rate
      '-ac', '1', // Audio channels
      '-b:a', '64k', // Audio bitrate
      '-preset', 'medium', // Encoding preset
      '-flags', '+low_delay', // Low delay flags
      '-f', 'flv', // Output format for RTMP
      '-flvflags', 'no_duration_filesize', // Prevent issues with duration/filesize updates
      '-fflags', '+genpts', // Generate PTS
      '-avoid_negative_ts', 'make_zero', // Avoid negative timestamps
      '-reconnect', '1', // Enable reconnection
      '-reconnect_at_eof', '1', // Reconnect at EOF
      '-reconnect_streamed', '1', // Reconnect streamed
      '-reconnect_delay_max', '2', // Max reconnect delay
      this.rtmpUrl     // RTMP output URL
    ];
    
    // Spawn ffmpeg process using system-installed ffmpeg
    this.ffmpegProcess = spawn('ffmpeg', args);
    
    if (this.ffmpegProcess) {
      this.ffmpegProcess.on('spawn', () => {
        this.logger.log('FFmpeg process started');
      });
      
      this.ffmpegProcess.on('error', (err) => {
        this.logger.error('FFmpeg process error: ' + err.message);
      });
      
      this.ffmpegProcess.on('close', (code) => {
        this.logger.log(`FFmpeg process closed with code: ${code}`);
      });
      
      // Log ffmpeg output for debugging
      this.ffmpegProcess.stdout?.on('data', (data) => {
        this.logger.debug(`FFmpeg stdout: ${data}`);
      });
      
      this.ffmpegProcess.stderr?.on('data', (data) => {
        this.logger.debug(`FFmpeg stderr: ${data}`);
      });
    }
  }

  /**
   * Stop streaming
   */
  stopStreaming(): void {
    this.logger.log('Stopping streaming');
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
      this.ffmpegProcess = null;
    }
  }
}