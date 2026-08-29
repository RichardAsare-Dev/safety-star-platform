import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertOctagon, CheckCircle2, Download, ShieldCheck, Trophy } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  useDepartments,
  useEmployees,
  useNominations,
  useNominationsRealtime,
} from "@/lib/data";
import { hodPoints, initials, toCsv, totalScore, type Nomination } from "@/lib/ohse";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Safety Admin & HSE Verification Gate | WTP OHSE Awards" },
      {
        name: "description",
        content:
          "HSE verification console for WTP OHSE awards: record HSE scores, CAPA closure rates, recordable-injury disqualifications and export the full award register.",
      },
      { property: "og:title", content: "Safety Admin & HSE Verification Gate | WTP OHSE Awards" },
      {
        property: "og:description",
        content:
          "Verify nominations against objective HSE evidence, disqualify on recordable injuries and publish final weighted award scores.",
      },
    ],
  }),
  component: AdminPage,
});

type Draft = {
  hse_score: string;
  capa_closure_rate: string;
  recordable_injury: boolean;
  disqualification_reason: string;
};

function AdminPage() {
  useNominationsRealtime();
  const queryClient = useQueryClient();
  const { data: nominations = [], isLoading } = useNominations();
  const { data: employees = [] } = useEmployees();
  const { data: departments = [] } = useDepartments();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const employeeById = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees],
  );
  const deptById = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);

  const pending = nominations.filter(
    (n) => n.status === "Pending HSE Verification" && n.action_type !== "Request Support",
  );
  const verified = nominations.filter(
    (n) => n.status === "Approved for HOD Evaluation" || n.status === "Completed",
  );
  const disqualified = nominations.filter((n) => n.status === "Disqualified");

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
      const score = Number(draft.hse_score);
      const capa = draft.capa_closure_rate === "" ? null : Number(draft.capa_closure_rate);

      if (!draft.recordable_injury) {
        if (!draft.hse_score || Number.isNaN(score) || score < 0 || score > 100) {
          throw new Error("Enter an HSE score between 0 and 100.");
        }
        if (capa !== null && (Number.isNaN(capa) || capa < 0 || capa > 100)) {
          throw new Error("CAPA closure rate must be between 0 and 100.");
        }
      }

      const payload = draft.recordable_injury
        ? {
            status: "Disqualified" as const,
            recordable_injury: true,
            disqualification_reason:
              draft.disqualification_reason.trim() ||
              "Recordable injury recorded within the evaluation window.",
            hse_score: null,
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
          ? "Nomination disqualified — recordable injury gate applied."
          : "Nomination approved for HOD evaluation.",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const exportRegister = () => {
    const rows = nominations.map((n) => ({
      nominee: employeeById.get(n.nominee_id ?? "")?.full_name ?? "",
      department: deptById.get(n.nominee_department_id ?? "")?.name ?? "",
      position: n.nominee_position_title ?? "",
      voter: n.voter_name,
      action: n.action_type,
      status: n.status,
      award_categories: n.award_categories.join(" | "),
      hse_score: n.hse_score ?? "",
      capa_closure_rate: n.capa_closure_rate ?? "",
      recordable_injury: n.recordable_injury ? "Yes" : "No",
      hod_points: hodPoints(n) ?? "",
      total_score: totalScore(n) ?? "",
      disqualification_reason: n.disqualification_reason ?? "",
      submitted_at: n.created_at,
    }));
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `wtp-ohse-award-register-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Award register exported.");
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Engine 1 &middot; Objective gate (70%)</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Safety Admin &amp; HSE Verification
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Validate each nomination against objective HSE evidence. Any recordable injury inside
            the evaluation window disqualifies the nominee automatically.
          </p>
        </div>
        <Button variant="outline" onClick={exportRegister} disabled={nominations.length === 0}>
          <Download className="size-4" />
          Export register
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={ShieldCheck}
          label="Awaiting verification"
          value={pending.length}
          tone="warning"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Cleared to HOD"
          value={verified.length}
          tone="success"
        />
        <SummaryCard
          icon={AlertOctagon}
          label="Disqualified"
          value={disqualified.length}
          tone="destructive"
        />
      </div>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold">Verification queue</h2>
        {isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading nominations…</p>
        ) : pending.length === 0 ? (
          <p className="surface mt-4 p-6 text-sm text-muted-foreground">
            The queue is clear — every nomination has passed through the HSE gate.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
                      <p className="font-display text-sm font-bold">
                        {nominee?.full_name ?? "Unnamed nominee"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {n.nominee_position_title ?? nominee?.position_title} &middot;{" "}
                        {deptById.get(n.nominee_department_id ?? "")?.name ?? "—"}
                      </p>
                    </div>
                    <StatusPill status={n.status} className="ml-auto" />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {n.award_categories.map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                      >
                        {c}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`hse-${n.id}`}>HSE score (0–100)</Label>
                      <Input
                        id={`hse-${n.id}`}
                        inputMode="decimal"
                        placeholder="e.g. 86"
                        value={draft.hse_score}
                        disabled={draft.recordable_injury}
                        onChange={(e) => setDraft(n.id, { hse_score: e.target.value }, draft)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`capa-${n.id}`}>CAPA closure rate (%)</Label>
                      <Input
                        id={`capa-${n.id}`}
                        inputMode="decimal"
                        placeholder="e.g. 92"
                        value={draft.capa_closure_rate}
                        onChange={(e) =>
                          setDraft(n.id, { capa_closure_rate: e.target.value }, draft)
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <div>
                      <p className="text-sm font-semibold">Recordable injury in window</p>
                      <p className="text-xs text-muted-foreground">
                        Turning this on disqualifies the nomination immediately.
                      </p>
                    </div>
                    <Switch
                      checked={draft.recordable_injury}
                      onCheckedChange={(v) => setDraft(n.id, { recordable_injury: v }, draft)}
                    />
                  </div>

                  {draft.recordable_injury && (
                    <div className="mt-3 space-y-1.5">
                      <Label htmlFor={`reason-${n.id}`}>Disqualification reason</Label>
                      <Textarea
                        id={`reason-${n.id}`}
                        rows={2}
                        placeholder="Reference the incident record and date."
                        value={draft.disqualification_reason}
                        onChange={(e) =>
                          setDraft(n.id, { disqualification_reason: e.target.value }, draft)
                        }
                      />
                    </div>
                  )}

                  <Button
                    className="mt-4 w-full"
                    variant={draft.recordable_injury ? "destructive" : "default"}
                    disabled={verify.isPending}
                    onClick={() => verify.mutate({ nomination: n, draft })}
                  >
                    {draft.recordable_injury ? "Disqualify nomination" : "Approve for HOD review"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-accent" />
          <h2 className="font-display text-lg font-bold">Final award register</h2>
        </div>
        <div className="surface mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Nominee</th>
                <th className="px-4 py-3 font-semibold">Section</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">HSE</th>
                <th className="px-4 py-3 font-semibold">HOD</th>
                <th className="px-4 py-3 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {nominations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-sm text-muted-foreground">
                    No nominations submitted yet.
                  </td>
                </tr>
              ) : (
                nominations.map((n) => (
                  <tr key={n.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-semibold">
                      {employeeById.get(n.nominee_id ?? "")?.full_name ?? n.voter_name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {deptById.get(n.nominee_department_id ?? "")?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={n.status} />
                    </td>
                    <td className="px-4 py-3">{n.hse_score ?? "—"}</td>
                    <td className="px-4 py-3">{hodPoints(n) ?? "—"}</td>
                    <td
                      className={cn(
                        "px-4 py-3 font-display font-bold",
                        totalScore(n) === null ? "text-muted-foreground" : "text-primary",
                      )}
                    >
                      {totalScore(n) ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: number;
  tone: "warning" | "success" | "destructive";
}) {
  const tones = {
    warning: "bg-warning/15 text-warning",
    success: "bg-success/15 text-success",
    destructive: "bg-destructive/15 text-destructive",
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
