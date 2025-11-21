# Stunnel Setup for Reliable RTMPS Streaming

This document explains how to set up stunnel as a TLS proxy for reliable RTMPS streaming, which resolves the stuttering and audio issues experienced with direct RTMPS connections.

## Why Use Stunnel?

Direct RTMPS connections with FFmpeg can be unreliable due to FFmpeg's limited RTMPS implementation. Using stunnel as a TLS proxy provides:

- More stable connections
- Better handling of TLS handshakes
- Reduced stuttering during transitions
- Consistent audio streaming
- Improved error recovery

## Setup Instructions

### 1. Run the Setup Script

```bash
# Make the script executable
chmod +x setup-stunnel.sh

# Run the setup script
./setup-stunnel.sh
```

The script will:
- Check if stunnel is installed and install it if needed
- Copy the configuration file to `/etc/stunnel/rtmps.conf`
- Create necessary directories

### 2. Start Stunnel

```bash
# Start stunnel with the configuration
sudo stunnel /etc/stunnel/rtmps.conf
```

Or to start stunnel in the background:
```bash
sudo stunnel
```

### 3. Verify Stunnel is Running

```bash
# Check if stunnel process is running
ps aux | grep stunnel

# You should see output similar to:
# root     12345   0.0  0.0  stunnel /etc/stunnel/rtmps.conf
```

## How It Works

1. **Local RTMP Endpoint**: FFmpeg streams to `rtmp://127.0.0.1:1935/live/livestream` (local endpoint)
2. **Stunnel Proxy**: Stunnel listens on port 1935 and forwards traffic to the remote RTMPS server
3. **Remote RTMPS Server**: The actual streaming server at `rtmps://rtmp.icommu.cn:4433/live/livestream`

```
[FFmpeg] --> rtmp://127.0.0.1:1935/live/livestream
               |
               v
          [stunnel proxy]
               |
               v
rtmps://rtmp.icommu.cn:4433/live/livestream
```

## Testing the Setup

After setting up stunnel, test the streaming with:

```bash
# Start your application
yarn start

# In another terminal, run the stunnel test
yarn test:stunnel
```

## Troubleshooting

### Stunnel Not Starting

1. Check if the configuration file exists:
   ```bash
   ls -la /etc/stunnel/rtmps.conf
   ```

2. Verify the configuration file contents:
   ```bash
   cat /etc/stunnel/rtmps.conf
   ```

3. Check for permission issues:
   ```bash
   sudo stunnel /etc/stunnel/rtmps.conf
   ```

### Connection Issues

1. Verify stunnel is listening on port 1935:
   ```bash
   netstat -tlnp | grep 1935
   ```

2. Test local connection:
   ```bash
   telnet 127.0.0.1 1935
   ```

3. Check stunnel logs:
   ```bash
   tail -f /var/log/stunnel.log
   ```

### Audio Still Not Working

1. Ensure all video files have proper audio tracks
2. Verify audio encoding parameters match across all videos
3. Check that the remote RTMP server supports the audio codec

## Configuration Details

The stunnel configuration file (`stunnel.conf`) contains:

```ini
[rtmps-proxy]
accept = 1935
connect = rtmp.icommu.cn:4433
client = yes
```

- `accept = 1935`: Local port to listen on
- `connect = rtmp.icommu.cn:4433`: Remote RTMPS server
- `client = yes`: Run in client mode to connect to remote server

## Benefits of This Approach

1. **Seamless Transitions**: Eliminates stuttering during video state changes
2. **Consistent Audio**: Resolves audio loss issues in repeated transitions
3. **Better Error Handling**: Improved connection recovery and stability
4. **Standard Practice**: Using stunnel for TLS proxying is a well-established pattern