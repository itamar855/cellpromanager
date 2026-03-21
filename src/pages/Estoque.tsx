import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Package } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const statusLabels: Record<string, string> = {
  in_stock: "Em estoque",
  sold: "Vendido",
  reserved: "Reservado",
  repair: "Em reparo",
};

const statusColors: Record<string, string> = {
  in_stock: "bg-primary/15 text-primary border-primary/20",
  sold: "bg-muted text-muted-foreground border-border",
  reserved: "bg-accent/15 text-accent border-accent/20",
  repair: "bg-destructive/15 text-destructive border-destructive/20",
};

const Estoque = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [stores, setStores] = useState<Tables<"stores">[]>([]);
  const [search, setSearch] = useState("");
  const [filterStore, setFilterStore] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "", brand: "iPhone" as string, model: "", imei: "",
    serial_number: "", cost_price: "", sale_price: "", store_id: "",
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
    });
    if (error) {
      toast.error(error.message.includes("imei") ? "IMEI já cadastrado!" : error.message);
    } else {
      toast.success("Produto cadastrado!");
      setDialogOpen(false);
      setForm({ name: "", brand: "iPhone", model: "", imei: "", serial_number: "", cost_price: "", sale_price: "", store_id: "" });
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
  const totalInvested = filtered.filter((p) => p.status === "in_stock").reduce((sum, p) => sum + Number(p.cost_price), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Estoque</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {filtered.filter((p) => p.status === "in_stock").length} aparelhos · {formatCurrency(totalInvested)}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 h-10">
              <Plus className="h-4 w-4" /> Novo Produto
            </Button>
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
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Modelo</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="A2633" required className="h-10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">IMEI</Label>
                  <Input value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} placeholder="Opcional" className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nº de Série</Label>
                  <Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} placeholder="Opcional" className="h-10" />
                </div>
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

      {/* Product cards (mobile-friendly) */}
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((p) => {
            const margin = p.sale_price ? Number(p.sale_price) - Number(p.cost_price) : null;
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
                        {p.brand} · {p.model} {p.imei && `· IMEI: ${p.imei}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {storeMap.get(p.store_id) || "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">Custo</p>
                      <p className="font-display font-bold text-sm">{formatCurrency(Number(p.cost_price))}</p>
                      {margin !== null && (
                        <p className={`text-xs font-medium mt-0.5 ${margin >= 0 ? "text-primary" : "text-destructive"}`}>
                          {margin >= 0 ? "+" : ""}{formatCurrency(margin)}
                        </p>
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
    </div>
  );
};

export default Estoque;
