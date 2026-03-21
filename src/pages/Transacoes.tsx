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
import { Plus, ArrowUpDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const typeLabels: Record<string, string> = {
  sale: "Venda", expense_pj: "PJ", expense_pf: "PF", income: "Receita", pro_labore: "Pro-labore",
};
const typeColors: Record<string, string> = {
  sale: "bg-primary/15 text-primary", income: "bg-primary/15 text-primary",
  expense_pj: "bg-accent/15 text-accent", expense_pf: "bg-destructive/15 text-destructive",
  pro_labore: "bg-destructive/15 text-destructive",
};

const Transacoes = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [stores, setStores] = useState<Tables<"stores">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ type: "sale", amount: "", description: "", category: "", store_id: "" });

  const fetchData = async () => {
    const [txRes, storesRes] = await Promise.all([
      supabase.from("transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("stores").select("*"),
    ]);
    setTransactions(txRes.data ?? []);
    setStores(storesRes.data ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("transactions").insert({
      type: form.type, amount: parseFloat(form.amount),
      description: form.description || null, category: form.category || null,
      store_id: form.store_id || null, created_by: user.id,
    });
    if (error) { toast.error(error.message); }
    else {
      toast.success("Transação registrada!");
      setDialogOpen(false);
      setForm({ type: "sale", amount: "", description: "", category: "", store_id: "" });
      fetchData();
    }
    setLoading(false);
  };

  const storeMap = new Map(stores.map((s) => [s.id, s.name]));
  const isIncome = (type: string) => type === "sale" || type === "income";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Transações</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Entradas e saídas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 h-10"><Plus className="h-4 w-4" /> Nova Transação</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Registrar Transação</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">💰 Venda</SelectItem>
                    <SelectItem value="income">📈 Receita</SelectItem>
                    <SelectItem value="expense_pj">🏢 Gasto PJ</SelectItem>
                    <SelectItem value="expense_pf">🧑 Gasto PF</SelectItem>
                    <SelectItem value="pro_labore">💼 Pro-labore</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" required className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Venda iPhone 13" className="min-h-[70px]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Categoria</Label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Alimentação" className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Loja</Label>
                  <Select value={form.store_id} onValueChange={(v) => setForm({ ...form, store_id: v })}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      {stores.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                {loading ? "Salvando..." : "Registrar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {transactions.length > 0 ? (
          transactions.map((tx) => (
            <Card key={tx.id} className="border-border/50 shadow-lg shadow-black/10">
              <CardContent className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`rounded-lg p-2 shrink-0 ${isIncome(tx.type) ? "bg-primary/15" : "bg-destructive/15"}`}>
                    {isIncome(tx.type) ? <ArrowUpRight className="h-4 w-4 text-primary" /> : <ArrowDownRight className="h-4 w-4 text-destructive" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{tx.description || typeLabels[tx.type]}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeColors[tx.type]}`}>
                        {typeLabels[tx.type]}
                      </Badge>
                      {tx.store_id && <span className="text-[10px] text-muted-foreground">{storeMap.get(tx.store_id)}</span>}
                      <span className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                </div>
                <p className={`font-display font-bold text-sm shrink-0 ${isIncome(tx.type) ? "text-primary" : "text-destructive"}`}>
                  {isIncome(tx.type) ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                </p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ArrowUpDown className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium text-sm">Nenhuma transação</p>
              <p className="text-xs mt-1">Registre sua primeira transação</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Transacoes;
