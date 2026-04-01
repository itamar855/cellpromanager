import { useEffect, useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Plus, Search, Wallet, ArrowUpRight, ArrowDownRight, 
  History, Calendar, Filter, Receipt, CheckCircle, 
  Clock, AlertTriangle, MoreVertical, Trash2, Unlink, Lock, Unlock, Store, 
  ArrowLeftRight, FileText, Minus, TrendingUp, TrendingDown, Camera, Upload
} from "lucide-react";
import { logAction } from "@/utils/auditLogger";
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
  confirmed: boolean | null;
};

const typeConfig = {
  entrada:    { label: "Entrada",    color: "text-primary",      bg: "bg-primary/10",      icon: TrendingUp  },
  saida:      { label: "Saída",      color: "text-destructive",  bg: "bg-destructive/10",  icon: TrendingDown },
  sangria:    { label: "Sangria",    color: "text-yellow-500",   bg: "bg-yellow-500/10",   icon: Minus       },
  abertura:   { label: "Abertura",   color: "text-blue-500",     bg: "bg-blue-500/10",     icon: Unlock      },
  fechamento: { label: "Fechamento", color: "text-purple-500",   bg: "bg-purple-500/10",   icon: Lock        },
};

const paymentLabels: Record<string, string> = {
  dinheiro: "Dinheiro", cartao_credito: "Cartão Crédito", cartao_debito: "Cartão Débito",
  pix: "PIX", transferencia: "Transferência", outro: "Outro",
};

const Caixa = () => {
  const { user, activeStoreId, userRole, userPermissions } = useAuth();
  const [currentRegister, setCurrentRegister] = useState<CashRegister | null>(null);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const canManageFinance = userRole === "admin" || userPermissions?.gerenciar_financeiro;

  // Dialogs
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [entryDialog, setEntryDialog] = useState(false);
  const [sangriaDialog, setSangriaDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<"current" | "history" | "all-open">("current");
  const [registersHistory, setRegistersHistory] = useState<CashRegister[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [justification, setJustification] = useState("");
  const [justDialogOpened, setJustDialogOpened] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: "delete" | "unconfirm" | "reopen", id: string } | null>(null);
  const [allOpenRegisters, setAllOpenRegisters] = useState<any[]>([]);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [confirmEntry, setConfirmEntry] = useState<CashEntry | null>(null);
  const [confirmFile, setConfirmFile] = useState<File | null>(null);

  // Forms
  const [openForm, setOpenForm] = useState({ amount: "", note: "", receipt: null as File | null });
  const [closeForm, setCloseForm] = useState({ amount: "", note: "", reason: "", receipt: null as File | null });
  const [entryForm, setEntryForm] = useState({
    type: "entrada" as "entrada" | "saida",
    amount: "", description: "", payment_method: "dinheiro",
  });
  const [sangriaForm, setSangriaForm] = useState({ amount: "", description: "" });

  // File refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [activeTarget, setActiveTarget] = useState<"open" | "close" | "confirm" | null>(null);

  const fetchRegister = async (storeId: string) => {
    if (!storeId) return;
    setLoading(true);
    
    // 1. Caixa Aberto
    // 1. Busca de Caixas Abertos
    // Para Admins, buscamos SEMRE todos os caixas abertos do sistema para monitoramento global
    let openQuery = supabase.from("cash_registers" as any).select("*").eq("status", "open");
    
    // Se NÃO for admin, filtramos pela loja ativa
    if (userRole !== "admin" && storeId !== "all") {
      openQuery = openQuery.eq("store_id", storeId);
    }
    
    const { data: openData, error: openError } = await openQuery;
    if (openError) {
      console.error("Error fetching open registers:", openError);
      toast.error("Erro ao buscar caixas abertos: " + openError.message);
    }

    const [profilesRes, storesRes] = await Promise.all([
       supabase.from("profiles").select("user_id, display_name"),
       supabase.from("stores").select("id, name")
    ]);
    
    if (profilesRes.error) toast.error("Erro Perfis: " + profilesRes.error.message);
    if (storesRes.error) toast.error("Erro Lojas: " + storesRes.error.message);

    const profileMap = new Map(profilesRes.data?.map(p => [p.user_id, p.display_name]));
    const storeMap = new Map(storesRes.data?.map(s => [s.id, s.name]));

    const mappedOpenData = (openData || []).map((reg: any) => ({
      ...reg,
      profiles: { display_name: profileMap.get(reg.opened_by) },
      stores: { name: storeMap.get(reg.store_id) }
    }));

    // Admin always gets all open registers regardless of activeStoreId to monitor teams
    if (userRole === "admin") {
      setAllOpenRegisters(mappedOpenData);
    }

    if (storeId !== "all") {
      const activeOne = mappedOpenData.find((reg: any) => reg.store_id === storeId);
      setCurrentRegister(activeOne || null);
    } else if (currentRegister) {
      // No modo "Todas as Unidades", atualizamos os dados do caixa selecionado se ele ainda estiver aberto
      const updatedReg = mappedOpenData.find(r => r.id === currentRegister.id);
      if (updatedReg) setCurrentRegister(updatedReg);
    }

    const regToUse = currentRegister;
    if (regToUse) {
       const { data: entriesData, error: entriesError } = await supabase
         .from("cash_entries" as any).select("*")
         .eq("cash_register_id", (regToUse as any).id)
         .order("confirmed", { ascending: true })
         .order("created_at", { ascending: false });
       
       if (entriesError) console.error("Error fetching entries:", entriesError);
       setEntries((entriesData as unknown as CashEntry[]) ?? []);
    } else {
       setEntries([]);
    }

    // 2. Histórico
    if (userRole === "admin" || activeTab === "history") {
      setHistoryLoading(true);
      let historyQuery = supabase.from("cash_registers" as any)
        .select("*")
        .eq("status", "closed")
        .order("opened_at", { ascending: false })
        .limit(20);
      
      if (storeId !== "all") {
        historyQuery = historyQuery.eq("store_id", storeId);
      }
      
      const { data: historyData, error: historyError } = await historyQuery;
      if (historyError) console.error("Error fetching history:", historyError);
      setRegistersHistory((historyData as unknown as CashRegister[]) ?? []);
      setHistoryLoading(false);
    }
    setLoading(false);
  };

  useEffect(() => { 
    if (activeStoreId) fetchRegister(activeStoreId); 
  }, [activeStoreId, activeTab]);

  const uploadReceipt = async (file: File, path: string): Promise<string | null> => {
    const safePath = path.replace(/[^a-zA-Z0-9.\-_/]/g, "_");
    const { data, error } = await supabase.storage.from("comprovantes").upload(safePath, file, { upsert: true });
    if (error) { toast.error("Erro no upload: " + error.message); return null; }
    const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handleFileSelect = (file: File) => {
    if (activeTarget === "open")    setOpenForm(f => ({ ...f, receipt: file }));
    if (activeTarget === "close")   setCloseForm(f => ({ ...f, receipt: file }));
    if (activeTarget === "confirm") setConfirmFile(file);
  };

  const confirmedEntries = entries.filter(e => e.confirmed === true);
  const totalEntradas = confirmedEntries.filter(e => ["entrada","abertura"].includes(e.type)).reduce((s, e) => s + Number(e.amount), 0);
  const totalSaidas   = confirmedEntries.filter(e => ["saida","sangria"].includes(e.type)).reduce((s, e) => s + Number(e.amount), 0);
  const expectedAmount = Number(currentRegister?.opening_amount || 0) + totalEntradas - totalSaidas;
  const closingAmount = parseFloat(closeForm.amount) || 0;
  const difference = closingAmount - expectedAmount;
  const pendingCount = entries.filter(e => !e.confirmed).length;
  const isBlind = userRole === "vendedor";

  const openConfirmDialog = (entry: CashEntry) => {
    setConfirmEntry(entry);
    setConfirmFile(null);
    setConfirmDialog(true);
  };

  const handleConfirmEntry = async () => {
    if (!confirmEntry) return;
    if (!confirmFile) { toast.error("Anexe o comprovante para confirmar!"); return; }
    setLoading(true);

    try {
      const receiptUrl = await uploadReceipt(confirmFile, `confirmacao/${confirmEntry.id}-${Date.now()}-${confirmFile.name}`);
      if (!receiptUrl) { setLoading(false); return; }

      const { error } = await supabase
        .from("cash_entries" as any)
        .update({ confirmed: true, receipt_url: receiptUrl })
        .eq("id", confirmEntry.id);

      if (error) { toast.error(error.message); setLoading(false); return; }

      toast.success("Lançamento confirmado!");
      setConfirmDialog(false);
      setConfirmEntry(null);
      setConfirmFile(null);
      if (activeStoreId) fetchRegister(activeStoreId);
    } catch (err: any) {
      toast.error("Erro ao confirmar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnconfirmEntry = async (id: string, reason: string) => {
    setLoading(true);
    const { error } = await supabase.from("cash_entries" as any).update({ confirmed: false, receipt_url: null }).eq("id", id);
    if (error) toast.error(error.message);
    else { 
      logAction("UPDATE_RECORD" as any, "cash_entries", id, { status: "confirmed" }, { status: "unconfirmed", reason }, activeStoreId);
      toast.success("Lançamento desconfirmado!"); 
      if (activeStoreId) fetchRegister(activeStoreId); 
    }
    setLoading(false);
  };

  const handleDeleteEntry = async (id: string, reason: string) => {
    setLoading(true);
    const { error } = await supabase.from("cash_entries" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else { 
      logAction("DELETE_RECORD" as any, "cash_entries", id, null, { reason }, activeStoreId);
      toast.success("Lançamento apagado!"); 
      if (activeStoreId) fetchRegister(activeStoreId); 
    }
    setLoading(false);
  };

  const handleReopenRegister = async (id: string, reason: string) => {
    if (userRole !== "admin") return;
    setLoading(true);
    const { error } = await supabase.from("cash_registers" as any).update({
      status: "open", closed_at: null, closed_by: null, closing_amount: null,
      expected_amount: null, difference: null, difference_reason: null,
    }).eq("id", id);
    if (error) { toast.error("Erro ao reabrir: " + error.message); }
    else {
      toast.success("Caixa reaberto com sucesso!");
      logAction("UPDATE_RECORD" as any, "cash_registers", id, { status: "closed" }, { status: "open", reason }, activeStoreId);
      if (activeStoreId) fetchRegister(activeStoreId);
      setActiveTab("current");
    }
    setLoading(false);
  };

  const handleOpenRegister = async () => {
    if (!user || !activeStoreId) return;
    setLoading(true);
    let receiptUrl: string | null = null;
    if (openForm.receipt) receiptUrl = await uploadReceipt(openForm.receipt, `abertura/${activeStoreId}-${Date.now()}-${openForm.receipt.name}`);

    const { data: reg, error } = await supabase.from("cash_registers" as any).insert({
      store_id: activeStoreId, opened_by: user.id,
      opening_amount: parseFloat(openForm.amount) || 0,
      opening_note: openForm.note || null,
      opening_receipt_url: receiptUrl, status: "open",
    }).select().single();

    if (error) { toast.error(error.message); setLoading(false); return; }

    await supabase.from("cash_entries" as any).insert({
      cash_register_id: (reg as any).id, store_id: activeStoreId,
      type: "abertura", amount: parseFloat(openForm.amount) || 0,
      description: "Abertura de caixa", payment_method: "dinheiro",
      receipt_url: receiptUrl, confirmed: true, created_by: user.id,
    });

    toast.success("Caixa aberto!");
    logAction("LOGIN" as any, "cash_registers", (reg as any).id, null, { store_id: activeStoreId });
    setOpenDialog(false);
    setOpenForm({ amount: "", note: "", receipt: null });
    fetchRegister(activeStoreId);
    setLoading(false);
  };

  const handleCloseRegister = async () => {
    if (!user || !currentRegister) return;
    if (pendingCount > 0) {
      toast.error(`Confirme os ${pendingCount} lançamento(s) pendente(s) antes de fechar o caixa!`);
      return;
    }
    if (!isBlind && Math.abs(difference) > 5 && !closeForm.reason) {
      toast.error("Diferença maior que R$ 5,00 — informe o motivo!");
      return;
    }
    setLoading(true);
    let receiptUrl: string | null = null;
    if (closeForm.receipt) receiptUrl = await uploadReceipt(closeForm.receipt, `fechamento/${activeStoreId}-${Date.now()}-${closeForm.receipt.name}`);

    await supabase.from("cash_registers" as any).update({
      closed_by: user.id, closing_amount: closingAmount,
      expected_amount: expectedAmount, difference,
      difference_reason: closeForm.reason || null,
      closing_note: closeForm.note || null,
      closing_receipt_url: receiptUrl,
      status: "closed", closed_at: new Date().toISOString(),
    }).eq("id", currentRegister.id);

    toast.success("Caixa fechado!");
    logAction("DELETE_RECORD" as any, "cash_registers", currentRegister.id, { status: "open" }, { status: "closed", difference });
    setCloseDialog(false);
    setCloseForm({ amount: "", note: "", reason: "", receipt: null });
    fetchRegister(activeStoreId);
    setLoading(false);
  };

  const handleEntry = async () => {
    if (!user || !currentRegister) return;
    if (!entryForm.amount || !entryForm.description) { toast.error("Preencha todos os campos!"); return; }
    setLoading(true);

    await supabase.from("cash_entries" as any).insert({
      cash_register_id: currentRegister.id, store_id: activeStoreId,
      type: entryForm.type, amount: parseFloat(entryForm.amount) || 0,
      description: entryForm.description, payment_method: entryForm.payment_method,
      receipt_url: null, confirmed: false, created_by: user.id,
    });

    toast.success("Lançamento criado — confirme anexando o comprovante!");
    setEntryDialog(false);
    setEntryForm({ type: "entrada", amount: "", description: "", payment_method: "dinheiro" });
    fetchRegister(activeStoreId);
    setLoading(false);
  };

  const handleSangria = async () => {
    if (!user || !currentRegister) return;
    if (!sangriaForm.amount) { toast.error("Informe o valor da sangria!"); return; }
    setLoading(true);

    await supabase.from("cash_entries" as any).insert({
      cash_register_id: currentRegister.id, store_id: activeStoreId,
      type: "sangria", amount: parseFloat(sangriaForm.amount) || 0,
      description: sangriaForm.description || "Sangria de caixa",
      payment_method: "dinheiro", receipt_url: null,
      confirmed: false, created_by: user.id,
    });

    toast.success("Sangria criada — confirme anexando o comprovante!");
    setSangriaDialog(false);
    setSangriaForm({ amount: "", description: "" });
    fetchRegister(activeStoreId);
    setLoading(false);
  };

  const ReceiptUpload = ({ target, file }: { target: "open" | "close" | "confirm" | null; file: File | null }) => (
    <div className="space-y-2">
      <Label className="text-xs flex items-center gap-1">
        <Receipt className="h-3 w-3" /> Comprovante
        {target !== "open" && <span className="text-destructive ml-0.5">* obrigatório</span>}
      </Label>
      {file ? (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
          <CheckCircle className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs text-primary truncate flex-1">{file.name}</p>
          <Button type="button" className="h-6 text-[10px] bg-transparent text-foreground hover:bg-muted border-0 shadow-none px-2" onClick={() => {
            if (target === "open")    setOpenForm(f => ({ ...f, receipt: null }));
            if (target === "close")   setCloseForm(f => ({ ...f, receipt: null }));
            if (target === "confirm") setConfirmFile(null);
          }}>Remover</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" className="h-10 gap-2 text-xs bg-transparent border border-border text-foreground hover:bg-muted"
            onClick={() => { setActiveTarget(target); cameraInputRef.current?.click(); }}>
            <Camera className="h-4 w-4" /> Tirar Foto
          </Button>
          <Button type="button" className="h-10 gap-2 text-xs bg-transparent border border-border text-foreground hover:bg-muted"
            onClick={() => { setActiveTarget(target); fileInputRef.current?.click(); }}>
            <Upload className="h-4 w-4" /> Galeria
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); e.target.value = ""; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); e.target.value = ""; }} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Caixa</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Visão consolidada e controle financeiro {activeStoreId === "all" ? "(Todas as Lojas)" : ""}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="current" className="flex-1 sm:flex-none">Caixa Atual</TabsTrigger>
          {userRole === "admin" && (
            <TabsTrigger value="all-open" className="flex-1 sm:flex-none">Caixas Abertos</TabsTrigger>
          )}
          {(userRole === "admin" || userPermissions?.gerenciar_financeiro) && (
            <TabsTrigger value="history" className="flex-1 sm:flex-none">Histórico (Admin)</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all-open" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allOpenRegisters.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                Nenhum caixa aberto no momento.
              </div>
            ) : (
              allOpenRegisters.map(reg => (
                <Card key={reg.id} className="overflow-hidden border-primary/20 hover:border-primary/40 transition-all cursor-pointer group"
                  onClick={() => {
                    setCurrentRegister(reg);
                    setActiveTab("current");
                  }}>
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {reg.profiles?.display_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-sm tracking-tight">{reg.profiles?.display_name}</p>
                          <Badge variant="outline" className="text-[10px] py-0 h-4 bg-primary/5 border-primary/20">
                            {reg.stores?.name}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Aberto há</p>
                        <p className="text-xs font-mono">{new Date(reg.opened_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Fundo</p>
                        <p className="font-bold text-sm">{formatCurrency(reg.opening_amount)}</p>
                      </div>
                      <div className="text-right">
                         <Button variant="ghost" size="sm" className="h-7 text-[10px] group-hover:bg-primary group-hover:text-white">
                           Gerenciar <ArrowUpRight className="ml-1 h-3 w-3" />
                         </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="current" className="mt-4 space-y-4">
          {!currentRegister ? (
            <Card className="border-dashed border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <Wallet className="h-8 w-8 text-muted-foreground opacity-50" />
                </div>
                <div className="text-center">
                  <p className="font-semibold">Caixa fechado</p>
                  <p className="text-xs text-muted-foreground mt-1">Abra o caixa para começar a registrar lançamentos</p>
                </div>
                {pendingCount > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-500">
                    <Clock className="h-4 w-4 shrink-0" />
                    {pendingCount} lançamento{pendingCount > 1 ? "s" : ""} pendente aguardando confirmação
                  </div>
                )}
                <Button className="gap-2" onClick={() => setOpenDialog(true)} disabled={!activeStoreId || activeStoreId === "all"}>
                  <Unlock className="h-4 w-4" /> Abrir Caixa
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {pendingCount > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3">
                  <Clock className="h-4 w-4 text-orange-500 shrink-0" />
                  <p className="text-sm text-orange-500 font-medium">{pendingCount} lançamento(s) pendente(s) de confirmação.</p>
                </div>
              )}

              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <Unlock className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-semibold text-sm text-primary">Caixa Aberto</p>
                        <p className="text-xs text-muted-foreground">Desde {new Date(currentRegister.opened_at).toLocaleString("pt-BR")}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="h-9 text-[11px] bg-transparent border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10" onClick={() => setSangriaDialog(true)}>Sangria</Button>
                      <Button className="h-9 text-[11px] bg-transparent border border-border text-foreground hover:bg-muted" onClick={() => setEntryDialog(true)}>Lançamento</Button>
                      <Button className="h-9 text-[11px] bg-destructive hover:bg-destructive/90 text-white" onClick={() => setCloseDialog(true)}>Fechar Caixa</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Fundo Inicial",  value: Number(currentRegister.opening_amount), color: "text-blue-500", visible: true },
                  { label: "Total Entradas", value: totalEntradas,  color: "text-primary", visible: !isBlind },
                  { label: "Total Saídas",   value: totalSaidas,    color: "text-destructive", visible: !isBlind },
                  { label: "Saldo Esperado", value: expectedAmount, color: "text-primary", visible: !isBlind },
                ].map(card => (
                  <Card key={card.label} className="border-border/50">
                    <CardContent className="p-4">
                      <p className="text-[11px] text-muted-foreground uppercase">{card.label}</p>
                      <p className={`font-display text-lg font-bold mt-1 ${card.visible ? card.color : "text-muted-foreground"}`}>
                        {card.visible ? formatCurrency(card.value) : "******"}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {!isBlind && (
                <Card className="border-border/50">
                  <CardContent className="p-4 space-y-2">
                    {["dinheiro","pix","cartao_credito","cartao_debito","transferencia"].map(method => {
                      const ent = confirmedEntries.filter(e => ["entrada","abertura"].includes(e.type) && e.payment_method === method).reduce((s, e) => s + Number(e.amount), 0);
                      const sai = confirmedEntries.filter(e => ["saida","sangria"].includes(e.type) && e.payment_method === method).reduce((s, e) => s + Number(e.amount), 0);
                      if (ent === 0 && sai === 0) return null;
                      return (
                        <div key={method} className="flex justify-between text-xs">
                          <span>{paymentLabels[method]}</span>
                          <span className="font-bold">{formatCurrency(ent - sai)}</span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              <Card className="border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Lançamentos Recentes ({entries.length})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {entries.map(entry => (
                    <div key={entry.id} className="flex items-center justify-between text-xs border rounded-lg p-2 bg-muted/20" onClick={() => !entry.confirmed && openConfirmDialog(entry)}>
                      <div>
                        <p className="font-medium">{entry.description}</p>
                        <p className="text-muted-foreground">{paymentLabels[entry.payment_method || ""] || "Outro"} · {new Date(entry.created_at).toLocaleTimeString("pt-BR")}</p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div className="space-y-1">
                          <p className={`font-bold ${["entrada","abertura"].includes(entry.type) ? "text-primary" : "text-destructive"}`}>
                            {["entrada","abertura"].includes(entry.type) ? "+" : "-"}{formatCurrency(Number(entry.amount))}
                          </p>
                          {!entry.confirmed && <Badge className="text-[8px] bg-orange-500/20 text-orange-600">Pendente</Badge>}
                        </div>
                        {userRole === "admin" && (
                          <div className="flex flex-col gap-1">
                            {entry.confirmed && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-yellow-500" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingAction({ type: "unconfirm", id: entry.id });
                                  setJustification("");
                                  setJustDialogOpened(true);
                                }}>
                                <Unlock className="h-3 w-3" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingAction({ type: "delete", id: entry.id });
                                setJustification("");
                                setJustDialogOpened(true);
                              }}>
                              <Minus className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-4">
          <Card className="border-border/50">
            <CardHeader><CardTitle className="text-sm">Histórico de Fechamentos (Admin)</CardTitle></CardHeader>
            <CardContent>
              {historyLoading ? <p className="text-center py-4">Carregando...</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="border-b">
                      <tr>
                        <th className="py-2">Data</th>
                        <th className="py-2 text-right">Fechamento</th>
                        <th className="py-2 text-right">Diferença</th>
                        <th className="py-2 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {registersHistory.map(reg => (
                        <tr key={reg.id}>
                          <td className="py-2">{new Date(reg.opened_at).toLocaleDateString("pt-BR")}</td>
                          <td className="py-2 text-right font-bold">{formatCurrency(Number(reg.closing_amount))}</td>
                          <td className={`py-2 text-right ${Math.abs(reg.difference || 0) < 0.1 ? "text-primary" : "text-destructive"}`}>
                            {formatCurrency(reg.difference || 0)}
                          </td>
                          <td className="py-2 text-center flex items-center justify-center gap-1">
                            {userRole === "admin" && (
                              <Button className="h-6 text-[9px]" 
                                onClick={() => {
                                  setPendingAction({ type: "reopen", id: reg.id });
                                  setJustification("");
                                  setJustDialogOpened(true);
                                }}>
                                Reabrir
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogTitle>Abrir Caixa</DialogTitle>
          <div className="space-y-4 mt-2">
            <Label className="text-xs">Fundo inicial (R$)</Label>
            <Input type="number" step="0.01" value={openForm.amount} onChange={e => setOpenForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            <ReceiptUpload target="open" file={openForm.receipt} />
            <Button className="w-full" onClick={handleOpenRegister} disabled={loading}>Abrir Caixa</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <DialogContent>
          <DialogTitle>Confirmar Lançamento</DialogTitle>
          <div className="space-y-4 mt-2">
            <p className="text-xs">{confirmEntry?.description} - {confirmEntry && formatCurrency(Number(confirmEntry.amount))}</p>
            <ReceiptUpload target="confirm" file={confirmFile} />
            <Button className="w-full" onClick={handleConfirmEntry} disabled={loading || !confirmFile}>Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent>
          <DialogTitle>Fechar Caixa</DialogTitle>
          <div className="space-y-4 mt-2">
            <Label className="text-xs">Valor contado (R$)</Label>
            <Input type="number" step="0.01" value={closeForm.amount} onChange={e => setCloseForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            {!isBlind && <p className="text-xs">Diferença: {formatCurrency(difference)}</p>}
            {Math.abs(difference) > 5 && <Textarea value={closeForm.reason} onChange={e => setCloseForm(f => ({ ...f, reason: e.target.value }))} placeholder="Motivo da diferença..." />}
            <ReceiptUpload target="close" file={closeForm.receipt} />
            <Button className="w-full bg-destructive" onClick={handleCloseRegister} disabled={loading || !closeForm.amount}>Fechar Caixa</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={entryDialog} onOpenChange={setEntryDialog}>
        <DialogContent>
          <DialogTitle>Novo Lançamento</DialogTitle>
          <div className="space-y-4 mt-2">
             <Select value={entryForm.type} onValueChange={v => setEntryForm(f => ({ ...f, type: v as any }))}>
               <SelectTrigger><SelectValue /></SelectTrigger>
               <SelectContent><SelectItem value="entrada">Entrada</SelectItem><SelectItem value="saida">Saída</SelectItem></SelectContent>
             </Select>
             <Input value={entryForm.description} onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição" />
             <Input type="number" step="0.01" value={entryForm.amount} onChange={e => setEntryForm(f => ({ ...f, amount: e.target.value }))} placeholder="Valor" />
             <Button className="w-full" onClick={handleEntry} disabled={loading}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sangriaDialog} onOpenChange={setSangriaDialog}>
        <DialogContent>
          <DialogTitle>Sangria de Caixa</DialogTitle>
          <div className="space-y-4 mt-2">
            <Input type="number" step="0.01" value={sangriaForm.amount} onChange={e => setSangriaForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            <Input value={sangriaForm.description} onChange={e => setSangriaForm(f => ({ ...f, description: e.target.value }))} placeholder="Motivo" />
            <Button className="w-full bg-yellow-500 hover:bg-yellow-600" onClick={handleSangria} disabled={loading}>Criar Sangria</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={justDialogOpened} onOpenChange={setJustDialogOpened}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Justificar Ação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground italic">
              {pendingAction?.type === "delete" ? "Esta exclusão é permanente." : 
               pendingAction?.type === "unconfirm" ? "Este lançamento voltará a ser pendente." : 
               "O caixa será reaberto."}
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-primary">Campo Obrigatório: Motivo</Label>
              <Input 
                value={justification} 
                onChange={(e) => setJustification(e.target.value)} 
                placeholder="Informe o motivo desta alteração..." 
                required 
                className="h-10"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setJustDialogOpened(false)}>Cancelar</Button>
              <Button 
                variant={pendingAction?.type === "delete" ? "destructive" : "default"}
                className="flex-1" 
                disabled={!justification || loading}
                onClick={async () => {
                  if (!pendingAction) return;
                  if (pendingAction.type === "delete") await handleDeleteEntry(pendingAction.id, justification);
                  if (pendingAction.type === "unconfirm") await handleUnconfirmEntry(pendingAction.id, justification);
                  if (pendingAction.type === "reopen") await handleReopenRegister(pendingAction.id, justification);
                  setJustDialogOpened(false);
                  setPendingAction(null);
                }}
              >
                {loading ? "Processando..." : "Confirmar Ação"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Caixa;
