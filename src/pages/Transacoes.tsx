import { useEffect, useState, useRef } from "react";
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
import { Plus, ArrowUpDown, ArrowUpRight, ArrowDownRight, Tag, Trash2, Edit2, Camera, Upload, Receipt, CheckCircle, Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const { user, userRole } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [stores, setStores] = useState<Tables<"stores">[]>([]);
  const [accounts, setAccounts] = useState<Tables<"store_bank_accounts">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);
  const [reconcilingTx, setReconcilingTx] = useState<Tables<"transactions"> | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null);
  const [form, setForm] = useState({ 
    type: "sale", 
    amount: "", 
    description: "", 
    category: "", 
    store_id: "", 
    source_account_id: "", 
    destination_account_id: "" 
  });

  const uploadReceipt = async (file: File): Promise<string | null> => {
    const fileName = `${user?.id}-${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage.from("comprovantes").upload(`transacoes/${fileName}`, file, { upsert: true });
    if (error) { toast.error("Erro no upload: " + error.message); return null; }
    const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(data.path);
    return urlData.publicUrl;
  };

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

    const payload = {
      type: form.type, 
      amount: parseFloat(form.amount),
      description: form.description || null, 
      category: form.category || null,
      store_id: form.store_id || null, 
      source_account_id: form.source_account_id || null,
      destination_account_id: form.destination_account_id || null,
      net_amount: parseFloat(form.amount),
      receipt_url: existingReceiptUrl
    };

    if (receiptFile) {
      const url = await uploadReceipt(receiptFile);
      if (url) payload.receipt_url = url;
    }

    if (editingId) {
      const { error } = await supabase
        .from("transactions")
        .update(payload)
        .eq("id", editingId);
      
      if (error) { toast.error(error.message); }
      else {
        toast.success("Transação atualizada!");
        setDialogOpen(false);
        setEditingId(null);
        setReceiptFile(null);
        setExistingReceiptUrl(null);
        setForm({ type: "sale", amount: "", description: "", category: "", store_id: "", source_account_id: "", destination_account_id: "" });
        fetchData();
      }
    } else {
      const { error } = await supabase.from("transactions").insert({
        ...payload,
        created_by: user.id,
        expected_settlement_date: new Date().toISOString(),
        reconciled: false,
      } as any);
      
      if (error) { toast.error(error.message); }
      else {
        toast.success("Transação registrada!");
        setDialogOpen(false);
        setReceiptFile(null);
        setExistingReceiptUrl(null);
        setForm({ type: "sale", amount: "", description: "", category: "", store_id: "", source_account_id: "", destination_account_id: "" });
        fetchData();
      }
    }
    setLoading(false);
  };

  const handleEdit = (tx: Tables<"transactions">) => {
    setEditingId(tx.id);
    setForm({
      type: tx.type,
      amount: tx.amount.toString(),
      description: tx.description || "",
      category: tx.category || "",
      store_id: tx.store_id || "",
      source_account_id: tx.source_account_id || "",
      destination_account_id: tx.destination_account_id || "",
    });
    setExistingReceiptUrl(tx.receipt_url || null);
    setReceiptFile(null);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!transactionToDelete) return;
    setLoading(true);
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transactionToDelete);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Transação excluída!");
      setTransactionToDelete(null);
      fetchData();
    }
    setLoading(false);
  };

  const handleReconcile = async (tx: Tables<"transactions">) => {
    if (tx.reconciled) {
      // Toggle off without dialog
      const { error } = await supabase.from("transactions").update({ reconciled: false }).eq("id", tx.id);
      if (error) toast.error("Erro ao remover conciliação");
      else { toast.success("Conciliação removida"); fetchData(); }
      return;
    }
    
    // Open dialog to confirm with receipt
    setReconcilingTx(tx);
    setReceiptFile(null);
    setExistingReceiptUrl(tx.receipt_url || null);
    setReconcileDialogOpen(true);
  };

  const handleConfirmReconcile = async () => {
    if (!reconcilingTx) return;
    setLoading(true);

    let finalUrL = existingReceiptUrl;
    if (receiptFile) {
      const url = await uploadReceipt(receiptFile);
      if (url) finalUrL = url;
    }

    const { error } = await supabase
      .from("transactions")
      .update({ reconciled: true, receipt_url: finalUrL })
      .eq("id", reconcilingTx.id);

    if (error) { toast.error(error.message); }
    else {
      toast.success("Transação conciliada!");
      setReconcileDialogOpen(false);
      setReconcilingTx(null);
      setReceiptFile(null);
      fetchData();
    }
    setLoading(false);
  };

  const storeMap = new Map(stores.map((s) => [s.id, s.name]));
  const accountMap = new Map(accounts.map((a) => [a.id, a.bank_name]));
  const isIncome = (type: string) => type === "sale" || type === "income";

  return (
    <div className="space-y-4">
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={e => { if (e.target.files?.[0]) setReceiptFile(e.target.files[0]); e.target.value = ""; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { if (e.target.files?.[0]) setReceiptFile(e.target.files[0]); e.target.value = ""; }} />

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

              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Receipt className="h-3 w-3" /> Comprovante (Opcional)
                </Label>
                {receiptFile ? (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                    <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-xs text-primary truncate flex-1">{receiptFile.name}</p>
                    <Button type="button" variant="ghost" className="h-6 text-[10px] hover:bg-muted px-2" onClick={() => setReceiptFile(null)}>Remover</Button>
                  </div>
                ) : existingReceiptUrl ? (
                  <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 p-2.5">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    <p className="text-xs text-green-500 truncate flex-1">Comprovante já enviado</p>
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" className="h-6 text-[10px] hover:bg-muted px-2" onClick={() => window.open(existingReceiptUrl, "_blank")}>Ver</Button>
                      <Button type="button" variant="ghost" className="h-6 text-[10px] text-destructive hover:bg-destructive/10 px-2" onClick={() => setExistingReceiptUrl(null)}>Trocar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" className="h-10 gap-2 text-xs bg-transparent border border-border text-foreground hover:bg-muted"
                      onClick={() => cameraInputRef.current?.click()}>
                      <Camera className="h-4 w-4" /> Tirar Foto
                    </Button>
                    <Button type="button" className="h-10 gap-2 text-xs bg-transparent border border-border text-foreground hover:bg-muted"
                      onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4" /> Galeria
                    </Button>
                  </div>
                )}
              </div>

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
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`rounded-lg p-2.5 shrink-0 shadow-inner ${
                  tx.type === "transfer" ? "bg-blue-500/10 text-blue-500" : 
                  isIncome(tx.type) ? "bg-primary/10 text-primary" : 
                  tx.type === 'expense_pf' ? "bg-destructive/10 text-destructive" :
                  "bg-orange-500/10 text-orange-500"
                }`}>
                  {tx.type === "transfer" ? <ArrowUpDown className="h-4 w-4" /> : isIncome(tx.type) ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
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
                    {tx.receipt_url && (
                      <a href={tx.receipt_url} target="_blank" rel="noreferrer"
                         className="text-[10px] text-primary underline flex items-center gap-0.5"
                         onClick={e => e.stopPropagation()}>
                        <Receipt className="h-2.5 w-2.5" /> Ver Comprovante
                      </a>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className={`font-display font-bold text-sm ${tx.type === "transfer" ? "text-blue-500" : isIncome(tx.type) ? "text-primary" : "text-destructive"}`}>
                    {tx.type === "transfer" ? "" : isIncome(tx.type) ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                  </p>
                  <button 
                    onClick={() => handleReconcile(tx)}
                    className={`mt-1 h-5 px-1.5 rounded text-[9px] font-bold border transition-all ${
                      tx.reconciled 
                        ? "bg-green-500/10 text-green-600 border-green-500/20" 
                        : "bg-transparent text-muted-foreground border-border hover:border-primary hover:text-primary"
                    }`}
                  >
                    {tx.reconciled ? "CONCILIADO" : "PENDENTE"}
                  </button>
                </div>

                {userRole === "admin" && (
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                      onClick={() => handleEdit(tx)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setTransactionToDelete(tx.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => !open && setTransactionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Transação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita e afetará os relatórios financeiros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog with Receipt */}
      <Dialog open={reconcileDialogOpen} onOpenChange={setReconcileDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2">Confirmar Transação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {reconcilingTx && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Descrição</span><span className="font-medium">{reconcilingTx.description || "-"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-bold">{formatCurrency(Number(reconcilingTx.amount))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span>{new Date(reconcilingTx.created_at).toLocaleDateString("pt-BR")}</span></div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold flex items-center gap-1">
                <Receipt className="h-3 w-3" /> Anexar Comprovante
              </Label>
              {receiptFile ? (
                <div className="flex items-center gap-2 rounded bg-primary/10 p-2 text-[10px] text-primary border border-primary/20 font-medium font-display">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate flex-1">{receiptFile.name}</span>
                  <button onClick={() => setReceiptFile(null)} className="hover:underline">Remover</button>
                </div>
              ) : existingReceiptUrl ? (
                <div className="flex items-center gap-2 rounded bg-green-500/10 p-2 text-[10px] text-green-600 border border-green-500/20 font-medium font-display">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate flex-1">Comprovante já enviado</span>
                  <button onClick={() => setExistingReceiptUrl(null)} className="text-destructive hover:underline">Trocar</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" className="h-10 text-xs gap-1.5" onClick={() => cameraInputRef.current?.click()}>
                    <Camera className="h-4 w-4" /> Tirar Foto
                  </Button>
                  <Button type="button" variant="outline" className="h-10 text-xs gap-1.5" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Galeria
                  </Button>
                </div>
              )}
            </div>

            <Button className="w-full h-11 font-bold" onClick={handleConfirmReconcile} disabled={loading}>
              {loading ? "Processando..." : "Confirmar e Conciliar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Transacoes;
