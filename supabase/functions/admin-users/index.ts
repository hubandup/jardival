// Super-admin user management: list / invite / create / update role / delete
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Role = "super_admin" | "admin";

interface Body {
  action: "list" | "invite" | "create" | "set_role" | "delete";
  email?: string;
  password?: string;
  display_name?: string;
  user_id?: string;
  role?: Role;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate caller via anon client + JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check caller is super_admin
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isSuper = (roles ?? []).some((r: any) => r.role === "super_admin");
    if (!isSuper) return json({ error: "Forbidden: super_admin only" }, 403);

    const body = (await req.json()) as Body;

    switch (body.action) {
      case "list": {
        const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 200 });
        if (error) return json({ error: error.message }, 500);
        const { data: allRoles } = await admin.from("user_roles").select("user_id, role");
        const { data: profiles } = await admin.from("profiles").select("id, email, display_name");
        const rolesByUser = new Map<string, string[]>();
        (allRoles ?? []).forEach((r: any) => {
          const arr = rolesByUser.get(r.user_id) ?? [];
          arr.push(r.role);
          rolesByUser.set(r.user_id, arr);
        });
        const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));
        const users = list.users
          .map((u) => ({
            id: u.id,
            email: u.email,
            display_name: (profileById.get(u.id) as any)?.display_name ?? null,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            roles: rolesByUser.get(u.id) ?? [],
          }))
          .filter((u) => u.roles.length > 0);
        return json({ users });
      }

      case "invite": {
        if (!body.email || !body.role) return json({ error: "email and role required" }, 400);
        const { data, error } = await admin.auth.admin.inviteUserByEmail(body.email, {
          data: { display_name: body.display_name ?? body.email },
        });
        if (error) return json({ error: error.message }, 500);
        const uid = data.user?.id;
        if (uid) {
          await admin.from("user_roles").upsert(
            { user_id: uid, role: body.role },
            { onConflict: "user_id,role" }
          );
        }
        return json({ ok: true, user_id: uid });
      }

      case "create": {
        if (!body.email || !body.password || !body.role)
          return json({ error: "email, password, role required" }, 400);
        const { data, error } = await admin.auth.admin.createUser({
          email: body.email,
          password: body.password,
          email_confirm: true,
          user_metadata: { display_name: body.display_name ?? body.email },
        });
        if (error) return json({ error: error.message }, 500);
        const uid = data.user!.id;
        await admin.from("user_roles").upsert(
          { user_id: uid, role: body.role },
          { onConflict: "user_id,role" }
        );
        return json({ ok: true, user_id: uid });
      }

      case "set_role": {
        if (!body.user_id || !body.role) return json({ error: "user_id and role required" }, 400);
        // Replace all roles with the new one
        await admin.from("user_roles").delete().eq("user_id", body.user_id);
        const { error } = await admin
          .from("user_roles")
          .insert({ user_id: body.user_id, role: body.role });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      case "delete": {
        if (!body.user_id) return json({ error: "user_id required" }, 400);
        if (body.user_id === userData.user.id)
          return json({ error: "You cannot delete yourself" }, 400);
        const { error } = await admin.auth.admin.deleteUser(body.user_id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }

  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
