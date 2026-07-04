import { Command } from "lucide-react";
import { cn } from "@/lib/utils";

/** The Executive OS wordmark + glyph. */
export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-electric-500 shadow-lg shadow-electric-500/30">
        <Command className="h-[18px] w-[18px] text-white" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight text-foreground">
          Executive OS
        </p>
        <p className="text-[11px] text-muted-foreground">Command Centre</p>
      </div>
    </div>
  );
}
