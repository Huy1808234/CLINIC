import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/supabase-clients/server";
import {
  attachRecoveryCookieToResponse,
  verifyPasswordRecoveryIntent,
} from "@/lib/auth/recovery-context";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const recovery_state = searchParams.get("recovery_state");

  let next = searchParams.get("next") || "/select-clinic";
  // Enforce internal relative path (no open redirect)
  if (!next.startsWith("/") || next.startsWith("//")) {
    next = "/select-clinic";
  }

  const supabase = await createClient();

  // 1. PKCE Code Branch
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      const response = NextResponse.redirect(`${origin}${next}`);

      // Cryptographically verify server-signed recovery intent bound to this user's email
      const hasValidRecoveryIntent = recovery_state
        ? verifyPasswordRecoveryIntent(recovery_state, data.user.email)
        : false;

      if (hasValidRecoveryIntent) {
        attachRecoveryCookieToResponse(response, data.user.id);
      }

      return response;
    }
  }

  // 2. Token Hash / OTP Branch
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: type as "recovery" | "invite" | "signup" | "email",
      token_hash,
    });
    if (!error && data?.user) {
      const response = NextResponse.redirect(`${origin}${next}`);

      // Issue recovery cookie ONLY if Supabase successfully verified type === "recovery"
      if (type === "recovery") {
        attachRecoveryCookieToResponse(response, data.user.id);
      }

      return response;
    }
  }

  // If code exchange failed or link expired
  return NextResponse.redirect(`${origin}/login?error=invalid_or_expired_link`);
}
