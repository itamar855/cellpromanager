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
import { Plus, Search, Package, ArrowRightLeft, AlertTriangle } from "lucide-react";
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

const LOW_STOCK_THRESHOLD = 3;

const Estoque = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [stores, setStores] = useState<Tables<"stores">[]>([]);
  const [search, setSearch] = useState("");
  const [filterStore, setFilterStore] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transferProduct, setTransferProduct] = useState<Tables<"products"> | null>(null);
  const [transferStoreId, setTransferStoreId] = useState("");

  const [form, setForm] = useState({
    name: "", brand: "iPhone" as string, model: "", imei: "",
    serial_number: "", cost_price: "", sale_price: "", store_id: "",
    product_type: "celular", condition: "used", color: "", capacity: "",
  });

  const fetchData = async () => {
    const [productsRes, storesRes] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("stores").select("*"),
    ]);
    setProducts(productsRes.data ?? []);
    setStores(storesRes.data ?? []);
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
      toast.success("Produto cadastrado!");
      setDialogOpen(false);
      setForm({ name: "", brand: "iPhone", model: "", imei: "", serial_number: "", cost_price: "", sale_price: "", store_id: "", product_type: "celular", condition: "used", color: "", capacity: "" });
      fetchData();
    }
    setLoading(false);
  };

  const handleTransfer = async () => {
    if (!transferProduct || !transferStoreId || !user) return;
    setLoading(true);
    const { error } = await supabase
      .from("products")
      .update({ store_id: transferStoreId } as any)
      .eq("id", transferProduct.id);

    if (error) {
      toast.error("Erro na transferência: " + error.message);
    } else {
      // Log the transfer as a transaction
      const storeMap = new Map(stores.map(s => [s.id, s.name]));
      await supabase.from("transactions").insert({
        type: "income",
        amount: 0,
        description: `Transferência: ${transferProduct.name} de ${storeMap.get(transferProduct.store_id)} → ${storeMap.get(transferStoreId)}`,
        store_id: transferStoreId,
        product_id: transferProduct.id,
        created_by: user.id,
      });
      toast.success("Produto transferido com sucesso!");
      setTransferDialogOpen(false);
      setTransferProduct(null);
      setTransferStoreId("");
      fetchData();
    }
    setLoading(false);
  };

  const storeMap = new Map(stores.map((s) => [s.id, s.name]));
  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(q) || p.model.toLowerCase().includes(q) || (p.imei && p.imei.includes(search));
    return matchesSearch && (filterStore === "all" || p.store_id === filterStore);
  });
  const inStock = filtered.filter((p) => p.status === "in_stock");
  const totalInvested = inStock.reduce((sum, p) => sum + Number(p.cost_price), 0);

  // Low stock alerts per store
  const storeStockCounts: Record<string, number> = {};
  products.filter(p => p.status === "in_stock").forEach(p => {
    storeStockCounts[p.store_id] = (storeStockCounts[p.store_id] || 0) + 1;
  });
  const lowStockStores = stores.filter(s => (storeStockCounts[s.id] || 0) <= LOW_STOCK_THRESHOLD);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Estoque</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {inStock.length} aparelhos · {formatCurrency(totalInvested)}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 h-10"><Plus className="h-4 w-4" /> Novo Produto</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Cadastrar Produto</DialogTitle>
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
                  <Label className="text-xs">Tipo</Label>
                  <Select value={form.product_type} onValueChange={(v) => setForm({ ...form, product_type: v })}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="celular">Celular</SelectItem>
                      <SelectItem value="acessorio">Acessório</SelectItem>
                      <SelectItem value="peca">Peça de Reposição</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                <div className="space-y-1.5">
                  <Label className="text-xs">Capacidade</Label>
                  <Input value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="128GB" className="h-10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Cor</Label>
                  <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Preto" className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">IMEI</Label>
                  <Input value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} placeholder="Obrigatório p/ celulares" className="h-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nº de Série</Label>
                <Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} placeholder="Opcional" className="h-10" />
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
                {loading ? "Salvando..." : "Cadastrar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Low stock alerts */}
      {lowStockStores.length > 0 && (
        <div className="space-y-2">
          {lowStockStores.map(s => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs">
                <span className="font-semibold">{s.name}</span>: estoque baixo — apenas{" "}
                <span className="font-bold text-destructive">{storeStockCounts[s.id] || 0}</span> produtos em estoque
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome, modelo ou IMEI..." className="pl-9 h-10" />
        </div>
        <Select value={filterStore} onValueChange={setFilterStore}>
          <SelectTrigger className="w-full sm:w-44 h-10"><SelectValue placeholder="Todas as lojas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as lojas</SelectItem>
            {stores.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {/* Product cards */}
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((p) => {
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
                      <p className="text-xs text-muted-foreground">
                        {storeMap.get(p.store_id) || "—"}
                      </p>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px] gap-1 text-muted-foreground"
                          onClick={() => { setTransferProduct(p); setTransferDialogOpen(true); }}
                        >
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
            <p className="font-medium text-sm">Nenhum produto encontrado</p>
            <p className="text-xs mt-1">Cadastre seu primeiro produto</p>
          </CardContent>
        </Card>
      )}

      {/* Transfer dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={(open) => { setTransferDialogOpen(open); if (!open) { setTransferProduct(null); setTransferStoreId(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" /> Transferir Produto
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
