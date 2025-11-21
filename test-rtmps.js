const { spawn } = require('child_process');
const path = require('path');

// Test RTMPS streaming with the exact command that worked for you
const ffmpeg = spawn('ffmpeg', [
  '-re',
  '-stream_loop', '-1',
  '-i', './videos/welcome.mp4',
  '-acodec', 'aac',
  '-vcodec', 'libx264',
  '-profile:v', 'baseline',
  '-level', '3.1',
  '-g', '60',
  '-r', '30',
  '-s', '720x1280',
  '-pix_fmt', 'yuv420p',
  '-b:v', '1200k',
  '-maxrate', '1200k',
  '-bufsize', '1800k',
  '-ar', '16000',
  '-ac', '1',
  '-b:a', '64k',
  '-preset', 'medium',
  '-flags', '+low_delay',
  '-f', 'flv',
  '-flvflags', 'no_duration_filesize',
  '-fflags', '+genpts',
  '-avoid_negative_ts', 'make_zero',
  '-reconnect', '1',
  '-reconnect_at_eof', '1',
  '-reconnect_streamed', '1',
  '-reconnect_delay_max', '2',
  'rtmps://rtmp.icommu.cn:4433/live/livestream'
]);

console.log('Testing RTMPS streaming...');
console.log('Command:', 'ffmpeg ' + [
  '-re',
  '-stream_loop', '-1',
  '-i', './videos/welcome.mp4',
  '-acodec', 'aac',
  '-vcodec', 'libx264',
  '-profile:v', 'baseline',
  '-level', '3.1',
  '-g', '60',
  '-r', '30',
  '-s', '720x1280',
  '-pix_fmt', 'yuv420p',
  '-b:v', '1200k',
  '-maxrate', '1200k',
  '-bufsize', '1800k',
  '-ar', '16000',
  '-ac', '1',
  '-b:a', '64k',
  '-preset', 'medium',
  '-flags', '+low_delay',
  '-f', 'flv',
  '-flvflags', 'no_duration_filesize',
  '-fflags', '+genpts',
  '-avoid_negative_ts', 'make_zero',
  '-reconnect', '1',
  '-reconnect_at_eof', '1',
  '-reconnect_streamed', '1',
  '-reconnect_delay_max', '2',
  'rtmps://rtmp.icommu.cn:4433/live/livestream'
].join(' '));

ffmpeg.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

ffmpeg.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

ffmpeg.on('close', (code) => {
  console.log(`FFmpeg process exited with code ${code}`);
});

ffmpeg.on('error', (error) => {
  console.error(`FFmpeg error: ${error.message}`);
});