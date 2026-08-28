import { Link } from "@tanstack/react-router";
import { Activity, Award, ClipboardCheck, LayoutDashboard, ShieldCheck, Vote } from "lucide-react";
import { useEffect, useState } from "react";

import { useProgramSettings } from "@/lib/data";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/nominate", label: "Nominate", icon: Vote },
  { to: "/review", label: "HOD Review", icon: ClipboardCheck },
  { to: "/admin", label: "Safety Admin", icon: Award },
];

function useDaysRemaining(closesAt?: string | null) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!closesAt || now === null) return null;
  const diff = new Date(closesAt).getTime() - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, closed: true };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    closed: false,
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: settings, isSuccess } = useProgramSettings();
  const countdown = useDaysRemaining(settings?.voting_closes_at);

  return (
    <div className="min-h-screen bg-background">
      <div className="hatch-accent h-1 w-full" />
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <p className="font-display text-base font-bold leading-tight">
                WTP OHSE Recognition &amp; Awards
              </p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-primary-foreground/60">
                ISO 45001:2018 &middot; ISO 14001:2015
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                countdown?.closed
                  ? "border-destructive/50 bg-destructive/20"
                  : "border-accent/50 bg-accent/20",
              )}
            >
              <Award className="size-3.5" />
              {countdown
                ? countdown.closed
                  ? "Voting window closed"
                  : `${countdown.days}d ${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s remaining`
                : "Loading voting window…"}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/15 px-3 py-1 text-xs font-semibold">
              <Activity className="size-3.5" />
              {isSuccess ? "Last Sync: Realtime" : "Connecting…"}
            </span>
          </div>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 md:px-6">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-semibold text-primary-foreground/65 transition-colors hover:text-primary-foreground"
              activeProps={{
                className: "border-accent text-primary-foreground",
              }}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">{children}</main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Dual-engine evaluation: HSE verification gate (70%) + HOD behavioural rating (30%).
      </footer>
    </div>
  );
}
