import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, RotateCcw, Save, ShieldCheck, Star } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { PinGate } from "@/components/PinGate";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useDepartments, useEmployees, useNominations, useNominationsRealtime } from "@/lib/data";
import { HOD_METRICS, initials, totalScore, type HodMetricKey, type Nomination } from "@/lib/ohse";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "HOD Behavioural Evaluation | WTP OHSE Awards" },
      {
        name: "description",
        content: "Heads of department rate qualified safety nominees across five behavioural metrics on a 1-5 scale to complete the 30% evaluation engine.",
      },
      { property: "og:title", content: "HOD Behavioural Evaluation | WTP OHSE Awards" },
    ],
  }),
  component: ReviewPage,
});

type ConfirmState = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant: "default" | "destructive" | "warning";
  onConfirm: () => void;
};

const CONFIRM_CLOSED: ConfirmState = {
  open: false, title: "", description: "", confirmLabel: "Confirm",
  variant: "default", onConfirm: () => {},
};

function ConfirmDialog({ state, onClose }: { state: ConfirmState; onClose: () => void }) {
  return (
    <Dialog open={state.open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className={cn(
              "grid size-10 shrink-0 place-items-center rounded-full",
              state.variant === "destructive" ? "bg-destructive/10" : state.variant === "warning" ? "bg-warning/15" : "bg-success/12",
            )}>
              {state.variant === "default"
                ? <CheckCircle2 className="size-5 text-success" />
                : <AlertTriangle className={cn("size-5", state.variant === "destructive" ? "text-destructive" : "text-warning")} />
              }
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

function ReviewPage() {
  useNominationsRealtime();
  const { data: nominations = [], isLoading } = useNominations();
  const { data: employees = [] } = useEmployees();
  const { data: departments = [] } = useDepartments();

  const queue = nominations.filter((n) => n.status === "Approved for HOD Evaluation");
  const completed = nominations.filter((n) => n.status === "Completed");

  return (
    <PinGate pinField="hod_pin">
      <AppShell>
        <div className="mb-6">
          <p className="eyebrow">Engine B — 30% weight</p>
          <h1 className="mt-1 font-display text-3xl font-bold">HOD Behavioural Evaluation</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Rate each qualified nominee from 1 to 5 across the five behavioural metrics (30 points max),
            then give your final approval to complete the nomination.
          </p>
        </div>

        {/* Summary strip */}
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="surface flex items-center gap-3 p-4">
            <span className="grid size-9 place-items-center rounded-lg bg-warning/15">
              <ClipboardCheck className="size-4 text-warning" />
            </span>
            <div>
              <p className="font-display text-xl font-bold leading-none">{queue.length}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Awaiting evaluation</p>
            </div>
          </div>
          <div className="surface flex items-center gap-3 p-4">
            <span className="grid size-9 place-items-center rounded-lg bg-success/12">
              <CheckCircle2 className="size-4 text-success" />
            </span>
            <div>
              <p className="font-display text-xl font-bold leading-none">{completed.length}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Approved & completed</p>
            </div>
          </div>
          <div className="surface flex items-center gap-3 p-4">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10">
              <ShieldCheck className="size-4 text-primary" />
            </span>
            <div>
              <p className="font-display text-xl font-bold leading-none">{nominations.length}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Total nominations</p>
            </div>
          </div>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading review queue…</p>}

        {!isLoading && queue.length === 0 && (
          <div className="surface flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <ClipboardCheck className="size-5 text-success" />
            No nominees are currently awaiting HOD evaluation.
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          {queue.map((n) => (
            <ReviewCard
              key={n.id}
              nomination={n}
              nomineeName={employees.find((e) => e.id === n.nominee_id)?.full_name ?? "Nominee"}
              department={departments.find((d) => d.id === n.nominee_department_id)?.name ?? "—"}
            />
          ))}
        </div>

        {/* Completed section */}
        {completed.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-center gap-2">
              <Star className="size-4 text-accent" />
              <h2 className="font-display text-lg font-bold">Approved nominations</h2>
            </div>
            <div className="surface overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Nominee</th>
                    <th className="px-4 py-3 font-semibold">Department</th>
                    <th className="px-4 py-3 font-semibold">Categories</th>
                    <th className="px-4 py-3 font-semibold">HSE</th>
                    <th className="px-4 py-3 font-semibold">HOD</th>
                    <th className="px-4 py-3 font-semibold">Total</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {completed.map((n) => {
                    const name = employees.find((e) => e.id === n.nominee_id)?.full_name ?? "—";
                    const dept = departments.find((d) => d.id === n.nominee_department_id)?.name ?? "—";
                    const hod = HOD_METRICS.reduce((s, m) => s + (n[m.key] ?? 0), 0);
                    return (
                      <tr key={n.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-3 font-semibold">
                          <div className="flex items-center gap-2">
                            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{initials(name)}</span>
                            {name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{dept}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{n.award_categories.join(" · ")}</td>
                        <td className="px-4 py-3">{n.hse_score ?? "—"}</td>
                        <td className="px-4 py-3 font-semibold text-accent">{hod}/30</td>
                        <td className="px-4 py-3 font-display font-bold text-primary">{totalScore(n) ?? "—"}</td>
                        <td className="px-4 py-3"><StatusPill status={n.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </AppShell>
    </PinGate>
  );
}

function ReviewCard({
  nomination, nomineeName, department,
}: {
  nomination: Nomination;
  nomineeName: string;
  department: string;
}) {
  const queryClient = useQueryClient();
  const [scores, setScores] = useState<Record<HodMetricKey, number>>(() => {
    const initial = {} as Record<HodMetricKey, number>;
    for (const metric of HOD_METRICS) initial[metric.key] = nomination[metric.key] ?? 3;
    return initial;
  });
  const [citation, setCitation] = useState(nomination.citation_note ?? "");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(CONFIRM_CLOSED);

  const hodTotal = HOD_METRICS.reduce((sum, m) => sum + scores[m.key], 0);
  const projected = nomination.hse_score !== null
    ? Math.round((nomination.hse_score * 0.7 + hodTotal) * 10) / 10
    : null;

  const approve = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("nominations").update({
        hod_duty_of_care: scores.hod_duty_of_care,
        hod_safe_work_behavior: scores.hod_safe_work_behavior,
        hod_hazard_awareness: scores.hod_hazard_awareness,
        hod_speaking_up: scores.hod_speaking_up,
        hod_participation: scores.hod_participation,
        citation_note: citation.trim().slice(0, 500) || null,
        status: "Completed",
      }).eq("id", nomination.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${nomineeName} approved — nomination completed.`);
      queryClient.invalidateQueries({ queryKey: ["nominations"] });
    },
    onError: () => toast.error("Could not save the evaluation."),
  });

  const sendBack = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("nominations").update({
        status: "Pending HSE Verification",
        hse_score: null,
        capa_closure_rate: null,
        recordable_injury: false,
        disqualification_reason: rejectReason.trim() || "Returned by HOD for re-evaluation.",
        hod_duty_of_care: null,
        hod_safe_work_behavior: null,
        hod_hazard_awareness: null,
        hod_speaking_up: null,
        hod_participation: null,
        citation_note: null,
      }).eq("id", nomination.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${nomineeName}'s nomination sent back for re-evaluation.`);
      queryClient.invalidateQueries({ queryKey: ["nominations"] });
    },
    onError: () => toast.error("Could not send back the nomination."),
  });

  const askApprove = () => {
    setConfirm({
      open: true,
      title: "Approve & complete nomination?",
      description: `You are about to give final HOD approval for ${nomineeName} with a total score of ${projected ?? hodTotal}. This will mark the nomination as Completed and it will appear on the Executive Safety Wall.`,
      confirmLabel: "Yes, approve",
      variant: "default",
      onConfirm: () => approve.mutate(),
    });
  };

  const askSendBack = () => {
    if (!rejectReason.trim()) {
      toast.error("Please enter a reason before sending back.");
      return;
    }
    setConfirm({
      open: true,
      title: "Send back for re-evaluation?",
      description: `${nomineeName}'s nomination will be reset to Pending HSE Verification with your reason noted. The Safety Admin will need to re-process it.`,
      confirmLabel: "Yes, send back",
      variant: "warning",
      onConfirm: () => sendBack.mutate(),
    });
  };

  return (
    <article className="surface p-5">
      <ConfirmDialog state={confirm} onClose={() => setConfirm(CONFIRM_CLOSED)} />

      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
            {initials(nomineeName)}
          </span>
          <div>
            <h2 className="font-display text-base font-bold leading-tight">{nomineeName}</h2>
            <p className="text-[11px] text-muted-foreground">
              {nomination.nominee_position_title} · {department}
            </p>
          </div>
        </div>
        <StatusPill status={nomination.status} />
      </header>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {nomination.award_categories.join(" · ")}
      </p>

      {/* HSE score summary */}
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-2.5">
        <ShieldCheck className="size-4 shrink-0 text-success" />
        <p className="text-xs">
          <span className="font-semibold">HSE score: </span>
          <span className="text-success font-bold">{nomination.hse_score}/100</span>
          <span className="mx-2 text-border">·</span>
          <span className="font-semibold">CAPA: </span>
          <span className="font-bold">{nomination.capa_closure_rate ?? "—"}%</span>
        </p>
      </div>

      {/* HOD sliders */}
      <div className="mt-4 space-y-4">
        {HOD_METRICS.map((metric) => (
          <div key={metric.key}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{metric.label}</span>
              <span className="font-display font-bold text-accent">{scores[metric.key]}/5</span>
            </div>
            <Slider
              className="mt-2"
              min={1}
              max={5}
              step={1}
              value={[scores[metric.key]]}
              onValueChange={([value]) =>
                setScores((prev) => ({ ...prev, [metric.key]: value ?? 3 }))
              }
            />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Label htmlFor={`citation-${nomination.id}`}>Citation note (optional)</Label>
        <Input
          id={`citation-${nomination.id}`}
          value={citation}
          maxLength={500}
          onChange={(e) => setCitation(e.target.value)}
          placeholder="Why does this nominee stand out?"
          className="mt-1.5"
        />
      </div>

      {/* Score summary */}
      <div className="mt-4 rounded-xl border border-border bg-gradient-to-r from-secondary/60 to-secondary/20 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">HOD rating</span>
          <span className="font-display font-bold text-accent">{hodTotal}/30</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="font-semibold">Projected total score</span>
          <span className={cn("font-display font-bold", projected !== null ? "text-primary" : "text-muted-foreground")}>
            {projected ?? "—"}
          </span>
        </div>
      </div>

      {/* Send back section */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowReject((v) => !v)}
          className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-destructive hover:underline transition-colors"
        >
          {showReject ? "Hide" : "Send back for re-evaluation"}
        </button>
        {showReject && (
          <div className="mt-2 space-y-2">
            <Textarea
              rows={2}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="State the reason for sending back…"
              className="text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-warning/40 text-warning hover:bg-warning/10"
              disabled={sendBack.isPending}
              onClick={askSendBack}
            >
              <RotateCcw className="size-3.5" />
              {sendBack.isPending ? "Sending back…" : "Send back"}
            </Button>
          </div>
        )}
      </div>

      {/* Final approval */}
      <div className="mt-4 border-t border-border pt-4">
        <Button
          className="w-full gap-2 bg-success text-success-foreground hover:bg-success/90"
          disabled={approve.isPending}
          onClick={askApprove}
        >
          <Save className="size-4" />
          {approve.isPending ? "Approving…" : "Approve & complete nomination"}
        </Button>
      </div>
    </article>
  );
}
