import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Users, Phone, Mail, MapPin, ShoppingBag, Wrench } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const Clientes = () => {
  const [customers, setCustomers] = useState<Tables<"customers">[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Tables<"customers"> | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [custRes, salesRes, ordersRes, prodsRes] = await Promise.all([
        supabase.from("customers").select("*").order("created_at", { ascending: false }),
        supabase.from("sales").select("*"),
        supabase.from("service_orders").select("*"),
        supabase.from("products").select("id, name"),
      ]);
      setCustomers(custRes.data ?? []);
      setSales(salesRes.data ?? []);
      setOrders(ordersRes.data ?? []);
      setProducts(prodsRes.data ?? []);
    };
    fetchData();
  }, []);

  const productMap = new Map(products.map((p: any) => [p.id, p.name]));

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(search)) ||
      (c.cpf && c.cpf.includes(search)) ||
      (c.email && c.email.toLowerCase().includes(q));
  });

  const getCustomerSales = (customer: Tables<"customers">) =>
    sales.filter((s) =>
      (s.customer_name && s.customer_name.toLowerCase() === customer.name.toLowerCase()) ||
      (s.customer_phone && customer.phone && s.customer_phone === customer.phone)
    );

  const getCustomerOrders = (customer: Tables<"customers">) =>
    orders.filter((o) =>
      o.customer_id === customer.id ||
      (o.customer_name && o.customer_name.toLowerCase() === customer.name.toLowerCase()) ||
      (o.customer_phone && customer.phone && o.customer_phone === customer.phone)
    );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Clientes</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{customers.length} clientes cadastrados</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, telefone, CPF ou e-mail..." className="pl-9 h-10" />
      </div>

      <div className="space-y-2">
        {filtered.length > 0 ? (
          filtered.map((customer) => {
            const custSales = getCustomerSales(customer);
            const custOrders = getCustomerOrders(customer);
            return (
              <Card
                key={customer.id}
                className="border-border/50 shadow-lg shadow-black/10 cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => setSelected(customer)}
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{customer.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {customer.phone && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Phone className="h-2.5 w-2.5" /> {customer.phone}
                          </span>
                        )}
                        {customer.cpf && (
                          <span className="text-[10px] text-muted-foreground">{customer.cpf}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {custSales.length > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-primary/15 text-primary border-primary/20">
                        {custSales.length} venda{custSales.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                    {custOrders.length > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-accent/15 text-accent border-accent/20">
                        {custOrders.length} OS
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium text-sm">Nenhum cliente encontrado</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Customer detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          {selected && (() => {
            const custSales = getCustomerSales(selected);
            const custOrders = getCustomerOrders(selected);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display">{selected.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Contact info */}
                  <div className="space-y-1.5">
                    {selected.phone && (
                      <p className="text-sm flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {selected.phone}</p>
                    )}
                    {selected.email && (
                      <p className="text-sm flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {selected.email}</p>
                    )}
                    {selected.address && (
                      <p className="text-sm flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {selected.address}</p>
                    )}
                    {selected.cpf && (
                      <p className="text-sm text-muted-foreground">CPF: {selected.cpf}</p>
                    )}
                  </div>

                  {/* Sales history */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <ShoppingBag className="h-3 w-3" /> Histórico de Compras ({custSales.length})
                    </p>
                    {custSales.length > 0 ? custSales.map((sale) => (
                      <div key={sale.id} className="rounded-lg bg-muted/50 p-2.5 text-xs">
                        <div className="flex justify-between">
                          <span className="font-medium">{productMap.get(sale.product_id) || "Produto"}</span>
                          <span className="font-bold text-primary">{formatCurrency(Number(sale.sale_price))}</span>
                        </div>
                        <p className="text-muted-foreground mt-0.5">
                          {new Date(sale.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    )) : (
                      <p className="text-xs text-muted-foreground">Nenhuma compra registrada</p>
                    )}
                  </div>

                  {/* Service orders history */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Wrench className="h-3 w-3" /> Ordens de Serviço ({custOrders.length})
                    </p>
                    {custOrders.length > 0 ? custOrders.map((order) => (
                      <div key={order.id} className="rounded-lg bg-muted/50 p-2.5 text-xs">
                        <div className="flex justify-between">
                          <span className="font-medium">OS #{order.order_number} - {order.device_brand} {order.device_model}</span>
                          <Badge variant="outline" className="text-[10px]">{order.status}</Badge>
                        </div>
                        <p className="text-muted-foreground mt-0.5">
                          {order.requested_service} · {new Date(order.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    )) : (
                      <p className="text-xs text-muted-foreground">Nenhuma OS registrada</p>
                    )}
                  </div>

                  {selected.notes && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações</p>
                      <p className="text-sm mt-1">{selected.notes}</p>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clientes;
