import { User, KeyRound, Sparkles, Database, Plug } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "@/components/settings/profile-form";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data: googleAccount }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, title, company_name")
      .eq("id", user!.id)
      .maybeSingle(),
    supabase
      .from("integration_accounts")
      .select("email, status")
      .eq("user_id", user!.id)
      .eq("provider", "google")
      .maybeSingle(),
  ]);

  const aiProvider = process.env.ANTHROPIC_API_KEY
    ? "Anthropic"
    : process.env.OPENAI_API_KEY
      ? "OpenAI"
      : "Local (no key)";

  const googleNotice = searchParams.connected
    ? "connected"
    : (searchParams.error ?? null);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile, account, and system configuration."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4 text-electric-400" /> Profile
              </CardTitle>
              <CardDescription>
                This appears across your command centre and daily brief.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm
                fullName={profile?.full_name ?? ""}
                title={profile?.title ?? ""}
                companyName={profile?.company_name ?? ""}
              />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plug className="h-4 w-4 text-electric-400" /> Integrations
              </CardTitle>
              <CardDescription>
                Connect Google to sync Calendar, Drive, and Gmail into your
                command centre.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IntegrationsPanel
                connected={googleAccount?.status === "connected"}
                email={googleAccount?.email ?? null}
                configured={!!process.env.GOOGLE_CLIENT_ID}
                notice={googleNotice}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-electric-400" /> Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Email" value={user?.email ?? "—"} />
              <Row
                label="User ID"
                value={<span className="font-mono text-xs">{user?.id}</span>}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-electric-400" /> AI provider
              </CardTitle>
              <CardDescription>
                Used to generate your daily brief.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Active provider</span>
                <Badge variant={aiProvider === "Local (no key)" ? "neutral" : "success"}>
                  {aiProvider}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Set <code className="text-foreground">ANTHROPIC_API_KEY</code> or{" "}
                <code className="text-foreground">OPENAI_API_KEY</code> to switch
                from the built-in local generator to a hosted model.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-4 w-4 text-electric-400" /> Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Backed by Supabase Postgres with row-level security — every
                record is private to your account.
              </p>
              <p className="text-xs">
                pgvector is enabled and each core table has an{" "}
                <code className="text-foreground">embedding</code> column ready
                for semantic search.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right">{value}</span>
    </div>
  );
}
