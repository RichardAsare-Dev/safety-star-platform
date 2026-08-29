import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertOctagon, CheckCircle2, Download, Pencil, Plus,
  Search, Settings, ShieldCheck, Trash2, Trophy, Users, Building2, RotateCcw, AlertTriangle, LifeBuoy,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { PinGate } from "@/components/PinGate";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  useDepartments, useEmployees, useNominations, useNominationsRealtime,
  useProgramSettings, upsertEmployee, deleteEmployee, deleteNomination,
  resetNominationStatus, updateProgramSettings, upsertDepartment, deleteDepartment,
  toggleNomineeStatus, useSupportRequests, deleteSupportRequest,
} from "@/lib/data";
import {
  hodPoints, initials, toExcelCsv, totalScore,
  AWARD_CATEGORIES, tierDisabledReason,
  MATURITY_STAGES, type Nomination, type Employee, type Department, type ExportRow,
} from "@/lib/ohse";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Safety Admin & HSE Verification Gate | WTP OHSE Awards" },
      { name: "description", content: "HSE verification console for WTP OHSE awards." },
    ],
  }),
  component: AdminPage,
});

// ── Types ────────────────────────────────────────────────────────────────────
type Draft = {
  hse_score: string;
  capa_closure_rate: string;
  recordable_injury: boolean;
  disqualification_reason: string;
};

type EmployeeForm = {
  id?: string;
  full_name: string;
  position_title: string;
  leadership_tier: "Lead" | "Coordinator" | "Non-Leadership";
  department_id: string;
  email: string;
  mobile_contact: string;
};

type DeptForm = {
  id?: string;
  name: string;
  batch_category: "Batch I" | "Batch II";
};

type ConfirmState = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant: "destructive" | "default" | "warning";
  onConfirm: () => void;
};

const CONFIRM_CLOSED: ConfirmState = {
  open: false, title: "", description: "", confirmLabel: "Confirm",
  variant: "destructive", onConfirm: () => {},
};

const POSITION_TITLES = [
  "Plant Operator", "Shift Lead", "Deputy Lead", "Coordinator", "Planner",
  "Mechanical Technician", "Electrical Technician", "Graduate Trainee (GT)",
  "Forklift Operator", "Driver", "NSP", "Officer",
];

const EMPTY_EMP: EmployeeForm = {
  full_name: "", position_title: "", leadership_tier: "Non-Leadership",
  department_id: "", email: "", mobile_contact: "",
};

const EMPTY_DEPT: DeptForm = { name: "", batch_category: "Batch I" };

// ── Reusable Confirm Dialog ──────────────────────────────────────────────────
function ConfirmDialog({ state, onClose }: { state: ConfirmState; onClose: () => void }) {
  const iconColor = state.variant === "destructive" ? "text-destructive" : "text-warning";
  return (
    <Dialog open={state.open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-full",
              state.variant === "destructive" ? "bg-destructive/10" : "bg-warning/15"
            )}>
              <AlertTriangle className={cn("size-5", iconColor)} />
            </span>
            <DialogTitle className="text-base">{state.title}</DialogTitle>
          </div>
          <DialogDescription className="pt-1 text-sm text-muted-foreground">
            {state.description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant={state.variant === "destructive" ? "destructive" : "default"}
            onClick={() => { state.onConfirm(); onClose(); }}
          >
            {state.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── AdminPage ────────────────────────────────────────────────────────────────
function AdminPage() {
  useNominationsRealtime();
  const queryClient = useQueryClient();
  const { data: nominations = [], isLoading } = useNominations();
  const { data: employees = [] } = useEmployees();
  const { data: departments = [] } = useDepartments();
  const { data: settings } = useProgramSettings();
  const { data: supportRequests = [] } = useSupportRequests();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [tableSearch, setTableSearch] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState>(CONFIRM_CLOSED);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const deptById = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);

  const pending = nominations.filter(
    (n) => n.status === "Pending HSE Verification" && n.action_type !== "Request Support",
  );
  const disqualified = nominations.filter((n) => n.status === "Disqualified");
  const verified = nominations.filter((n) => n.status === "Approved for HOD Evaluation");

  const filteredNominations = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return nominations;
    return nominations.filter((n) => {
      const name = employeeById.get(n.nominee_id ?? "")?.full_name ?? "";
      const dept = deptById.get(n.nominee_department_id ?? "")?.name ?? "";
      return (
        name.toLowerCase().includes(q) ||
        dept.toLowerCase().includes(q) ||
        n.voter_name.toLowerCase().includes(q) ||
        n.status.toLowerCase().includes(q)
      );
    });
  }, [nominations, tableSearch, employeeById, deptById]);

  const draftFor = (n: Nomination): Draft =>
    drafts[n.id] ?? {
      hse_score: n.hse_score === null ? "" : String(n.hse_score),
      capa_closure_rate: n.capa_closure_rate === null ? "" : String(n.capa_closure_rate),
      recordable_injury: n.recordable_injury,
      disqualification_reason: n.disqualification_reason ?? "",
    };

  const setDraft = (id: string, patch: Partial<Draft>, base: Draft) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...base, ...patch } }));

  const verify = useMutation({
    mutationFn: async ({ nomination, draft }: { nomination: Nomination; draft: Draft }) => {
      const score = Math.round(Number(draft.hse_score));
      const capa = draft.capa_closure_rate === "" ? null : Number(draft.capa_closure_rate);
      if (!draft.recordable_injury) {
        if (!draft.hse_score || Number.isNaN(score) || score < 0 || score > 100)
          throw new Error("Enter an HSE score between 0 and 100.");
        if (capa !== null && (Number.isNaN(capa) || capa < 0 || capa > 100))
          throw new Error("CAPA closure rate must be between 0 and 100.");
      }
      const capaFail = capa !== null && capa < 95;
      const disqualify = draft.recordable_injury || capaFail;
      const payload = disqualify
        ? {
            status: "Disqualified" as const,
            recordable_injury: draft.recordable_injury,
            disqualification_reason:
              draft.disqualification_reason.trim() ||
              (draft.recordable_injury
                ? "Recordable injury recorded within the evaluation window."
                : `CAPA closure rate ${capa}% is below the required 95% threshold.`),
            hse_score: draft.recordable_injury ? null : score,
            capa_closure_rate: capa,
          }
        : {
            status: "Approved for HOD Evaluation" as const,
            recordable_injury: false,
            disqualification_reason: null,
            hse_score: score,
            capa_closure_rate: capa,
          };
      const { error } = await supabase.from("nominations").update(payload).eq("id", nomination.id);
      if (error) throw error;
      return payload.status;
    },
    onSuccess: (status) => {
      queryClient.invalidateQueries({ queryKey: ["nominations"] });
      toast.success(
        status === "Disqualified"
          ? "Nomination disqualified."
          : "Nomination approved for HOD evaluation.",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const askVerify = (nomination: Nomination, draft: Draft) => {
    const nominee = employeeById.get(nomination.nominee_id ?? "")?.full_name ?? "this nominee";
    const isDisqualify = draft.recordable_injury || (draft.capa_closure_rate !== "" && Number(draft.capa_closure_rate) < 95);
    setConfirm({
      open: true,
      title: isDisqualify ? "Disqualify nomination?" : "Approve for HOD review?",
      description: isDisqualify
        ? `This will permanently disqualify ${nominee}'s nomination. This action can be undone by resetting the nomination.`
        : `This will move ${nominee}'s nomination to the HOD evaluation queue with HSE score ${draft.hse_score} and CAPA ${draft.capa_closure_rate || "N/A"}%.`,
      confirmLabel: isDisqualify ? "Yes, disqualify" : "Yes, approve",
      variant: isDisqualify ? "destructive" : "default",
      onConfirm: () => verify.mutate({ nomination, draft }),
    });
  };

  const exportRegister = () => {
    setConfirm({
      open: true,
      title: "Export award register?",
      description: `This will download an Excel-compatible CSV of all ${nominations.length} nominations including scores, HOD ratings and statuses.`,
      confirmLabel: "Export CSV",
      variant: "default",
      onConfirm: () => {
        // Build a vote-count map: nominee_id → number of nominations
        const voteCount = new Map<string, number>();
        for (const n of nominations) {
          if (n.nominee_id) voteCount.set(n.nominee_id, (voteCount.get(n.nominee_id) ?? 0) + 1);
        }

        const rows: ExportRow[] = nominations.map((n) => {
          const emp = employeeById.get(n.nominee_id ?? "");
          const dept = deptById.get(n.nominee_department_id ?? "");
          const hod = hodPoints(n);
          const total = totalScore(n);
          // Format ISO timestamp to readable local date
          const submittedAt = n.created_at
            ? new Date(n.created_at).toLocaleString("en-GB", {
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })
            : "";
          return {
            "Nominee Name": emp?.full_name ?? n.voter_name,
            Department: dept?.name ?? "—",
            "Position / Title": n.nominee_position_title ?? emp?.position_title ?? "—",
            "Leadership Tier": emp?.leadership_tier ?? "—",
            Batch: dept?.batch_category ?? "—",
            "Submitted By (Voter)": n.voter_name,
            "Award Categories": n.award_categories.join(" | "),
            Status: n.status,
            "HSE Score (/100)": n.hse_score ?? "",
            "CAPA Closure Rate (%)": n.capa_closure_rate ?? "",
            "Recordable Injury": n.recordable_injury ? "Yes" : "No",
            "HOD \u2013 Duty of Care (/5)": n.hod_duty_of_care ?? "",
            "HOD \u2013 Safe Work Behavior (/5)": n.hod_safe_work_behavior ?? "",
            "HOD \u2013 Hazard Awareness (/5)": n.hod_hazard_awareness ?? "",
            "HOD \u2013 Speaking Up (/5)": n.hod_speaking_up ?? "",
            "HOD \u2013 Safety Participation (/5)": n.hod_participation ?? "",
            "HOD Total (/30)": hod ?? "",
            "Total Score (70/30)": total ?? "",
            "Disqualification Reason": n.disqualification_reason ?? "",
            "Citation Note": n.citation_note ?? "",
            "Vote Count": voteCount.get(n.nominee_id ?? "") ?? 0,
            "Submitted At": submittedAt,
          };
        });

        const blob = toExcelCsv(rows);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `WTP-OHSE-Award-Register-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(`Award register exported — ${rows.length} nomination${rows.length !== 1 ? "s" : ""}.`);
      },
    });
  };

  return (
    <PinGate pinField="admin_pin">
      <AppShell>
        <ConfirmDialog state={confirm} onClose={() => setConfirm(CONFIRM_CLOSED)} />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Admin Console</p>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Safety Admin &amp; Management
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Manage nominations, employees, departments and program settings.
            </p>
          </div>
          <Button variant="outline" onClick={exportRegister} disabled={nominations.length === 0}>
            <Download className="size-4" />
            Export register
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <SummaryCard icon={ShieldCheck} label="Awaiting verification" value={pending.length} tone="warning" />
          <SummaryCard icon={CheckCircle2} label="Cleared to HOD" value={verified.length} tone="success" />
          <SummaryCard icon={Trophy} label="Completed" value={nominations.filter((n) => n.status === "Completed").length} tone="primary" />
          <SummaryCard icon={AlertOctagon} label="Disqualified" value={disqualified.length} tone="destructive" />
        </div>

        <Tabs defaultValue="hse" className="mt-8">
          <TabsList className="mb-6 flex h-auto flex-wrap gap-1 bg-secondary p-1">
            <TabsTrigger value="hse" className="gap-2"><ShieldCheck className="size-4" />HSE Verification</TabsTrigger>
            <TabsTrigger value="nominations" className="gap-2"><Trophy className="size-4" />Nominations</TabsTrigger>
            <TabsTrigger value="employees" className="gap-2"><Users className="size-4" />Employees</TabsTrigger>
            <TabsTrigger value="departments" className="gap-2"><Building2 className="size-4" />Departments</TabsTrigger>
            <TabsTrigger value="settings" className="gap-2"><Settings className="size-4" />Program Settings</TabsTrigger>
            <TabsTrigger value="help" className="relative gap-2">
              <LifeBuoy className="size-4" />Help Reports
              {supportRequests.length > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                  {supportRequests.length > 9 ? "9+" : supportRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── HSE Verification ── */}
          <TabsContent value="hse">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading nominations…</p>
            ) : pending.length === 0 ? (
              <p className="surface p-6 text-sm text-muted-foreground">
                The queue is clear — every nomination has passed through the HSE gate.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {pending.map((n) => {
                  const draft = draftFor(n);
                  const nominee = employeeById.get(n.nominee_id ?? "");
                  return (
                    <div key={n.id} className="surface p-5">
                      <div className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 font-display text-xs font-bold text-primary">
                          {initials(nominee?.full_name ?? n.voter_name)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-display text-sm font-bold">{nominee?.full_name ?? "Unnamed nominee"}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {n.nominee_position_title ?? nominee?.position_title} &middot;{" "}
                            {deptById.get(n.nominee_department_id ?? "")?.name ?? "—"}
                          </p>
                        </div>
                        <StatusPill status={n.status} className="ml-auto" />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {n.award_categories.map((c) => (
                          <span key={c} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{c}</span>
                        ))}
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`hse-${n.id}`}>HSE score (0–100)</Label>
                          <Input id={`hse-${n.id}`} inputMode="decimal" placeholder="0–100" value={draft.hse_score} disabled={draft.recordable_injury} onChange={(e) => setDraft(n.id, { hse_score: e.target.value }, draft)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`capa-${n.id}`}>CAPA closure rate (%)</Label>
                          <Input id={`capa-${n.id}`} inputMode="decimal" placeholder="e.g. 92" value={draft.capa_closure_rate} onChange={(e) => setDraft(n.id, { capa_closure_rate: e.target.value }, draft)} />
                        </div>
                      </div>
                      <div className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                        <div>
                          <p className="text-sm font-semibold">Recordable injury in window</p>
                          <p className="text-xs text-muted-foreground">Turning this on disqualifies the nomination immediately.</p>
                        </div>
                        <Switch checked={draft.recordable_injury} onCheckedChange={(v) => setDraft(n.id, { recordable_injury: v }, draft)} />
                      </div>
                      {draft.recordable_injury && (
                        <div className="mt-3 space-y-1.5">
                          <Label htmlFor={`reason-${n.id}`}>Disqualification reason</Label>
                          <Textarea id={`reason-${n.id}`} rows={2} placeholder="Reference the incident record and date." value={draft.disqualification_reason} onChange={(e) => setDraft(n.id, { disqualification_reason: e.target.value }, draft)} />
                        </div>
                      )}
                      <Button
                        className="mt-4 w-full"
                        variant={draft.recordable_injury ? "destructive" : "default"}
                        disabled={verify.isPending}
                        onClick={() => askVerify(n, draft)}
                      >
                        {draft.recordable_injury ? "Disqualify nomination" : "Approve for HOD review"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Nominations register ── */}
          <TabsContent value="nominations">
            <NominationsTab
              nominations={filteredNominations}
              allNominations={nominations}
              tableSearch={tableSearch}
              setTableSearch={setTableSearch}
              employeeById={employeeById}
              deptById={deptById}
              queryClient={queryClient}
            />
          </TabsContent>

          {/* ── Employees ── */}
          <TabsContent value="employees">
            <EmployeesTab employees={employees} departments={departments} queryClient={queryClient} />
          </TabsContent>

          {/* ── Departments ── */}
          <TabsContent value="departments">
            <DepartmentsTab departments={departments} queryClient={queryClient} />
          </TabsContent>

          {/* ── Program Settings ── */}
          <TabsContent value="settings">
            <SettingsTab settings={settings} queryClient={queryClient} />
          </TabsContent>

          {/* ── Help Reports ── */}
          <TabsContent value="help">
            <HelpReportsTab requests={supportRequests} queryClient={queryClient} />
          </TabsContent>
        </Tabs>
      </AppShell>
    </PinGate>
  );
}

// ── Nominations Tab ──────────────────────────────────────────────────────────
type NomForm = {
  voter_name: string;
  nominee_id: string;
  award_categories: string[];
};
const EMPTY_NOM: NomForm = { voter_name: "", nominee_id: "", award_categories: [] };

function NominationsTab({
  nominations, allNominations, tableSearch, setTableSearch, employeeById, deptById, queryClient,
}: {
  nominations: Nomination[];
  allNominations: Nomination[];
  tableSearch: string;
  setTableSearch: (v: string) => void;
  employeeById: Map<string, Employee>;
  deptById: Map<string, Department>;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [confirm, setConfirm] = useState<ConfirmState>(CONFIRM_CLOSED);
  const [addOpen, setAddOpen] = useState(false);
  const [nomForm, setNomForm] = useState<NomForm>(EMPTY_NOM);
  const [empSearch, setEmpSearch] = useState("");

  const allEmployees = useMemo(() => [...employeeById.values()].sort((a, b) => a.full_name.localeCompare(b.full_name)), [employeeById]);
  const filteredEmps = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    if (!q) return allEmployees;
    return allEmployees.filter((e) => e.full_name.toLowerCase().includes(q) || e.position_title.toLowerCase().includes(q));
  }, [allEmployees, empSearch]);

  const selectedEmployee = employeeById.get(nomForm.nominee_id);

  const addNomination = useMutation({
    mutationFn: async () => {
      if (!nomForm.voter_name.trim()) throw new Error("Enter the voter name.");
      if (!nomForm.nominee_id) throw new Error("Select a nominee.");
      if (nomForm.award_categories.length === 0) throw new Error("Select at least one award category.");
      const emp = employeeById.get(nomForm.nominee_id);
      if (!emp) throw new Error("Employee not found.");
      const dept = deptById.get(emp.department_id);
      const action = dept?.batch_category === "Batch II" ? "Check Batch II" : "Check Batch I";
      const { error } = await supabase.from("nominations").insert({
        voter_name: nomForm.voter_name.trim(),
        action_type: action,
        voter_department_id: emp.department_id,
        nominee_id: emp.id,
        nominee_department_id: emp.department_id,
        nominee_position_title: emp.position_title,
        award_categories: nomForm.award_categories,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nominations"] });
      toast.success("Nomination added successfully.");
      setAddOpen(false);
      setNomForm(EMPTY_NOM);
      setEmpSearch("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const askAdd = () => {
    const name = selectedEmployee?.full_name ?? "this employee";
    setConfirm({
      open: true,
      title: "Add nomination?",
      description: `${name} will be added as a nominee with ${nomForm.award_categories.length} award categor${nomForm.award_categories.length === 1 ? "y" : "ies"} and enter the HSE verification queue.`,
      confirmLabel: "Yes, add nomination",
      variant: "default",
      onConfirm: () => addNomination.mutate(),
    });
  };

  const del = useMutation({
    mutationFn: deleteNomination,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["nominations"] }); toast.success("Nomination deleted."); },
    onError: () => toast.error("Could not delete nomination."),
  });

  const reset = useMutation({
    mutationFn: resetNominationStatus,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["nominations"] }); toast.success("Nomination reset to Pending HSE Verification."); },
    onError: () => toast.error("Could not reset nomination."),
  });

  const askReset = (n: Nomination) => {
    const name = employeeById.get(n.nominee_id ?? "")?.full_name ?? "this nominee";
    setConfirm({
      open: true,
      title: "Reset nomination?",
      description: `This will clear all HSE scores, HOD ratings and reset ${name}'s nomination back to "Pending HSE Verification". This cannot be undone.`,
      confirmLabel: "Yes, reset",
      variant: "warning",
      onConfirm: () => reset.mutate(n.id),
    });
  };

  const askDelete = (n: Nomination) => {
    const name = employeeById.get(n.nominee_id ?? "")?.full_name ?? "this nominee";
    setConfirm({
      open: true,
      title: "Delete nomination permanently?",
      description: `${name}'s nomination will be permanently removed from the system. This cannot be undone.`,
      confirmLabel: "Yes, delete",
      variant: "destructive",
      onConfirm: () => del.mutate(n.id),
    });
  };

  const canSubmit = nomForm.voter_name.trim().length > 1 && !!nomForm.nominee_id && nomForm.award_categories.length > 0;

  return (
    <div>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(CONFIRM_CLOSED)} />

      {/* Add Nomination Dialog */}
      <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) { setNomForm(EMPTY_NOM); setEmpSearch(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Nomination</DialogTitle>
            <DialogDescription>Select an existing employee from the system and assign award categories.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Submitted by (voter name)</Label>
              <Input value={nomForm.voter_name} maxLength={120} onChange={(e) => setNomForm((f) => ({ ...f, voter_name: e.target.value }))} placeholder="e.g. Dennis Yeboah" />
            </div>
            <div className="space-y-1.5">
              <Label>Search & select nominee</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={empSearch} onChange={(e) => { setEmpSearch(e.target.value); setNomForm((f) => ({ ...f, nominee_id: "", award_categories: [] })); }} placeholder="Type name or position…" className="pl-9" />
              </div>
              <div className="max-h-44 overflow-y-auto rounded-xl border border-border bg-card shadow-sm">
                {filteredEmps.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">No employees match.</p>
                ) : (
                  filteredEmps.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => { setNomForm((f) => ({ ...f, nominee_id: e.id, award_categories: [] })); setEmpSearch(e.full_name); }}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 border-b border-border/50 px-4 py-2.5 text-left text-sm last:border-0 transition-colors hover:bg-secondary",
                        nomForm.nominee_id === e.id && "bg-accent/8 font-semibold",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{initials(e.full_name)}</span>
                        <span>{e.full_name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{e.position_title}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          e.leadership_tier === "Lead" ? "bg-accent/15 text-accent"
                          : e.leadership_tier === "Coordinator" ? "bg-primary/10 text-primary"
                          : "bg-secondary text-muted-foreground"
                        )}>{e.leadership_tier}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {selectedEmployee && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/6 p-3">
                <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground">{selectedEmployee.full_name}</span>
                <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold">{selectedEmployee.position_title}</span>
                <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-bold text-accent-foreground">{selectedEmployee.leadership_tier}</span>
                <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold">{deptById.get(selectedEmployee.department_id)?.name ?? "—"}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label>Award categories</Label>
              {!selectedEmployee ? (
                <p className="text-xs text-muted-foreground">Select a nominee above to unlock categories.</p>
              ) : (
                AWARD_CATEGORIES.map((cat) => {
                  const reason = tierDisabledReason(selectedEmployee.leadership_tier, cat.tier);
                  const disabled = reason !== null;
                  const checked = nomForm.award_categories.includes(cat.label);
                  return (
                    <label key={cat.label} title={reason ?? undefined} className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-all",
                      disabled ? "cursor-not-allowed border-border/50 bg-secondary/40 opacity-50"
                      : checked ? "border-accent bg-accent/8 ring-1 ring-accent/20"
                      : "border-border hover:border-accent/30 hover:bg-secondary/60",
                    )}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(e) => setNomForm((f) => ({
                          ...f,
                          award_categories: e.target.checked
                            ? [...f.award_categories, cat.label]
                            : f.award_categories.filter((c) => c !== cat.label),
                        }))}
                        className="mt-0.5 accent-orange-500"
                      />
                      <span>
                        <span className="font-semibold">{cat.label}</span>
                        {reason && <span className="mt-0.5 block text-[11px] text-muted-foreground">{reason}</span>}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button disabled={!canSubmit || addNomination.isPending} onClick={askAdd}>
              {addNomination.isPending ? "Adding…" : "Add nomination"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">All nominations ({allNominations.length})</h2>
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder="Search nominee, dept, voter, status…" className="pl-9" />
          </div>
          <Button onClick={() => setAddOpen(true)} className="shrink-0 gap-2">
            <Plus className="size-4" /> Add nomination
          </Button>
        </div>
      </div>
      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Nominee</th>
              <th className="px-4 py-3 font-semibold">Section</th>
              <th className="px-4 py-3 font-semibold">Voter</th>
              <th className="px-4 py-3 font-semibold">Votes</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">HSE</th>
              <th className="px-4 py-3 font-semibold">CAPA%</th>
              <th className="px-4 py-3 font-semibold">HOD</th>
              <th className="px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {nominations.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-6 text-sm text-muted-foreground">{tableSearch ? "No nominations match your search." : "No nominations submitted yet."}</td></tr>
            ) : (
              nominations.map((n) => (
                <tr key={n.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-semibold">{employeeById.get(n.nominee_id ?? "")?.full_name ?? n.voter_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{deptById.get(n.nominee_department_id ?? "")?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{n.voter_name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-2.5 py-0.5 text-[11px] font-bold text-accent">
                      {allNominations.filter((x) => x.nominee_id === n.nominee_id).length}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusPill status={n.status} /></td>
                  <td className="px-4 py-3">{n.hse_score ?? "—"}</td>
                  <td className={cn("px-4 py-3", n.capa_closure_rate !== null && n.capa_closure_rate < 95 ? "font-bold text-destructive" : "")}>
                    {n.capa_closure_rate !== null ? `${n.capa_closure_rate}%` : "—"}
                  </td>
                  <td className="px-4 py-3">{hodPoints(n) ?? "—"}</td>
                  <td className={cn("px-4 py-3 font-display font-bold", totalScore(n) === null ? "text-muted-foreground" : "text-primary")}>
                    {totalScore(n) ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" title="Reset to Pending" disabled={reset.isPending} onClick={() => askReset(n)}>
                        <RotateCcw className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" title="Delete nomination" disabled={del.isPending} onClick={() => askDelete(n)}>
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Employees Tab ────────────────────────────────────────────────────────────
function EmployeesTab({
  employees, departments, queryClient,
}: {
  employees: Employee[];
  departments: Department[];
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_EMP);
  const [confirm, setConfirm] = useState<ConfirmState>(CONFIRM_CLOSED);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) => e.full_name.toLowerCase().includes(q) || e.position_title.toLowerCase().includes(q),
    );
  }, [employees, search]);

  const deptById = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);

  const save = useMutation({
    mutationFn: () =>
      upsertEmployee({
        id: form.id,
        full_name: form.full_name.trim(),
        position_title: form.position_title.trim(),
        leadership_tier: form.leadership_tier,
        department_id: form.department_id,
        email: form.email.trim() || null,
        mobile_contact: form.mobile_contact.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(form.id ? "Employee updated." : "Employee added.");
      setOpen(false);
      setForm(EMPTY_EMP);
    },
    onError: () => toast.error("Could not save employee."),
  });

  const del = useMutation({
    mutationFn: deleteEmployee,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["employees"] }); toast.success("Employee deleted."); },
    onError: () => toast.error("Could not delete employee."),
  });

  const openEdit = (e: Employee) => {
    setForm({
      id: e.id, full_name: e.full_name, position_title: e.position_title,
      leadership_tier: e.leadership_tier, department_id: e.department_id,
      email: e.email ?? "", mobile_contact: e.mobile_contact ?? "",
    });
    setOpen(true);
  };

  const askSave = () => {
    const isEdit = !!form.id;
    setConfirm({
      open: true,
      title: isEdit ? "Save employee changes?" : "Add new employee?",
      description: isEdit
        ? `This will update ${form.full_name.trim()}'s profile. Any nominations linked to this employee will reflect the changes.`
        : `${form.full_name.trim()} will be added to the system and become available for nominations.`,
      confirmLabel: isEdit ? "Save changes" : "Add employee",
      variant: "default",
      onConfirm: () => save.mutate(),
    });
  };

  const askDelete = (e: Employee) => {
    setConfirm({
      open: true,
      title: "Delete employee?",
      description: `${e.full_name} will be permanently removed. Any nominations linked to them will lose the nominee reference.`,
      confirmLabel: "Yes, delete",
      variant: "destructive",
      onConfirm: () => del.mutate(e.id),
    });
  };

  const canSave = form.full_name.trim().length > 1 && form.position_title.trim().length > 0 && !!form.department_id;

  return (
    <div>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(CONFIRM_CLOSED)} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Employees ({employees.length})</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or title…" className="pl-9 w-56" />
          </div>
          <Button onClick={() => { setForm(EMPTY_EMP); setOpen(true); }} className="gap-2">
            <Plus className="size-4" /> Add employee
          </Button>
        </div>
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Position</th>
              <th className="px-4 py-3 font-semibold">Tier</th>
              <th className="px-4 py-3 font-semibold">Department</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">Nominee</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-sm text-muted-foreground">No employees found.</td></tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{initials(e.full_name)}</span>
                      {e.full_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.position_title}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      e.leadership_tier === "Lead" ? "bg-accent/15 text-accent"
                      : e.leadership_tier === "Coordinator" ? "bg-primary/10 text-primary"
                      : "bg-secondary text-muted-foreground"
                    )}>{e.leadership_tier}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{deptById.get(e.department_id)?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{e.email ?? e.mobile_contact ?? "—"}</td>
                  <td className="px-4 py-3">
                    <NomineeToggle employee={e} queryClient={queryClient} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(e)}><Pencil className="size-3.5" /></Button>
                      <Button size="sm" variant="ghost" disabled={del.isPending} onClick={() => askDelete(e)}>
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(EMPTY_EMP); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit employee" : "Add employee"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={form.full_name} maxLength={120} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="e.g. Seth K. Sarfoh" />
            </div>
            <div className="space-y-1.5">
              <Label>Position title</Label>
              <select value={form.position_title} onChange={(e) => setForm((f) => ({ ...f, position_title: e.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Select position…</option>
                {POSITION_TITLES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Leadership tier</Label>
              <select value={form.leadership_tier} onChange={(e) => setForm((f) => ({ ...f, leadership_tier: e.target.value as EmployeeForm["leadership_tier"] }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="Lead">Lead</option>
                <option value="Coordinator">Coordinator</option>
                <option value="Non-Leadership">Non-Leadership</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <select value={form.department_id} onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Select department…</option>
                {[...departments].sort((a, b) => a.name.localeCompare(b.name)).map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.batch_category})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email (optional)</Label>
                <Input value={form.email} maxLength={120} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@wtp.example" />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile (optional)</Label>
                <Input value={form.mobile_contact} maxLength={30} onChange={(e) => setForm((f) => ({ ...f, mobile_contact: e.target.value }))} inputMode="tel" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!canSave || save.isPending} onClick={askSave}>
              {save.isPending ? "Saving…" : form.id ? "Save changes" : "Add employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Nominee Toggle ─────────────────────────────────────────────────────────
function NomineeToggle({ employee, queryClient }: { employee: Employee; queryClient: ReturnType<typeof useQueryClient> }) {
  const [confirm, setConfirm] = useState<ConfirmState>(CONFIRM_CLOSED);

  const toggle = useMutation({
    mutationFn: (val: boolean) => toggleNomineeStatus(employee.id, val),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
    onError: () => toast.error("Could not update nominee status."),
  });

  const ask = (val: boolean) => {
    setConfirm({
      open: true,
      title: val ? "Mark as nominee?" : "Remove from nominees?",
      description: val
        ? `${employee.full_name} will appear in the nomination form for voters to select.`
        : `${employee.full_name} will no longer be selectable by voters on the nomination form.`,
      confirmLabel: val ? "Yes, mark as nominee" : "Yes, remove",
      variant: val ? "default" : "warning",
      onConfirm: () => toggle.mutate(val),
    });
  };

  return (
    <>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(CONFIRM_CLOSED)} />
      <button
        type="button"
        disabled={toggle.isPending}
        onClick={() => ask(!employee.is_nominee)}
        title={employee.is_nominee ? "Click to remove from nominees" : "Click to mark as nominee"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
          employee.is_nominee
            ? "border-success/40 bg-success/12 text-success hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            : "border-border bg-secondary text-muted-foreground hover:border-success/40 hover:bg-success/10 hover:text-success",
        )}
      >
        <span className={cn("size-1.5 rounded-full", employee.is_nominee ? "bg-success" : "bg-muted-foreground")} />
        {employee.is_nominee ? "Nominee" : "Not a nominee"}
      </button>
    </>
  );
}

// ── Departments Tab ──────────────────────────────────────────────────────────
function DepartmentsTab({
  departments, queryClient,
}: {
  departments: Department[];
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DeptForm>(EMPTY_DEPT);
  const [confirm, setConfirm] = useState<ConfirmState>(CONFIRM_CLOSED);

  const save = useMutation({
    mutationFn: () =>
      upsertDepartment({ id: form.id, name: form.name.trim(), batch_category: form.batch_category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success(form.id ? "Department updated." : "Department added.");
      setOpen(false);
      setForm(EMPTY_DEPT);
    },
    onError: () => toast.error("Could not save department."),
  });

  const del = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["departments"] }); toast.success("Department deleted."); },
    onError: () => toast.error("Could not delete department. It may have employees assigned."),
  });

  const openEdit = (d: Department) => {
    setForm({ id: d.id, name: d.name, batch_category: d.batch_category });
    setOpen(true);
  };

  const askSave = () => {
    const isEdit = !!form.id;
    setConfirm({
      open: true,
      title: isEdit ? "Save department changes?" : "Add new department?",
      description: isEdit
        ? `"${form.name.trim()}" will be updated. Employees and nominations linked to it will be unaffected.`
        : `"${form.name.trim()}" will be added as a ${form.batch_category} department.`,
      confirmLabel: isEdit ? "Save changes" : "Add department",
      variant: "default",
      onConfirm: () => save.mutate(),
    });
  };

  const askDelete = (d: Department) => {
    setConfirm({
      open: true,
      title: "Delete department?",
      description: `"${d.name}" will be permanently deleted. This will fail if any employees are still assigned to it.`,
      confirmLabel: "Yes, delete",
      variant: "destructive",
      onConfirm: () => del.mutate(d.id),
    });
  };

  return (
    <div>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(CONFIRM_CLOSED)} />
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Departments ({departments.length})</h2>
        <Button onClick={() => { setForm(EMPTY_DEPT); setOpen(true); }} className="gap-2">
          <Plus className="size-4" /> Add department
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((d) => (
          <div key={d.id} className="surface flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold">{d.name}</p>
              <span className={cn("mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                d.batch_category === "Batch I" ? "bg-primary/10 text-primary" : "bg-accent/15 text-accent"
              )}>{d.batch_category}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => openEdit(d)}><Pencil className="size-3.5" /></Button>
              <Button size="sm" variant="ghost" disabled={del.isPending} onClick={() => askDelete(d)}>
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(EMPTY_DEPT); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit department" : "Add department"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Department name</Label>
              <Input value={form.name} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. AWTP" />
            </div>
            <div className="space-y-1.5">
              <Label>Batch category</Label>
              <select value={form.batch_category} onChange={(e) => setForm((f) => ({ ...f, batch_category: e.target.value as DeptForm["batch_category"] }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="Batch I">Batch I</option>
                <option value="Batch II">Batch II</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!form.name.trim() || save.isPending} onClick={askSave}>
              {save.isPending ? "Saving…" : form.id ? "Save changes" : "Add department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Program Settings Tab ─────────────────────────────────────────────────────
function SettingsTab({
  settings, queryClient,
}: {
  settings: { id: string; voting_closes_at: string; maturity_stage: string; admin_pin: string; hod_pin: string } | null | undefined;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [form, setForm] = useState<{
    voting_closes_at: string;
    maturity_stage: string;
    admin_pin: string;
    hod_pin: string;
  } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(CONFIRM_CLOSED);

  if (settings && !form) {
    const local = new Date(settings.voting_closes_at).toISOString().slice(0, 16);
    setForm({ voting_closes_at: local, maturity_stage: settings.maturity_stage, admin_pin: settings.admin_pin, hod_pin: settings.hod_pin });
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!settings || !form) throw new Error("Settings not loaded.");
      if (!form.admin_pin.trim() || !form.hod_pin.trim()) throw new Error("PINs cannot be empty.");
      await updateProgramSettings({
        id: settings.id,
        voting_closes_at: new Date(form.voting_closes_at).toISOString(),
        maturity_stage: form.maturity_stage,
        admin_pin: form.admin_pin.trim(),
        hod_pin: form.hod_pin.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program_settings"] });
      sessionStorage.removeItem("wtp_admin_unlocked");
      sessionStorage.removeItem("wtp_hod_unlocked");
      toast.success("Settings saved. Re-enter PINs on next visit.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const askSave = () => {
    if (!form) return;
    const pinChanged = settings && (form.admin_pin.trim() !== settings.admin_pin || form.hod_pin.trim() !== settings.hod_pin);
    setConfirm({
      open: true,
      title: "Save program settings?",
      description: pinChanged
        ? "You have changed one or more PINs. All active sessions will be invalidated immediately — everyone will need to re-enter the new PIN."
        : "The voting window and maturity stage will be updated across the platform immediately.",
      confirmLabel: "Save settings",
      variant: pinChanged ? "warning" : "default",
      onConfirm: () => save.mutate(),
    });
  };

  if (!settings || !form) return <p className="text-sm text-muted-foreground">Loading settings…</p>;

  return (
    <div className="max-w-lg space-y-6">
      <ConfirmDialog state={confirm} onClose={() => setConfirm(CONFIRM_CLOSED)} />
      <h2 className="font-display text-lg font-bold">Program Settings</h2>
      <div className="surface space-y-5 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="closes-at">Voting window closes at</Label>
          <Input id="closes-at" type="datetime-local" value={form.voting_closes_at} onChange={(e) => setForm((f) => f && ({ ...f, voting_closes_at: e.target.value }))} />
          <p className="text-[11px] text-muted-foreground">Controls the countdown timer shown in the header.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Safety Culture Maturity Stage</Label>
          <select value={form.maturity_stage} onChange={(e) => setForm((f) => f && ({ ...f, maturity_stage: e.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            {MATURITY_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <p className="text-[11px] text-muted-foreground">Sets the current position on the Safety Culture Journey bar.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-pin">Admin PIN</Label>
            <Input id="admin-pin" value={form.admin_pin} maxLength={40} onChange={(e) => setForm((f) => f && ({ ...f, admin_pin: e.target.value }))} placeholder="OHSE-ADMIN" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hod-pin">HOD Review PIN</Label>
            <Input id="hod-pin" value={form.hod_pin} maxLength={40} onChange={(e) => setForm((f) => f && ({ ...f, hod_pin: e.target.value }))} placeholder="OHSE-HOD" />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Changing a PIN invalidates all active sessions immediately.
        </p>
      </div>
      <Button disabled={save.isPending} onClick={askSave} className="gap-2">
        {save.isPending ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}

// ── Help Reports Tab ─────────────────────────────────────────────────────
type SupportRequest = {
  id: string;
  employee_name: string;
  mobile_contact: string;
  note: string | null;
  created_at: string;
};

function HelpReportsTab({
  requests, queryClient,
}: {
  requests: SupportRequest[];
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState>(CONFIRM_CLOSED);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter(
      (r) =>
        r.employee_name.toLowerCase().includes(q) ||
        r.mobile_contact.toLowerCase().includes(q) ||
        (r.note ?? "").toLowerCase().includes(q),
    );
  }, [requests, search]);

  const del = useMutation({
    mutationFn: deleteSupportRequest,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["support_requests"] }); toast.success("Help request dismissed."); },
    onError: () => toast.error("Could not dismiss request."),
  });

  const askDelete = (r: SupportRequest) => {
    setConfirm({
      open: true,
      title: "Dismiss help request?",
      description: `This will permanently remove ${r.employee_name}'s help request. Only do this once you have followed up with them.`,
      confirmLabel: "Yes, dismiss",
      variant: "warning",
      onConfirm: () => del.mutate(r.id),
    });
  };

  return (
    <div>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(CONFIRM_CLOSED)} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Help Reports</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Submitted via the Help button on the nomination form. Follow up and dismiss once resolved.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, mobile, note…"
            className="pl-9"
          />
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="surface flex flex-col items-center gap-3 py-12 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-success/12">
            <LifeBuoy className="size-7 text-success" />
          </span>
          <p className="font-display text-base font-semibold">No help requests</p>
          <p className="text-sm text-muted-foreground">All clear — no employees have submitted support requests.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <div key={r.id} className="surface flex flex-col gap-3 p-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-warning/15">
                    <LifeBuoy className="size-4 text-warning" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-bold">{r.employee_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Dismiss request"
                  disabled={del.isPending}
                  onClick={() => askDelete(r)}
                  className="shrink-0"
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>

              {/* Mobile contact */}
              <a
                href={`tel:${r.mobile_contact}`}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                <span className="text-muted-foreground">📞</span>
                {r.mobile_contact}
              </a>

              {/* Note */}
              {r.note ? (
                <p className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                  "{r.note}"
                </p>
              ) : (
                <p className="text-xs italic text-muted-foreground/50">No additional note provided.</p>
              )}
            </div>
          ))}
          {filtered.length === 0 && search && (
            <p className="col-span-full py-6 text-center text-sm text-muted-foreground">No requests match your search.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared SummaryCard ───────────────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, value, tone }: {
  icon: typeof ShieldCheck;
  label: string;
  value: number;
  tone: "warning" | "success" | "destructive" | "primary";
}) {
  const tones = {
    warning: "bg-warning/15 text-warning",
    success: "bg-success/15 text-success",
    destructive: "bg-destructive/15 text-destructive",
    primary: "bg-primary/10 text-primary",
  } as const;
  return (
    <div className="surface flex items-center gap-4 p-5">
      <span className={cn("grid size-11 place-items-center rounded-lg", tones[tone])}>
        <Icon className="size-5" />
      </span>
      <div>
        <p className="font-display text-2xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
