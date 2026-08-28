import { cn } from "@/lib/utils";
import { STATUS_DOT, type NominationStatus } from "@/lib/ohse";

const STYLES: Record<NominationStatus, string> = {
  "Pending HSE Verification": "bg-warning/15 text-warning-foreground border-warning/40",
  Disqualified: "bg-destructive/10 text-destructive border-destructive/30",
  "Approved for HOD Evaluation": "bg-success/12 text-success border-success/35",
  Completed: "bg-primary/8 text-primary border-primary/25",
};

export function StatusPill({
  status,
  className,
}: {
  status: NominationStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight",
        STYLES[status],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
      {status}
    </span>
  );
}
