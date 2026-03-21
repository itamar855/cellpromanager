import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign, Package, TrendingUp, TrendingDown, Store, Wrench,
  ArrowUpRight, ArrowDownRight, ShoppingBag,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

const COLORS = ["hsl(152, 60%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 62%, 50%)", "hsl(220, 25%, 50%)", "hsl(280, 50%, 50%)"];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalStock: 0, totalInvested: 0, totalSalesRevenue: 0, totalProfit: 0,
    expensesPJ: 0, expensesPF: 0, storeCount: 0, openOS: 0, salesCount: 0,
  });
  const [storeData, setStoreData] = useState<{ name: string; produtos: number; investido: number }[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [dailySales, setDailySales] = useState<{ date: string; total: number }[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [productsRes, transactionsRes, storesRes, salesRes, osRes] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("transactions").select("*"),
        supabase.from("stores").select("*"),
        supabase.from("sales").select("*"),
        supabase.from("service_orders").select("id, status"),
      ]);

      const products = productsRes.data ?? [];
      const transactions = transactionsRes.data ?? [];
      const stores = storesRes.data ?? [];
      const sales = salesRes.data ?? [];
      const serviceOrders = osRes.data ?? [];

      const inStock = products.filter((p) => p.status === "in_stock");
      const totalInvested = inStock.reduce((sum, p) => sum + Number(p.cost_price), 0);

      // Sales-based revenue and profit
      const totalSalesRevenue = sales.reduce((sum, s) => sum + Number(s.sale_price), 0);
      const totalProfit = sales.reduce((sum, s) => {
        const product = products.find((p) => p.id === s.product_id);
        return sum + (Number(s.sale_price) - Number(product?.cost_price || 0));
      }, 0);

      const expensesPJ = transactions.filter((t) => t.type === "expense_pj").reduce((sum, t) => sum + Number(t.amount), 0);
      const expensesPF = transactions.filter((t) => t.type === "expense_pf" || t.type === "pro_labore").reduce((sum, t) => sum + Number(t.amount), 0);

      const openOS = serviceOrders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length;

      setStats({
        totalStock: inStock.length, totalInvested, totalSalesRevenue, totalProfit,
        expensesPJ, expensesPF,
        storeCount: stores.filter((s) => s.status === "active").length,
        openOS, salesCount: sales.length,
      });

      // Store chart
      const storeMap = new Map(stores.map((s) => [s.id, s.name]));
      const storeProducts: Record<string, { produtos: number; investido: number }> = {};
      inStock.forEach((p) => {
        const name = storeMap.get(p.store_id) || "Sem loja";
        if (!storeProducts[name]) storeProducts[name] = { produtos: 0, investido: 0 };
        storeProducts[name].produtos++;
        storeProducts[name].investido += Number(p.cost_price);
      });
      setStoreData(Object.entries(storeProducts).map(([name, data]) => ({ name, ...data })));

      // Expense breakdown
      setExpenseBreakdown([
        { name: "PJ", value: expensesPJ },
        { name: "PF", value: expensesPF },
      ]);

      // Daily sales (last 30 days)
      const last30 = new Date();
      last30.setDate(last30.getDate() - 30);
      const dailyMap: Record<string, number> = {};
      sales.filter((s) => new Date(s.created_at) >= last30).forEach((s) => {
        const day = new Date(s.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        dailyMap[day] = (dailyMap[day] || 0) + Number(s.sale_price);
      });
      setDailySales(Object.entries(dailyMap).map(([date, total]) => ({ date, total })));

      // Payment breakdown
      const totalCash = sales.reduce((s, sale) => s + Number(sale.payment_cash), 0);
      const totalCard = sales.reduce((s, sale) => s + Number(sale.payment_card), 0);
      const totalPix = sales.reduce((s, sale) => s + Number(sale.payment_pix), 0);
      const totalTradeIn = sales.filter((s) => s.has_trade_in).reduce((s, sale) => s + Number(sale.trade_in_value || 0), 0);
      setPaymentBreakdown([
        { name: "Dinheiro", value: totalCash },
        { name: "Cartão", value: totalCard },
        { name: "PIX", value: totalPix },
        { name: "Troca", value: totalTradeIn },
      ].filter((p) => p.value > 0));
    };
    fetchData();
  }, []);

  const kpis = [
    { title: "Estoque", value: `${stats.totalStock}`, subtitle: "aparelhos", icon: Package, trend: "neutral" as const },
    { title: "Vendas", value: formatCurrency(stats.totalSalesRevenue), subtitle: `${stats.salesCount} vendas`, icon: ShoppingBag, trend: "up" as const },
    { title: "Lucro", value: formatCurrency(stats.totalProfit - stats.expensesPJ - stats.expensesPF), icon: TrendingUp, trend: stats.totalProfit > 0 ? "up" as const : "down" as const },
    { title: "OS Abertas", value: `${stats.openOS}`, icon: Wrench, trend: "neutral" as const },
    { title: "Investido", value: formatCurrency(stats.totalInvested), icon: DollarSign, trend: "neutral" as const },
    { title: "Gastos PF", value: formatCurrency(stats.expensesPF), icon: TrendingDown, trend: "down" as const },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Visão geral das suas lojas</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="border-border/50 shadow-lg shadow-black/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="rounded-lg bg-muted p-2">
                  <kpi.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                {kpi.trend === "up" && <ArrowUpRight className="h-3.5 w-3.5 text-primary" />}
                {kpi.trend === "down" && <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />}
              </div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{kpi.title}</p>
              <p className="font-display text-lg font-bold mt-0.5 truncate">{kpi.value}</p>
              {kpi.subtitle && <p className="text-[11px] text-muted-foreground">{kpi.subtitle}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily sales */}
        <Card className="border-border/50 shadow-lg shadow-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm">Vendas (últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {dailySales.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dailySales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 18%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(220, 10%, 55%)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(220, 10%, 55%)" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(220, 25%, 12%)", border: "1px solid hsl(220, 20%, 18%)", borderRadius: "8px", fontSize: 12 }}
                    formatter={(value: number) => [formatCurrency(value), "Vendas"]}
                  />
                  <Line type="monotone" dataKey="total" stroke="hsl(152, 60%, 45%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-xs">
                Registre vendas para ver o gráfico
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock by store */}
        <Card className="border-border/50 shadow-lg shadow-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm">Estoque por Loja</CardTitle>
          </CardHeader>
          <CardContent>
            {storeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={storeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 18%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(220, 10%, 55%)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(220, 10%, 55%)" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(220, 25%, 12%)", border: "1px solid hsl(220, 20%, 18%)", borderRadius: "8px", fontSize: 12 }}
                    formatter={(value: number, name: string) => [
                      name === "investido" ? formatCurrency(value) : value,
                      name === "investido" ? "Investido" : "Produtos",
                    ]}
                  />
                  <Bar dataKey="produtos" fill="hsl(152, 60%, 45%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-xs">
                Cadastre produtos para ver o gráfico
              </div>
            )}
          </CardContent>
        </Card>

        {/* PJ vs PF */}
        <Card className="border-border/50 shadow-lg shadow-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm">Gastos PJ vs PF</CardTitle>
          </CardHeader>
          <CardContent>
            {expenseBreakdown.some((e) => e.value > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value"
                    label={({ name, value }) => `${name}: ${formatCurrency(value)}`}>
                    {expenseBreakdown.map((_, index) => (<Cell key={index} fill={COLORS[index % COLORS.length]} />))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(220, 25%, 12%)", border: "1px solid hsl(220, 20%, 18%)", borderRadius: "8px", fontSize: 12 }} formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-xs">
                Registre transações para ver o gráfico
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment methods */}
        <Card className="border-border/50 shadow-lg shadow-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm">Formas de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={paymentBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value"
                    label={({ name, value }) => `${name}: ${formatCurrency(value)}`}>
                    {paymentBreakdown.map((_, index) => (<Cell key={index} fill={COLORS[index % COLORS.length]} />))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(220, 25%, 12%)", border: "1px solid hsl(220, 20%, 18%)", borderRadius: "8px", fontSize: 12 }} formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-xs">
                Registre vendas para ver o gráfico
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card className="border-border/50 shadow-lg shadow-black/10">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            <CardTitle className="font-display text-sm">Resumo Financeiro</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Lojas Ativas", value: stats.storeCount },
              { label: "Receita Total", value: formatCurrency(stats.totalSalesRevenue) },
              { label: "Gastos Totais", value: formatCurrency(stats.expensesPJ + stats.expensesPF) },
              { label: "Lucro Líquido", value: formatCurrency(stats.totalProfit - stats.expensesPJ - stats.expensesPF) },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-muted/50 p-3">
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                <p className="font-display text-base md:text-xl font-bold mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
