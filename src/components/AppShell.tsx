import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, Award, ClipboardCheck, LayoutDashboard, ShieldCheck, Vote } from "lucide-react";
import { useEffect, useState } from "react";

import { useProgramSettings } from "@/lib/data";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/nominate", label: "Nominate", icon: Vote },
  { to: "/review", label: "HOD Review", icon: ClipboardCheck },
  { to: "/admin", label: "Admin", icon: Award },
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
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <div className="min-h-dvh bg-background dot-grid">
      {/* Top accent stripe — thicker, gradient */}
      <div
        className="h-[3px] w-full"
        style={{ background: "linear-gradient(90deg, oklch(0.62 0.20 41) 0%, oklch(0.72 0.18 55) 50%, oklch(0.62 0.20 41) 100%)" }}
      />

      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b border-white/8"
        style={{
          background: "linear-gradient(180deg, oklch(0.195 0.045 265) 0%, oklch(0.17 0.042 265) 100%)",
          boxShadow: "var(--shadow-header)",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          {/* Brand + status row */}
          <div className="flex items-center justify-between gap-3 py-3">
            {/* Logo mark + brand */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-xl shadow-lg"
                  style={{ background: "linear-gradient(135deg, oklch(0.68 0.20 41) 0%, oklch(0.55 0.20 35) 100%)" }}
                >
                  <ShieldCheck className="size-5 text-white" />
                </span>
                {/* Pulse dot */}
                <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-success ring-2 ring-primary" />
              </div>
              <div>
                <p className="font-display text-[15px] font-bold leading-tight tracking-tight text-white sm:text-base">
                  WTP OHSE Awards
                </p>
                <p className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-white/40 sm:block">
                  ISO 45001:2018 · ISO 14001:2015
                </p>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex items-center gap-2">
              {/* Countdown */}
              <span
                className={cn(
                  "glass-badge inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-wide sm:text-xs",
                  countdown?.closed
                    ? "border-destructive/35 bg-destructive/15 text-red-300"
                    : "border-accent/35 bg-accent/15 text-orange-200",
                )}
              >
                <Award className="size-3 shrink-0" />
                <span className="hidden sm:inline">
                  {countdown
                    ? countdown.closed
                      ? "Voting closed"
                      : `${countdown.days}d ${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`
                    : "Loading…"}
                </span>
                <span className="sm:hidden">
                  {countdown
                    ? countdown.closed
                      ? "Closed"
                      : `${countdown.days}d ${countdown.hours}h`
                    : "…"}
                </span>
              </span>

              {/* Live badge */}
              <span className="glass-badge inline-flex items-center gap-1.5 rounded-full border border-success/35 bg-success/12 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-green-300 sm:text-xs">
                <span className="relative flex size-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
                <span className="hidden sm:inline">{isSuccess ? "Live" : "Connecting…"}</span>
              </span>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden gap-1 sm:flex">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = to === "/" ? currentPath === "/" : currentPath.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  activeOptions={{ exact: to === "/" }}
                  className={cn(
                    "group relative flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-[13px] font-semibold tracking-wide transition-all duration-200",
                    active
                      ? "bg-white/8 text-white"
                      : "text-white/50 hover:bg-white/5 hover:text-white/80",
                  )}
                >
                  <Icon className={cn("size-4 transition-transform duration-200", active && "scale-110")} />
                  {label}
                  {/* Active underline */}
                  <span
                    className={cn(
                      "absolute bottom-0 left-3 right-3 h-[2px] rounded-full transition-all duration-300",
                      active
                        ? "bg-gradient-to-r from-accent/80 via-accent to-accent/80 opacity-100"
                        : "opacity-0 group-hover:opacity-30 bg-white",
                    )}
                  />
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:pb-10 md:px-6 md:py-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="hidden border-t border-border/60 py-6 text-center sm:block">
        <p className="text-xs font-medium text-muted-foreground/70 tracking-wide">
          Dual-engine evaluation · HSE verification gate (70%) + HOD behavioural rating (30%)
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground/40 tracking-widest uppercase">
          WTP OHSE Recognition & Awards Platform
        </p>
      </footer>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 sm:hidden"
        style={{
          background: "oklch(1 0 0 / 0.92)",
          backdropFilter: "blur(20px) saturate(1.8)",
          WebkitBackdropFilter: "blur(20px) saturate(1.8)",
        }}
      >
        <div className="grid grid-cols-4 px-1 pb-safe">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? currentPath === "/" : currentPath.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-3 text-[10px] font-semibold tracking-wide transition-all duration-200",
                  active ? "text-accent" : "text-muted-foreground/60",
                )}
              >
                <span className={cn(
                  "grid size-8 place-items-center rounded-xl transition-all duration-200",
                  active ? "bg-accent/12 shadow-sm" : "",
                )}>
                  <Icon className={cn("size-4 transition-all duration-200", active && "scale-110")} />
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
