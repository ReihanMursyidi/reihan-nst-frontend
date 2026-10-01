# NodeWave Task Management System

**Author:** Reihan Mursyidi
**Assessment:** Fullstack Engineer

This repository contains the deliverables for the Fullstack Engineer Assessment. The system is a robust, production-ready task management application designed to handle complex collaborative workflows, inter-task dependencies, and high-concurrency data modifications.

## 📌 Deliverables

### 1. Live Application URLs
- **Frontend (Live App):** [MASUKKAN_LINK_VERCEL_DI_SINI]
- **Backend API:** [MASUKKAN_LINK_RAILWAY/RENDER_DI_SINI]

### 2. Private GitHub Repositories
- **Frontend Repo:** [MASUKKAN_LINK_REPO_FRONTEND]
- **Backend Repo:** [MASUKKAN_LINK_REPO_BACKEND]
*(Collaborators `rigenski` and `nodewavescout` have been successfully invited to both repositories).*

### 3. Seeded Test Accounts
Use the following credentials to test the application flows:

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Product Manager (PM)** | `pm@nst.com` | `password123` | Full R/W, Assign Tasks, Delete |
| **Internal Team (UI/UX)** | `uiux@nst.com` | `password123` | View assigned, Upload attachments |
| **Internal Team (Frontend)**| `frontend@nst.com` | `password123` | View assigned, Upload attachments |
| **Client Guest** | `client@nst.com` | `password123` | View client-visible tasks only |

---

## 🏗️ Architecture & Core Business Logic Overview

The main challenge of this system is enforcing dynamic permissions and preventing data corruption. The architecture tackles these requirements through the following implementations:

### 1. RBAC + ABAC (Role & Attribute-Based Access Control)
- **RBAC (Role-Based):** Handled via an authentication middleware (Interceptor) that extracts the exact `role` from the database using the JWT's `userId`. This strictly separates what a PM, Internal Team, and Client can do globally. For example, endpoints for `DELETE /tasks` or creating tasks are hard-locked to the `PM` role.
- **ABAC (Attribute-Based):** Evaluated dynamically at the resource level. Even if a user has the `INTERNAL` role, they cannot upload an attachment or view a task unless their specific `userId` matches the task's `assigneeId`. Clients are restricted to viewing tasks where `projectId` belongs to their account and `isClientVisible` is true, ensuring absolute multi-tenant data isolation.

### 2. State-Based Permissions & Dependencies
Tasks are not isolated entities; they are linked via a `TaskDependency` junction table. 
- **Dependency-Aware Blocker:** Before a task's status can be updated to `IN_PROGRESS`, the backend queries the database for any pending blockers (dependencies).
- **State Evaluation:** If Task C depends on Task A and B, and either A or B is not `DONE`, the backend throws a `403 Forbidden` with a detailed `blockedBy` message. This prevents engineers from working out of order, satisfying the strict state-based edit requirement.

### 3. Concurrency & Optimistic Locking (Race Condition Prevention)
To handle race conditions (e.g., a PM edits a task description at the exact millisecond an Engineer changes its status), the system uses **Optimistic Locking**.
- **Implementation:** A `version` integer column is embedded in the `Task` table. Every `PATCH` request from the client must include the current `version` it holds.
- **Conflict Resolution:** The Prisma update query includes `where: { id: taskId, version: expectedVersion }`. If the version does not match (because someone else updated it first, incrementing the DB version), the database returns 0 updated records. The backend catches this and throws a `409 Conflict`, explicitly preventing data overwrites without resorting to heavy database locks.

### 4. Immutable Audit Trail & Soft Deletes
- **Audit Trail:** A dedicated `AuditLog` table immutably tracks every mutation. All data-altering endpoints wrap their core action and the Audit Log creation within a single `$transaction`. This guarantees that if a task status changes, the exact `userId`, timestamp, `oldValue`, and `newValue` are recorded simultaneously. If the log fails, the entire task update rolls back.
- **Soft Deletes:** Data is never permanently destroyed. Using Prisma, a `DELETE` request merely sets a `deletedAt` timestamp. The backend query builders natively filter out `deletedAt !== null` on all `GET` endpoints, preserving historical integrity.

---

## 🛠️ Tech Stack Highlights
- **Backend:** TypeScript, Bun, Hono, Prisma, PostgreSQL (Supabase), Zod, JWT.
- **Frontend:** Next.js 16 (App Router), React 19, Zustand 5 (Persist), Tailwind CSS 4, React Hook Form.
- **CI/CD & Quality:** Biome (Linting), Vitest / Bun Native Test (Unit Testing), GitHub Actions (Pipeline).
