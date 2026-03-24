import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Activity, User, Calendar, Database } from "lucide-react";
import { Input } from "@/components/ui/input";

const actionLabels: Record<string, string> = {
  CREATE_SALE: "Nova Venda",
  UPDATE_OS_STATUS: "Alteração de Status OS",
  UPDATE_PRODUCT_PRICE: "Ajuste de Preço / Detalhes",
  CREATE_RECORD: "Novo Cadastro",
  DELETE_RECORD: "Exclusão",
  LOGIN: "Acesso ao Sistema",
  TRANSFER_STOCK: "Transferência de Estoque",
};

const actionColors: Record<string, string> = {
  CREATE_SALE: "bg-green-500/10 text-green-500 border-green-500/20",
  UPDATE_OS_STATUS: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  UPDATE_PRODUCT_PRICE: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  CREATE_RECORD: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  DELETE_RECORD: "bg-destructive/10 text-destructive border-destructive/20",
  LOGIN: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  TRANSFER_STOCK: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
};

const Auditoria = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_logs" as any)
      .select(`*, profiles:user_id(display_name)`)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error) setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    (log.entity_type && log.entity_type.toLowerCase().includes(search.toLowerCase())) ||
    (log.profiles?.display_name && log.profiles.display_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Auditoria</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Rastreabilidade completa de ações críticas do sistema.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          placeholder="Buscar por ação, usuário ou entidade..." 
          className="pl-9 h-11"
        />
      </div>

      <Card className="border-border/40 shadow-xl shadow-black/5 overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Logs Recentes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-280px)]">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando logs...</div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhum log encontrado.</div>
            ) : (
              <div className="divide-y divide-border/40">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex gap-4 items-start">
                      <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${log.action.includes('DELETE') ? 'bg-destructive' : 'bg-primary animate-pulse'}`} />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`text-[10px] border ${actionColors[log.action] || 'bg-muted text-muted-foreground'}`}>
                            {actionLabels[log.action] || log.action}
                          </Badge>
                          <span className="text-xs font-medium text-foreground capitalize">
                            {log.entity_type ? `${log.entity_type.replace('_', ' ')}` : "Sistema"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {log.profiles?.display_name || "Sistema"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(log.created_at).toLocaleString("pt-BR")}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      {log.entity_id && (
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded border border-border/40">
                          <Database className="h-3 w-3" />
                          {log.entity_id.substring(0, 8)}...
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auditoria;
