import { NewCallAESUtil } from './NewCallAESUtil';

function runTest(name: string, testFn: () => boolean) {
  try {
    const result = testFn();
    console.log(`${result ? '✅ PASS' : '❌ FAIL'}: ${name}`);
    return result;
  } catch (error) {
    console.log(`❌ ERROR: ${name} - ${error.message}`);
    return false;
  }
}

console.log('Running comprehensive tests for NewCallAESUtil...\n');

let passedTests = 0;
let totalTests = 0;

// Test 1: Basic encryption and decryption with default values
totalTests++;
if (runTest('Basic encryption and decryption with default values', () => {
  const testData = '13631789022';
  const encrypted = NewCallAESUtil.encryptHex(testData);
  const decrypted = NewCallAESUtil.decryptString(encrypted);
  return decrypted === testData;
})) passedTests++;

// Test 2: Encryption and decryption with custom IV and key
totalTests++;
if (runTest('Encryption and decryption with custom IV and key', () => {
  const testData = 'test data for encryption';
  const customIv = 'customiv12345678';
  const customKey = 'customkey1234567';
  
  const encrypted = NewCallAESUtil.encryptHex(testData, customIv, customKey);
  const decrypted = NewCallAESUtil.decryptString(encrypted, customIv, customKey);
  
  return decrypted === testData;
})) passedTests++;

// Test 3: Different data produces different encrypted results
totalTests++;
if (runTest('Different data produces different encrypted results', () => {
  const testData1 = 'data1';
  const testData2 = 'data2';
  
  const encrypted1 = NewCallAESUtil.encryptHex(testData1);
  const encrypted2 = NewCallAESUtil.encryptHex(testData2);
  
  return encrypted1 !== encrypted2;
})) passedTests++;

// Test 4: Different keys produce different encrypted results
totalTests++;
if (runTest('Different keys produce different encrypted results', () => {
  const testData = 'same data';
  const key1 = 'key1key1key1key1';
  const key2 = 'key2key2key2key2';
  const iv = 'sameivsameivsame';
  
  const encrypted1 = NewCallAESUtil.encryptHex(testData, iv, key1);
  const encrypted2 = NewCallAESUtil.encryptHex(testData, iv, key2);
  
  return encrypted1 !== encrypted2;
})) passedTests++;

// Test 5: Empty string handling
totalTests++;
if (runTest('Empty string handling', () => {
  const testData = '';
  
  const encrypted = NewCallAESUtil.encryptHex(testData);
  const decrypted = NewCallAESUtil.decryptString(encrypted);
  
  return decrypted === testData;
})) passedTests++;

// Test 6: Special characters handling
totalTests++;
if (runTest('Special characters handling', () => {
  const testData = 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const encrypted = NewCallAESUtil.encryptHex(testData);
  const decrypted = NewCallAESUtil.decryptString(encrypted);
  
  return decrypted === testData;
})) passedTests++;

// Test 7: Unicode characters handling
totalTests++;
if (runTest('Unicode characters handling', () => {
  const testData = 'Unicode: 你好世界 🌍';
  
  const encrypted = NewCallAESUtil.encryptHex(testData);
  const decrypted = NewCallAESUtil.decryptString(encrypted);
  
  return decrypted === testData;
})) passedTests++;

// Test 8: Long string handling
totalTests++;
if (runTest('Long string handling', () => {
  const testData = 'This is a longer string to test encryption and decryption with more data to ensure it works correctly.';
  
  const encrypted = NewCallAESUtil.encryptHex(testData);
  const decrypted = NewCallAESUtil.decryptString(encrypted);
  
  return decrypted === testData;
})) passedTests++;

console.log(`\n${passedTests}/${totalTests} tests passed`);

if (passedTests === totalTests) {
  console.log('🎉 All tests passed!');
} else {
  console.log('❌ Some tests failed');
  process.exit(1);
}