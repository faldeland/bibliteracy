import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_NEXT_COOKIE,
  resolvePostLoginPath,
} from "@/lib/auth/postLoginNext";
import { getRequestOrigin } from "@/lib/auth/requestOrigin";
import { createClient } from "@/lib/supabase/server";

function redirectWithClearedNextCookie(url: string): NextResponse {
  const response = NextResponse.redirect(url);
  response.cookies.set(AUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = resolvePostLoginPath(
    searchParams.get("next"),
    request.cookies.get(AUTH_NEXT_COOKIE)?.value,
  );

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectWithClearedNextCookie(`${origin}${next}`);
    }
  }

  return redirectWithClearedNextCookie(`${origin}/login?error=callback`);
}
