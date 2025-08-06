# 🚀 MVP Scope Document – AI-Powered Database Assistance & Documentation Platform

## 🎯 Purpose
Define and align the minimum set of features required to launch a **usable, valuable MVP** that provides AI-powered database assistance, schema documentation, and query support.

---

## ✅ In Scope (MVP)

### 1. **User Onboarding**
- Email/password registration & login
- OAuth login (Google, GitHub)
- Basic profile management
- Workspace creation (single workspace per user in MVP)

### 2. **Database Connections**
- Connect to PostgreSQL, MySQL, MS-SQL
- Secure credential storage (encrypted, vault-based)
- Read-only mode by default
- Import schema via live DB connection or JSON/CSV upload

### 3. **Schema Ingestion & Visualization**
- Automatic schema ingestion (tables, columns, PK/FK, indexes)
- Interactive ERD (pan/zoom, filter by table)
- Schema versioning (latest version stored)

### 4. **AI Query Copilot**
- Natural Language → SQL (context-aware by schema)
- Query explanation in plain English
- Query optimization suggestions (indexes, rewrites)
- Safe query execution in sandbox (read-only)

### 5. **Documentation Generator**
- Auto-generate docs for schemas, tables, columns
- Markdown-based doc storage
- Export to HTML/PDF
- Glossary auto-population

### 6. **Mock Data Generator**
- Schema-aware data generation (datatypes respected)
- Row count configuration
- Export to CSV/JSON

### 7. **Query Execution & Sharing**
- Run queries from the platform (row limit for safety)
- Save queries with title + description
- Share queries inside a workspace

### 8. **Collaboration Basics**
- Workspace with multiple members
- Role-based access: Owner, Admin, Editor, Viewer
- Audit log of user actions (basic)

### 9. **Security**
- All secrets encrypted at rest
- RBAC enforced at workspace level
- Audit logs for compliance
- GDPR-ready data handling

---

## ❌ Out of Scope (MVP)

- NoSQL connectors (MongoDB, DynamoDB)  
- Schema diffing & change alerts  
- Multi-region deployment / data residency controls  
- GitHub/GitLab/Bitbucket sync  
- Advanced mock data generation (relational, edge cases)  
- Real-time query performance insights  
- SSO/SCIM integrations  
- Marketplace integrations (BI tools, Confluence, Notion, etc.)  
- Advanced governance (policy-based query controls)  

---

## 📌 Success Criteria for MVP
- Users can **connect at least one database** (Postgres, MySQL, MS-SQL).  
- Schema ingestion & ERD visualization work reliably.  
- AI can **generate, explain, and optimize queries** based on schema context.  
- Users can generate **basic schema documentation** and export it.  
- Mock data can be generated and exported.  
- Collaboration: invite team members to a workspace.  

---

## 🛠️ Tech Stack (Suggested)
- **Frontend:** React (Web), Next.js, Tailwind, React Flow (for ERD), Monaco (SQL editor)  
- **Backend:** Node.js (NestJS) or Python (FastAPI)  
- **Database:** PostgreSQL (with pgvector for embeddings)  
- **AI Layer:** OpenAI ChatGPT API (function calling), text-embedding-3-large  
- **Infra:** Docker, Kubernetes, AWS/GCP/Azure  
- **Secrets:** Vault/KMS  
- **Queue:** Redis + BullMQ (background tasks)  

---

## 🚧 Risks & Assumptions
- AI accuracy for SQL generation depends on schema context & embeddings.  
- Users may request **write queries** → need strict guardrails.  
- Schema size may affect AI prompt context limits.  
- Data privacy concerns require schema-only ingestion (no real data).  
- Need reliable DB connectors for ingestion & query execution.  

---

## 🗓️ MVP Timeline (Estimated)
| Phase              | Duration       | Outcome                                |
|--------------------|----------------|----------------------------------------|
| Planning & Design  | 3 weeks        | Wireframes, schema design, API design  |
| Development        | 8 weeks        | Core MVP features implemented          |
| Testing            | 2 weeks        | QA, bug fixing, load testing           |
| Launch             | 1 week         | MVP available for early adopters       |

---

## 🧭 Focus Areas
- **Reliable schema ingestion & ERD rendering**  
- **High-quality SQL generation/explanation/optimization**  
- **Zero-effort documentation generation**  
- **Collaboration-first UX**  
