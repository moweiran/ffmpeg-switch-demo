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
  private processTerminationPromise: Promise<void> | null = null;

  constructor() {
    // Set your RTMP server URL here
    this.rtmpUrl = 'rtmps://rtmp.icommu.cn:4433/live/livestream';
  }

  /**
   * Start streaming with the welcome video
   */
  async startStreaming(): Promise<void> {
    this.logger.log('Starting streaming with welcome video');
    this.currentVideoState = VideoState.WELCOME;
    await this.streamVideo('welcome.mp4');
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
    
    // Start the new streaming process
    return this.startStreamingProcess(videoFileName);
  }

  /**
   * Terminate the current FFmpeg process gracefully
   */
  private terminateProcess(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ffmpegProcess) {
        // No process to terminate
        resolve();
        return;
      }
      
      this.logger.log('Terminating FFmpeg process');
      
      // Set a timeout to force kill if graceful termination takes too long
      const forceKillTimeout = setTimeout(() => {
        if (this.ffmpegProcess) {
          this.logger.warn('Force killing FFmpeg process');
          this.ffmpegProcess.kill('SIGKILL');
        }
        this.ffmpegProcess = null;
        resolve();
      }, 2000); // 2 second timeout
      
      // Listen for the close event
      this.ffmpegProcess.once('close', (code, signal) => {
        clearTimeout(forceKillTimeout);
        this.logger.log(`FFmpeg process closed with code: ${code}, signal: ${signal}`);
        this.ffmpegProcess = null;
        resolve();
      });
      
      // Send termination signal
      this.ffmpegProcess.kill('SIGTERM');
    });
  }

  /**
   * Start the actual streaming process
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
      
      // Build ffmpeg command with optimized settings for stable RTMP streaming
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
        this.rtmpUrl     // RTMP output URL
      ];
      
      // Spawn ffmpeg process using system-installed ffmpeg
      this.ffmpegProcess = spawn('ffmpeg', args);
      
      if (this.ffmpegProcess) {
        let processStarted = false;
        
        this.ffmpegProcess.on('spawn', () => {
          this.logger.log('FFmpeg process started successfully');
          processStarted = true;
          // Give a small delay to ensure process is fully initialized
          setTimeout(() => {
            resolve();
          }, 300);
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