import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, ShoppingBag, Smartphone, CreditCard, Banknote, QrCode, Zap, Trash2, Search } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

type Sale = {
  id: string; product_id: string; store_id: string; sale_price: number;
  has_trade_in: boolean; trade_in_device_name: string | null;
  trade_in_device_brand: string | null; trade_in_device_model: string | null;
  trade_in_device_imei: string | null; trade_in_value: number | null;
  trade_in_product_id: string | null; payment_cash: number; payment_card: number;
  payment_pix: number; customer_name: string | null; customer_phone: string | null;
  notes: string | null; created_by: string; created_at: string;
};

type Accessory = {
  id: string; store_id: string; name: string; category: string;
  brand: string | null; quantity: number; cost_price: number; sale_price: number | null;
};

type CartItem = {
  acc: Accessory;
  qty: number;
  price: number;
};

const Vendas = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [stores, setStores] = useState<Tables<"stores">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pdvOpen, setPdvOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accSearch, setAccSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pdvPayment, setPdvPayment] = useState({ cash: "", card: "", pix: "", customer: "", store_id: "" });

  const [form, setForm] = useState({
    product_id: "", sale_price: "", has_trade_in: false,
    trade_in_device_name: "", trade_in_device_brand: "iPhone",
    trade_in_device_model: "", trade_in_device_imei: "",
    trade_in_value: "", payment_cash: "", payment_card: "",
    payment_pix: "", customer_name: "", customer_phone: "", notes: "",
    commission_percent: "10",
  });

  const fetchData = async () => {
    const [salesRes, productsRes, storesRes, accRes] = await Promise.all([
      supabase.from("sales").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*"),
      supabase.from("stores").select("*"),
      supabase.from("accessories" as any).select("*").gt("quantity", 0),
    ]);
    setSales((salesRes.data as Sale[]) ?? []);
    setProducts(productsRes.data ?? []);
    setStores(storesRes.data ?? []);
    setAccessories((accRes.data as unknown as Accessory[]) ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const availableProducts = products.filter((p) => p.status === "in_stock");
  const selectedProduct = products.find((p) => p.id === form.product_id);
  const storeMap = new Map(stores.map((s) => [s.id, s.name]));
  const productMap = new Map(products.map((p) => [p.id, p]));

  const tradeInVal = parseFloat(form.trade_in_value) || 0;
  const cashVal = parseFloat(form.payment_cash) || 0;
  const cardVal = parseFloat(form.payment_card) || 0;
  const pixVal = parseFloat(form.payment_pix) || 0;
  const salePrice = parseFloat(form.sale_price) || 0;
  const totalPayment = (form.has_trade_in ? tradeInVal : 0) + cashVal + cardVal + pixVal;
  const remaining = salePrice - totalPayment;
  const profit = selectedProduct ? salePrice - Number(selectedProduct.cost_price) : 0;
  const commissionPercent = parseFloat(form.commission_percent) || 0;
  const commissionValue = Math.max(0, (profit * commissionPercent) / 100);

  // PDV calculations
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const pdvCash = parseFloat(pdvPayment.cash) || 0;
  const pdvCard = parseFloat(pdvPayment.card) || 0;
  const pdvPix = parseFloat(pdvPayment.pix) || 0;
  const pdvPaid = pdvCash + pdvCard + pdvPix;
  const pdvRemaining = cartTotal - pdvPaid;
  const pdvTroco = pdvCash > cartTotal && pdvCard === 0 && pdvPix === 0 ? pdvCash - cartTotal : 0;

  const addToCart = (acc: Accessory) => {
    setCart(prev => {
      const existing = prev.find(i => i.acc.id === acc.id);
      if (existing) {
        return prev.map(i => i.acc.id === acc.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { acc, qty: 1, price: acc.sale_price ?? acc.cost_price }];
    });
  };

  const updateCartQty = (id: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.acc.id !== id));
    } else {
      setCart(prev => prev.map(i => i.acc.id === id ? { ...i, qty } : i));
    }
  };

  const updateCartPrice = (id: string, price: number) => {
    setCart(prev => prev.map(i => i.acc.id === id ? { ...i, price } : i));
  };

  const filteredAcc = accessories.filter(a =>
    a.name.toLowerCase().includes(accSearch.toLowerCase()) ||
    (a.brand && a.brand.toLowerCase().includes(accSearch.toLowerCase()))
  );

  const resetForm = () => setForm({
    product_id: "", sale_price: "", has_trade_in: false,
    trade_in_device_name: "", trade_in_device_brand: "iPhone",
    trade_in_device_model: "", trade_in_device_imei: "",
    trade_in_value: "", payment_cash: "", payment_card: "",
    payment_pix: "", customer_name: "", customer_phone: "", notes: "",
    commission_percent: "10",
  });

  const resetPdv = () => {
    setCart([]);
    setPdvPayment({ cash: "", card: "", pix: "", customer: "", store_id: "" });
    setAccSearch("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProduct) return;
    if (Math.abs(remaining) > 0.01) {
      toast.error("A soma dos pagamentos deve ser igual ao valor de venda!");
      return;
    }
    setLoading(true);

    let tradeInProductId: string | null = null;
    if (form.has_trade_in && form.trade_in_device_name) {
      const { data: tradeInProduct, error: tradeInError } = await supabase
        .from("products")
        .insert({
          name: form.trade_in_device_name, brand: form.trade_in_device_brand,
          model: form.trade_in_device_model || "N/A",
          imei: form.trade_in_device_imei || null, cost_price: tradeInVal,
          store_id: selectedProduct.store_id, created_by: user.id, status: "in_stock",
        })
        .select("id").single();
      if (tradeInError) { toast.error("Erro ao cadastrar aparelho de troca: " + tradeInError.message); setLoading(false); return; }
      tradeInProductId = tradeInProduct.id;
    }

    const { error: saleError } = await supabase.from("sales").insert({
      product_id: form.product_id, store_id: selectedProduct.store_id,
      sale_price: salePrice, has_trade_in: form.has_trade_in,
      trade_in_device_name: form.has_trade_in ? form.trade_in_device_name || null : null,
      trade_in_device_brand: form.has_trade_in ? form.trade_in_device_brand || null : null,
      trade_in_device_model: form.has_trade_in ? form.trade_in_device_model || null : null,
      trade_in_device_imei: form.has_trade_in ? form.trade_in_device_imei || null : null,
      trade_in_value: form.has_trade_in ? tradeInVal : 0,
      trade_in_product_id: tradeInProductId,
      payment_cash: cashVal, payment_card: cardVal, payment_pix: pixVal,
      customer_name: form.customer_name || null, customer_phone: form.customer_phone || null,
      notes: form.notes || null, commission_percent: commissionPercent,
      commission_value: commissionValue, created_by: user.id,
    } as any);

    if (saleError) { toast.error("Erro ao registrar venda: " + saleError.message); setLoading(false); return; }

    await supabase.from("products").update({ status: "sold", sale_price: salePrice }).eq("id", form.product_id);
    await supabase.from("transactions").insert({
      type: "sale", amount: salePrice,
      description: `Venda: ${selectedProduct.name}${form.customer_name ? ` → ${form.customer_name}` : ""}`,
      store_id: selectedProduct.store_id, product_id: form.product_id, created_by: user.id,
    });

    toast.success("Venda registrada com sucesso!");
    setDialogOpen(false);
    resetForm();
    fetchData();
    setLoading(false);
  };

  const handlePdvSubmit = async () => {
    if (!user || cart.length === 0) return;
    if (!pdvPayment.store_id) { toast.error("Selecione a loja!"); return; }
    if (Math.abs(pdvRemaining) > 0.01) { toast.error("A soma dos pagamentos deve ser igual ao total!"); return; }

    setLoading(true);

    try {
      // Atualizar estoque de cada acessório
      for (const item of cart) {
        const newQty = item.acc.quantity - item.qty;
        await supabase.from("accessories" as any).update({ quantity: newQty }).eq("id", item.acc.id);
      }

      // Registrar transação
      const itemsDesc = cart.map(i => `${i.qty}x ${i.acc.name}`).join(", ");
      await supabase.from("transactions").insert({
        type: "income",
        category: "acessorio",
        amount: cartTotal,
        description: `PDV: ${itemsDesc}${pdvPayment.customer ? ` → ${pdvPayment.customer}` : ""}`,
        store_id: pdvPayment.store_id,
        created_by: user.id,
      });

      toast.success("Venda rápida registrada!");
      setPdvOpen(false);
      resetPdv();
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar venda");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Vendas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{sales.length} vendas registradas</p>
        </div>
        <div className="flex gap-2">
          {/* PDV Rápido */}
          <Dialog open={pdvOpen} onOpenChange={(o) => { setPdvOpen(o); if (!o) resetPdv(); }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 h-10"><Zap className="h-4 w-4 text-yellow-500" /> PDV Rápido</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" /> PDV — Venda Rápida
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Lado esquerdo — produtos */}
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={accSearch} onChange={(e) => setAccSearch(e.target.value)} placeholder="Buscar acessório..." className="pl-9 h-10" />
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {filteredAcc.length > 0 ? filteredAcc.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between rounded-lg border border-border/50 p-3 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
                        onClick={() => addToCart(a)}
                      >
                        <div>
                          <p className="text-sm font-medium">{a.name}</p>
                          <p className="text-[10px] text-muted-foreground">{a.brand && `${a.brand} · `}Estoque: {a.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-primary">{formatCurrency(a.sale_price ?? a.cost_price)}</p>
                          <p className="text-[10px] text-muted-foreground">+ Adicionar</p>
                        </div>
                      </div>
                    )) : (
                      <p className="text-xs text-muted-foreground text-center py-8">Nenhum acessório disponível</p>
                    )}
                  </div>
                </div>

                {/* Lado direito — carrinho */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Carrinho</p>
                  {cart.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground text-xs border border-dashed border-border rounded-lg">
                      Clique nos produtos para adicionar
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {cart.map(item => (
                        <div key={item.acc.id} className="rounded-lg border border-border/50 p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate flex-1">{item.acc.name}</p>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => updateCartQty(item.acc.id, 0)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCartQty(item.acc.id, item.qty - 1)}>-</Button>
                              <span className="text-sm font-bold w-6 text-center">{item.qty}</span>
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCartQty(item.acc.id, item.qty + 1)}>+</Button>
                            </div>
                            <Input
                              type="number" step="0.01" value={item.price}
                              onChange={(e) => updateCartPrice(item.acc.id, parseFloat(e.target.value) || 0)}
                              className="h-7 text-xs w-24"
                            />
                            <span className="text-sm font-bold text-primary ml-auto">{formatCurrency(item.price * item.qty)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Total e pagamento */}
                  {cart.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Total</span>
                        <span className="font-display font-bold text-lg text-primary">{formatCurrency(cartTotal)}</span>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Loja</Label>
                        <Select value={pdvPayment.store_id} onValueChange={(v) => setPdvPayment({ ...pdvPayment, store_id: v })}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Cliente (opcional)</Label>
                        <Input value={pdvPayment.customer} onChange={(e) => setPdvPayment({ ...pdvPayment, customer: e.target.value })} placeholder="Nome do cliente" className="h-9" />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] flex items-center gap-1"><Banknote className="h-3 w-3" /> Dinheiro</Label>
                          <Input type="number" step="0.01" value={pdvPayment.cash} onChange={(e) => setPdvPayment({ ...pdvPayment, cash: e.target.value })} placeholder="0.00" className="h-9 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] flex items-center gap-1"><CreditCard className="h-3 w-3" /> Cartão</Label>
                          <Input type="number" step="0.01" value={pdvPayment.card} onChange={(e) => setPdvPayment({ ...pdvPayment, card: e.target.value })} placeholder="0.00" className="h-9 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] flex items-center gap-1"><QrCode className="h-3 w-3" /> PIX</Label>
                          <Input type="number" step="0.01" value={pdvPayment.pix} onChange={(e) => setPdvPayment({ ...pdvPayment, pix: e.target.value })} placeholder="0.00" className="h-9 text-xs" />
                        </div>
                      </div>

                      <div className={`flex justify-between text-sm font-bold rounded-lg p-2 ${Math.abs(pdvRemaining) < 0.01 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                        <span>{pdvTroco > 0 ? "Troco" : "Restante"}</span>
                        <span>{formatCurrency(pdvTroco > 0 ? pdvTroco : pdvRemaining)}</span>
                      </div>

                      <Button
                        className="w-full h-10 font-semibold"
                        onClick={handlePdvSubmit}
                        disabled={loading || (Math.abs(pdvRemaining) > 0.01 && pdvTroco === 0) || !pdvPayment.store_id}
                      >
                        {loading ? "Registrando..." : `Finalizar Venda — ${formatCurrency(cartTotal)}`}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Nova Venda (aparelho) */}
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-10"><Plus className="h-4 w-4" /> Nova Venda</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">Registrar Venda</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Produto</Label>
                  <Select value={form.product_id} onValueChange={(v) => {
                    const prod = products.find((p) => p.id === v);
                    setForm({ ...form, product_id: v, sale_price: prod?.sale_price ? String(prod.sale_price) : "" });
                  }}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Selecione o aparelho" /></SelectTrigger>
                    <SelectContent>
                      {availableProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {p.brand} ({storeMap.get(p.store_id) || "?"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProduct && (
                  <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-0.5">
                    <p><span className="text-muted-foreground">Custo:</span> <span className="font-semibold">{formatCurrency(Number(selectedProduct.cost_price))}</span></p>
                    {selectedProduct.imei && <p><span className="text-muted-foreground">IMEI:</span> {selectedProduct.imei}</p>}
                    {salePrice > 0 && (
                      <p><span className="text-muted-foreground">Lucro estimado:</span> <span className={`font-semibold ${profit >= 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(profit)}</span></p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Valor de Venda (R$)</Label>
                  <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} placeholder="3500.00" required className="h-10" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cliente</Label>
                    <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Nome" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Telefone</Label>
                    <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} placeholder="(11) 99999-9999" className="h-10" />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Aparelho na troca</p>
                      <p className="text-[11px] text-muted-foreground">Cliente entrega um aparelho como parte do pagamento</p>
                    </div>
                  </div>
                  <Switch checked={form.has_trade_in} onCheckedChange={(v) => setForm({ ...form, has_trade_in: v })} />
                </div>

                {form.has_trade_in && (
                  <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-semibold text-primary">Dados do aparelho na troca</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nome</Label>
                        <Input value={form.trade_in_device_name} onChange={(e) => setForm({ ...form, trade_in_device_name: e.target.value })} placeholder="iPhone 11 64GB" className="h-10" required={form.has_trade_in} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Marca</Label>
                        <Select value={form.trade_in_device_brand} onValueChange={(v) => setForm({ ...form, trade_in_device_brand: v })}>
                          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="iPhone">iPhone</SelectItem>
                            <SelectItem value="Samsung">Samsung</SelectItem>
                            <SelectItem value="Xiaomi">Xiaomi</SelectItem>
                            <SelectItem value="Outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Modelo</Label>
                        <Input value={form.trade_in_device_model} onChange={(e) => setForm({ ...form, trade_in_device_model: e.target.value })} placeholder="A2221" className="h-10" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">IMEI</Label>
                        <Input value={form.trade_in_device_imei} onChange={(e) => setForm({ ...form, trade_in_device_imei: e.target.value })} placeholder="Opcional" className="h-10" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor da troca (R$)</Label>
                      <Input type="number" step="0.01" value={form.trade_in_value} onChange={(e) => setForm({ ...form, trade_in_value: e.target.value })} placeholder="1500.00" required={form.has_trade_in} className="h-10" />
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Forma de pagamento (restante)</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1"><Banknote className="h-3 w-3" /> Dinheiro</Label>
                      <Input type="number" step="0.01" value={form.payment_cash} onChange={(e) => setForm({ ...form, payment_cash: e.target.value })} placeholder="0.00" className="h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1"><CreditCard className="h-3 w-3" /> Cartão</Label>
                      <Input type="number" step="0.01" value={form.payment_card} onChange={(e) => setForm({ ...form, payment_card: e.target.value })} placeholder="0.00" className="h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1"><QrCode className="h-3 w-3" /> PIX</Label>
                      <Input type="number" step="0.01" value={form.payment_pix} onChange={(e) => setForm({ ...form, payment_pix: e.target.value })} placeholder="0.00" className="h-10" />
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor de venda</span>
                      <span className="font-semibold">{formatCurrency(salePrice)}</span>
                    </div>
                    {form.has_trade_in && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Aparelho na troca</span>
                        <span className="font-semibold text-primary">-{formatCurrency(tradeInVal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dinheiro + Cartão + PIX</span>
                      <span className="font-semibold">{formatCurrency(cashVal + cardVal + pixVal)}</span>
                    </div>
                    <div className="border-t border-border pt-1 flex justify-between">
                      <span className="font-medium">Restante</span>
                      <span className={`font-bold ${Math.abs(remaining) < 0.01 ? "text-primary" : "text-destructive"}`}>
                        {formatCurrency(remaining)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-semibold text-primary">Comissão do Vendedor</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Comissão (%)</Label>
                      <Input type="number" step="0.5" min="0" max="100" value={form.commission_percent} onChange={(e) => setForm({ ...form, commission_percent: e.target.value })} className="h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor da Comissão</Label>
                      <div className="h-10 flex items-center rounded-md border border-input bg-muted/50 px-3 text-sm font-semibold text-primary">
                        {formatCurrency(commissionValue)}
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Calculada sobre o lucro: {formatCurrency(profit)} × {commissionPercent}%</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Observações</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observações da venda..." className="min-h-[60px]" />
                </div>

                <Button type="submit" className="w-full h-11 font-semibold" disabled={loading || !form.product_id || Math.abs(remaining) > 0.01}>
                  {loading ? "Registrando..." : "Registrar Venda"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sales list */}
      <div className="space-y-2">
        {sales.length > 0 ? (
          sales.map((sale) => {
            const product = productMap.get(sale.product_id);
            return (
              <Card key={sale.id} className="border-border/50 shadow-lg shadow-black/10">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{product?.name || "Produto removido"}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {sale.has_trade_in && (
                          <Badge variant="outline" className="text-[10px] bg-primary/15 text-primary border-primary/20">
                            Troca: {sale.trade_in_device_name}
                          </Badge>
                        )}
                        {Number(sale.payment_cash) > 0 && (
                          <Badge variant="outline" className="text-[10px]">💵 {formatCurrency(Number(sale.payment_cash))}</Badge>
                        )}
                        {Number(sale.payment_card) > 0 && (
                          <Badge variant="outline" className="text-[10px]">💳 {formatCurrency(Number(sale.payment_card))}</Badge>
                        )}
                        {Number(sale.payment_pix) > 0 && (
                          <Badge variant="outline" className="text-[10px]">📱 {formatCurrency(Number(sale.payment_pix))}</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {sale.customer_name && `${sale.customer_name} · `}
                        {storeMap.get(sale.store_id) || ""} · {new Date(sale.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-display font-bold text-sm text-primary">{formatCurrency(Number(sale.sale_price))}</p>
                      {sale.has_trade_in && sale.trade_in_value && (
                        <p className="text-[10px] text-muted-foreground">Troca: {formatCurrency(Number(sale.trade_in_value))}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ShoppingBag className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium text-sm">Nenhuma venda registrada</p>
              <p className="text-xs mt-1">Registre sua primeira venda</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Vendas;
