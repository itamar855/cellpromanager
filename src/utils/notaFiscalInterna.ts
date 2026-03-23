
// src/utils/notaFiscalInterna.ts
// Gera nota fiscal interna (comprovante de venda) em PDF via jsPDF

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const TERMOS = `1. Este documento é um comprovante interno de venda e não substitui a Nota Fiscal Eletrônica (NF-e).
2. Garantia de 90 dias para defeitos de fabricação do produto adquirido.
3. A garantia não cobre danos causados por mau uso, quedas, líquidos ou violação do produto.
4. Para acionar a garantia, apresente este comprovante juntamente com o produto.
5. Trocas e devoluções sujeitas à análise técnica em até 7 dias corridos após a compra.`;

export interface NotaFiscalData {
  // Venda
  numeroNota: string;
  dataVenda: string;
  // Loja
  lojaNome: string;
  lojaCnpj?: string;
  lojaEndereco?: string;
  lojaTelefone?: string;
  lojaWhatsapp?: string;
  lojaInstagram?: string;
  lojaLogoUrl?: string;
  // Cliente
  clienteNome?: string;
  clienteCpf?: string;
  clienteTelefone?: string;
  // Produto
  produtoNome: string;
  produtoMarca: string;
  produtoModelo?: string;
  produtoImei?: string;
  produtoCor?: string;
  // Pagamento
  valorVenda: number;
  valorDinheiro?: number;
  valorCartao?: number;
  valorPix?: number;
  tradeIn?: boolean;
  tradeInValor?: number;
  tradeInNome?: string;
  // Extra
  observacoes?: string;
}

export const gerarNotaFiscalInterna = async (data: NotaFiscalData): Promise<any> => {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const pad = 14;
  let y = 0;

  const newPage = () => { doc.addPage(); y = pad; };
  const checkPage = (needed = 20) => { if (y + needed > 270) newPage(); };

  const hline = (color = [220, 220, 220] as [number, number, number]) => {
    doc.setDrawColor(...color); doc.line(pad, y, W - pad, y); y += 3;
  };

  const text = (txt: string, x: number, yy: number, opts?: any) =>
    doc.text(txt, x, yy, opts);

  // ── CABEÇALHO ────────────────────────────────────────────────────────────
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, W, 28, "F");

  // Logo
  let logoX = pad;
  if (data.lojaLogoUrl) {
    try {
      doc.addImage(data.lojaLogoUrl, "PNG", pad, 4, 18, 18);
      logoX = pad + 22;
    } catch (_) {}
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  text(data.lojaNome, logoX, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const lojaInfo: string[] = [];
  if (data.lojaCnpj)     lojaInfo.push(`CNPJ: ${data.lojaCnpj}`);
  if (data.lojaEndereco) lojaInfo.push(data.lojaEndereco);
  if (data.lojaTelefone) lojaInfo.push(`Tel: ${data.lojaTelefone}`);
  if (data.lojaInstagram) lojaInfo.push(data.lojaInstagram);
  if (lojaInfo.length > 0) text(lojaInfo.join("  ·  "), logoX, 18);

  // Número da nota (canto direito)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  text("COMPROVANTE DE VENDA", W - pad, 10, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  text(`Nº ${data.numeroNota}`, W - pad, 16, { align: "right" });
  text(data.dataVenda, W - pad, 22, { align: "right" });

  y = 34;

  // ── FAIXA STATUS ──────────────────────────────────────────────────────────
  doc.setFillColor(240, 253, 244);
  doc.rect(pad, y, W - pad * 2, 8, "F");
  doc.setDrawColor(16, 185, 129);
  doc.rect(pad, y, W - pad * 2, 8, "S");
  doc.setTextColor(16, 185, 129);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  text("✓ VENDA REALIZADA COM SUCESSO", W / 2, y + 5.5, { align: "center" });
  y += 12;

  // ── SEÇÃO helper ─────────────────────────────────────────────────────────
  const section = (title: string) => {
    checkPage(14);
    doc.setFillColor(245, 247, 250);
    doc.rect(pad, y, W - pad * 2, 7, "F");
    doc.setDrawColor(200, 200, 200);
    doc.rect(pad, y, W - pad * 2, 7, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    text(title, pad + 3, y + 5);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
  };

  const field = (label: string, value: string, xOff = 0, maxW = W - pad * 2) => {
    if (!value || value === "—") return;
    checkPage(8);
    doc.setFontSize(7.5);
    doc.setTextColor(130, 130, 130);
    text(label, pad + xOff, y);
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(value, maxW - xOff);
    text(lines, pad + xOff, y + 4.5);
    y += 5.5 + (lines.length - 1) * 4.2;
  };

  const col2 = (l1: string, v1: string, l2: string, v2: string) => {
    const half = (W - pad * 2) / 2 - 4;
    const ySnap = y;
    field(l1, v1, 0, half);
    const yAfter = y; y = ySnap;
    field(l2, v2, half + 8, half);
    y = Math.max(yAfter, y) + 1;
  };

  // ── DADOS DO CLIENTE ──────────────────────────────────────────────────────
  section("DADOS DO CLIENTE");
  col2("Nome", data.clienteNome || "Não informado", "CPF", data.clienteCpf || "Não informado");
  field("Telefone", data.clienteTelefone || "Não informado");
  y += 2;

  // ── DADOS DO PRODUTO ──────────────────────────────────────────────────────
  section("DADOS DO PRODUTO");
  col2("Produto", data.produtoNome, "Marca", data.produtoMarca);
  col2("Modelo", data.produtoModelo || "—", "Cor", data.produtoCor || "—");
  if (data.produtoImei) {
    // IMEI em destaque
    checkPage(12);
    doc.setFillColor(255, 251, 235);
    doc.rect(pad, y, W - pad * 2, 10, "F");
    doc.setDrawColor(245, 158, 11);
    doc.rect(pad, y, W - pad * 2, 10, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(120, 80, 0);
    text("IMEI / Número de Série:", pad + 3, y + 4);
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    text(data.produtoImei, pad + 3, y + 8.5);
    y += 13;
  }
  y += 2;

  // ── PAGAMENTO ─────────────────────────────────────────────────────────────
  section("PAGAMENTO");
  checkPage(40);

  // Box de valor total
  doc.setFillColor(240, 253, 244);
  doc.rect(pad, y, W - pad * 2, 12, "F");
  doc.setDrawColor(16, 185, 129);
  doc.rect(pad, y, W - pad * 2, 12, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(16, 185, 129);
  text("VALOR TOTAL:", pad + 4, y + 7.5);
  doc.setFontSize(14);
  text(formatCurrency(data.valorVenda), W - pad - 4, y + 8, { align: "right" });
  y += 15;

  // Detalhes do pagamento
  const pagLines: [string, number][] = [];
  if ((data.valorDinheiro ?? 0) > 0) pagLines.push(["💵  Dinheiro", data.valorDinheiro!]);
  if ((data.valorCartao ?? 0) > 0)   pagLines.push(["💳  Cartão",   data.valorCartao!]);
  if ((data.valorPix ?? 0) > 0)      pagLines.push(["📱  PIX",      data.valorPix!]);
  if (data.tradeIn && (data.tradeInValor ?? 0) > 0) pagLines.push([`🔄  Troca: ${data.tradeInNome || "Aparelho"}`, data.tradeInValor!]);

  if (pagLines.length > 0) {
    pagLines.forEach(([label, val]) => {
      checkPage(7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      text(label, pad + 4, y);
      doc.setFont("helvetica", "bold");
      text(formatCurrency(val), W - pad - 4, y, { align: "right" });
      y += 6;
    });
  }
  y += 3;

  // ── GARANTIA ──────────────────────────────────────────────────────────────
  checkPage(20);
  doc.setFillColor(239, 246, 255);
  doc.rect(pad, y, W - pad * 2, 14, "F");
  doc.setDrawColor(59, 130, 246);
  doc.rect(pad, y, W - pad * 2, 14, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 64, 175);
  text("🛡️  GARANTIA DE 90 DIAS", pad + 4, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(50, 80, 150);
  text("Válida a partir da data da compra para defeitos de fabricação.", pad + 4, y + 10.5);
  const dataGarantia = new Date();
  dataGarantia.setDate(dataGarantia.getDate() + 90);
  text(`Vencimento: ${dataGarantia.toLocaleDateString("pt-BR")}`, W - pad - 4, y + 10.5, { align: "right" });
  y += 18;

  // ── OBSERVAÇÕES ───────────────────────────────────────────────────────────
  if (data.observacoes) {
    section("OBSERVAÇÕES");
    field("", data.observacoes);
    y += 2;
  }

  // ── TERMOS ────────────────────────────────────────────────────────────────
  checkPage(35);
  section("TERMOS E CONDIÇÕES");
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  const termsLines = doc.splitTextToSize(TERMOS, W - pad * 2 - 4);
  checkPage(termsLines.length * 4 + 5);
  text(termsLines, pad + 2, y);
  y += termsLines.length * 4 + 4;

  // ── ASSINATURA ────────────────────────────────────────────────────────────
  checkPage(30);
  y += 4;
  hline();
  const midX = W / 2;
  doc.setDrawColor(150, 150, 150);
  doc.line(pad + 10, y + 18, midX - 8, y + 18);
  doc.line(midX + 8, y + 18, W - pad - 10, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  text("Assinatura do Cliente", pad + 10, y + 22);
  text("Assinatura da Loja", midX + 8, y + 22);
  y += 28;

  // ── RODAPÉ ────────────────────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.line(pad, 285, W - pad, 285);
  text(
    `${data.lojaNome}${data.lojaCnpj ? ` · CNPJ: ${data.lojaCnpj}` : ""}  ·  Gerado em ${new Date().toLocaleString("pt-BR")} · CellManager`,
    W / 2, 289, { align: "center" }
  );
  text("Este documento é um comprovante interno e não substitui a Nota Fiscal Eletrônica.", W / 2, 293, { align: "center" });

  return doc;
};
