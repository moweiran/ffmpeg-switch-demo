const { StreamSwitcher } = require('./dist/stream/stable-instant-video-switcher');

console.log('Testing FIFO-based video switching...');

const switcher = new StreamSwitcher();

// Test sequence: welcome -> idle -> welcome (this is where audio was lost before)
console.log('1. Starting with welcome video (check for audio)');
switcher.requestSwitch('welcome.mp4');

// Switch to idle after 15 seconds
setTimeout(() => {
    console.log('2. Switching to idle video (check for audio)');
    switcher.requestSwitch('idle.mp4');
}, 15000);

// Switch back to welcome after 30 seconds - this is the critical test
setTimeout(() => {
    console.log('3. Switching back to welcome video (CRITICAL: check for audio)');
    switcher.requestSwitch('welcome.mp4');
}, 30000);

// Add another switch to speaking video
setTimeout(() => {
    console.log('4. Switching to speaking video (check for audio)');
    switcher.requestSwitch('speaking.mp4');
}, 45000);

// Stop after 60 seconds
setTimeout(() => {
    console.log('5. Stopping stream');
    switcher.stop();
    console.log('Test completed! Check if audio was present in all stages.');
}, 60000);