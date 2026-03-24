import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Landmark, Clock, Building, User, Briefcase, ArrowUpRight, TrendingDown, TrendingUp, PieChart, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type AccountBalance = {
  account_id: string;
  store_id: string;
  bank_name: string;
  account_type: string;
  holder_name: string | null;
  owner_type: string | null;
  overall_balance: number;
  available_balance: number;
  future_balance: number;
};

export default function Contas() {
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stores, setStores] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [accountsRes, storesRes, transactionsRes] = await Promise.all([
      supabase.from("store_bank_accounts").select("*"),
      supabase.from("stores").select("id, name"),
      supabase.from("transactions").select("*").order('created_at', { ascending: false }),
    ]);

    const accounts = accountsRes.data || [];
    const storesData = storesRes.data || [];
    const allTxs = transactionsRes.data || [];
    setTransactions(allTxs);

    setStores(new Map<string, string>(storesData.map((s) => [s.id, s.name])));

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const computed: AccountBalance[] = accounts.map((acc) => {
      let overall = 0, available = 0, future = 0;
      allTxs.forEach((tx) => {
        const isDest = tx.destination_account_id === acc.id;
        const isSrc  = tx.source_account_id === acc.id;
        if (!isDest && !isSrc) return;
        const value = Number(tx.net_amount ?? tx.amount);
        const effect = isDest ? value : -value;
        overall += effect;
        const settled = tx.expected_settlement_date ? new Date(tx.expected_settlement_date) : new Date(0);
        if (settled <= today) available += effect;
        else future += effect;
      });
      return {
        account_id: acc.id,
        store_id: acc.store_id,
        bank_name: acc.bank_name,
        account_type: acc.account_type,
        holder_name: acc.holder_name,
        owner_type: acc.owner_type ?? "PJ",
        overall_balance: overall,
        available_balance: available,
        future_balance: future,
      };
    });

    setBalances(computed);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const pj = balances.filter((a) => !a.owner_type || a.owner_type === "PJ");
  const pf = balances.filter((a) => a.owner_type === "PF");

  // Estatísticas PF do Mês Atual
  const now = new Date();
  const pfTransactions = transactions.filter(t => 
    (pf.some(a => a.account_id === t.source_account_id) || pf.some(a => a.account_id === t.destination_account_id)) &&
    new Date(t.created_at).getMonth() === now.getMonth() &&
    new Date(t.created_at).getFullYear() === now.getFullYear()
  );

  const pfIncome = pfTransactions.reduce((acc, t) => {
    const isDest = pf.some(a => a.account_id === t.destination_account_id);
    return isDest ? acc + Number(t.amount) : acc;
  }, 0);

  const pfExpense = pfTransactions.reduce((acc, t) => {
    const isSrc = pf.some(a => a.account_id === t.source_account_id);
    return isSrc ? acc + Number(t.amount) : acc;
  }, 0);

  // Agrupamento por Categoria para PF
  const pfCategories = pfTransactions
    .filter(t => pf.some(a => a.account_id === t.source_account_id)) // Apenas saídas
    .reduce((acc: any, t) => {
      const cat = t.category || "Outros";
      acc[cat] = (acc[cat] || 0) + Number(t.amount);
      return acc;
    }, {});

  const sortedPfCategories = Object.entries(pfCategories)
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, 5);

  const AccountCard = ({ acc }: { acc: AccountBalance }) => (
    <Card className="border-primary/10 bg-card overflow-hidden shadow-sm hover:border-primary transition-all">
      <div className={`h-1.5 w-full bg-gradient-to-r ${acc.owner_type === "PF" ? "from-violet-600 to-fuchsia-500" : "from-emerald-500 to-primary"}`} />
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Landmark className={`h-4 w-4 ${acc.owner_type === "PF" ? "text-violet-500" : "text-emerald-500"}`} />
              {acc.bank_name}
            </CardTitle>
            <CardDescription className="text-xs mt-1 flex items-center gap-1 font-medium">
              {acc.owner_type === "PF" ? <><User className="h-3 w-3" /> Pessoal</> : <><Building className="h-3 w-3" /> {stores.get(acc.store_id) || "Empresa"}</>}
            </CardDescription>
          </div>
          <Badge className="text-[10px] capitalize bg-muted/50 border-border shrink-0">{acc.account_type}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`rounded-xl p-4 border border-border/50 ${acc.owner_type === "PF" ? "bg-violet-500/5" : "bg-emerald-500/5"}`}>
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Saldo Disponível</p>
          <p className={`text-3xl font-black font-display tracking-tight ${acc.available_balance >= 0 ? (acc.owner_type === "PF" ? "text-violet-600" : "text-emerald-600") : "text-destructive"}`}>
            {fmt(acc.available_balance)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2 border rounded-lg bg-muted/20">
            <p className="text-[9px] text-muted-foreground font-bold uppercase">A Receber</p>
            <p className="text-sm font-bold">{fmt(acc.future_balance)}</p>
          </div>
          <div className="p-2 border rounded-lg bg-muted/20">
            <p className="text-[9px] text-muted-foreground font-bold uppercase">Total Geral</p>
            <p className="text-sm font-bold">{fmt(acc.overall_balance)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const MiniExtrato = ({ accountId }: { accountId: string }) => {
    const txs = transactions
      .filter(t => t.source_account_id === accountId || t.destination_account_id === accountId)
      .slice(0, 5);

    if (txs.length === 0) return null;

    return (
      <Card className="mt-4 border-dashed bg-muted/5">
        <CardHeader className="py-2 px-3 border-b border-dashed">
          <CardTitle className="text-[9px] font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-widest">
            <History className="h-3 w-3" /> Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {txs.map(t => (
            <div key={t.id} className="flex justify-between items-center p-2.5 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
              <div className="min-w-0">
                <p className="text-[10px] font-bold truncate">{t.description || t.category || "Transferência"}</p>
                <p className="text-[8px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <span className={`text-[11px] font-black ${t.destination_account_id === accountId ? "text-emerald-500" : "text-destructive"}`}>
                {t.destination_account_id === accountId ? "+" : "-"}{fmt(Number(t.amount))}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  const EmptyState = ({ isPF = false }) => (
    <Card className="border-dashed bg-transparent border-primary/20 py-12">
      <CardContent className="flex flex-col items-center justify-center text-center">
        {isPF ? <User className="h-10 w-10 text-muted-foreground/30 mb-3" /> : <Briefcase className="h-10 w-10 text-muted-foreground/30 mb-3" />}
        <h3 className="font-semibold">{isPF ? "Nenhuma conta pessoal" : "Nenhuma conta empresarial"}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">Adicione suas contas em "Lojas" para começar a rastrear seu dinheiro.</p>
      </CardContent>
    </Card>
  );

  if (loading) return <div className="flex items-center justify-center p-24"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-4xl font-black text-foreground tracking-tight">Fluxo Bancário</h1>
          <p className="text-muted-foreground text-sm font-medium">Controle granular PJ & PF</p>
        </div>
      </div>

      <Tabs defaultValue="pj" className="w-full">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="pj" className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-6">
            <Briefcase className="h-4 w-4 mr-2" /> Comercial (PJ)
          </TabsTrigger>
          <TabsTrigger value="pf" className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-6">
            <User className="h-4 w-4 mr-2" /> Pessoal (PF)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pj" className="mt-6 space-y-6">
          {/* Dashboard Resumo PJ (Opcional, pode adicionar depois) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pj.length === 0 ? <EmptyState isPF={false} /> : pj.map((acc) => (
              <div key={acc.account_id} className="space-y-0">
                <AccountCard acc={acc} />
                <MiniExtrato accountId={acc.account_id} />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pf" className="mt-6 space-y-6">
          {pf.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* 1. Resumo Mensal PF */}
              <div className="md:col-span-4 space-y-4">
                <Card className="bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white border-0 shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold uppercase opacity-80 flex items-center gap-2">
                      <TrendingUp className="h-3 w-3" /> Resumo do Mês (PF)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium opacity-90">Entradas</p>
                      <p className="text-2xl font-black">{fmt(pfIncome)}</p>
                    </div>
                    <div className="pt-2 border-t border-white/10">
                      <p className="text-sm font-medium opacity-90">Saídas</p>
                      <p className="text-2xl font-black">{fmt(pfExpense)}</p>
                    </div>
                    <div className={`pt-3 mt-2 rounded-lg bg-white/10 p-3 flex justify-between items-center`}>
                      <span className="text-xs font-bold font-display uppercase">Economia Real</span>
                      <span className="text-xl font-black">{fmt(pfIncome - pfExpense)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Breakdown de Categorias */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                      <PieChart className="h-3 w-3" /> Para onde foi o dinheiro?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {sortedPfCategories.length > 0 ? sortedPfCategories.map(([cat, val]: any) => {
                      const perc = (val / pfExpense) * 100;
                      return (
                        <div key={cat} className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span>{cat}</span>
                            <span className="text-muted-foreground">{fmt(val)} ({perc.toFixed(0)}%)</span>
                          </div>
                          <Progress value={perc} className="h-1.5 bg-muted" indicatorClassName="bg-violet-500" />
                        </div>
                      );
                    }) : <p className="text-[10px] text-muted-foreground text-center py-4">Nenhum gasto categorizado neste mês.</p>}
                  </CardContent>
                </Card>
              </div>

              {/* 3. Cards de Conta PF */}
              <div className="md:col-span-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {pf.map((acc) => (
                    <div key={acc.account_id}>
                      <AccountCard acc={acc} />
                      <MiniExtrato accountId={acc.account_id} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {pf.length === 0 && <EmptyState isPF={true} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
