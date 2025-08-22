/**
 * Connection Testing API
 * 
 * Tests database connections before saving them
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { testConnection } from "@/lib/db/connection-service";
import { z } from "zod";

// Validation schema
const testConnectionSchema = z.object({
  type: z.enum(["postgres", "mysql", "mssql", "sqlite"]),
  host: z.string().optional(),
  port: z.number().optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  connectionString: z.string().optional(),
  ssl: z.boolean().optional(),
  sslConfig: z.any().optional(),
});

/**
 * POST /api/connections/test
 * Test a database connection
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
    const validatedData = testConnectionSchema.parse(body);

    // Test the connection
    const result = await testConnection({
      ...validatedData,
      name: "test", // Name is not needed for testing
    } as any);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      details: result.details,
    });
  } catch (error: any) {
    console.error("Error testing connection:", error);
    
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation Error", message: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: "Internal Server Error", 
        message: error.message || "Failed to test connection",
        details: { error: error.message }
      },
      { status: 500 }
    );
  }
}