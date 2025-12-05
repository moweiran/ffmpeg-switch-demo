import * as crypto from 'crypto';

/**
 * AES encryption utility class
 * @author zheng
 * @date 2024/11/26
 */
export class NewCallAESUtil {
  private static readonly CBC_MODE = 'CBC';
  private static readonly PKCS5_PADDING = 'PKCS5Padding';
  private static readonly DEFAULT_IV = ''; // 16 bytes default IV
  private static readonly DEFAULT_SECRET_KEY = ''; // 16 bytes default key

  /**
   * Encrypts data and returns it as a hex string
   * @param data The data to encrypt
   * @param iv Initialization vector (optional, uses default if not provided)
   * @param key Secret key (optional, uses default if not provided)
   * @returns The encrypted data as a hex string
   */
  public static encryptHex(data: string, iv?: string, key?: string): string {
    const actualIv = iv || this.DEFAULT_IV;
    const actualKey = key || this.DEFAULT_SECRET_KEY;
    return this.encryptHexWithKey(actualIv, actualKey, data);
  }

  /**
   * Decrypts a hex string back to original data
   * @param data The hex string to decrypt
   * @param iv Initialization vector (optional, uses default if not provided)
   * @param key Secret key (optional, uses default if not provided)
   * @returns The decrypted original data
   */
  public static decryptString(data: string, iv?: string, key?: string): string {
    const actualIv = iv || this.DEFAULT_IV;
    const actualKey = key || this.DEFAULT_SECRET_KEY;
    return this.decryptStringWithKey(actualIv, actualKey, data);
  }

  /**
   * Encrypts data with provided IV and key, returning hex string
   * @param iv Initialization vector
   * @param key Secret key
   * @param data Data to encrypt
   * @returns The encrypted data as a hex string
   */
  public static encryptHexWithKey(iv: string, key: string, data: string): string {
    return this.encryptHexMode(this.CBC_MODE, this.PKCS5_PADDING, iv, key, data);
  }

  /**
   * Decrypts hex string with provided IV and key
   * @param iv Initialization vector
   * @param key Secret key
   * @param data Hex string to decrypt
   * @returns The decrypted original data
   */
  public static decryptStringWithKey(iv: string, key: string, data: string): string {
    return this.decryptStringMode(this.CBC_MODE, this.PKCS5_PADDING, iv, key, data);
  }

  /**
   * Encrypts data with full parameters and returns hex string
   * @param mode Encryption mode (e.g., CBC)
   * @param padding Padding scheme (e.g., PKCS5Padding)
   * @param iv Initialization vector
   * @param key Secret key
   * @param data Data to encrypt
   * @returns The encrypted data as a hex string
   */
  public static encryptHexMode(mode: string, padding: string, iv: string, key: string, data: string): string {
    const encrypted = this.encrypt(mode, padding, iv, key, data);
    return encrypted.toString('hex');
  }

  /**
   * Decrypts hex string with full parameters
   * @param mode Encryption mode (e.g., CBC)
   * @param padding Padding scheme (e.g., PKCS5Padding)
   * @param iv Initialization vector
   * @param key Secret key
   * @param data Hex string to decrypt
   * @returns The decrypted original data
   */
  public static decryptStringMode(mode: string, padding: string, iv: string, key: string, data: string): string {
    const decrypted = this.decrypt(mode, padding, iv, key, data);
    return decrypted.toString();
  }

  /**
   * Core encryption method
   * @param mode Encryption mode
   * @param padding Padding scheme
   * @param iv Initialization vector
   * @param key Secret key
   * @param data Data to encrypt
   * @returns Encrypted data as Buffer
   */
  public static encrypt(mode: string, padding: string, iv: string, key: string, data: string): Buffer {
    try {
      // Ensure IV is exactly 16 bytes for AES
      const ivBuffer = this.getFixedLengthBuffer(iv, 16);
      // Ensure key is exactly 16 bytes for AES-128
      const keyBuffer = this.getFixedLengthBuffer(key, 16);
      
      // Create cipher with AES/CBC/PKCS5Padding equivalent
      const algorithm = 'aes-128-cbc'; // AES with 128-bit key in CBC mode
      const cipher = crypto.createCipheriv(algorithm, keyBuffer, ivBuffer);
      
      // In Node.js, PKCS5Padding is handled automatically by default
      let encrypted = cipher.update(data, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      return encrypted;
    } catch (error) {
      console.error('AES encrypt fail!', error);
      return Buffer.alloc(0);
    }
  }

  /**
   * Core decryption method
   * @param mode Decryption mode
   * @param padding Padding scheme
   * @param iv Initialization vector
   * @param key Secret key
   * @param data Data to decrypt (as hex string)
   * @returns Decrypted data as Buffer
   */
  public static decrypt(mode: string, padding: string, iv: string, key: string, data: string): Buffer {
    try {
      // Ensure IV is exactly 16 bytes for AES
      const ivBuffer = this.getFixedLengthBuffer(iv, 16);
      // Ensure key is exactly 16 bytes for AES-128
      const keyBuffer = this.getFixedLengthBuffer(key, 16);
      
      // Create decipher with AES/CBC/PKCS5Padding equivalent
      const algorithm = 'aes-128-cbc'; // AES with 128-bit key in CBC mode
      const decipher = crypto.createDecipheriv(algorithm, keyBuffer, ivBuffer);
      
      // Convert hex string to buffer
      const dataBuffer = Buffer.from(data, 'hex');
      
      let decrypted = decipher.update(dataBuffer);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted;
    } catch (error) {
      console.error('AES decrypt fail!', error);
      return Buffer.alloc(0);
    }
  }

  /**
   * Ensures a string is converted to a Buffer of exactly the specified length
   * @param str Input string
   * @param length Required length
   * @returns Buffer of exactly the specified length
   */
  private static getFixedLengthBuffer(str: string, length: number): Buffer {
    const buffer = Buffer.from(str, 'utf8');
    if (buffer.length === length) {
      return buffer;
    }
    
    // If buffer is too short, pad it with zeros
    if (buffer.length < length) {
      const paddedBuffer = Buffer.alloc(length, 0);
      buffer.copy(paddedBuffer);
      return paddedBuffer;
    }
    
    // If buffer is too long, truncate it
    return buffer.subarray(0, length);
  }
}

// Example usage (similar to the Java main method)
// const hex = NewCallAESUtil.encryptHex('13631789022');
// console.log('加密后：' + hex);
// const decryptString = NewCallAESUtil.decryptString(hex);
// console.log('解密后：' + decryptString);