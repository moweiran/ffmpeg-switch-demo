import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return `
<h1>Video Streaming Service</h1>
<p>This service streams videos to an RTMP server based on user interactions.</p>

<h2>WebSocket Events:</h2>
<ul>
  <li><strong>userJoined</strong> - Start streaming welcome video</li>
  <li><strong>userSpeaking</strong> - Switch to speaking video</li>
  <li><strong>userStoppedSpeaking</strong> - Switch to idle video</li>
  <li><strong>requestProcessing</strong> - Show processing state</li>
  <li><strong>aiResponse</strong> - Play response video with AI text</li>
</ul>

<h2>HTTP Endpoints:</h2>
<ul>
  <li><strong>POST /stream/start</strong> - Start streaming welcome video</li>
  <li><strong>POST /stream/idle</strong> - Switch to idle video</li>
  <li><strong>POST /stream/speaking</strong> - Switch to speaking video</li>
  <li><strong>POST /stream/processing</strong> - Show processing state</li>
  <li><strong>POST /stream/response</strong> - Play response video (body: { text: "response text" })</li>
  <li><strong>POST /stream/stop</strong> - Stop streaming</li>
</ul>

<h2>How it works:</h2>
<ol>
  <li>When a user joins, the welcome video plays</li>
  <li>When the user isn't speaking, the idle video plays</li>
  <li>When the user is speaking, the speaking video plays</li>
  <li>During AI processing, the idle video continues playing</li>
  <li>When AI responds, the speaking video plays with the response</li>
</ol>
    `;
  }
}