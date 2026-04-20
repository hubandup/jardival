// One-shot bootstrap: creates the super-admin account if missing.
// Safe to call multiple times — idempotent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMIN_EMAIL = "charles@hubandup.com";
const SUPER_ADMIN_PASSWORD = "1234567890";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Check if user already exists
  const { data: list } = await admin.auth.admin.listUsers();
  let user = list.users.find((u) => u.email === SUPER_ADMIN_EMAIL);

  if (!user) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: "Charles" },
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    user = created.user!;
  }

  // Ensure super_admin role
  const { error: roleErr } = await admin
    .from("user_roles")
    .upsert({ user_id: user.id, role: "super_admin" }, { onConflict: "user_id,role" });

  if (roleErr) {
    return new Response(JSON.stringify({ error: roleErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, user_id: user.id, email: SUPER_ADMIN_EMAIL }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
