import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SectionCardProps {
  title: string;
  icon: LucideIcon;
  href: string;
  hrefLabel?: string;
  children: React.ReactNode;
}

/** A dashboard panel with a titled header, "view all" link, and body. */
export function SectionCard({
  title,
  icon: Icon,
  href,
  hrefLabel = "View all",
  children,
}: SectionCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-electric-400" />
          {title}
        </CardTitle>
        <Link
          href={href}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-electric-400"
        >
          {hrefLabel} <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1 pt-0">{children}</CardContent>
    </Card>
  );
}
