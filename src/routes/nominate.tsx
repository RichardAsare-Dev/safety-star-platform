import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, ChevronRight, LifeBuoy, Search, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useDepartments, useEmployees } from "@/lib/data";
import {
  AWARD_CATEGORIES,
  tierDisabledReason,
  type ActionType,
  type Employee,
} from "@/lib/ohse";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/nominate")({
  head: () => ({
    meta: [
      { title: "Nominate a Safety Champion | WTP OHSE Awards" },
      {
        name: "description",
        content:
          "Three-step nomination wizard for WTP employees: choose your batch, pick a nominee from your plant section and select the applicable safety award categories.",
      },
      { property: "og:title", content: "Nominate a Safety Champion | WTP OHSE Awards" },
      {
        property: "og:description",
        content:
          "Submit an OHSE award nomination in under a minute with guided batch, nominee and award-category selection.",
      },
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

  const batch = action === "Check Batch I" ? "Batch I" : action === "Check Batch II" ? "Batch II" : null;
  const batchDepartments = useMemo(
    () => (batch ? departments.filter((d) => d.batch_category === batch) : departments),
    [batch, departments],
  );

  const nominee: Employee | undefined = employees.find((e) => e.id === nomineeId);
  const nomineeOptions = useMemo(
    () =>
      employees
        .filter((e) => (nomineeDept ? e.department_id === nomineeDept : false))
        .filter((e) => e.full_name.toLowerCase().includes(nomineeQuery.trim().toLowerCase())),
    [employees, nomineeDept, nomineeQuery],
  );

  const submit = useMutation({
    mutationFn: async () => {
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
      toast.success("Nomination submitted — now pending HSE verification.");
      setStep(0);
      setVoterName("");
      setAction(null);
      setVoterDept("");
      setNomineeDept("");
      setNomineeId("");
      setNomineeQuery("");
      setCategories([]);
    },
    onError: (error: unknown) => {
      const message =
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? "Please check the form")
          : "Could not submit nomination. Please try again.";
      toast.error(message);
    },
  });

  const sendSupport = useMutation({
    mutationFn: async () => {
      const parsed = supportSchema.parse({
        employee_name: supportName,
        mobile_contact: supportMobile,
        note: supportNote || undefined,
      });
      const { error } = await supabase.from("support_requests").insert({
        employee_name: parsed.employee_name,
        mobile_contact: parsed.mobile_contact,
        note: parsed.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Support request logged. The HSE team will reach out.");
      setSupportOpen(false);
      setSupportName("");
      setSupportMobile("");
      setSupportNote("");
      setAction(null);
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? "Please check the form")
          : "Could not log the request.",
      );
    },
  });

  const canContinue =
    step === 0
      ? voterName.trim().length > 1 && !!batch && !!voterDept
      : step === 1
        ? !!nomineeId
        : categories.length > 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">Employee Voting</p>
        <h1 className="mt-1 font-display text-3xl font-bold">Nominate a Safety Champion</h1>

        <ol className="mt-6 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                  i < step
                    ? "bg-success text-success-foreground"
                    : i === step
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-muted-foreground",
                )}
              >
                {i < step ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-xs font-semibold sm:block",
                  i === step ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
            </li>
          ))}
        </ol>

        <div className="surface mt-6 p-5 md:p-6">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="voter">Your full name</Label>
                <Input
                  id="voter"
                  value={voterName}
                  maxLength={120}
                  onChange={(e) => setVoterName(e.target.value)}
                  placeholder="e.g. Gifty Amankwah"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Action</Label>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                  {(["Check Batch I", "Check Batch II", "Request Support"] as ActionType[]).map(
                    (option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setAction(option);
                          setVoterDept("");
                          setNomineeDept("");
                          setNomineeId("");
                          if (option === "Request Support") setSupportOpen(true);
                        }}
                        className={cn(
                          "rounded-lg border px-3 py-3 text-sm font-semibold transition-colors",
                          action === option
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border hover:bg-secondary",
                        )}
                      >
                        {option}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div>
                <Label>Your department {batch ? `(${batch})` : ""}</Label>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                  {batchDepartments.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      disabled={!batch}
                      onClick={() => setVoterDept(d.id)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors disabled:opacity-50",
                        voterDept === d.id
                          ? "border-primary bg-primary/8"
                          : "border-border hover:bg-secondary",
                      )}
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
                {!batch && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Pick Batch I or Batch II to filter departments.
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label>Nominee&apos;s department</Label>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                  {departments.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setNomineeDept(d.id);
                        setNomineeId("");
                        setCategories([]);
                      }}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
                        nomineeDept === d.id
                          ? "border-primary bg-primary/8"
                          : "border-border hover:bg-secondary",
                      )}
                    >
                      {d.name}
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        {d.batch_category}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="nominee-search">Nominee name</Label>
                <div className="relative mt-1.5">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="nominee-search"
                    value={nomineeQuery}
                    onChange={(e) => setNomineeQuery(e.target.value)}
                    placeholder={nomineeDept ? "Search names…" : "Select a department first"}
                    disabled={!nomineeDept}
                    className="pl-9"
                  />
                </div>
                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border">
                  {nomineeOptions.length === 0 && (
                    <p className="px-3 py-3 text-sm text-muted-foreground">
                      {nomineeDept ? "No matching employees." : "Awaiting department selection."}
                    </p>
                  )}
                  {nomineeOptions.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        setNomineeId(e.id);
                        setCategories([]);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-secondary",
                        nomineeId === e.id && "bg-accent/10",
                      )}
                    >
                      <span className="font-medium">{e.full_name}</span>
                      <span className="text-[11px] text-muted-foreground">{e.position_title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {nominee && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent/8 p-3">
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                    {nominee.full_name}
                  </span>
                  <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-semibold">
                    {nominee.position_title}
                  </span>
                  <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-semibold">
                    {departments.find((d) => d.id === nominee.department_id)?.name}
                  </span>
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-accent-foreground">
                    {nominee.leadership_tier}
                  </span>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Categories are filtered by the nominee&apos;s leadership tier
                {nominee ? ` (${nominee.leadership_tier})` : ""}.
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
                      "flex items-start gap-3 rounded-lg border px-3 py-3 text-sm transition-colors",
                      disabled
                        ? "cursor-not-allowed border-border bg-secondary/60 text-muted-foreground/70"
                        : "cursor-pointer border-border hover:bg-secondary",
                      checked && "border-accent bg-accent/8",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={(value) =>
                        setCategories((prev) =>
                          value ? [...prev, cat.label] : prev.filter((c) => c !== cat.label),
                        )
                      }
                    />
                    <span>
                      <span className="font-semibold">{cat.label}</span>
                      {reason && <span className="block text-[11px]">{reason}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSupportOpen(true)}
              className="gap-2"
            >
              <LifeBuoy className="size-4" /> Request support
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              {step < 2 ? (
                <Button disabled={!canContinue} onClick={() => setStep((s) => s + 1)} className="gap-2">
                  Continue <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button
                  disabled={!canContinue || submit.isPending}
                  onClick={() => submit.mutate()}
                  className="gap-2"
                >
                  <Send className="size-4" />
                  {submit.isPending ? "Submitting…" : "Submit nomination"}
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

      <Sheet open={supportOpen} onOpenChange={setSupportOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Request support</SheetTitle>
            <SheetDescription>
              Share the employee&apos;s name and a mobile contact — the HSE team will follow up.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4">
            <div>
              <Label htmlFor="s-name">Employee&apos;s name</Label>
              <Input
                id="s-name"
                value={supportName}
                maxLength={120}
                onChange={(e) => setSupportName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="s-mobile">Mobile contact</Label>
              <Input
                id="s-mobile"
                value={supportMobile}
                maxLength={30}
                onChange={(e) => setSupportMobile(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="s-note">What do you need help with?</Label>
              <Textarea
                id="s-note"
                value={supportNote}
                maxLength={500}
                onChange={(e) => setSupportNote(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <Button
              className="w-full"
              disabled={sendSupport.isPending}
              onClick={() => sendSupport.mutate()}
            >
              {sendSupport.isPending ? "Sending…" : "Send request"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
