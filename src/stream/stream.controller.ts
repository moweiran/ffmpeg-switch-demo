import { Controller, Post, Get, Delete, Body, Param, Query } from '@nestjs/common';
import { StreamService } from './stream.service';

@Controller('stream')
export class StreamController {
  constructor(private readonly streamService: StreamService) {}

  @Post('start')
  async startStream(
    @Body() body: { streamKey: string; inputSource: string }
  ) {
    const { streamKey, inputSource } = body;
    return await this.streamService.startStream(streamKey, inputSource);
  }

  @Post('idle')
  async idleStream(
    @Body() body: { streamKey: string }
  ) {
    const { streamKey } = body;
    return await this.streamService.switchToIdle(streamKey);
  }

  @Post('speaking')
  async speakingStream(
    @Body() body: { streamKey: string }
  ) {
    const { streamKey } = body;
    return await this.streamService.switchToSpeaking(streamKey);
  }

  @Delete('stop/:streamKey')
  async stopStream(@Param('streamKey') streamKey: string) {
    const result = await this.streamService.stopStream(streamKey);
    return { success: result };
  }

  @Post('timestamp/:streamKey')
  async updateTimestamp(
    @Param('streamKey') streamKey: string,
    @Body() body: { timestamp: number }
  ) {
    this.streamService.updateStreamTimestamp(streamKey, body.timestamp);
    return { success: true };
  }

  @Get('session/:streamKey')
  async getSession(@Param('streamKey') streamKey: string) {
    const session = this.streamService.getStreamSession(streamKey);
    return { session };
  }

  @Get('sessions')
  async getAllSessions() {
    const sessions = this.streamService.getAllActiveSessions();
    return { sessions };
  }
}