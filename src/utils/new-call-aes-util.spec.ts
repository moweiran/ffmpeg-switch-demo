import { NewCallAESUtil } from './NewCallAESUtil';

describe('NewCallAESUtil', () => {
  describe('encryptHex and decryptString', () => {
    it('should encrypt and decrypt data correctly with default IV and key', () => {
      const testData = '13631497270';
      
      const encrypted = NewCallAESUtil.encryptHex(testData);
      const decrypted = NewCallAESUtil.decryptString(encrypted);
      
      expect(decrypted).toBe(testData);
    });

    it('should encrypt and decrypt data correctly with custom IV and key', () => {
      const testData = 'test data for encryption';
      const customIv = 'customiv12345678';
      const customKey = 'customkey1234567';
      
      const encrypted = NewCallAESUtil.encryptHex(testData, customIv, customKey);
      const decrypted = NewCallAESUtil.decryptString(encrypted, customIv, customKey);
      
      expect(decrypted).toBe(testData);
    });

    it('should produce different encrypted results for different data', () => {
      const testData1 = 'data1';
      const testData2 = 'data2';
      
      const encrypted1 = NewCallAESUtil.encryptHex(testData1);
      const encrypted2 = NewCallAESUtil.encryptHex(testData2);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should produce different encrypted results for different keys', () => {
      const testData = 'same data';
      const key1 = 'key1key1key1key1';
      const key2 = 'key2key2key2key2';
      const iv = 'sameivsameivsame';
      
      const encrypted1 = NewCallAESUtil.encryptHex(testData, iv, key1);
      const encrypted2 = NewCallAESUtil.encryptHex(testData, iv, key2);
      
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const testData = '';
      
      const encrypted = NewCallAESUtil.encryptHex(testData);
      const decrypted = NewCallAESUtil.decryptString(encrypted);
      
      expect(decrypted).toBe(testData);
    });

    it('should handle special characters', () => {
      const testData = 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?';
      
      const encrypted = NewCallAESUtil.encryptHex(testData);
      const decrypted = NewCallAESUtil.decryptString(encrypted);
      
      expect(decrypted).toBe(testData);
    });

    it('should handle unicode characters', () => {
      const testData = 'Unicode: 你好世界 🌍';
      
      const encrypted = NewCallAESUtil.encryptHex(testData);
      const decrypted = NewCallAESUtil.decryptString(encrypted);
      
      expect(decrypted).toBe(testData);
    });
  });
});