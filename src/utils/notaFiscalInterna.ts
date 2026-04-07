// src/utils/notaFiscalInterna.ts
// Gera nota fiscal interna (comprovante de venda) em PDF via jsPDF

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
}

export const gerarNotaFiscalInterna = async (data: NotaFiscalData): Promise<any> => {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 7; // Narrow margins for official look
  const CW = W - M * 2;
  let y = M;

  // --- COLORS (Grayscale for official look) ---
  const BLACK: [number, number, number] = [0, 0, 0];
  const DARK: [number, number, number] = [40, 40, 40];
  const GRAY: [number, number, number] = [100, 100, 100];
  const BORDER: [number, number, number] = [0, 0, 0]; // Thin black borders
  const WHITE: [number, number, number] = [255, 255, 255];

  doc.setLineWidth(0.2);
  doc.setDrawColor(...BORDER);

  // --- HELPERS ---
  const box = (h: number, title?: string) => {
    doc.rect(M, y, CW, h);
    if (title) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...DARK);
      doc.text(title.toUpperCase(), M + 1.5, y + 4.5);
      y += 6;
      h -= 6;
    }
    return { x: M, y: y, w: CW, h: h };
  };

  const field = (label: string, value: any, x: number, w: number, align: "left" | "right" = "left") => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(...GRAY);
    doc.text(label.toUpperCase(), x + 1.5, y + 3.5);
    doc.setFont("helvetica", "bold"); // Bold for values too
    doc.setFontSize(8.5);
    doc.setTextColor(...BLACK);
    const textX = align === "left" ? x + 1.5 : x + w - 1.5;
    doc.text(String(value || ""), textX, y + 8, { align });
  };

  const row = (h: number) => {
    doc.line(M, y + h, M + CW, y + h);
    y += h;
  };

  const vLine = (x: number, h: number) => {
    doc.line(M + x, y, M + x, y + h);
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  HEADER (ISSUER INFO)
  // ══════════════════════════════════════════════════════════════════════════
  doc.rect(M, y, CW, 30);
  
  // Issuer on the left
  if (data.lojaLogoUrl) {
    try { doc.addImage(data.lojaLogoUrl, "PNG", M + 2, y + 3, 24, 24); } catch (_) {}
  }
  
  const tx = data.lojaLogoUrl ? 32 : 5;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(data.lojaNome.toUpperCase(), M + tx, y + 8);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  doc.text(data.lojaEndereco || "-", M + tx, y + 13, { maxWidth: 60 });
  doc.text(`Fone: ${data.lojaTelefone || "-"}`, M + tx, y + 22);
  doc.text(`CNPJ: ${data.lojaCnpj || "-"}`, M + tx, y + 26);

  // Center: "DANFE"
  vLine(95, 30);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("DANFE", M + 115, y + 8, { align: "center" } );
  doc.setFontSize(6.5);
  doc.text("Documento Auxiliar da\nNota Fiscal Eletrônica\n(Simulado)", M + 115, y + 12, { align: "center" });
  doc.text("0 - ENTRADA\n1 - SAÍDA", M + 97, y + 21);
  doc.setFontSize(12); doc.rect(M + 116, y + 19, 6, 8); doc.text("1", M + 119, y + 25, { align: "center" });
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text(`Nº ${data.numeroNota}\nSÉRIE 1`, M + 115, y + 30, { align: "center" });

  // Right: Access Key Placeholder
  vLine(135, 30);
  doc.setFontSize(6.5); doc.text("CHAVE DE ACESSO (SIMULADO)", M + 137, y + 5);
  doc.setFontSize(8);
  const key = Array.from({length: 44}, () => Math.floor(Math.random() * 10)).join("");
  const keyFormatted = key.match(/.{1,4}/g)?.join(" ") || "";
  doc.text(keyFormatted, M + 137, y + 10, { maxWidth: CW - 137 - 2 });

  doc.rect(M + 137, y + 14, CW - 137 - 5, 12);
  doc.text("PROTOCOLO DE AUTORIZAÇÃO (SIMULADO)\n351234567890123 01/01/2026 12:00:00", M + 139, y + 18, { fontSize: 6 });

  y += 30;

  // ══════════════════════════════════════════════════════════════════════════
  //  RECIPIENT (DESTINATÁRIO / REMETENTE)
  // ══════════════════════════════════════════════════════════════════════════
  y += 2;
  box(21, "DESTINATÁRIO / REMETENTE");
  field("NOME / RAZÃO SOCIAL", data.clienteNome || "CONSUMIDOR FINAL", M, CW - 110);
  vLine(CW - 110, 10);
  field("CNPJ / CPF", data.clienteCpf || "000.000.000-00", M + CW - 110, 60);
  vLine(CW - 45, 10);
  field("DATA DA EMISSÃO", data.dataVenda, M + CW - 45, 45, "right");
  row(10);
  field("TELEFONE", data.clienteTelefone || "-", M, 60);
  vLine(60, 5);
  field("UF", "ES", M + 60, 15);
  vLine(75, 5);
  field("HORA DA SAÍDA", new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), M + 75, CW - 75, "right");
  row(5);

  // ══════════════════════════════════════════════════════════════════════════
  //  PAYMENT (FATURA / DUPLICATA)
  // ══════════════════════════════════════════════════════════════════════════
  y += 2;
  box(14, "FATURA / DUPLICATA");
  const pays: string[] = [];
  if (data.valorDinheiro) pays.push(`Dinheiro: ${formatCurrency(data.valorDinheiro)}`);
  if (data.valorPix) pays.push(`PIX: ${formatCurrency(data.valorPix)}`);
  if (data.valorCartao) pays.push(`Cartão: ${formatCurrency(data.valorCartao)}`);
  if (data.tradeInValor) pays.push(`Troca: ${formatCurrency(data.tradeInValor)}`);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  doc.text(pays.length ? pays.join("    |    ") : "Pagamento à vista", M + 3, y + 4.5);
  row(8);

  // ══════════════════════════════════════════════════════════════════════════
  //  TOTALS (CÁLCULO DO IMPOSTO)
  // ══════════════════════════════════════════════════════════════════════════
  y += 2;
  box(15, "CÁLCULO DO IMPOSTO");
  const colW = CW / 5;
  field("BASE CÁLC. ICMS", "0,00", M, colW); vLine(colW, 9);
  field("VALOR ICMS", "0,00", M + colW, colW); vLine(colW * 2, 9);
  field("VALOR ICMS SUBS.", "0,00", M + colW * 2, colW); vLine(colW * 3, 9);
  field("VALOR TOTAL TRIB.", "0,00", M + colW * 3, colW); vLine(colW * 4, 9);
  field("VALOR TOTAL PROD.", formatCurrency(data.valorVenda), M + colW * 4, colW, "right");
  row(9);

  // ══════════════════════════════════════════════════════════════════════════
  //  PRODUCTS TABLE
  // ══════════════════════════════════════════════════════════════════════════
  y += 2;
  box(80, "DADOS DO PRODUTO / SERVIÇO");
  doc.setFillColor(...WHITE); doc.rect(M, y, CW, 6, "F"); 
  doc.setFontSize(6.5); doc.setTextColor(...DARK);
  doc.text("CÓDIGO", M + 2, y + 4.5);
  doc.text("DESCRIÇÃO DO PRODUTO / SERVIÇO", M + 22, y + 4.5);
  doc.text("NCM", M + 105, y + 4.5);
  doc.text("VALOR UNIT", M + 130, y + 4.5);
  doc.text("QTD", M + 160, y + 4.5);
  doc.text("VALOR TOTAL", M + CW - 1, y + 4.5, { align: "right" });
  row(6);
  
  // Single Product Row (Main Product)
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...BLACK);
  doc.text("001", M + 2, y + 6);
  const desc = `${data.produtoNome} - ${data.produtoMarca}${data.produtoModelo ? " " + data.produtoModelo : ""}${data.produtoImei ? " (IMEI: " + data.produtoImei + ")" : ""}`;
  const descLines = doc.splitTextToSize(desc, 80);
  doc.text(descLines, M + 22, y + 6);
  doc.text("85171231", M + 105, y + 6);
  doc.text(formatCurrency(data.valorVenda), M + 130, y + 6);
  doc.text("1", M + 160, y + 6);
  doc.text(formatCurrency(data.valorVenda), M + CW - 1, y + 6, { align: "right" });
  
  y = M + 30 + 2 + 21 + 2 + 14 + 2 + 15 + 2 + 80; // Correct snap to table bottom

  // ══════════════════════════════════════════════════════════════════════════
  //  COMPLEMENTARY INFO
  // ══════════════════════════════════════════════════════════════════════════
  y += 2;
  box(CW > 160 ? 40 : 50, "INFORMAÇÕES COMPLEMENTARES");
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...DARK);
  const terms = doc.splitTextToSize(TERMOS + (data.observacoes ? "\n\nObservações: " + data.observacoes : ""), CW - 10);
  doc.text(terms, M + 5, y + 4);
  
  // Footer page info
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5); doc.setTextColor(...GRAY);
    const footerText = `${data.lojaNome}  |  Simulado DANFE  |  Página ${i} de ${pageCount}`;
    doc.text(footerText, W / 2, 290, { align: "center" });
  }

  return doc;
};
