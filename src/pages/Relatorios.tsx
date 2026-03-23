import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  FileText, TrendingUp, TrendingDown, ShoppingBag, Wrench,
  Wallet, Trophy, Medal, Download, Star, Crown, Users, MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { gerarNotaFiscalInterna, type NotaFiscalData } from "@/utils/notaFiscalInterna";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const formatPct = (v: number) => `${v.toFixed(1)}%`;

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const COLORS = ["hsl(152,60%,45%)","hsl(38,92%,50%)","hsl(210,80%,55%)","hsl(280,60%,55%)","hsl(0,62%,50%)"];

const getPeriodDates = (period: string, customStart: string, customEnd: string) => {
  const now = new Date();
  if (period === "custom") {
    return {
      start: customStart ? new Date(customStart).toISOString() : new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      end: customEnd ? new Date(customEnd + "T23:59:59").toISOString() : now.toISOString(),
    };
  }
  if (period === "week") { const d = new Date(now); d.setDate(d.getDate() - 7); return { start: d.toISOString(), end: now.toISOString() }; }
  if (period === "month") return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), end: now.toISOString() };
  if (period === "quarter") { const q = Math.floor(now.getMonth() / 3) * 3; return { start: new Date(now.getFullYear(), q, 1).toISOString(), end: now.toISOString() }; }
  return { start: new Date(now.getFullYear(), 0, 1).toISOString(), end: now.toISOString() };
};

const exportCSV = (rows: Record<string, any>[], filename: string) => {
  if (!rows.length) { toast.error("Sem dados para exportar"); return; }
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(";"), ...rows.map(r => keys.map(k => String(r[k] ?? "").replace(/;/g, ",")).join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success("CSV exportado!");
};

const RankBadge = ({ pos }: { pos: number }) => {
  if (pos === 1) return <Crown className="h-5 w-5 text-yellow-400" />;
  if (pos === 2) return <Medal className="h-5 w-5 text-slate-400" />;
  if (pos === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <span className="text-muted-foreground text-sm font-bold w-5 text-center">{pos}º</span>;
};

const Filters = ({ period, setPeriod, storeId, setStoreId, stores, customStart, setCustomStart, customEnd, setCustomEnd }: any) => (
  <div className="flex flex-wrap gap-2 items-end">
    <div className="space-y-1">
      <Label className="text-xs">Período</Label>
      <Select value={period} onValueChange={setPeriod}>
        <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="week">Esta Semana</SelectItem>
          <SelectItem value="month">Este Mês</SelectItem>
          <SelectItem value="quarter">Trimestre</SelectItem>
          <SelectItem value="year">Este Ano</SelectItem>
          <SelectItem value="custom">Personalizado</SelectItem>
        </SelectContent>
      </Select>
    </div>
    {period === "custom" && (
      <>
        <div className="space-y-1">
          <Label className="text-xs">De</Label>
          <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-9 w-36" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-9 w-36" />
        </div>
      </>
    )}
    <div className="space-y-1">
      <Label className="text-xs">Loja</Label>
      <Select value={storeId} onValueChange={setStoreId}>
        <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as lojas</SelectItem>
          {stores.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  </div>
);

const Relatorios = () => {
  const [tab, setTab] = useState("dre");
  const [stores, setStores] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [period, setPeriod] = useState("month");
  const [storeId, setStoreId] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [rankPeriod, setRankPeriod] = useState("week");
  const [rankCustomStart, setRankCustomStart] = useState("");
  const [rankCustomEnd, setRankCustomEnd] = useState("");
  const [notaLoading, setNotaLoading] = useState<string | null>(null);

  // Data
  const [dre, setDre] = useState<any>({});
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [storeBreakdown, setStoreBreakdown] = useState<any[]>([]);
  const [salesDetail, setSalesDetail] = useState<any[]>([]);
  const [rankingProducts, setRankingProducts] = useState<any[]>([]);
  const [osData, setOsData] = useState<any[]>([]);
  const [osStats, setOsStats] = useState<any>({});
  const [caixaData, setCaixaData] = useState<any[]>([]);
  const [caixaStats, setCaixaStats] = useState<any>({});
  const [ranking, setRanking] = useState<any[]>([]);
  const [comissoes, setComissoes] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("stores").select("*").then(r => setStores(r.data ?? []));
    supabase.from("profiles").select("*").then(r => setProfiles(r.data ?? []));
  }, []);

  const profileMap = new Map(profiles.map(p => [p.user_id, p.display_name ?? p.user_id]));
  const storeMap = new Map(stores.map(s => [s.id, s]));

  // ── DRE ──────────────────────────────────────────────────────────────────
  const fetchDRE = useCallback(async () => {
    const { start, end } = getPeriodDates(period, customStart, customEnd);
    const q = (t: any) => storeId !== "all" ? t.eq("store_id", storeId) : t;
    const [salesRes, productsRes, txRes, osRes] = await Promise.all([
      q(supabase.from("sales").select("*").gte("created_at", start).lte("created_at", end)),
      supabase.from("products").select("*"),
      q(supabase.from("transactions").select("*").gte("created_at", start).lte("created_at", end)),
      q(supabase.from("service_orders").select("*").eq("status", "delivered").gte("created_at", start).lte("created_at", end)),
    ]);
    const sales = salesRes.data ?? [];
    const products = productsRes.data ?? [];
    const tx = txRes.data ?? [];
    const os = osRes.data ?? [];
    const productMap = new Map(products.map((p: any) => [p.id, p]));

    const receitaAparelhos = sales.reduce((s: number, x: any) => s + Number(x.sale_price), 0);
    const receitaOS = os.reduce((s: number, x: any) => s + Number(x.final_price || x.estimated_price || 0), 0);
    const accSales = tx.filter((t: any) => t.type === "income" && t.category === "acessorio");
    const receitaAcessorios = accSales.reduce((s: number, t: any) => s + Number(t.amount), 0);
    const cmvAparelhos = sales.reduce((s: number, x: any) => s + Number((productMap.get(x.product_id) as any)?.cost_price || 0), 0);
    const cmvAcessorios = tx.filter((t: any) => t.type === "expense_pj" && t.category === "acessorio").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const totalReceita = receitaAparelhos + receitaAcessorios + receitaOS;
    const totalCmv = cmvAparelhos + cmvAcessorios;
    const despesasPJ = tx.filter((t: any) => t.type === "expense_pj" && t.category !== "acessorio").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const despesasPF = tx.filter((t: any) => t.type === "expense_pf").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const proLabore = tx.filter((t: any) => t.type === "pro_labore").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const lucroBruto = totalReceita - totalCmv;
    const totalDespesas = despesasPJ + despesasPF + proLabore;
    const lucroLiquido = lucroBruto - totalDespesas;
    setDre({ receitaAparelhos, receitaAcessorios, receitaOS, totalReceita, cmvAparelhos, cmvAcessorios, totalCmv, lucroBruto, despesasPJ, despesasPF, proLabore, totalDespesas, lucroLiquido, qtdVendasAparelhos: sales.length, qtdVendasAcessorios: accSales.length });

    const now = new Date();
    const mMap: Record<string, any> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      mMap[MONTHS[d.getMonth()].substring(0, 3)] = { receita: 0, despesa: 0 };
    }
    sales.forEach((s: any) => { const k = MONTHS[new Date(s.created_at).getMonth()].substring(0, 3); if (mMap[k]) mMap[k].receita += Number(s.sale_price); });
    tx.forEach((t: any) => { if (t.type !== "sale" && t.type !== "income") { const k = MONTHS[new Date(t.created_at).getMonth()].substring(0, 3); if (mMap[k]) mMap[k].despesa += Number(t.amount); } });
    setMonthlyData(Object.entries(mMap).map(([name, d]) => ({ name, receita: d.receita, despesa: d.despesa, lucro: d.receita - d.despesa })));

    const sStats: Record<string, any> = {};
    sales.forEach((s: any) => {
      const name = (storeMap.get(s.store_id) as any)?.name || "Sem loja";
      if (!sStats[name]) sStats[name] = { vendas: 0, lucro: 0 };
      sStats[name].vendas += Number(s.sale_price);
      sStats[name].lucro += Number(s.sale_price) - Number((productMap.get(s.product_id) as any)?.cost_price || 0);
    });
    setStoreBreakdown(Object.entries(sStats).map(([name, d]: any) => ({ name, ...d })));
  }, [period, storeId, customStart, customEnd]);

  // ── VENDAS ────────────────────────────────────────────────────────────────
  const fetchVendas = useCallback(async () => {
    const { start, end } = getPeriodDates(period, customStart, customEnd);
    const [salesRes, productsRes] = await Promise.all([
      supabase.from("sales").select("*").gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false }),
      supabase.from("products").select("*"),
    ]);
    const sales = (salesRes.data ?? []).filter((s: any) => storeId === "all" || s.store_id === storeId);
    const products = productsRes.data ?? [];
    const productMap = new Map(products.map((p: any) => [p.id, p]));
    const rows = sales.map((s: any) => {
      const p: any = productMap.get(s.product_id);
      const lucro = Number(s.sale_price) - Number(p?.cost_price || 0);
      return { _raw: s, _product: p, data: new Date(s.created_at).toLocaleDateString("pt-BR"), produto: p?.name ?? "—", marca: p?.brand ?? "—", loja: (storeMap.get(s.store_id) as any)?.name ?? "—", cliente: s.customer_name ?? "—", valor: Number(s.sale_price), custo: Number(p?.cost_price || 0), lucro, margem: Number(s.sale_price) > 0 ? (lucro / Number(s.sale_price)) * 100 : 0, dinheiro: Number(s.payment_cash), cartao: Number(s.payment_card), pix: Number(s.payment_pix), troca: s.has_trade_in ? `Sim (${formatCurrency(Number(s.trade_in_value || 0))})` : "Não", comissao: formatCurrency(Number(s.commission_value || 0)) };
    });
    setSalesDetail(rows);
    const prodRank: Record<string, any> = {};
    rows.forEach(r => {
      if (!prodRank[r.produto]) prodRank[r.produto] = { produto: r.produto, marca: r.marca, qtd: 0, total: 0, lucro: 0 };
      prodRank[r.produto].qtd++; prodRank[r.produto].total += r.valor; prodRank[r.produto].lucro += r.lucro;
    });
    setRankingProducts(Object.values(prodRank).sort((a, b) => b.total - a.total).slice(0, 10));
  }, [period, storeId, customStart, customEnd]);

  // ── OS ────────────────────────────────────────────────────────────────────
  const fetchOS = useCallback(async () => {
    const { start, end } = getPeriodDates(period, customStart, customEnd);
    const { data } = await supabase.from("service_orders").select("*").gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false });
    const all = ((data ?? []) as any[]).filter(o => storeId === "all" || o.store_id === storeId);
    setOsData(all);
    const delivered = all.filter(o => o.status === "delivered");
    const totalReceitaOS = delivered.reduce((s, o) => s + Number(o.final_price || o.estimated_price || 0), 0);
    const techStats: Record<string, any> = {};
    all.forEach(o => {
      const name = profileMap.get(o.technician_id) ?? "Sem técnico";
      if (!techStats[name]) techStats[name] = { tecnico: name, total: 0, entregues: 0, receita: 0 };
      techStats[name].total++;
      if (o.status === "delivered") { techStats[name].entregues++; techStats[name].receita += Number(o.final_price || o.estimated_price || 0); }
    });
    const serviceStats: Record<string, number> = {};
    all.forEach(o => { serviceStats[o.requested_service] = (serviceStats[o.requested_service] || 0) + 1; });
    setOsStats({ total: all.length, delivered: delivered.length, cancelled: all.filter(o => o.status === "cancelled").length, open: all.filter(o => !["delivered","cancelled"].includes(o.status)).length, totalReceita: totalReceitaOS, ticketMedio: delivered.length > 0 ? totalReceitaOS / delivered.length : 0, byTech: Object.values(techStats).sort((a, b) => b.receita - a.receita), byService: Object.entries(serviceStats).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value })) });
  }, [period, storeId, customStart, customEnd, profileMap]);

  // ── CAIXA ─────────────────────────────────────────────────────────────────
  const fetchCaixa = useCallback(async () => {
    const { start, end } = getPeriodDates(period, customStart, customEnd);
    const { data: registers } = await supabase.from("cash_registers" as any).select("*").gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false });
    const all = ((registers ?? []) as any[]).filter(r => storeId === "all" || r.store_id === storeId);
    const closed = all.filter(r => r.status === "closed");
    setCaixaData(all.map(r => ({ data: new Date(r.created_at).toLocaleDateString("pt-BR"), loja: (storeMap.get(r.store_id) as any)?.name ?? "—", status: r.status === "open" ? "Aberto" : "Fechado", abertura: Number(r.opening_amount || 0), fechamento: Number(r.closing_amount || 0), esperado: Number(r.expected_amount || 0), diferenca: Number(r.difference || 0), motivo: r.difference_reason ?? "" })));
    setCaixaStats({ total: all.length, abertos: all.filter(r => r.status === "open").length, fechados: closed.length, totalDiferenca: closed.reduce((s, r) => s + Number(r.difference || 0), 0), comDiferenca: closed.filter(r => Math.abs(Number(r.difference || 0)) > 5).length });
  }, [period, storeId, customStart, customEnd]);

  // ── RANKING ───────────────────────────────────────────────────────────────
  const fetchRanking = useCallback(async () => {
    const { start, end } = getPeriodDates(rankPeriod, rankCustomStart, rankCustomEnd);
    const [salesRes, productsRes, osRes] = await Promise.all([
      supabase.from("sales").select("*").gte("created_at", start).lte("created_at", end),
      supabase.from("products").select("*"),
      supabase.from("service_orders").select("*").eq("status", "delivered").gte("delivered_at", start).lte("delivered_at", end),
    ]);
    const sales = ((salesRes.data ?? []) as any[]).filter(s => storeId === "all" || s.store_id === storeId);
    const products = productsRes.data ?? [];
    const os = ((osRes.data ?? []) as any[]).filter(o => storeId === "all" || o.store_id === storeId);
    const productMap = new Map(products.map((p: any) => [p.id, p]));
    const stats: Record<string, any> = {};
    const ensure = (uid: string) => { if (!stats[uid]) stats[uid] = { uid, nome: profileMap.get(uid) ?? "Usuário", totalVendas: 0, qtdVendas: 0, lucro: 0, comissoes: 0, osEntregues: 0 }; };
    sales.forEach((s: any) => { ensure(s.created_by); stats[s.created_by].totalVendas += Number(s.sale_price); stats[s.created_by].qtdVendas++; const p: any = productMap.get(s.product_id); stats[s.created_by].lucro += Number(s.sale_price) - Number(p?.cost_price || 0); stats[s.created_by].comissoes += Number(s.commission_value || 0); });
    os.forEach((o: any) => { const uid = o.technician_id || o.created_by; ensure(uid); stats[uid].osEntregues++; });
    const sorted = Object.values(stats).sort((a, b) => b.totalVendas - a.totalVendas);
    setRanking(sorted);
    setComissoes(sorted.filter(s => s.comissoes > 0).sort((a, b) => b.comissoes - a.comissoes));
  }, [rankPeriod, storeId, rankCustomStart, rankCustomEnd, profileMap]);

  useEffect(() => { if (tab === "dre") fetchDRE(); }, [tab, fetchDRE]);
  useEffect(() => { if (tab === "vendas") fetchVendas(); }, [tab, fetchVendas]);
  useEffect(() => { if (tab === "os") fetchOS(); }, [tab, fetchOS]);
  useEffect(() => { if (tab === "caixa") fetchCaixa(); }, [tab, fetchCaixa]);
  useEffect(() => { if (tab === "ranking" || tab === "comissoes") fetchRanking(); }, [tab, fetchRanking]);

  // ── GERAR NOTA ────────────────────────────────────────────────────────────
  const handleGerarNota = async (row: any, enviarWhatsApp = false) => {
    const sale = row._raw;
    const product = row._product;
    const store = storeMap.get(sale.store_id) as any;
    setNotaLoading(sale.id);
    try {
      const numeroNota = `VND-${sale.id.slice(0, 8).toUpperCase()}`;
      const data: NotaFiscalData = {
        numeroNota, dataVenda: new Date(sale.created_at).toLocaleString("pt-BR"),
        lojaNome: store?.name ?? "Loja", lojaCnpj: store?.cnpj, lojaEndereco: store?.address,
        lojaTelefone: store?.phone, lojaWhatsapp: store?.whatsapp, lojaInstagram: store?.instagram, lojaLogoUrl: store?.logo_url,
        clienteNome: sale.customer_name ?? undefined, clienteTelefone: sale.customer_phone ?? undefined,
        produtoNome: product?.name ?? "Produto", produtoMarca: product?.brand ?? "",
        produtoModelo: product?.model, produtoImei: product?.imei ?? undefined, produtoCor: product?.color ?? undefined,
        valorVenda: Number(sale.sale_price), valorDinheiro: Number(sale.payment_cash) || undefined,
        valorCartao: Number(sale.payment_card) || undefined, valorPix: Number(sale.payment_pix) || undefined,
        tradeIn: sale.has_trade_in, tradeInValor: sale.trade_in_value ? Number(sale.trade_in_value) : undefined,
        tradeInNome: sale.trade_in_device_name ?? undefined, observacoes: sale.notes ?? undefined,
      };
      const doc = await gerarNotaFiscalInterna(data);

      if (enviarWhatsApp) {
        if (!sale.customer_phone) { toast.error("Cliente sem telefone!"); setNotaLoading(null); return; }
        const pdfBlob = doc.output("blob");
        const { data: uploadData, error } = await supabase.storage.from("comprovantes").upload(`notas/${numeroNota}-${Date.now()}.pdf`, pdfBlob, { upsert: true, contentType: "application/pdf" });
        if (error) { toast.error("Erro ao enviar PDF"); setNotaLoading(null); return; }
        const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(uploadData.path);
        const phone = sale.customer_phone.replace(/\D/g, "");
        const msg = encodeURIComponent(`Olá ${sale.customer_name || ""}! 👋\n\nSegue o comprovante da sua compra na *${store?.name ?? "nossa loja"}*.\n\n📄 Comprovante Nº ${numeroNota}:\n${urlData.publicUrl}\n\nObrigado pela preferência! 🙏`);
        window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
        toast.success("WhatsApp aberto!");
      } else {
        doc.save(`nota-${numeroNota}.pdf`);
        toast.success("Nota gerada!");
      }
    } catch { toast.error("Erro ao gerar nota. Verifique se o jsPDF está instalado."); }
    setNotaLoading(null);
  };

  const filterProps = { period, setPeriod, storeId, setStoreId, stores, customStart, setCustomStart, customEnd, setCustomEnd };

  const dreLines = [
    { label: "Receita de Aparelhos", value: dre.receitaAparelhos ?? 0, sub: `${dre.qtdVendasAparelhos ?? 0} vendas`, type: "income" },
    { label: "Receita de Acessórios", value: dre.receitaAcessorios ?? 0, sub: `${dre.qtdVendasAcessorios ?? 0} vendas`, type: "income" },
    { label: "Receita de Serviços (OS)", value: dre.receitaOS ?? 0, type: "income" },
    { label: "= Receita Total", value: dre.totalReceita ?? 0, type: "total", bold: true },
    { label: "(-) CMV Aparelhos", value: -(dre.cmvAparelhos ?? 0), type: "expense" },
    { label: "(-) CMV Acessórios", value: -(dre.cmvAcessorios ?? 0), type: "expense" },
    { label: "= Lucro Bruto", value: dre.lucroBruto ?? 0, type: "total", bold: true },
    { label: "(-) Despesas PJ (Operacionais)", value: -(dre.despesasPJ ?? 0), type: "expense" },
    { label: "(-) Despesas PF (Pessoais)", value: -(dre.despesasPF ?? 0), type: "expense" },
    { label: "(-) Pro-labore", value: -(dre.proLabore ?? 0), type: "expense" },
    { label: "= Total de Despesas", value: -(dre.totalDespesas ?? 0), type: "total", bold: true },
    { label: "= LUCRO LÍQUIDO", value: dre.lucroLiquido ?? 0, type: "result", bold: true },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Análises financeiras e operacionais</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 w-full">
          <TabsTrigger value="dre" className="text-xs gap-1.5"><FileText className="h-3.5 w-3.5" /> DRE</TabsTrigger>
          <TabsTrigger value="vendas" className="text-xs gap-1.5"><ShoppingBag className="h-3.5 w-3.5" /> Vendas</TabsTrigger>
          <TabsTrigger value="os" className="text-xs gap-1.5"><Wrench className="h-3.5 w-3.5" /> OS</TabsTrigger>
          <TabsTrigger value="caixa" className="text-xs gap-1.5"><Wallet className="h-3.5 w-3.5" /> Caixa</TabsTrigger>
          <TabsTrigger value="ranking" className="text-xs gap-1.5"><Trophy className="h-3.5 w-3.5" /> Ranking</TabsTrigger>
          <TabsTrigger value="comissoes" className="text-xs gap-1.5"><Star className="h-3.5 w-3.5" /> Comissões</TabsTrigger>
        </TabsList>

        {/* ── DRE ─────────────────────────────────────────────────────────── */}
        <TabsContent value="dre" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Filters {...filterProps} />
            <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={() => exportCSV(dreLines.map(l => ({ item: l.label, valor: formatCurrency(Math.abs(l.value)) })), "dre.csv")}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="font-display text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> DRE Simplificado</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {dreLines.map((line, i) => (
                  <div key={i} className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm ${line.bold ? "bg-muted/50 font-semibold" : ""} ${line.type === "result" ? "bg-primary/10 text-primary font-bold text-base" : ""}`}>
                    <div>
                      <span className={line.bold ? "" : "text-muted-foreground"}>{line.label}</span>
                      {(line as any).sub && <span className="text-[10px] text-muted-foreground ml-2">({(line as any).sub})</span>}
                    </div>
                    <span className={line.type === "result" ? (line.value >= 0 ? "text-primary" : "text-destructive") : line.type === "expense" ? "text-destructive" : ""}>
                      {line.type === "expense" ? "- " : ""}{formatCurrency(Math.abs(line.value))}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Margem Bruta", value: (dre.totalReceita ?? 0) > 0 ? formatPct(((dre.lucroBruto ?? 0) / dre.totalReceita) * 100) : "0%", color: "text-primary" },
              { label: "Margem Líquida", value: (dre.totalReceita ?? 0) > 0 ? formatPct(((dre.lucroLiquido ?? 0) / dre.totalReceita) * 100) : "0%", color: (dre.lucroLiquido ?? 0) >= 0 ? "text-primary" : "text-destructive" },
              { label: "Ticket Médio", value: (dre.qtdVendasAparelhos ?? 0) > 0 ? formatCurrency((dre.receitaAparelhos ?? 0) / dre.qtdVendasAparelhos) : formatCurrency(0), color: "" },
              { label: "Receita Total", value: formatCurrency(dre.totalReceita ?? 0), color: "text-primary" },
            ].map(k => (
              <Card key={k.label} className="border-border/50"><CardContent className="p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{k.label}</p>
                <p className={`font-display text-xl font-bold mt-1 ${k.color}`}>{k.value}</p>
              </CardContent></Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="font-display text-sm">Receita vs Despesas (6 meses)</CardTitle></CardHeader>
              <CardContent>
                {monthlyData.some(d => d.receita > 0 || d.despesa > 0) ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="receita" fill={COLORS[0]} radius={[4,4,0,0]} name="Receita" />
                      <Bar dataKey="despesa" fill={COLORS[4]} radius={[4,4,0,0]} name="Despesas" />
                      <Bar dataKey="lucro" fill={COLORS[1]} radius={[4,4,0,0]} name="Lucro" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="flex items-center justify-center h-[220px] text-muted-foreground text-xs">Sem dados para o período</div>}
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="font-display text-sm">Resultado por Loja</CardTitle></CardHeader>
              <CardContent>
                {storeBreakdown.length > 0 ? (
                  <div className="space-y-3">
                    {storeBreakdown.map(s => (
                      <div key={s.name} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                        <div><p className="font-medium text-sm">{s.name}</p><p className="text-xs text-muted-foreground">Vendas: {formatCurrency(s.vendas)}</p></div>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${s.lucro >= 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(s.lucro)}</p>
                          <div className="flex items-center gap-1 justify-end">{s.lucro >= 0 ? <TrendingUp className="h-3 w-3 text-primary" /> : <TrendingDown className="h-3 w-3 text-destructive" />}<span className="text-[10px] text-muted-foreground">lucro</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div className="flex items-center justify-center h-[220px] text-muted-foreground text-xs">Sem dados para o período</div>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── VENDAS ──────────────────────────────────────────────────────── */}
        <TabsContent value="vendas" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Filters {...filterProps} />
            <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={() => exportCSV(salesDetail.map(r => ({ data: r.data, produto: r.produto, marca: r.marca, loja: r.loja, cliente: r.cliente, valor: formatCurrency(r.valor), custo: formatCurrency(r.custo), lucro: formatCurrency(r.lucro), margem: formatPct(r.margem), troca: r.troca })), "vendas.csv")}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Vendido", value: formatCurrency(salesDetail.reduce((s, r) => s + r.valor, 0)), color: "text-primary" },
              { label: "Lucro Total", value: formatCurrency(salesDetail.reduce((s, r) => s + r.lucro, 0)), color: "text-primary" },
              { label: "Qtd. Vendas", value: String(salesDetail.length), color: "" },
              { label: "Ticket Médio", value: salesDetail.length > 0 ? formatCurrency(salesDetail.reduce((s, r) => s + r.valor, 0) / salesDetail.length) : formatCurrency(0), color: "" },
            ].map(k => (
              <Card key={k.label} className="border-border/50"><CardContent className="p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{k.label}</p>
                <p className={`font-display text-xl font-bold mt-1 ${k.color}`}>{k.value}</p>
              </CardContent></Card>
            ))}
          </div>
          {rankingProducts.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="font-display text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-500" /> Top 10 Produtos Mais Vendidos</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {rankingProducts.map((p, i) => (
                    <div key={p.produto} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{i + 1}º</span>
                        <div className="min-w-0"><p className="text-sm font-medium truncate">{p.produto}</p><p className="text-[10px] text-muted-foreground">{p.marca} · {p.qtd} venda{p.qtd !== 1 ? "s" : ""}</p></div>
                      </div>
                      <div className="text-right shrink-0"><p className="text-sm font-bold text-primary">{formatCurrency(p.total)}</p><p className="text-[10px] text-muted-foreground">lucro: {formatCurrency(p.lucro)}</p></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="font-display text-sm">Detalhamento de Vendas ({salesDetail.length})</CardTitle></CardHeader>
            <CardContent>
              {salesDetail.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        {["Data","Produto","Marca","Cliente","Valor","Lucro","Margem","Nota"].map(h => (
                          <th key={h} className="text-left py-2 px-2 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {salesDetail.map((r, i) => (
                        <tr key={i} className="border-b border-border/30 hover:bg-muted/30">
                          <td className="py-2 px-2 whitespace-nowrap">{r.data}</td>
                          <td className="py-2 px-2 font-medium">{r.produto}</td>
                          <td className="py-2 px-2">{r.marca}</td>
                          <td className="py-2 px-2">{r.cliente}</td>
                          <td className="py-2 px-2 text-primary font-bold whitespace-nowrap">{formatCurrency(r.valor)}</td>
                          <td className={`py-2 px-2 font-bold whitespace-nowrap ${r.lucro >= 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(r.lucro)}</td>
                          <td className="py-2 px-2 whitespace-nowrap">{formatPct(r.margem)}</td>
                          <td className="py-2 px-2">
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="h-6 text-[9px] px-1.5 gap-1"
                                onClick={() => handleGerarNota(r, false)} disabled={notaLoading === r._raw?.id}>
                                <FileText className="h-2.5 w-2.5" /> PDF
                              </Button>
                              {r._raw?.customer_phone && (
                                <Button size="sm" variant="outline" className="h-6 text-[9px] px-1.5 gap-1 text-green-500 border-green-500/30"
                                  onClick={() => handleGerarNota(r, true)} disabled={notaLoading === r._raw?.id}>
                                  <MessageCircle className="h-2.5 w-2.5" /> WA
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-xs text-muted-foreground text-center py-8">Nenhuma venda no período</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── OS ──────────────────────────────────────────────────────────── */}
        <TabsContent value="os" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Filters {...filterProps} />
            <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={() => exportCSV(osData.map((o: any) => ({ numero: o.order_number, cliente: o.customer_name, aparelho: `${o.device_brand} ${o.device_model}`, servico: o.requested_service, status: o.status, tecnico: profileMap.get(o.technician_id) ?? "—", estimado: formatCurrency(Number(o.estimated_price || 0)), final: formatCurrency(Number(o.final_price || 0)), data: new Date(o.created_at).toLocaleDateString("pt-BR") })), "os.csv")}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total OS", value: String(osStats.total ?? 0), color: "" },
              { label: "Entregues", value: String(osStats.delivered ?? 0), color: "text-primary" },
              { label: "Em Aberto", value: String(osStats.open ?? 0), color: "text-yellow-500" },
              { label: "Receita OS", value: formatCurrency(osStats.totalReceita ?? 0), color: "text-primary" },
            ].map(k => (
              <Card key={k.label} className="border-border/50"><CardContent className="p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{k.label}</p>
                <p className={`font-display text-xl font-bold mt-1 ${k.color}`}>{k.value}</p>
              </CardContent></Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="font-display text-sm">Por Técnico</CardTitle></CardHeader>
              <CardContent>
                {(osStats.byTech ?? []).length > 0 ? (
                  <div className="space-y-2">
                    {(osStats.byTech ?? []).map((t: any) => (
                      <div key={t.tecnico} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                        <div><p className="text-sm font-medium">{t.tecnico}</p><p className="text-[10px] text-muted-foreground">{t.total} OS · {t.entregues} entregues</p></div>
                        <p className="text-sm font-bold text-primary">{formatCurrency(t.receita)}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-muted-foreground text-center py-6">Sem dados</p>}
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="font-display text-sm">Serviços Mais Solicitados</CardTitle></CardHeader>
              <CardContent>
                {(osStats.byService ?? []).length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={osStats.byService} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                        {(osStats.byService ?? []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-muted-foreground text-center py-6">Sem dados</p>}
              </CardContent>
            </Card>
          </div>
          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="font-display text-sm">Todas as OS ({osData.length})</CardTitle></CardHeader>
            <CardContent>
              {osData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        {["#","Cliente","Aparelho","Serviço","Técnico","Status","Estimado","Final","Data"].map(h => (
                          <th key={h} className="text-left py-2 px-2 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {osData.map((o: any) => (
                        <tr key={o.id} className="border-b border-border/30 hover:bg-muted/30">
                          <td className="py-2 px-2 font-mono">{o.order_number}</td>
                          <td className="py-2 px-2 font-medium">{o.customer_name}</td>
                          <td className="py-2 px-2 whitespace-nowrap">{o.device_brand} {o.device_model}</td>
                          <td className="py-2 px-2">{o.requested_service}</td>
                          <td className="py-2 px-2">{profileMap.get(o.technician_id) ?? "—"}</td>
                          <td className="py-2 px-2"><Badge variant="outline" className="text-[9px]">{o.status}</Badge></td>
                          <td className="py-2 px-2 whitespace-nowrap">{formatCurrency(Number(o.estimated_price || 0))}</td>
                          <td className="py-2 px-2 text-primary font-bold whitespace-nowrap">{formatCurrency(Number(o.final_price || 0))}</td>
                          <td className="py-2 px-2 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString("pt-BR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-xs text-muted-foreground text-center py-8">Nenhuma OS no período</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CAIXA ───────────────────────────────────────────────────────── */}
        <TabsContent value="caixa" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Filters {...filterProps} />
            <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={() => exportCSV(caixaData, "caixa.csv")}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Fechamentos", value: String(caixaStats.fechados ?? 0), color: "" },
              { label: "Em Aberto", value: String(caixaStats.abertos ?? 0), color: "text-yellow-500" },
              { label: "Diferença Total", value: formatCurrency(caixaStats.totalDiferenca ?? 0), color: (caixaStats.totalDiferenca ?? 0) >= 0 ? "text-primary" : "text-destructive" },
              { label: "C/ Divergência", value: String(caixaStats.comDiferenca ?? 0), color: (caixaStats.comDiferenca ?? 0) > 0 ? "text-destructive" : "text-primary" },
            ].map(k => (
              <Card key={k.label} className="border-border/50"><CardContent className="p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{k.label}</p>
                <p className={`font-display text-xl font-bold mt-1 ${k.color}`}>{k.value}</p>
              </CardContent></Card>
            ))}
          </div>
          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="font-display text-sm">Histórico de Caixas ({caixaData.length})</CardTitle></CardHeader>
            <CardContent>
              {caixaData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        {["Data","Loja","Status","Abertura","Fechamento","Esperado","Diferença","Motivo"].map(h => (
                          <th key={h} className="text-left py-2 px-2 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {caixaData.map((r, i) => (
                        <tr key={i} className="border-b border-border/30 hover:bg-muted/30">
                          <td className="py-2 px-2 whitespace-nowrap">{r.data}</td>
                          <td className="py-2 px-2">{r.loja}</td>
                          <td className="py-2 px-2"><Badge variant="outline" className={`text-[9px] ${r.status === "Aberto" ? "text-yellow-500 border-yellow-500/30" : "text-primary border-primary/30"}`}>{r.status}</Badge></td>
                          <td className="py-2 px-2 whitespace-nowrap">{formatCurrency(r.abertura)}</td>
                          <td className="py-2 px-2 whitespace-nowrap">{formatCurrency(r.fechamento)}</td>
                          <td className="py-2 px-2 whitespace-nowrap">{formatCurrency(r.esperado)}</td>
                          <td className={`py-2 px-2 font-bold whitespace-nowrap ${Math.abs(r.diferenca) <= 5 ? "text-primary" : "text-destructive"}`}>{r.diferenca >= 0 ? "+" : ""}{formatCurrency(r.diferenca)}</td>
                          <td className="py-2 px-2 text-muted-foreground">{r.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-xs text-muted-foreground text-center py-8">Nenhum caixa no período</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── RANKING ─────────────────────────────────────────────────────── */}
        <TabsContent value="ranking" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Período do Ranking</Label>
                <Select value={rankPeriod} onValueChange={setRankPeriod}>
                  <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Esta Semana</SelectItem>
                    <SelectItem value="month">Este Mês</SelectItem>
                    <SelectItem value="quarter">Trimestre</SelectItem>
                    <SelectItem value="year">Este Ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Loja</Label>
                <Select value={storeId} onValueChange={setStoreId}>
                  <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={() => exportCSV(ranking.map((r, i) => ({ posicao: i + 1, nome: r.nome, total_vendas: formatCurrency(r.totalVendas), qtd_vendas: r.qtdVendas, lucro: formatCurrency(r.lucro), os_entregues: r.osEntregues, comissoes: formatCurrency(r.comissoes) })), "ranking.csv")}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>

          {/* Pódio top 3 */}
          {ranking.length >= 3 && (
            <div className="flex items-end justify-center gap-4 py-4">
              {[1, 0, 2].map(idx => {
                const v = ranking[idx];
                const heights = [16, 24, 12];
                const sizes = ["h-14 w-14", "h-20 w-20", "h-12 w-12"];
                const colors = ["border-slate-400 bg-slate-500/20", "border-yellow-400 bg-yellow-500/20", "border-amber-600 bg-amber-700/20"];
                const textColors = ["text-slate-400", "text-yellow-400", "text-amber-600"];
                const pos = idx === 0 ? 2 : idx === 1 ? 1 : 3;
                return (
                  <div key={idx} className="flex flex-col items-center gap-1.5">
                    <div className={`rounded-full border-2 flex items-center justify-center ${sizes[idx]} ${colors[idx]}`}>
                      <Users className={`h-6 w-6 ${textColors[idx]}`} />
                    </div>
                    <RankBadge pos={pos} />
                    <p className="text-xs font-bold text-center max-w-20 truncate">{v?.nome}</p>
                    <p className={`text-xs font-semibold ${textColors[idx]}`}>{formatCurrency(v?.totalVendas ?? 0)}</p>
                    <div className={`w-24 rounded-t-lg flex items-center justify-center ${colors[idx]}`} style={{ height: `${heights[idx] * 4}px` }}>
                      <span className={`text-2xl font-display font-bold ${textColors[idx]}`}>{pos}º</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                Ranking {rankPeriod === "week" ? "Semanal" : rankPeriod === "month" ? "Mensal" : "do Período"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ranking.length > 0 ? (
                <div className="space-y-2">
                  {ranking.map((v, i) => (
                    <div key={v.uid} className={`flex items-center gap-3 rounded-lg p-3 border ${i === 0 ? "border-yellow-500/30 bg-yellow-500/5" : i === 1 ? "border-slate-400/30 bg-slate-400/5" : i === 2 ? "border-amber-600/30 bg-amber-600/5" : "border-border/50 bg-muted/30"}`}>
                      <div className="shrink-0 w-7 flex justify-center"><RankBadge pos={i + 1} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{v.nome}</p>
                        <div className="flex flex-wrap gap-3 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{v.qtdVendas} venda{v.qtdVendas !== 1 ? "s" : ""}</span>
                          <span className="text-[10px] text-muted-foreground">{v.osEntregues} OS</span>
                          <span className="text-[10px] text-muted-foreground">lucro: {formatCurrency(v.lucro)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-display font-bold text-base text-primary">{formatCurrency(v.totalVendas)}</p>
                        {v.comissoes > 0 && <p className="text-[10px] text-yellow-500">comissão: {formatCurrency(v.comissoes)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground text-center py-8">Sem vendas no período</p>}
            </CardContent>
          </Card>

          {ranking.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="font-display text-sm">Comparativo de Vendas</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={ranking.map(v => ({ nome: v.nome.split(" ")[0], vendas: v.totalVendas, lucro: v.lucro }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="vendas" fill={COLORS[0]} radius={[4,4,0,0]} name="Vendas" />
                    <Bar dataKey="lucro" fill={COLORS[1]} radius={[4,4,0,0]} name="Lucro" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── COMISSÕES ───────────────────────────────────────────────────── */}
        <TabsContent value="comissoes" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Período</Label>
                <Select value={rankPeriod} onValueChange={setRankPeriod}>
                  <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Esta Semana</SelectItem>
                    <SelectItem value="month">Este Mês</SelectItem>
                    <SelectItem value="quarter">Trimestre</SelectItem>
                    <SelectItem value="year">Este Ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Loja</Label>
                <Select value={storeId} onValueChange={setStoreId}>
                  <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={() => exportCSV(comissoes.map((c, i) => ({ posicao: i + 1, vendedor: c.nome, vendas: c.qtdVendas, total_vendido: formatCurrency(c.totalVendas), lucro: formatCurrency(c.lucro), comissao: formatCurrency(c.comissoes) })), "comissoes.csv")}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-border/50"><CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total a Pagar</p>
              <p className="font-display text-xl font-bold mt-1 text-primary">{formatCurrency(comissoes.reduce((s, c) => s + c.comissoes, 0))}</p>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Vendedores c/ Comissão</p>
              <p className="font-display text-xl font-bold mt-1">{comissoes.length}</p>
            </CardContent></Card>
          </div>
          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="font-display text-sm flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500" /> Comissões por Vendedor</CardTitle></CardHeader>
            <CardContent>
              {comissoes.length > 0 ? (
                <div className="space-y-3">
                  {comissoes.map((v, i) => (
                    <div key={v.uid} className="rounded-lg border border-border/50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><RankBadge pos={i + 1} /><p className="font-semibold">{v.nome}</p></div>
                        <Badge className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30 font-bold">{formatCurrency(v.comissoes)}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="rounded bg-muted/50 p-2 text-center"><p className="text-muted-foreground">Vendas</p><p className="font-bold">{v.qtdVendas}</p></div>
                        <div className="rounded bg-muted/50 p-2 text-center"><p className="text-muted-foreground">Total Vendido</p><p className="font-bold text-primary">{formatCurrency(v.totalVendas)}</p></div>
                        <div className="rounded bg-muted/50 p-2 text-center"><p className="text-muted-foreground">Lucro Gerado</p><p className="font-bold text-primary">{formatCurrency(v.lucro)}</p></div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Comissão / Total vendido</span>
                          <span>{v.totalVendas > 0 ? formatPct((v.comissoes / v.totalVendas) * 100) : "0%"}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-yellow-500 transition-all" style={{ width: `${Math.min(100, v.totalVendas > 0 ? (v.comissoes / v.totalVendas) * 100 * 5 : 0)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground text-center py-8">Nenhuma comissão no período</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Relatorios;
