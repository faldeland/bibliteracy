import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const origin = new URL(request.url).origin;
  const inviteUrl = `${origin}/invite/${token}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?next=/invite/${token}`, {
      status: 303,
    });
  }

  // Mark accepted + create guest link through SECURITY DEFINER RPC.
  const { error } = await supabase.rpc("accept_invite", { p_token: token });

  if (error) {
    const message = error.message.toLowerCase();
    const errorCode = message.includes("already used")
      ? "already_used"
      : message.includes("cannot accept your own invite")
        ? "own_invite"
        : message.includes("must be signed in")
          ? "must_sign_in"
          : "invalid";
    return NextResponse.redirect(`${inviteUrl}?error=${errorCode}`, { status: 303 });
  }

  return NextResponse.redirect(inviteUrl, { status: 303 });
}
