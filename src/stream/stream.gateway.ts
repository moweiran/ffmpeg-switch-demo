import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { StreamService, VideoState } from './stream.service';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure appropriately for production
  }
})
export class StreamGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly streamService: StreamService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    // Start streaming welcome video when first client connects
    this.streamService.startStreaming();
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('userJoined')
  handleUserJoined(client: Socket) {
    console.log(`User joined: ${client.id}`);
    // Start with welcome video
    this.streamService.startStreaming();
  }

  @SubscribeMessage('userSpeaking')
  handleUserSpeaking(client: Socket) {
    console.log(`User speaking: ${client.id}`);
    // Switch to speaking video
    this.streamService.switchToSpeaking();
  }

  @SubscribeMessage('userStoppedSpeaking')
  handleUserStoppedSpeaking(client: Socket) {
    console.log(`User stopped speaking: ${client.id}`);
    // Switch to idle video
    this.streamService.switchToIdle();
  }

  @SubscribeMessage('aiResponse')
  handleAiResponse(client: Socket, payload: { text: string }) {
    console.log(`AI response for client ${client.id}: ${payload.text}`);
    // Play response video with AI text
    this.streamService.playResponseVideo(payload.text);
  }

  @SubscribeMessage('requestProcessing')
  handleRequestProcessing(client: Socket) {
    console.log(`Processing request for client ${client.id}`);
    // Show processing state
    this.streamService.switchToProcessing();
  }
}