# 📊 Database Schema & Relations – AI-Powered Database Assistance Platform

## 🧾 Overview

This document defines the **data structure, relationships, and schema design** for the AI-powered database assistance and documentation platform.  
The system supports user management, database connections, schema ingestion, query generation, documentation automation, mock data generation, and collaboration.

---

## 🗃️ Core Tables

### 1. `users`
Stores core user details and authentication.

| Field            | Type         | Description                          |
|------------------|--------------|--------------------------------------|
| id               | UUID (PK)    | Unique user ID                       |
| full_name        | String       | User’s full name                     |
| email            | String (Unique) | User’s email address               |
| password_hash    | String       | Hashed password                      |
| role             | Enum         | `admin`, `developer`, `analyst`     |
| created_at       | Timestamp    | Account creation time                |
| updated_at       | Timestamp    | Last updated time                    |

---

### 2. `workspaces`
Represents team collaboration spaces.

| Field         | Type         | Description                      |
|---------------|--------------|----------------------------------|
| id            | UUID (PK)    | Unique workspace ID              |
| name          | String       | Workspace name                   |
| owner_id      | UUID (FK)    | User who owns this workspace     |
| created_at    | Timestamp    | Created time                     |
| updated_at    | Timestamp    | Last updated time                |

---

### 3. `memberships`
Mapping between users and workspaces.

| Field        | Type         | Description                           |
|--------------|--------------|---------------------------------------|
| id           | UUID (PK)    | Unique membership ID                  |
| user_id      | UUID (FK)    | Foreign key to `users`                |
| workspace_id | UUID (FK)    | Foreign key to `workspaces`           |
| role         | Enum         | `owner`, `admin`, `editor`, `viewer` |
| created_at   | Timestamp    | Created time                          |

---

### 4. `connections`
Stores linked database metadata.

| Field         | Type         | Description                                |
|---------------|--------------|--------------------------------------------|
| id            | UUID (PK)    | Unique connection ID                       |
| workspace_id  | UUID (FK)    | Foreign key to `workspaces`                |
| name          | String       | Connection alias (e.g., “Prod Postgres”)   |
| db_type       | Enum         | `postgres`, `mysql`, `mssql`, `mongodb`   |
| connection_uri| Encrypted    | Encrypted URI or token reference           |
| mode          | Enum         | `read-only`, `read-write`                  |
| created_at    | Timestamp    | Linked time                                |
| updated_at    | Timestamp    | Last sync/update time                      |

---

### 5. `schemas`
Stores database schema versions.

| Field        | Type         | Description                              |
|--------------|--------------|------------------------------------------|
| id           | UUID (PK)    | Unique schema version ID                 |
| connection_id| UUID (FK)    | Foreign key to `connections`             |
| version      | String       | Schema version identifier                |
| schema_json  | JSONB        | Compact representation of schema         |
| created_at   | Timestamp    | Schema crawl time                        |

---

### 6. `tables`
Represents individual database tables.

| Field        | Type         | Description                        |
|--------------|--------------|------------------------------------|
| id           | UUID (PK)    | Unique table ID                    |
| schema_id    | UUID (FK)    | Foreign key to `schemas`           |
| name         | String       | Table name                         |
| description  | Text         | AI-generated or manual description |
| created_at   | Timestamp    | Created time                       |

---

### 7. `columns`
Represents table columns.

| Field        | Type         | Description                        |
|--------------|--------------|------------------------------------|
| id           | UUID (PK)    | Unique column ID                   |
| table_id     | UUID (FK)    | Foreign key to `tables`            |
| name         | String       | Column name                        |
| data_type    | String       | SQL/NoSQL datatype                 |
| is_nullable  | Boolean      | Nullable or not                    |
| is_pk        | Boolean      | Primary key indicator              |
| is_fk        | Boolean      | Foreign key indicator              |
| fk_table_id  | UUID (FK)    | Linked table if FK                 |
| description  | Text         | AI-generated explanation           |

---

### 8. `queries`
Stores saved/generated SQL queries.

| Field        | Type         | Description                              |
|--------------|--------------|------------------------------------------|
| id           | UUID (PK)    | Unique query ID                          |
| workspace_id | UUID (FK)    | Foreign key to `workspaces`              |
| connection_id| UUID (FK)    | Foreign key to `connections`             |
| sql_text     | Text         | The SQL query text                       |
| description  | Text         | AI-generated or manual explanation       |
| created_by   | UUID (FK)    | User who created the query               |
| created_at   | Timestamp    | Created time                             |

---

### 9. `executions`
Execution metadata for queries.

| Field        | Type         | Description                          |
|--------------|--------------|--------------------------------------|
| id           | UUID (PK)    | Unique execution ID                  |
| query_id     | UUID (FK)    | Foreign key to `queries`             |
| executed_by  | UUID (FK)    | User who executed the query           |
| started_at   | Timestamp    | Execution start time                 |
| duration_ms  | Integer      | Execution duration                   |
| row_count    | Integer      | Number of rows returned              |
| status       | Enum         | `success`, `failed`, `cancelled`     |
| error_msg    | Text         | Error if failed                      |

---

### 10. `docs`
Auto-generated or custom documentation.

| Field        | Type         | Description                         |
|--------------|--------------|-------------------------------------|
| id           | UUID (PK)    | Unique doc ID                       |
| scope        | Enum         | `schema`, `table`, `column`         |
| ref_id       | UUID (FK)    | Reference to schema/table/column    |
| content_md   | Text         | Documentation in Markdown           |
| template     | String       | Template used for generation        |
| created_at   | Timestamp    | Doc creation time                   |
| updated_at   | Timestamp    | Last updated time                   |

---

### 11. `mock_jobs`
Mock data generation jobs.

| Field        | Type         | Description                           |
|--------------|--------------|---------------------------------------|
| id           | UUID (PK)    | Unique job ID                         |
| table_id     | UUID (FK)    | Table for which mock data is generated|
| config       | JSONB        | Config (row count, edge cases, etc.)  |
| status       | Enum         | `pending`, `running`, `completed`    |
| file_path    | String       | Export file location                  |
| created_at   | Timestamp    | Created time                          |
| completed_at | Timestamp    | Completion time                       |

---

### 12. `audits`
Audit logs for compliance.

| Field        | Type         | Description                        |
|--------------|--------------|------------------------------------|
| id           | UUID (PK)    | Unique log ID                      |
| actor_id     | UUID (FK)    | User who performed action          |
| action       | String       | Action performed                   |
| resource     | String       | Resource affected                  |
| details      | JSONB        | Additional metadata                |
| created_at   | Timestamp    | Time of action                     |

---

## 🔗 Relationships

```plaintext
users (1) ──── (N) memberships
workspaces (1) ──── (N) memberships
workspaces (1) ──── (N) connections
connections (1) ──── (N) schemas
schemas (1) ──── (N) tables
tables (1) ──── (N) columns
workspaces (1) ──── (N) queries
queries (1) ──── (N) executions
schemas/tables/columns (1) ──── (N) docs
tables (1) ──── (N) mock_jobs
all resources (1) ──── (N) audits
```

---

## 🧠 Notes
- Use **PostgreSQL** with Drizzle ORM for type-safe queries & migrations.  
- Store connection URIs securely in **Vault/KMS**.  
- Use **pgvector/Chroma** for embeddings (schema + query history).  
- Document versions stored as Markdown for flexibility.  
- Queries default to **read-only mode**; DDL/DML need elevated permissions.  

---

## 🔐 Security & Compliance
- Encrypt all sensitive secrets and tokens.  
- Enforce RBAC across workspaces & queries.  
- Full audit logging of schema imports, query executions, and doc generations.  
- GDPR/SOC2 compliant data handling.  

---

## 📈 Future Enhancements
- Support for **NoSQL schema inference** (MongoDB, DynamoDB).  
- Schema diffing & change history tracking.  
- Real-time **query performance insights** (index suggestions, cost analysis).  
- Multi-region deployment for data residency.  
- Integration with **GitHub/GitLab** for doc + migration sync.  
