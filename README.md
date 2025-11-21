# Video Streaming Service with FFmpeg and NestJS

This application provides a video streaming service that seamlessly switches between different videos based on user interactions, using FFmpeg to stream to an RTMP server.

## Features

- Smooth video transitions without black screens or stuttering
- Three video states:
  1. Welcome video (when user first joins)
  2. Idle video (when user isn't speaking)
  3. Speaking video (when user is speaking or AI is responding)
- WebSocket and HTTP APIs for controlling the stream
- Optimized FFmpeg settings for real-time streaming

## Prerequisites

- Node.js (v18 or higher)
- FFmpeg (system-installed)
- An RTMP server (e.g., nginx-rtmp, Wowza, or AWS IVS)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd video-streaming-app

# Install dependencies
yarn install

# Place your videos in the /videos directory:
# - welcome.mp4 (played when user first joins)
# - idle.mp4 (played when user isn't speaking)
# - speaking.mp4 (played when user is speaking or AI responds)
```

## Configuration

Set your RTMP server URL in environment variables:

```bash
RTMP_URL=rtmp://your-rtmp-server/live/stream
```

Or modify the default URL in `src/stream/stream.service.ts`.

## Video Requirements

For seamless transitions, all videos should have:
- Same resolution and aspect ratio
- Same audio sample rate (44100 Hz)
- Same frame rate
- Keyframes aligned (GOP size of 50 frames)

## Running the Application

```bash
# Development mode
yarn run start

# Production mode
yarn run start:prod
```

The application will start on http://localhost:3000

## API Usage

### WebSocket Events

Connect to the WebSocket server and emit these events:

- `userJoined` - Start streaming welcome video
- `userSpeaking` - Switch to speaking video
- `userStoppedSpeaking` - Switch to idle video
- `requestProcessing` - Show processing state (plays idle video)
- `aiResponse` - Play response video with AI text: `{ text: "response text" }`

### HTTP Endpoints

- `POST /stream/start` - Start streaming welcome video
- `POST /stream/idle` - Switch to idle video
- `POST /stream/speaking` - Switch to speaking video
- `POST /stream/processing` - Show processing state
- `POST /stream/response` - Play response video (body: `{ text: "response text" }`)
- `POST /stream/stop` - Stop streaming

## How It Works

1. When a user joins, the welcome video plays
2. When the user isn't speaking, the idle video plays
3. When the user is speaking, the speaking video plays
4. During AI processing, the idle video continues playing
5. When AI responds, the speaking video plays with the response

The service uses FFmpeg with optimized settings to ensure smooth transitions:
- Ultra-fast encoding preset
- Zero-latency tuning
- Consistent GOP size for seamless switching
- Proper buffering settings

## Technical Details

### FFmpeg Settings

The service uses these FFmpeg parameters for optimal streaming:

```
-re                           # Read input at native frame rate
-stream_loop -1              # Loop the video indefinitely
-c:v libx264                 # H.264 video codec
-c:a aac                     # AAC audio codec
-preset ultrafast            # Fast encoding for real-time
-tune zerolatency            # Zero latency tuning
-pix_fmt yuv420p             # Pixel format compatibility
-b:v 2500k                   # Video bitrate
-b:a 128k                    # Audio bitrate
-ar 44100                    # Audio sample rate
-g 50                        # GOP size for smooth switching
-keyint_min 50               # Minimum GOP size
-sc_threshold 0              # Disable scene change detection
-f flv                       # FLV format for RTMP
```

### Transition Handling

To prevent black screens and stuttering:
1. Previous FFmpeg process is cleanly terminated before starting a new one
2. Transition flag prevents multiple simultaneous transitions
3. Videos are looped continuously to ensure seamless playback
4. Consistent encoding settings across all videos

## Client Implementation

See `client-example.html` for a sample client implementation that demonstrates:
- Connecting to the WebSocket server
- Emitting events based on user interactions
- Controlling the stream via HTTP endpoints

## Troubleshooting

### Videos not playing smoothly

1. Ensure all videos have the same resolution, frame rate, and audio settings
2. Check that your RTMP server has sufficient bandwidth
3. Verify that the GOP sizes are consistent across videos

### Black screen during transitions

1. Make sure videos have frequent keyframes (GOP size of 50 or less)
2. Check that videos have the same resolution and aspect ratio
3. Verify that the RTMP server is properly configured

### FFmpeg errors

1. Check that videos exist in the `/videos` directory
2. Verify that videos are valid and not corrupted
3. Ensure sufficient system resources for encoding

## License

This project is licensed under the MIT License.