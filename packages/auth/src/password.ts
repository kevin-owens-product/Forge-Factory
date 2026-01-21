/**
 * @package @forge/auth
 * @description Password hashing and validation utilities
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import {
  PasswordConfig,
  PasswordValidationResult,
  PasswordHashResult,
  DEFAULT_AUTH_CONFIG,
} from './auth.types';

/**
 * Special characters for password validation
 */
const SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~\\';

/**
 * Common weak passwords to reject
 */
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '123456',
  '12345678',
  '123456789',
  'qwerty',
  'abc123',
  'letmein',
  'welcome',
  'admin',
  'login',
  'master',
  'hello',
  'dragon',
  'monkey',
  'shadow',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'iloveyou',
  'trustno1',
  'superman',
  'batman',
]);

/**
 * Bcrypt interface for dependency injection
 */
export interface BcryptInterface {
  hash(data: string, saltOrRounds: string | number): Promise<string>;
  compare(data: string, encrypted: string): Promise<boolean>;
  genSalt(rounds?: number): Promise<string>;
}

/**
 * Password service class
 */
export class PasswordService {
  private config: PasswordConfig;
  private bcrypt: BcryptInterface | null = null;

  constructor(config: Partial<PasswordConfig> = {}) {
    this.config = { ...DEFAULT_AUTH_CONFIG.password, ...config };
  }

  /**
   * Initialize bcrypt
   */
  async initialize(): Promise<void> {
    if (!this.bcrypt) {
      try {
        const bcryptModule = await import('bcrypt');
        this.bcrypt = bcryptModule;
      } catch {
        throw new ForgeError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'bcrypt module not available. Please install bcrypt package.',
          statusCode: 500,
        });
      }
    }
  }

  /**
   * Set bcrypt implementation (for testing)
   */
  setBcrypt(bcrypt: BcryptInterface): void {
    this.bcrypt = bcrypt;
  }

  /**
   * Get bcrypt instance
   */
  private getBcrypt(): BcryptInterface {
    if (!this.bcrypt) {
      throw new ForgeError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Password service not initialized. Call initialize() first.',
        statusCode: 500,
      });
    }
    return this.bcrypt;
  }

  /**
   * Validate password against policy
   */
  validate(password: string): PasswordValidationResult {
    const errors: string[] = [];

    // Length checks
    if (password.length < this.config.minLength) {
      errors.push(`Password must be at least ${this.config.minLength} characters`);
    }
    if (password.length > this.config.maxLength) {
      errors.push(`Password must be no more than ${this.config.maxLength} characters`);
    }

    // Character requirements
    if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (this.config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (this.config.requireNumber && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (this.config.requireSpecialChar && !this.containsSpecialChar(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common passwords
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      errors.push('Password is too common. Please choose a stronger password');
    }

    // Calculate strength
    const strength = this.calculateStrength(password);
    const strengthLabel = this.getStrengthLabel(strength);

    return {
      valid: errors.length === 0,
      errors,
      strength,
      strengthLabel,
    };
  }

  /**
   * Check if password contains special character
   */
  private containsSpecialChar(password: string): boolean {
    return [...password].some((char) => SPECIAL_CHARS.includes(char));
  }

  /**
   * Calculate password strength (0-100)
   */
  calculateStrength(password: string): number {
    let score = 0;

    // Length score (up to 25 points)
    score += Math.min(25, password.length * 2);

    // Character variety (up to 25 points)
    if (/[a-z]/.test(password)) score += 5;
    if (/[A-Z]/.test(password)) score += 5;
    if (/[0-9]/.test(password)) score += 5;
    if (this.containsSpecialChar(password)) score += 10;

    // Mixed case bonus (10 points)
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
      score += 10;
    }

    // Numbers and letters mixed (10 points)
    if (/[a-zA-Z]/.test(password) && /[0-9]/.test(password)) {
      score += 10;
    }

    // Special chars mixed with alphanumeric (15 points)
    if (/[a-zA-Z0-9]/.test(password) && this.containsSpecialChar(password)) {
      score += 15;
    }

    // Unique characters bonus (up to 10 points)
    const uniqueChars = new Set(password.split('')).size;
    score += Math.min(10, Math.floor((uniqueChars / password.length) * 10));

    // Penalties
    // Sequential characters
    if (/(.)\1{2,}/.test(password)) {
      score -= 10;
    }

    // Common patterns
    if (/^[a-z]+$/i.test(password) || /^[0-9]+$/.test(password)) {
      score -= 15;
    }

    // Common password
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      score -= 30;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get strength label from score
   */
  getStrengthLabel(score: number): 'weak' | 'fair' | 'good' | 'strong' | 'very-strong' {
    if (score < 20) return 'weak';
    if (score < 40) return 'fair';
    if (score < 60) return 'good';
    if (score < 80) return 'strong';
    return 'very-strong';
  }

  /**
   * Hash a password
   */
  async hash(password: string): Promise<PasswordHashResult> {
    const bcrypt = this.getBcrypt();
    const salt = await bcrypt.genSalt(this.config.hashRounds);
    const hash = await bcrypt.hash(password, salt);
    return { hash, salt };
  }

  /**
   * Verify a password against a hash
   */
  async verify(password: string, hash: string): Promise<boolean> {
    const bcrypt = this.getBcrypt();
    return bcrypt.compare(password, hash);
  }

  /**
   * Check if password is in history
   */
  async isInHistory(password: string, history: string[]): Promise<boolean> {
    if (this.config.historyCount === 0 || history.length === 0) {
      return false;
    }

    const recentHistory = history.slice(-this.config.historyCount);
    for (const hash of recentHistory) {
      if (await this.verify(password, hash)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate a secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=';

    const allChars = lowercase + uppercase + numbers + special;
    const password: string[] = [];

    // Ensure at least one of each required type
    password.push(lowercase[Math.floor(Math.random() * lowercase.length)]);
    password.push(uppercase[Math.floor(Math.random() * uppercase.length)]);
    password.push(numbers[Math.floor(Math.random() * numbers.length)]);
    password.push(special[Math.floor(Math.random() * special.length)]);

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password.push(allChars[Math.floor(Math.random() * allChars.length)]);
    }

    // Shuffle the password
    for (let i = password.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [password[i], password[j]] = [password[j], password[i]];
    }

    return password.join('');
  }

  /**
   * Generate a password reset token
   */
  generateResetToken(): string {
    const bytes = new Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hash a reset token for storage
   */
  async hashResetToken(token: string): Promise<string> {
    // Use a simple hash for tokens (bcrypt is overkill)
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify a reset token
   */
  async verifyResetToken(token: string, hash: string): Promise<boolean> {
    const tokenHash = await this.hashResetToken(token);
    return tokenHash === hash;
  }

  /**
   * Get configuration
   */
  getConfig(): PasswordConfig {
    return { ...this.config };
  }
}

// Singleton instance
let passwordServiceInstance: PasswordService | null = null;

/**
 * Get the singleton password service instance
 */
export function getPasswordService(config?: Partial<PasswordConfig>): PasswordService {
  if (!passwordServiceInstance) {
    passwordServiceInstance = new PasswordService(config);
  }
  return passwordServiceInstance;
}

/**
 * Reset the singleton password service instance (for testing)
 */
export function resetPasswordService(): void {
  passwordServiceInstance = null;
}
