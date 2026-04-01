import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, ShoppingBag, Smartphone, CreditCard, Banknote, QrCode,
  Zap, Trash2, Search, FileText, MessageCircle, User as UserIcon, UserPlus,
  ChevronDown, ChevronUp, History, Tag, Shield, Landmark, Store, AlertTriangle,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { gerarNotaFiscalInterna, type NotaFiscalData } from "@/utils/notaFiscalInterna";
import { triggerWebhook } from "@/utils/webhookSender";
import { logAction } from "@/utils/auditLogger";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type Sale = {
  id: string; product_id: string; store_id: string; sale_price: number;
  has_trade_in: boolean; trade_in_device_name: string | null;
  trade_in_value: number | null; payment_cash: number; payment_card: number;
  payment_pix: number; customer_name: string | null; customer_phone: string | null;
  customer_cpf: string | null; customer_address: string | null;
  notes: string | null; created_by: string; created_at: string;
  commission_value: number | null; discount: number | null;
  warranty_days: number | null; installments: number | null; seller_id: string | null;
  trade_in_product_id: string | null;
};

type Customer = Tables<"customers">;
type Accessory = { id: string; store_id: string; name: string; category: string; brand: string | null; quantity: number; cost_price: number; sale_price: number | null };
type CartItem = { acc: Accessory; qty: number; price: number };

const createPendingCashEntry = async (storeId: string, userId: string, amount: number, description: string, paymentMethod: string) => {
  const { data: register } = await supabase.from("cash_registers" as any).select("id").eq("store_id", storeId).eq("status", "open").maybeSingle();
  const registerId = register ? (register as any).id : null;
  await supabase.from("cash_entries" as any).insert({
    cash_register_id: registerId, store_id: storeId,
    type: "entrada", amount, description,
    payment_method: paymentMethod, receipt_url: null, confirmed: false, created_by: userId,
  });
};

const emptyCustomerForm = { name: "", phone: "", cpf: "", address: "", email: "", birth: "" };

const Vendas = () => {
  const { user, userRole, activeStoreId } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [pdvSales, setPdvSales] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pdvOpen, setPdvOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notaLoading, setNotaLoading] = useState<string | null>(null);
  const [accSearch, setAccSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer search state
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState(emptyCustomerForm);
  const [customerSalesHistory, setCustomerSalesHistory] = useState<Sale[]>([]);
  const [justification, setJustification] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [pdvPayment, setPdvPayment] = useState({ cash: "", card: "", pix: "", customer: "", store_id: "" });

  const [form, setForm] = useState({
    product_id: "", sale_price: "", has_trade_in: false,
    trade_in_device_name: "", trade_in_device_brand: "iPhone",
    trade_in_device_model: "", trade_in_device_imei: "",
    trade_in_value: "", payment_cash: "", payment_card: "",
    payment_pix: "", notes: "", commission_percent: "10",
    discount: "0", warranty_days: "90", installments: "1",
    destination_account_id: "",
  });

  const fetchData = async () => {
    if (!activeStoreId) return;
    setLoading(true);

    let salesQuery = supabase.from("sales").select("*");
    let productsQuery = supabase.from("products").select("*");
    let accQuery = supabase.from("accessories" as any).select("*").gt("quantity", 0);
    let pdvQuery = supabase.from("transactions").select("*").eq("type", "income").eq("category", "acessorio");
    let accountsQuery = supabase.from("store_bank_accounts").select("*");

    if (activeStoreId !== "all") {
      salesQuery = salesQuery.eq("store_id", activeStoreId);
      productsQuery = productsQuery.eq("store_id", activeStoreId);
      accQuery = accQuery.eq("store_id", activeStoreId);
      pdvQuery = pdvQuery.eq("store_id", activeStoreId);
      accountsQuery = accountsQuery.eq("store_id", activeStoreId);
    }

    const [salesRes, productsRes, storesRes, accRes, pdvRes, profilesRes, customersRes, accountsRes] = await Promise.all([
      salesQuery.order("created_at", { ascending: false }),
      productsQuery,
      supabase.from("stores").select("*"),
      accQuery,
      pdvQuery.order("created_at", { ascending: false }),
      supabase.from("profiles").select("*"),
      supabase.from("customers").select("*").order("name"),
      accountsQuery,
    ]);

    setSales((salesRes.data as unknown as Sale[]) ?? []);
    setProducts(productsRes.data ?? []);
    setStores(storesRes.data ?? []);
    setAccessories((accRes.data as unknown as Accessory[]) ?? []);
    setPdvSales(pdvRes.data ?? []);
    setProfiles(profilesRes.data ?? []);
    setCustomers(customersRes.data ?? []);
    setBankAccounts(accountsRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [activeStoreId]);

  // Customer search
  useEffect(() => {
    if (customerSearch.length < 2) { setCustomerResults([]); return; }
    const q = customerSearch.toLowerCase();
    setCustomerResults(
      customers.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(customerSearch)) ||
        (c.cpf && c.cpf.includes(customerSearch))
      ).slice(0, 5)
    );
  }, [customerSearch, customers]);

  const selectCustomer = async (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerSearch(c.name);
    setCustomerResults([]);
    setShowNewCustomerForm(false);
    // Busca histórico de compras (apenas na loja atual)
    const { data } = await supabase.from("sales").select("*")
      .eq("store_id", activeStoreId)
      .or(`customer_id.eq.${c.id},customer_phone.eq.${c.phone ?? ""}`)
      .order("created_at", { ascending: false }).limit(5);
    setCustomerSalesHistory((data as unknown as Sale[]) ?? []);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerSearch("");
    setCustomerResults([]);
    setCustomerSalesHistory([]);
    setShowCustomerHistory(false);
  };

  const handleCreateCustomer = async () => {
    if (!user || !newCustomerForm.name) return;
    setLoading(true);
    const { data, error } = await supabase.from("customers").insert({
      name: newCustomerForm.name, phone: newCustomerForm.phone || null,
      cpf: newCustomerForm.cpf || null, address: newCustomerForm.address || null,
      email: newCustomerForm.email || null, created_by: user.id,
    }).select().single();
    if (error) { toast.error(error.message); setLoading(false); return; }
    toast.success("Cliente cadastrado!");
    await fetchData();
    setSelectedCustomer(data as Customer);
    setCustomerSearch((data as Customer).name);
    setShowNewCustomerForm(false);
    setNewCustomerForm(emptyCustomerForm);
    setLoading(false);
  };

  const storeMap = new Map(stores.map(s => [s.id, s]));
  const productMap = new Map(products.map(p => [p.id, p]));
  const profileMap = new Map(profiles.map(p => [p.user_id, p.display_name ?? p.user_id]));
  const currentProfile = profiles.find(p => p.user_id === user?.id);

  const availableProducts = products.filter(p => p.status === "in_stock");
  const selectedProduct = products.find(p => p.id === form.product_id);

  const discount = parseFloat(form.discount) || 0;
  const tradeInVal = parseFloat(form.trade_in_value) || 0;
  const cashVal = parseFloat(form.payment_cash) || 0;
  const cardVal = parseFloat(form.payment_card) || 0;
  const pixVal = parseFloat(form.payment_pix) || 0;
  const salePrice = parseFloat(form.sale_price) || 0;
  const salePriceAfterDiscount = Math.max(0, salePrice - discount);
  const totalPayment = (form.has_trade_in ? tradeInVal : 0) + cashVal + cardVal + pixVal;
  const remaining = salePriceAfterDiscount - totalPayment;
  const profit = selectedProduct ? salePriceAfterDiscount - Number(selectedProduct.cost_price) : 0;
  const commissionPercent = parseFloat(form.commission_percent) || 0;
  const commissionValue = Math.max(0, (profit * commissionPercent) / 100);

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const pdvCash = parseFloat(pdvPayment.cash) || 0;
  const pdvCard = parseFloat(pdvPayment.card) || 0;
  const pdvPix = parseFloat(pdvPayment.pix) || 0;
  const pdvRemaining = cartTotal - pdvCash - pdvCard - pdvPix;
  const pdvTroco = pdvCash > cartTotal && pdvCard === 0 && pdvPix === 0 ? pdvCash - cartTotal : 0;

  const addToCart = (acc: Accessory) => {
    setCart(prev => {
      const ex = prev.find(i => i.acc.id === acc.id);
      if (ex) return prev.map(i => i.acc.id === acc.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { acc, qty: 1, price: acc.sale_price ?? acc.cost_price }];
    });
  };
  const updateCartQty = (id: string, qty: number) => qty <= 0 ? setCart(p => p.filter(i => i.acc.id !== id)) : setCart(p => p.map(i => i.acc.id === id ? { ...i, qty } : i));
  const updateCartPrice = (id: string, price: number) => setCart(p => p.map(i => i.acc.id === id ? { ...i, price } : i));
  const filteredAcc = accessories.filter(a => a.name.toLowerCase().includes(accSearch.toLowerCase()) || (a.brand && a.brand.toLowerCase().includes(accSearch.toLowerCase())));

  const resetForm = () => {
    setForm({ product_id: "", sale_price: "", has_trade_in: false, trade_in_device_name: "", trade_in_device_brand: "iPhone", trade_in_device_model: "", trade_in_device_imei: "", trade_in_value: "", payment_cash: "", payment_card: "", payment_pix: "", notes: "", commission_percent: "10", discount: "0", warranty_days: "90", installments: "1", destination_account_id: "" });
    clearCustomer();
  };
  const resetPdv = () => { setCart([]); setPdvPayment({ cash: "", card: "", pix: "", customer: "", store_id: activeStoreId || "" }); setAccSearch(""); };

  // ── Submit venda ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProduct) return;
    if (Math.abs(remaining) > 0.01) { toast.error("A soma dos pagamentos deve ser igual ao valor de venda!"); return; }
    setLoading(true);

    // Salva/atualiza cliente se informado
    let customerId = selectedCustomer?.id ?? null;
    if (!selectedCustomer && customerSearch.trim()) {
      const { data: existingCustomer } = await supabase.from("customers").select("*").ilike("name", customerSearch.trim()).maybeSingle();
      if (existingCustomer) { customerId = existingCustomer.id; }
    }

    let tradeInProductId: string | null = null;
    if (form.has_trade_in && form.trade_in_device_name) {
      const { data: tip, error: tiErr } = await supabase.from("products").insert({
        name: form.trade_in_device_name, brand: form.trade_in_device_brand,
        model: form.trade_in_device_model || "N/A", imei: form.trade_in_device_imei || null,
        cost_price: tradeInVal, store_id: selectedProduct.store_id,
        created_by: user.id, status: "in_stock",
      }).select("id").single();
      if (tiErr) { toast.error(tiErr.message); setLoading(false); return; }
      tradeInProductId = tip.id;
    }

    const { data: saleData, error: saleError } = await supabase.from("sales").insert({
      product_id: form.product_id, store_id: selectedProduct.store_id,
      sale_price: salePriceAfterDiscount, has_trade_in: form.has_trade_in,
      trade_in_device_name: form.has_trade_in ? form.trade_in_device_name || null : null,
      trade_in_device_brand: form.has_trade_in ? form.trade_in_device_brand || null : null,
      trade_in_device_model: form.has_trade_in ? form.trade_in_device_model || null : null,
      trade_in_device_imei: form.has_trade_in ? form.trade_in_device_imei || null : null,
      trade_in_value: form.has_trade_in ? tradeInVal : 0, trade_in_product_id: tradeInProductId,
      payment_cash: cashVal, payment_card: cardVal, payment_pix: pixVal,
      customer_id: customerId,
      customer_name: (selectedCustomer?.name || customerSearch) || null,
      customer_phone: selectedCustomer?.phone ?? null,
      customer_cpf: selectedCustomer?.cpf ?? null,
      customer_address: selectedCustomer?.address ?? null,
      notes: form.notes || null, commission_percent: commissionPercent,
      commission_value: commissionValue, created_by: user.id,
      seller_id: user.id, discount: discount,
      warranty_days: parseInt(form.warranty_days) || 90,
      installments: parseInt(form.installments) || 1,
    } as any).select().single();

    if (saleError) { toast.error(saleError.message); setLoading(false); return; }

    triggerWebhook("sale_completed", selectedProduct.store_id, saleData);
    logAction("CREATE_SALE", "sales", (saleData as any).id, null, saleData, selectedProduct.store_id);

    await supabase.from("products").update({ status: "sold", sale_price: salePriceAfterDiscount }).eq("id", form.product_id);
    const desc = `Venda: ${selectedProduct.name}${selectedCustomer?.name ? ` → ${selectedCustomer.name}` : ""}`;
    
    // Calcula taxas e liquidez se conta destino informada
    let netAmount = salePriceAfterDiscount;
    let expectedDate = new Date();
    
    if (form.destination_account_id && (cardVal > 0 || pixVal > 0)) {
      const acc = bankAccounts.find(a => a.id === form.destination_account_id);
      if (acc) {
        if (cardVal > 0) {
          const fee = Number(acc.credit_fee_percent) || 0;
          const days = Number(acc.credit_settlement_days) || 30;
          netAmount -= (cardVal * (fee / 100));
          expectedDate.setDate(expectedDate.getDate() + days); // simples adicionamento de dias
        } else if (pixVal > 0) {
          const fee = Number(acc.pix_fee_percent) || 0;
          const days = Number(acc.pix_settlement_days) || 0;
          netAmount -= (pixVal * (fee / 100));
          expectedDate.setDate(expectedDate.getDate() + days);
        }
      }
    }

    await supabase.from("transactions").insert({
      type: "sale", amount: salePriceAfterDiscount, net_amount: netAmount,
      description: desc, store_id: selectedProduct.store_id, product_id: form.product_id,
      created_by: user.id, destination_account_id: form.destination_account_id || null,
      expected_settlement_date: expectedDate.toISOString(),
    });
    
    const mainPayment = cashVal > 0 ? "dinheiro" : cardVal > 0 ? "cartao_credito" : pixVal > 0 ? "pix" : "dinheiro";
    await createPendingCashEntry(selectedProduct.store_id, user.id, cashVal > 0 ? cashVal : salePriceAfterDiscount, desc, mainPayment);

    toast.success("Venda registrada! Confirme o recebimento no caixa.");
    setDialogOpen(false); resetForm(); fetchData();
    setLoading(false);
  };

  const handlePdvSubmit = async () => {
    if (!user || cart.length === 0 || !activeStoreId) return;
    setLoading(true);
    try {
      for (const item of cart) await supabase.from("accessories" as any).update({ quantity: item.acc.quantity - item.qty }).eq("id", item.acc.id);
      const desc = `PDV: ${cart.map(i => `${i.qty}x ${i.acc.name}`).join(", ")}${pdvPayment.customer ? ` → ${pdvPayment.customer}` : ""}`;
      await supabase.from("transactions").insert({ type: "income", category: "acessorio", amount: cartTotal, description: desc, store_id: activeStoreId, created_by: user.id });
      const mp = pdvCash > 0 ? "dinheiro" : pdvCard > 0 ? "cartao_credito" : pdvPix > 0 ? "pix" : "dinheiro";
      await createPendingCashEntry(activeStoreId, user.id, cartTotal, desc, mp);
      toast.success("Venda rápida registrada!"); setPdvOpen(false); resetPdv(); fetchData();
    } catch (err: any) { toast.error(err.message || "Erro"); }
    setLoading(false);
  };

  const handleDeleteSale = async (saleId: string, reason: string) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;
    
    setLoading(true);
    try {
      // 1. Restaurar o produto para 'in_stock'
      await supabase.from("products").update({ status: "in_stock", sale_price: null }).eq("id", sale.product_id);
      
      // 2. Se houver trade-in, apagar o produto que foi criado
      if (sale.trade_in_product_id) {
        await supabase.from("products").delete().eq("id", sale.trade_in_product_id);
      }
      
      // 3. Apagar as transações vinculadas
      await supabase.from("transactions").delete().eq("product_id", sale.product_id).eq("type", "sale");
      
      // 4. Apagar a venda
      const { error } = await supabase.from("sales").delete().eq("id", sale.id);
      
      if (error) throw error;
      
      logAction("DELETE_RECORD", "sales", sale.id, sale, { reason }, sale.store_id);
      toast.success("Venda removida e produto retornou ao estoque!");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao remover venda: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Gerar nota ────────────────────────────────────────────────────────────
  const handleGerarNota = async (sale: Sale, whatsapp = false) => {
    setNotaLoading(sale.id);
    try {
      const product = productMap.get(sale.product_id) as any;
      const store = storeMap.get(sale.store_id) as any;
      const numeroNota = `VND-${sale.id.slice(0, 8).toUpperCase()}`;
      const data: NotaFiscalData = {
        numeroNota, dataVenda: new Date(sale.created_at).toLocaleString("pt-BR"),
        lojaNome: store?.name ?? "Loja", lojaCnpj: store?.cnpj, lojaEndereco: store?.address,
        lojaTelefone: store?.phone, lojaWhatsapp: store?.whatsapp, lojaInstagram: store?.instagram, lojaLogoUrl: store?.logo_url,
        clienteNome: sale.customer_name ?? undefined, clienteTelefone: sale.customer_phone ?? undefined,
        produtoNome: product?.name ?? "Produto", produtoMarca: product?.brand ?? "",
        produtoModelo: product?.model, produtoImei: product?.imei ?? undefined, produtoCor: product?.color ?? undefined,
        valorVenda: Number(sale.sale_price), valorDinheiro: Number(sale.payment_cash) || undefined,
        valorCartao: Number(sale.payment_card) || undefined, valorPix: Number(sale.payment_pix) || undefined,
        tradeIn: sale.has_trade_in, tradeInValor: sale.trade_in_value ? Number(sale.trade_in_value) : undefined,
        tradeInNome: sale.trade_in_device_name ?? undefined, observacoes: sale.notes ?? undefined,
      };
      const doc = await gerarNotaFiscalInterna(data);
      if (whatsapp) {
        if (!sale.customer_phone) { toast.error("Cliente sem telefone!"); setNotaLoading(null); return; }
        const blob = doc.output("blob");
        const { data: up, error } = await supabase.storage.from("comprovantes").upload(`notas/${numeroNota}-${Date.now()}.pdf`, blob, { upsert: true, contentType: "application/pdf" });
        if (error) { toast.error("Erro no upload"); setNotaLoading(null); return; }
        const { data: u } = supabase.storage.from("comprovantes").getPublicUrl(up.path);
        const phone = sale.customer_phone.replace(/\D/g, "");
        window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(`Olá ${sale.customer_name || ""}! 👋\n\nSegue seu comprovante de compra:\n${u.publicUrl}\n\nObrigado pela preferência! 🙏`)}`, "_blank");
        toast.success("WhatsApp aberto!");
      } else {
        doc.save(`nota-${numeroNota}.pdf`); toast.success("Nota gerada!");
      }
    } catch { toast.error("Erro ao gerar nota. Instale: npm install jspdf"); }
    setNotaLoading(null);
  };

  // ── Customer search UI ────────────────────────────────────────────────────
  const CustomerSection = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <UserIcon className="h-3 w-3" /> Cliente
        </p>
        {currentProfile && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            Vendedor: <span className="font-semibold text-primary">{currentProfile.display_name ?? user?.email}</span>
          </span>
        )}
      </div>

      {selectedCustomer ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {selectedCustomer.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold">{selectedCustomer.name}</p>
                <div className="flex gap-2 flex-wrap">
                  {selectedCustomer.phone && <p className="text-[10px] text-muted-foreground">{selectedCustomer.phone}</p>}
                  {selectedCustomer.cpf && <p className="text-[10px] text-muted-foreground">CPF: {selectedCustomer.cpf}</p>}
                </div>
              </div>
            </div>
            <Button className="h-7 px-2 bg-transparent border border-border text-foreground hover:bg-muted text-[10px]" onClick={clearCustomer}>Trocar</Button>
          </div>
          {selectedCustomer.address && <p className="text-[10px] text-muted-foreground">📍 {selectedCustomer.address}</p>}

          {/* Histórico */}
          {customerSalesHistory.length > 0 && (
            <div>
              <button className="flex items-center gap-1 text-[10px] text-primary font-medium" onClick={() => setShowCustomerHistory(v => !v)}>
                <History className="h-3 w-3" /> {customerSalesHistory.length} compra(s) anterior(es)
                {showCustomerHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showCustomerHistory && (
                <div className="mt-2 space-y-1">
                  {customerSalesHistory.map(s => {
                    const p = productMap.get(s.product_id) as any;
                    return (
                      <div key={s.id} className="flex justify-between rounded bg-muted/50 px-2 py-1 text-[10px]">
                        <span className="truncate">{p?.name ?? "Produto"}</span>
                        <span className="text-primary font-semibold shrink-0 ml-2">{formatCurrency(Number(s.sale_price))}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Buscar cliente por nome, telefone ou CPF..." className="pl-9 h-10" />
          </div>
          {customerResults.length > 0 && (
            <div className="rounded-lg border border-border bg-card shadow-lg overflow-hidden">
              {customerResults.map(c => (
                <button key={c.id} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left border-b border-border/50 last:border-0"
                  onClick={() => selectCustomer(c)}>
                  <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{c.phone ?? ""}{c.cpf ? ` · ${c.cpf}` : ""}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          <Button className="w-full gap-2 h-9 text-xs border border-dashed bg-transparent text-foreground hover:bg-muted"
            onClick={() => setShowNewCustomerForm(v => !v)}>
            <UserPlus className="h-3.5 w-3.5" /> Cadastrar novo cliente
          </Button>
          {showNewCustomerForm && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
              <p className="text-xs font-semibold text-primary">Novo Cliente</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome *</Label>
                <Input value={newCustomerForm.name} onChange={e => setNewCustomerForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo" className="h-9" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone</Label>
                  <Input value={newCustomerForm.phone} onChange={e => setNewCustomerForm(f => ({ ...f, phone: e.target.value }))} placeholder="(87) 99999-9999" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CPF</Label>
                  <Input value={newCustomerForm.cpf} onChange={e => setNewCustomerForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" className="h-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Endereço</Label>
                <Input value={newCustomerForm.address} onChange={e => setNewCustomerForm(f => ({ ...f, address: e.target.value }))} placeholder="Rua, número, bairro..." className="h-9" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">E-mail</Label>
                  <Input type="email" value={newCustomerForm.email} onChange={e => setNewCustomerForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Data de Nascimento</Label>
                  <Input type="date" value={newCustomerForm.birth} onChange={e => setNewCustomerForm(f => ({ ...f, birth: e.target.value }))} className="h-9" />
                </div>
              </div>
              <Button className="w-full h-9" onClick={handleCreateCustomer} disabled={loading || !newCustomerForm.name}>
                {loading ? "Salvando..." : "Salvar e Selecionar"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Vendas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {sales.length + pdvSales.length} transações registradas
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
      <div className="flex justify-end gap-2">
          {/* PDV */}
          <Dialog open={pdvOpen} onOpenChange={o => { setPdvOpen(o); if (!o) resetPdv(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-10 border bg-transparent text-foreground hover:bg-muted" disabled={activeStoreId === "all"}>
                <Zap className="h-4 w-4 text-yellow-500" /> PDV Rápido
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-500" /> PDV — Venda Rápida</DialogTitle></DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={accSearch} onChange={e => setAccSearch(e.target.value)} placeholder="Buscar acessório..." className="pl-9 h-10" />
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {filteredAcc.length > 0 ? filteredAcc.map(a => (
                      <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors" onClick={() => addToCart(a)}>
                        <div><p className="text-sm font-medium">{a.name}</p><p className="text-[10px] text-muted-foreground">{a.brand && `${a.brand} · `}Estoque: {a.quantity}</p></div>
                        <div className="text-right"><p className="text-sm font-bold text-primary">{formatCurrency(a.sale_price ?? a.cost_price)}</p><p className="text-[10px] text-muted-foreground">+ Adicionar</p></div>
                      </div>
                    )) : <p className="text-xs text-muted-foreground text-center py-8">Nenhum acessório disponível</p>}
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Carrinho</p>
                  {cart.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground text-xs border border-dashed border-border rounded-lg">Clique nos produtos para adicionar</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {cart.map(item => (
                        <div key={item.acc.id} className="rounded-lg border border-border/50 p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate flex-1">{item.acc.name}</p>
                            <Button className="h-6 w-6 p-0 bg-transparent text-destructive hover:bg-destructive/10 border-0 shadow-none shrink-0" onClick={() => updateCartQty(item.acc.id, 0)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Button className="h-7 w-7 p-0 border bg-transparent text-foreground hover:bg-muted" onClick={() => updateCartQty(item.acc.id, item.qty - 1)}>-</Button>
                              <span className="text-sm font-bold w-6 text-center">{item.qty}</span>
                              <Button className="h-7 w-7 p-0 border bg-transparent text-foreground hover:bg-muted" onClick={() => updateCartQty(item.acc.id, item.qty + 1)}>+</Button>
                            </div>
                            <Input type="number" step="0.01" value={item.price} onChange={e => updateCartPrice(item.acc.id, parseFloat(e.target.value) || 0)} className="h-7 text-xs w-24" />
                            <span className="text-sm font-bold text-primary ml-auto">{formatCurrency(item.price * item.qty)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {cart.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <div className="flex justify-between items-center"><span className="font-semibold">Total</span><span className="font-display font-bold text-lg text-primary">{formatCurrency(cartTotal)}</span></div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Loja</Label>
                        <Select value={pdvPayment.store_id} onValueChange={v => setPdvPayment({ ...pdvPayment, store_id: v })}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Cliente (opcional)</Label>
                        <Input value={pdvPayment.customer} onChange={e => setPdvPayment({ ...pdvPayment, customer: e.target.value })} placeholder="Nome do cliente" className="h-9" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[["cash","Dinheiro"], ["card","Cartão"], ["pix","PIX"]].map(([k, l]) => (
                          <div key={k} className="space-y-1">
                            <Label className="text-[10px]">{l}</Label>
                            <Input type="number" step="0.01" value={(pdvPayment as any)[k]} onChange={e => setPdvPayment({ ...pdvPayment, [k]: e.target.value })} placeholder="0.00" className="h-9 text-xs" />
                          </div>
                        ))}
                      </div>
                      <div className={`flex justify-between text-sm font-bold rounded-lg p-2 ${Math.abs(pdvRemaining) < 0.01 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                        <span>{pdvTroco > 0 ? "Troco" : "Restante"}</span>
                        <span>{formatCurrency(pdvTroco > 0 ? pdvTroco : pdvRemaining)}</span>
                      </div>
                      <Button className="w-full h-10 font-semibold" onClick={handlePdvSubmit} disabled={loading || (Math.abs(pdvRemaining) > 0.01 && pdvTroco === 0) || !activeStoreId}>
                        {loading ? "Registrando..." : `Finalizar — ${formatCurrency(cartTotal)}`}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Nova Venda */}
          <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-10" disabled={activeStoreId === "all"}>
                <Plus className="h-4 w-4" /> Nova Venda
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-display">Registrar Venda</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* ── Cliente ── */}
                <CustomerSection />

                {/* ── Produto ── */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Produto</Label>
                  <Select value={form.product_id} onValueChange={v => {
                    const prod = products.find(p => p.id === v);
                    setForm({ ...form, product_id: v, sale_price: prod?.sale_price ? String(prod.sale_price) : "" });
                  }}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Selecione o aparelho" /></SelectTrigger>
                    <SelectContent>
                      {availableProducts.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} — {p.brand} ({(storeMap.get(p.store_id) as any)?.name || "?"})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProduct && (
                  <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-0.5">
                    <p><span className="text-muted-foreground">Custo:</span> <span className="font-semibold">{formatCurrency(Number(selectedProduct.cost_price))}</span></p>
                    {selectedProduct.imei && <p><span className="text-muted-foreground">IMEI:</span> {selectedProduct.imei}</p>}
                    {salePrice > 0 && <p><span className="text-muted-foreground">Lucro estimado:</span> <span className={`font-semibold ${profit >= 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(profit)}</span></p>}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor de Venda (R$)</Label>
                    <Input type="number" step="0.01" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })} placeholder="3500.00" required className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1"><Tag className="h-3 w-3" /> Desconto (R$)</Label>
                    <Input type="number" step="0.01" min="0" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} placeholder="0.00" className="h-10" />
                  </div>
                </div>

                {discount > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-xs">
                    <span className="text-yellow-500">Valor com desconto</span>
                    <span className="font-bold text-yellow-500">{formatCurrency(salePriceAfterDiscount)}</span>
                  </div>
                )}

                {/* Trade-in */}
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <div><p className="text-sm font-medium">Aparelho na troca</p><p className="text-[11px] text-muted-foreground">Cliente entrega como parte do pagamento</p></div>
                  </div>
                  <Switch checked={form.has_trade_in} onCheckedChange={v => setForm({ ...form, has_trade_in: v })} />
                </div>

                {form.has_trade_in && (
                  <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-semibold text-primary">Dados do aparelho na troca</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label className="text-xs">Nome</Label><Input value={form.trade_in_device_name} onChange={e => setForm({ ...form, trade_in_device_name: e.target.value })} placeholder="iPhone 11 64GB" className="h-10" required={form.has_trade_in} /></div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Marca</Label>
                        <Select value={form.trade_in_device_brand} onValueChange={v => setForm({ ...form, trade_in_device_brand: v })}>
                          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                          <SelectContent>{["iPhone","Samsung","Xiaomi","Outro"].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label className="text-xs">Modelo</Label><Input value={form.trade_in_device_model} onChange={e => setForm({ ...form, trade_in_device_model: e.target.value })} placeholder="A2221" className="h-10" /></div>
                      <div className="space-y-1.5"><Label className="text-xs">IMEI</Label><Input value={form.trade_in_device_imei} onChange={e => setForm({ ...form, trade_in_device_imei: e.target.value })} placeholder="Opcional" className="h-10" /></div>
                    </div>
                    <div className="space-y-1.5"><Label className="text-xs">Valor da troca (R$)</Label><Input type="number" step="0.01" value={form.trade_in_value} onChange={e => setForm({ ...form, trade_in_value: e.target.value })} placeholder="1500.00" required={form.has_trade_in} className="h-10" /></div>
                  </div>
                )}

                {/* Pagamento */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Forma de Pagamento</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs flex items-center gap-1"><Banknote className="h-3 w-3" /> Dinheiro</Label><Input type="number" step="0.01" value={form.payment_cash} onChange={e => setForm({ ...form, payment_cash: e.target.value })} placeholder="0.00" className="h-10" /></div>
                    <div className="space-y-1.5"><Label className="text-xs flex items-center gap-1"><CreditCard className="h-3 w-3" /> Cartão</Label><Input type="number" step="0.01" value={form.payment_card} onChange={e => setForm({ ...form, payment_card: e.target.value })} placeholder="0.00" className="h-10" /></div>
                    <div className="space-y-1.5"><Label className="text-xs flex items-center gap-1"><QrCode className="h-3 w-3" /> PIX</Label><Input type="number" step="0.01" value={form.payment_pix} onChange={e => setForm({ ...form, payment_pix: e.target.value })} placeholder="0.00" className="h-10" /></div>
                  </div>

                  {cardVal > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1"><CreditCard className="h-3 w-3" /> Parcelas no Cartão</Label>
                      <Select value={form.installments} onValueChange={v => setForm({ ...form, installments: v })}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                            <SelectItem key={n} value={String(n)}>{n}x {n > 1 ? `de ${formatCurrency(cardVal / n)}` : "à vista"}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(cardVal > 0 || pixVal > 0) && (
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1"><Landmark className="h-3 w-3" /> Conta / Maquininha Destino</Label>
                      <Select value={form.destination_account_id} onValueChange={v => setForm({ ...form, destination_account_id: v })}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Selecione onde vai cair..." /></SelectTrigger>
                        <SelectContent>
                          {bankAccounts.filter(a => a.store_id === selectedProduct.store_id).map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.bank_name} ({acc.account_type})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">As taxas configuradas serão aplicadas automaticamente e refletirão no saldo disponível.</p>
                    </div>
                  )}

                  <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Valor de venda</span><span className="font-semibold">{formatCurrency(salePrice)}</span></div>
                    {discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span className="font-semibold text-yellow-500">-{formatCurrency(discount)}</span></div>}
                    {form.has_trade_in && <div className="flex justify-between"><span className="text-muted-foreground">Aparelho na troca</span><span className="font-semibold text-primary">-{formatCurrency(tradeInVal)}</span></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">Dinheiro + Cartão + PIX</span><span className="font-semibold">{formatCurrency(cashVal + cardVal + pixVal)}</span></div>
                    <div className="border-t border-border pt-1 flex justify-between">
                      <span className="font-medium">Restante</span>
                      <span className={`font-bold ${Math.abs(remaining) < 0.01 ? "text-primary" : "text-destructive"}`}>{formatCurrency(remaining)}</span>
                    </div>
                  </div>
                </div>

                {/* Garantia + Comissão */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1"><Shield className="h-3 w-3" /> Garantia (dias)</Label>
                    <Select value={form.warranty_days} onValueChange={v => setForm({ ...form, warranty_days: v })}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[7, 15, 30, 60, 90, 180, 365].map(d => <SelectItem key={d} value={String(d)}>{d} dias{d === 90 ? " (padrão)" : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Comissão (%)</Label>
                    <Input type="number" step="0.5" min="0" max="100" value={form.commission_percent} onChange={e => setForm({ ...form, commission_percent: e.target.value })} className="h-10" />
                  </div>
                </div>

                {commissionValue > 0 && (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 flex justify-between text-xs">
                    <span className="text-muted-foreground">Comissão calculada</span>
                    <span className="font-bold text-primary">{formatCurrency(commissionValue)}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Observações</Label>
                  <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Observações da venda..." className="min-h-[60px]" />
                </div>

                <Button type="submit" className="w-full h-11 font-semibold" disabled={loading || !form.product_id || Math.abs(remaining) > 0.01}>
                  {loading ? "Registrando..." : "Registrar Venda"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

      {/* Lista de vendas */}
      <div className="space-y-2">
        {pdvSales.map(tx => (
          <Card key={tx.id} className="border-border/50 shadow-lg shadow-black/10">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{tx.description}</p>
                    <Badge className="text-[10px] bg-yellow-500/15 text-yellow-500 border border-yellow-500/20 shrink-0">PDV</Badge>
                    {activeStoreId === "all" && (
                      <Badge variant="outline" className="text-[9px] bg-muted/50 border-primary/20 text-primary">
                        {(storeMap.get(tx.store_id) as any)?.name}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <p className="font-display font-bold text-sm text-primary shrink-0">{formatCurrency(Number(tx.amount))}</p>
              </div>
            </CardContent>
          </Card>
        ))}

        {sales.map(sale => {
          const product = productMap.get(sale.product_id) as any;
          const isLoading = notaLoading === sale.id;
          return (
            <Card key={sale.id} className="border-border/50 shadow-lg shadow-black/10">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{product?.name || "Aparelho"}</p>
                      {activeStoreId === "all" && (
                        <Badge variant="outline" className="text-[9px] bg-muted/50 border-primary/20 text-primary">
                          {(storeMap.get(sale.store_id) as any)?.name}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {sale.has_trade_in && <Badge className="text-[10px] bg-primary/15 text-primary border border-primary/20">Troca: {sale.trade_in_device_name}</Badge>}
                      {Number(sale.payment_cash) > 0 && <Badge className="text-[10px] border border-border bg-transparent text-foreground">💵 {formatCurrency(Number(sale.payment_cash))}</Badge>}
                      {Number(sale.payment_card) > 0 && <Badge className="text-[10px] border border-border bg-transparent text-foreground">💳 {formatCurrency(Number(sale.payment_card))}{sale.installments && sale.installments > 1 ? ` (${sale.installments}x)` : ""}</Badge>}
                      {Number(sale.payment_pix) > 0 && <Badge className="text-[10px] border border-border bg-transparent text-foreground">📱 {formatCurrency(Number(sale.payment_pix))}</Badge>}
                      {Number(sale.discount) > 0 && <Badge className="text-[10px] text-yellow-500 border border-yellow-500/30 bg-transparent">🏷️ -{formatCurrency(Number(sale.discount))}</Badge>}
                      {sale.warranty_days && sale.warranty_days !== 90 && <Badge className="text-[10px] text-blue-500 border border-blue-500/30 bg-transparent">🛡️ {sale.warranty_days}d</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {sale.customer_name ? `Cliente: ${sale.customer_name}` : "Venda avulsa"} · {sale.seller_id && profileMap.get(sale.seller_id) ? `Vendedor: ${profileMap.get(sale.seller_id)} · ` : ""} {new Date(sale.created_at).toLocaleDateString("pt-BR")}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button className="h-7 px-2 text-[10px] gap-1 border border-border bg-transparent text-foreground hover:bg-muted shadow-none"
                        onClick={() => handleGerarNota(sale, false)} disabled={isLoading}>
                        <FileText className="h-3 w-3" />{isLoading ? "Gerando..." : "Comprovante"}
                      </Button>
                      {sale.customer_phone && (
                        <Button className="h-7 px-2 text-[10px] gap-1 text-green-500 border border-green-500/30 bg-transparent hover:bg-green-500/10 shadow-none"
                          onClick={() => handleGerarNota(sale, true)} disabled={isLoading}>
                          <MessageCircle className="h-3 w-3" />WhatsApp
                        </Button>
                      )}
                      <Button className="h-7 px-2 text-[10px] gap-1 text-destructive border border-destructive/30 bg-transparent hover:bg-destructive/10 shadow-none"
                        onClick={() => { setDeleteId(sale.id); setJustification(""); setDeleteDialogOpen(true); }} disabled={loading}>
                        <Trash2 className="h-3.5 w-3.5" />Excluir
                      </Button>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display font-bold text-sm text-primary">{formatCurrency(Number(sale.sale_price))}</p>
                    {sale.has_trade_in && sale.trade_in_value && <p className="text-[10px] text-muted-foreground">Troca: {formatCurrency(Number(sale.trade_in_value))}</p>}
                    {Number(sale.commission_value) > 0 && <p className="text-[10px] text-yellow-500">Comissão: {formatCurrency(Number(sale.commission_value))}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {sales.length === 0 && pdvSales.length === 0 && (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ShoppingBag className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium text-sm">Nenhuma venda registrada</p>
            </CardContent>
          </Card>
        )}
      </div>
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Confirmar Exclusão de Venda
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Esta ação é permanente. O produto voltará para o estoque e as transações vinculadas serão removidas.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Motivo da Exclusão</Label>
              <Input 
                value={justification} 
                onChange={(e) => setJustification(e.target.value)} 
                placeholder="Ex: Erro no lançamento, cancelamento pelo cliente..." 
                required 
                className="h-10"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
              <Button 
                variant="destructive" 
                className="flex-1" 
                disabled={!justification || loading}
                onClick={async () => {
                  if (deleteId) {
                    await handleDeleteSale(deleteId, justification);
                    setDeleteDialogOpen(false);
                  }
                }}
              >
                {loading ? "Excluindo..." : "Confirmar Exclusão"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Vendas;
