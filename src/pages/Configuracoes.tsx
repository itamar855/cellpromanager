import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Webhook, Trash2, Plus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const eventLabels: Record<string, string> = {
  os_status_changed: "Mudança de Status na OS (WhatsApp / N8N)",
  sale_completed: "Nova Venda Finalizada",
};

const Configuracoes = () => {
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<Tables<"webhooks">[]>([]);
  const [stores, setStores] = useState<Tables<"stores">[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ store_id: "", event_type: "os_status_changed", url: "" });

  const fetchData = async () => {
    const [wbRes, storesRes] = await Promise.all([
      supabase.from("webhooks").select("*").order("created_at", { ascending: false }),
      supabase.from("stores").select("*"),
    ]);
    setWebhooks(wbRes.data ?? []);
    setStores(storesRes.data ?? []);
    if (storesRes.data && storesRes.data.length > 0 && !form.store_id) {
      setForm(f => ({ ...f, store_id: storesRes.data[0].id }));
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.url || !form.store_id) return;
    setLoading(true);
    const { error } = await supabase.from("webhooks").insert({
      store_id: form.store_id, event_type: form.event_type, url: form.url, is_active: true
    });
    if (error) toast.error("Erro ao salvar Webhook: " + error.message);
    else {
      toast.success("Automação configurada!");
      setForm(f => ({ ...f, url: "" }));
      fetchData();
    }
    setLoading(false);
  };

  const handleToggle = async (id: string, current: boolean) => {
    const { error } = await supabase.from("webhooks" as any).update({ is_active: !current }).eq("id", id);
    if (error) toast.error("Erro ao atualizar!");
    else fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("webhooks" as any).delete().eq("id", id);
    if (error) toast.error("Erro ao excluir!");
    else { toast.success("Excluído!"); fetchData(); }
  };

  const storeMap = new Map(stores.map(s => [s.id, s.name]));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Configurações & Automação</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Integrações N8N, Zapier e Make para envio de WhatsApp</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            Adicionar Novo Webhook
          </CardTitle>
          <CardDescription>
            Configure URLs para disparar dados (JSON) automaticamente quando ocorrerem eventos no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddWebhook} className="grid sm:grid-cols-12 gap-4 items-end">
            <div className="space-y-1.5 sm:col-span-3">
              <Label className="text-xs">Evento (Gatilho)</Label>
              <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="os_status_changed">Mudança de Status OS</SelectItem>
                  <SelectItem value="sale_completed">Nova Venda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label className="text-xs">Loja</Label>
              <Select value={form.store_id} onValueChange={(v) => setForm({ ...form, store_id: v })}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-4">
              <Label className="text-xs">URL do Endpoint (ex: N8N Catch Hook)</Label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://seu-n8n.com/webhook/..." required className="h-10" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" className="w-full h-10" disabled={loading || !form.store_id || !form.url}>
                <Plus className="h-4 w-4 mr-1.5" /> Adicionar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="font-display font-semibold text-lg">Webhooks Ativos</h3>
        {webhooks.length === 0 ? (
          <div className="p-8 text-center border rounded-xl bg-card/50 text-muted-foreground">
            Ainda não há integrações cadastradas.
          </div>
        ) : webhooks.map(w => (
          <Card key={w.id} className={`border-border/50 shadow-sm transition-opacity ${!w.is_active ? "opacity-60" : ""}`}>
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{eventLabels[w.event_type] || w.event_type}</span>
                  <span className="text-xs text-muted-foreground px-1.5 py-0.5 border rounded-md">{storeMap.get(w.store_id)}</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground truncate mt-1 max-w-[400px]" title={w.url}>{w.url}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Ativo</Label>
                  <Switch checked={w.is_active} onCheckedChange={() => handleToggle(w.id, w.is_active)} />
                </div>
                <Button className="h-8 w-8 p-0 bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(w.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Configuracoes;
