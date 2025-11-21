const http = require('http');

/**
 * Test script to verify smooth transitions between video states
 * This script sends rapid transitions to test the improved streaming service
 */

const options = {
  hostname: 'localhost',
  port: 3000,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Testing rapid video transitions...');

// Start streaming
setTimeout(() => {
  console.log('1. Starting stream (Welcome video)');
  options.path = '/stream/start';
  const req = http.request(options, (res) => {
    console.log(`   Status: ${res.statusCode}`);
  });
  req.end();
}, 1000);

// Rapid transitions to test smoothness
setTimeout(() => {
  console.log('2. Switching to Speaking');
  options.path = '/stream/speaking';
  const req = http.request(options, (res) => {
    console.log(`   Status: ${res.statusCode}`);
  });
  req.end();
}, 3000);

setTimeout(() => {
  console.log('3. Switching to Idle');
  options.path = '/stream/idle';
  const req = http.request(options, (res) => {
    console.log(`   Status: ${res.statusCode}`);
  });
  req.end();
}, 3500);

setTimeout(() => {
  console.log('4. Switching to Speaking');
  options.path = '/stream/speaking';
  const req = http.request(options, (res) => {
    console.log(`   Status: ${res.statusCode}`);
  });
  req.end();
}, 4000);

setTimeout(() => {
  console.log('5. Switching to Processing');
  options.path = '/stream/processing';
  const req = http.request(options, (res) => {
    console.log(`   Status: ${res.statusCode}`);
  });
  req.end();
}, 4500);

setTimeout(() => {
  console.log('6. Playing AI Response');
  options.path = '/stream/response';
  const req = http.request(options, (res) => {
    console.log(`   Status: ${res.statusCode}`);
  });
  req.write(JSON.stringify({ text: 'This is a rapid transition test response.' }));
  req.end();
}, 5000);

setTimeout(() => {
  console.log('7. Switching to Idle');
  options.path = '/stream/idle';
  const req = http.request(options, (res) => {
    console.log(`   Status: ${res.statusCode}`);
  });
  req.end();
}, 5500);

setTimeout(() => {
  console.log('8. Stopping stream');
  options.path = '/stream/stop';
  const req = http.request(options, (res) => {
    console.log(`   Status: ${res.statusCode}`);
    console.log('Transition testing completed!');
  });
  req.end();
}, 8000);