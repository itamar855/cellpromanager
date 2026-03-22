import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, display_name } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email === email);

    let userId: string;

    if (existing) {
      // Update password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
      if (updateError) throw updateError;
      userId = existing.id;
    } else {
      // Create user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: display_name || email },
      });
      if (createError) throw createError;
      userId = newUser.user.id;
    }

    // Assign admin role (upsert)
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingRole) {
      await supabaseAdmin
        .from("user_roles")
        .update({ role: "admin" })
        .eq("user_id", userId);
    } else {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
    }

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
