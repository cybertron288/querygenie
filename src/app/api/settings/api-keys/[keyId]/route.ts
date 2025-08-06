/**
 * Individual API Key Management
 * 
 * Update or delete specific API keys
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { z } from "zod";

// Get the shared store from the parent route
// In production, this would be a database query
const apiKeysStore = new Map<string, any[]>();

const updateApiKeySchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(100).optional(),
});

/**
 * PATCH /api/settings/api-keys/[keyId]
 * 
 * Update an API key
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = updateApiKeySchema.parse(body);
    const { keyId } = params;

    // Get user's keys
    const userKeys = apiKeysStore.get(session.user.id) || [];
    const keyIndex = userKeys.findIndex(k => k.id === keyId);

    if (keyIndex === -1) {
      return NextResponse.json(
        { error: "Not Found", message: "API key not found" },
        { status: 404 }
      );
    }

    // Update the key
    userKeys[keyIndex] = {
      ...userKeys[keyIndex],
      ...validatedData,
    };

    apiKeysStore.set(session.user.id, userKeys);

    return NextResponse.json({
      success: true,
      message: "API key updated",
    });
  } catch (error: any) {
    console.error("Error updating API key:", error);
    
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation Error", message: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to update API key" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/api-keys/[keyId]
 * 
 * Delete an API key
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { keyId } = params;

    // Get user's keys
    const userKeys = apiKeysStore.get(session.user.id) || [];
    const filteredKeys = userKeys.filter(k => k.id !== keyId);

    if (filteredKeys.length === userKeys.length) {
      return NextResponse.json(
        { error: "Not Found", message: "API key not found" },
        { status: 404 }
      );
    }

    apiKeysStore.set(session.user.id, filteredKeys);

    // In production, also remove from environment if it was the active key
    // This is simplified for demo purposes

    return NextResponse.json({
      success: true,
      message: "API key deleted",
    });
  } catch (error) {
    console.error("Error deleting API key:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to delete API key" },
      { status: 500 }
    );
  }
}