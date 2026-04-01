import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package, TrendingUp, TrendingDown, Wrench,
  ArrowUpRight, ArrowDownRight, ShoppingBag, AlertTriangle, Zap, Store,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

const COLORS = ["hsl(152, 60%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 62%, 50%)", "hsl(220, 25%, 50%)", "hsl(280, 50%, 50%)"];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const Dashboard = () => {
  const { user, userRole, userPermissions, activeStoreId: ctxStoreId, userStoreIds } = useAuth();

  const isAdmin = userRole === "admin";
  const can = (key: string) => isAdmin || (userPermissions?.[key] === true);

  // Loja ativa — lê da context/localstorage
  const [activeStoreId, setActiveStoreId] = useState<string>(
    () => ctxStoreId || localStorage.getItem("cellmanager-active-store-id") || "all"
  );
  const [activeStoreName, setActiveStoreName] = useState<string>(
    () => localStorage.getItem("cellmanager-active-store-name") || "Todas as lojas"
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setActiveStoreId(detail.id);
      setActiveStoreName(detail.name);
    };
    window.addEventListener("store-changed", handler);
    return () => window.removeEventListener("store-changed", handler);
  }, []);

  // Re-fetch quando os contextos essenciais carregam ou a loja ativa muda
  useEffect(() => { 
    if (userPermissions !== null && userStoreIds !== undefined) {
      fetchData(); 
    }
  }, [activeStoreId, userPermissions, userStoreIds, userRole]);

  const [stats, setStats] = useState({
    totalStock: 0, totalInvested: 0, totalInvestedAcc: 0,
    totalSalesRevenue: 0, totalProfit: 0,
    expensesPJ: 0, expensesPF: 0, storeCount: 0, openOS: 0, salesCount: 0,
    totalAccessories: 0,
  });
  const [storeData, setStoreData] = useState<{ name: string; aparelhos: number; acessorios: number; investido: number }[]>([]);
  const [dailySales, setDailySales] = useState<{ date: string; total: number }[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [lowStockStores, setLowStockStores] = useState<{ name: string; count: number }[]>([]);
  const [lowStockAcc, setLowStockAcc] = useState<{ name: string; qty: number; min: number }[]>([]);

  const fetchData = async () => {
    // Só prossegue quando AuthContext estiver 100% carregado
    if (!userPermissions) return;

    const effectiveStoreId = !isAdmin && (!activeStoreId || activeStoreId === "all") 
      ? (userStoreIds.length > 0 ? userStoreIds[0] : null) 
      : activeStoreId;

    // isFiltered garante que force o filtro caso a loja efetiva seja definida
    const isFiltered = effectiveStoreId && effectiveStoreId !== "all";

    // Mantenha array de promessas
    const fetches = [
      can("estoque") 
        ? (!isFiltered ? supabase.from("products").select("*") : supabase.from("products").select("*").eq("store_id", effectiveStoreId))
        : Promise.resolve({ data: [] }),
      (can("transacoes") || can("caixa"))
        ? (!isFiltered ? supabase.from("transactions").select("*") : supabase.from("transactions").select("*").eq("store_id", effectiveStoreId))
        : Promise.resolve({ data: [] }),
      supabase.from("stores").select("*"),
      can("vendas")
        ? (!isFiltered ? supabase.from("sales").select("*") : supabase.from("sales").select("*").eq("store_id", effectiveStoreId))
        : Promise.resolve({ data: [] }),
      can("os")
        ? (!isFiltered ? supabase.from("service_orders").select("id, status, store_id") : supabase.from("service_orders").select("id, status, store_id").eq("store_id", effectiveStoreId))
        : Promise.resolve({ data: [] }),
      can("estoque")
        ? (!isFiltered ? supabase.from("accessories" as any).select("*") : supabase.from("accessories" as any).select("*").eq("store_id", effectiveStoreId))
        : Promise.resolve({ data: [] }),
    ];

    const [productsRes, transactionsRes, storesRes, salesRes, osRes, accRes] = await Promise.all(fetches);

    const products = productsRes.data ?? [];
    const transactions = transactionsRes.data ?? [];
    const stores = storesRes.data ?? [];
    const sales = salesRes.data ?? [];
    const serviceOrders = osRes.data ?? [];
    const accessories = (accRes.data ?? []) as any[];

    const inStock = products.filter((p: any) => p.status === "in_stock");
    const totalInvested = inStock.reduce((sum: number, p: any) => sum + Number(p.cost_price), 0);
    const totalInvestedAcc = accessories.reduce((sum: number, a: any) => sum + Number(a.cost_price) * a.quantity, 0);

    const totalSalesRevenue = sales.reduce((sum: number, s: any) => sum + Number(s.sale_price), 0);
    const totalProfit = sales.reduce((sum: number, s: any) => {
      const product = products.find((p: any) => p.id === s.product_id);
      return sum + (Number(s.sale_price) - Number(product?.cost_price || 0));
    }, 0);

    const expensesPJ = transactions.filter((t: any) => t.type === "expense_pj").reduce((sum: number, t: any) => sum + Number(t.amount), 0);
    const expensesPF = transactions.filter((t: any) => t.type === "expense_pf" || t.type === "pro_labore").reduce((sum: number, t: any) => sum + Number(t.amount), 0);
    const openOS = serviceOrders.filter((o: any) => !["delivered", "cancelled"].includes(o.status)).length;

    setStats({
      totalStock: inStock.length, totalInvested, totalInvestedAcc,
      totalSalesRevenue, totalProfit, expensesPJ, expensesPF,
      storeCount: stores.filter((s: any) => s.status === "active").length,
      openOS, salesCount: sales.length,
      totalAccessories: accessories.reduce((sum: number, a: any) => sum + a.quantity, 0),
    });

    if (isAdmin) {
      const storeMap = new Map(stores.map((s: any) => [s.id, s.name]));
      const allProductsRes = await supabase.from("products").select("*");
      const allAccRes = await supabase.from("accessories" as any).select("*");
      const allProducts = (allProductsRes.data ?? []).filter((p: any) => p.status === "in_stock");
      const allAcc = (allAccRes.data ?? []) as any[];
      const storeProducts: Record<string, { aparelhos: number; acessorios: number; investido: number }> = {};
      allProducts.forEach((p: any) => {
        const name = storeMap.get(p.store_id) || "Sem loja";
        if (!storeProducts[name]) storeProducts[name] = { aparelhos: 0, acessorios: 0, investido: 0 };
        storeProducts[name].aparelhos++;
        storeProducts[name].investido += Number(p.cost_price);
      });
      allAcc.forEach((a: any) => {
        const name = storeMap.get(a.store_id) || "Sem loja";
        if (!storeProducts[name]) storeProducts[name] = { aparelhos: 0, acessorios: 0, investido: 0 };
        storeProducts[name].acessorios += a.quantity;
        storeProducts[name].investido += Number(a.cost_price) * a.quantity;
      });
      setStoreData(Object.entries(storeProducts).map(([name, data]) => ({ name, ...data })));
    }

    if (can("estoque")) {
      const catMap: Record<string, number> = {};
      accessories.forEach((a: any) => { catMap[a.category] = (catMap[a.category] || 0) + a.quantity; });
      setCategoryBreakdown(Object.entries(catMap).map(([name, value]) => ({ name, value })));

      const storeStockCounts: Record<string, number> = {};
      inStock.forEach((p: any) => { storeStockCounts[p.store_id] = (storeStockCounts[p.store_id] || 0) + 1; });
      setLowStockStores(stores
        .filter((s: any) => !isFiltered ? (storeStockCounts[s.id] || 0) <= 3 : s.id === effectiveStoreId && (storeStockCounts[s.id] || 0) <= 3)
        .map((s: any) => ({ name: s.name, count: storeStockCounts[s.id] || 0 })));
      setLowStockAcc(accessories.filter((a: any) => a.quantity <= a.min_quantity).map((a: any) => ({ name: a.name, qty: a.quantity, min: a.min_quantity })));
    }

    if (can("vendas")) {
      const last30 = new Date();
      last30.setDate(last30.getDate() - 30);
      const dailyMap: Record<string, number> = {};
      sales.filter((s: any) => new Date(s.created_at) >= last30).forEach((s: any) => {
        const day = new Date(s.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        dailyMap[day] = (dailyMap[day] || 0) + Number(s.sale_price);
      });
      setDailySales(Object.entries(dailyMap).map(([date, total]) => ({ date, total })));

      const totalCash = sales.reduce((s: number, sale: any) => s + Number(sale.payment_cash), 0);
      const totalCard = sales.reduce((s: number, sale: any) => s + Number(sale.payment_card), 0);
      const totalPix = sales.reduce((s: number, sale: any) => s + Number(sale.payment_pix), 0);
      const totalTradeIn = sales.filter((s: any) => s.has_trade_in).reduce((s: number, sale: any) => s + Number(sale.trade_in_value || 0), 0);
      setPaymentBreakdown([
        { name: "Dinheiro", value: totalCash },
        { name: "Cartão", value: totalCard },
        { name: "Pix", value: totalPix },
        { name: "Trade-in", value: totalTradeIn },
      ].filter(p => p.value > 0));
    }
  };

  const totalInvestedAll = stats.totalInvested + stats.totalInvestedAcc;

  // Render cards conditionally
  const kpiCards = [
    can("estoque") && { label: "Aparelhos", value: String(stats.totalStock), sub: "em estoque", icon: Package, color: "text-primary" },
    can("estoque") && { label: "Acessórios", value: String(stats.totalAccessories), sub: "unidades", icon: Zap, color: "text-accent" },
    can("vendas") && { label: "Vendas", value: formatCurrency(stats.totalSalesRevenue), sub: `${stats.salesCount} vendas`, icon: ShoppingBag, color: "text-primary" },
    can("vendas") && { label: "Lucro", value: formatCurrency(stats.totalProfit), sub: "nas vendas", icon: stats.totalProfit >= 0 ? TrendingUp : TrendingDown, color: stats.totalProfit >= 0 ? "text-primary" : "text-destructive" },
    can("os") && { label: "OS Abertas", value: String(stats.openOS), sub: "em andamento", icon: Wrench, color: "text-accent" },
  ].filter(Boolean) as { label: string; value: string; sub: string; icon: any; color: string }[];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {activeStoreId !== "all" || (!isAdmin && userStoreIds.length > 0)
              ? <>Dados limitados à filial</>
              : "Visão geral de todas as lojas"}
          </p>
        </div>
        {(activeStoreId !== "all" || (!isAdmin && userStoreIds.length > 0)) && (
          <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5">
            <Store className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">{!isAdmin ? "Sua Loja" : activeStoreName}</span>
          </div>
        )}
      </div>

      {can("estoque") && (lowStockStores.length > 0 || lowStockAcc.length > 0) && (
        <div className="space-y-2">
          {lowStockStores.map(s => (
            <div key={s.name} className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs"><span className="font-semibold">{s.name}</span>: estoque baixo — apenas <span className="font-bold text-destructive">{s.count}</span> aparelhos</p>
            </div>
          ))}
          {lowStockAcc.map(a => (
            <div key={a.name} className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
              <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
              <p className="text-xs"><span className="font-semibold">{a.name}</span>: apenas <span className="font-bold text-yellow-500">{a.qty}</span> unidades (mín: {a.min})</p>
            </div>
          ))}
        </div>
      )}

      {kpiCards.length > 0 && (
        <div className={`grid grid-cols-2 gap-3 ${kpiCards.length <= 3 ? "lg:grid-cols-3" : "lg:grid-cols-5"}`}>
          {kpiCards.map((card) => (
            <Card key={card.label} className="border-border/50 shadow-lg shadow-black/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{card.label}</p>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <p className={`font-display text-xl font-bold ${card.color}`}>{card.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{card.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {can("estoque") && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border-border/50 shadow-lg shadow-black/10">
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Investido em Aparelhos</p>
              <p className="font-display text-lg font-bold text-primary mt-1">{formatCurrency(stats.totalInvested)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-lg shadow-black/10">
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Investido em Acessórios</p>
              <p className="font-display text-lg font-bold text-accent mt-1">{formatCurrency(stats.totalInvestedAcc)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-lg shadow-black/10">
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total Investido</p>
              <p className="font-display text-lg font-bold mt-1">{formatCurrency(totalInvestedAll)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {can("vendas") && (
          <Card className="border-border/50 shadow-lg shadow-black/10">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-sm">Vendas (últimos 30 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              {dailySales.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailySales}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Line type="monotone" dataKey="total" stroke="hsl(152, 60%, 45%)" strokeWidth={2} dot={false} name="Vendas" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground text-xs">Registre vendas para ver o gráfico</div>
              )}
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card className="border-border/50 shadow-lg shadow-black/10">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-sm">Comparativo Entre Lojas</CardTitle>
            </CardHeader>
            <CardContent>
              {storeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={storeData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="aparelhos" fill="hsl(152, 60%, 45%)" radius={[4, 4, 0, 0]} name="Aparelhos" />
                    <Bar dataKey="acessorios" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} name="Acessórios" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground text-xs">Cadastre produtos para ver o gráfico</div>
              )}
            </CardContent>
          </Card>
        )}

        {can("vendas") && (
          <Card className="border-border/50 shadow-lg shadow-black/10">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-sm">Formas de Pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentBreakdown.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={160}>
                    <PieChart>
                      <Pie data={paymentBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">
                        {paymentBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {paymentBreakdown.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <div>
                          <p className="text-xs font-medium">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">{formatCurrency(p.value)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[160px] text-muted-foreground text-xs">Sem vendas registradas</div>
              )}
            </CardContent>
          </Card>
        )}

        {can("estoque") && (
          <Card className="border-border/50 shadow-lg shadow-black/10">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-sm">Acessórios por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={categoryBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={70} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(38, 92%, 50%)" radius={[0, 4, 4, 0]} name="Qtd" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[160px] text-muted-foreground text-xs">Cadastre acessórios para ver o gráfico</div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {(can("transacoes") || can("caixa")) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Gastos PJ", value: stats.expensesPJ, icon: ArrowUpRight, color: "text-destructive" },
            { label: "Gastos PF + Pro-labore", value: stats.expensesPF, icon: ArrowDownRight, color: "text-destructive" },
          ].map(card => (
            <Card key={card.label} className="border-border/50 shadow-lg shadow-black/10">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <card.icon className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{card.label}</p>
                  <p className={`font-display text-lg font-bold ${card.color}`}>{formatCurrency(card.value)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {kpiCards.length === 0 && !can("transacoes") && !can("caixa") && (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Store className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium text-sm">Bem-vindo!</p>
            <p className="text-xs mt-1">Nenhum dado financeiro ou comercial disponível com suas permissões atuais.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
