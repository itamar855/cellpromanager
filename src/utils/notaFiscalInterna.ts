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
  const pad = 14;
  let y = 0;

  const GREEN: [number,number,number] = [16, 185, 129];
  const GREEN_DARK: [number,number,number] = [6, 78, 59];
  const TEXT_DARK: [number,number,number] = [17, 24, 39];
  const TEXT_MID: [number,number,number] = [75, 85, 99];
  const TEXT_LIGHT: [number,number,number] = [156, 163, 175];
  const BG_LIGHT: [number,number,number] = [249, 250, 251];
  const BORDER: [number,number,number] = [209, 213, 219];
  const BLUE: [number,number,number] = [59, 130, 246];
  const AMBER: [number,number,number] = [245, 158, 11];

  const checkPage = (needed = 20) => {
    if (y + needed > 272) { doc.addPage(); y = pad; }
  };

  // HEADER
  doc.setFillColor(...GREEN_DARK); doc.rect(0, 0, W, 34, "F");
  doc.setFillColor(...GREEN); doc.rect(0, 0, W, 28, "F");

  let logoX = pad;
  if (data.lojaLogoUrl) {
    try { doc.addImage(data.lojaLogoUrl, "PNG", pad, 6, 16, 16); logoX = pad + 20; } catch (_) {}
  }

  doc.setFontSize(16); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text(data.lojaNome, logoX, 14);
  doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(200,255,230);
  const lojaInfo: string[] = [];
  if (data.lojaCnpj)     lojaInfo.push("CNPJ: " + data.lojaCnpj);
  if (data.lojaTelefone) lojaInfo.push("Tel: " + data.lojaTelefone);
  if (data.lojaEndereco) lojaInfo.push(data.lojaEndereco);
  if (data.lojaInstagram) lojaInfo.push(data.lojaInstagram);
  if (lojaInfo.length > 0) doc.text(lojaInfo.slice(0,3).join("  |  "), logoX, 20);
  if (lojaInfo.length > 3) doc.text(lojaInfo.slice(3).join("  |  "), logoX, 25);

  // Note number box
  doc.setFillColor(0,0,0);
  doc.setGState(new (doc as any).GState({ opacity: 0.2 }));
  doc.roundedRect(W - pad - 38, 7, 38, 16, 2, 2, "F");
  doc.setGState(new (doc as any).GState({ opacity: 1 }));
  doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(200,255,230);
  doc.text("COMPROVANTE DE VENDA", W-pad-19, 12.5, { align:"center" });
  doc.setFontSize(13); doc.setFont("helvetica","bold"); doc.setTextColor(255,255,255);
  doc.text("N " + data.numeroNota, W-pad-19, 20, { align:"center" });

  y = 36;

  // Status bar
  doc.setFillColor(...GREEN); doc.roundedRect(pad, y, W-pad*2, 9, 2, 2, "F");
  doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(255,255,255);
  doc.text("VENDA REALIZADA COM SUCESSO", pad+5, y+6);
  doc.setFont("helvetica","normal"); doc.setFontSize(8);
  doc.text(data.dataVenda, W-pad-4, y+6, { align:"right" });
  y += 14;

  const section = (title: string) => {
    checkPage(18);
    doc.setFillColor(...BG_LIGHT); doc.roundedRect(pad, y, W-pad*2, 8, 1.5, 1.5, "F");
    doc.setDrawColor(...BORDER); doc.roundedRect(pad, y, W-pad*2, 8, 1.5, 1.5, "S");
    doc.setFillColor(...GREEN); doc.rect(pad, y, 3, 8, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.setTextColor(...TEXT_DARK);
    doc.text(title, pad+6, y+5.5);
    y += 12;
    doc.setFont("helvetica","normal"); doc.setTextColor(...TEXT_DARK);
  };

  const field = (label: string, value: string, xOff = 0, maxW = W-pad*2) => {
    if (!value || value === "—") return;
    checkPage(10);
    doc.setFontSize(7); doc.setTextColor(...TEXT_MID); doc.setFont("helvetica","normal");
    doc.text(label, pad+xOff, y);
    doc.setFontSize(9.5); doc.setTextColor(...TEXT_DARK); doc.setFont("helvetica","bold");
    const lines = doc.splitTextToSize(value, maxW-xOff-2);
    doc.text(lines, pad+xOff, y+5);
    doc.setFont("helvetica","normal");
    y += 7 + (lines.length-1)*4.5;
  };

  const col2 = (l1: string, v1: string, l2: string, v2: string) => {
    const half = (W-pad*2)/2-4;
    const ySnap = y;
    field(l1, v1, 0, half);
    const yAfter = y; y = ySnap;
    field(l2, v2, half+8, half);
    y = Math.max(yAfter, y)+1;
  };

  // CLIENTE
  section("DADOS DO CLIENTE");
  col2("Nome", data.clienteNome || "Nao informado", "CPF", data.clienteCpf || "Nao informado");
  if (data.clienteTelefone) field("Telefone", data.clienteTelefone);
  y += 3;

  // PRODUTO
  section("DADOS DO PRODUTO");
  col2("Produto", data.produtoNome, "Marca", data.produtoMarca);
  col2("Modelo", data.produtoModelo || "—", "Cor", data.produtoCor || "—");

  if (data.produtoImei) {
    checkPage(14);
    doc.setFillColor(254,243,199); doc.roundedRect(pad, y, W-pad*2, 12, 1.5, 1.5, "F");
    doc.setDrawColor(...AMBER); doc.roundedRect(pad, y, W-pad*2, 12, 1.5, 1.5, "S");
    doc.setFontSize(7.5); doc.setFont("helvetica","bold"); doc.setTextColor(120,80,0);
    doc.text("IMEI / NUMERO DE SERIE:", pad+3, y+4.5);
    doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.setTextColor(...TEXT_DARK);
    doc.text(data.produtoImei, pad+3, y+10);
    y += 16;
  }
  y += 3;

  // PAGAMENTO
  section("PAGAMENTO");
  checkPage(30);

  doc.setFillColor(240,253,244); doc.roundedRect(pad, y, W-pad*2, 14, 2, 2, "F");
  doc.setDrawColor(...GREEN); doc.roundedRect(pad, y, W-pad*2, 14, 2, 2, "S");
  doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(...TEXT_MID);
  doc.text("VALOR TOTAL DA VENDA", pad+5, y+6);
  doc.setFontSize(16); doc.setFont("helvetica","bold"); doc.setTextColor(...GREEN);
  doc.text(formatCurrency(data.valorVenda), W-pad-5, y+11, { align:"right" });
  y += 18;

  const pagLines: [string, number][] = [];
  if ((data.valorDinheiro ?? 0) > 0) pagLines.push(["Dinheiro", data.valorDinheiro!]);
  if ((data.valorCartao ?? 0) > 0)   pagLines.push(["Cartao", data.valorCartao!]);
  if ((data.valorPix ?? 0) > 0)      pagLines.push(["PIX", data.valorPix!]);
  if (data.tradeIn && (data.tradeInValor ?? 0) > 0)
    pagLines.push(["Troca: " + (data.tradeInNome || "Aparelho"), data.tradeInValor!]);

  if (pagLines.length > 0) {
    pagLines.forEach(([label, val]) => {
      checkPage(8);
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(...TEXT_DARK);
      doc.text(label, pad+5, y);
      doc.setFont("helvetica","bold");
      doc.text(formatCurrency(val), W-pad-5, y, { align:"right" });
      y += 6.5;
    });
    y += 2;
  }

  // GARANTIA
  checkPage(22);
  const dataGarantia = new Date();
  dataGarantia.setDate(dataGarantia.getDate() + 90);
  doc.setFillColor(239,246,255); doc.roundedRect(pad, y, W-pad*2, 16, 2, 2, "F");
  doc.setDrawColor(...BLUE); doc.roundedRect(pad, y, W-pad*2, 16, 2, 2, "S");
  doc.setFillColor(...BLUE); doc.rect(pad, y, 3, 16, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(30,64,175);
  doc.text("GARANTIA DE 90 DIAS", pad+6, y+7);
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(55,90,175);
  doc.text("Cobre defeitos de fabricacao. Apresente este comprovante.", pad+6, y+12.5);
  doc.setFont("helvetica","bold"); doc.setFontSize(8);
  doc.text("Valida ate: " + dataGarantia.toLocaleDateString("pt-BR"), W-pad-5, y+12.5, { align:"right" });
  y += 20;

  // OBSERVACOES
  if (data.observacoes) {
    section("OBSERVACOES");
    doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(...TEXT_DARK);
    const obsLines = doc.splitTextToSize(data.observacoes, W-pad*2-4);
    checkPage(obsLines.length*5+6);
    doc.text(obsLines, pad+2, y);
    y += obsLines.length*5+6;
  }

  // TERMOS
  checkPage(40);
  section("TERMOS E CONDICOES");
  doc.setFontSize(7.5); doc.setTextColor(...TEXT_MID); doc.setFont("helvetica","normal");
  const termsLines = doc.splitTextToSize(TERMOS, W-pad*2-4);
  checkPage(termsLines.length*4+6);
  doc.text(termsLines, pad+2, y);
  y += termsLines.length*4+8;

  // ASSINATURA
  checkPage(35);
  doc.setDrawColor(...BORDER);
  doc.line(pad+5, y+18, pad+80, y+18);
  doc.line(W-pad-80, y+18, W-pad-5, y+18);
  doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(...TEXT_LIGHT);
  doc.text(data.clienteNome || "Assinatura do Cliente", pad+5, y+23);
  doc.text("Assinatura da Loja", W-pad-80, y+23);
  y += 30;

  // RODAPE
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER); doc.line(pad, 284, W-pad, 284);
    doc.setFontSize(7); doc.setTextColor(...TEXT_LIGHT);
    doc.text(
      data.lojaNome + (data.lojaCnpj ? "  |  CNPJ: " + data.lojaCnpj : "") +
      "  |  Gerado em " + new Date().toLocaleString("pt-BR") +
      "  |  CellManager  |  Pg " + i + "/" + pageCount,
      W/2, 289, { align:"center" }
    );
    doc.text(
      "Este documento e um comprovante interno e nao substitui a Nota Fiscal Eletronica (NF-e).",
      W/2, 293, { align:"center" }
    );
  }

  return doc;
};
