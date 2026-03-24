import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, ArrowUpDown, ArrowUpRight, ArrowDownRight, Tag } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const typeLabels: Record<string, string> = {
  sale: "Venda", expense_pj: "Gasto PJ", expense_pf: "Gasto PF", income: "Receita", pro_labore: "Pro-labore", transfer: "Transferência",
};

const typeColors: Record<string, string> = {
  sale: "bg-primary/15 text-primary", income: "bg-primary/15 text-primary",
  expense_pj: "bg-orange-500/15 text-orange-500", expense_pf: "bg-destructive/15 text-destructive",
  pro_labore: "bg-violet-500/15 text-violet-500", transfer: "bg-blue-500/15 text-blue-500",
};

const TRANSACTION_CATEGORIES = [
  "Alimentação", "Moradia (Aluguel/Luz)", "Transporte/Combustível", "Lazer/Viagens", 
  "Saúde", "Educação", "Vestuário", "Investimentos", "Pro-labore", 
  "Software/Ferramentas", "Marketing", "Estoque/Peças", "Manutenção", 
  "Impostos/Taxas", "Tarifas Bancárias", "Outros"
];

const Transacoes = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [stores, setStores] = useState<Tables<"stores">[]>([]);
  const [accounts, setAccounts] = useState<Tables<"store_bank_accounts">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ type: "sale", amount: "", description: "", category: "", store_id: "", source_account_id: "", destination_account_id: "" });

  const fetchData = async () => {
    const [txRes, storesRes, accountsRes] = await Promise.all([
      supabase.from("transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("stores").select("*"),
      supabase.from("store_bank_accounts").select("*"),
    ]);
    setTransactions(txRes.data ?? []);
    setStores(storesRes.data ?? []);
    setAccounts(accountsRes.data ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (form.type === "transfer" && (!form.source_account_id || !form.destination_account_id)) {
      toast.error("Para transferências, selecione a conta de origem e destino.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("transactions").insert({
      type: form.type, amount: parseFloat(form.amount),
      description: form.description || null, category: form.category || null,
      store_id: form.store_id || null, created_by: user.id,
      source_account_id: form.source_account_id || null,
      destination_account_id: form.destination_account_id || null,
      net_amount: parseFloat(form.amount),
      expected_settlement_date: new Date().toISOString(),
      reconciled: false,
    } as any);
    
    if (error) { toast.error(error.message); }
    else {
      toast.success("Transação registrada!");
      setDialogOpen(false);
      setForm({ type: "sale", amount: "", description: "", category: "", store_id: "", source_account_id: "", destination_account_id: "" });
      fetchData();
    }
    setLoading(false);
  };

  const handleReconcile = async (id: string, current: boolean) => {
    const { error } = await supabase.from("transactions" as any).update({ reconciled: !current }).eq("id", id);
    if (error) toast.error("Erro ao conciliar");
    else toast.success(current ? "Conciliação removida" : "Transação conciliada com sucesso!");
    fetchData();
  };

  const storeMap = new Map(stores.map((s) => [s.id, s.name]));
  const accountMap = new Map(accounts.map((a) => [a.id, a.bank_name]));
  const isIncome = (type: string) => type === "sale" || type === "income";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Transações</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Histórico financeiro completo</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 h-10"><Plus className="h-4 w-4" /> Nova Transação</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Registrar Transação</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tipo de Movimentação</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">💰 Venda</SelectItem>
                    <SelectItem value="income">📈 Receita Extra</SelectItem>
                    <SelectItem value="expense_pj">🏢 Gasto Loja (PJ)</SelectItem>
                    <SelectItem value="expense_pf">🧑 Gasto Pessoal (PF)</SelectItem>
                    <SelectItem value="pro_labore">💼 Retirada Pró-labore</SelectItem>
                    <SelectItem value="transfer">🔄 Transferência entre Contas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" required className="h-10" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1"><Tag className="h-3 w-3" /> Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {TRANSACTION_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Loja Responsável</Label>
                  <Select value={form.store_id} onValueChange={(v) => setForm({ ...form, store_id: v })}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      {stores.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Descrição / Detalhes</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Para onde foi esse dinheiro?" className="min-h-[80px]" />
              </div>
              
              {form.type === "transfer" ? (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Sai do Banco</Label>
                    <Select value={form.source_account_id} onValueChange={(v) => setForm({ ...form, source_account_id: v })}>
                      <SelectTrigger className="h-10 bg-background"><SelectValue placeholder="Origem" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.bank_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Entra no Banco</Label>
                    <Select value={form.destination_account_id} onValueChange={(v) => setForm({ ...form, destination_account_id: v })}>
                      <SelectTrigger className="h-10 bg-background"><SelectValue placeholder="Destino" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.bank_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Conta Bancária Afetada</Label>
                  <Select value={isIncome(form.type) ? form.destination_account_id : form.source_account_id} onValueChange={(v) => setForm({ ...form, [isIncome(form.type) ? "destination_account_id" : "source_account_id"]: v })}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.bank_name} ({a.owner_type || 'PJ'})</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" className="w-full h-11 font-bold shadow-lg" disabled={loading}>
                {loading ? "Processando..." : "Confirmar Lançamento"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {transactions.map((tx) => (
          <Card key={tx.id} className="border-border/50 shadow-sm overflow-hidden group hover:border-primary/30 transition-colors">
            <CardContent className="p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`rounded-lg p-2.5 shrink-0 shadow-inner ${
                  tx.type === "transfer" ? "bg-blue-500/10 text-blue-500" : 
                  isIncome(tx.type) ? "bg-primary/10 text-primary" : 
                  tx.type === 'expense_pf' ? "bg-destructive/10 text-destructive" :
                  "bg-orange-500/10 text-orange-500"
                }`}>
                  {tx.type === "transfer" ? <ArrowUpDown className="h-4 w-4" /> : isIncome(tx.type) ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{tx.description || tx.category || typeLabels[tx.type]}</p>
                    {tx.category && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal text-muted-foreground">{tx.category}</Badge>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Badge className={`text-[10px] px-1.5 py-0 h-4 font-medium rounded-sm border-0 ${typeColors[tx.type]}`}>
                      {typeLabels[tx.type]}
                    </Badge>
                    {(tx.source_account_id || tx.destination_account_id) && (
                      <span className="text-[10px] text-muted-foreground bg-muted/50 px-1 rounded flex items-center gap-1">
                        {tx.source_account_id ? accountMap.get(tx.source_account_id) : ""} 
                        {tx.source_account_id && tx.destination_account_id ? " → " : ""}
                        {tx.destination_account_id ? accountMap.get(tx.destination_account_id) : ""}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className={`font-display font-bold text-sm text-right ${tx.type === "transfer" ? "text-blue-500" : isIncome(tx.type) ? "text-primary" : "text-destructive"}`}>
                  {tx.type === "transfer" ? "" : isIncome(tx.type) ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                </p>
                <button 
                  onClick={() => handleReconcile(tx.id, tx.reconciled || false)}
                  className={`h-7 px-2 rounded text-[10px] font-bold border transition-all ${
                    tx.reconciled 
                      ? "bg-green-500/10 text-green-600 border-green-500/20" 
                      : "bg-transparent text-muted-foreground border-border hover:border-primary hover:text-primary"
                  }`}
                >
                  {tx.reconciled ? "CONCILIADO" : "PENDENTE"}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Transacoes;
