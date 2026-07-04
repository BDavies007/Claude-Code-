import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Root: route to the dashboard if signed in, otherwise the login screen. */
export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
