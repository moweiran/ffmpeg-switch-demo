const http = require('http');

/**
 * Test script for stunnel-based RTMP streaming
 * This script tests the sequence that was failing: start -> idle -> start
 */

const options = {
  hostname: 'localhost',
  port: 3000,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Testing stunnel-based RTMP streaming...');
console.log('Make sure stunnel is running: sudo stunnel /etc/stunnel/rtmps.conf');
console.log('');

let requestCount = 0;

function makeRequest(path, description) {
  requestCount++;
  console.log(`${requestCount}. ${description}`);
  
  return new Promise((resolve, reject) => {
    options.path = path;
    const req = http.request(options, (res) => {
      console.log(`   Status: ${res.statusCode}`);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`   Response: ${JSON.stringify(response)}`);
          resolve(response);
        } catch (e) {
          console.log(`   Response: ${data}`);
          resolve(data);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`   Error: ${error.message}`);
      reject(error);
    });
    
    // Add body for response endpoint
    if (path === '/stream/response') {
      req.write(JSON.stringify({ text: 'Test response via stunnel' }));
    }
    
    req.end();
  });
}

async function runStunnelTest() {
  try {
    console.log('=== STUNNEL RTMP STREAMING TEST ===');
    console.log('');
    
    // Initial start
    await makeRequest('/stream/start', 'START 1: Starting stream (Welcome video) - Should have audio and smooth playback');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Switch to idle
    await makeRequest('/stream/idle', 'IDLE: Switching to Idle - Should have audio and smooth playback');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Critical test - switch back to start
    await makeRequest('/stream/start', 'START 2: Switching back to Start (Welcome video) - THIS IS THE CRITICAL TEST');
    console.log('   >>> PLEASE CHECK FOR AUDIO AND SMOOTH PLAYBACK <<<');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Additional transitions to verify stability
    await makeRequest('/stream/speaking', 'SPEAKING: Switching to Speaking - Should have audio and smooth playback');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    await makeRequest('/stream/idle', 'IDLE 2: Switching to Idle again - Should have audio and smooth playback');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Final stop
    await makeRequest('/stream/stop', 'STOP: Stopping stream - Should terminate cleanly');
    
    console.log('');
    console.log('=== STUNNEL TEST COMPLETE ===');
    console.log('');
    console.log('Expected Results:');
    console.log('✓ All transitions should be smooth without stuttering');
    console.log('✓ Audio should be present in all video states');
    console.log('✓ No errors should be logged in the application console');
    console.log('✓ The critical START 2 transition should work properly');
    
  } catch (error) {
    console.error('Test failed with error:', error.message);
  }
}

// Run the test
runStunnelTest();