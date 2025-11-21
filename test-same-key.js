const http = require('http');

/**
 * Test script for same stream key approach
 * This script tests the sequence with the same stream key for all transitions
 */

const options = {
  hostname: 'localhost',
  port: 3000,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Testing same stream key approach...');
console.log('All transitions will use the same stream key: livestream');
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
      req.write(JSON.stringify({ text: 'Test response with same key' }));
    }
    
    req.end();
  });
}

async function runSameKeyTest() {
  try {
    console.log('=== SAME STREAM KEY TEST ===');
    console.log('');
    
    // Initial start
    await makeRequest('/stream/start', 'START 1: Starting stream (Welcome video) - Should have audio and smooth playback');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Switch to idle
    await makeRequest('/stream/idle', 'IDLE: Switching to Idle - Should have audio and smooth playback');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Critical test - switch back to start with same key
    await makeRequest('/stream/start', 'START 2: Switching back to Start (Welcome video) with SAME STREAM KEY');
    console.log('   >>> PLEASE CHECK FOR AUDIO AND SMOOTH PLAYBACK <<<');
    console.log('   >>> THIS SHOULD WORK WITH THE SAME STREAM KEY <<<');
    await new Promise(resolve => setTimeout(resolve, 15000)); // Longer wait for this critical test
    
    // Additional transitions to verify stability
    await makeRequest('/stream/speaking', 'SPEAKING: Switching to Speaking - Should have audio and smooth playback');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    await makeRequest('/stream/idle', 'IDLE 2: Switching to Idle again - Should have audio and smooth playback');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Final stop
    await makeRequest('/stream/stop', 'STOP: Stopping stream - Should terminate cleanly');
    
    console.log('');
    console.log('=== SAME STREAM KEY TEST COMPLETE ===');
    console.log('');
    console.log('Expected Results:');
    console.log('✓ All transitions should be smooth without stuttering');
    console.log('✓ Audio should be present in all video states');
    console.log('✓ No errors should be logged in the application console');
    console.log('✓ Each transition should use the SAME stream key (livestream)');
    console.log('✓ The critical START 2 transition should work properly with enhanced cleanup');
    
  } catch (error) {
    console.error('Test failed with error:', error.message);
  }
}

// Run the test
runSameKeyTest();