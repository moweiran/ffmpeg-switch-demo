const http = require('http');

/**
 * Test script to verify audio is working correctly after transitions
 * This script tests the specific sequence: start -> idle -> start
 */

const options = {
  hostname: 'localhost',
  port: 3000,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Testing audio after video transitions...');

// Start streaming (1st start)
setTimeout(() => {
  console.log('1. Starting stream (Welcome video) - Check for audio');
  options.path = '/stream/start';
  const req = http.request(options, (res) => {
    console.log(`   Status: ${res.statusCode}`);
  });
  req.end();
}, 1000);

// Switch to idle
setTimeout(() => {
  console.log('2. Switching to Idle - Check for audio');
  options.path = '/stream/idle';
  const req = http.request(options, (res) => {
    console.log(`   Status: ${res.statusCode}`);
  });
  req.end();
}, 8000);

// Switch back to start (2nd start) - This is where audio was lost before
setTimeout(() => {
  console.log('3. Switching back to Start (Welcome video) - Check for audio');
  options.path = '/stream/start';
  const req = http.request(options, (res) => {
    console.log(`   Status: ${res.statusCode}`);
  });
  req.end();
}, 15000);

// Stop streaming
setTimeout(() => {
  console.log('4. Stopping stream');
  options.path = '/stream/stop';
  const req = http.request(options, (res) => {
    console.log(`   Status: ${res.statusCode}`);
    console.log('Audio testing completed! Please verify that audio was present in all stages.');
  });
  req.end();
}, 25000);