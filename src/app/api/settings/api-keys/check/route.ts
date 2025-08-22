/**
 * API Keys Check Endpoint
 * 
 * Returns which AI models have API keys configured
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { userApiKeys } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/api-keys/check
 * 
 * Check which API keys are available
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user's active API keys from database
    const userKeys = await db
      .select({
        provider: userApiKeys.provider,
        encryptedKey: userApiKeys.encryptedKey,
      })
      .from(userApiKeys)
      .where(
        and(
          eq(userApiKeys.userId, session.user.id),
          eq(userApiKeys.isActive, true)
        )
      );

    // Set environment variables from user's API keys
    for (const key of userKeys) {
      try {
        const decryptedKey = await decrypt(key.encryptedKey);
        if (key.provider === "gemini") {
          process.env.GEMINI_API_KEY = decryptedKey;
        } else if (key.provider === "openai") {
          process.env.OPENAI_API_KEY = decryptedKey;
        } else if (key.provider === "anthropic") {
          process.env.ANTHROPIC_API_KEY = decryptedKey;
        }
      } catch (error) {
        console.error(`Failed to decrypt key for provider ${key.provider}:`, error);
      }
    }

    // Check which API keys are now configured
    const availableModels = {
      gemini: !!process.env.GEMINI_API_KEY,
      "gpt-3.5-turbo": !!process.env.OPENAI_API_KEY,
      "gpt-4": !!process.env.OPENAI_API_KEY,
      claude: !!process.env.ANTHROPIC_API_KEY,
    };
    
    // Debug logging in development
    if (process.env.NODE_ENV === "development") {
      console.log("API Keys Check:", {
        gemini: process.env.GEMINI_API_KEY ? "Set (length: " + process.env.GEMINI_API_KEY.length + ")" : "Not set",
        openai: process.env.OPENAI_API_KEY ? "Set" : "Not set",
        anthropic: process.env.ANTHROPIC_API_KEY ? "Set" : "Not set",
      });
    }

    // Count available models
    const availableCount = Object.values(availableModels).filter(Boolean).length;

    return NextResponse.json({
      success: true,
      availableModels,
      availableCount,
      hasAnyKey: availableCount > 0,
    });
  } catch (error) {
    console.error("Error checking API keys:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to check API keys" },
      { status: 500 }
    );
  }
}