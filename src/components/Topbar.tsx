import { Moon, Sun, Monitor, Lock } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { Button } from "./ui/Button";
import { formatDate } from "@/lib/format";

interface Props {
  onLock?: () => void;
}

export function Topbar({ onLock }: Props) {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-bg-elevated px-4 drag">
      <div className="text-xs text-fg-muted">{formatDate(new Date())}</div>
      <div className="flex items-center gap-1 no-drag">
        <Button size="sm" variant="ghost" onClick={cycle} title={`Theme: ${theme}`}>
          <Icon className="h-4 w-4" />
        </Button>
        {onLock && (
          <Button size="sm" variant="ghost" onClick={onLock} title="Lock app">
            <Lock className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
