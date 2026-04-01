import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Package, ArrowRightLeft, AlertTriangle, Zap, Pencil, Trash2, Store } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { logAction } from "@/utils/auditLogger";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const statusLabels: Record<string, string> = {
  in_stock: "Em estoque", sold: "Vendido", reserved: "Reservado", repair: "Em reparo",
};
const statusColors: Record<string, string> = {
  in_stock: "bg-primary/15 text-primary border-primary/20",
  sold: "bg-muted text-muted-foreground border-border",
  reserved: "bg-accent/15 text-accent border-accent/20",
  repair: "bg-destructive/15 text-destructive border-destructive/20",
};

const categoryLabels: Record<string, string> = {
  carregador: "Carregador", cabo: "Cabo", capa: "Capa", pelicula: "Película",
  fone: "Fone", peca: "Peça", ferramenta: "Ferramenta", outro: "Outro",
};

const LOW_STOCK_THRESHOLD = 3;

type Accessory = {
  id: string; store_id: string; name: string; category: string; brand: string | null;
  quantity: number; min_quantity: number; cost_price: number; sale_price: number | null;
  description: string | null; created_by: string; created_at: string; updated_at: string;
};

const Estoque = () => {
  const { user, userRole, activeStoreId } = useAuth();
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [stores, setStores] = useState<Tables<"stores">[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accDialogOpen, setAccDialogOpen] = useState(false);
  const [editAcc, setEditAcc] = useState<Accessory | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transferProduct, setTransferProduct] = useState<Tables<"products"> | null>(null);
  const [transferStoreId, setTransferStoreId] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editProductOpen, setEditProductOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Tables<"products"> | null>(null);
  const [editForm, setEditForm] = useState({ name: "", brand: "iPhone", model: "", imei: "", serial_number: "", cost_price: "", sale_price: "", store_id: "", condition: "used", color: "", capacity: "" });
  const [historyProduct, setHistoryProduct] = useState<Tables<"products"> | null>(null);
  const [productHistory, setProductHistory] = useState<any[]>([]);

  const [form, setForm] = useState({
    name: "", brand: "iPhone" as string, model: "", imei: "",
    serial_number: "", cost_price: "", sale_price: "", store_id: "",
    product_type: "celular", condition: "used", color: "", capacity: "",
  });

  const [accForm, setAccForm] = useState({
    name: "", category: "outro", brand: "", quantity: "0", min_quantity: "5",
    cost_price: "", sale_price: "", store_id: "", description: "",
  });

  const fetchData = async () => {
    if (!activeStoreId) return;
    setLoading(true);
    
    let productsQuery = supabase.from("products").select("*");
    let accQuery = supabase.from("accessories" as any).select("*");

    if (activeStoreId !== "all") {
      productsQuery = productsQuery.eq("store_id", activeStoreId);
      accQuery = accQuery.eq("store_id", activeStoreId);
    }

    const [productsRes, storesRes, accRes] = await Promise.all([
      productsQuery.order("created_at", { ascending: false }),
      supabase.from("stores").select("*"),
      accQuery.order("created_at", { ascending: false }),
    ]);

    setProducts(productsRes.data ?? []);
    setStores(storesRes.data ?? []);
    setAccessories((accRes.data ?? []) as unknown as Accessory[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [activeStoreId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from("products").insert({
      name: form.name, brand: form.brand, model: form.model,
      imei: form.imei || null, serial_number: form.serial_number || null,
      cost_price: parseFloat(form.cost_price),
      sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
      store_id: activeStoreId, created_by: user.id,
      product_type: form.product_type, condition: form.condition,
      color: form.color || null, capacity: form.capacity || null,
    }).select().single();
    
    if (error) {
      toast.error(error.message.includes("imei") ? "IMEI já cadastrado!" : error.message);
    } else if (data) {
      await supabase.from("product_history" as any).insert({
        product_id: data.id, action: "Entrada inicial", new_cost: data.cost_price, created_by: user.id,
      });
      toast.success("Aparelho cadastrado!");
      setDialogOpen(false);
      setForm({ name: "", brand: "iPhone", model: "", imei: "", serial_number: "", cost_price: "", sale_price: "", store_id: "", product_type: "celular", condition: "used", color: "", capacity: "" });
      fetchData();
    }
    setLoading(false);
  };

  const loadHistory = async (p: Tables<"products">) => {
    setHistoryProduct(p);
    const { data } = await supabase.from("product_history" as any).select(`*, created_by_profile:profiles!product_history_created_by_fkey(display_name)`).eq("product_id", p.id).order("created_at", { ascending: false });
    setProductHistory(data ?? []);
    setHistoryOpen(true);
  };

  const handleAccSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const payload = {
      name: accForm.name, category: accForm.category, brand: accForm.brand || null,
      quantity: parseInt(accForm.quantity), min_quantity: parseInt(accForm.min_quantity),
      cost_price: parseFloat(accForm.cost_price),
      sale_price: accForm.sale_price ? parseFloat(accForm.sale_price) : null,
      store_id: activeStoreId, description: accForm.description || null,
      created_by: user.id,
    };

    let error;
    if (editAcc) {
      ({ error } = await supabase.from("accessories" as any).update(payload).eq("id", editAcc.id));
    } else {
      ({ error } = await supabase.from("accessories" as any).insert(payload));
    }

    if (error) {
      toast.error(error.message);
    } else {
      logAction(editAcc ? "CREATE_RECORD" : "CREATE_RECORD", "accessories", editAcc ? editAcc.id : "new", editAcc, payload, payload.store_id);
      toast.success(editAcc ? "Acessório atualizado!" : "Acessório cadastrado!");
      setAccDialogOpen(false);
      setEditAcc(null);
      setAccForm({ name: "", category: "outro", brand: "", quantity: "0", min_quantity: "5", cost_price: "", sale_price: "", store_id: "", description: "" });
      fetchData();
    }
    setLoading(false);
  };

  const handleDeleteAcc = async (acc: Accessory) => {
    if (userRole !== "admin") return;
    const { error } = await supabase.from("accessories" as any).delete().eq("id", acc.id);
    if (error) toast.error(error.message);
    else { 
      logAction("DELETE_RECORD", "accessories", acc.id, acc, null, acc.store_id);
      toast.success("Acessório removido!"); 
      fetchData(); 
    }
  };

  const handleTransfer = async () => {
    if (!transferProduct || !transferStoreId || !user) return;
    setLoading(true);
    const { error } = await supabase.from("products").update({ store_id: transferStoreId } as any).eq("id", transferProduct.id);
    if (error) {
      toast.error("Erro na transferência: " + error.message);
    } else {
      logAction("TRANSFER_STOCK", "products", transferProduct.id, transferProduct, { ...transferProduct, store_id: transferStoreId }, transferStoreId);
      const storeMap = new Map(stores.map(s => [s.id, s.name]));
      await supabase.from("transactions").insert({
        type: "income", amount: 0,
        description: `Transferência: ${transferProduct.name} de ${storeMap.get(transferProduct.store_id)} → ${storeMap.get(transferStoreId)}`,
        store_id: transferStoreId, product_id: transferProduct.id, created_by: user.id,
      });
      await supabase.from("product_history" as any).insert({
        product_id: transferProduct.id, action: "Transferência de Loja", 
        notes: `De: ${storeMap.get(transferProduct.store_id)} → Para: ${storeMap.get(transferStoreId)}`,
        created_by: user.id,
      });
      toast.success("Produto transferido!");
      setTransferDialogOpen(false);
      setTransferProduct(null);
      setTransferStoreId("");
      fetchData();
    }
    setLoading(false);
  };

  const storeMap = new Map(stores.map((s) => [s.id, s.name]));

  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase();
    return (p.name.toLowerCase().includes(q) || p.model.toLowerCase().includes(q) || (p.imei && p.imei.includes(search)));
  });

  const filteredAccessories = accessories.filter((a) => {
    const q = search.toLowerCase();
    return (a.name.toLowerCase().includes(q) || (a.brand && a.brand.toLowerCase().includes(q)));
  });

  const inStock = filteredProducts.filter((p) => p.status === "in_stock");
  const totalInvestedProducts = inStock.reduce((sum, p) => sum + Number(p.cost_price), 0);
  const totalInvestedAcc = filteredAccessories.reduce((sum, a) => sum + Number(a.cost_price) * a.quantity, 0);

  const storeStockCounts: Record<string, number> = {};
  products.filter(p => p.status === "in_stock").forEach(p => {
    storeStockCounts[p.store_id] = (storeStockCounts[p.store_id] || 0) + 1;
  });
  const lowStockStores = stores.filter(s => (storeStockCounts[s.id] || 0) <= LOW_STOCK_THRESHOLD);
  const lowStockAcc = accessories.filter(a => a.quantity <= a.min_quantity);

  const openEditProduct = (p: Tables<"products">) => {
    setEditProduct(p);
    setEditForm({
      name: p.name,
      brand: p.brand,
      model: p.model,
      imei: p.imei || "",
      serial_number: p.serial_number || "",
      cost_price: String(p.cost_price),
      sale_price: p.sale_price ? String(p.sale_price) : "",
      store_id: p.store_id,
      condition: p.condition || "used",
      color: p.color || "",
      capacity: p.capacity || "",
    });
    setEditProductOpen(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct || !user) return;
    setLoading(true);
    const oldCost = Number(editProduct.cost_price);
    const newCost = parseFloat(editForm.cost_price);
    const updatePayload = {
      name: editForm.name,
      brand: editForm.brand,
      model: editForm.model,
      imei: editForm.imei || null,
      serial_number: editForm.serial_number || null,
      cost_price: newCost,
      sale_price: editForm.sale_price ? parseFloat(editForm.sale_price) : null,
      store_id: editForm.store_id,
      condition: editForm.condition,
      color: editForm.color || null,
      capacity: editForm.capacity || null,
    };
    const { error } = await supabase.from("products").update(updatePayload as any).eq("id", editProduct.id);

    if (error) {
      toast.error(error.message);
    } else {
      logAction("UPDATE_RECORD", "products", editProduct.id, editProduct, updatePayload, editForm.store_id);
      if (oldCost !== newCost) {
        await supabase.from("product_history" as any).insert({
          product_id: editProduct.id,
          action: "Edição",
          old_cost: oldCost,
          new_cost: newCost,
          notes: "Dados do aparelho atualizados",
          created_by: user.id,
        });
      }
      toast.success("Aparelho atualizado!");
      setEditProductOpen(false);
      setEditProduct(null);
      fetchData();
    }
    setLoading(false);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este aparelho? Esta ação não pode ser desfeita.")) return;
    const productToDelete = products.find(p => p.id === id);
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { 
      logAction("DELETE_RECORD", "products", id, productToDelete, null, productToDelete?.store_id);
      toast.success("Aparelho removido!"); fetchData(); 
    }
  };

  const openAccDialog = (acc?: Accessory) => {
    if (acc) {
      setEditAcc(acc);
      setAccForm({
        name: acc.name, category: acc.category, brand: acc.brand || "",
        quantity: String(acc.quantity), min_quantity: String(acc.min_quantity),
        cost_price: String(acc.cost_price), sale_price: acc.sale_price ? String(acc.sale_price) : "",
        store_id: acc.store_id, description: acc.description || "",
      });
    } else {
      setEditAcc(null);
      setAccForm({ name: "", category: "outro", brand: "", quantity: "0", min_quantity: "5", cost_price: "", sale_price: "", store_id: "", description: "" });
    }
    setAccDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Estoque</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {inStock.length} aparelhos · {filteredAccessories.length} acessórios · {formatCurrency(totalInvestedProducts + totalInvestedAcc)} investido
            {activeStoreId === "all" && " (Global)"}
          </p>
        </div>
        {userRole === "admin" && (
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <Select value={activeStoreId} onValueChange={(v) => {
              const s = stores.find(s => s.id === v);
              window.dispatchEvent(new CustomEvent("store-changed", { detail: { id: v, name: s?.name || "Todas as lojas" } }));
            }}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Selecionar Loja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Lojas</SelectItem>
                {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Alertas */}
      {(lowStockStores.length > 0 || lowStockAcc.length > 0) && (
        <div className="space-y-2">
          {lowStockStores.map(s => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs"><span className="font-semibold">{s.name}</span>: estoque baixo de aparelhos — apenas <span className="font-bold text-destructive">{storeStockCounts[s.id] || 0}</span></p>
            </div>
          ))}
          {lowStockAcc.map(a => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
              <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
              <p className="text-xs"><span className="font-semibold">{a.name}</span>: apenas <span className="font-bold text-yellow-500">{a.quantity}</span> unidades (mín: {a.min_quantity})</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar no estoque da loja..." className="pl-9 h-10" />
        </div>
      </div>

      <Tabs defaultValue="aparelhos">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="aparelhos" className="flex-1 sm:flex-none gap-2">
            <Package className="h-4 w-4" /> Aparelhos ({inStock.length})
          </TabsTrigger>
          <TabsTrigger value="acessorios" className="flex-1 sm:flex-none gap-2">
            <Zap className="h-4 w-4" /> Acessórios ({filteredAccessories.length})
          </TabsTrigger>
        </TabsList>

        {/* ABA APARELHOS */}
        <TabsContent value="aparelhos" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 h-10" disabled={activeStoreId === "all"}>
                  <Plus className="h-4 w-4" /> Novo Aparelho
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-display">Cadastrar Aparelho</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nome</Label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="iPhone 13 128GB" required className="h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Marca</Label>
                      <Select value={form.brand} onValueChange={(v) => setForm({ ...form, brand: v })}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="iPhone">iPhone</SelectItem>
                          <SelectItem value="Xiaomi">Xiaomi</SelectItem>
                          <SelectItem value="Samsung">Samsung</SelectItem>
                          <SelectItem value="Motorola">Motorola</SelectItem>
                          <SelectItem value="Outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Modelo</Label>
                      <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="A2633" required className="h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Condição</Label>
                      <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">Novo</SelectItem>
                          <SelectItem value="used">Usado</SelectItem>
                          <SelectItem value="refurbished">Recondicionado</SelectItem>
                          <SelectItem value="seminovo_americano">Seminovo (Americano)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Capacidade</Label>
                      <Input value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="128GB" className="h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cor</Label>
                      <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Preto" className="h-10" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">IMEI</Label>
                    <Input value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} placeholder="Obrigatório para celulares" className="h-10" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Custo (R$)</Label>
                      <Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} placeholder="2500.00" required className="h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Venda (R$)</Label>
                      <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} placeholder="3500.00" className="h-10" />
                    </div>
                  </div>
                  <div className="space-y-1.5 grayscale opacity-60 pointer-events-none">
                    <Label className="text-xs">Loja (Vinculada à Loja Ativa)</Label>
                    <Input value={storeMap.get(activeStoreId || "") || ""} readOnly className="h-10" />
                  </div>
                  <Button type="submit" className="w-full h-11 font-semibold" disabled={loading || !activeStoreId}>
                    {loading ? "Salvando..." : "Cadastrar Aparelho"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {filteredProducts.length > 0 ? (
            <div className="space-y-2">
              {filteredProducts.map((p) => {
                const margin = p.sale_price ? Number(p.sale_price) - Number(p.cost_price) : null;
                const conditionLabel = p.condition === "new" ? "Novo" : p.condition === "refurbished" ? "Recondicionado" : p.condition === "seminovo_americano" ? "Seminovo (Americano)" : "Usado";
                return (
                  <Card key={p.id} className="border-border/50 shadow-lg shadow-black/10">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">{p.name}</p>
                            <Badge className={`text-[10px] ${statusColors[p.status]}`}>
                              {statusLabels[p.status] || p.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {p.brand} · {p.model} {p.capacity && `· ${p.capacity}`} {p.color && `· ${p.color}`} · {conditionLabel}
                            {p.imei && ` · IMEI: ${p.imei}`}
                          </p>
                          {activeStoreId === "all" && (
                            <Badge variant="outline" className="text-[9px] mt-1 bg-muted/50 border-primary/20 text-primary">
                              {storeMap.get(p.store_id) || "—"}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <div>
                            <p className="text-xs text-muted-foreground">Custo</p>
                            <p className="font-display font-bold text-sm">{formatCurrency(Number(p.cost_price))}</p>
                            {margin !== null && (
                              <p className={`text-xs font-medium mt-0.5 ${margin >= 0 ? "text-primary" : "text-destructive"}`}>
                                {margin >= 0 ? "+" : ""}{formatCurrency(margin)}
                              </p>
                            )}
                          </div>
                          {p.status === "in_stock" && stores.length > 1 && (
                            <Button className="h-7 text-[10px] gap-1 bg-transparent text-muted-foreground hover:bg-muted"
                              onClick={() => { setTransferProduct(p); setTransferDialogOpen(true); }}>
                              <ArrowRightLeft className="h-3 w-3" /> Transferir
                            </Button>
                          )}
                          <Button className="h-7 text-[10px] gap-1 bg-transparent text-muted-foreground hover:bg-muted" onClick={() => loadHistory(p)}>
                            Ver Histórico
                          </Button>
                          <div className="flex gap-1 mt-1">
                            <Button className="h-7 w-7 p-0 bg-transparent text-foreground hover:bg-muted" onClick={() => openEditProduct(p)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button className="h-7 w-7 p-0 bg-transparent text-destructive hover:bg-destructive/10" onClick={() => handleDeleteProduct(p.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Package className="h-10 w-10 mb-3 opacity-30" />
                <p className="font-medium text-sm">Nenhum aparelho encontrado</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ABA ACESSÓRIOS */}
        <TabsContent value="acessorios" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button className="gap-2 h-10" onClick={() => openAccDialog()} disabled={activeStoreId === "all"}>
              <Plus className="h-4 w-4" /> Novo Acessório
            </Button>
          </div>

          {filteredAccessories.length > 0 ? (
            <div className="space-y-2">
              {filteredAccessories.map((a) => {
                const isLow = a.quantity <= a.min_quantity;
                const margin = a.sale_price ? Number(a.sale_price) - Number(a.cost_price) : null;
                return (
                  <Card key={a.id} className={`border-border/50 shadow-lg shadow-black/10 ${isLow ? "border-yellow-500/30" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{a.name}</p>
                            <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                              {categoryLabels[a.category] || a.category}
                            </Badge>
                            {isLow && (
                              <Badge className="text-[10px] bg-yellow-500/15 text-yellow-500 border-yellow-500/20">
                                Estoque baixo
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {a.brand && `${a.brand} · `}
                            {activeStoreId === "all" ? (
                              <Badge variant="outline" className="text-[9px] bg-muted/50 border-primary/20 text-primary">
                                {storeMap.get(a.store_id) || "—"}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">{storeMap.get(a.store_id) || "—"}</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{a.description}</p>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <div>
                            <p className="text-xs text-muted-foreground">Qtd</p>
                            <p className={`font-display font-bold text-lg ${isLow ? "text-yellow-500" : "text-primary"}`}>{a.quantity}</p>
                            <p className="text-xs text-muted-foreground">Custo: {formatCurrency(Number(a.cost_price))}</p>
                            {margin !== null && (
                              <p className={`text-xs font-medium ${margin >= 0 ? "text-primary" : "text-destructive"}`}>
                                +{formatCurrency(margin)}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button className="h-7 w-7 p-0 bg-transparent text-foreground hover:bg-muted" onClick={() => openAccDialog(a)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {userRole === "admin" && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" 
                                onClick={() => handleDeleteAcc(a)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Zap className="h-10 w-10 mb-3 opacity-30" />
                <p className="font-medium text-sm">Nenhum acessório encontrado</p>
                <p className="text-xs mt-1">Cadastre carregadores, cabos, capas e peças</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog Acessório */}
      <Dialog open={accDialogOpen} onOpenChange={(o) => { setAccDialogOpen(o); if (!o) setEditAcc(null); }}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editAcc ? "Editar Acessório" : "Cadastrar Acessório"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAccSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} placeholder="Carregador 20W" required className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Select value={accForm.category} onValueChange={(v) => setAccForm({ ...accForm, category: v })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="carregador">Carregador</SelectItem>
                    <SelectItem value="cabo">Cabo</SelectItem>
                    <SelectItem value="capa">Capa</SelectItem>
                    <SelectItem value="pelicula">Película</SelectItem>
                    <SelectItem value="fone">Fone</SelectItem>
                    <SelectItem value="peca">Peça de Reposição</SelectItem>
                    <SelectItem value="ferramenta">Ferramenta</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Marca</Label>
                <Input value={accForm.brand} onChange={(e) => setAccForm({ ...accForm, brand: e.target.value })} placeholder="Apple, Samsung..." className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Input value={accForm.description} onChange={(e) => setAccForm({ ...accForm, description: e.target.value })} placeholder="USB-C 1m..." className="h-10" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Quantidade</Label>
                <Input type="number" min="0" value={accForm.quantity} onChange={(e) => setAccForm({ ...accForm, quantity: e.target.value })} required className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Qtd Mínima (alerta)</Label>
                <Input type="number" min="0" value={accForm.min_quantity} onChange={(e) => setAccForm({ ...accForm, min_quantity: e.target.value })} required className="h-10" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Custo (R$)</Label>
                <Input type="number" step="0.01" value={accForm.cost_price} onChange={(e) => setAccForm({ ...accForm, cost_price: e.target.value })} placeholder="25.00" required className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Venda (R$)</Label>
                <Input type="number" step="0.01" value={accForm.sale_price} onChange={(e) => setAccForm({ ...accForm, sale_price: e.target.value })} placeholder="50.00" className="h-10" />
              </div>
            </div>
            <div className="space-y-1.5 grayscale opacity-60 pointer-events-none">
              <Label className="text-xs">Loja (Vinculada à Loja Ativa)</Label>
              <Input value={storeMap.get(activeStoreId || "") || ""} readOnly className="h-10" />
            </div>
            <Button type="submit" className="w-full h-11 font-semibold" disabled={loading || !activeStoreId}>
              {loading ? "Salvando..." : editAcc ? "Salvar Alterações" : "Cadastrar Acessório"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transfer dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={(open) => { setTransferDialogOpen(open); if (!open) { setTransferProduct(null); setTransferStoreId(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" /> Transferir Aparelho
            </DialogTitle>
          </DialogHeader>
          {transferProduct && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                <p className="font-semibold">{transferProduct.name}</p>
                <p className="text-muted-foreground">{transferProduct.brand} · {transferProduct.model}</p>
                <p className="text-muted-foreground">Loja atual: <span className="font-medium text-foreground">{storeMap.get(transferProduct.store_id)}</span></p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Transferir para</Label>
                <Select value={transferStoreId} onValueChange={setTransferStoreId}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Selecione a loja destino" /></SelectTrigger>
                  <SelectContent>
                    {stores.filter(s => s.id !== transferProduct.store_id).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleTransfer} className="w-full h-11 font-semibold" disabled={loading || !transferStoreId}>
                {loading ? "Transferindo..." : "Confirmar Transferência"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <Dialog open={editProductOpen} onOpenChange={setEditProductOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Editar Aparelho</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateProduct} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Nome</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required className="h-10" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Marca</Label><Select value={editForm.brand} onValueChange={v => setEditForm(f => ({ ...f, brand: v }))}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="iPhone">iPhone</SelectItem><SelectItem value="Xiaomi">Xiaomi</SelectItem><SelectItem value="Samsung">Samsung</SelectItem><SelectItem value="Motorola">Motorola</SelectItem><SelectItem value="Outro">Outro</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Modelo</Label><Input value={editForm.model} onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))} required className="h-10" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Condição</Label><Select value={editForm.condition} onValueChange={v => setEditForm(f => ({ ...f, condition: v }))}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">Novo</SelectItem><SelectItem value="used">Usado</SelectItem><SelectItem value="refurbished">Recondicionado</SelectItem><SelectItem value="seminovo_americano">Seminovo (Americano)</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Capacidade</Label><Input value={editForm.capacity} onChange={e => setEditForm(f => ({ ...f, capacity: e.target.value }))} placeholder="128GB" className="h-10" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Cor</Label><Input value={editForm.color} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))} placeholder="Preto" className="h-10" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">IMEI</Label><Input value={editForm.imei} onChange={e => setEditForm(f => ({ ...f, imei: e.target.value }))} className="h-10" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Custo (R$)</Label><Input type="number" step="0.01" value={editForm.cost_price} onChange={e => setEditForm(f => ({ ...f, cost_price: e.target.value }))} required className="h-10" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Venda (R$)</Label><Input type="number" step="0.01" value={editForm.sale_price} onChange={e => setEditForm(f => ({ ...f, sale_price: e.target.value }))} className="h-10" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Loja</Label><Select value={editForm.store_id} onValueChange={v => setEditForm(f => ({ ...f, store_id: v }))}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>{loading ? "Salvando..." : "Salvar Alterações"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Product History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Histórico do Aparelho</DialogTitle>
          </DialogHeader>
          {historyProduct && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                <p className="font-semibold">{historyProduct.name}</p>
                <p className="text-muted-foreground">{historyProduct.imei && `IMEI: ${historyProduct.imei}`} · Custo: {formatCurrency(Number(historyProduct.cost_price))}</p>
              </div>
              <div className="space-y-3 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {productHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center">Nenhum registro encontrado.</p>
                ) : productHistory.map((h, i) => (
                  <div key={h.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full border border-primary bg-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow"></div>
                    <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.25rem)] bg-card p-3 rounded border shadow-sm text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-primary">{h.action}</span>
                        <span className="text-muted-foreground text-[10px]">{new Date(h.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="text-muted-foreground">
                        {h.notes && <p className="mb-0.5">{h.notes}</p>}
                        {h.old_cost !== null && h.new_cost !== null && (
                          <p>Custo: <span className="line-through">{formatCurrency(h.old_cost)}</span> → <span className="font-medium text-foreground">{formatCurrency(h.new_cost)}</span></p>
                        )}
                        {(h.old_cost === null && h.new_cost !== null) && (
                          <p>Custo: <span className="font-medium text-foreground">{formatCurrency(h.new_cost)}</span></p>
                        )}
                      </div>
                      <div className="text-[10px] font-medium text-muted-foreground mt-2 border-t pt-1 border-border/50">
                        {h.created_by_profile?.display_name || "Sistema"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Estoque;
