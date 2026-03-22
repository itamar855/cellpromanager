import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, ShoppingBag, Smartphone, CreditCard, Banknote, QrCode } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

type Sale = {
  id: string;
  product_id: string;
  store_id: string;
  sale_price: number;
  has_trade_in: boolean;
  trade_in_device_name: string | null;
  trade_in_device_brand: string | null;
  trade_in_device_model: string | null;
  trade_in_device_imei: string | null;
  trade_in_value: number | null;
  trade_in_product_id: string | null;
  payment_cash: number;
  payment_card: number;
  payment_pix: number;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
};

const Vendas = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [stores, setStores] = useState<Tables<"stores">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    product_id: "",
    sale_price: "",
    has_trade_in: false,
    trade_in_device_name: "",
    trade_in_device_brand: "iPhone",
    trade_in_device_model: "",
    trade_in_device_imei: "",
    trade_in_value: "",
    payment_cash: "",
    payment_card: "",
    payment_pix: "",
    customer_name: "",
    customer_phone: "",
    notes: "",
    commission_percent: "10",
  });

  const fetchData = async () => {
    const [salesRes, productsRes, storesRes] = await Promise.all([
      supabase.from("sales").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*"),
      supabase.from("stores").select("*"),
    ]);
    setSales((salesRes.data as Sale[]) ?? []);
    setProducts(productsRes.data ?? []);
    setStores(storesRes.data ?? []);
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

  const resetForm = () => setForm({
    product_id: "", sale_price: "", has_trade_in: false,
    trade_in_device_name: "", trade_in_device_brand: "iPhone",
    trade_in_device_model: "", trade_in_device_imei: "",
    trade_in_value: "", payment_cash: "", payment_card: "",
    payment_pix: "", customer_name: "", customer_phone: "", notes: "",
    commission_percent: "10",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProduct) return;

    if (Math.abs(remaining) > 0.01) {
      toast.error("A soma dos pagamentos deve ser igual ao valor de venda!");
      return;
    }

    setLoading(true);

    // If trade-in, register the trade-in device as new product in stock
    let tradeInProductId: string | null = null;
    if (form.has_trade_in && form.trade_in_device_name) {
      const { data: tradeInProduct, error: tradeInError } = await supabase
        .from("products")
        .insert({
          name: form.trade_in_device_name,
          brand: form.trade_in_device_brand,
          model: form.trade_in_device_model || "N/A",
          imei: form.trade_in_device_imei || null,
          cost_price: tradeInVal,
          store_id: selectedProduct.store_id,
          created_by: user.id,
          status: "in_stock",
        })
        .select("id")
        .single();

      if (tradeInError) {
        toast.error("Erro ao cadastrar aparelho de troca: " + tradeInError.message);
        setLoading(false);
        return;
      }
      tradeInProductId = tradeInProduct.id;
    }

    // Create the sale record with commission
    const { error: saleError } = await supabase.from("sales").insert({
      product_id: form.product_id,
      store_id: selectedProduct.store_id,
      sale_price: salePrice,
      has_trade_in: form.has_trade_in,
      trade_in_device_name: form.has_trade_in ? form.trade_in_device_name || null : null,
      trade_in_device_brand: form.has_trade_in ? form.trade_in_device_brand || null : null,
      trade_in_device_model: form.has_trade_in ? form.trade_in_device_model || null : null,
      trade_in_device_imei: form.has_trade_in ? form.trade_in_device_imei || null : null,
      trade_in_value: form.has_trade_in ? tradeInVal : 0,
      trade_in_product_id: tradeInProductId,
      payment_cash: cashVal,
      payment_card: cardVal,
      payment_pix: pixVal,
      customer_name: form.customer_name || null,
      customer_phone: form.customer_phone || null,
      notes: form.notes || null,
      commission_percent: commissionPercent,
      commission_value: commissionValue,
      created_by: user.id,
    } as any);

    if (saleError) {
      toast.error("Erro ao registrar venda: " + saleError.message);
      setLoading(false);
      return;
    }

    // Mark the sold product as "sold" and set sale_price
    await supabase
      .from("products")
      .update({ status: "sold", sale_price: salePrice })
      .eq("id", form.product_id);

    // Create a transaction record for the sale
    await supabase.from("transactions").insert({
      type: "sale",
      amount: salePrice,
      description: `Venda: ${selectedProduct.name}${form.customer_name ? ` → ${form.customer_name}` : ""}`,
      store_id: selectedProduct.store_id,
      product_id: form.product_id,
      created_by: user.id,
    });

    toast.success("Venda registrada com sucesso!");
    setDialogOpen(false);
    resetForm();
    fetchData();
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Vendas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{sales.length} vendas registradas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 h-10"><Plus className="h-4 w-4" /> Nova Venda</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Registrar Venda</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Product selection */}
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
                </div>
              )}

              {/* Sale price */}
              <div className="space-y-1.5">
                <Label className="text-xs">Valor de Venda (R$)</Label>
                <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} placeholder="3500.00" required className="h-10" />
              </div>

              {/* Customer info */}
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

              {/* Trade-in toggle */}
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

              {/* Trade-in details */}
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

              {/* Payment methods */}
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

                {/* Payment summary */}
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

              <div className="space-y-1.5">
                <Label className="text-xs">Observações</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observações da venda..." className="min-h-[60px]" />
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-semibold"
                disabled={loading || !form.product_id || Math.abs(remaining) > 0.01}
              >
                {loading ? "Registrando..." : "Registrar Venda"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
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
                          <Badge variant="outline" className="text-[10px]">
                            💵 {formatCurrency(Number(sale.payment_cash))}
                          </Badge>
                        )}
                        {Number(sale.payment_card) > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            💳 {formatCurrency(Number(sale.payment_card))}
                          </Badge>
                        )}
                        {Number(sale.payment_pix) > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            📱 {formatCurrency(Number(sale.payment_pix))}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {sale.customer_name && `${sale.customer_name} · `}
                        {storeMap.get(sale.store_id) || ""} · {new Date(sale.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-display font-bold text-sm text-primary">
                        {formatCurrency(Number(sale.sale_price))}
                      </p>
                      {sale.has_trade_in && sale.trade_in_value && (
                        <p className="text-[10px] text-muted-foreground">
                          Troca: {formatCurrency(Number(sale.trade_in_value))}
                        </p>
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
