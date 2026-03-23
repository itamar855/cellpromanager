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
import {
  Plus, Wrench, Search, Clock, CheckCircle2, AlertCircle, Package,
  Phone, User, FileText, MessageCircle, Banknote, CreditCard, QrCode, DollarSign,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const TERMS_TEXT = `1. O cliente declara que o aparelho foi entregue nas condições descritas nesta OS.
2. A loja não se responsabiliza por dados contidos no aparelho. Recomenda-se backup prévio.
3. Em caso de não retirada do aparelho após 90 dias da conclusão do serviço, a loja poderá dispor do mesmo para cobrir custos.
4. A garantia do serviço cobre apenas o defeito reparado e a peça substituída, pelo período de 90 dias.
5. O orçamento inicial pode sofrer alterações após análise técnica, mediante aprovação do cliente.
6. A loja não se responsabiliza por danos pré-existentes não descritos nesta OS.
7. Serviços de diagnóstico podem ter custo mesmo que o reparo não seja efetuado.`;

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open:             { label: "Aberta",               color: "bg-blue-500/15 text-blue-400 border-blue-500/20",         icon: Clock       },
  analyzing:        { label: "Em Análise",           color: "bg-accent/15 text-accent border-accent/20",               icon: AlertCircle },
  waiting_part:     { label: "Aguardando Peça",      color: "bg-orange-500/15 text-orange-400 border-orange-500/20",   icon: Package     },
  repairing:        { label: "Em Reparo",            color: "bg-purple-500/15 text-purple-400 border-purple-500/20",   icon: Wrench      },
  waiting_approval: { label: "Aguardando Aprovação", color: "bg-accent/15 text-accent border-accent/20",               icon: AlertCircle },
  ready:            { label: "Pronta p/ Retirada",   color: "bg-primary/15 text-primary border-primary/20",            icon: CheckCircle2 },
  delivered:        { label: "Entregue",             color: "bg-muted text-muted-foreground border-border",            icon: CheckCircle2 },
  cancelled:        { label: "Cancelada",            color: "bg-destructive/15 text-destructive border-destructive/20", icon: AlertCircle },
};

const allStatuses = Object.keys(statusConfig);

const paymentLabels: Record<string, string> = {
  dinheiro: "Dinheiro", cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito", pix: "PIX", outro: "Outro",
};

// ── Cria cash_entry pendente no caixa aberto ──────────────────────────────
const createPendingCashEntry = async (
  storeId: string, userId: string, amount: number, description: string,
) => {
  if (!storeId || amount <= 0) return;
  const { data: register } = await supabase
    .from("cash_registers" as any).select("id")
    .eq("store_id", storeId).eq("status", "open").maybeSingle();
  if (!register) return;
  await supabase.from("cash_entries" as any).insert({
    cash_register_id: (register as any).id, store_id: storeId,
    type: "entrada", amount, description,
    payment_method: "dinheiro", receipt_url: null,
    confirmed: false, created_by: userId,
  });
};

// ── Gera PDF via jsPDF (importado dinamicamente) ──────────────────────────
const generateOSPdf = async (order: any, storeName: string, techName: string, publicUrl: string) => {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210; const pad = 15;
  let y = pad;

  const line = () => { doc.setDrawColor(220, 220, 220); doc.line(pad, y, W - pad, y); y += 4; };
  const section = (title: string) => {
    doc.setFillColor(245, 245, 245); doc.rect(pad, y, W - pad * 2, 7, "F");
    doc.setFontSize(9); doc.setTextColor(80, 80, 80); doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), pad + 2, y + 5); y += 10;
    doc.setFont("helvetica", "normal"); doc.setTextColor(30, 30, 30);
  };
  const field = (label: string, value: string, x = pad, w = W - pad * 2) => {
    if (!value) return;
    doc.setFontSize(8); doc.setTextColor(120, 120, 120); doc.text(label, x, y);
    doc.setFontSize(9); doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(value, w - 2);
    doc.text(lines, x, y + 4);
    y += 5 + (lines.length - 1) * 4.5;
  };
  const col2 = (l1: string, v1: string, l2: string, v2: string) => {
    const half = (W - pad * 2) / 2 - 3;
    const yBefore = y;
    field(l1, v1, pad, half);
    const yAfter = y; y = yBefore;
    field(l2, v2, pad + half + 6, half);
    y = Math.max(yAfter, y) + 1;
  };

  // ── Header ──
  doc.setFillColor(16, 185, 129); doc.rect(0, 0, W, 18, "F");
  doc.setFontSize(13); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold");
  doc.text(storeName, pad, 11);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text(`OS #${order.order_number}  ·  ${new Date(order.created_at).toLocaleString("pt-BR")}`, W - pad, 11, { align: "right" });
  y = 25;

  // ── Status ──
  doc.setFontSize(10); doc.setTextColor(16, 185, 129); doc.setFont("helvetica", "bold");
  doc.text(`Status: ${statusConfig[order.status]?.label ?? order.status}`, pad, y); y += 7;
  doc.setFont("helvetica", "normal"); doc.setTextColor(30, 30, 30);

  // ── Cliente ──
  section("Dados do Cliente");
  col2("Nome", order.customer_name, "Telefone", order.customer_phone ?? "");
  col2("CPF", order.customer_cpf ?? "", "", "");
  y += 2;

  // ── Aparelho ──
  section("Dados do Aparelho");
  col2("Marca", order.device_brand, "Modelo", order.device_model);
  col2("IMEI", order.device_imei ?? "", "Cor", order.device_color ?? "");
  col2("Senha", order.device_password ?? "", "Acessórios", order.device_accessories ?? "");
  field("Condição Física", order.device_condition ?? "");
  y += 2;

  // ── Serviço ──
  section("Serviço");
  field("Defeito Relatado", order.reported_defect);
  field("Serviço Solicitado", order.requested_service);
  if (techName) field("Técnico", techName);
  col2("Valor Estimado", formatCurrency(Number(order.estimated_price || 0)),
    "Valor Final", order.final_price ? formatCurrency(Number(order.final_price)) : "—");
  if (order.estimated_completion) field("Previsão de Entrega", new Date(order.estimated_completion).toLocaleString("pt-BR"));
  y += 2;

  // ── Pagamento ──
  const hasPay = Number(order.payment_cash) > 0 || Number(order.payment_card) > 0 || Number(order.payment_pix) > 0 || Number(order.payment_other) > 0;
  if (hasPay) {
    section("Pagamento Recebido");
    if (Number(order.payment_cash) > 0)  field("Dinheiro",  formatCurrency(Number(order.payment_cash)));
    if (Number(order.payment_card) > 0)  field("Cartão",    formatCurrency(Number(order.payment_card)));
    if (Number(order.payment_pix) > 0)   field("PIX",       formatCurrency(Number(order.payment_pix)));
    if (Number(order.payment_other) > 0) field("Outro",     formatCurrency(Number(order.payment_other)));
    if (order.payment_notes)             field("Obs. Pgto", order.payment_notes);
    y += 2;
  }

  // ── Nova página para termos + assinatura ──
  if (y > 220) { doc.addPage(); y = pad; }

  section("Termos e Condições");
  doc.setFontSize(7.5); doc.setTextColor(60, 60, 60);
  const termsLines = doc.splitTextToSize(TERMS_TEXT, W - pad * 2);
  doc.text(termsLines, pad, y);
  y += termsLines.length * 4 + 4;

  // ── Assinatura ──
  if (order.signature_data) {
    try {
      doc.setFontSize(8); doc.setTextColor(80, 80, 80);
      doc.text("Assinatura do Cliente:", pad, y); y += 3;
      doc.addImage(order.signature_data, "PNG", pad, y, 70, 25);
      y += 28;
    } catch (_) {}
  }

  // ── Link QR ──
  if (y > 240) { doc.addPage(); y = pad; }
  line();
  doc.setFontSize(8); doc.setTextColor(100, 100, 100);
  doc.text("Acompanhe sua OS em:", pad, y + 4);
  doc.setTextColor(16, 185, 129);
  doc.text(publicUrl, pad, y + 9);
  y += 14;

  // ── Rodapé ──
  doc.setFontSize(7); doc.setTextColor(160, 160, 160);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} · CellManager`, W / 2, 290, { align: "center" });

  return doc;
};

const OrdensServico = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Tables<"service_orders">[]>([]);
  const [stores, setStores] = useState<Tables<"stores">[]>([]);
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(false);
  const [signatureData, setSignatureData] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  // Update service form (shown in detail dialog)
  const [updateForm, setUpdateForm] = useState({
    final_price: "", technician_id: "",
    payment_cash: "", payment_card: "", payment_pix: "", payment_other: "", payment_notes: "",
  });

  const [form, setForm] = useState({
    customer_name: "", customer_phone: "", customer_cpf: "",
    device_brand: "iPhone", device_model: "", device_imei: "", device_color: "",
    device_condition: "", device_password: "", device_accessories: "",
    reported_defect: "", requested_service: "",
    store_id: "", estimated_price: "", estimated_completion: "",
    technician_id: "", terms_accepted: false, internal_notes: "",
  });

  const fetchData = async () => {
    const [ordersRes, storesRes, profilesRes] = await Promise.all([
      supabase.from("service_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("stores").select("*"),
      supabase.from("profiles").select("*"),
    ]);
    setOrders((ordersRes.data as any[]) ?? []);
    setStores(storesRes.data ?? []);
    setProfiles(profilesRes.data ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const channel = supabase.channel("service_orders_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_orders" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const storeMap = new Map(stores.map((s) => [s.id, s.name]));
  const profileMap = new Map(profiles.map((p) => [p.user_id, p.display_name ?? ""]));

  const getPublicUrl = (orderId: string) => `${window.location.origin}/os/${orderId}`;

  const resetForm = () => {
    setForm({
      customer_name: "", customer_phone: "", customer_cpf: "",
      device_brand: "iPhone", device_model: "", device_imei: "", device_color: "",
      device_condition: "", device_password: "", device_accessories: "",
      reported_defect: "", requested_service: "",
      store_id: "", estimated_price: "", estimated_completion: "",
      technician_id: "", terms_accepted: false, internal_notes: "",
    });
    setSignatureData("");
  };

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
      technician_id: form.technician_id || null,
      estimated_price: form.estimated_price ? parseFloat(form.estimated_price) : 0,
      estimated_completion: form.estimated_completion || null,
      terms_accepted: form.terms_accepted,
      terms_text: TERMS_TEXT,
      signature_data: signatureData || null,
      internal_notes: form.internal_notes || null,
      created_by: user.id,
      status: "open",
    } as any);

    if (error) { toast.error("Erro ao criar OS: " + error.message); }
    else { toast.success("Ordem de Serviço criada!"); setDialogOpen(false); resetForm(); fetchData(); }
    setLoading(false);
  };

  const updateStatus = async (orderId: string, newStatus: string, oldStatus: string) => {
    if (!user) return;
    const updates: any = { status: newStatus };
    if (newStatus === "delivered") updates.delivered_at = new Date().toISOString();
    if (newStatus === "ready") updates.completed_at = new Date().toISOString();

    const { error } = await supabase.from("service_orders").update(updates).eq("id", orderId);
    if (error) { toast.error("Erro ao atualizar status"); return; }

    await supabase.from("service_order_history").insert({
      service_order_id: orderId, old_status: oldStatus,
      new_status: newStatus, created_by: user.id,
    } as any);

    if (newStatus === "delivered") {
      const order = orders.find(o => o.id === orderId);
      if (order && (order as any).store_id) {
        const amount = Number((order as any).final_price || (order as any).estimated_price || 0);
        const desc = `OS #${(order as any).order_number} — ${(order as any).requested_service} (${(order as any).customer_name})`;
        await createPendingCashEntry((order as any).store_id, user.id, amount, desc);
        if (amount > 0) toast.info("Entrada pendente criada no caixa.");
      }
    }

    toast.success(`Status: ${statusConfig[newStatus]?.label}`);
    fetchData();
    if (detailOrder?.id === orderId) setDetailOrder({ ...detailOrder, status: newStatus });
  };

  const handleUpdateService = async () => {
    if (!user || !detailOrder) return;
    setLoading(true);

    const updates: any = {};
    if (updateForm.final_price) updates.final_price = parseFloat(updateForm.final_price);
    if (updateForm.technician_id) updates.technician_id = updateForm.technician_id;
    if (updateForm.payment_cash !== "") updates.payment_cash = parseFloat(updateForm.payment_cash) || 0;
    if (updateForm.payment_card !== "") updates.payment_card = parseFloat(updateForm.payment_card) || 0;
    if (updateForm.payment_pix !== "") updates.payment_pix = parseFloat(updateForm.payment_pix) || 0;
    if (updateForm.payment_other !== "") updates.payment_other = parseFloat(updateForm.payment_other) || 0;
    if (updateForm.payment_notes) updates.payment_notes = updateForm.payment_notes;

    const { error } = await supabase.from("service_orders").update(updates).eq("id", detailOrder.id);
    if (error) { toast.error(error.message); }
    else {
      toast.success("Serviço atualizado!");
      const updated = { ...detailOrder, ...updates };
      setDetailOrder(updated);
      fetchData();
    }
    setLoading(false);
  };

  const handleExportPdf = async (order: any) => {
    setPdfLoading(true);
    try {
      const storeName = storeMap.get(order.store_id) ?? "Assistência Técnica";
      const techName = profileMap.get(order.technician_id) ?? "";
      const publicUrl = getPublicUrl(order.id);
      const doc = await generateOSPdf(order, storeName, techName, publicUrl);
      doc.save(`OS-${order.order_number}.pdf`);
      toast.success("PDF gerado!");
    } catch (err) {
      toast.error("Erro ao gerar PDF. Instale: npm install jspdf");
    }
    setPdfLoading(false);
  };

  const handleSendWhatsApp = async (order: any) => {
    if (!order.customer_phone) { toast.error("Cliente sem telefone cadastrado!"); return; }
    setPdfLoading(true);
    try {
      const storeName = storeMap.get(order.store_id) ?? "Assistência Técnica";
      const techName = profileMap.get(order.technician_id) ?? "";
      const publicUrl = getPublicUrl(order.id);
      const doc = await generateOSPdf(order, storeName, techName, publicUrl);

      // Faz upload do PDF para o Supabase Storage e compartilha o link
      const pdfBlob = doc.output("blob");
      const fileName = `os-${order.order_number}-${Date.now()}.pdf`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("comprovantes").upload(`os-pdfs/${fileName}`, pdfBlob, { upsert: true, contentType: "application/pdf" });

      let shareUrl = publicUrl;
      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(uploadData.path);
        shareUrl = urlData.publicUrl;
      }

      const phone = order.customer_phone.replace(/\D/g, "");
      const msg = encodeURIComponent(
        `Olá ${order.customer_name}! 👋\n\nSua Ordem de Serviço #${order.order_number} está com status: *${statusConfig[order.status]?.label}*.\n\n📄 Acesse sua OS completa:\n${shareUrl}\n\n_${storeName}_`
      );
      window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
      toast.success("WhatsApp aberto!");
    } catch (err) {
      toast.error("Erro ao preparar envio");
    }
    setPdfLoading(false);
  };

  const filtered = orders.filter((o: any) => {
    const q = search.toLowerCase();
    const match = o.customer_name.toLowerCase().includes(q) ||
      (o.device_imei && o.device_imei.includes(search)) ||
      (o.device_model && o.device_model.toLowerCase().includes(q)) ||
      String(o.order_number).includes(search);
    return match && (filterStatus === "all" || o.status === filterStatus);
  });

  const statusCounts = orders.reduce((acc: any, o: any) => {
    acc[o.status] = (acc[o.status] || 0) + 1; return acc;
  }, {} as Record<string, number>);

  // Preenche updateForm quando abre o detail
  const openDetail = (order: any) => {
    setDetailOrder(order);
    setUpdateForm({
      final_price: order.final_price ? String(order.final_price) : "",
      technician_id: order.technician_id ?? "",
      payment_cash: order.payment_cash ? String(order.payment_cash) : "",
      payment_card: order.payment_card ? String(order.payment_card) : "",
      payment_pix: order.payment_pix ? String(order.payment_pix) : "",
      payment_other: order.payment_other ? String(order.payment_other) : "",
      payment_notes: order.payment_notes ?? "",
    });
  };

  const totalPaid = (o: any) =>
    (Number(o?.payment_cash) || 0) + (Number(o?.payment_card) || 0) +
    (Number(o?.payment_pix) || 0) + (Number(o?.payment_other) || 0);

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
              {/* Cliente */}
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

              {/* Aparelho */}
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
                        {["iPhone","Samsung","Xiaomi","Motorola","Huawei","Outro"].map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Modelo *</Label>
                    <Input value={form.device_model} onChange={(e) => setForm({ ...form, device_model: e.target.value })} placeholder="iPhone 13 Pro" required className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">IMEI</Label>
                    <Input value={form.device_imei} onChange={(e) => setForm({ ...form, device_imei: e.target.value })} placeholder="352000000000000" className="h-10" />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cor</Label>
                    <Input value={form.device_color} onChange={(e) => setForm({ ...form, device_color: e.target.value })} placeholder="Preto" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Senha</Label>
                    <Input value={form.device_password} onChange={(e) => setForm({ ...form, device_password: e.target.value })} placeholder="****" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Acessórios</Label>
                    <Input value={form.device_accessories} onChange={(e) => setForm({ ...form, device_accessories: e.target.value })} placeholder="Carregador, capa" className="h-10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Condição Física</Label>
                  <Textarea value={form.device_condition} onChange={(e) => setForm({ ...form, device_condition: e.target.value })} placeholder="Descreva avarias existentes" className="min-h-[60px]" />
                </div>
              </div>

              {/* Serviço */}
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
                      {["Troca de Tela","Troca de Bateria","Reparo de Placa","Troca de Conector","Troca de Câmera","Desbloqueio","Formatação","Diagnóstico","Outro"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor Estimado (R$)</Label>
                    <Input type="number" step="0.01" value={form.estimated_price} onChange={(e) => setForm({ ...form, estimated_price: e.target.value })} placeholder="150.00" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Previsão de Entrega</Label>
                    <Input type="datetime-local" value={form.estimated_completion} onChange={(e) => setForm({ ...form, estimated_completion: e.target.value })} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Técnico Responsável</Label>
                    <Select value={form.technician_id} onValueChange={(v) => setForm({ ...form, technician_id: v })}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name ?? p.user_id}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Loja</Label>
                  <Select value={form.store_id} onValueChange={(v) => setForm({ ...form, store_id: v })}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                    <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* Termos */}
              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Termos e Condições</p>
                <div className="rounded bg-muted/50 p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{TERMS_TEXT}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.terms_accepted} onCheckedChange={(v) => setForm({ ...form, terms_accepted: v })} />
                  <Label className="text-xs">Cliente aceita os termos acima</Label>
                </div>
              </div>

              <SignatureCanvas onSave={setSignatureData} initialData={signatureData} />

              <div className="space-y-1.5">
                <Label className="text-xs">Observações Internas</Label>
                <Textarea value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} placeholder="Notas internas (não aparecem para o cliente)..." className="min-h-[50px]" />
              </div>

              <Button type="submit" className="w-full h-11 font-semibold" disabled={loading || !form.requested_service}>
                {loading ? "Criando..." : "Abrir Ordem de Serviço"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Button variant={filterStatus === "all" ? "default" : "outline"} size="sm" className="h-7 text-xs shrink-0" onClick={() => setFilterStatus("all")}>
          Todas ({orders.length})
        </Button>
        {allStatuses.filter((s) => statusCounts[s]).map((s) => (
          <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm" className="h-7 text-xs shrink-0" onClick={() => setFilterStatus(s)}>
            {statusConfig[s].label} ({statusCounts[s]})
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, IMEI, modelo ou nº da OS..." className="pl-9 h-10" />
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length > 0 ? filtered.map((order: any) => {
          const sc = statusConfig[order.status] || statusConfig.open;
          return (
            <Card key={order.id} className="border-border/50 shadow-lg shadow-black/10 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => openDetail(order)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">#{order.order_number}</span>
                      <p className="font-medium text-sm truncate">{order.customer_name}</p>
                      <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.device_brand} {order.device_model}{order.device_imei && ` · ${order.device_imei}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.requested_service} · {storeMap.get(order.store_id || "") || "—"}
                      {order.technician_id && ` · ${profileMap.get(order.technician_id) ?? ""}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display font-bold text-sm">{formatCurrency(Number(order.final_price || order.estimated_price || 0))}</p>
                    {totalPaid(order) > 0 && <p className="text-[10px] text-primary">Pago: {formatCurrency(totalPaid(order))}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(order.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }) : (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Wrench className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium text-sm">Nenhuma OS encontrada</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail Dialog */}
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

                {/* Status + ações */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={statusConfig[detailOrder.status]?.color}>
                      {statusConfig[detailOrder.status]?.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{new Date(detailOrder.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => handleExportPdf(detailOrder)} disabled={pdfLoading}>
                      <FileText className="h-3.5 w-3.5" /> PDF
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs text-green-500 border-green-500/30 hover:bg-green-500/10"
                      onClick={() => handleSendWhatsApp(detailOrder)} disabled={pdfLoading}>
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </Button>
                  </div>
                </div>

                {/* Link público */}
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-[10px] text-muted-foreground flex-1 truncate">{getPublicUrl(detailOrder.id)}</span>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]"
                    onClick={() => { navigator.clipboard.writeText(getPublicUrl(detailOrder.id)); toast.success("Link copiado!"); }}>
                    Copiar
                  </Button>
                </div>

                {/* Cliente */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-xs">
                  <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide">Cliente</p>
                  <p className="font-medium">{detailOrder.customer_name}</p>
                  {detailOrder.customer_phone && <p>📞 {detailOrder.customer_phone}</p>}
                  {detailOrder.customer_cpf && <p>CPF: {detailOrder.customer_cpf}</p>}
                </div>

                {/* Aparelho */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-xs">
                  <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide">Aparelho</p>
                  <p className="font-medium">{detailOrder.device_brand} {detailOrder.device_model}</p>
                  {detailOrder.device_imei && <p>IMEI: {detailOrder.device_imei}</p>}
                  {detailOrder.device_color && <p>Cor: {detailOrder.device_color}</p>}
                  {detailOrder.device_condition && <p>Condição: {detailOrder.device_condition}</p>}
                  {detailOrder.device_accessories && <p>Acessórios: {detailOrder.device_accessories}</p>}
                </div>

                {/* Serviço */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-xs">
                  <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide">Serviço</p>
                  <p><span className="text-muted-foreground">Defeito:</span> {detailOrder.reported_defect}</p>
                  <p><span className="text-muted-foreground">Serviço:</span> {detailOrder.requested_service}</p>
                  {detailOrder.technician_id && <p><span className="text-muted-foreground">Técnico:</span> {profileMap.get(detailOrder.technician_id) ?? "—"}</p>}
                  <p><span className="text-muted-foreground">Estimado:</span> {formatCurrency(Number(detailOrder.estimated_price || 0))}</p>
                  {detailOrder.final_price && <p><span className="text-muted-foreground">Final:</span> <span className="font-bold text-primary">{formatCurrency(Number(detailOrder.final_price))}</span></p>}
                  {detailOrder.estimated_completion && <p><span className="text-muted-foreground">Previsão:</span> {new Date(detailOrder.estimated_completion).toLocaleString("pt-BR")}</p>}
                </div>

                {/* Pagamento atual */}
                {totalPaid(detailOrder) > 0 && (
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-xs">
                    <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide">Pagamento Recebido</p>
                    {Number(detailOrder.payment_cash) > 0 && <p><span className="text-muted-foreground">Dinheiro:</span> {formatCurrency(Number(detailOrder.payment_cash))}</p>}
                    {Number(detailOrder.payment_card) > 0 && <p><span className="text-muted-foreground">Cartão:</span> {formatCurrency(Number(detailOrder.payment_card))}</p>}
                    {Number(detailOrder.payment_pix) > 0 && <p><span className="text-muted-foreground">PIX:</span> {formatCurrency(Number(detailOrder.payment_pix))}</p>}
                    {Number(detailOrder.payment_other) > 0 && <p><span className="text-muted-foreground">Outro:</span> {formatCurrency(Number(detailOrder.payment_other))}</p>}
                    <p className="font-bold text-primary">Total: {formatCurrency(totalPaid(detailOrder))}</p>
                    {detailOrder.payment_notes && <p className="text-muted-foreground">{detailOrder.payment_notes}</p>}
                  </div>
                )}

                {/* Assinatura */}
                {detailOrder.signature_data && (
                  <div className="rounded-lg bg-muted/50 p-3 text-xs">
                    <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-2">Assinatura do Cliente</p>
                    <img src={detailOrder.signature_data} alt="Assinatura" className="max-h-20 rounded border border-border" />
                  </div>
                )}

                {/* Termos */}
                <div className="rounded-lg border border-border p-3 text-xs">
                  <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-2">Termos e Condições</p>
                  <div className="max-h-28 overflow-y-auto">
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{TERMS_TEXT}</p>
                  </div>
                  {detailOrder.terms_accepted && (
                    <div className="flex items-center gap-1 mt-2 text-primary">
                      <CheckCircle2 className="h-3 w-3" />
                      <span className="text-[10px]">Cliente aceitou os termos</span>
                    </div>
                  )}
                </div>

                {/* Atualizar serviço */}
                {detailOrder.status !== "cancelled" && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
                    <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5" /> Atualizar Serviço
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Valor Final (R$)</Label>
                        <Input type="number" step="0.01" value={updateForm.final_price}
                          onChange={e => setUpdateForm(f => ({ ...f, final_price: e.target.value }))}
                          placeholder="0.00" className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Técnico</Label>
                        <Select value={updateForm.technician_id} onValueChange={v => setUpdateForm(f => ({ ...f, technician_id: v }))}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name ?? p.user_id}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Formas de Pagamento Recebidas</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] flex items-center gap-1"><Banknote className="h-3 w-3" /> Dinheiro</Label>
                        <Input type="number" step="0.01" value={updateForm.payment_cash} onChange={e => setUpdateForm(f => ({ ...f, payment_cash: e.target.value }))} placeholder="0.00" className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] flex items-center gap-1"><CreditCard className="h-3 w-3" /> Cartão</Label>
                        <Input type="number" step="0.01" value={updateForm.payment_card} onChange={e => setUpdateForm(f => ({ ...f, payment_card: e.target.value }))} placeholder="0.00" className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] flex items-center gap-1"><QrCode className="h-3 w-3" /> PIX</Label>
                        <Input type="number" step="0.01" value={updateForm.payment_pix} onChange={e => setUpdateForm(f => ({ ...f, payment_pix: e.target.value }))} placeholder="0.00" className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] flex items-center gap-1"><DollarSign className="h-3 w-3" /> Outro</Label>
                        <Input type="number" step="0.01" value={updateForm.payment_other} onChange={e => setUpdateForm(f => ({ ...f, payment_other: e.target.value }))} placeholder="0.00" className="h-8 text-xs" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Obs. de Pagamento</Label>
                      <Input value={updateForm.payment_notes} onChange={e => setUpdateForm(f => ({ ...f, payment_notes: e.target.value }))} placeholder="Ex: Parte em dinheiro, parte no cartão" className="h-9" />
                    </div>

                    {/* Total pago preview */}
                    {(parseFloat(updateForm.payment_cash) || 0) + (parseFloat(updateForm.payment_card) || 0) + (parseFloat(updateForm.payment_pix) || 0) + (parseFloat(updateForm.payment_other) || 0) > 0 && (
                      <div className="flex justify-between text-xs font-bold rounded-lg bg-primary/10 text-primary px-3 py-2">
                        <span>Total Recebido</span>
                        <span>{formatCurrency(
                          (parseFloat(updateForm.payment_cash) || 0) +
                          (parseFloat(updateForm.payment_card) || 0) +
                          (parseFloat(updateForm.payment_pix) || 0) +
                          (parseFloat(updateForm.payment_other) || 0)
                        )}</span>
                      </div>
                    )}

                    <Button className="w-full h-9" onClick={handleUpdateService} disabled={loading}>
                      {loading ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                  </div>
                )}

                {/* Atualizar status */}
                {detailOrder.status !== "delivered" && detailOrder.status !== "cancelled" && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atualizar Status</p>
                    <div className="flex flex-wrap gap-2">
                      {allStatuses.filter((s) => s !== detailOrder.status).map((s) => (
                        <Button key={s} variant="outline" size="sm" className="text-xs h-8"
                          onClick={() => updateStatus(detailOrder.id, s, detailOrder.status)}>
                          {statusConfig[s].label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {detailOrder.internal_notes && (
                  <div className="rounded-lg bg-muted/50 p-3 text-xs border-l-2 border-yellow-500">
                    <p className="font-semibold text-yellow-500 text-[10px] uppercase tracking-wide mb-1">Notas Internas</p>
                    <p>{detailOrder.internal_notes}</p>
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
