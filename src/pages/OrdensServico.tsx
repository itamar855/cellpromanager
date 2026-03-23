import { useEffect, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Plus, Wrench, Search, Clock, CheckCircle2, AlertCircle, Package,
  Phone, User, FileText, Send, Download, MessageCircle, DollarSign,
  ClipboardList,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDate = (d: string) => new Date(d).toLocaleString("pt-BR");

const TERMS = `1. O cliente declara que o aparelho foi entregue nas condições descritas neste documento.
2. A loja não se responsabiliza por dados contidos no aparelho. Recomenda-se backup prévio.
3. Em caso de não retirada do aparelho após 90 dias da conclusão do serviço, a loja poderá dispor do mesmo para cobrir custos.
4. A garantia do serviço cobre apenas o defeito reparado e a peça substituída pelo período de 90 dias.
5. O orçamento inicial pode sofrer alterações após análise técnica, mediante aprovação do cliente.
6. Peças e acessórios deixados junto ao aparelho são de responsabilidade do cliente.
7. A loja não se responsabiliza por danos causados por oxidação, quedas ou mau uso após a entrega.`;

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  open:             { label: "Aberta",               color: "bg-blue-500/15 text-blue-400 border-blue-500/20",       icon: Clock        },
  analyzing:        { label: "Em Análise",           color: "bg-accent/15 text-accent border-accent/20",             icon: AlertCircle  },
  waiting_part:     { label: "Aguardando Peça",      color: "bg-orange-500/15 text-orange-400 border-orange-500/20", icon: Package      },
  repairing:        { label: "Em Reparo",            color: "bg-purple-500/15 text-purple-400 border-purple-500/20", icon: Wrench       },
  waiting_approval: { label: "Aguard. Aprovação",    color: "bg-accent/15 text-accent border-accent/20",             icon: AlertCircle  },
  ready:            { label: "Pronta p/ Retirada",   color: "bg-primary/15 text-primary border-primary/20",          icon: CheckCircle2 },
  delivered:        { label: "Entregue",             color: "bg-muted text-muted-foreground border-border",          icon: CheckCircle2 },
  cancelled:        { label: "Cancelada",            color: "bg-destructive/15 text-destructive border-destructive/20", icon: AlertCircle },
};

const paymentLabels: Record<string, string> = {
  dinheiro: "Dinheiro", cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito", pix: "PIX", outro: "Outro",
};

const allStatuses = Object.keys(statusConfig);

// ── PDF generation via jsPDF (loaded dynamically) ─────────────────────────────
const loadJsPDF = (): Promise<any> =>
  new Promise((resolve, reject) => {
    if ((window as any).jspdf) { resolve((window as any).jspdf.jsPDF); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => resolve((window as any).jspdf.jsPDF);
    script.onerror = reject;
    document.head.appendChild(script);
  });

const loadQRCode = (): Promise<any> =>
  new Promise((resolve, reject) => {
    if ((window as any).QRCode) { resolve((window as any).QRCode); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    script.onload = () => resolve((window as any).QRCode);
    script.onerror = reject;
    document.head.appendChild(script);
  });

const generateQRDataUrl = async (text: string): Promise<string> => {
  await loadQRCode();
  return new Promise((resolve) => {
    const div = document.createElement("div");
    div.style.position = "fixed";
    div.style.left = "-9999px";
    document.body.appendChild(div);
    const qr = new (window as any).QRCode(div, {
      text, width: 128, height: 128, correctLevel: (window as any).QRCode.CorrectLevel.M,
    });
    setTimeout(() => {
      const img = div.querySelector("img") as HTMLImageElement;
      const canvas = div.querySelector("canvas") as HTMLCanvasElement;
      const dataUrl = canvas ? canvas.toDataURL() : (img ? img.src : "");
      document.body.removeChild(div);
      resolve(dataUrl);
    }, 300);
  });
};

// Pending cash entry
const createPendingCashEntry = async (storeId: string, userId: string, amount: number, description: string) => {
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

// ── PDF builders ──────────────────────────────────────────────────────────────
const buildBudgetPDF = async (order: any, storeName: string) => {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210; const margin = 15;

  // Header bar
  doc.setFillColor(22, 163, 74);
  doc.rect(0, 0, W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text("ORÇAMENTO DE SERVIÇO", margin, 12);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text(storeName, margin, 20);
  doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, W - margin, 20, { align: "right" });

  let y = 36;
  doc.setTextColor(30, 30, 30);

  const section = (title: string) => {
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, W - margin * 2, 7, "F");
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(22, 163, 74);
    doc.text(title, margin + 2, y + 5);
    doc.setTextColor(30, 30, 30);
    y += 10;
  };

  const row = (label: string, value: string, bold = false) => {
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text(label + ":", margin + 2, y);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(value || "—", margin + 50, y);
    y += 6;
  };

  section("CLIENTE");
  row("Nome", order.customer_name);
  if (order.customer_phone) row("Telefone", order.customer_phone);
  if (order.customer_cpf) row("CPF", order.customer_cpf);
  y += 2;

  section("APARELHO");
  row("Marca / Modelo", `${order.device_brand} ${order.device_model}`);
  if (order.device_imei) row("IMEI", order.device_imei);
  if (order.device_color) row("Cor", order.device_color);
  if (order.device_condition) row("Condição", order.device_condition);
  y += 2;

  section("SERVIÇO SOLICITADO");
  row("Serviço", order.requested_service);
  row("Defeito Relatado", order.reported_defect);
  y += 2;

  section("ORÇAMENTO");
  doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(22, 163, 74);
  doc.text(`Valor Estimado: ${formatCurrency(Number(order.estimated_price || 0))}`, margin + 2, y + 6);
  doc.setTextColor(30, 30, 30);
  y += 14;
  if (order.estimated_completion) {
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Previsão de conclusão: ${formatDate(order.estimated_completion)}`, margin + 2, y);
    y += 8;
  }

  // Validity note
  doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.setTextColor(100, 100, 100);
  doc.text("* Este orçamento tem validade de 7 dias. Os valores podem sofrer alterações após análise técnica completa.", margin, y, { maxWidth: W - margin * 2 });
  y += 12;

  // Footer
  doc.setDrawColor(22, 163, 74);
  doc.line(margin, y, W - margin, y);
  y += 6;
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
  doc.text("Para aprovar este orçamento ou tirar dúvidas, entre em contato conosco.", margin, y, { align: "left" });

  return doc;
};

const buildOSPDF = async (order: any, storeName: string) => {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210; const margin = 15;

  // QR Code
  const qrUrl = `${window.location.origin}/os/${order.id}`;
  let qrDataUrl = "";
  try { qrDataUrl = await generateQRDataUrl(qrUrl); } catch {}

  // Header
  doc.setFillColor(22, 163, 74);
  doc.rect(0, 0, W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text("ORDEM DE SERVIÇO", margin, 12);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text(storeName, margin, 20);
  doc.text(`OS #${order.order_number}   |   ${new Date(order.created_at).toLocaleDateString("pt-BR")}`, W - margin, 20, { align: "right" });

  let y = 36;
  doc.setTextColor(30, 30, 30);

  const section = (title: string) => {
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, W - margin * 2, 7, "F");
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(22, 163, 74);
    doc.text(title, margin + 2, y + 5);
    doc.setTextColor(30, 30, 30);
    y += 10;
  };

  const row = (label: string, value: string, bold = false) => {
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text(label + ":", margin + 2, y);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(value || "—", margin + 55, y);
    y += 6;
  };

  section("DADOS DO CLIENTE");
  row("Nome", order.customer_name);
  if (order.customer_phone) row("Telefone", order.customer_phone);
  if (order.customer_cpf) row("CPF", order.customer_cpf);
  y += 2;

  section("DADOS DO APARELHO");
  row("Marca / Modelo", `${order.device_brand} ${order.device_model}`);
  if (order.device_imei) row("IMEI", order.device_imei);
  if (order.device_color) row("Cor", order.device_color);
  if (order.device_condition) row("Condição Física", order.device_condition);
  if (order.device_accessories) row("Acessórios", order.device_accessories);
  if (order.device_password) row("Senha", order.device_password);
  y += 2;

  section("SERVIÇO");
  row("Serviço Solicitado", order.requested_service);
  row("Defeito Relatado", order.reported_defect);
  row("Valor Estimado", formatCurrency(Number(order.estimated_price || 0)));
  if (order.final_price) row("Valor Final", formatCurrency(Number(order.final_price)), true);
  if (order.payment_method) row("Forma de Pagamento", paymentLabels[order.payment_method] || order.payment_method);
  if (order.technician) row("Técnico", order.technician);
  if (order.estimated_completion) row("Previsão", formatDate(order.estimated_completion));
  row("Status", statusConfig[order.status]?.label || order.status);
  y += 2;

  // Terms
  section("TERMOS E CONDIÇÕES");
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50);
  const termsLines = doc.splitTextToSize(TERMS, W - margin * 2 - 4);
  doc.text(termsLines, margin + 2, y);
  y += termsLines.length * 4 + 4;

  // Signature
  if (order.signature_data) {
    section("ASSINATURA DO CLIENTE");
    try {
      doc.addImage(order.signature_data, "PNG", margin + 2, y, 80, 25);
      y += 30;
    } catch {}
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
    doc.text(`Assinado digitalmente em ${formatDate(order.created_at)}`, margin + 2, y);
    y += 8;
  }

  // Signature line for physical
  doc.setDrawColor(100, 100, 100);
  doc.line(margin, y + 10, margin + 80, y + 10);
  doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
  doc.text("Assinatura do Cliente", margin, y + 15);
  doc.line(W - margin - 60, y + 10, W - margin, y + 10);
  doc.text("Responsável pela Loja", W - margin - 60, y + 15);
  y += 22;

  // QR Code
  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, "PNG", W - margin - 28, y - 22, 26, 26);
      doc.setFontSize(6); doc.setTextColor(100, 100, 100);
      doc.text("Acompanhe sua OS", W - margin - 28, y + 5);
    } catch {}
  }

  return doc;
};

// ── Component ─────────────────────────────────────────────────────────────────
const OrdensServico = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Tables<"service_orders">[]>([]);
  const [stores, setStores] = useState<Tables<"stores">[]>([]);
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Tables<"service_orders"> | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [signatureData, setSignatureData] = useState("");

  // OS form
  const emptyForm = {
    customer_name: "", customer_phone: "", customer_cpf: "",
    device_brand: "iPhone", device_model: "", device_imei: "", device_color: "",
    device_condition: "", device_password: "", device_accessories: "",
    reported_defect: "", requested_service: "",
    store_id: "", estimated_price: "", estimated_completion: "",
    terms_accepted: false, internal_notes: "",
    technician: "", final_price: "", payment_method: "",
  };
  const [form, setForm] = useState(emptyForm);

  // Budget form (lighter)
  const emptyBudget = {
    customer_name: "", customer_phone: "",
    device_brand: "iPhone", device_model: "", device_imei: "",
    device_condition: "", reported_defect: "", requested_service: "",
    store_id: "", estimated_price: "", notes: "",
  };
  const [budgetForm, setBudgetForm] = useState(emptyBudget);

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

  useEffect(() => {
    const channel = supabase.channel("service_orders_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_orders" }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const storeMap = new Map(stores.map((s) => [s.id, s.name]));

  // ── Submit OS ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("service_orders").insert({
      customer_name: form.customer_name, customer_phone: form.customer_phone || null,
      customer_cpf: form.customer_cpf || null, device_brand: form.device_brand,
      device_model: form.device_model, device_imei: form.device_imei || null,
      device_color: form.device_color || null, device_condition: form.device_condition || null,
      device_password: form.device_password || null, device_accessories: form.device_accessories || null,
      reported_defect: form.reported_defect, requested_service: form.requested_service,
      store_id: form.store_id || null,
      estimated_price: form.estimated_price ? parseFloat(form.estimated_price) : 0,
      estimated_completion: form.estimated_completion || null,
      terms_accepted: form.terms_accepted, signature_data: signatureData || null,
      internal_notes: form.internal_notes || null,
      technician: (form as any).technician || null,
      created_by: user.id, status: "open",
    } as any);
    if (error) { toast.error("Erro ao criar OS: " + error.message); }
    else { toast.success("OS criada!"); setDialogOpen(false); setForm(emptyForm); setSignatureData(""); fetchData(); }
    setLoading(false);
  };

  // ── Generate budget PDF ────────────────────────────────────────────────────
  const handleBudgetPDF = async (download: boolean) => {
    if (!budgetForm.customer_name || !budgetForm.device_model) {
      toast.error("Preencha pelo menos nome do cliente e modelo do aparelho!");
      return;
    }
    setPdfLoading(true);
    try {
      const storeName = storeMap.get(budgetForm.store_id) || "CellManager";
      const fakeOrder = {
        ...budgetForm,
        id: "orcamento",
        order_number: "ORC",
        created_at: new Date().toISOString(),
        status: "open",
        final_price: null,
        delivered_at: null,
        signature_data: null,
        payment_method: null,
        technician: null,
      };
      const doc = await buildBudgetPDF(fakeOrder, storeName);
      const fileName = `orcamento_${budgetForm.customer_name.replace(/\s+/g, "_")}.pdf`;

      if (download) {
        doc.save(fileName);
        toast.success("PDF do orçamento gerado!");
      } else {
        // WhatsApp: save + open wa.me
        doc.save(fileName);
        const phone = budgetForm.customer_phone.replace(/\D/g, "");
        const msg = encodeURIComponent(
          `Olá ${budgetForm.customer_name}! Segue o orçamento para o serviço no seu ${budgetForm.device_brand} ${budgetForm.device_model}.\n\nValor estimado: ${formatCurrency(parseFloat(budgetForm.estimated_price) || 0)}\n\nO PDF foi salvo no seu dispositivo. Qualquer dúvida, estamos à disposição! 😊`
        );
        const waUrl = phone
          ? `https://wa.me/55${phone}?text=${msg}`
          : `https://wa.me/?text=${msg}`;
        window.open(waUrl, "_blank");
        toast.success("PDF salvo! WhatsApp aberto.");
      }
    } catch (err) {
      toast.error("Erro ao gerar PDF");
    }
    setPdfLoading(false);
  };

  // ── Generate OS PDF ────────────────────────────────────────────────────────
  const handleOSPDF = async (order: Tables<"service_orders">, openWhatsApp = false) => {
    setPdfLoading(true);
    try {
      const storeName = storeMap.get(order.store_id || "") || "CellManager";
      const doc = await buildOSPDF(order, storeName);
      const fileName = `OS_${order.order_number}_${order.customer_name.replace(/\s+/g, "_")}.pdf`;
      doc.save(fileName);

      if (openWhatsApp) {
        const phone = (order.customer_phone || "").replace(/\D/g, "");
        const msg = encodeURIComponent(
          `Olá ${order.customer_name}! Segue a OS #${order.order_number} referente ao serviço no seu ${order.device_brand} ${order.device_model}.\n\nStatus atual: ${statusConfig[order.status]?.label}\n\nO PDF foi salvo no seu dispositivo. Em caso de dúvidas, entre em contato! 😊`
        );
        const waUrl = phone ? `https://wa.me/55${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
        window.open(waUrl, "_blank");
        toast.success("PDF salvo! WhatsApp aberto.");
      } else {
        toast.success("PDF da OS gerado!");
      }
    } catch (err) {
      toast.error("Erro ao gerar PDF");
    }
    setPdfLoading(false);
  };

  // ── Update status ──────────────────────────────────────────────────────────
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
      if (order?.store_id) {
        const amount = Number((order as any).final_price || order.estimated_price || 0);
        const desc = `OS #${order.order_number} — ${order.requested_service} (${order.customer_name})`;
        await createPendingCashEntry(order.store_id, user.id, amount, desc);
        if (amount > 0) toast.info("Entrada pendente criada no caixa.");
      }
    }

    toast.success(`Status: ${statusConfig[newStatus]?.label}`);
    fetchData();
    if (detailOrder?.id === orderId) setDetailOrder({ ...detailOrder, status: newStatus } as any);
  };

  // ── Update detail fields (final price, payment, technician) ───────────────
  const updateOrderField = async (orderId: string, fields: Record<string, any>) => {
    const { error } = await supabase.from("service_orders").update(fields as any).eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    toast.success("Atualizado!");
    fetchData();
    setDetailOrder(prev => prev ? { ...prev, ...fields } as any : prev);
  };

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const match =
      o.customer_name.toLowerCase().includes(q) ||
      (o.device_imei && o.device_imei.includes(search)) ||
      (o.device_model && o.device_model.toLowerCase().includes(q)) ||
      String(o.order_number).includes(search);
    return match && (filterStatus === "all" || o.status === filterStatus);
  });

  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1; return acc;
  }, {} as Record<string, number>);

  // ── Detail local state ─────────────────────────────────────────────────────
  const [editFinalPrice, setEditFinalPrice] = useState("");
  const [editPayment, setEditPayment] = useState("");
  const [editTechnician, setEditTechnician] = useState("");

  useEffect(() => {
    if (detailOrder) {
      setEditFinalPrice(String((detailOrder as any).final_price || ""));
      setEditPayment((detailOrder as any).payment_method || "");
      setEditTechnician((detailOrder as any).technician || "");
    }
  }, [detailOrder]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Ordens de Serviço</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{orders.length} ordens registradas</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {/* ── Botão Orçamento ── */}
          <Dialog open={budgetDialogOpen} onOpenChange={(o) => { setBudgetDialogOpen(o); if (!o) setBudgetForm(emptyBudget); }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 h-10">
                <ClipboardList className="h-4 w-4 text-blue-400" /> Gerar Orçamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-blue-400" /> Orçamento de Serviço
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-400">
                  Gere um PDF de orçamento para enviar ao cliente antes de abrir a OS.
                </div>

                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><User className="h-3 w-3" /> Cliente</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome *</Label>
                    <Input value={budgetForm.customer_name} onChange={e => setBudgetForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Nome completo" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Telefone (WhatsApp)</Label>
                    <Input value={budgetForm.customer_phone} onChange={e => setBudgetForm(f => ({ ...f, customer_phone: e.target.value }))} placeholder="(87) 99999-9999" className="h-10" />
                  </div>
                </div>

                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Phone className="h-3 w-3" /> Aparelho</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Marca</Label>
                    <Select value={budgetForm.device_brand} onValueChange={v => setBudgetForm(f => ({ ...f, device_brand: v }))}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>{["iPhone","Samsung","Xiaomi","Motorola","Outro"].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Modelo *</Label>
                    <Input value={budgetForm.device_model} onChange={e => setBudgetForm(f => ({ ...f, device_model: e.target.value }))} placeholder="iPhone 13 Pro" className="h-10" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">IMEI</Label>
                    <Input value={budgetForm.device_imei} onChange={e => setBudgetForm(f => ({ ...f, device_imei: e.target.value }))} placeholder="Opcional" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Condição</Label>
                    <Input value={budgetForm.device_condition} onChange={e => setBudgetForm(f => ({ ...f, device_condition: e.target.value }))} placeholder="Tela trincada" className="h-10" />
                  </div>
                </div>

                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Wrench className="h-3 w-3" /> Serviço</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Defeito Relatado</Label>
                  <Input value={budgetForm.reported_defect} onChange={e => setBudgetForm(f => ({ ...f, reported_defect: e.target.value }))} placeholder="Caiu no chão, tela quebrou" className="h-10" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Serviço</Label>
                    <Select value={budgetForm.requested_service} onValueChange={v => setBudgetForm(f => ({ ...f, requested_service: v }))}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {["Troca de Tela","Troca de Bateria","Reparo de Placa","Troca de Conector","Troca de Câmera","Desbloqueio","Formatação","Diagnóstico","Outro"].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor Estimado (R$) *</Label>
                    <Input type="number" step="0.01" value={budgetForm.estimated_price} onChange={e => setBudgetForm(f => ({ ...f, estimated_price: e.target.value }))} placeholder="350.00" className="h-10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Loja</Label>
                  <Select value={budgetForm.store_id} onValueChange={v => setBudgetForm(f => ({ ...f, store_id: v }))}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                    <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Observações</Label>
                  <Textarea value={budgetForm.notes} onChange={e => setBudgetForm(f => ({ ...f, notes: e.target.value }))} placeholder="Informações adicionais..." className="min-h-[60px]" />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button variant="outline" className="h-11 gap-2" onClick={() => handleBudgetPDF(true)} disabled={pdfLoading}>
                    <Download className="h-4 w-4" /> Baixar PDF
                  </Button>
                  <Button className="h-11 gap-2 bg-green-600 hover:bg-green-700" onClick={() => handleBudgetPDF(false)} disabled={pdfLoading}>
                    <MessageCircle className="h-4 w-4" /> Enviar WhatsApp
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* ── Botão Nova OS ── */}
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setForm(emptyForm); setSignatureData(""); } }}>
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
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><User className="h-3 w-3" /> Dados do Cliente</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs">Nome *</Label><Input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} placeholder="Nome completo" required className="h-10" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Telefone</Label><Input value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} placeholder="(87) 99999-9999" className="h-10" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">CPF</Label><Input value={form.customer_cpf} onChange={e => setForm({ ...form, customer_cpf: e.target.value })} placeholder="000.000.000-00" className="h-10" /></div>
                  </div>
                </div>

                {/* Aparelho */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Phone className="h-3 w-3" /> Dados do Aparelho</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Marca *</Label>
                      <Select value={form.device_brand} onValueChange={v => setForm({ ...form, device_brand: v })}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>{["iPhone","Samsung","Xiaomi","Motorola","Huawei","Outro"].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label className="text-xs">Modelo *</Label><Input value={form.device_model} onChange={e => setForm({ ...form, device_model: e.target.value })} placeholder="iPhone 13 Pro" required className="h-10" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">IMEI</Label><Input value={form.device_imei} onChange={e => setForm({ ...form, device_imei: e.target.value })} placeholder="Obrigatório" className="h-10" /></div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs">Cor</Label><Input value={form.device_color} onChange={e => setForm({ ...form, device_color: e.target.value })} placeholder="Preto" className="h-10" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Senha</Label><Input value={form.device_password} onChange={e => setForm({ ...form, device_password: e.target.value })} placeholder="****" className="h-10" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Acessórios</Label><Input value={form.device_accessories} onChange={e => setForm({ ...form, device_accessories: e.target.value })} placeholder="Carregador, capa" className="h-10" /></div>
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs">Condição Física</Label><Textarea value={form.device_condition} onChange={e => setForm({ ...form, device_condition: e.target.value })} placeholder="Descreva avarias existentes..." className="min-h-[60px]" /></div>
                </div>

                {/* Serviço */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Wrench className="h-3 w-3" /> Serviço</p>
                  <div className="space-y-1.5"><Label className="text-xs">Defeito Relatado *</Label><Textarea value={form.reported_defect} onChange={e => setForm({ ...form, reported_defect: e.target.value })} placeholder="Problema relatado pelo cliente" required className="min-h-[60px]" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Serviço Solicitado *</Label>
                      <Select value={form.requested_service} onValueChange={v => setForm({ ...form, requested_service: v })}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{["Troca de Tela","Troca de Bateria","Reparo de Placa","Troca de Conector","Troca de Câmera","Desbloqueio","Formatação","Diagnóstico","Outro"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label className="text-xs">Técnico Responsável</Label><Input value={(form as any).technician} onChange={e => setForm({ ...form, technician: e.target.value } as any)} placeholder="Nome do técnico" className="h-10" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs">Valor Estimado (R$)</Label><Input type="number" step="0.01" value={form.estimated_price} onChange={e => setForm({ ...form, estimated_price: e.target.value })} placeholder="150.00" className="h-10" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Previsão de Entrega</Label><Input type="datetime-local" value={form.estimated_completion} onChange={e => setForm({ ...form, estimated_completion: e.target.value })} className="h-10" /></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Loja</Label>
                    <Select value={form.store_id} onValueChange={v => setForm({ ...form, store_id: v })}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                      <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Termos */}
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Termos e Condições</p>
                  <div className="rounded bg-muted/40 p-2 max-h-32 overflow-y-auto">
                    <p className="text-[10px] text-muted-foreground leading-relaxed whitespace-pre-line">{TERMS}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.terms_accepted} onCheckedChange={v => setForm({ ...form, terms_accepted: v })} />
                    <Label className="text-xs">Cliente leu e aceita os termos acima</Label>
                  </div>
                </div>

                <SignatureCanvas onSave={setSignatureData} initialData={signatureData} />

                <div className="space-y-1.5"><Label className="text-xs">Observações Internas</Label><Textarea value={form.internal_notes} onChange={e => setForm({ ...form, internal_notes: e.target.value })} placeholder="Notas internas..." className="min-h-[50px]" /></div>

                <Button type="submit" className="w-full h-11 font-semibold" disabled={loading || !form.requested_service}>
                  {loading ? "Criando..." : "Abrir Ordem de Serviço"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Button variant={filterStatus === "all" ? "default" : "outline"} size="sm" className="h-7 text-xs shrink-0" onClick={() => setFilterStatus("all")}>Todas ({orders.length})</Button>
        {allStatuses.filter(s => statusCounts[s]).map(s => (
          <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm" className="h-7 text-xs shrink-0" onClick={() => setFilterStatus(s)}>
            {statusConfig[s].label} ({statusCounts[s]})
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, IMEI, modelo ou nº da OS..." className="pl-9 h-10" />
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length > 0 ? filtered.map(order => {
          const sc = statusConfig[order.status] || statusConfig.open;
          return (
            <Card key={order.id} className="border-border/50 shadow-lg shadow-black/10 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setDetailOrder(order)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">#{order.order_number}</span>
                      <p className="font-medium text-sm truncate">{order.customer_name}</p>
                      <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{order.device_brand} {order.device_model}{order.device_imei && ` · IMEI: ${order.device_imei}`}</p>
                    <p className="text-xs text-muted-foreground">{order.requested_service} · {storeMap.get(order.store_id || "") || "—"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display font-bold text-sm">{formatCurrency(Number(order.estimated_price || 0))}</p>
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

      {/* ── Detail Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={!!detailOrder} onOpenChange={open => !open && setDetailOrder(null)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          {detailOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <span className="text-muted-foreground font-mono text-sm">#{detailOrder.order_number}</span>
                  OS — {detailOrder.customer_name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {/* Status + dates */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={statusConfig[detailOrder.status]?.color}>{statusConfig[detailOrder.status]?.label}</Badge>
                  <span className="text-xs text-muted-foreground">Criada em {formatDate(detailOrder.created_at)}</span>
                  {detailOrder.delivered_at && <span className="text-xs text-muted-foreground">· Entregue em {formatDate(detailOrder.delivered_at)}</span>}
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
                  {detailOrder.device_password && <p>Senha: {detailOrder.device_password}</p>}
                </div>

                {/* Serviço */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-xs">
                  <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide">Serviço</p>
                  <p><span className="text-muted-foreground">Defeito:</span> {detailOrder.reported_defect}</p>
                  <p><span className="text-muted-foreground">Serviço:</span> {detailOrder.requested_service}</p>
                  <p><span className="text-muted-foreground">Valor Estimado:</span> {formatCurrency(Number(detailOrder.estimated_price || 0))}</p>
                  {(detailOrder as any).final_price > 0 && <p><span className="text-muted-foreground">Valor Final:</span> <strong>{formatCurrency(Number((detailOrder as any).final_price))}</strong></p>}
                  {(detailOrder as any).payment_method && <p><span className="text-muted-foreground">Pagamento:</span> {paymentLabels[(detailOrder as any).payment_method] || (detailOrder as any).payment_method}</p>}
                  {(detailOrder as any).technician && <p><span className="text-muted-foreground">Técnico:</span> {(detailOrder as any).technician}</p>}
                  {detailOrder.estimated_completion && <p><span className="text-muted-foreground">Previsão:</span> {formatDate(detailOrder.estimated_completion)}</p>}
                  {detailOrder.store_id && <p><span className="text-muted-foreground">Loja:</span> {storeMap.get(detailOrder.store_id) || "—"}</p>}
                </div>

                {/* Editar campos operacionais */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1"><DollarSign className="h-3 w-3" /> Atualizar Serviço</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor Final (R$)</Label>
                      <Input type="number" step="0.01" value={editFinalPrice} onChange={e => setEditFinalPrice(e.target.value)} placeholder="0.00" className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Técnico</Label>
                      <Input value={editTechnician} onChange={e => setEditTechnician(e.target.value)} placeholder="Nome" className="h-9 text-xs" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Forma de Pagamento</Label>
                    <Select value={editPayment} onValueChange={setEditPayment}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{Object.entries(paymentLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" className="w-full h-8 text-xs" onClick={() => updateOrderField(detailOrder.id, {
                    final_price: editFinalPrice ? parseFloat(editFinalPrice) : null,
                    payment_method: editPayment || null,
                    technician: editTechnician || null,
                  })}>Salvar Alterações</Button>
                </div>

                {/* Termos */}
                <div className="rounded-lg bg-muted/50 p-3 text-xs">
                  <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-1">Termos e Condições</p>
                  <div className="max-h-24 overflow-y-auto">
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-[10px]">{TERMS}</p>
                  </div>
                  <p className="mt-1 text-primary text-[10px]">{detailOrder.terms_accepted ? "✓ Cliente aceitou os termos" : "✗ Termos não aceitos"}</p>
                </div>

                {/* Assinatura */}
                {detailOrder.signature_data && (
                  <div className="rounded-lg bg-muted/50 p-3 text-xs">
                    <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide mb-2">Assinatura do Cliente</p>
                    <img src={detailOrder.signature_data} alt="Assinatura" className="max-h-24 rounded border border-border bg-white" />
                  </div>
                )}

                {/* Notas internas */}
                {detailOrder.internal_notes && (
                  <div className="rounded-lg bg-muted/50 p-3 text-xs">
                    <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide">Notas Internas</p>
                    <p className="mt-1">{detailOrder.internal_notes}</p>
                  </div>
                )}

                <Separator />

                {/* Atualizar status */}
                {detailOrder.status !== "delivered" && detailOrder.status !== "cancelled" && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atualizar Status</p>
                    <div className="flex flex-wrap gap-2">
                      {allStatuses.filter(s => s !== detailOrder.status).map(s => (
                        <Button key={s} variant="outline" size="sm" className="text-xs h-8"
                          onClick={() => updateStatus(detailOrder.id, s, detailOrder.status)}>
                          {statusConfig[s].label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* PDF / WhatsApp */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Button variant="outline" className="h-10 gap-2 text-xs" onClick={() => handleOSPDF(detailOrder, false)} disabled={pdfLoading}>
                    <Download className="h-4 w-4" /> Baixar PDF
                  </Button>
                  <Button className="h-10 gap-2 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleOSPDF(detailOrder, true)} disabled={pdfLoading}>
                    <MessageCircle className="h-4 w-4" /> Enviar WhatsApp
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdensServico;
