import Link from "next/link";
import { SidebarNav } from "./sidebar-nav";
import { Brand } from "./brand";

/** Fixed desktop sidebar (hidden on mobile — see Topbar's Sheet). */
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-navy-900/50 md:flex">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Link href="/dashboard">
          <Brand />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        <SidebarNav />
      </div>
      <div className="border-t border-border p-4">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Executive OS · v0.1
          <br />
          Your AI command centre.
        </p>
      </div>
    </aside>
  );
}
