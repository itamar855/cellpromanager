import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FileText, TrendingUp, TrendingDown } from "lucide-react";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const Relatorios = () => {
  const [period, setPeriod] = useState("month");
  const [dre, setDre] = useState({
    receitaAparelhos: 0, receitaAcessorios: 0, receitaOS: 0, totalReceita: 0,
    cmvAparelhos: 0, cmvAcessorios: 0, totalCmv: 0,
    lucroBruto: 0, despesasPJ: 0, despesasPF: 0, proLabore: 0,
    totalDespesas: 0, lucroLiquido: 0,
    qtdVendasAparelhos: 0, qtdVendasAcessorios: 0,
  });
  const [monthlyData, setMonthlyData] = useState<{ name: string; receita: number; despesa: number; lucro: number }[]>([]);
  const [storeBreakdown, setStoreBreakdown] = useState<{ name: string; vendas: number; lucro: number }[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const now = new Date();
      let startDate: Date;
      if (period === "month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (period === "quarter") {
        const q = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), q, 1);
      } else {
        startDate = new Date(now.getFullYear(), 0, 1);
      }
      const start = startDate.toISOString();

      const [salesRes, productsRes, txRes, storesRes, osRes, accTxRes] = await Promise.all([
        supabase.from("sales").select("*").gte("created_at", start),
        supabase.from("products").select("*"),
        supabase.from("transactions").select("*").gte("created_at", start),
        supabase.from("stores").select("*"),
        supabase.from("service_orders").select("*").eq("status", "delivered").gte("created_at", start),
        supabase.from("transactions").select("*").eq("type", "sale").gte("created_at", start),
      ]);

      const sales = salesRes.data ?? [];
      const products = productsRes.data ?? [];
      const tx = txRes.data ?? [];
      const stores = storesRes.data ?? [];
      const os = osRes.data ?? [];
      const productMap = new Map(products.map(p => [p.id, p]));
      const storeMap = new Map(stores.map(s => [s.id, s.name]));

      // Receitas
      const receitaAparelhos = sales.reduce((s, sale) => s + Number(sale.sale_price), 0);
      const receitaOS = os.reduce((s, o) => s + Number(o.final_price || o.estimated_price || 0), 0);

      // Transações de venda de acessórios (type=sale com product_id nulo = acessório)
      const accSales = tx.filter(t => t.type === "income" && t.category === "acessorio");
      const receitaAcessorios = accSales.reduce((s, t) => s + Number(t.amount), 0);

      // CMV aparelhos
      const cmvAparelhos = sales.reduce((s, sale) => {
        const p = productMap.get(sale.product_id);
        return s + Number(p?.cost_price || 0);
      }, 0);

      // CMV acessórios (transações de despesa categoria acessório)
      const accCosts = tx.filter(t => t.type === "expense_pj" && t.category === "acessorio");
      const cmvAcessorios = accCosts.reduce((s, t) => s + Number(t.amount), 0);

      const totalReceita = receitaAparelhos + receitaAcessorios + receitaOS;
      const totalCmv = cmvAparelhos + cmvAcessorios;

      const despesasPJ = tx.filter(t => t.type === "expense_pj" && t.category !== "acessorio").reduce((s, t) => s + Number(t.amount), 0);
      const despesasPF = tx.filter(t => t.type === "expense_pf").reduce((s, t) => s + Number(t.amount), 0);
      const proLabore = tx.filter(t => t.type === "pro_labore").reduce((s, t) => s + Number(t.amount), 0);

      const lucroBruto = totalReceita - totalCmv;
      const totalDespesas = despesasPJ + despesasPF + proLabore;
      const lucroLiquido = lucroBruto - totalDespesas;

      setDre({
        receitaAparelhos, receitaAcessorios, receitaOS, totalReceita,
        cmvAparelhos, cmvAcessorios, totalCmv,
        lucroBruto, despesasPJ, despesasPF, proLabore,
        totalDespesas, lucroLiquido,
        qtdVendasAparelhos: sales.length,
        qtdVendasAcessorios: accSales.length,
      });

      // Monthly breakdown
      const monthlyMap: Record<string, { receita: number; despesa: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = months[d.getMonth()].substring(0, 3);
        monthlyMap[key] = { receita: 0, despesa: 0 };
      }
      sales.forEach(s => {
        const key = months[new Date(s.created_at).getMonth()].substring(0, 3);
        if (monthlyMap[key]) monthlyMap[key].receita += Number(s.sale_price);
      });
      tx.forEach(t => {
        if (t.type !== "sale" && t.type !== "income") {
          const key = months[new Date(t.created_at).getMonth()].substring(0, 3);
          if (monthlyMap[key]) monthlyMap[key].despesa += Number(t.amount);
        }
      });
      setMonthlyData(Object.entries(monthlyMap).map(([name, d]) => ({
        name, receita: d.receita, despesa: d.despesa, lucro: d.receita - d.despesa,
      })));

      // Store breakdown
      const storeStats: Record<string, { vendas: number; lucro: number }> = {};
      sales.forEach(s => {
        const name = storeMap.get(s.store_id) || "Sem loja";
        if (!storeStats[name]) storeStats[name] = { vendas: 0, lucro: 0 };
        storeStats[name].vendas += Number(s.sale_price);
        const p = productMap.get(s.product_id);
        storeStats[name].lucro += Number(s.sale_price) - Number(p?.cost_price || 0);
      });
      setStoreBreakdown(Object.entries(storeStats).map(([name, d]) => ({ name, ...d })));
    };
    fetch();
  }, [period]);

  const dreLines = [
    { label: "Receita de Aparelhos", value: dre.receitaAparelhos, sub: `${dre.qtdVendasAparelhos} vendas`, type: "income" },
    { label: "Receita de Acessórios", value: dre.receitaAcessorios, sub: `${dre.qtdVendasAcessorios} vendas`, type: "income" },
    { label: "Receita de Serviços (OS)", value: dre.receitaOS, type: "income" },
    { label: "= Receita Total", value: dre.totalReceita, type: "total", bold: true },
    { label: "(-) CMV Aparelhos", value: -dre.cmvAparelhos, type: "expense" },
    { label: "(-) CMV Acessórios", value: -dre.cmvAcessorios, type: "expense" },
    { label: "= Lucro Bruto", value: dre.lucroBruto, type: "total", bold: true },
    { label: "(-) Despesas PJ (Operacionais)", value: -dre.despesasPJ, type: "expense" },
    { label: "(-) Despesas PF (Pessoais)", value: -dre.despesasPF, type: "expense" },
    { label: "(-) Pro-labore", value: -dre.proLabore, type: "expense" },
    { label: "= Total de Despesas", value: -dre.totalDespesas, type: "total", bold: true },
    { label: "= LUCRO LÍQUIDO", value: dre.lucroLiquido, type: "result", bold: true },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Relatórios Financeiros</h1>
          <p className="text-muted-foreground text-sm mt-0.5">DRE simplificado e análises</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44 h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Este Mês</SelectItem>
            <SelectItem value="quarter">Este Trimestre</SelectItem>
            <SelectItem value="year">Este Ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* DRE */}
      <Card className="border-border/50 shadow-lg shadow-black/10">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="font-display text-sm">DRE Simplificado</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {dreLines.map((line, i) => (
              <div
                key={i}
                className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm ${
                  line.bold ? "bg-muted/50 font-semibold" : ""
                } ${line.type === "result" ? "bg-primary/10 text-primary font-bold text-base" : ""}`}
              >
                <div>
                  <span className={line.bold ? "" : "text-muted-foreground"}>{line.label}</span>
                  {(line as any).sub && <span className="text-[10px] text-muted-foreground ml-2">({(line as any).sub})</span>}
                </div>
                <span className={
                  line.type === "result"
                    ? line.value >= 0 ? "text-primary" : "text-destructive"
                    : line.type === "expense" ? "text-destructive" : ""
                }>
                  {line.type === "expense" ? "- " : ""}{formatCurrency(Math.abs(line.value))}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly chart */}
        <Card className="border-border/50 shadow-lg shadow-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm">Receita vs Despesas (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.some(d => d.receita > 0 || d.despesa > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="receita" fill="hsl(152, 60%, 45%)" radius={[4, 4, 0, 0]} name="Receita" />
                  <Bar dataKey="despesa" fill="hsl(0, 62%, 50%)" radius={[4, 4, 0, 0]} name="Despesas" />
                  <Bar dataKey="lucro" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} name="Lucro" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-xs">Sem dados para o período</div>
            )}
          </CardContent>
        </Card>

        {/* Store breakdown */}
        <Card className="border-border/50 shadow-lg shadow-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm">Resultado por Loja</CardTitle>
          </CardHeader>
          <CardContent>
            {storeBreakdown.length > 0 ? (
              <div className="space-y-3">
                {storeBreakdown.map((s) => (
                  <div key={s.name} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground">Vendas: {formatCurrency(s.vendas)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${s.lucro >= 0 ? "text-primary" : "text-destructive"}`}>
                        {formatCurrency(s.lucro)}
                      </p>
                      <div className="flex items-center gap-1 justify-end">
                        {s.lucro >= 0 ? <TrendingUp className="h-3 w-3 text-primary" /> : <TrendingDown className="h-3 w-3 text-destructive" />}
                        <span className="text-[10px] text-muted-foreground">lucro</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-xs">Sem dados para o período</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Margem Bruta", value: dre.totalReceita > 0 ? `${((dre.lucroBruto / dre.totalReceita) * 100).toFixed(1)}%` : "0%", color: "text-primary" },
          { label: "Margem Líquida", value: dre.totalReceita > 0 ? `${((dre.lucroLiquido / dre.totalReceita) * 100).toFixed(1)}%` : "0%", color: dre.lucroLiquido >= 0 ? "text-primary" : "text-destructive" },
          { label: "Ticket Médio", value: dre.qtdVendasAparelhos > 0 ? formatCurrency(dre.receitaAparelhos / dre.qtdVendasAparelhos) : formatCurrency(0), color: "" },
          { label: "Gastos PF/Total", value: dre.totalDespesas > 0 ? `${(((dre.despesasPF + dre.proLabore) / dre.totalDespesas) * 100).toFixed(1)}%` : "0%", color: "text-destructive" },
        ].map(k => (
          <Card key={k.label} className="border-border/50 shadow-lg shadow-black/10">
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{k.label}</p>
              <p className={`font-display text-xl font-bold mt-1 ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Relatorios;
