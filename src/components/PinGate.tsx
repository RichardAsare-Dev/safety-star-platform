import { useState } from "react";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProgramSettings } from "@/lib/data";

type PinField = "admin_pin" | "hod_pin";

const SESSION_KEYS: Record<PinField, string> = {
  admin_pin: "wtp_admin_unlocked",
  hod_pin: "wtp_hod_unlocked",
};

const CONFIG: Record<PinField, { title: string; description: string; icon: string }> = {
  admin_pin: {
    title: "Safety Admin Access",
    description: "Enter the Safety Admin PIN to access the HSE Verification console.",
    icon: "🛡️",
  },
  hod_pin: {
    title: "HOD Review Access",
    description: "Enter the HOD PIN to access the Behavioural Evaluation console.",
    icon: "📋",
  },
};

export function PinGate({ pinField, children }: { pinField: PinField; children: React.ReactNode }) {
  const sessionKey = SESSION_KEYS[pinField];
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(sessionKey) === "1");
  const [input, setInput] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const { data: settings, isLoading } = useProgramSettings();
  const { title, description, icon } = CONFIG[pinField];

  if (unlocked) return <>{children}</>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setChecking(true);
    setError("");
    await new Promise((r) => setTimeout(r, 400));
    if (input.trim() === settings[pinField]) {
      sessionStorage.setItem(sessionKey, "1");
      setUnlocked(true);
    } else {
      setError("Incorrect PIN. Please try again.");
      setInput("");
    }
    setChecking(false);
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-primary via-primary to-primary/80 px-4 py-8">
      {/* Background pattern */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-5">
        <div className="hatch-accent h-full w-full" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo mark */}
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-accent shadow-lg">
            <ShieldCheck className="size-8 text-accent-foreground" />
          </div>
          <p className="font-display text-sm font-bold uppercase tracking-widest text-primary-foreground/60">
            WTP OHSE Awards
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-white/10 bg-card p-7 shadow-2xl">
          <div className="mb-6 text-center">
            <span className="text-4xl">{icon}</span>
            <h1 className="mt-3 font-display text-xl font-bold">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pin-input" className="text-sm font-semibold">Access PIN</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pin-input"
                  type={showPin ? "text" : "password"}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setError(""); }}
                  placeholder="Enter your PIN"
                  autoComplete="off"
                  autoFocus
                  className={`h-12 pl-10 pr-10 text-base tracking-widest ${error ? "border-destructive ring-1 ring-destructive/30" : ""}`}
                  disabled={isLoading || checking}
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {error && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                  <span>⚠</span> {error}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="h-12 w-full gap-2 text-base font-semibold"
              disabled={!input.trim() || isLoading || checking}
            >
              <ShieldCheck className="size-4" />
              {checking ? "Verifying…" : isLoading ? "Loading…" : "Unlock Access"}
            </Button>
          </form>

          <p className="mt-5 text-center text-[11px] text-muted-foreground">
            Don't have the PIN? Contact your HSE Safety Admin.
          </p>
        </div>
      </div>
    </div>
  );
}
