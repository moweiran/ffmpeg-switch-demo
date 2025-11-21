const http = require('http');

/**
 * Debug script to test transitions and log detailed information
 * This script tests the specific sequence that causes issues: start -> idle -> start
 */

const options = {
  hostname: 'localhost',
  port: 3000,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Debugging video transitions...');

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
      req.write(JSON.stringify({ text: 'Debug response text' }));
    }
    
    req.end();
  });
}

async function runTestSequence() {
  try {
    // Initial start
    await makeRequest('/stream/start', 'Starting stream (Welcome video) - Check for audio and smooth playback');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Switch to idle
    await makeRequest('/stream/idle', 'Switching to Idle - Check for audio and smooth playback');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Switch back to start - This is where issues occurred
    await makeRequest('/stream/start', 'Switching back to Start (Welcome video) - THIS IS THE CRITICAL TEST');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Additional transitions to ensure stability
    await makeRequest('/stream/speaking', 'Switching to Speaking - Check for audio and smooth playback');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await makeRequest('/stream/idle', 'Switching to Idle again - Check for audio and smooth playback');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Final stop
    await makeRequest('/stream/stop', 'Stopping stream - Should terminate cleanly');
    
    console.log('\n=== DEBUG TEST COMPLETE ===');
    console.log('Please verify:');
    console.log('1. All transitions were smooth without stuttering');
    console.log('2. Audio was present in all video states');
    console.log('3. No errors were logged in the application console');
    
  } catch (error) {
    console.error('Test failed with error:', error.message);
  }
}

// Run the test
runTestSequence();