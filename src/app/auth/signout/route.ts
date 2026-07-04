import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Sign the current user out and return to the login screen. */
export async function POST(request: Request) {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), {
    status: 302,
  });
}
