import {
  LayoutDashboard,
  Sun,
  CalendarClock,
  CheckSquare,
  Scale,
  Users,
  Building2,
  Target,
  Bot,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Today at a glance",
  },
  {
    label: "Daily Brief",
    href: "/daily-brief",
    icon: Sun,
    description: "Your AI morning brief",
  },
  {
    label: "Meetings",
    href: "/meetings",
    icon: CalendarClock,
    description: "Schedule & notes",
  },
  {
    label: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
    description: "What needs doing",
  },
  {
    label: "Decisions",
    href: "/decisions",
    icon: Scale,
    description: "Choices & rationale",
  },
  {
    label: "Contacts",
    href: "/contacts",
    icon: Users,
    description: "People & relationships",
  },
  {
    label: "Companies",
    href: "/companies",
    icon: Building2,
    description: "Accounts & partners",
  },
  {
    label: "Opportunities",
    href: "/opportunities",
    icon: Target,
    description: "Pipeline & deals",
  },
  {
    label: "AI Agents",
    href: "/agents",
    icon: Bot,
    description: "Your AI staff",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Profile & preferences",
  },
];
