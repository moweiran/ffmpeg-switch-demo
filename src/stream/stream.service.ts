import { Injectable, Logger } from '@nestjs/common';
import { InstantVideoSwitcher2 } from './stable-instant-video-switcher2';
import { StreamSwitcher } from './stable-instant-video-switcher';

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
  private sw = new StreamSwitcher();
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