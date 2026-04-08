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
    console.log("Iniciando exportação de backup...");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Verificação de Autenticação
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Não autorizado: Cabeçalho ausente");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) throw new Error("Não autorizado: Sessão inválida");

    // 2. Verificação de Admin
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (callerRole?.role !== "admin") {
      throw new Error("Apenas administradores podem exportar o banco de dados");
    }

    console.log(`Usuário autorizado: ${user.email}. Gerando SQL...`);

    // 3. Geração do SQL de Backup
    let sql = `-- Cell Pro 360 - Database Backup\n-- Exportado por: ${user.email}\n-- Data: ${new Date().toISOString()}\n\n`;
    sql += "BEGIN;\n\n";
    sql += "SET statement_timeout = 0;\nSET client_encoding = 'UTF8';\nSET row_security = off;\n\n";

    const TABLES_TO_EXPORT = [
        "profiles", "user_roles", "stores", "store_bank_accounts", "products", 
        "customers", "sales", "transactions", "service_orders", 
        "service_order_history", "cash_registers", "cash_entries", 
        "inventory_movements", "leads", "whatsapp_config", "webhooks"
    ];

    for (const table of TABLES_TO_EXPORT) {
        console.log(`Processando tabela: ${table}`);
        sql += `-- Tabela: ${table}\n`;
        sql += `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;\n\n`;

        const { data: rows, error: dataError } = await supabaseAdmin.from(table).select("*");
        
        if (dataError) {
            console.error(`Erro ao ler tabela ${table}:`, dataError);
            sql += `-- Erro ao exportar dados da tabela ${table}: ${dataError.message}\n\n`;
            continue;
        }

        if (rows && rows.length > 0) {
            const cols = Object.keys(rows[0]);
            const batchSize = 100;
            for (let i = 0; i < rows.length; i += batchSize) {
                const batch = rows.slice(i, i + batchSize);
                sql += `INSERT INTO public.${table} (${cols.join(", ")}) VALUES\n`;
                
                const insertRows = batch.map(row => {
                    const values = cols.map(c => {
                        const val = row[c];
                        if (val === null || val === undefined) return "NULL";
                        if (typeof val === "number") return String(val);
                        if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
                        if (typeof val === "object") {
                            return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
                        }
                        return `'${String(val).replace(/'/g, "''")}'`;
                    });
                    return `(${values.join(", ")})`;
                });
                
                sql += insertRows.join(",\n") + ";\n";
            }
            sql += "\n";
        }
    }

    sql += "COMMIT;\n";
    console.log("Backup gerado com sucesso.");

    return new Response(sql, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/sql",
        "Content-Disposition": `attachment; filename="cellpro360_backup_${new Date().toISOString().split("T")[0]}.sql"`,
      },
    });

  } catch (error) {
    console.error("Erro crítico na exportação:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
