import React, { useEffect, useState, useRef } from "react";
import SignatureCanvas from "@/components/SignatureCanvas";
import { AndroidPatternLock } from "@/components/AndroidPatternLock";
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
  Printer, ChevronRight, ChevronLeft, Camera, Upload, Receipt,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { KanbanBoard } from "@/components/KanbanBoard";
import { OsChecklist, ChecklistData } from "@/components/OsChecklist";
import { OsPhotoGallery } from "@/components/OsPhotoGallery";
import { OsParts } from "@/components/OsParts";
import { triggerWebhook } from "@/utils/webhookSender";
import { logAction } from "@/utils/auditLogger";

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

// ── Cria cash_entry pendente no caixa aberto ou solto na loja ──────────────────────────────
const createPendingCashEntry = async (
  storeId: string, userId: string, amount: number, description: string,
) => {
  if (!storeId || amount <= 0) return;
  const { data: register } = await supabase
    .from("cash_registers" as any).select("id")
    .eq("store_id", storeId).eq("status", "open").maybeSingle();
  
  const registerId = register ? (register as any).id : null;
  await supabase.from("cash_entries" as any).insert({
    cash_register_id: registerId, store_id: storeId,
    type: "entrada", amount, description,
    payment_method: "dinheiro", receipt_url: null,
    confirmed: false, created_by: userId,
  });
};

// ── Gera PDF via jsPDF (importado dinamicamente) ──────────────────────────
const generateOSPdf = async (order: any, store: any, techName: string, publicUrl: string) => {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 12; // margins
  const CW = W - M * 2; // content width
  let y = 0;

  // ── B&W PALETTE ─────────────────────────────────────────────
  const BLACK: [number, number, number] = [0, 0, 0];
  const DARK: [number, number, number] = [33, 33, 33];
  const MID: [number, number, number] = [100, 100, 100];
  const SOFT: [number, number, number] = [160, 160, 160];
  const LIGHT: [number, number, number] = [220, 220, 220];
  const BG: [number, number, number] = [245, 245, 245];
  const WHITE: [number, number, number] = [255, 255, 255];

  const ensureSpace = (needed: number) => {
    if (y + needed > 278) { doc.addPage(); y = M; }
  };

  const storeName = store?.name || "Assistencia Tecnica";

  // ══════════════════════════════════════════════════════════════════════════
  //  HEADER — Solid black bar with white text
  // ══════════════════════════════════════════════════════════════════════════
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, W, 28, "F");

  let tx = M;
  if (store?.logo_url) {
    try {
      // White circle behind logo
      doc.setFillColor(...WHITE);
      doc.circle(M + 8, 14, 9, "F");
      doc.addImage(store.logo_url, "PNG", M + 1.5, 7.5, 13, 13);
      tx = M + 22;
    } catch (_) {}
  }

  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...WHITE);
  doc.text(storeName.toUpperCase(), tx, 13);

  // Sub-info line
  const hParts: string[] = [];
  if (store?.cnpj) hParts.push(`CNPJ: ${store.cnpj}`);
  if (store?.phone) hParts.push(store.phone);
  if (store?.address) hParts.push(store.address);
  if (store?.instagram) hParts.push(store.instagram);
  if (hParts.length) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(180, 180, 180);
    doc.text(hParts.join("   |   "), tx, 19);
  }

  // OS number badge (right side)
  doc.setFillColor(...WHITE);
  doc.roundedRect(W - M - 40, 5, 40, 18, 2, 2, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MID);
  doc.text("ORDEM DE SERVICO", W - M - 20, 12, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...BLACK);
  doc.text(`#${order.order_number}`, W - M - 20, 20, { align: "center" });

  y = 32;

  // ══════════════════════════════════════════════════════════════════════════
  //  STATUS + DATE ROW
  // ══════════════════════════════════════════════════════════════════════════
  const statusLabel = statusConfig[order.status]?.label ?? order.status;
  const dateStr = new Date(order.created_at).toLocaleString("pt-BR");

  // Status pill (left)
  doc.setFillColor(...BLACK);
  const statusW = doc.getStringUnitWidth(statusLabel.toUpperCase()) * 9 / doc.internal.scaleFactor + 12;
  doc.roundedRect(M, y, Math.max(statusW, 40), 8, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...WHITE);
  doc.text(statusLabel.toUpperCase(), M + 5, y + 5.5);

  // Date (right)
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MID);
  doc.text(`Emitida em ${dateStr}`, W - M, y + 5.5, { align: "right" });

  y += 14;

  // ══════════════════════════════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  // Section box with solid top border
  const sectionBox = (title: string, contentFn: () => void) => {
    ensureSpace(30);
    const startY = y;

    // Title bar
    doc.setFillColor(...BLACK);
    doc.rect(M, y, CW, 7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...WHITE);
    doc.text(title.toUpperCase(), M + 4, y + 5);
    y += 10;

    // Content
    contentFn();

    // Draw box border around content
    const boxH = y - startY - 7;
    doc.setDrawColor(...LIGHT);
    doc.setLineWidth(0.3);
    doc.rect(M, startY + 7, CW, boxH);
    doc.setLineWidth(0.1);

    y += 4;
  };

  // Field renderer
  const printVal = (label: string, value: string, x: number, maxW: number) => {
    if (!value || value === "-") return 0;
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(...SOFT);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(String(value), maxW);
    doc.text(lines, x, y + 4);
    return 5.5 + (lines.length - 1) * 4;
  };

  // Two-column layout
  const twoCol = (l1: string, v1: string, l2: string, v2: string) => {
    ensureSpace(14);
    const colW = (CW - 8) / 2;
    const yB = y;
    const h1 = printVal(l1, v1, M + 4, colW);
    y = yB;
    const h2 = printVal(l2, v2, M + 4 + colW + 4, colW);
    y = yB + Math.max(h1, h2) + 2;
  };

  // Three-column layout
  const threeCol = (l1: string, v1: string, l2: string, v2: string, l3: string, v3: string) => {
    ensureSpace(14);
    const colW = (CW - 12) / 3;
    const yB = y;
    const h1 = printVal(l1, v1, M + 4, colW);
    y = yB;
    const h2 = printVal(l2, v2, M + 4 + colW + 4, colW);
    y = yB;
    const h3 = printVal(l3, v3, M + 4 + (colW + 4) * 2, colW);
    y = yB + Math.max(h1, h2, h3) + 2;
  };

  // Full-width field
  const fullField = (label: string, value: string) => {
    if (!value) return;
    ensureSpace(12);
    const h = printVal(label, value, M + 4, CW - 8);
    y += h + 1;
  };

  // Divider line inside a section
  const divider = () => {
    doc.setDrawColor(...LIGHT); doc.setLineWidth(0.15);
    doc.line(M + 4, y, W - M - 4, y);
    doc.setLineWidth(0.1);
    y += 3;
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 1: CLIENTE
  // ══════════════════════════════════════════════════════════════════════════
  sectionBox("DADOS DO CLIENTE", () => {
    twoCol("Nome Completo", order.customer_name || "", "Telefone", order.customer_phone || "");
    if (order.customer_cpf) {
      divider();
      fullField("CPF / Documento", order.customer_cpf);
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 2: APARELHO
  // ══════════════════════════════════════════════════════════════════════════
  sectionBox("APARELHO RECEBIDO", () => {
    twoCol("Marca", order.device_brand || "", "Modelo", order.device_model || "");
    divider();
    threeCol(
      "Cor", order.device_color || "-",
      "IMEI", order.device_imei || "-",
      "Acessorios", order.device_accessories || "-"
    );

    if (order.device_password) {
      divider();
      // Password highlighted box
      doc.setFillColor(...BG);
      doc.roundedRect(M + 3, y - 1, CW - 6, 11, 1, 1, "F");
      doc.setDrawColor(...DARK); doc.setLineWidth(0.4);
      doc.roundedRect(M + 3, y - 1, CW - 6, 11, 1, 1, "S");
      doc.setLineWidth(0.1);
      doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor(...MID);
      doc.text("SENHA / PADRAO DE DESBLOQUEIO", M + 7, y + 3);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...BLACK);
      doc.text(String(order.device_password), M + 7, y + 8);
      y += 13;
    }

    if (order.device_condition) {
      divider();
      fullField("Condicao Fisica do Aparelho", order.device_condition);
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 3: SERVICO SOLICITADO
  // ══════════════════════════════════════════════════════════════════════════
  sectionBox("SERVICO SOLICITADO", () => {
    fullField("Defeito Relatado pelo Cliente", order.reported_defect || "");
    divider();
    fullField("Servico a Realizar", order.requested_service || "");
    if (techName) {
      divider();
      fullField("Tecnico Responsavel", techName);
    }
    if (order.internal_notes) {
      divider();
      fullField("Observacoes Internas", order.internal_notes);
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 4: VALORES (ORCAMENTO)
  // ══════════════════════════════════════════════════════════════════════════
  sectionBox("ORCAMENTO / VALORES", () => {
    // Big price display
    const halfW = (CW - 8) / 2;

    // Estimated price
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(...SOFT);
    doc.text("VALOR ESTIMADO", M + 4, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...DARK);
    doc.text(formatCurrency(Number(order.estimated_price || 0)), M + 4, y + 7);

    // Final price
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(...SOFT);
    doc.text("VALOR FINAL", M + 4 + halfW + 4, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...BLACK);
    doc.text(order.final_price ? formatCurrency(Number(order.final_price)) : "-", M + 4 + halfW + 4, y + 7);

    // Vertical separator
    doc.setDrawColor(...LIGHT); doc.setLineWidth(0.3);
    doc.line(M + halfW + 4, y - 2, M + halfW + 4, y + 9);
    doc.setLineWidth(0.1);

    y += 11;

    if (order.estimated_completion) {
      divider();
      fullField("Previsao de Entrega", new Date(order.estimated_completion).toLocaleString("pt-BR"));
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 5: PAGAMENTO (se houver)
  // ══════════════════════════════════════════════════════════════════════════
  const hasPay = [order.payment_cash, order.payment_card, order.payment_pix, order.payment_other].some(v => Number(v) > 0);
  if (hasPay) {
    sectionBox("PAGAMENTO RECEBIDO", () => {
      const pays: [string, number][] = [];
      if (Number(order.payment_cash) > 0)  pays.push(["Dinheiro", Number(order.payment_cash)]);
      if (Number(order.payment_card) > 0)  pays.push(["Cartao",   Number(order.payment_card)]);
      if (Number(order.payment_pix) > 0)   pays.push(["PIX",      Number(order.payment_pix)]);
      if (Number(order.payment_other) > 0) pays.push(["Outro",    Number(order.payment_other)]);
      const total = pays.reduce((s, [, v]) => s + v, 0);

      pays.forEach(([label, val]) => {
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...DARK);
        doc.text(label, M + 6, y);
        doc.setFont("helvetica", "bold");
        doc.text(formatCurrency(val), W - M - 6, y, { align: "right" });
        y += 5.5;
      });

      // Total
      doc.setDrawColor(...BLACK); doc.setLineWidth(0.5);
      doc.line(M + 4, y, W - M - 4, y);
      doc.setLineWidth(0.1);
      y += 5;
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...BLACK);
      doc.text("TOTAL", M + 6, y);
      doc.text(formatCurrency(total), W - M - 6, y, { align: "right" });
      y += 4;

      if (order.payment_notes) {
        divider();
        fullField("Observacao de Pagamento", order.payment_notes);
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 6: TERMOS E CONDICOES
  // ══════════════════════════════════════════════════════════════════════════
  ensureSpace(55);
  sectionBox("TERMOS E CONDICOES", () => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(...MID);
    const termsLines = doc.splitTextToSize(TERMS_TEXT, CW - 10);
    ensureSpace(termsLines.length * 3 + 4);
    doc.text(termsLines, M + 5, y);
    y += termsLines.length * 3 + 2;
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  SECTION 7: ASSINATURA
  // ══════════════════════════════════════════════════════════════════════════
  ensureSpace(45);
  if (order.signature_data) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(...MID);
    doc.text("ASSINATURA DO CLIENTE:", M, y); y += 3;
    try {
      doc.addImage(order.signature_data, "PNG", M, y, 65, 24);
      y += 27;
    } catch (_) {}
    doc.setDrawColor(...BLACK); doc.setLineWidth(0.5);
    doc.line(M, y, M + 70, y);
    doc.setLineWidth(0.1);
    y += 4;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MID);
    doc.text(order.customer_name || "Cliente", M, y);
    y += 8;
  } else {
    // Two blank signature areas
    const sigW = (CW - 20) / 2;
    doc.setDrawColor(...BLACK); doc.setLineWidth(0.5);
    doc.line(M, y + 20, M + sigW, y + 20);
    doc.line(W - M - sigW, y + 20, W - M, y + 20);
    doc.setLineWidth(0.1);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MID);
    doc.text("Assinatura do Cliente", M, y + 25);
    doc.text("Assinatura / Carimbo da Loja", W - M - sigW, y + 25);
    y += 30;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  LINK DE ACOMPANHAMENTO
  // ══════════════════════════════════════════════════════════════════════════
  ensureSpace(16);
  doc.setDrawColor(...BLACK); doc.setLineWidth(0.5);
  doc.roundedRect(M, y, CW, 12, 1.5, 1.5, "S");
  doc.setLineWidth(0.1);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(...BLACK);
  doc.text("ACOMPANHE SUA OS ONLINE:", M + 5, y + 5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MID);
  doc.text(publicUrl, M + 5, y + 9.5);
  y += 16;

  // ══════════════════════════════════════════════════════════════════════════
  //  RODAPE (todas as paginas)
  // ══════════════════════════════════════════════════════════════════════════
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BLACK); doc.setLineWidth(0.3);
    doc.line(M, 286, W - M, 286);
    doc.setLineWidth(0.1);

    if (store?.pdf_footer) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(6.5); doc.setTextColor(...MID);
      doc.text(store.pdf_footer, W / 2, 290, { align: "center", maxWidth: CW });
    }

    doc.setFont("helvetica", "normal"); doc.setFontSize(6); doc.setTextColor(...SOFT);
    doc.text(
      `${storeName}  |  ${new Date().toLocaleString("pt-BR")}  |  CellManager PRO  |  ${i}/${pageCount}`,
      W / 2, 294, { align: "center" }
    );
  }

  return doc;
};

// ── Gera Cupom 80mm ──────────────────────────
const generateThermalPdf = async (order: any, store: any, techName: string, publicUrl: string) => {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: [80, 200] }); // Formato contínuo 80mm
  let y = 10;
  const W = 80;
  
  const textC = (t: string, size=10, bold=false) => {
    doc.setFontSize(size); doc.setFont("helvetica", bold ? "bold" : "normal");
    const arr = doc.splitTextToSize(t, W - 10);
    doc.text(arr, W / 2, y, { align: "center" });
    y += arr.length * (size/2.5) + 3;
  };
  
  const textL = (l: string, v: string) => {
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text(l + ":", 5, y);
    doc.setFont("helvetica", "normal");
    const arr = doc.splitTextToSize(v, W - 10 - doc.getTextWidth(l + ": "));
    doc.text(arr, 5 + doc.getTextWidth(l + ": "), y);
    y += arr.length * 3 + 3;
  };
  
  const line = () => { doc.line(5, y, W-5, y); y += 4; };

  textC(store?.name || "Assistência Técnica", 12, true);
  if (store?.cnpj) textC(`CNPJ: ${store.cnpj}`, 8);
  if (store?.phone) textC(`Tel: ${store.phone}`, 8);
  line();
  textC(`ORDEM DE SERVIÇO #${order.order_number}`, 10, true);
  textC(new Date(order.created_at).toLocaleString("pt-BR"), 8);
  line();
  textL("Cliente", order.customer_name);
  if (order.customer_phone) textL("Tel", order.customer_phone);
  line();
  textL("Aparelho", `${order.device_brand} ${order.device_model}`);
  textL("Defeito", order.reported_defect);
  textL("Serviço", order.requested_service);
  if (order.final_price) textL("Valor", formatCurrency(Number(order.final_price)));
  else textL("Orçamento", formatCurrency(Number(order.estimated_price || 0)));
  line();
  textC("Acompanhe online:", 8);
  textC(publicUrl, 7);
  y += 10;
  textC("-----------------------------", 8);
  textC("Assinatura do Cliente", 8);
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
  const [viewMode, setViewMode] = useState<"list" | "kanban">("kanban");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null);

  // Update service form (shown in detail dialog)
  const [updateForm, setUpdateForm] = useState({
    final_price: "", technician_id: "",
    payment_cash: "", payment_card: "", payment_pix: "", payment_other: "", payment_notes: "",
    exit_checklist: {} as ChecklistData,
    warranty_end_date: "",
  });

  const [passwordType, setPasswordType] = useState<"text" | "pattern">("text");
  const [patternImageData, setPatternImageData] = useState<string>("");

  const [form, setForm] = useState({
    customer_name: "", customer_phone: "", customer_cpf: "",
    device_brand: "iPhone", device_model: "", device_imei: "", device_color: "",
    device_condition: "", device_password: "", device_accessories: "",
    reported_defect: "", requested_service: "",
    store_id: "", estimated_price: "", estimated_completion: "",
    technician_id: "", terms_accepted: false, internal_notes: "",
    entry_checklist: {} as ChecklistData,
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

  const uploadReceipt = async (file: File): Promise<string | null> => {
    const fileName = `${detailOrder?.order_number}-${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage.from("comprovantes").upload(`os-pagamentos/${fileName}`, file, { upsert: true });
    if (error) { toast.error("Erro no upload: " + error.message); return null; }
    const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  useEffect(() => {
    const channel = supabase.channel("service_orders_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_orders" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const storeMap = new Map<string, string>(stores.map((s) => [s.id, s.name]));
  const profileMap = new Map<string, string>(profiles.map((p) => [p.user_id, p.display_name ?? ""]));

  const getPublicUrl = (orderId: string) => `${window.location.origin}/os/${orderId}`;

  const resetForm = () => {
    setForm({
      customer_name: "", customer_phone: "", customer_cpf: "",
      device_brand: "iPhone", device_model: "", device_imei: "", device_color: "",
      device_condition: "", device_password: "", device_accessories: "",
      reported_defect: "", requested_service: "",
      store_id: "", estimated_price: "", estimated_completion: "",
      technician_id: "", terms_accepted: false, internal_notes: "",
      entry_checklist: {} as ChecklistData,
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
      entry_checklist: form.entry_checklist,
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

    const order = orders.find(o => o.id === orderId);
    if (order && (order as any).store_id) {
      triggerWebhook("os_status_changed", (order as any).store_id, {
        order_id: orderId,
        order_number: (order as any).order_number,
        customer: (order as any).customer_name,
        device: `${(order as any).device_brand} ${(order as any).device_model}`,
        old_status: oldStatus,
        new_status: newStatus,
      });
      logAction("UPDATE_OS_STATUS", "service_orders", orderId, { status: oldStatus }, { status: newStatus });
    }

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
    updates.exit_checklist = updateForm.exit_checklist;
    if (updateForm.warranty_end_date) updates.warranty_end_date = new Date(updateForm.warranty_end_date).toISOString();
    
    updates.receipt_url = existingReceiptUrl;

    if (receiptFile) {
      const url = await uploadReceipt(receiptFile);
      if (url) updates.receipt_url = url;
    }

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
      const storeObj = stores.find(s => s.id === order.store_id) ?? { name: "Assistência Técnica" };
      const techName = profileMap.get(order.technician_id) ?? "";
      const publicUrl = getPublicUrl(order.id);
      const doc = await generateOSPdf(order, storeObj, techName, publicUrl);
      doc.save(`OS-${order.order_number}.pdf`);
      toast.success("PDF gerado!");
    } catch (err) {
      toast.error("Erro ao gerar PDF. Instale: npm install jspdf");
    }
    setPdfLoading(false);
  };

  const handleExportThermal = async (order: any) => {
    setPdfLoading(true);
    try {
      const storeObj = stores.find(s => s.id === order.store_id) ?? { name: "Assistência Técnica" };
      const techName = profileMap.get(order.technician_id) ?? "";
      const publicUrl = getPublicUrl(order.id);
      const doc = await generateThermalPdf(order, storeObj, techName, publicUrl);
      doc.save(`OS-Cupom-${order.order_number}.pdf`);
      toast.success("Cupom gerado (80mm)!");
    } catch (err) { toast.error("Erro ao gerar cupom termal."); }
    setPdfLoading(false);
  };

  const handleSendWhatsApp = async (order: any) => {
    if (!order.customer_phone) { toast.error("Cliente sem telefone cadastrado!"); return; }
    setPdfLoading(true);
    try {
      const storeObj = stores.find(s => s.id === order.store_id) ?? { name: "Assistência Técnica" };
      const techName = profileMap.get(order.technician_id) ?? "";
      const publicUrl = getPublicUrl(order.id);
      const doc = await generateOSPdf(order, storeObj, techName, publicUrl);

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
        `Olá ${order.customer_name}! 👋\n\nSua Ordem de Serviço #${order.order_number} está com status: *${statusConfig[order.status]?.label}*.\n\n📄 Acesse sua OS completa:\n${shareUrl}\n\n_${storeObj.name}_`
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
      exit_checklist: (order.exit_checklist as ChecklistData) || {},
      warranty_end_date: order.warranty_end_date ? new Date(order.warranty_end_date).toISOString().split('T')[0] : "",
    });
  };

  const totalPaid = (o: any) =>
    (Number(o?.payment_cash) || 0) + (Number(o?.payment_card) || 0) +
    (Number(o?.payment_pix) || 0) + (Number(o?.payment_other) || 0);

  return (
    <div className="space-y-4">
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={e => { if (e.target.files?.[0]) setReceiptFile(e.target.files[0]); e.target.value = ""; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { if (e.target.files?.[0]) setReceiptFile(e.target.files[0]); e.target.value = ""; }} />

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
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <Label className="text-xs">Senha / Padrão</Label>
                    <div className="flex gap-1 mb-2">
                      <button
                        type="button"
                        onClick={() => setPasswordType("text")}
                        className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${passwordType === "text" ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                      >
                        Senha
                      </button>
                      <button
                        type="button"
                        onClick={() => setPasswordType("pattern")}
                        className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${passwordType === "pattern" ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                      >
                        Padrão Android
                      </button>
                    </div>
                    {passwordType === "text" ? (
                      <Input value={form.device_password} onChange={(e) => setForm({ ...form, device_password: e.target.value })} placeholder="****" className="h-10" />
                    ) : (
                      <AndroidPatternLock
                        size={210}
                        onPattern={(pattern, imgData) => {
                          setForm({ ...form, device_password: pattern ? `Padrão: ${pattern}` : "" });
                          setPatternImageData(imgData);
                        }}
                      />
                    )}
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

              {/* Checklist de Entrada */}
              <OsChecklist
                title="Checklist de Entrada"
                data={form.entry_checklist}
                onChange={(d) => setForm({ ...form, entry_checklist: d })}
              />

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
        <Button className={`h-7 px-3 text-xs shrink-0 ${filterStatus === "all" ? "bg-primary text-primary-foreground" : "bg-transparent border border-border text-foreground hover:bg-muted"}`} onClick={() => setFilterStatus("all")}>
          Todas ({orders.length})
        </Button>
        {allStatuses.filter((s) => statusCounts[s]).map((s) => (
          <Button key={s} className={`h-7 px-3 text-xs shrink-0 ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-transparent border border-border text-foreground hover:bg-muted"}`} onClick={() => setFilterStatus(s)}>
            {statusConfig[s].label} ({statusCounts[s]})
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-2 w-full">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, IMEI, modelo ou nº da OS..." className="pl-9 h-10" />
        </div>
        <Button className={`px-4 h-10 border text-xs gap-2 ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-transparent text-foreground hover:bg-muted"}`} onClick={() => setViewMode(v => v === "list" ? "kanban" : "list")}>
          {viewMode === "list" ? "Ver Kanban" : "Ver Lista"}
        </Button>
      </div>

      {/* List or Kanban */}
      {viewMode === "list" ? (
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
                      <Badge className={`text-[10px] border ${sc.color}`}>{sc.label}</Badge>
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
      ) : (
        <KanbanBoard 
          orders={filtered} 
          statusConfig={statusConfig as any} 
          allStatuses={allStatuses} 
          storeMap={storeMap} 
          profileMap={profileMap} 
          formatCurrency={formatCurrency} 
          onOrderClick={openDetail} 
          onStatusChange={updateStatus} 
        />
      )}

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
                    <Badge className={`text-[10px] border ${statusConfig[detailOrder.status]?.color}`}>
                      {statusConfig[detailOrder.status]?.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{new Date(detailOrder.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                    <Button className="h-8 px-3 text-[10px] gap-1 border bg-transparent text-foreground hover:bg-muted"
                      onClick={() => handleExportPdf(detailOrder)} disabled={pdfLoading}>
                      <FileText className="h-3 w-3" /> PDF A4
                    </Button>
                    <Button className="h-8 px-3 text-[10px] gap-1 border bg-transparent text-foreground hover:bg-muted"
                      onClick={() => handleExportThermal(detailOrder)} disabled={pdfLoading}>
                      <Printer className="h-3 w-3" /> Cupom 80mm
                    </Button>
                    <Button className="h-8 px-3 text-[10px] gap-1 border bg-transparent text-green-500 border-green-500/30 hover:bg-green-500/10"
                      onClick={() => handleSendWhatsApp(detailOrder)} disabled={pdfLoading}>
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </Button>
                  </div>
                </div>

                {/* Link público */}
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-[10px] text-muted-foreground flex-1 truncate">{getPublicUrl(detailOrder.id)}</span>
                  <Button className="h-6 text-[10px] bg-transparent hover:bg-muted"
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
                  {detailOrder.warranty_end_date && <p><span className="text-muted-foreground">Garantia até:</span> <span className="font-bold text-green-500">{new Date(detailOrder.warranty_end_date).toLocaleDateString("pt-BR")}</span></p>}
                </div>

                {/* Entry Checklist Viewer */}
                {detailOrder.entry_checklist && Object.keys(detailOrder.entry_checklist).length > 0 && (
                  <OsChecklist
                    title="Checklist de Entrada (Registrado na abertura)"
                    data={detailOrder.entry_checklist as ChecklistData}
                    onChange={() => {}}
                    readonly={true}
                  />
                )}

                {/* Galeria de Fotos */}
                <OsPhotoGallery orderId={detailOrder.id} />

                {/* Peças da OS */}
                <OsParts orderId={detailOrder.id} storeId={detailOrder.store_id} />

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
                    
                    {detailOrder.receipt_url && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <a href={detailOrder.receipt_url} target="_blank" rel="noreferrer"
                           className="text-[10px] text-primary underline flex items-center gap-1 font-semibold">
                          <Receipt className="h-3 w-3" /> Ver Comprovante de Pagamento
                        </a>
                      </div>
                    )}
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
                        <Label className="text-xs">Fim da Garantia (Opcional)</Label>
                        <Input type="date" value={updateForm.warranty_end_date} 
                               onChange={e => setUpdateForm(f => ({ ...f, warranty_end_date: e.target.value }))} className="h-9 text-xs" />
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-xs">Técnico Responsável</Label>
                        <Select value={updateForm.technician_id} onValueChange={v => setUpdateForm(f => ({ ...f, technician_id: v }))}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name ?? p.user_id}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="pt-2">
                       <OsChecklist
                         title="Checklist de Saída (Testes Pós-Reparo)"
                         data={updateForm.exit_checklist}
                         onChange={(d) => setUpdateForm({ ...updateForm, exit_checklist: d })}
                       />
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

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-semibold flex items-center gap-1">
                        <Receipt className="h-3 w-3" /> Anexar Comprovante
                      </Label>
                      {receiptFile ? (
                        <div className="flex items-center gap-2 rounded bg-primary/10 p-2 text-[10px] text-primary border border-primary/20 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate flex-1">{receiptFile.name}</span>
                          <button onClick={() => setReceiptFile(null)} className="hover:underline">Remover</button>
                        </div>
                      ) : existingReceiptUrl ? (
                        <div className="flex items-center gap-2 rounded bg-green-500/10 p-2 text-[10px] text-green-600 border border-green-500/20 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate flex-1">Comprovante já enviado</span>
                          <button onClick={() => setExistingReceiptUrl(null)} className="text-destructive hover:underline">Trocar</button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" variant="outline" className="h-8 text-[10px] gap-1.5" onClick={() => cameraInputRef.current?.click()}>
                            <Camera className="h-3 w-3" /> Tirar Foto
                          </Button>
                          <Button type="button" variant="outline" className="h-8 text-[10px] gap-1.5" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="h-3 w-3" /> Galeria
                          </Button>
                        </div>
                      )}
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
                        <Button key={s} className="text-xs h-8 bg-transparent border border-border text-foreground hover:bg-muted"
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
