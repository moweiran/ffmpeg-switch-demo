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

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd video-streaming-app

# Install dependencies
yarn install

# Make sure you have ffmpeg installed on your system
ffmpeg -version
```

## Setup

1. Place your video files in the `videos/` directory:
   - `welcome.mp4` - Played when user first joins
   - `idle.mp4` - Played when user isn't speaking
   - `speaking.mp4` - Played when user is speaking or AI is responding

2. Update the RTMP server URL in `src/stream/stream.service.ts`:
   ```typescript
   this.rtmpUrl = 'your-rtmp-server-url';
   ```

## Running the Application

```bash
# Development mode
yarn start

# Production mode
yarn start:prod
```

## API Endpoints

### HTTP Endpoints

- `POST /stream/start` - Start streaming welcome video
- `POST /stream/idle` - Switch to idle video
- `POST /stream/speaking` - Switch to speaking video
- `POST /stream/processing` - Show processing state
- `POST /stream/response` - Play response video (body: { text: "response text" })
- `POST /stream/stop` - Stop streaming

### WebSocket Events

- `userJoined` - Start streaming welcome video
- `userSpeaking` - Switch to speaking video
- `userStoppedSpeaking` - Switch to idle video
- `requestProcessing` - Show processing state
- `aiResponse` - Play response video with AI text

## Testing

You can test the application using the provided test scripts:

```bash
# Run the complete test (requires Docker)
./run-complete-test.sh

# Run streaming test only
node test-streaming.js

# Test RTMPS streaming directly
node test-rtmps.js
```

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
-b:v 1200k                   # Video bitrate
-maxrate 1200k               # Maximum bitrate
-bufsize 1800k               # Buffer size
-b:a 64k                     # Audio bitrate
-ar 16000                    # Audio sample rate
-ac 1                        # Audio channels
-g 50                        # GOP size for smooth switching
-profile:v baseline          # Baseline profile for compatibility
-level 3.1                   # Level 3.1
-f flv                       # FLV format for RTMP
```

### Transition Optimization

To prevent stuttering and ensure smooth transitions:

1. **Graceful Process Termination**: Previous FFmpeg process is properly terminated before starting a new one
2. **Transition Locking**: Prevents multiple simultaneous transitions
3. **Consistent Encoding**: All videos use the same encoding parameters
4. **GOP Alignment**: GOP size of 50 frames for smooth switching
5. **Fast Encoding**: Ultrafast preset with zerolatency tuning for minimal delay
6. **Continuous Looping**: Videos loop continuously to prevent gaps

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
4. Confirm all videos are encoded with the same parameters

### Transitions causing stuttering

1. Make sure videos have keyframes aligned at consistent intervals (GOP size of 50)
2. Use the ultrafast preset and zerolatency tuning for real-time encoding
3. Ensure proper termination of previous FFmpeg processes before starting new ones

### Connection Issues

1. Verify the RTMP server URL is correct
2. Check that the RTMP server is running and accessible
3. Ensure firewall settings allow RTMP traffic (usually port 1935)

## License

This project is licensed under the MIT License.