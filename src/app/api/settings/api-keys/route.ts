/**
 * API Keys Management API
 * 
 * Manages AI provider API keys for users
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { z } from "zod";
import { db } from "@/lib/db";
import { userApiKeys } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";
import crypto from "crypto";

// Validation schemas
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  provider: z.enum(["gemini", "openai", "anthropic"]),
  key: z.string().min(10).max(500),
});

// Helper function to hash API key for validation
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * GET /api/settings/api-keys
 * 
 * Get user's API keys (masked)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user's API keys from database
    const userKeys = await db
      .select({
        id: userApiKeys.id,
        name: userApiKeys.name,
        provider: userApiKeys.provider,
        isActive: userApiKeys.isActive,
        lastUsedAt: userApiKeys.lastUsedAt,
        usageCount: userApiKeys.usageCount,
        createdAt: userApiKeys.createdAt,
      })
      .from(userApiKeys)
      .where(eq(userApiKeys.userId, session.user.id));
    
    // Add masked key for display
    const maskedKeys = userKeys.map(key => ({
      ...key,
      key: "••••••••••••", // Always mask in list view
    }));

    return NextResponse.json({
      success: true,
      keys: maskedKeys,
    });
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/api-keys
 * 
 * Add a new API key
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createApiKeySchema.parse(body);

    // Check if user already has a key for this provider
    const existingKey = await db
      .select()
      .from(userApiKeys)
      .where(
        and(
          eq(userApiKeys.userId, session.user.id),
          eq(userApiKeys.provider, validatedData.provider)
        )
      )
      .limit(1);

    // Encrypt the API key
    const encryptedKey = encrypt(validatedData.key);
    const keyHash = hashApiKey(validatedData.key);

    let keyId: string;

    if (existingKey.length > 0) {
      // Update existing key
      await db
        .update(userApiKeys)
        .set({
          name: validatedData.name,
          encryptedKey,
          keyHash,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(userApiKeys.id, existingKey[0].id));
      
      keyId = existingKey[0].id;
    } else {
      // Create new key
      const [newKey] = await db
        .insert(userApiKeys)
        .values({
          userId: session.user.id,
          provider: validatedData.provider,
          name: validatedData.name,
          encryptedKey,
          keyHash,
          isActive: true,
        })
        .returning({ id: userApiKeys.id });
      
      keyId = newKey.id;
    }

    // Also set as environment variable for immediate use
    // In production, this would be cached differently
    if (validatedData.provider === "gemini") {
      process.env.GEMINI_API_KEY = validatedData.key;
    } else if (validatedData.provider === "openai") {
      process.env.OPENAI_API_KEY = validatedData.key;
    } else if (validatedData.provider === "anthropic") {
      process.env.ANTHROPIC_API_KEY = validatedData.key;
    }

    // Return the created/updated key (masked)
    return NextResponse.json({
      success: true,
      key: {
        id: keyId,
        name: validatedData.name,
        provider: validatedData.provider,
        key: maskApiKey(validatedData.key),
        isActive: true,
        createdAt: new Date(),
      },
    });
  } catch (error: any) {
    console.error("Error creating API key:", error);
    
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation Error", message: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to create API key" },
      { status: 500 }
    );
  }
}

/**
 * Mask API key for security
 */
function maskApiKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return `${key.substring(0, 4)}••••••••${key.substring(key.length - 4)}`;
}