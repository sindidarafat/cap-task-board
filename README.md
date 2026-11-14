# CAP Master Task Board (`captaskboard`)

Full-stack Next.js web application built from `CAP_Task_Board (3).xlsx`, featuring a two-tier account governance system (**Admins** and **Members**) with a dedicated **Admin Room** for approving new Admin accounts.

---

## 🔐 Pre-Seeded Team Accounts & Login Credentials

All team accounts are pre-seeded in the database and can sign in using **either** `Cap@2026!` or `admin123` (for Admins) / `member123` (for Members).

### 🛡️ Administrators (Can Add, Edit, Delete Tasks & Approve New Admins)

| Name | Role | Email | Password | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Sindid Arafat** | Data Analyst & Admin | `sindid@cap.com` | `Cap@2026!` or `admin123` | **Approved Admin** |
| **Syeda Neelima Dola** | CEO | `dola@cap.com` | `Cap@2026!` or `admin123` | **Approved Admin** |
| **Amit Pramanik** | Creative Director | `amit@cap.com` | `Cap@2026!` or `admin123` | **Approved Admin** |
| **Muntasir Mannan** | Key Account Manager | `muntasir@cap.com` | `Cap@2026!` or `admin123` | **Approved Admin** |
| **Rajat Tanmay** | MD & Servicing Lead | `rajat@cap.com` | `Cap@2026!` or `admin123` | **Approved Admin** |
| **Manjurul Mahmud** | Chief of Strategy | `manjurul@cap.com` | `Cap@2026!` or `admin123` | **Approved Admin** |
| **Meem Arafat Manab** | Chief of Finance | `meem@cap.com` | `Cap@2026!` or `admin123` | **Approved Admin** |
| **Rashed** | Admin Lead | `rashed@cap.com` | `Cap@2026!` or `admin123` | **Approved Admin** |
| **CAP General Admin** | System Administrator | `admin@cap.com` | `Cap@2026!` or `admin123` | **Approved Admin** |

### 🟢 Team Members (View-Only Access)

| Name | Agency Title / Team | Email | Password | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Rakib Islam** | Sr. Visualizer (Creative) | `rakib@cap.com` | `Cap@2026!` or `member123` | **Member** |
| **Ragib Shahriar** | Copy Supervisor (Creative) | `ragib@cap.com` | `Cap@2026!` or `member123` | **Member** |
| **Rajib Akash** | Sr. Visualizer (Creative) | `rajib@cap.com` | `Cap@2026!` or `member123` | **Member** |
| **Laxmi** | Jr. Visualizer (Creative) | `laxmi@cap.com` | `Cap@2026!` or `member123` | **Member** |
| **Hasin Bijoy** | Video Editor (Creative) | `hasin@cap.com` | `Cap@2026!` or `member123` | **Member** |
| **Tahmina Taj** | Client Servicing Executive | `tahmina@cap.com` | `Cap@2026!` or `member123` | **Pending Admin Approval** |
| **General Member** | Team Member | `member@cap.com` | `Cap@2026!` or `member123` | **Member** |

---

## 🛡️ Admin Room & Approval Workflow

1. **Member Sign Up**: Any team member or collaborator can create an account.
2. **Requesting Admin Access**:
   - If they select **"Admin (requires approval)"** during registration, they are registered with view-only Member access while their request enters the **Pending Admin Requests** queue.
3. **Approval Decision**:
   - Existing Admins (such as **Sindid Arafat**, **Syeda Neelima Dola**, or **Amit Pramanik**) open the **Admin Room** tab to click **Approve** or **Reject**.
   - Approving instantly elevates them to full Administrator privileges with live activity logging.

---

## 📊 Features & Excel Sheet Tabs Included

1. **Today Board**: Auto-ranked by urgency (`1–7`) with live KPI metric cards.
2. **Master Task Log**: Pre-seeded with all 26 tasks (`T-001` to `T-026`), Spreadsheet & Kanban views, search, multi-filters, and CSV export.
3. **Coming Up**: 6-working-day workload matrix (Sunday–Thursday workweek) per team member with `+20%` estimate buffer.
4. **Scorecard**: Custom date period metrics (`From` / `To`) showing delivery reliability, on-time %, average revisions, and first-round approval rate.
5. **Clients & Pitches**: Client directory with live open and overdue deliverable counts.
6. **Team**: Capacity, role, and department management for all 14 team members.
7. **Admin Room**: Admin governance, pending approval requests, and user account management.

---

## 💻 Running Locally

```bash
cd captaskboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚀 Deploying to Vercel

1. Push changes to GitHub:
   ```bash
   git add .
   git commit -m "feat: add admin role for Sindid Arafat and full team login credentials"
   git push origin main
   ```
2. Connected to Vercel: Vercel automatically detects pushes to `main` and deploys the updated app in ~60 seconds.
