import type { Database } from "@/integrations/supabase/types";

export type LeadershipTier = Database["public"]["Enums"]["leadership_tier"];
export type NominationStatus = Database["public"]["Enums"]["nomination_status"];
export type BatchCategory = Database["public"]["Enums"]["batch_category"];
export type ActionType = Database["public"]["Enums"]["nomination_action"];

export type Department = Database["public"]["Tables"]["departments"]["Row"];
export type Employee = Database["public"]["Tables"]["users_employees"]["Row"];
export type Nomination = Database["public"]["Tables"]["nominations"]["Row"];

export const DEPARTMENT_ORDER = [
  "Organizational Capabilities",
  "RO250 & RO500",
  "AWTP",
  "STP",
  "NWTP",
  "Engineering - Mechanical",
  "Engineering - Electrical",
  "Engineering - Planning",
  "Processing - Pompora (RO140)",
  "R&D / QA / QC",
];

export const AWARD_CATEGORIES: { label: string; tier: LeadershipTier; cycle: string }[] = [
  { label: "Monthly Safety Champion - Leadership (Lead)", tier: "Lead", cycle: "Monthly" },
  {
    label: "Monthly Safety Champion - Leadership (Coordinator)",
    tier: "Coordinator",
    cycle: "Monthly",
  },
  { label: "Monthly Safety Champion - Non leadership", tier: "Non-Leadership", cycle: "Monthly" },
  { label: "Quarterly Safety Champion - Leadership (Lead)", tier: "Lead", cycle: "Quarterly" },
  {
    label: "Quarterly Safety Champion - Leadership (Coordinator)",
    tier: "Coordinator",
    cycle: "Quarterly",
  },
  {
    label: "Quarterly Safety Champion - Non leadership",
    tier: "Non-Leadership",
    cycle: "Quarterly",
  },
  { label: "Annual Safety Champion - Leadership (Lead)", tier: "Lead", cycle: "Annual" },
  {
    label: "Annual Safety Champion - Leadership (Coordinator)",
    tier: "Coordinator",
    cycle: "Annual",
  },
  { label: "Annual Safety Champion - Non leadership", tier: "Non-Leadership", cycle: "Annual" },
];

export const HOD_METRICS = [
  { key: "hod_duty_of_care", label: "Duty of Care" },
  { key: "hod_safe_work_behavior", label: "Safe Work Behavior" },
  { key: "hod_hazard_awareness", label: "Hazard Awareness & Reporting" },
  { key: "hod_speaking_up", label: "Speaking Up for Safety" },
  { key: "hod_participation", label: "Safety Participation & Team Support" },
] as const;

export type HodMetricKey = (typeof HOD_METRICS)[number]["key"];

export const MATURITY_STAGES = [
  "Vulnerable",
  "Reactive",
  "Bureaucratic",
  "Proactive",
  "Resilient",
] as const;

export function tierDisabledReason(tier: LeadershipTier | null, categoryTier: LeadershipTier) {
  if (!tier) return "Select a nominee first to unlock award categories.";
  if (tier === categoryTier) return null;
  if (categoryTier === "Coordinator") return `Coordinator categories disabled for ${tier} roles.`;
  if (categoryTier === "Lead") return `Lead categories disabled for ${tier} roles.`;
  return `Non-leadership categories disabled for ${tier} roles.`;
}

export function hodPoints(n: Partial<Nomination>) {
  const values = HOD_METRICS.map((m) => n[m.key] ?? null);
  if (values.some((v) => v === null)) return null;
  return values.reduce<number>((sum, v) => sum + (v as number), 0);
}

export function totalScore(n: Nomination) {
  const hod = hodPoints(n);
  if (n.hse_score === null || hod === null) return null;
  return Math.round((n.hse_score * 0.7 + hod) * 10) / 10;
}

export function statusTone(status: NominationStatus) {
  switch (status) {
    case "Disqualified":
      return "destructive" as const;
    case "Pending HSE Verification":
      return "warning" as const;
    case "Approved for HOD Evaluation":
      return "success" as const;
    default:
      return "primary" as const;
  }
}

export const STATUS_DOT: Record<NominationStatus, string> = {
  "Pending HSE Verification": "bg-warning",
  Disqualified: "bg-destructive",
  "Approved for HOD Evaluation": "bg-success",
  Completed: "bg-primary",
};

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// ── Excel-compatible CSV export ──────────────────────────────────────────────
// Produces a BOM-prefixed UTF-8 CSV that Excel opens natively with correct
// column headers, date formatting, and no encoding issues.

export type ExportRow = {
  "Nominee Name": string;
  Department: string;
  "Position / Title": string;
  "Leadership Tier": string;
  Batch: string;
  "Submitted By (Voter)": string;
  "Award Categories": string;
  Status: string;
  "HSE Score (/100)": string | number;
  "CAPA Closure Rate (%)": string | number;
  "Recordable Injury": string;
  "HOD – Duty of Care (/5)": string | number;
  "HOD – Safe Work Behavior (/5)": string | number;
  "HOD – Hazard Awareness (/5)": string | number;
  "HOD – Speaking Up (/5)": string | number;
  "HOD – Safety Participation (/5)": string | number;
  "HOD Total (/30)": string | number;
  "Total Score (70/30)": string | number;
  "Disqualification Reason": string;
  "Citation Note": string;
  "Vote Count": number;
  "Submitted At": string;
};

function escapeCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  // Wrap in quotes if contains comma, double-quote, newline, or carriage return
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toExcelCsv(rows: ExportRow[]): Blob {
  if (rows.length === 0) {
    // Return empty sheet with headers only
    const headers = Object.keys({} as ExportRow);
    const BOM = "\uFEFF";
    return new Blob([BOM + headers.join(",")], { type: "text/csv;charset=utf-8;" });
  }
  const headers = Object.keys(rows[0]) as (keyof ExportRow)[];
  const lines: string[] = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(",")),
  ];
  // BOM (\uFEFF) tells Excel this is UTF-8 — prevents garbled characters
  const BOM = "\uFEFF";
  return new Blob([BOM + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
}
