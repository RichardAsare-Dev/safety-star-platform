# Safety Star Platform

# System Requirements Specification: WTP OHSE Recognition & Awards Platform

## Executive Summary & System Objectives

This document specifies the complete technical, structural, visual, and behavioral requirements to build a full-stack, responsive web application for the **WTP Occupational Health, Safety, and Environmental (OHSE) Recognition and Awards Program**[cite: 1]. 

The platform transitions an existing multi-column Google Sheet/Smartsheet setup into a fully automated, user-friendly, and visually engaging web application built according to ISO 45001:2018 and ISO 14001:2015 standards[cite: 1].

---

## 1. User Experience (UX) & Visual Design Specification

### Visual Navigation & Dashboard Hierarchy

* **Role-Based Dynamic Views:**

  * **Voters / Employees:** Minimalist, clean single-page submission wizard with zero clutter.

  * **HODs & Managers:** Interactive review cards with visual score sliders (1–5 scale) for quick 30-second evaluations[cite: 1].

  * **Safety Admins:** Modern high-density data table view with status badges, search filters, CSV export, and single-click approval/disqualification toggles[cite: 1].

* **Header & Status Banner:**

  * Top status bar displaying a live **"Days Remaining in Voting Window"** badge with a countdown timer.

  * Real-time **"Sync Status"** badge showing database connectivity (`Last Sync: Realtime`).

### User-Friendly Form Guidance & Visual Cues

* **Step Progress Tracker:** Visible 3-step timeline (*1. Voter Info $\rightarrow$ 2. Nominee Selection $\rightarrow$ 3. Award Categories*) at the top of the voting screen.

* **Searchable Dropdowns & Smart Auto-Complete:** Dropdowns feature real-time search bars so voters can quickly find names without scrolling.

* **Visual Employee Badges:** Selecting a nominee instantly displays a visual badge showing their position title (*e.g., Plant Operator, Shift Lead*) and department tag.

* **Smart Category Filtering:** Non-applicable award checkboxes auto-grey out based on leadership tier with helpful tooltips (*e.g., "Coordinator categories disabled for Non-Leadership roles"*).

### Live Visual Summary Dashboard (Replicating "Screenshot 5")

* **Column Grid Layout:** Visual cards representing each organizational section (*Organizational Capabilities, RO250 & RO500, AWTP, STP, NWTP, Engineering - Mechanical, Engineering - Electrical, Engineering - Planning, Processing - Pompora, R&D / QA / QC*).

* **Live Nominee Count Badges:** Header on each department column showing total unique nominees (*e.g., "3 nominee(s)"*).

* **Color-Coded Status Indicators:**

  * 🟢 **Green (Approved / Verified):** Passed 70% HSE criteria[cite: 1].

  * 🟡 **Yellow (Pending):** Awaiting HOD evaluation[cite: 1].

  * 🔴 **Red (Disqualified):** Recordable injury logged or CAPA $< 95\%$[cite: 1].

### Executive Safety Wall & Culture Tracker

* **Digital Trophy Case:** Highlighting current Monthly and Quarterly Safety Champions with employee avatars, award badges, and citation notes[cite: 1].

* **Maturity Scale Progress Bar:** Interactive visual scale tracking plant progress along the Safety Culture Journey (*Vulnerable* $\rightarrow$ *Reactive* $\rightarrow$ *Bureaucratic* $\rightarrow$ *Proactive* $\rightarrow$ *Resilient*)[cite: 1].

---

## 2. Normalized Database Schema (PostgreSQL / Supabase)

To eliminate the wide, sparse column layout of legacy spreadsheets, the system uses a normalized database model:

### `departments`

* `id` (UUID, Primary Key)

* `name` (VARCHAR): e.g., "Organizational Capabilities", "RO250 & RO500", "AWTP", "STP", "NWTP", "Engineering - Mechanical", "Engineering - Electrical", "Engineering - Planning", "Processing - Pompora (RO140)", "R&D / QA / QC".

* `batch_category` (ENUM): `'Batch I'`, `'Batch II'`

### `users_employees`

* `id` (UUID, Primary Key)

* `full_name` (VARCHAR)

* `email` (VARCHAR, Unique, Optional)

* `mobile_contact` (VARCHAR, Optional)

* `department_id` (FK -> `departments.id`)

* `position_title` (VARCHAR): "Plant Operator", "Shift Lead", "Deputy Lead", "Coordinator", "Planner", "Mechanical Technician", "Electrical Technician", "Graduate Trainee (GT)", "Forklift Operator", "Driver", "NSP", "Officer".

* `leadership_tier` (ENUM): `'Lead'`, `'Coordinator'`, `'Non-Leadership'`

### `nominations`

* `id` (UUID, Primary Key)

* `voter_name` (VARCHAR)

* `action_type` (ENUM): `'Check Batch I'`, `'Check Batch II'`, `'Request Support'`

* `voter_department_id` (FK -> `departments.id`)

* `nominee_id` (FK -> `users_employees.id`)

* `nominee_department_id` (FK -> `departments.id`)

* `nominee_position_title` (VARCHAR)

* `award_categories` (ARRAY of TEXT):

  * `Monthly Safety Champion - Leadership (Lead)`[cite: 1]

  * `Monthly Safety Champion - Leadership (Coordinator)`[cite: 1]

  * `Monthly Safety Champion - Non leadership`[cite: 1]

  * `Quarterly Safety Champion - Leadership (Lead)`[cite: 1]

  * `Quarterly Safety Champion - Leadership (Coordinator)`[cite: 1]

  * `Quarterly Safety Champion - Non leadership`[cite: 1]

  * `Annual Safety Champion - Leadership (Lead)`[cite: 1]

  * `Annual Safety Champion - Leadership (Coordinator)`[cite: 1]

  * `Annual Safety Champion - Non leadership`[cite: 1]

* `status` (ENUM): `'Pending HSE Verification'`, `'Disqualified'`, `'Approved for HOD Evaluation'`, `'Completed'`[cite: 1]

* `disqualification_reason` (TEXT, Optional)[cite: 1]

* `created_at` (TIMESTAMPTZ, Default: `NOW()`)

---

## 3. Nomination Form Logic & Cascading Rules

1. **Step 1: Action & Batch Gate**

   * Options: `Check Batch I`, `Check Batch II`, `Request Support`.

   * **If `Request Support`:** Opens immediate Support Request Drawer prompting for `Employee's Name` and `Mobile Contact`.

   * **If `Batch I` / `Batch II`:** Filters the `Voter's Department` dropdown to show only departments matching that batch category.

2. **Step 2: Dynamic Nominee Cascading**

   * Selecting a department dynamically populates the `Nominee Name` dropdown with employees belonging to that department only.

   * Auto-populates the nominee's `Position / Title`.

3. **Step 3: Award Category Rules**

   * Dynamically enables applicable award checkboxes based on the nominee's leadership tier (`Lead`, `Coordinator`, or `Non-Leadership`)[cite: 1].

---

## 4. Dual-Engine Evaluation Framework (70/30 Rule)

### Engine A: HSE Verification Gate (70% Weight)[cite: 1]

* **Auto-Disqualification Rule:** If a department or site reports a recordable injury during the review period, automatically set nomination status to `Disqualified`[cite: 1].

* **Compliance Checks:** Mandatory verification of Hazard Reports, CCVs, PTOs, Inspections, and CAPA closure rate ($\ge 95\%$)[cite: 1].

### Engine B: HOD Behavioral Evaluation (30% Weight)[cite: 1]

Qualified nominees are rated by HODs across 5 qualitative metrics (1–5 scale, max 30 points total)[cite: 1]:

1. Duty of Care[cite: 1]

2. Safe Work Behavior[cite: 1]

3. Hazard Awareness & Reporting[cite: 1]

4. Speaking Up for Safety[cite: 1]

5. Safety Participation & Team Support[cite: 1]

$$\text{Total Score} = (\text{HSE Score out of 100} \times 0.70) + (\text{HOD Rating out of 30})$$[cite: 1]

---

## 5. Technology Stack & Design Palette

* **Frontend:** React, Tailwind CSS, Shadcn UI components, Lucide React icons (`ShieldCheck`, `Award`, `Users`, `AlertOctagon`, `CheckCircle2`)[cite: 1].

* **Color Palette:**

  * **Primary:** Deep Industrial Navy (`#0F172A`)

  * **Accent / Safety Highlight:** Safety Amber/Orange (`#EA580C`)

  * **Success:** Emerald Green (`#16A34A`)

  * **Background:** Soft Slate Gray (`#F8FAFC`)

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b49c58be-d71c-47d0-aeea-fc93e9f5d211).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
