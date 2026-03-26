import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Wallet, TrendingDown, TrendingUp, ArrowDownRight, Briefcase,
  Plus, Trash2, Edit2, Tag, Scale, CalendarDays, Filter,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";

const COLORS = [
  "hsl(0, 72%, 55%)", "hsl(25, 95%, 53%)", "hsl(45, 93%, 47%)",
  "hsl(142, 71%, 45%)", "hsl(199, 89%, 48%)", "hsl(262, 83%, 58%)",
  "hsl(330, 81%, 60%)", "hsl(190, 75%, 42%)", "hsl(350, 65%, 45%)",
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const PF_CATEGORIES = [
  "Alimentação", "Moradia (Aluguel/Luz)", "Transporte/Combustível", "Lazer/Viagens",
  "Saúde", "Educação", "Vestuário", "Investimentos", "Assinaturas/Streaming",
  "Pets", "Presentes", "Outros",
];

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const FinancasPF = () => {
  const { user, userRole } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [accounts, setAccounts] = useState<Tables<"store_bank_accounts">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filtros
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState<number>(now.getMonth());
  const [filterYear, setFilterYear] = useState<number>(now.getFullYear());

  const [form, setForm] = useState({
    type: "expense_pf" as string,
    amount: "",
    description: "",
    category: "",
    source_account_id: "",
  });

  /* ─── Fetch ─── */
  const fetchData = async () => {
    const [txRes, accRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("*")
        .in("type", ["expense_pf", "pro_labore"])
        .order("created_at", { ascending: false }),
      supabase.from("store_bank_accounts").select("*"),
    ]);
    setTransactions(txRes.data ?? []);
    setAccounts(accRes.data ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  /* ─── Filtered by month/year ─── */
  const filtered = transactions.filter((tx) => {
    const d = new Date(tx.created_at);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  });

  /* ─── KPIs ─── */
  const totalProLabore = filtered
    .filter((t) => t.type === "pro_labore")
    .reduce((s, t) => s + Number(t.amount), 0);

  const totalGastosPF = filtered
    .filter((t) => t.type === "expense_pf")
    .reduce((s, t) => s + Number(t.amount), 0);

  const saldo = totalProLabore - totalGastosPF;

  /* ─── Chart: gastos por categoria ─── */
  const catMap: Record<string, number> = {};
  filtered
    .filter((t) => t.type === "expense_pf")
    .forEach((t) => {
      const cat = t.category || "Sem categoria";
      catMap[cat] = (catMap[cat] || 0) + Number(t.amount);
    });
  const categoryData = Object.entries(catMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  /* ─── Chart: evolução mensal (últimos 6 meses) ─── */
  const monthlyData: { month: string; gastos: number; prolabore: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(filterYear, filterMonth - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const label = `${MONTHS[m].substring(0, 3)}/${String(y).slice(2)}`;
    const gastos = transactions
      .filter((t) => t.type === "expense_pf" && new Date(t.created_at).getMonth() === m && new Date(t.created_at).getFullYear() === y)
      .reduce((s, t) => s + Number(t.amount), 0);
    const prolabore = transactions
      .filter((t) => t.type === "pro_labore" && new Date(t.created_at).getMonth() === m && new Date(t.created_at).getFullYear() === y)
      .reduce((s, t) => s + Number(t.amount), 0);
    monthlyData.push({ month: label, gastos, prolabore });
  }

  /* ─── CRUD ─── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const payload = {
      type: form.type,
      amount: parseFloat(form.amount),
      description: form.description || null,
      category: form.category || null,
      source_account_id: form.source_account_id || null,
      destination_account_id: null,
      store_id: null,
      net_amount: parseFloat(form.amount),
    };

    if (editingId) {
      const { error } = await supabase.from("transactions").update(payload).eq("id", editingId);
      if (error) toast.error(error.message);
      else {
        toast.success("Lançamento atualizado!");
        resetForm();
        fetchData();
      }
    } else {
      const { error } = await supabase.from("transactions").insert({
        ...payload,
        created_by: user.id,
        expected_settlement_date: new Date().toISOString(),
        reconciled: false,
      } as any);
      if (error) toast.error(error.message);
      else {
        toast.success("Lançamento registrado!");
        resetForm();
        fetchData();
      }
    }
    setLoading(false);
  };

  const resetForm = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ type: "expense_pf", amount: "", description: "", category: "", source_account_id: "" });
  };

  const handleEdit = (tx: Tables<"transactions">) => {
    setEditingId(tx.id);
    setForm({
      type: tx.type,
      amount: tx.amount.toString(),
      description: tx.description || "",
      category: tx.category || "",
      source_account_id: tx.source_account_id || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setLoading(true);
    const { error } = await supabase.from("transactions").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else { toast.success("Lançamento excluído!"); setDeleteId(null); fetchData(); }
    setLoading(false);
  };

  const accountMap = new Map(accounts.map((a) => [a.id, a.bank_name]));

  /* ─── Year options ─── */
  const years = Array.from(new Set(transactions.map((t) => new Date(t.created_at).getFullYear())));
  if (!years.includes(now.getFullYear())) years.push(now.getFullYear());
  years.sort((a, b) => b - a);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            Minhas Finanças Pessoais
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Controle completo dos seus gastos e recebimentos como Pessoa Física
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 h-10 shadow-lg">
              <Plus className="h-4 w-4" /> Novo Lançamento PF
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editingId ? "Editar Lançamento PF" : "Novo Lançamento PF"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense_pf">🧑 Gasto Pessoal (PF)</SelectItem>
                    <SelectItem value="pro_labore">💼 Retirada Pró-labore</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Valor (R$)</Label>
                <Input
                  type="number" step="0.01" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00" required className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Categoria
                </Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {(form.type === "pro_labore" ? ["Pro-labore"] : PF_CATEGORIES).map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Descrição</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Para que foi esse gasto?" className="min-h-[70px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Conta Bancária</Label>
                <Select value={form.source_account_id} onValueChange={(v) => setForm({ ...form, source_account_id: v })}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.bank_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full h-11 font-bold shadow-lg" disabled={loading}>
                {loading ? "Processando..." : editingId ? "Salvar Alterações" : "Registrar Lançamento"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtro Mês / Ano */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span className="font-medium">Período:</span>
        </div>
        <Select value={String(filterMonth)} onValueChange={(v) => setFilterMonth(Number(v))}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(Number(v))}>
          <SelectTrigger className="h-9 w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-border/50 shadow-lg shadow-black/10 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Pró-labore Recebido</p>
              <Briefcase className="h-4 w-4 text-violet-500" />
            </div>
            <p className="font-display text-xl font-bold text-violet-500">{formatCurrency(totalProLabore)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">no mês selecionado</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-lg shadow-black/10 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-red-500 to-rose-600" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Gastos Pessoais</p>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
            <p className="font-display text-xl font-bold text-destructive">{formatCurrency(totalGastosPF)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{filtered.filter(t => t.type === "expense_pf").length} lançamentos</p>
          </CardContent>
        </Card>

        <Card className={`border-border/50 shadow-lg shadow-black/10 overflow-hidden`}>
          <div className={`h-1 ${saldo >= 0 ? "bg-gradient-to-r from-emerald-500 to-green-600" : "bg-gradient-to-r from-red-600 to-red-700"}`} />
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Saldo do Mês</p>
              <Scale className="h-4 w-4" />
            </div>
            <p className={`font-display text-xl font-bold ${saldo >= 0 ? "text-emerald-500" : "text-destructive"}`}>
              {formatCurrency(saldo)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {saldo >= 0 ? "Sobra do pró-labore" : "Gastou mais do que recebeu"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gastos por Categoria */}
        <Card className="border-border/50 shadow-lg shadow-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm">Gastos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" paddingAngle={2}>
                      {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 flex-1 min-w-0">
                  {categoryData.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatCurrency(c.value)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-xs">
                Nenhum gasto pessoal neste mês
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evolução Mensal */}
        <Card className="border-border/50 shadow-lg shadow-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm">Evolução Mensal (últimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="prolabore" fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} name="Pró-labore" />
                <Bar dataKey="gastos" fill="hsl(0, 72%, 55%)" radius={[4, 4, 0, 0]} name="Gastos PF" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Lançamentos */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-sm font-bold">
            Lançamentos — {MONTHS[filterMonth]} {filterYear}
          </h2>
          <Badge variant="outline" className="text-[10px] h-5">{filtered.length} itens</Badge>
        </div>

        {filtered.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Wallet className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum lançamento neste período</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Clique em "Novo Lançamento PF" para registrar</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((tx) => (
              <Card key={tx.id} className="border-border/50 shadow-sm overflow-hidden group hover:border-primary/30 transition-colors">
                <CardContent className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`rounded-lg p-2.5 shrink-0 shadow-inner ${
                      tx.type === "pro_labore"
                        ? "bg-violet-500/10 text-violet-500"
                        : "bg-destructive/10 text-destructive"
                    }`}>
                      {tx.type === "pro_labore"
                        ? <Briefcase className="h-4 w-4" />
                        : <ArrowDownRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">
                          {tx.description || tx.category || (tx.type === "pro_labore" ? "Pró-labore" : "Gasto Pessoal")}
                        </p>
                        {tx.category && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal text-muted-foreground">
                            {tx.category}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge className={`text-[10px] px-1.5 py-0 h-4 font-medium rounded-sm border-0 ${
                          tx.type === "pro_labore"
                            ? "bg-violet-500/15 text-violet-500"
                            : "bg-destructive/15 text-destructive"
                        }`}>
                          {tx.type === "pro_labore" ? "Pró-labore" : "Gasto PF"}
                        </Badge>
                        {tx.source_account_id && (
                          <span className="text-[10px] text-muted-foreground bg-muted/50 px-1 rounded">
                            {accountMap.get(tx.source_account_id)}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className={`font-display font-bold text-sm ${
                        tx.type === "pro_labore" ? "text-violet-500" : "text-destructive"
                      }`}>
                        {tx.type === "pro_labore" ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                      </p>
                    </div>
                    {userRole === "admin" && (
                      <div className="flex flex-col gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleEdit(tx)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(tx.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lançamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lançamento pessoal? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete} disabled={loading}>
              {loading ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FinancasPF;
