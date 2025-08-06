/**
 * Add Demo SQLite Connection
 * 
 * Adds a working SQLite connection to the existing workspace
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { encrypt } from "@/lib/encryption";
import { randomUUID } from "crypto";
import path from "path";

async function addDemoConnection() {
  console.log("🔗 Adding demo SQLite connection...");

  try {
    // Get the absolute path to the demo database
    const demoDbPath = path.resolve(process.cwd(), "data", "demo.sqlite");
    console.log(`Demo database path: ${demoDbPath}`);

    // The SQLite connection doesn't need a password, but we'll encrypt an empty string
    const encryptedCredentials = await encrypt("");

    // Add the connection to the Acme Corp workspace
    const connectionId = randomUUID();
    
    await db.insert(connections).values({
      id: connectionId,
      workspaceId: "cb3924ea-6a1e-4443-b72f-34518f11b782", // Acme Corp workspace ID from seed
      name: "Demo SQLite Database",
      type: "sqlite",
      mode: "read-only",
      host: null,
      port: null,
      database: demoDbPath,
      username: null,
      encryptedCredentials,
      sslConfig: null,
      isActive: true,
      lastConnectedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`✅ Demo connection added successfully!`);
    console.log(`Connection ID: ${connectionId}`);
    console.log(`Workspace: Acme Corp`);
    console.log(`Database: ${demoDbPath}`);
    console.log(`Type: SQLite (read-only)`);

  } catch (error) {
    console.error("❌ Error adding demo connection:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  addDemoConnection()
    .then(() => {
      console.log("🎉 Demo connection setup complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Failed to add demo connection:", error);
      process.exit(1);
    });
}

export { addDemoConnection };