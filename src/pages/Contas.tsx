import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Landmark, Clock, Building, User, Briefcase, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  const [stores, setStores] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [accountsRes, storesRes, transactionsRes] = await Promise.all([
      supabase.from("store_bank_accounts").select("*"),
      supabase.from("stores").select("id, name"),
      supabase.from("transactions").select(
        "amount, net_amount, type, source_account_id, destination_account_id, expected_settlement_date"
      ),
    ]);

    const accounts = accountsRes.data || [];
    const storesData = storesRes.data || [];
    const transactions = transactionsRes.data || [];

    setStores(new Map<string, string>(storesData.map((s) => [s.id, s.name])));

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const computed: AccountBalance[] = accounts.map((acc) => {
      let overall = 0, available = 0, future = 0;
      transactions.forEach((tx) => {
        const isDest = tx.destination_account_id === acc.id;
        const isSrc  = tx.source_account_id === acc.id;
        if (!isDest && !isSrc) return;
        const value = Number(tx.net_amount ?? tx.amount);
        const effect = isDest ? value : -value;
        overall += effect;
        const settled = tx.expected_settlement_date
          ? new Date(tx.expected_settlement_date)
          : new Date(0);
        if (settled <= today) available += effect;
        else future += effect;
      });
      return {
        account_id: acc.id,
        store_id: acc.store_id,
        bank_name: acc.bank_name,
        account_type: acc.account_type,
        holder_name: acc.holder_name,
        owner_type: (acc as any).owner_type ?? "PJ",
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

  const AccountCard = ({ acc }: { acc: AccountBalance }) => (
    <Card className="border-primary/10 bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className={`h-1.5 w-full bg-gradient-to-r ${acc.owner_type === "PF" ? "from-violet-500 to-pink-500" : "from-primary to-accent"}`} />
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              {acc.bank_name}
            </CardTitle>
            <CardDescription className="text-xs mt-1 flex items-center gap-1">
              {acc.owner_type === "PF" ? (
                <><User className="h-3 w-3" /> Pessoal · {acc.holder_name || "Conta PF"}</>
              ) : (
                <><Building className="h-3 w-3" /> {stores.get(acc.store_id) || "Empresa"}</>
              )}
            </CardDescription>
          </div>
          <Badge className="text-[10px] capitalize bg-muted/50 border-border shrink-0">
            {acc.account_type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`rounded-lg p-3 border ${acc.owner_type === "PF" ? "bg-violet-500/5 border-violet-500/10" : "bg-primary/5 border-primary/10"}`}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Saldo Disponível
          </p>
          <p className={`text-2xl font-bold font-display ${acc.available_balance >= 0 ? (acc.owner_type === "PF" ? "text-violet-500" : "text-primary") : "text-destructive"}`}>
            {fmt(acc.available_balance)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-muted/30 p-2.5 border border-border/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Clock className="h-3 w-3 text-accent" />
              <span className="font-medium">A Receber</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{fmt(acc.future_balance)}</p>
          </div>
          <div className="rounded-md bg-muted/30 p-2.5 border border-border/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <ArrowUpRight className="h-3 w-3 text-blue-500" />
              <span className="font-medium">Total Geral</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{fmt(acc.overall_balance)}</p>
          </div>
        </div>
        {acc.holder_name && acc.owner_type !== "PF" && (
          <p className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border/50">
            Titular: {acc.holder_name}
          </p>
        )}
      </CardContent>
    </Card>
  );

  const EmptyState = ({ isPF = false }) => (
    <Card className="border-dashed bg-transparent border-primary/20">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        {isPF ? <User className="h-10 w-10 text-muted-foreground/30 mb-3" /> : <Briefcase className="h-10 w-10 text-muted-foreground/30 mb-3" />}
        <h3 className="font-semibold text-foreground">
          {isPF ? "Nenhuma conta pessoal" : "Nenhuma conta empresarial"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-1">
          {isPF
            ? 'Em Lojas, cadastre uma conta e defina "Tipo de Proprietário" como Pessoal (PF).'
            : 'Vá em Lojas para cadastrar contas bancárias PJ e configurar as taxas das maquininhas.'}
        </p>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Contas Bancárias</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Saldos disponíveis, a receber e previsões por conta</p>
      </div>

      <Tabs defaultValue="pj">
        <TabsList className="mb-4">
          <TabsTrigger value="pj" className="flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" /> Empresarial (PJ) {pj.length > 0 && <span className="ml-1 text-[10px] bg-primary/15 text-primary rounded-full px-1.5">{pj.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="pf" className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Pessoal (PF) {pf.length > 0 && <span className="ml-1 text-[10px] bg-violet-500/15 text-violet-500 rounded-full px-1.5">{pf.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pj">
          {pj.length === 0 ? (
            <EmptyState isPF={false} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pj.map((acc) => <AccountCard key={acc.account_id} acc={acc} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pf">
          {pf.length === 0 ? (
            <EmptyState isPF={true} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pf.map((acc) => <AccountCard key={acc.account_id} acc={acc} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
