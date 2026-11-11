# CAP Master Task Board (`captaskboard`)

Full-stack Next.js web application built from `CAP_Task_Board (3).xlsx`, featuring a two-tier account governance system (**Admins** and **Members**) with a dedicated **Admin Room** for approving new Admin accounts.

## Key Features

### 1. Account Types & Governance (Admin Room)
- **Admins (`ADMIN` + `APPROVED`)**:
  - Can add, edit, and delete tasks in the **Task Log** and update statuses inline from the **Today Board** or **Task Log**.
  - Can add, edit, and remove **Clients & Pitches** and **Team** members, and configure the **Estimate Buffer %**.
  - Can approve or decline pending Admin requests, promote Members to Admins, or create new accounts inside the **Admin Room**.
- **Members (`MEMBER` — View-Only)**:
  - Unlimited Member accounts can sign up or be added.
  - Can view and filter all tabs (**Today Board**, **Task Log**, **Coming Up**, **Scorecard**, **Clients & Pitches**, **Team**, **How It Works**), switch between Spreadsheet and Kanban views, and export CSVs, but cannot modify data.
  - Can request Admin elevation at registration or anytime from the header / **Admin Room**; the request enters the **Pending Admin Requests** queue until approved by an existing Admin.

### 2. All Excel Workbook Tabs & Live Formulas Built In
- **Today Board**: Auto-ranked by urgency (`1–7`) with live KPI cards (`Open tasks`, `Overdue`, `Due today`, `Blocked`, `No deadline`, `Open pitch tasks`, `No owner`).
- **Master Task Log**: Pre-seeded with all 26 tasks (`T-001` to `T-026`), supporting both **Spreadsheet View** (yellow editable fields for Admins + grey live-calculated formula columns) and **Kanban View**, multi-column filtering, search, and CSV export.
- **Coming Up**: 6-working-day workload matrix (Sunday–Thursday workweek, skipping Friday/Saturday) per team member with `+20%` estimate buffer, plus everything due in the next 14 days.
- **Scorecard**: Custom date period selector (`From` / `To`) showing per-person delivery, on-time %, average revisions, first-round approval %, estimate accuracy, and internal reviews waiting on them.
- **Clients & Pitches**: All 10 initial clients and pitches (`ACI Godrej`, `FIF`, `UNESCO`, `CAP Internal`, `Leona`, `Walton`, `Ngo TOR/ Event`, `SDS Manager`, `India Bangladesh Embassy`, `Grameen Media Center`) with live open/overdue task counts.
- **Team**: All 14 CAP team members across `Creative`, `Servicing`, `C-Suite`, `Strategy and Data`, and `Admin` with daily capacity settings.
- **How It Works**: Reference guide for the daily rhythm (`10:15` Morning check, `13:30` Midday update, `EOD` close, `Thursday` Scorecard review), roles, and formula rules.

## Pre-Seeded Accounts

| Name | Email | Password | Role / Status |
| :--- | :--- | :--- | :--- |
| **Muntasir Mannan** | `muntasir@cap.com` | `admin123` | **Approved Admin** (Board Owner) |
| **Syeda Neelima Dola** | `dola@cap.com` | `admin123` | **Approved Admin** (CEO) |
| **Amit Pramanik** | `amit@cap.com` | `admin123` | **Approved Admin** (Creative Director) |
| **Tahmina Taj** | `tahmina@cap.com` | `member123` | **Pending Admin Approval** (View-only until approved) |
| **Rakib Islam** | `rakib@cap.com` | `member123` | **Member** (View-only) |
| **Rajib Akash** | `rajib@cap.com` | `member123` | **Member** (View-only) |
| **Ragib Shahriar** | `ragib@cap.com` | `member123` | **Member** (View-only) |

## Running Locally

```bash
cd captaskboard
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## Deploying to Vercel

1. Push the `captaskboard` directory to GitHub/GitLab/Bitbucket (or run `npx vercel` inside `captaskboard`).
2. Import the project in Vercel (Root Directory: `captaskboard` if deploying from the parent folder, or `.` if deploying `captaskboard` directly).
3. Out of the box, it works immediately with zero environment variables required. For multi-region persistent cloud storage on Vercel, you can optionally link **Vercel KV / Upstash Redis** (`KV_REST_API_URL` and `KV_REST_API_TOKEN`), which [`src/lib/db.ts`](src/lib/db.ts) automatically detects and uses.
