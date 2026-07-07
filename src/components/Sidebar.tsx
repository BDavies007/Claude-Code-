import { NavLink } from "react-router-dom";
import {
  Sunrise,
  LayoutDashboard,
  HeartPulse,
  Inbox,
  CalendarDays,
  Wallet,
  Users,
  Sparkles,
  KanbanSquare,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/cn";

const links = [
  { to: "/", label: "Morning Brief", icon: Sunrise, end: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/health", label: "Health", icon: HeartPulse },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/finance", label: "Finance", icon: Wallet },
  { to: "/crm", label: "Clients", icon: Users },
  { to: "/leads", label: "Leads & Social", icon: Sparkles },
  { to: "/projects", label: "Projects", icon: KanbanSquare },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-bg-subtle">
      <div className="flex h-12 items-center gap-2 px-4 drag border-b border-border">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-brand text-brand-fg font-bold text-xs">
          A
        </div>
        <span className="text-sm font-semibold tracking-tight">Atlas Hub</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {links.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition",
                    isActive
                      ? "bg-bg-elevated text-fg shadow-sm"
                      : "text-fg-muted hover:bg-bg-elevated hover:text-fg",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-border p-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition",
              isActive
                ? "bg-bg-elevated text-fg"
                : "text-fg-muted hover:bg-bg-elevated hover:text-fg",
            )
          }
        >
          <Settings className="h-4 w-4" />
          Settings
        </NavLink>
      </div>
    </aside>
  );
}
