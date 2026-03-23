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
import { Plus, Search, Package, ArrowRightLeft, AlertTriangle, Zap, Pencil, Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

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
  const { user } = useAuth();
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [stores, setStores] = useState<Tables<"stores">[]>([]);
  const [search, setSearch] = useState("");
  const [filterStore, setFilterStore] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accDialogOpen, setAccDialogOpen] = useState(false);
  const [editAcc, setEditAcc] = useState<Accessory | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transferProduct, setTransferProduct] = useState<Tables<"products"> | null>(null);
  const [transferStoreId, setTransferStoreId] = useState("");

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
    const [productsRes, storesRes, accRes] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("stores").select("*"),
      supabase.from("accessories" as any).select("*").order("created_at", { ascending: false }),
    ]);
    setProducts(productsRes.data ?? []);
    setStores(storesRes.data ?? []);
    setAccessories((accRes.data ?? []) as unknown as Accessory[]);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("products").insert({
      name: form.name, brand: form.brand, model: form.model,
      imei: form.imei || null, serial_number: form.serial_number || null,
      cost_price: parseFloat(form.cost_price),
      sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
      store_id: form.store_id, created_by: user.id,
      product_type: form.product_type, condition: form.condition,
      color: form.color || null, capacity: form.capacity || null,
    });
    if (error) {
      toast.error(error.message.includes("imei") ? "IMEI já cadastrado!" : error.message);
    } else {
      toast.success("Aparelho cadastrado!");
      setDialogOpen(false);
      setForm({ name: "", brand: "iPhone", model: "", imei: "", serial_number: "", cost_price: "", sale_price: "", store_id: "", product_type: "celular", condition: "used", color: "", capacity: "" });
      fetchData();
    }
    setLoading(false);
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
      store_id: accForm.store_id, description: accForm.description || null,
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
      toast.success(editAcc ? "Acessório atualizado!" : "Acessório cadastrado!");
      setAccDialogOpen(false);
      setEditAcc(null);
      setAccForm({ name: "", category: "outro", brand: "", quantity: "0", min_quantity: "5", cost_price: "", sale_price: "", store_id: "", description: "" });
      fetchData();
    }
    setLoading(false);
  };

  const handleDeleteAcc = async (id: string) => {
    const { error } = await supabase.from("accessories" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Acessório removido!"); fetchData(); }
  };

  const handleTransfer = async () => {
    if (!transferProduct || !transferStoreId || !user) return;
    setLoading(true);
    const { error } = await supabase.from("products").update({ store_id: transferStoreId } as any).eq("id", transferProduct.id);
    if (error) {
      toast.error("Erro na transferência: " + error.message);
    } else {
      const storeMap = new Map(stores.map(s => [s.id, s.name]));
      await supabase.from("transactions").insert({
        type: "income", amount: 0,
        description: `Transferência: ${transferProduct.name} de ${storeMap.get(transferProduct.store_id)} → ${storeMap.get(transferStoreId)}`,
        store_id: transferStoreId, product_id: transferProduct.id, created_by: user.id,
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
    return (p.name.toLowerCase().includes(q) || p.model.toLowerCase().includes(q) || (p.imei && p.imei.includes(search)))
      && (filterStore === "all" || p.store_id === filterStore);
  });

  const filteredAccessories = accessories.filter((a) => {
    const q = search.toLowerCase();
    return (a.name.toLowerCase().includes(q) || (a.brand && a.brand.toLowerCase().includes(q)))
      && (filterStore === "all" || a.store_id === filterStore);
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
          </p>
        </div>
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

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 h-10" />
        </div>
        <Select value={filterStore} onValueChange={setFilterStore}>
          <SelectTrigger className="w-full sm:w-44 h-10"><SelectValue placeholder="Todas as lojas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as lojas</SelectItem>
            {stores.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
          </SelectContent>
        </Select>
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
                <Button className="gap-2 h-10"><Plus className="h-4 w-4" /> Novo Aparelho</Button>
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
                  <div className="space-y-1.5">
                    <Label className="text-xs">Loja</Label>
                    <Select value={form.store_id} onValueChange={(v) => setForm({ ...form, store_id: v })}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                      <SelectContent>
                        {stores.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full h-11 font-semibold" disabled={loading || !form.store_id}>
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
                const conditionLabel = p.condition === "new" ? "Novo" : p.condition === "refurbished" ? "Recondicionado" : "Usado";
                return (
                  <Card key={p.id} className="border-border/50 shadow-lg shadow-black/10">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">{p.name}</p>
                            <Badge variant="outline" className={`text-[10px] ${statusColors[p.status]}`}>
                              {statusLabels[p.status] || p.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {p.brand} · {p.model} {p.capacity && `· ${p.capacity}`} {p.color && `· ${p.color}`} · {conditionLabel}
                            {p.imei && ` · IMEI: ${p.imei}`}
                          </p>
                          <p className="text-xs text-muted-foreground">{storeMap.get(p.store_id) || "—"}</p>
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
                            <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 text-muted-foreground"
                              onClick={() => { setTransferProduct(p); setTransferDialogOpen(true); }}>
                              <ArrowRightLeft className="h-3 w-3" /> Transferir
                            </Button>
                          )}
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
            <Button className="gap-2 h-10" onClick={() => openAccDialog()}>
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
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                              {categoryLabels[a.category] || a.category}
                            </Badge>
                            {isLow && (
                              <Badge variant="outline" className="text-[10px] bg-yellow-500/15 text-yellow-500 border-yellow-500/20">
                                Estoque baixo
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {a.brand && `${a.brand} · `}{storeMap.get(a.store_id) || "—"}
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
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAccDialog(a)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteAcc(a.id)}>
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
            <div className="space-y-1.5">
              <Label className="text-xs">Loja</Label>
              <Select value={accForm.store_id} onValueChange={(v) => setAccForm({ ...accForm, store_id: v })}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full h-11 font-semibold" disabled={loading || !accForm.store_id}>
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
    </div>
  );
};

export default Estoque;
