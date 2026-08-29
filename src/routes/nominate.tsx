import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, CheckCircle2, ChevronRight, LifeBuoy, Search, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useDepartments, useEmployees } from "@/lib/data";
import { AWARD_CATEGORIES, tierDisabledReason, type ActionType, type Employee } from "@/lib/ohse";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/nominate")({
  head: () => ({
    meta: [
      { title: "Nominate a Safety Champion | WTP OHSE Awards" },
      { name: "description", content: "Three-step nomination wizard for WTP employees." },
    ],
  }),
  component: NominatePage,
});

const STEPS = ["Voter Info", "Nominee Selection", "Award Categories"];

const nominationSchema = z.object({
  voter_name: z.string().trim().min(2, "Enter your full name").max(120),
  action_type: z.string().min(1),
  voter_department_id: z.string().uuid("Select your department"),
  nominee_id: z.string().uuid("Select a nominee"),
  award_categories: z.array(z.string()).min(1, "Select at least one award category"),
});

const supportSchema = z.object({
  employee_name: z.string().trim().min(2, "Enter the employee name").max(120),
  mobile_contact: z.string().trim().min(6, "Enter a reachable mobile contact").max(30),
  note: z.string().trim().max(500).optional(),
});

// localStorage key: one vote per (batch + voterDeptId) combination
function voteKey(batch: string, deptId: string) {
  return `wtp_voted__${batch}__${deptId}`;
}
function hasVoted(batch: string | null, deptId: string) {
  if (!batch || !deptId) return false;
  return !!localStorage.getItem(voteKey(batch, deptId));
}
function markVoted(batch: string, deptId: string) {
  localStorage.setItem(voteKey(batch, deptId), "1");
}

function NominatePage() {
  const { data: departments = [] } = useDepartments();
  const { data: employees = [] } = useEmployees();

  const [step, setStep] = useState(0);
  const [voterName, setVoterName] = useState("");
  const [action, setAction] = useState<ActionType | null>(null);
  const [voterDept, setVoterDept] = useState("");
  const [nomineeDept, setNomineeDept] = useState("");
  const [nomineeQuery, setNomineeQuery] = useState("");
  const [nomineeId, setNomineeId] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportMobile, setSupportMobile] = useState("");
  const [supportNote, setSupportNote] = useState("");
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);

  const batch = action === "Check Batch I" ? "Batch I" : action === "Check Batch II" ? "Batch II" : null;
  const batchDepartments = useMemo(
    () => (batch ? departments.filter((d) => d.batch_category === batch) : departments),
    [batch, departments],
  );

  // Is the currently selected voter dept already voted from?
  const currentDeptVoted = hasVoted(batch, voterDept);

  const nominee: Employee | undefined = employees.find((e) => e.id === nomineeId);
  const nomineeOptions = useMemo(
    () =>
      employees
        .filter((e) => (nomineeDept ? e.department_id === nomineeDept : false))
        .filter((e) => e.is_nominee)
        .filter((e) => e.full_name.toLowerCase().includes(nomineeQuery.trim().toLowerCase())),
    [employees, nomineeDept, nomineeQuery],
  );

  const submit = useMutation({
    mutationFn: async () => {
      // Double-check duplicate on submit
      if (batch && voterDept && hasVoted(batch, voterDept)) {
        throw new Error("Your department has already submitted a nomination for this batch.");
      }
      const parsed = nominationSchema.parse({
        voter_name: voterName,
        action_type: action ?? "",
        voter_department_id: voterDept,
        nominee_id: nomineeId,
        award_categories: categories,
      });
      const { error } = await supabase.from("nominations").insert({
        voter_name: parsed.voter_name,
        action_type: parsed.action_type as ActionType,
        voter_department_id: parsed.voter_department_id,
        nominee_id: parsed.nominee_id,
        nominee_department_id: nominee?.department_id ?? null,
        nominee_position_title: nominee?.position_title ?? null,
        award_categories: parsed.award_categories,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (batch && voterDept) markVoted(batch, voterDept);
      setLastSubmitted(nominee?.full_name ?? "Nominee");
      toast.success("Nomination submitted — now pending HSE verification.");
      setStep(0); setVoterName(""); setAction(null); setVoterDept("");
      setNomineeDept(""); setNomineeId(""); setNomineeQuery(""); setCategories([]);
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? "Please check the form")
          : error instanceof Error
            ? error.message
            : "Could not submit nomination. Please try again.",
      );
    },
  });

  const sendSupport = useMutation({
    mutationFn: async () => {
      const parsed = supportSchema.parse({ employee_name: supportName, mobile_contact: supportMobile, note: supportNote || undefined });
      const { error } = await supabase.from("support_requests").insert({ employee_name: parsed.employee_name, mobile_contact: parsed.mobile_contact, note: parsed.note ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Support request logged. The HSE team will reach out.");
      setSupportOpen(false); setSupportName(""); setSupportMobile(""); setSupportNote(""); setAction(null);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof z.ZodError ? (error.issues[0]?.message ?? "Please check the form") : "Could not log the request.");
    },
  });

  const canContinue =
    step === 0 ? voterName.trim().length > 1 && !!batch && !!voterDept && !currentDeptVoted
    : step === 1 ? !!nomineeId
    : categories.length > 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        {/* Page header */}
        <div className="mb-6">
          <p className="eyebrow">Employee Voting</p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Nominate a Safety Champion</h1>
          <p className="mt-1 text-sm text-muted-foreground">Complete all 3 steps to submit your nomination.</p>
        </div>

        {/* Success banner */}
        {lastSubmitted && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-success/40 bg-success/8 px-4 py-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
            <div className="flex-1">
              <p className="font-display text-sm font-bold text-success">Nomination submitted!</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span className="font-semibold">{lastSubmitted}</span> is now pending HSE verification. You may nominate from a different department.
              </p>
            </div>
            <button onClick={() => setLastSubmitted(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>
        )}

        {/* Step progress */}
        <ol className="mb-6 flex items-center gap-0">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold transition-all",
                    i < step ? "bg-success text-success-foreground shadow-sm"
                    : i === step ? "bg-accent text-accent-foreground shadow-md ring-4 ring-accent/20"
                    : "bg-secondary text-muted-foreground",
                  )}
                >
                  {i < step ? <Check className="size-4" /> : i + 1}
                </span>
                <span className={cn("hidden text-[11px] font-semibold sm:block", i === step ? "text-accent" : "text-muted-foreground")}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("mx-1 h-0.5 flex-1 rounded-full transition-colors", i < step ? "bg-success" : "bg-border")} />
              )}
            </li>
          ))}
        </ol>

        {/* Step card */}
        <div className="surface p-5 md:p-6">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="voter" className="text-sm font-semibold">Your full name</Label>
                <Input id="voter" value={voterName} maxLength={120} onChange={(e) => setVoterName(e.target.value)} placeholder="e.g. Gifty Amankwah" className="mt-1.5 h-11" />
              </div>

              <div>
                <Label className="text-sm font-semibold">Select action</Label>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(["Check Batch I", "Check Batch II", "Request Support"] as ActionType[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => { setAction(option); setVoterDept(""); setNomineeDept(""); setNomineeId(""); if (option === "Request Support") setSupportOpen(true); }}
                      className={cn(
                        "flex items-center justify-center rounded-xl border px-3 py-3.5 text-sm font-semibold transition-all",
                        action === option
                          ? "border-accent bg-accent/10 text-accent shadow-sm ring-2 ring-accent/20"
                          : "border-border hover:border-accent/40 hover:bg-secondary",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">
                  Your department {batch ? <span className="text-accent">({batch})</span> : ""}
                </Label>
                {!batch && <p className="mt-1 text-xs text-muted-foreground">Select Batch I or Batch II above first.</p>}
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {batchDepartments.map((d) => {
                    const voted = hasVoted(batch, d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        disabled={!batch || voted}
                        onClick={() => setVoterDept(d.id)}
                        className={cn(
                          "relative rounded-xl border px-3 py-3 text-left text-sm font-medium transition-all",
                          voted
                            ? "cursor-not-allowed border-success/30 bg-success/6 opacity-70"
                            : voterDept === d.id
                              ? "border-primary bg-primary/8 font-semibold shadow-sm"
                              : "border-border hover:border-primary/40 hover:bg-secondary disabled:opacity-40",
                        )}
                      >
                        <span>{d.name}</span>
                        {voted && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
                            <Check className="size-2.5" /> Voted
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Warn if selected dept already voted */}
                {currentDeptVoted && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-warning">
                    ⚠ Your department has already submitted a nomination for this batch. Contact your Safety Admin if this was a mistake.
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-semibold">Nominee's department</Label>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {departments.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => { setNomineeDept(d.id); setNomineeId(""); setCategories([]); }}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-3 py-3 text-left text-sm font-medium transition-all",
                        nomineeDept === d.id
                          ? "border-primary bg-primary/8 font-semibold shadow-sm"
                          : "border-border hover:border-primary/40 hover:bg-secondary",
                      )}
                    >
                      <span>{d.name}</span>
                      <span className="ml-2 shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{d.batch_category}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="nominee-search" className="text-sm font-semibold">Search nominee</Label>
                <div className="relative mt-1.5">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="nominee-search"
                    value={nomineeQuery}
                    onChange={(e) => setNomineeQuery(e.target.value)}
                    placeholder={nomineeDept ? "Type a name…" : "Select a department first"}
                    disabled={!nomineeDept}
                    className="h-11 pl-9"
                  />
                </div>
                <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-border bg-card shadow-sm">
                  {nomineeOptions.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-muted-foreground">
                      {!nomineeDept ? "Awaiting department selection." : "No nominees available in this department yet."}
                    </p>
                  ) : (
                    nomineeOptions.map((e) => {
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => { setNomineeId(e.id); setCategories([]); }}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 border-b border-border/50 px-4 py-3 text-left text-sm last:border-b-0 transition-colors hover:bg-secondary",
                            nomineeId === e.id && "bg-accent/8 font-semibold",
                          )}
                        >
                          <span className="font-medium">{e.full_name}</span>
                          <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] text-muted-foreground">{e.position_title}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {nominee && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/6 p-3">
                  <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground">{nominee.full_name}</span>
                  <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold">{nominee.position_title}</span>
                  <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold">{departments.find((d) => d.id === nominee.department_id)?.name}</span>
                  <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-bold text-accent-foreground">{nominee.leadership_tier}</span>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2.5">
              <p className="text-sm text-muted-foreground">
                Categories enabled for <span className="font-semibold text-foreground">{nominee?.leadership_tier ?? "—"}</span> tier nominees.
              </p>
              {AWARD_CATEGORIES.map((cat) => {
                const reason = tierDisabledReason(nominee?.leadership_tier ?? null, cat.tier);
                const disabled = reason !== null;
                const checked = categories.includes(cat.label);
                return (
                  <label
                    key={cat.label}
                    title={reason ?? undefined}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-sm transition-all",
                      disabled ? "cursor-not-allowed border-border/50 bg-secondary/40 opacity-50"
                      : checked ? "border-accent bg-accent/8 shadow-sm ring-1 ring-accent/20"
                      : "border-border hover:border-accent/30 hover:bg-secondary/60",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={(value) =>
                        setCategories((prev) => value ? [...prev, cat.label] : prev.filter((c) => c !== cat.label))
                      }
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-semibold">{cat.label}</span>
                      {reason && <span className="mt-0.5 block text-[11px] text-muted-foreground">{reason}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
            <Button type="button" variant="ghost" onClick={() => setSupportOpen(true)} className="gap-2 text-muted-foreground">
              <LifeBuoy className="size-4" /> Help
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="h-11">Back</Button>
              )}
              {step < 2 ? (
                <Button disabled={!canContinue} onClick={() => setStep((s) => s + 1)} className="h-11 gap-2">
                  Continue <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button disabled={!canContinue || submit.isPending} onClick={() => submit.mutate()} className="h-11 gap-2 bg-success text-success-foreground hover:bg-success/90">
                  <Send className="size-4" />
                  {submit.isPending ? "Submitting…" : "Submit"}
                </Button>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-success" />
          Submissions enter the HSE verification gate (70%) before HOD behavioural rating (30%).
        </p>
      </div>

      {/* Support drawer */}
      <Sheet open={supportOpen} onOpenChange={setSupportOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Request Support</SheetTitle>
            <SheetDescription>Share the employee's name and a mobile contact — the HSE team will follow up.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4 px-1">
            <div>
              <Label htmlFor="s-name">Employee's name</Label>
              <Input id="s-name" value={supportName} maxLength={120} onChange={(e) => setSupportName(e.target.value)} className="mt-1.5 h-11" />
            </div>
            <div>
              <Label htmlFor="s-mobile">Mobile contact</Label>
              <Input id="s-mobile" value={supportMobile} maxLength={30} onChange={(e) => setSupportMobile(e.target.value)} className="mt-1.5 h-11" inputMode="tel" />
            </div>
            <div>
              <Label htmlFor="s-note">What do you need help with?</Label>
              <Textarea id="s-note" value={supportNote} maxLength={500} onChange={(e) => setSupportNote(e.target.value)} className="mt-1.5" rows={3} />
            </div>
            <Button className="h-11 w-full" disabled={sendSupport.isPending} onClick={() => sendSupport.mutate()}>
              {sendSupport.isPending ? "Sending…" : "Send request"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
