import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABLES = ["stores", "products", "sales", "transactions", "customers", "service_orders", "service_order_history", "profiles", "user_roles", "store_bank_accounts"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify admin
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader! } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem exportar dados" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { format } = await req.json();

    // Fetch all data
    const allData: Record<string, any[]> = {};
    for (const table of TABLES) {
      const { data } = await adminClient.from(table).select("*");
      allData[table] = data ?? [];
    }

    if (format === "json") {
      return new Response(JSON.stringify(allData, null, 2), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="cellmanager_export_${new Date().toISOString().split("T")[0]}.json"`,
        },
      });
    }

    if (format === "csv") {
      let csvOutput = "";
      for (const [table, rows] of Object.entries(allData)) {
        if (rows.length === 0) continue;
        csvOutput += `--- ${table.toUpperCase()} ---\n`;
        const headers = Object.keys(rows[0]);
        csvOutput += headers.join(",") + "\n";
        rows.forEach((row) => {
          csvOutput += headers.map((h) => {
            const val = row[h];
            if (val === null || val === undefined) return "";
            const str = String(val);
            return str.includes(",") || str.includes('"') || str.includes("\n")
              ? `"${str.replace(/"/g, '""')}"` : str;
          }).join(",") + "\n";
        });
        csvOutput += "\n";
      }
      return new Response(csvOutput, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="cellmanager_export_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // Default: SQL (PostgreSQL format)
    let sql = `-- CellManager Pro - Database Export\n-- Date: ${new Date().toISOString()}\n-- Format: PostgreSQL\n\n`;
    
    for (const [table, rows] of Object.entries(allData)) {
      if (rows.length === 0) continue;
      sql += `-- Table: ${table}\n`;
      const cols = Object.keys(rows[0]);
      rows.forEach((row) => {
        const values = cols.map((c) => {
          const val = row[c];
          if (val === null || val === undefined) return "NULL";
          if (typeof val === "number") return String(val);
          if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
          return `'${String(val).replace(/'/g, "''")}'`;
        });
        sql += `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${values.join(", ")});\n`;
      });
      sql += "\n";
    }

    return new Response(sql, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="cellmanager_export_${new Date().toISOString().split("T")[0]}.sql"`,
      },
    });
  } catch (e) {
    console.error("export error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
