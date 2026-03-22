import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Store, MapPin, Landmark, Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const statusLabels: Record<string, string> = {
  active: "Ativa", inactive: "Inativa", renovation: "Em reforma", development: "Em desenvolvimento",
};
const statusColors: Record<string, string> = {
  active: "bg-primary/15 text-primary border-primary/20",
  inactive: "bg-muted text-muted-foreground border-border",
  renovation: "bg-accent/15 text-accent border-accent/20",
  development: "bg-secondary text-secondary-foreground border-border",
};

type BankAccount = {
  id: string;
  store_id: string;
  bank_name: string;
  account_type: string;
  agency: string | null;
  account_number: string | null;
  pix_key: string | null;
  holder_name: string | null;
  holder_cpf_cnpj: string | null;
  is_primary: boolean;
};

const Lojas = () => {
  const { userRole } = useAuth();
  const [stores, setStores] = useState<Tables<"stores">[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", status: "active" });
  const [bankForm, setBankForm] = useState({
    bank_name: "", account_type: "corrente", agency: "", account_number: "",
    pix_key: "", holder_name: "", holder_cpf_cnpj: "", is_primary: false,
  });

  const fetchData = async () => {
    const [storesRes, bankRes] = await Promise.all([
      supabase.from("stores").select("*").order("created_at"),
      supabase.from("store_bank_accounts").select("*"),
    ]);
    setStores(storesRes.data ?? []);
    setBankAccounts((bankRes.data as BankAccount[]) ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("stores").insert({
      name: form.name, address: form.address || null, status: form.status,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Loja cadastrada!");
      setDialogOpen(false);
      setForm({ name: "", address: "", status: "active" });
      fetchData();
    }
    setLoading(false);
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId) return;
    setLoading(true);
    const { error } = await supabase.from("store_bank_accounts").insert({
      store_id: selectedStoreId,
      bank_name: bankForm.bank_name,
      account_type: bankForm.account_type,
      agency: bankForm.agency || null,
      account_number: bankForm.account_number || null,
      pix_key: bankForm.pix_key || null,
      holder_name: bankForm.holder_name || null,
      holder_cpf_cnpj: bankForm.holder_cpf_cnpj || null,
      is_primary: bankForm.is_primary,
    } as any);
    if (error) toast.error(error.message);
    else {
      toast.success("Conta bancária cadastrada!");
      setBankDialogOpen(false);
      setBankForm({ bank_name: "", account_type: "corrente", agency: "", account_number: "", pix_key: "", holder_name: "", holder_cpf_cnpj: "", is_primary: false });
      fetchData();
    }
    setLoading(false);
  };

  const deleteBankAccount = async (id: string) => {
    const { error } = await supabase.from("store_bank_accounts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Conta removida!"); fetchData(); }
  };

  const isAdmin = userRole === "admin";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Lojas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Seus pontos comerciais</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-10"><Plus className="h-4 w-4" /> Nova Loja</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Cadastrar Loja</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Loja Centro" required className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Endereço</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua das Flores, 123" className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="inactive">Inativa</SelectItem>
                      <SelectItem value="renovation">Em reforma</SelectItem>
                      <SelectItem value="development">Em desenvolvimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                  {loading ? "Salvando..." : "Cadastrar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {stores.length > 0 ? (
          stores.map((store) => {
            const accounts = bankAccounts.filter((a) => a.store_id === store.id);
            return (
              <Card key={store.id} className="border-border/50 shadow-lg shadow-black/10">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="rounded-lg bg-primary/15 p-2 shrink-0">
                        <Store className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display font-semibold text-sm truncate">{store.name}</h3>
                        {store.address && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{store.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${statusColors[store.status]}`}>
                      {statusLabels[store.status]}
                    </Badge>
                  </div>

                  {/* Bank accounts */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Landmark className="h-3 w-3" /> Contas Bancárias
                      </p>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => { setSelectedStoreId(store.id); setBankDialogOpen(true); }}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Adicionar
                        </Button>
                      )}
                    </div>
                    {accounts.length > 0 ? (
                      accounts.map((acc) => (
                        <div key={acc.id} className="rounded-lg bg-muted/50 p-2.5 text-xs space-y-0.5">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{acc.bank_name} ({acc.account_type})</p>
                            {isAdmin && (
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => deleteBankAccount(acc.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </div>
                          {acc.agency && <p className="text-muted-foreground">Ag: {acc.agency} · CC: {acc.account_number}</p>}
                          {acc.pix_key && <p className="text-muted-foreground">PIX: {acc.pix_key}</p>}
                          {acc.holder_name && <p className="text-muted-foreground">{acc.holder_name}</p>}
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Nenhuma conta cadastrada</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="col-span-full border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Store className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium text-sm">Nenhuma loja cadastrada</p>
              <p className="text-xs mt-1">{isAdmin ? "Cadastre sua primeira loja" : "Peça ao admin para cadastrar"}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bank account dialog */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Cadastrar Conta Bancária</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBankSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Banco</Label>
                <Input value={bankForm.bank_name} onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })} placeholder="Nubank, Itaú..." required className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={bankForm.account_type} onValueChange={(v) => setBankForm({ ...bankForm, account_type: v })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                    <SelectItem value="pagamento">Pagamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Agência</Label>
                <Input value={bankForm.agency} onChange={(e) => setBankForm({ ...bankForm, agency: e.target.value })} placeholder="0001" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Conta</Label>
                <Input value={bankForm.account_number} onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })} placeholder="12345-6" className="h-10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Chave PIX</Label>
              <Input value={bankForm.pix_key} onChange={(e) => setBankForm({ ...bankForm, pix_key: e.target.value })} placeholder="CPF, e-mail, telefone..." className="h-10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Titular</Label>
                <Input value={bankForm.holder_name} onChange={(e) => setBankForm({ ...bankForm, holder_name: e.target.value })} placeholder="Nome do titular" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CPF/CNPJ</Label>
                <Input value={bankForm.holder_cpf_cnpj} onChange={(e) => setBankForm({ ...bankForm, holder_cpf_cnpj: e.target.value })} placeholder="000.000.000-00" className="h-10" />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
              {loading ? "Salvando..." : "Cadastrar Conta"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Lojas;
