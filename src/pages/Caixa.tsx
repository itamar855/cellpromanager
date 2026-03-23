import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Wallet, Plus, Minus, ArrowDownUp, Lock, Unlock, Camera,
  Upload, AlertTriangle, CheckCircle, Receipt, TrendingUp, TrendingDown,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type CashRegister = {
  id: string; store_id: string; opened_by: string; closed_by: string | null;
  opening_amount: number; closing_amount: number | null; expected_amount: number | null;
  difference: number | null; difference_reason: string | null;
  status: "open" | "closed"; opening_note: string | null; closing_note: string | null;
  opening_receipt_url: string | null; closing_receipt_url: string | null;
  opened_at: string; closed_at: string | null;
};

type CashEntry = {
  id: string; cash_register_id: string; store_id: string;
  type: "entrada" | "saida" | "sangria" | "abertura" | "fechamento";
  payment_method: string | null; amount: number; description: string;
  receipt_url: string | null; created_by: string; created_at: string;
};

const typeConfig = {
  entrada: { label: "Entrada", color: "text-primary", bg: "bg-primary/10", icon: TrendingUp },
  saida: { label: "Saída", color: "text-destructive", bg: "bg-destructive/10", icon: TrendingDown },
  sangria: { label: "Sangria", color: "text-yellow-500", bg: "bg-yellow-500/10", icon: Minus },
  abertura: { label: "Abertura", color: "text-blue-500", bg: "bg-blue-500/10", icon: Unlock },
  fechamento: { label: "Fechamento", color: "text-purple-500", bg: "bg-purple-500/10", icon: Lock },
};

const paymentLabels: Record<string, string> = {
  dinheiro: "Dinheiro", cartao_credito: "Cartão Crédito", cartao_debito: "Cartão Débito",
  pix: "PIX", transferencia: "Transferência", outro: "Outro",
};

const Caixa = () => {
  const { user } = useAuth();
  const [stores, setStores] = useState<Tables<"stores">[]>([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [currentRegister, setCurrentRegister] = useState<CashRegister | null>(null);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Dialogs
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [entryDialog, setEntryDialog] = useState(false);
  const [sangriaDialog, setSangriaDialog] = useState(false);

  // Forms
  const [openForm, setOpenForm] = useState({ amount: "", note: "", receipt: null as File | null });
  const [closeForm, setCloseForm] = useState({ amount: "", note: "", reason: "", receipt: null as File | null });
  const [entryForm, setEntryForm] = useState({
    type: "entrada" as "entrada" | "saida",
    amount: "", description: "", payment_method: "dinheiro", receipt: null as File | null,
  });
  const [sangriaForm, setSangriaForm] = useState({ amount: "", description: "", receipt: null as File | null });

  // File refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [activeTarget, setActiveTarget] = useState<"open" | "close" | "entry" | "sangria" | null>(null);

  const fetchData = async () => {
    const { data: storesData } = await supabase.from("stores").select("*");
    setStores(storesData ?? []);
    if (storesData && storesData.length > 0 && !selectedStore) {
      setSelectedStore(storesData[0].id);
    }
  };

  const fetchRegister = async (storeId: string) => {
    const { data } = await supabase
      .from("cash_registers" as any).select("*")
      .eq("store_id", storeId).eq("status", "open").maybeSingle();
    setCurrentRegister(data as unknown as CashRegister | null);
    if (data) {
      const { data: entriesData } = await supabase
        .from("cash_entries" as any).select("*")
        .eq("cash_register_id", (data as any).id)
        .order("created_at", { ascending: false });
      setEntries((entriesData as unknown as CashEntry[]) ?? []);
    } else {
      setEntries([]);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (selectedStore) fetchRegister(selectedStore); }, [selectedStore]);

  const uploadReceipt = async (file: File, path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage.from("comprovantes").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro no upload: " + error.message); return null; }
    const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handleFileSelect = (file: File) => {
    if (activeTarget === "open") setOpenForm(f => ({ ...f, receipt: file }));
    if (activeTarget === "close") setCloseForm(f => ({ ...f, receipt: file }));
    if (activeTarget === "entry") setEntryForm(f => ({ ...f, receipt: file }));
    if (activeTarget === "sangria") setSangriaForm(f => ({ ...f, receipt: file }));
  };

  // Cálculos
  const totalEntradas = entries.filter(e => ["entrada", "abertura"].includes(e.type)).reduce((s, e) => s + Number(e.amount), 0);
  const totalSaidas = entries.filter(e => ["saida", "sangria"].includes(e.type)).reduce((s, e) => s + Number(e.amount), 0);
  const expectedAmount = Number(currentRegister?.opening_amount || 0) + totalEntradas - totalSaidas;
  const closingAmount = parseFloat(closeForm.amount) || 0;
  const difference = closingAmount - expectedAmount;

  const handleOpenRegister = async () => {
    if (!user || !selectedStore) return;
    setLoading(true);
    let receiptUrl: string | null = null;
    if (openForm.receipt) receiptUrl = await uploadReceipt(openForm.receipt, `abertura/${selectedStore}-${Date.now()}`);

    const { data: reg, error } = await supabase.from("cash_registers" as any).insert({
      store_id: selectedStore, opened_by: user.id,
      opening_amount: parseFloat(openForm.amount) || 0,
      opening_note: openForm.note || null,
      opening_receipt_url: receiptUrl, status: "open",
    }).select().single();

    if (error) { toast.error(error.message); setLoading(false); return; }

    await supabase.from("cash_entries" as any).insert({
      cash_register_id: (reg as any).id, store_id: selectedStore,
      type: "abertura", amount: parseFloat(openForm.amount) || 0,
      description: "Abertura de caixa", payment_method: "dinheiro",
      receipt_url: receiptUrl, receipt_required: false, created_by: user.id,
    });

    toast.success("Caixa aberto!");
    setOpenDialog(false);
    setOpenForm({ amount: "", note: "", receipt: null });
    fetchRegister(selectedStore);
    setLoading(false);
  };

  const handleCloseRegister = async () => {
    if (!user || !currentRegister) return;
    if (Math.abs(difference) > 5 && !closeForm.reason) {
      toast.error("Diferença maior que R$ 5,00 — informe o motivo!");
      return;
    }
    setLoading(true);
    let receiptUrl: string | null = null;
    if (closeForm.receipt) receiptUrl = await uploadReceipt(closeForm.receipt, `fechamento/${selectedStore}-${Date.now()}`);

    await supabase.from("cash_registers" as any).update({
      closed_by: user.id, closing_amount: closingAmount,
      expected_amount: expectedAmount, difference,
      difference_reason: closeForm.reason || null,
      closing_note: closeForm.note || null,
      closing_receipt_url: receiptUrl,
      status: "closed", closed_at: new Date().toISOString(),
    }).eq("id", currentRegister.id);

    await supabase.from("cash_entries" as any).insert({
      cash_register_id: currentRegister.id, store_id: selectedStore,
      type: "fechamento", amount: closingAmount,
      description: `Fechamento${difference !== 0 ? ` (dif: ${formatCurrency(difference)})` : ""}`,
      payment_method: "dinheiro", receipt_url: receiptUrl,
      receipt_required: false, created_by: user.id,
    });

    toast.success("Caixa fechado!");
    setCloseDialog(false);
    setCloseForm({ amount: "", note: "", reason: "", receipt: null });
    fetchRegister(selectedStore);
    setLoading(false);
  };

  const handleEntry = async () => {
    if (!user || !currentRegister) return;
    if (!entryForm.receipt) { toast.error("Comprovante obrigatório para confirmar o lançamento!"); return; }
    if (!entryForm.amount || !entryForm.description) { toast.error("Preencha todos os campos!"); return; }
    setLoading(true);

    const receiptUrl = await uploadReceipt(entryForm.receipt, `lancamento/${Date.now()}`);
    if (!receiptUrl) { setLoading(false); return; }

    await supabase.from("cash_entries" as any).insert({
      cash_register_id: currentRegister.id, store_id: selectedStore,
      type: entryForm.type, amount: parseFloat(entryForm.amount) || 0,
      description: entryForm.description, payment_method: entryForm.payment_method,
      receipt_url: receiptUrl, receipt_required: true, created_by: user.id,
    });

    toast.success("Lançamento confirmado com comprovante!");
    setEntryDialog(false);
    setEntryForm({ type: "entrada", amount: "", description: "", payment_method: "dinheiro", receipt: null });
    fetchRegister(selectedStore);
    setLoading(false);
  };

  const handleSangria = async () => {
    if (!user || !currentRegister) return;
    if (!sangriaForm.receipt) { toast.error("Comprovante obrigatório para sangria!"); return; }
    if (!sangriaForm.amount) { toast.error("Informe o valor da sangria!"); return; }
    setLoading(true);

    const receiptUrl = await uploadReceipt(sangriaForm.receipt, `sangria/${Date.now()}`);
    if (!receiptUrl) { setLoading(false); return; }

    await supabase.from("cash_entries" as any).insert({
      cash_register_id: currentRegister.id, store_id: selectedStore,
      type: "sangria", amount: parseFloat(sangriaForm.amount) || 0,
      description: sangriaForm.description || "Sangria de caixa",
      payment_method: "dinheiro", receipt_url: receiptUrl,
      receipt_required: true, created_by: user.id,
    });

    toast.success("Sangria registrada com comprovante!");
    setSangriaDialog(false);
    setSangriaForm({ amount: "", description: "", receipt: null });
    fetchRegister(selectedStore);
    setLoading(false);
  };

  const ReceiptUpload = ({ target, file }: { target: typeof activeTarget; file: File | null }) => (
    <div className="space-y-2">
      <Label className="text-xs flex items-center gap-1">
        <Receipt className="h-3 w-3" /> Comprovante
        {target !== "open" && <span className="text-destructive ml-0.5">* obrigatório</span>}
      </Label>
      {file ? (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
          <CheckCircle className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs text-primary truncate flex-1">{file.name}</p>
          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => {
            if (target === "open") setOpenForm(f => ({ ...f, receipt: null }));
            if (target === "close") setCloseForm(f => ({ ...f, receipt: null }));
            if (target === "entry") setEntryForm(f => ({ ...f, receipt: null }));
            if (target === "sangria") setSangriaForm(f => ({ ...f, receipt: null }));
          }}>Remover</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-10 gap-2 text-xs"
              onClick={() => { setActiveTarget(target); cameraInputRef.current?.click(); }}>
              <Camera className="h-4 w-4" /> Tirar Foto
            </Button>
            <Button type="button" variant="outline" className="h-10 gap-2 text-xs"
              onClick={() => { setActiveTarget(target); fileInputRef.current?.click(); }}>
              <Upload className="h-4 w-4" /> Galeria
            </Button>
          </div>
          {target !== "open" && (
            <p className="text-[10px] text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Anexe o comprovante para confirmar o lançamento
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); e.target.value = ""; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); e.target.value = ""; }} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Caixa</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Controle de abertura, fechamento e lançamentos</p>
        </div>
        <Select value={selectedStore} onValueChange={setSelectedStore}>
          <SelectTrigger className="w-full sm:w-48 h-10"><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
          <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {currentRegister ? (
        <>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Unlock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-primary">Caixa Aberto</p>
                    <p className="text-xs text-muted-foreground">Desde {new Date(currentRegister.opened_at).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="gap-1.5 h-9 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/10"
                    onClick={() => setSangriaDialog(true)}>
                    <Minus className="h-3.5 w-3.5" /> Sangria
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => setEntryDialog(true)}>
                    <Plus className="h-3.5 w-3.5" /> Lançamento
                  </Button>
                  <Button size="sm" className="gap-1.5 h-9 bg-destructive hover:bg-destructive/90" onClick={() => setCloseDialog(true)}>
                    <Lock className="h-3.5 w-3.5" /> Fechar Caixa
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Fundo Inicial", value: Number(currentRegister.opening_amount), color: "text-blue-500" },
              { label: "Total Entradas", value: totalEntradas, color: "text-primary" },
              { label: "Total Saídas", value: totalSaidas, color: "text-destructive" },
              { label: "Saldo Esperado", value: expectedAmount, color: expectedAmount >= 0 ? "text-primary" : "text-destructive" },
            ].map(card => (
              <Card key={card.label} className="border-border/50">
                <CardContent className="p-4">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{card.label}</p>
                  <p className={`font-display text-lg font-bold mt-1 ${card.color}`}>{formatCurrency(card.value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-sm flex items-center gap-2">
                <ArrowDownUp className="h-4 w-4 text-primary" /> Conferência por Forma de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {["dinheiro", "pix", "cartao_credito", "cartao_debito", "transferencia"].map(method => {
                  const ent = entries.filter(e => ["entrada","abertura"].includes(e.type) && e.payment_method === method).reduce((s, e) => s + Number(e.amount), 0);
                  const sai = entries.filter(e => ["saida","sangria"].includes(e.type) && e.payment_method === method).reduce((s, e) => s + Number(e.amount), 0);
                  if (ent === 0 && sai === 0) return null;
                  const saldo = ent - sai;
                  return (
                    <div key={method} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                      <span className="text-sm">{paymentLabels[method]}</span>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-primary">+{formatCurrency(ent)}</span>
                        <span className="text-destructive">-{formatCurrency(sai)}</span>
                        <span className={`font-bold ${saldo >= 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(saldo)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-sm">Lançamentos do Dia ({entries.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {entries.length > 0 ? (
                <div className="space-y-2">
                  {entries.map(entry => {
                    const cfg = typeConfig[entry.type];
                    const isPositive = ["entrada", "abertura"].includes(entry.type);
                    return (
                      <div key={entry.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-8 w-8 rounded-full ${cfg.bg} flex items-center justify-center shrink-0`}>
                            <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{entry.description}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <Badge variant="outline" className={`text-[9px] ${cfg.color}`}>{cfg.label}</Badge>
                              {entry.payment_method && <span className="text-[10px] text-muted-foreground">{paymentLabels[entry.payment_method]}</span>}
                              {entry.receipt_url && (
                                <a href={entry.receipt_url} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline flex items-center gap-0.5">
                                  <Receipt className="h-2.5 w-2.5" /> Comprovante
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className={`font-bold text-sm ${isPositive ? "text-primary" : "text-destructive"}`}>
                            {isPositive ? "+" : "-"}{formatCurrency(Number(entry.amount))}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{new Date(entry.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhum lançamento ainda</p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Wallet className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <div className="text-center">
              <p className="font-semibold">Caixa fechado</p>
              <p className="text-xs text-muted-foreground mt-1">Abra o caixa para começar a registrar lançamentos</p>
            </div>
            <Button className="gap-2" onClick={() => setOpenDialog(true)} disabled={!selectedStore}>
              <Unlock className="h-4 w-4" /> Abrir Caixa
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialog Abrir Caixa */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><Unlock className="h-4 w-4 text-primary" /> Abrir Caixa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Fundo de Caixa (R$)</Label>
              <Input type="number" step="0.01" value={openForm.amount} onChange={e => setOpenForm(f => ({ ...f, amount: e.target.value }))} placeholder="200.00" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observação</Label>
              <Textarea value={openForm.note} onChange={e => setOpenForm(f => ({ ...f, note: e.target.value }))} placeholder="Notas de abertura..." className="min-h-[60px]" />
            </div>
            <ReceiptUpload target="open" file={openForm.receipt} />
            <Button className="w-full h-11" onClick={handleOpenRegister} disabled={loading}>
              {loading ? "Abrindo..." : "Abrir Caixa"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Fechar Caixa */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><Lock className="h-4 w-4 text-destructive" /> Fechar Caixa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Saldo esperado pelo sistema</span><span className="font-bold">{formatCurrency(expectedAmount)}</span></div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor Contado (R$)</Label>
              <Input type="number" step="0.01" value={closeForm.amount} onChange={e => setCloseForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="h-10" />
              {closeForm.amount && (
                <div className={`flex items-center gap-2 text-xs font-semibold mt-1 ${Math.abs(difference) <= 5 ? "text-primary" : "text-destructive"}`}>
                  {Math.abs(difference) <= 5 ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  Diferença: {difference >= 0 ? "+" : ""}{formatCurrency(difference)}
                  {Math.abs(difference) > 5 && " — justificativa obrigatória"}
                </div>
              )}
            </div>
            {Math.abs(difference) > 5 && closeForm.amount && (
              <div className="space-y-1.5">
                <Label className="text-xs text-destructive">Motivo da diferença *</Label>
                <Textarea value={closeForm.reason} onChange={e => setCloseForm(f => ({ ...f, reason: e.target.value }))} placeholder="Explique a diferença..." className="min-h-[60px]" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Observação</Label>
              <Textarea value={closeForm.note} onChange={e => setCloseForm(f => ({ ...f, note: e.target.value }))} placeholder="Notas de fechamento..." className="min-h-[60px]" />
            </div>
            <ReceiptUpload target="close" file={closeForm.receipt} />
            <Button className="w-full h-11 bg-destructive hover:bg-destructive/90" onClick={handleCloseRegister} disabled={loading || !closeForm.amount}>
              {loading ? "Fechando..." : "Confirmar Fechamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Lançamento */}
      <Dialog open={entryDialog} onOpenChange={setEntryDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Novo Lançamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary flex items-center gap-2">
              <Receipt className="h-4 w-4 shrink-0" />
              Comprovante obrigatório — o lançamento só será confirmado após anexar o comprovante.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant={entryForm.type === "entrada" ? "default" : "outline"} className="gap-2"
                onClick={() => setEntryForm(f => ({ ...f, type: "entrada" }))}>
                <TrendingUp className="h-4 w-4" /> Entrada
              </Button>
              <Button variant={entryForm.type === "saida" ? "destructive" : "outline"} className="gap-2"
                onClick={() => setEntryForm(f => ({ ...f, type: "saida" }))}>
                <TrendingDown className="h-4 w-4" /> Saída
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição *</Label>
              <Input value={entryForm.description} onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição do lançamento" className="h-10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Valor (R$) *</Label>
                <Input type="number" step="0.01" value={entryForm.amount} onChange={e => setEntryForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Forma de Pagamento</Label>
                <Select value={entryForm.payment_method} onValueChange={v => setEntryForm(f => ({ ...f, payment_method: v }))}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(paymentLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <ReceiptUpload target="entry" file={entryForm.receipt} />
            <Button className="w-full h-11" onClick={handleEntry}
              disabled={loading || !entryForm.amount || !entryForm.description || !entryForm.receipt}>
              {loading ? "Confirmando..." : "Confirmar Lançamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Sangria */}
      <Dialog open={sangriaDialog} onOpenChange={setSangriaDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><Minus className="h-4 w-4 text-yellow-500" /> Sangria de Caixa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Retirada de dinheiro do caixa. Comprovante obrigatório — a sangria só será registrada após anexar.
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor (R$) *</Label>
              <Input type="number" step="0.01" value={sangriaForm.amount} onChange={e => setSangriaForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Motivo *</Label>
              <Input value={sangriaForm.description} onChange={e => setSangriaForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Pagamento de fornecedor" className="h-10" />
            </div>
            <ReceiptUpload target="sangria" file={sangriaForm.receipt} />
            <Button className="w-full h-11 bg-yellow-500 hover:bg-yellow-600 text-black font-bold" onClick={handleSangria}
              disabled={loading || !sangriaForm.amount || !sangriaForm.receipt}>
              {loading ? "Registrando..." : "Confirmar Sangria"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Caixa;
