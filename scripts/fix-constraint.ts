/**
 * Fix conversation unique constraint
 * Only allow one active conversation per connection per user
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function fixConstraint() {
  console.log("🔧 Fixing conversation unique constraint...");

  try {
    // Drop the existing constraint if it exists
    console.log("Dropping existing constraint...");
    await db.execute(sql`
      ALTER TABLE conversations 
      DROP CONSTRAINT IF EXISTS conversations_connection_user_active_unique
    `);

    // Create a partial unique constraint that only applies when is_active = true
    console.log("Creating new partial unique constraint...");
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS conversations_connection_user_active_unique 
      ON conversations (connection_id, created_by_id) 
      WHERE is_active = true
    `);

    console.log("✅ Constraint fixed successfully!");
    console.log("- Multiple inactive conversations are now allowed");
    console.log("- Only one active conversation per connection per user is enforced");

  } catch (error) {
    console.error("❌ Error fixing constraint:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  fixConstraint()
    .then(() => {
      console.log("🎉 Constraint fix complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Failed to fix constraint:", error);
      process.exit(1);
    });
}

export { fixConstraint };