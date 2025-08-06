/**
 * Drizzle Kit Configuration
 * 
 * Configuration for database migrations, schema generation, and Drizzle Studio
 * Supports both local development and production environments
 */

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Database connection
  dialect: "postgresql", 
  dbCredentials: {
    url: "postgresql://postgres:postgres@localhost:5432/querygenie",
  },

  // Schema files
  schema: "./src/lib/db/schema.ts",
  
  // Migration output directory
  out: "./drizzle",
  
  // Migration settings
  migrations: {
    table: "__drizzle_migrations",
    schema: "public",
  },

  // Drizzle Studio configuration removed - not supported in config

  // Schema generation options
  schemaFilter: ["public"],
  
  // Verbose logging for development
  verbose: true,
  
  // Strict mode for production
  strict: false,

  // Break connection locks (useful for development)
  breakpoints: true,
  
  // Introspection settings
  introspect: {
    casing: "camel",
  },
});