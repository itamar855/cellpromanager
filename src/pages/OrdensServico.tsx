import { useEffect, useState, useRef } from "react";
import SignatureCanvas from "@/components/SignatureCanvas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Wrench, Search, Clock, CheckCircle2, AlertCircle, Package, Phone, User } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: "Aberta", color: "bg-blue-500/15 text-blue-400 border-blue-500/20", icon: Clock },
  analyzing: { label: "Em Análise", color: "bg-accent/15 text-accent border-accent/20", icon: AlertCircle },
  waiting_part: { label: "Aguardando Peça", color: "bg-orange-500/15 text-orange-400 border-orange-500/20", icon: Package },
  repairing: { label: "Em Reparo", color: "bg-purple-500/15 text-purple-400 border-purple-500/20", icon: Wrench },
  waiting_approval: { label: "Aguardando Aprovação", color: "bg-accent/15 text-accent border-accent/20", icon: AlertCircle },
  ready: { label: "Pronta p/ Retirada", color: "bg-primary/15 text-primary border-primary/20", icon: CheckCircle2 },
  delivered: { label: "Entregue", color: "bg-muted text-muted-foreground border-border", icon: CheckCircle2 },
  cancelled: { label: "Cancelada", color: "bg-destructive/15 text-destructive border-destructive/20", icon: AlertCircle },
};

const allStatuses = Object.keys(statusConfig);

const OrdensServico = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Tables<"service_orders">[]>([]);
  const [stores, setStores] = useState<Tables<"stores">[]>([]);
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Tables<"service_orders"> | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(false);

  const [signatureData, setSignatureData] = useState("");

  const [form, setForm] = useState({
    customer_name: "", customer_phone: "", customer_cpf: "",
    device_brand: "iPhone", device_model: "", device_imei: "", device_color: "",
    device_condition: "", device_password: "", device_accessories: "",
    reported_defect: "", requested_service: "",
    store_id: "", estimated_price: "", estimated_completion: "",
    terms_accepted: false, internal_notes: "",
  });

  const fetchData = async () => {
    const [ordersRes, storesRes, profilesRes] = await Promise.all([
      supabase.from("service_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("stores").select("*"),
      supabase.from("profiles").select("*"),
    ]);
    setOrders(ordersRes.data ?? []);
    setStores(storesRes.data ?? []);
    setProfiles(profilesRes.data ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("service_orders_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_orders" }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const storeMap = new Map(stores.map((s) => [s.id, s.name]));
  const profileMap = new Map(profiles.map((p) => [p.user_id, p.display_name]));

  const resetForm = () => setForm({
    customer_name: "", customer_phone: "", customer_cpf: "",
    device_brand: "iPhone", device_model: "", device_imei: "", device_color: "",
    device_condition: "", device_password: "", device_accessories: "",
    reported_defect: "", requested_service: "",
    store_id: "", estimated_price: "", estimated_completion: "",
    terms_accepted: false, internal_notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const { error } = await supabase.from("service_orders").insert({
      customer_name: form.customer_name,
      customer_phone: form.customer_phone || null,
      customer_cpf: form.customer_cpf || null,
      device_brand: form.device_brand,
      device_model: form.device_model,
      device_imei: form.device_imei || null,
      device_color: form.device_color || null,
      device_condition: form.device_condition || null,
      device_password: form.device_password || null,
      device_accessories: form.device_accessories || null,
      reported_defect: form.reported_defect,
      requested_service: form.requested_service,
      store_id: form.store_id || null,
      estimated_price: form.estimated_price ? parseFloat(form.estimated_price) : 0,
      estimated_completion: form.estimated_completion || null,
      terms_accepted: form.terms_accepted,
      signature_data: signatureData || null,
      internal_notes: form.internal_notes || null,
      created_by: user.id,
      status: "open",
    } as any);

    if (error) {
      toast.error("Erro ao criar OS: " + error.message);
    } else {
      toast.success("Ordem de Serviço criada!");
      setDialogOpen(false);
      resetForm();
      fetchData();
    }
    setLoading(false);
  };

  const updateStatus = async (orderId: string, newStatus: string, oldStatus: string) => {
    if (!user) return;
    const updates: any = { status: newStatus };
    if (newStatus === "delivered") updates.delivered_at = new Date().toISOString();
    if (newStatus === "ready") updates.completed_at = new Date().toISOString();

    const { error } = await supabase.from("service_orders").update(updates).eq("id", orderId);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    await supabase.from("service_order_history").insert({
      service_order_id: orderId,
      old_status: oldStatus,
      new_status: newStatus,
      created_by: user.id,
    } as any);

    toast.success(`Status atualizado para: ${statusConfig[newStatus]?.label}`);
    fetchData();
    if (detailOrder?.id === orderId) {
      setDetailOrder({ ...detailOrder, status: newStatus } as any);
    }
  };

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch = o.customer_name.toLowerCase().includes(q) ||
      (o.device_imei && o.device_imei.includes(search)) ||
      (o.device_model && o.device_model.toLowerCase().includes(q)) ||
      String(o.order_number).includes(search);
    return matchSearch && (filterStatus === "all" || o.status === filterStatus);
  });

  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Ordens de Serviço</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{orders.length} ordens registradas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 h-10"><Plus className="h-4 w-4" /> Nova OS</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Abrir Ordem de Serviço</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Client data */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <User className="h-3 w-3" /> Dados do Cliente
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome *</Label>
                    <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Nome completo" required className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Telefone</Label>
                    <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} placeholder="(11) 99999-9999" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">CPF</Label>
                    <Input value={form.customer_cpf} onChange={(e) => setForm({ ...form, customer_cpf: e.target.value })} placeholder="000.000.000-00" className="h-10" />
                  </div>
                </div>
              </div>

              {/* Device data */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Phone className="h-3 w-3" /> Dados do Aparelho
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Marca *</Label>
                    <Select value={form.device_brand} onValueChange={(v) => setForm({ ...form, device_brand: v })}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["iPhone", "Samsung", "Xiaomi", "Motorola", "Huawei", "Outro"].map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Modelo *</Label>
                    <Input value={form.device_model} onChange={(e) => setForm({ ...form, device_model: e.target.value })} placeholder="iPhone 13 Pro" required className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">IMEI</Label>
                    <Input value={form.device_imei} onChange={(e) => setForm({ ...form, device_imei: e.target.value })} placeholder="Obrigatório" className="h-10" />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cor</Label>
                    <Input value={form.device_color} onChange={(e) => setForm({ ...form, device_color: e.target.value })} placeholder="Preto" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Senha (opcional)</Label>
                    <Input value={form.device_password} onChange={(e) => setForm({ ...form, device_password: e.target.value })} placeholder="****" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Acessórios</Label>
                    <Input value={form.device_accessories} onChange={(e) => setForm({ ...form, device_accessories: e.target.value })} placeholder="Carregador, capa" className="h-10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Condição Física</Label>
                  <Textarea value={form.device_condition} onChange={(e) => setForm({ ...form, device_condition: e.target.value })} placeholder="Descreva avarias existentes: tela trincada, arranhões, etc." className="min-h-[60px]" />
                </div>
              </div>

              {/* Service info */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Wrench className="h-3 w-3" /> Serviço
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Defeito Relatado *</Label>
                  <Textarea value={form.reported_defect} onChange={(e) => setForm({ ...form, reported_defect: e.target.value })} placeholder="Descreva o problema relatado pelo cliente" required className="min-h-[60px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Serviço Solicitado *</Label>
                  <Select value={form.requested_service} onValueChange={(v) => setForm({ ...form, requested_service: v })}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                    <SelectContent>
                      {["Troca de Tela", "Troca de Bateria", "Reparo de Placa", "Troca de Conector", "Troca de Câmera", "Desbloqueio", "Formatação", "Diagnóstico", "Outro"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor Estimado (R$)</Label>
                    <Input type="number" step="0.01" value={form.estimated_price} onChange={(e) => setForm({ ...form, estimated_price: e.target.value })} placeholder="150.00" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Previsão de Entrega</Label>
                    <Input type="datetime-local" value={form.estimated_completion} onChange={(e) => setForm({ ...form, estimated_completion: e.target.value })} className="h-10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Loja</Label>
                  <Select value={form.store_id} onValueChange={(v) => setForm({ ...form, store_id: v })}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                    <SelectContent>
                      {stores.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Terms */}
              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Termos e Condições</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O cliente declara que o aparelho foi entregue nas condições descritas acima. A loja não se responsabiliza por dados contidos no aparelho. Recomenda-se backup prévio. Em caso de não retirada do aparelho após 90 dias da conclusão do serviço, a loja poderá dispor do mesmo para cobrir custos. A garantia do serviço cobre apenas o defeito reparado e a peça substituída, pelo período de 90 dias. O orçamento inicial pode sofrer alterações após análise técnica, mediante aprovação do cliente.
                </p>
                <div className="flex items-center gap-2">
                  <Switch checked={form.terms_accepted} onCheckedChange={(v) => setForm({ ...form, terms_accepted: v })} />
                  <Label className="text-xs">Cliente aceita os termos</Label>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Observações Internas</Label>
                <Textarea value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} placeholder="Notas internas..." className="min-h-[50px]" />
              </div>

              <Button type="submit" className="w-full h-11 font-semibold" disabled={loading || !form.requested_service}>
                {loading ? "Criando..." : "Abrir Ordem de Serviço"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status summary chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Button
          variant={filterStatus === "all" ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs shrink-0"
          onClick={() => setFilterStatus("all")}
        >
          Todas ({orders.length})
        </Button>
        {allStatuses.filter((s) => statusCounts[s]).map((s) => (
          <Button
            key={s}
            variant={filterStatus === s ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={() => setFilterStatus(s)}
          >
            {statusConfig[s].label} ({statusCounts[s]})
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, IMEI, modelo ou nº da OS..." className="pl-9 h-10" />
      </div>

      {/* Orders list */}
      <div className="space-y-2">
        {filtered.length > 0 ? (
          filtered.map((order) => {
            const sc = statusConfig[order.status] || statusConfig.open;
            return (
              <Card
                key={order.id}
                className="border-border/50 shadow-lg shadow-black/10 cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => setDetailOrder(order)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono">#{order.order_number}</span>
                        <p className="font-medium text-sm truncate">{order.customer_name}</p>
                        <Badge variant="outline" className={`text-[10px] ${sc.color}`}>
                          {sc.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {order.device_brand} {order.device_model}
                        {order.device_imei && ` · IMEI: ${order.device_imei}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.requested_service} · {storeMap.get(order.store_id || "") || "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-display font-bold text-sm">{formatCurrency(Number(order.estimated_price || 0))}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(order.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Wrench className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium text-sm">Nenhuma OS encontrada</p>
              <p className="text-xs mt-1">Abra sua primeira ordem de serviço</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detailOrder} onOpenChange={(open) => !open && setDetailOrder(null)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          {detailOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <span className="text-muted-foreground font-mono text-sm">#{detailOrder.order_number}</span>
                  OS — {detailOrder.customer_name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`${statusConfig[detailOrder.status]?.color}`}>
                    {statusConfig[detailOrder.status]?.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Criada em {new Date(detailOrder.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>

                {/* Client */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-xs">
                  <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide">Cliente</p>
                  <p>{detailOrder.customer_name}</p>
                  {detailOrder.customer_phone && <p>📞 {detailOrder.customer_phone}</p>}
                  {detailOrder.customer_cpf && <p>CPF: {detailOrder.customer_cpf}</p>}
                </div>

                {/* Device */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-xs">
                  <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide">Aparelho</p>
                  <p>{detailOrder.device_brand} {detailOrder.device_model}</p>
                  {detailOrder.device_imei && <p>IMEI: {detailOrder.device_imei}</p>}
                  {detailOrder.device_color && <p>Cor: {detailOrder.device_color}</p>}
                  {detailOrder.device_condition && <p>Condição: {detailOrder.device_condition}</p>}
                  {detailOrder.device_accessories && <p>Acessórios: {detailOrder.device_accessories}</p>}
                </div>

                {/* Service */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-xs">
                  <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide">Serviço</p>
                  <p><span className="text-muted-foreground">Defeito:</span> {detailOrder.reported_defect}</p>
                  <p><span className="text-muted-foreground">Serviço:</span> {detailOrder.requested_service}</p>
                  <p><span className="text-muted-foreground">Valor:</span> {formatCurrency(Number(detailOrder.estimated_price || 0))}</p>
                  {detailOrder.final_price > 0 && <p><span className="text-muted-foreground">Valor Final:</span> {formatCurrency(Number(detailOrder.final_price))}</p>}
                  {detailOrder.estimated_completion && <p><span className="text-muted-foreground">Previsão:</span> {new Date(detailOrder.estimated_completion).toLocaleString("pt-BR")}</p>}
                </div>

                {detailOrder.internal_notes && (
                  <div className="rounded-lg bg-muted/50 p-3 text-xs">
                    <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide">Notas Internas</p>
                    <p className="mt-1">{detailOrder.internal_notes}</p>
                  </div>
                )}

                {/* Status update */}
                {detailOrder.status !== "delivered" && detailOrder.status !== "cancelled" && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atualizar Status</p>
                    <div className="flex flex-wrap gap-2">
                      {allStatuses
                        .filter((s) => s !== detailOrder.status)
                        .map((s) => (
                          <Button
                            key={s}
                            variant="outline"
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => updateStatus(detailOrder.id, s, detailOrder.status)}
                          >
                            {statusConfig[s].label}
                          </Button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdensServico;
