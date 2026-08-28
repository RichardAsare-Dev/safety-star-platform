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

export function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0] as Record<string, unknown>);
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
}
