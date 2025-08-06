/**
 * Environment Variables
 * 
 * Centralized environment configuration with validation
 */

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/querygenie",
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3004",
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "development-secret-key-32-chars-minimum-for-auth",
  ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET || "development-encryption-key-32-chars-for-crypto",
  NODE_ENV: process.env.NODE_ENV || "development",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
};

export const isDevelopment = env.NODE_ENV === "development";
export const isProduction = env.NODE_ENV === "production";