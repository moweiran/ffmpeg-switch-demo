import { Controller, Post, Body, Param } from '@nestjs/common';
import { StreamService } from './stream.service';

@Controller('stream')
export class StreamController {
  constructor(private readonly streamService: StreamService) {}

  @Post('start')
  startStreaming() {
    this.streamService.startStreaming();
    return { message: 'Streaming started with welcome video' };
  }

  @Post('idle')
  switchToIdle() {
    this.streamService.switchToIdle();
    return { message: 'Switched to idle video' };
  }

  @Post('speaking')
  switchToSpeaking() {
    this.streamService.switchToSpeaking();
    return { message: 'Switched to speaking video' };
  }

  @Post('processing')
  switchToProcessing() {
    this.streamService.switchToProcessing();
    return { message: 'Switched to processing state' };
  }

  @Post('response')
  playResponse(@Body() body: { text: string }) {
    this.streamService.playResponseVideo(body.text);
    return { message: 'Playing response video' };
  }

  @Post('stop')
  stopStreaming() {
    this.streamService.stopStreaming();
    return { message: 'Streaming stopped' };
  }
}