import CryptoJS from 'crypto-js';

export interface EncryptionResult {
  encrypted: string;
  iv: string;
}

export class EncryptionService {
  private readonly encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY || '';
    if (!this.encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
  }

  /**
   * Encrypt sensitive data using AES-256-CBC
   * @param plaintext - The data to encrypt
   * @returns Encrypted data with IV
   */
  encrypt(plaintext: string): EncryptionResult {
    try {
      const iv = CryptoJS.lib.WordArray.random(16);
      const encrypted = CryptoJS.AES.encrypt(plaintext, this.encryptionKey, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      return {
        encrypted: encrypted.toString(),
        iv: iv.toString()
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt sensitive data using AES-256-CBC
   * @param encryptedData - The encrypted data
   * @param iv - The initialization vector used for encryption
   * @returns Decrypted plaintext
   */
  decrypt(encryptedData: string, iv: string): string {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey, {
        iv: CryptoJS.enc.Hex.parse(iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
      if (!plaintext) {
        throw new Error('Decryption resulted in empty string - invalid key or corrupted data');
      }

      return plaintext;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt SSH private key for database storage
   * @param privateKey - SSH private key content
   * @returns Combined encrypted string (iv:encrypted)
   */
  encryptSshKey(privateKey: string): string {
    const result = this.encrypt(privateKey);
    return `${result.iv}:${result.encrypted}`;
  }

  /**
   * Decrypt SSH private key from database storage
   * @param encryptedKey - Combined encrypted string (iv:encrypted)
   * @returns Decrypted SSH private key
   */
  decryptSshKey(encryptedKey: string): string {
    const parts = encryptedKey.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted SSH key format');
    }

    const [iv, encrypted] = parts;
    return this.decrypt(encrypted, iv);
  }

  /**
   * Encrypt SSH key passphrase for database storage
   * @param passphrase - SSH key passphrase
   * @returns Combined encrypted string (iv:encrypted)
   */
  encryptPassphrase(passphrase: string): string {
    const result = this.encrypt(passphrase);
    return `${result.iv}:${result.encrypted}`;
  }

  /**
   * Decrypt SSH key passphrase from database storage
   * @param encryptedPassphrase - Combined encrypted string (iv:encrypted)
   * @returns Decrypted passphrase
   */
  decryptPassphrase(encryptedPassphrase: string): string {
    const parts = encryptedPassphrase.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted passphrase format');
    }

    const [iv, encrypted] = parts;
    return this.decrypt(encrypted, iv);
  }

  /**
   * Generate a secure random password for SSH connections
   * @param length - Password length (default: 32)
   * @returns Random password string
   */
  generateSecurePassword(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }

  /**
   * Validate that a string can be safely encrypted/decrypted
   * @param data - Data to validate
   * @returns true if data is valid for encryption
   */
  validateEncryptionData(data: string): boolean {
    return data.length > 0 && data.length <= 65536; // Max 64KB for SSH keys
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();