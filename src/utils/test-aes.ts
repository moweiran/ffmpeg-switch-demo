import { NewCallAESUtil } from './NewCallAESUtil';

// Test the AES utility with the same example as in the Java code
const testData = '13631789022';
console.log('Original data:', testData);

const encrypted = NewCallAESUtil.encryptHex(testData);
console.log('Encrypted (hex):', encrypted);

const decrypted = NewCallAESUtil.decryptString(encrypted);
console.log('Decrypted:', decrypted);

console.log('Test passed:', testData === decrypted);

// Test with custom IV and key
console.log('\n--- Testing with custom IV and key ---');
const customIv = 'abcdefghijklmnop';
const customKey = 'qrstuvwxyz123456';
const encryptedCustom = NewCallAESUtil.encryptHex(testData, customIv, customKey);
console.log('Encrypted with custom IV/key (hex):', encryptedCustom);

const decryptedCustom = NewCallAESUtil.decryptString(encryptedCustom, customIv, customKey);
console.log('Decrypted with custom IV/key:', decryptedCustom);

console.log('Custom test passed:', testData === decryptedCustom);