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
- FIFO-based streaming for seamless transitions
- Enhanced audio continuity with optimized encoding parameters

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

# Run optimized transition tests
node test-optimized-transitions.js

# Debug specific transitions
node debug-transitions.js
```

## Technical Details

### FFmpeg Settings

The service uses these FFmpeg parameters for optimal streaming:

```
-re                           # Read input at native frame rate
-stream_loop -1               # Loop the video indefinitely
-c:v libx264                  # H.264 video codec
-c:a aac                      # AAC audio codec
-preset ultrafast             # Fast encoding for real-time
-tune zerolatency             # Zero latency tuning
-pix_fmt yuv420p              # Pixel format compatibility
-b:v 1200k                    # Video bitrate
-maxrate 1200k                # Maximum bitrate
-bufsize 1800k                # Buffer size
-ar 16000                     # Audio sample rate
-ac 1                         # Audio channels
-b:a 64k                      # Audio bitrate
-g 60                         # GOP size for smooth switching
-profile:v baseline           # Baseline profile for compatibility
-level 3.1                    # Level 3.1
-f flv                        # FLV format for RTMP
-start_at_zero                # Start timestamps at zero for consistency
-fflags +genpts               # Generate presentation timestamps
-avoid_negative_ts make_zero  # Handle negative timestamps
```

### Optimization Features

1. **FIFO-based Streaming**: Uses named pipes for seamless video transitions without restarting FFmpeg
2. **Enhanced Audio Continuity**: Optimized audio encoding parameters ensure consistent audio during transitions
3. **Transition Throttling**: Prevents overly frequent transitions that could cause stuttering
4. **Improved Error Handling**: Better logging and error recovery mechanisms
5. **Stream Keepalive**: Regular data injection to maintain stream stability

### Seamless Transition Mechanism

The application uses a FIFO (First In, First Out) named pipe approach:

1. FFmpeg continuously reads from a named pipe (`stream_fifo.mp4`)
2. When switching videos, the new video is piped into the FIFO
3. FFmpeg seamlessly transitions to the new content without restarting
4. Timestamp synchronization ensures no gaps or black screens
5. Audio continuity is maintained through proper AAC encoding parameters

This approach eliminates the need to restart FFmpeg for each transition, which was the primary cause of black screens and audio dropouts in previous implementations.