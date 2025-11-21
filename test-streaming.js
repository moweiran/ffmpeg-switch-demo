const io = require('socket.io-client');
const http = require('http');

// Connect to the WebSocket server
const socket = io('http://localhost:3000');

console.log('Connecting to streaming server...');

socket.on('connect', () => {
  console.log('Connected to server');
  
  // Test sequence
  setTimeout(() => {
    console.log('Sending: userJoined (Welcome video)');
    socket.emit('userJoined');
  }, 1000);
  
  setTimeout(() => {
    console.log('Sending: userSpeaking (Speaking video)');
    socket.emit('userSpeaking');
  }, 5000);
  
  setTimeout(() => {
    console.log('Sending: userStoppedSpeaking (Idle video)');
    socket.emit('userStoppedSpeaking');
  }, 10000);
  
  setTimeout(() => {
    console.log('Sending: requestProcessing (Processing state)');
    socket.emit('requestProcessing');
  }, 15000);
  
  setTimeout(() => {
    console.log('Sending: aiResponse (AI response video)');
    socket.emit('aiResponse', { text: 'This is a test response from the AI system.' });
  }, 20000);
  
  setTimeout(() => {
    console.log('Testing HTTP endpoints...');
    testHttpEndpoints();
  }, 25000);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

// Test HTTP endpoints
function testHttpEndpoints() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  // Test start endpoint
  options.path = '/stream/start';
  const req1 = http.request(options, (res) => {
    console.log(`HTTP /stream/start: ${res.statusCode}`);
  });
  req1.on('error', (error) => {
    console.error('Error with /stream/start:', error.message);
  });
  req1.end();
  
  // Test idle endpoint after delay
  setTimeout(() => {
    options.path = '/stream/idle';
    const req2 = http.request(options, (res) => {
      console.log(`HTTP /stream/idle: ${res.statusCode}`);
    });
    req2.on('error', (error) => {
      console.error('Error with /stream/idle:', error.message);
    });
    req2.end();
  }, 2000);
  
  // Test speaking endpoint after delay
  setTimeout(() => {
    options.path = '/stream/speaking';
    const req3 = http.request(options, (res) => {
      console.log(`HTTP /stream/speaking: ${res.statusCode}`);
    });
    req3.on('error', (error) => {
      console.error('Error with /stream/speaking:', error.message);
    });
    req3.end();
  }, 4000);
  
  // Test stop endpoint after delay
  setTimeout(() => {
    options.path = '/stream/stop';
    const req4 = http.request(options, (res) => {
      console.log(`HTTP /stream/stop: ${res.statusCode}`);
      console.log('Test sequence completed');
      socket.disconnect();
      process.exit(0);
    });
    req4.on('error', (error) => {
      console.error('Error with /stream/stop:', error.message);
    });
    req4.end();
  }, 6000);
}

// Handle connection errors
socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});