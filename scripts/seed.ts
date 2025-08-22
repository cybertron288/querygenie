/**
 * Database Seed Script
 * 
 * Seeds the database with initial data for development and testing
 */

import { db } from "@/lib/db";
import {
  users,
  workspaces,
  memberships,
  connections,
  queries,
  docs,
} from "@/lib/db/schema";
import { hashPassword, encrypt } from "@/lib/encryption";
import { randomUUID } from "crypto";

async function seed() {
  console.log("🌱 Starting database seed...");

  try {
    // Clear existing data (be careful in production!)
    if (process.env.NODE_ENV === "development") {
      console.log("Clearing existing data...");
      await db.delete(memberships);
      await db.delete(queries);
      await db.delete(connections);
      await db.delete(docs);
      await db.delete(workspaces);
      await db.delete(users);
    }

    // Create users
    console.log("Creating users...");
    const hashedPassword = await hashPassword("password123");
    
    const userIds = {
      admin: randomUUID(),
      john: randomUUID(),
      jane: randomUUID(),
      bob: randomUUID(),
    };

    await db.insert(users).values([
      {
        id: userIds.admin,
        email: "admin@querygenie.ai",
        name: "Admin User",
        password: hashedPassword,
        avatar: "https://avatar.vercel.sh/admin",
        isActive: true,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: userIds.john,
        email: "john@example.com",
        name: "John Doe",
        password: hashedPassword,
        avatar: "https://avatar.vercel.sh/john",
        isActive: true,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: userIds.jane,
        email: "jane@example.com",
        name: "Jane Smith",
        password: hashedPassword,
        avatar: "https://avatar.vercel.sh/jane",
        isActive: true,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: userIds.bob,
        email: "bob@example.com",
        name: "Bob Wilson",
        password: hashedPassword,
        avatar: "https://avatar.vercel.sh/bob",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create workspaces
    console.log("Creating workspaces...");
    const workspaceIds = {
      acme: randomUUID(),
      startup: randomUUID(),
      personal: randomUUID(),
    };

    await db.insert(workspaces).values([
      {
        id: workspaceIds.acme,
        name: "Acme Corp",
        slug: "acme-corp",
        description: "Main workspace for Acme Corporation",
        avatar: "https://avatar.vercel.sh/acme",
        ownerId: userIds.admin,
        settings: {
          allowedDomains: ["acme.com"],
          defaultConnectionId: null,
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: workspaceIds.startup,
        name: "TechStartup",
        slug: "techstartup",
        description: "Innovative tech startup workspace",
        avatar: "https://avatar.vercel.sh/startup",
        ownerId: userIds.john,
        settings: {},
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: workspaceIds.personal,
        name: "Personal Projects",
        slug: "personal",
        description: "Jane's personal projects",
        avatar: "https://avatar.vercel.sh/personal",
        ownerId: userIds.jane,
        settings: {},
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create memberships
    console.log("Creating memberships...");
    await db.insert(memberships).values([
      // Acme Corp memberships
      {
        id: randomUUID(),
        userId: userIds.admin,
        workspaceId: workspaceIds.acme,
        role: "owner",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        userId: userIds.john,
        workspaceId: workspaceIds.acme,
        role: "admin",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        userId: userIds.jane,
        workspaceId: workspaceIds.acme,
        role: "editor",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        userId: userIds.bob,
        workspaceId: workspaceIds.acme,
        role: "viewer",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // TechStartup memberships
      {
        id: randomUUID(),
        userId: userIds.john,
        workspaceId: workspaceIds.startup,
        role: "owner",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        userId: userIds.jane,
        workspaceId: workspaceIds.startup,
        role: "editor",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // Personal workspace membership
      {
        id: randomUUID(),
        userId: userIds.jane,
        workspaceId: workspaceIds.personal,
        role: "owner",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create connections
    console.log("Creating database connections...");
    const connectionIds = {
      prod: randomUUID(),
      staging: randomUUID(),
      analytics: randomUUID(),
    };

    // Encrypt credentials for database connections
    const encryptedProdPassword = await encrypt("readonly_password");
    const encryptedStagingPassword = await encrypt("admin_password");
    const encryptedAnalyticsPassword = await encrypt("analytics_password");

    await db.insert(connections).values([
      {
        id: connectionIds.prod,
        workspaceId: workspaceIds.acme,
        name: "Production Database",
        type: "postgres",
        mode: "read-only",
        host: "localhost",
        port: 5432,
        database: "production",
        username: "readonly_user",
        encryptedCredentials: encryptedProdPassword,
        sslConfig: null,
        isActive: true,
        lastConnectedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: connectionIds.staging,
        workspaceId: workspaceIds.acme,
        name: "Staging Database",
        type: "postgres",
        mode: "read-write",
        host: "localhost",
        port: 5433,
        database: "staging",
        username: "admin",
        encryptedCredentials: encryptedStagingPassword,
        sslConfig: null,
        isActive: true,
        lastConnectedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: connectionIds.analytics,
        workspaceId: workspaceIds.startup,
        name: "Analytics DB",
        type: "mysql",
        mode: "read-only",
        host: "localhost",
        port: 3306,
        database: "analytics",
        username: "analyst",
        encryptedCredentials: encryptedAnalyticsPassword,
        sslConfig: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Create sample queries
    console.log("Creating sample queries...");
    await db.insert(queries).values(
      {
        id: randomUUID(),
        workspaceId: workspaceIds.acme,
        connectionId: connectionIds.prod,
        title: "Active Users Report",
        sqlQuery: `
          SELECT 
            DATE(created_at) as signup_date,
            COUNT(*) as user_count,
            COUNT(CASE WHEN is_active = true THEN 1 END) as active_users
          FROM users
          WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY DATE(created_at)
          ORDER BY signup_date DESC;
        `,
        description: "Daily active users for the last 30 days",
        isSaved: true,
        isShared: true,
        tags: "users,analytics,daily",
        createdById: userIds.admin,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );
    
    await db.insert(queries).values(
      {
        id: randomUUID(),
        workspaceId: workspaceIds.acme,
        connectionId: connectionIds.prod,
        title: "Revenue by Product",
        sqlQuery: `
          SELECT 
            p.name as product_name,
            p.category,
            SUM(oi.quantity) as units_sold,
            SUM(oi.price * oi.quantity) as total_revenue
          FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          JOIN orders o ON oi.order_id = o.id
          WHERE o.created_at >= CURRENT_DATE - INTERVAL '90 days'
          GROUP BY p.id, p.name, p.category
          ORDER BY total_revenue DESC
          LIMIT 10;
        `,
        description: "Top 10 products by revenue in the last 90 days",
        isSaved: true,
        isShared: false,
        tags: "revenue,products,sales",
        createdById: userIds.john,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );
    
    await db.insert(queries).values(
      {
        id: randomUUID(),
        workspaceId: workspaceIds.startup,
        connectionId: connectionIds.analytics,
        title: "User Engagement Metrics",
        sqlQuery: `
          SELECT 
            DATE_FORMAT(event_date, '%Y-%m-%d') as date,
            COUNT(DISTINCT user_id) as daily_active_users,
            COUNT(*) as total_events,
            AVG(session_duration) as avg_session_duration
          FROM user_events
          WHERE event_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
          GROUP BY DATE_FORMAT(event_date, '%Y-%m-%d')
          ORDER BY date DESC;
        `,
        description: "User engagement metrics for the past week",
        isSaved: true,
        isShared: true,
        tags: "engagement,metrics,users",
        createdById: userIds.john,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    // Create sample documentation
    console.log("Creating sample documentation...");
    await db.insert(docs).values(
      {
        id: randomUUID(),
        workspaceId: workspaceIds.acme,
        scope: "workspace" as const,
        scopeId: workspaceIds.acme,
        title: "Database Schema Documentation",
        content: `
# Database Schema Documentation

## Overview
This document describes the structure of our production database.

## Tables

### Users Table
- **id**: UUID primary key
- **email**: Unique email address
- **name**: User's full name
- **created_at**: Timestamp of account creation
- **is_active**: Boolean flag for active users

### Orders Table
- **id**: UUID primary key
- **user_id**: Foreign key to users table
- **total_amount**: Decimal(10,2)
- **status**: Enum (pending, processing, completed, cancelled)
- **created_at**: Timestamp

### Products Table
- **id**: UUID primary key
- **name**: Product name
- **category**: Product category
- **price**: Decimal(10,2)
- **stock_quantity**: Integer
        `,
        isPublic: false,
        metadata: {
          format: "markdown",
          version: "1.0.0",
        },
        generatedById: userIds.admin,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );
    
    await db.insert(docs).values(
      {
        id: randomUUID(),
        workspaceId: workspaceIds.startup,
        scope: "workspace" as const,
        scopeId: workspaceIds.startup,
        title: "API Query Guidelines",
        content: `
# API Query Guidelines

## Best Practices
1. Always use parameterized queries
2. Limit result sets with LIMIT clause
3. Use indexes for frequently queried columns
4. Avoid SELECT * in production queries

## Performance Tips
- Use EXPLAIN to analyze query performance
- Create composite indexes for multi-column WHERE clauses
- Consider query caching for expensive operations
        `,
        isPublic: true,
        metadata: {
          format: "markdown",
          tags: ["guidelines", "performance"],
        },
        generatedById: userIds.john,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    console.log("✅ Database seed completed successfully!");
    console.log("\nTest credentials:");
    console.log("  Email: admin@querygenie.ai");
    console.log("  Password: password123");
    console.log("\nOther users:");
    console.log("  john@example.com / password123");
    console.log("  jane@example.com / password123");
    console.log("  bob@example.com / password123");

  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

// Run the seed function
seed().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});