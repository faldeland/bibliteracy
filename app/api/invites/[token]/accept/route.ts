import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const origin = new URL(request.url).origin;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?next=/invite/${token}`, {
      status: 303,
    });
  }

  const { data: invite } = await supabase
    .from("invites")
    .select("id, owner_id, accepted_by")
    .eq("token", token)
    .maybeSingle();

  if (!invite || (invite.accepted_by && invite.accepted_by !== user.id)) {
    return NextResponse.redirect(`${origin}/invite/${token}`, { status: 303 });
  }

  // Mark accepted + create guests row. We rely on invites RLS allowing the
  // owner only; for the recipient to mark accepted_by themselves we use a
  // service-role flow in production. For MVP, expose a SECURITY DEFINER fn:
  await supabase.rpc("accept_invite", { p_token: token });

  return NextResponse.redirect(`${origin}/invite/${token}`, { status: 303 });
}
