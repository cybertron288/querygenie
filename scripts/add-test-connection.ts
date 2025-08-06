/**
 * Add a test SQLite connection to the database
 */

import dotenv from "dotenv";
import { db } from "../src/lib/db";
import { connections } from "../src/lib/db/schema";
import { encrypt } from "../src/lib/encryption";
import { randomUUID } from "crypto";
import path from "path";

// Load environment variables
dotenv.config({ path: '.env.local' });

async function addTestConnection() {
  try {
    console.log("Adding test SQLite connection...");

    // Get the first workspace (Acme Corp) for testing
    const workspaceId = "ddd3f516-4520-4987-b14e-768b9092d2f8"; // Acme Corp workspace ID from database

    // Path to our test SQLite database
    const dbPath = path.join(process.cwd(), "test.db");

    // SQLite doesn't need a password, but we'll encrypt an empty string
    const encryptedPassword = await encrypt("");

    const connectionId = randomUUID();
    
    await db.insert(connections).values({
      id: connectionId,
      workspaceId: workspaceId,
      name: "Test SQLite Database",
      type: "sqlite",
      mode: "read-write",
      host: null, // SQLite doesn't use host
      port: null, // SQLite doesn't use port
      database: dbPath,
      username: null, // SQLite doesn't require username
      encryptedCredentials: encryptedPassword, // Required field but empty for SQLite
      sslConfig: null,
      isActive: true,
      lastConnectedAt: new Date(),
      createdById: null, // No specific user
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`✓ Test connection added with ID: ${connectionId}`);
    console.log(`  Database path: ${dbPath}`);
    console.log("  You can now test query execution in the QueryGenie interface");

  } catch (error) {
    console.error("❌ Error adding test connection:", error);
    process.exit(1);
  }
}

// Run the script
addTestConnection().then(() => {
  console.log("Done!");
  process.exit(0);
});