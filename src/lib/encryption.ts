/**
 * Encryption utilities for sensitive data
 * 
 * Uses AES-256-GCM for encryption/decryption
 */

import crypto from "crypto";

const algorithm = "aes-256-gcm";
const saltLength = 64;
const tagLength = 16;
const ivLength = 16;
const iterations = 100000;
const keyLength = 32;

/**
 * Get or generate encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET environment variable is not set");
  }

  // Derive a key from the secret using PBKDF2
  const salt = crypto.createHash("sha256").update("querygenie-salt").digest();
  return crypto.pbkdf2Sync(secret, salt, iterations, keyLength, "sha256");
}

/**
 * Encrypt sensitive data
 * 
 * @param text - Plain text to encrypt
 * @returns Encrypted string with salt, iv, tag, and ciphertext
 */
export async function encrypt(text: string): Promise<string> {
  try {
    const key = getEncryptionKey();
    
    // Generate random salt and IV
    const salt = crypto.randomBytes(saltLength);
    const iv = crypto.randomBytes(ivLength);
    
    // Create cipher
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    // Encrypt the text
    const encrypted = Buffer.concat([
      cipher.update(text, "utf8"),
      cipher.final(),
    ]);
    
    // Get the authentication tag
    const tag = cipher.getAuthTag();
    
    // Combine salt, iv, tag, and encrypted data
    const combined = Buffer.concat([salt, iv, tag, encrypted]);
    
    // Return base64 encoded string
    return combined.toString("base64");
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt sensitive data
 * 
 * @param encryptedText - Encrypted base64 string
 * @returns Decrypted plain text
 */
export async function decrypt(encryptedText: string): Promise<string> {
  try {
    const key = getEncryptionKey();
    
    // Decode from base64
    const combined = Buffer.from(encryptedText, "base64");
    
    // Extract components
    const salt = combined.slice(0, saltLength);
    const iv = combined.slice(saltLength, saltLength + ivLength);
    const tag = combined.slice(saltLength + ivLength, saltLength + ivLength + tagLength);
    const encrypted = combined.slice(saltLength + ivLength + tagLength);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(tag);
    
    // Decrypt the text
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Hash a password using bcrypt-compatible algorithm
 * 
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512");
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Verify a password against a hash
 * 
 * @param password - Plain text password
 * @param hashedPassword - Hashed password to compare against
 * @returns True if password matches
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  const [salt, hash] = hashedPassword.split(":");
  const verifyHash = crypto.pbkdf2Sync(
    password,
    Buffer.from(salt, "hex"),
    iterations,
    64,
    "sha512"
  );
  return hash === verifyHash.toString("hex");
}

/**
 * Generate a secure random token
 * 
 * @param length - Length of the token in bytes (default: 32)
 * @returns Random token as hex string
 */
export function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Generate a secure API key
 * 
 * @param prefix - Optional prefix for the API key
 * @returns API key string
 */
export function generateApiKey(prefix = "qg"): string {
  const token = crypto.randomBytes(24).toString("base64url");
  return `${prefix}_${token}`;
}

/**
 * Mask sensitive data for logging
 * 
 * @param text - Text to mask
 * @param visibleChars - Number of characters to show at start and end
 * @returns Masked string
 */
export function maskSensitiveData(text: string, visibleChars = 4): string {
  if (text.length <= visibleChars * 2) {
    return "*".repeat(text.length);
  }
  
  const start = text.slice(0, visibleChars);
  const end = text.slice(-visibleChars);
  const masked = "*".repeat(Math.max(8, text.length - visibleChars * 2));
  
  return `${start}${masked}${end}`;
}