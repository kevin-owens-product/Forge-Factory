/**
 * @package @forge/auth
 * @description Multi-factor authentication (TOTP) utilities
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import {
  MfaConfig,
  MfaSetupResult,
  MfaVerificationResult,
  DEFAULT_AUTH_CONFIG,
} from './auth.types';

/**
 * OTP Authenticator interface for dependency injection
 */
export interface OtpAuthenticator {
  generate(secret: string): string;
  check(token: string, secret: string): boolean;
  verify(options: { token: string; secret: string }): boolean;
  generateSecret(length?: number): string;
  keyuri(user: string, service: string, secret: string): string;
  options: {
    digits?: number;
    step?: number;
    window?: number;
  };
}

/**
 * QR Code generator interface
 */
export interface QrCodeGenerator {
  toDataURL(text: string): Promise<string>;
}

/**
 * MFA service class
 */
export class MfaService {
  private config: MfaConfig;
  private authenticator: OtpAuthenticator | null = null;
  private qrGenerator: QrCodeGenerator | null = null;

  constructor(config: Partial<MfaConfig> = {}) {
    this.config = { ...DEFAULT_AUTH_CONFIG.mfa, ...config };
  }

  /**
   * Initialize TOTP library
   */
  async initialize(): Promise<void> {
    if (!this.authenticator) {
      try {
        const otplib = await import('otplib');
        this.authenticator = otplib.authenticator;
        // Configure authenticator options
        this.authenticator.options = {
          digits: this.config.digits,
          step: this.config.stepSeconds,
          window: this.config.window,
        };
      } catch {
        throw new ForgeError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'otplib module not available. Please install otplib package.',
          statusCode: 500,
        });
      }
    }
  }

  /**
   * Set authenticator implementation (for testing)
   */
  setAuthenticator(authenticator: OtpAuthenticator): void {
    this.authenticator = authenticator;
  }

  /**
   * Set QR code generator (for testing)
   */
  setQrGenerator(generator: QrCodeGenerator): void {
    this.qrGenerator = generator;
  }

  /**
   * Get authenticator instance
   */
  private getAuthenticator(): OtpAuthenticator {
    if (!this.authenticator) {
      throw new ForgeError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'MFA service not initialized. Call initialize() first.',
        statusCode: 500,
      });
    }
    return this.authenticator;
  }

  /**
   * Generate MFA setup data for a user
   */
  async generateSetup(
    _userId: string,
    userEmail: string
  ): Promise<MfaSetupResult> {
    const authenticator = this.getAuthenticator();

    // Generate secret
    const secret = authenticator.generateSecret(20);

    // Generate OTP auth URI
    const otpauthUri = authenticator.keyuri(
      userEmail,
      this.config.issuer,
      secret
    );

    // Generate QR code
    let qrCodeDataUrl = '';
    if (this.qrGenerator) {
      qrCodeDataUrl = await this.qrGenerator.toDataURL(otpauthUri);
    } else {
      // Try to load qrcode library dynamically
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const qrcode = await import('qrcode' as any) as { toDataURL: (text: string) => Promise<string> };
        qrCodeDataUrl = await qrcode.toDataURL(otpauthUri);
      } catch {
        // QR code generation not available, user can use manual entry
        qrCodeDataUrl = '';
      }
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(this.config.backupCodesCount);

    // Format manual entry key (add spaces every 4 characters)
    const manualEntryKey = secret.replace(/(.{4})/g, '$1 ').trim();

    return {
      secret,
      qrCodeDataUrl,
      manualEntryKey,
      backupCodes,
      otpauthUri,
    };
  }

  /**
   * Verify a TOTP token
   */
  verifyToken(token: string, secret: string): MfaVerificationResult {
    const authenticator = this.getAuthenticator();

    // Normalize token (remove spaces and dashes)
    const normalizedToken = token.replace(/[\s-]/g, '');

    // Validate token format
    if (!/^\d{6}$/.test(normalizedToken) && this.config.digits === 6) {
      return {
        valid: false,
        error: 'Invalid token format. Expected 6 digits.',
      };
    }

    try {
      const isValid = authenticator.verify({
        token: normalizedToken,
        secret,
      });

      return { valid: isValid };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token verification failed',
      };
    }
  }

  /**
   * Verify a backup code
   */
  async verifyBackupCode(
    code: string,
    hashedCodes: string[],
    hashFunction: (code: string) => Promise<string>
  ): Promise<{ valid: boolean; codeIndex: number }> {
    // Normalize code
    const normalizedCode = code.replace(/[\s-]/g, '').toUpperCase();
    const codeHash = await hashFunction(normalizedCode);

    for (let i = 0; i < hashedCodes.length; i++) {
      if (hashedCodes[i] === codeHash) {
        return { valid: true, codeIndex: i };
      }
    }

    return { valid: false, codeIndex: -1 };
  }

  /**
   * Generate current TOTP token (for testing)
   */
  generateCurrentToken(secret: string): string {
    const authenticator = this.getAuthenticator();
    return authenticator.generate(secret);
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(this.generateBackupCode());
    }
    return codes;
  }

  /**
   * Generate a single backup code
   */
  private generateBackupCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed I, O, 0, 1 for clarity
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Format as XXXX-XXXX
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  }

  /**
   * Hash backup codes for storage
   */
  async hashBackupCodes(
    codes: string[],
    hashFunction: (code: string) => Promise<string>
  ): Promise<string[]> {
    const hashedCodes: string[] = [];
    for (const code of codes) {
      const normalizedCode = code.replace(/[\s-]/g, '').toUpperCase();
      const hash = await hashFunction(normalizedCode);
      hashedCodes.push(hash);
    }
    return hashedCodes;
  }

  /**
   * Get time remaining until current token expires
   */
  getTokenTimeRemaining(): number {
    const step = this.config.stepSeconds;
    const now = Math.floor(Date.now() / 1000);
    return step - (now % step);
  }

  /**
   * Validate secret format
   */
  isValidSecret(secret: string): boolean {
    // Base32 alphabet (without padding)
    const base32Regex = /^[A-Z2-7]+$/i;
    return base32Regex.test(secret) && secret.length >= 16;
  }

  /**
   * Get MFA setup instructions
   */
  getSetupInstructions(): {
    steps: string[];
    supportedApps: string[];
  } {
    return {
      steps: [
        '1. Install an authenticator app on your phone',
        '2. Scan the QR code with the app, or enter the key manually',
        '3. Enter the 6-digit code from the app to verify',
        '4. Save your backup codes in a secure location',
      ],
      supportedApps: [
        'Google Authenticator',
        'Microsoft Authenticator',
        'Authy',
        '1Password',
        'Bitwarden',
      ],
    };
  }

  /**
   * Get configuration
   */
  getConfig(): MfaConfig {
    return { ...this.config };
  }

  /**
   * Check if MFA is enabled in config
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

/**
 * MFA challenge state
 */
export interface MfaChallenge {
  id: string;
  userId: string;
  tenantId: string;
  createdAt: Date;
  expiresAt: Date;
  verified: boolean;
  attempts: number;
  maxAttempts: number;
}

/**
 * MFA challenge manager
 */
export class MfaChallengeManager {
  private challenges: Map<string, MfaChallenge> = new Map();
  private maxAttempts: number;
  private challengeDurationSeconds: number;

  constructor(options: { maxAttempts?: number; challengeDurationSeconds?: number } = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.challengeDurationSeconds = options.challengeDurationSeconds ?? 300; // 5 minutes
  }

  /**
   * Create a new MFA challenge
   */
  createChallenge(userId: string, tenantId: string): MfaChallenge {
    const now = new Date();
    const challenge: MfaChallenge = {
      id: this.generateChallengeId(),
      userId,
      tenantId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.challengeDurationSeconds * 1000),
      verified: false,
      attempts: 0,
      maxAttempts: this.maxAttempts,
    };

    this.challenges.set(challenge.id, challenge);
    return challenge;
  }

  /**
   * Get a challenge by ID
   */
  getChallenge(challengeId: string): MfaChallenge | null {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      return null;
    }

    // Check if expired
    if (new Date() > challenge.expiresAt) {
      this.challenges.delete(challengeId);
      return null;
    }

    return challenge;
  }

  /**
   * Record an attempt on a challenge
   */
  recordAttempt(challengeId: string): {
    allowed: boolean;
    remainingAttempts: number;
  } {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      return { allowed: false, remainingAttempts: 0 };
    }

    challenge.attempts++;
    const remainingAttempts = challenge.maxAttempts - challenge.attempts;

    if (remainingAttempts <= 0) {
      this.challenges.delete(challengeId);
      return { allowed: false, remainingAttempts: 0 };
    }

    return { allowed: true, remainingAttempts };
  }

  /**
   * Mark a challenge as verified
   */
  verifyChallenge(challengeId: string): boolean {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      return false;
    }

    challenge.verified = true;
    return true;
  }

  /**
   * Delete a challenge
   */
  deleteChallenge(challengeId: string): boolean {
    return this.challenges.delete(challengeId);
  }

  /**
   * Clean up expired challenges
   */
  cleanupExpired(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [id, challenge] of this.challenges.entries()) {
      if (now > challenge.expiresAt) {
        this.challenges.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Generate a unique challenge ID
   */
  private generateChallengeId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `mfa_${timestamp}_${random}`;
  }

  /**
   * Clear all challenges (for testing)
   */
  clear(): void {
    this.challenges.clear();
  }
}

// Singleton instance
let mfaServiceInstance: MfaService | null = null;

/**
 * Get the singleton MFA service instance
 */
export function getMfaService(config?: Partial<MfaConfig>): MfaService {
  if (!mfaServiceInstance) {
    mfaServiceInstance = new MfaService(config);
  }
  return mfaServiceInstance;
}

/**
 * Reset the singleton MFA service instance (for testing)
 */
export function resetMfaService(): void {
  mfaServiceInstance = null;
}

