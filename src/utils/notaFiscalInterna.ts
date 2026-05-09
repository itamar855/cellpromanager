import { jsPDF } from "jspdf";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const TERMOS = `1. Este documento é um comprovante interno de venda e não substitui a Nota Fiscal Eletrônica (NF-e).
2. Garantia de 90 dias para defeitos de fabricação do produto adquirido, a contar da data de emissão.
3. A garantia não cobre danos causados por mau uso, quedas, contato com líquidos, oxidação ou violação do produto.
4. Para acionar a garantia, apresente este comprovante juntamente com o produto em nossa loja.
5. Trocas e devoluções sujeitas à análise técnica em até 7 dias corridos após a compra.
6. Serviços de desbloqueio, limpeza e configuração não possuem garantia de resultado garantido.`;

export interface NotaFiscalData {
  numeroNota: string;
  dataVenda: string;
  lojaNome: string;
  lojaCnpj?: string;
  lojaEndereco?: string;
  lojaTelefone?: string;
  lojaWhatsapp?: string;
  lojaInstagram?: string;
  lojaLogoUrl?: string;
  clienteNome?: string;
  clienteCpf?: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  clienteEndereco?: string;
  produtoNome: string;
  produtoMarca: string;
  produtoModelo?: string;
  produtoImei?: string;
  produtoCor?: string;
  valorVenda: number;
  valorDinheiro?: number;
  valorCartao?: number;
  valorPix?: number;
  tradeIn?: boolean;
  tradeInValor?: number;
  tradeInNome?: string;
  observacoes?: string;
  garantiaDays?: number;
}

export const gerarNotaFiscalInterna = async (data: NotaFiscalData): Promise<any> => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 10; // Slightly larger margins for a clean look
  const CW = W - M * 2;
  let y = M;

  // --- COLORS ---
  const BLACK: [number, number, number] = [0, 0, 0];
  const DARK: [number, number, number] = [40, 40, 40];
  const GRAY: [number, number, number] = [100, 100, 100];
  const WHITE: [number, number, number] = [255, 255, 255];
  const PRIMARY: [number, number, number] = [20, 20, 20];

  doc.setLineWidth(0.1);

  // --- HELPERS ---
  const box = (h: number, title?: string) => {
    doc.setDrawColor(200);
    doc.rect(M, y, CW, h);
    if (title) {
      doc.setFillColor(245, 245, 245);
      doc.rect(M, y, CW, 6, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(...DARK);
      doc.text(title.toUpperCase(), M + 3, y + 4.2);
      y += 6; h -= 6;
    }
    return { x: M, y: y, w: CW, h: h };
  };

  const field = (label: string, value: any, x: number, w: number, align: "left" | "right" = "left", size = 9) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(6); doc.setTextColor(...GRAY);
    doc.text(label.toUpperCase(), x + 3, y + 4);
    doc.setFont("helvetica", "bold"); doc.setFontSize(size); doc.setTextColor(...BLACK);
    const textX = align === "left" ? x + 3 : x + w - 3;
    doc.text(String(value || "-"), textX, y + 9, { align });
  };

  const vLine = (x: number, h: number) => {
    doc.setDrawColor(200);
    doc.line(M + x, y, M + x, y + h);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 1. SIMPLE CLEAN HEADER
  // ══════════════════════════════════════════════════════════════════════════
  if (data.lojaLogoUrl) {
    try { doc.addImage(data.lojaLogoUrl, "PNG", M, y, 22, 22); } catch (_) {}
  }
  
  const tx = data.lojaLogoUrl ? 26 : 0;
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...PRIMARY);
  doc.text(data.lojaNome.toUpperCase(), M + tx, y + 6);
  
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...DARK);
  doc.text(data.lojaEndereco || "-", M + tx, y + 11, { maxWidth: 100 });
  doc.text(`WhatsApp/Fone: ${data.lojaWhatsapp || data.lojaTelefone || "-"}`, M + tx, y + 16);
  if (data.lojaCnpj) doc.text(`CNPJ: ${data.lojaCnpj}`, M + tx, y + 20);

  // Right Side Header: Document Title
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...BLACK);
  doc.text("COMPROVANTE DE VENDA", M + CW, y + 6, { align: "right" });
  doc.setFontSize(9); doc.setTextColor(...GRAY);
  doc.text(`Nº ${data.numeroNota}`, M + CW, y + 12, { align: "right" });
  doc.text(data.dataVenda, M + CW, y + 17, { align: "right" });

  y += 26;

  // ══════════════════════════════════════════════════════════════════════════
  // 2. GARANTIA HIGHLIGHT
  // ══════════════════════════════════════════════════════════════════════════
  doc.setFillColor(20, 20, 20); doc.rect(M, y, CW, 12, "F");
  doc.setTextColor(...WHITE); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
  doc.text("PRAZO DE GARANTIA DO PRODUTO", M + 5, y + 5);
  doc.setFontSize(14);
  const diasG = data.garantiaDays || 90;
  doc.text(`${diasG} DIAS${diasG > 90 ? " (ESTENDIDA)" : ""}`, M + 5, y + 10);
  
  y += 15;

  // ══════════════════════════════════════════════════════════════════════════
  // 3. DADOS DO CLIENTE
  // ══════════════════════════════════════════════════════════════════════════
  box(24, "DADOS DO CLIENTE");
  field("NOME DO CLIENTE", data.clienteNome || "CONSUMIDOR FINAL", M, CW - 60); vLine(CW - 60, 9);
  field("CPF / CNPJ", data.clienteCpf, M + CW - 60, 60);
  y += 9; doc.setDrawColor(230); doc.line(M, y, M + CW, y);
  field("ENDEREÇO", data.clienteEndereco, M, CW - 100); vLine(CW - 100, 9);
  field("TELEFONE / WHATSAPP", data.clienteTelefone, M + CW - 100, 100);
  y += 15;

  // ══════════════════════════════════════════════════════════════════════════
  // 4. DETALHES DO PRODUTO
  // ══════════════════════════════════════════════════════════════════════════
  box(45, "DETALHES DO PRODUTO ADQUIRIDO");
  field("PRODUTO / MODELO", `${data.produtoNome} ${data.produtoModelo || ""}`, M, CW - 80); vLine(CW - 80, 9);
  field("MARCA", data.produtoMarca, M + CW - 80, 40); vLine(CW - 40, 9);
  field("COR", data.produtoCor, M + CW - 40, 40);
  y += 9; doc.line(M, y, M + CW, y);
  field("IMEI / NÚMERO DE SÉRIE", data.produtoImei, M, CW - 60); vLine(CW - 60, 9);
  field("VALOR DO PRODUTO", formatCurrency(data.valorVenda), M + CW - 60, 60, "right", 12);
  y += 30;

  // ══════════════════════════════════════════════════════════════════════════
  // 5. RESUMO DE PAGAMENTO
  // ══════════════════════════════════════════════════════════════════════════
  box(12, "FORMA DE PAGAMENTO");
  const pays: string[] = [];
  if (data.valorDinheiro) pays.push(`DINHEIRO: ${formatCurrency(data.valorDinheiro)}`);
  if (data.valorPix) pays.push(`PIX: ${formatCurrency(data.valorPix)}`);
  if (data.valorCartao) pays.push(`CARTÃO: ${formatCurrency(data.valorCartao)}`);
  if (data.tradeInValor) pays.push(`TROCA (VALE): ${formatCurrency(data.tradeInValor)}`);
  doc.setFontSize(9); doc.setTextColor(...BLACK);
  doc.text(pays.join("   |   ") || "PAGAMENTO À VISTA", M + 4, y + 4.5);
  y += 16;

  // ══════════════════════════════════════════════════════════════════════════
  // 6. TERMOS E ASSINATURA
  // ══════════════════════════════════════════════════════════════════════════
  y = 230; // Push to bottom
  doc.setDrawColor(200); doc.rect(M, y, CW, 50);
  doc.setFontSize(7); doc.setTextColor(...DARK);
  doc.text("TERMOS DE GARANTIA E CONDIÇÕES", M + 3, y + 5);
  
  const garantiaStr = data.garantiaDays ? `${data.garantiaDays} dias` : "90 dias";
  const finalTerms = TERMOS.replace("90 dias", garantiaStr) + (data.observacoes ? "\n\nOBSERVAÇÕES: " + data.observacoes : "");
  const termLines = doc.splitTextToSize(finalTerms, CW - 8);
  doc.text(termLines, M + 4, y + 10);

  // Signatures
  y += 38;
  doc.line(M + 10, y, M + 80, y); doc.text("ASSINATURA DA LOJA", M + 45, y + 4, { align: "center" });
  doc.line(M + CW - 80, y, M + CW - 10, y); doc.text("ASSINATURA DO CLIENTE", M + CW - 45, y + 4, { align: "center" });

  return doc;
};
