/**
 * Remove Dummy Database Connections
 * 
 * Removes the non-working dummy Production, Staging, and Analytics connections
 * while keeping the working Demo SQLite database
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { eq, or, and, isNull } from "drizzle-orm";

async function removeDummyConnections() {
  console.log("🗑️  Removing dummy database connections...");

  try {
    // Get existing connections to see what we're working with
    const existingConnections = await db
      .select({
        id: connections.id,
        name: connections.name,
        type: connections.type,
        host: connections.host,
        database: connections.database,
      })
      .from(connections)
      .where(isNull(connections.deletedAt));

    console.log("Current connections:");
    existingConnections.forEach(conn => {
      console.log(`  - ${conn.name} (${conn.type}) - ${conn.host || conn.database}`);
    });

    // Remove dummy connections (Production, Staging, Analytics)
    // Keep only the Demo SQLite Database which actually works
    const result = await db
      .update(connections)
      .set({
        isActive: false,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          or(
            eq(connections.name, "Production Database"),
            eq(connections.name, "Staging Database"),
            eq(connections.name, "Analytics DB")
          ),
          isNull(connections.deletedAt)
        )
      );

    console.log(`✅ Removed ${result.rowCount || 0} dummy connections`);

    // Show remaining connections
    const remainingConnections = await db
      .select({
        id: connections.id,
        name: connections.name,
        type: connections.type,
        database: connections.database,
      })
      .from(connections)
      .where(
        and(
          eq(connections.isActive, true),
          isNull(connections.deletedAt)
        )
      );

    console.log("Remaining active connections:");
    remainingConnections.forEach(conn => {
      console.log(`  ✓ ${conn.name} (${conn.type}) - ${conn.database}`);
    });

  } catch (error) {
    console.error("❌ Error removing dummy connections:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  removeDummyConnections()
    .then(() => {
      console.log("🎉 Cleanup complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Failed to remove dummy connections:", error);
      process.exit(1);
    });
}

export { removeDummyConnections };