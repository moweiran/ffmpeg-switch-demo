# NewCallAESUtil TypeScript Implementation

This is a TypeScript port of the Java [NewCallAESUtil.java](../../NewCallAESUtil.java) file, providing AES encryption and decryption functionality for Node.js applications.

## Features

- AES-128-CBC encryption with PKCS5 padding
- Hex string encoding for encrypted data
- Support for custom IV and key values
- Default IV and key for quick testing
- Full compatibility with the original Java implementation

## Usage

### Basic Encryption/Decryption

```typescript
import { NewCallAESUtil } from './utils/NewCallAESUtil';

// Encrypt data with default IV and key
const encrypted = NewCallAESUtil.encryptHex('sensitive data');

// Decrypt data with default IV and key
const decrypted = NewCallAESUtil.decryptString(encrypted);
```

### Custom IV and Key

```typescript
import { NewCallAESUtil } from './utils/NewCallAESUtil';

const data = 'sensitive data';
const iv = 'custom16bytesiv!!';
const key = 'custom16byteskey!';

// Encrypt with custom IV and key
const encrypted = NewCallAESUtil.encryptHex(data, iv, key);

// Decrypt with custom IV and key
const decrypted = NewCallAESUtil.decryptString(encrypted, iv, key);
```

## API

### `encryptHex(data: string, iv?: string, key?: string): string`

Encrypts the provided data and returns it as a hex-encoded string.

- `data`: The string to encrypt
- `iv`: Optional initialization vector (16 bytes). Uses default if not provided.
- `key`: Optional secret key (16 bytes). Uses default if not provided.

### `decryptString(data: string, iv?: string, key?: string): string`

Decrypts the provided hex-encoded string and returns the original data.

- `data`: The hex-encoded string to decrypt
- `iv`: Optional initialization vector (16 bytes). Uses default if not provided.
- `key`: Optional secret key (16 bytes). Uses default if not provided.

## Default Values

The utility uses the following default values for testing purposes:

- **IV**: `'0123456789abcdef'` (16 bytes)
- **Key**: `'0123456789abcdef'` (16 bytes)

For production use, always provide your own secure IV and key values.

## Testing

Run the comprehensive test suite:

```bash
npx ts-node src/utils/comprehensive-test.ts
```

## Compatibility

This TypeScript implementation is designed to be compatible with the original Java implementation, producing the same encrypted output when using the same IV and key values.