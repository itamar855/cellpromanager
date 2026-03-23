import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Wrench, Clock, CheckCircle2, AlertCircle, Package, Smartphone, User, Calendar, DollarSign } from "lucide-react";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock; desc: string }> = {
  open:             { label: "Aberta",               color: "bg-blue-500/15 text-blue-400 border-blue-500/20",         icon: Clock,        desc: "Sua OS foi recebida e está na fila." },
  analyzing:        { label: "Em Análise",           color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",   icon: AlertCircle,  desc: "Nosso técnico está analisando o aparelho." },
  waiting_part:     { label: "Aguardando Peça",      color: "bg-orange-500/15 text-orange-400 border-orange-500/20",   icon: Package,      desc: "Estamos aguardando a chegada da peça." },
  repairing:        { label: "Em Reparo",            color: "bg-purple-500/15 text-purple-400 border-purple-500/20",   icon: Wrench,       desc: "O reparo está em andamento." },
  waiting_approval: { label: "Aguardando Aprovação", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",   icon: AlertCircle,  desc: "Aguardando sua aprovação para prosseguir." },
  ready:            { label: "Pronta p/ Retirada",   color: "bg-green-500/15 text-green-400 border-green-500/20",      icon: CheckCircle2, desc: "Seu aparelho está pronto! Venha retirar." },
  delivered:        { label: "Entregue",             color: "bg-muted text-muted-foreground border-border",            icon: CheckCircle2, desc: "Aparelho entregue. Obrigado pela preferência!" },
  cancelled:        { label: "Cancelada",            color: "bg-destructive/15 text-destructive border-destructive/20", icon: AlertCircle,  desc: "Esta ordem de serviço foi cancelada." },
};

const steps = ["open", "analyzing", "repairing", "ready", "delivered"];

export default function OSPublica() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from("service_orders" as any)
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error || !data) { setError(true); setLoading(false); return; }
      setOrder(data);

      if ((data as any).store_id) {
        const { data: storeData } = await supabase.from("stores").select("*").eq("id", (data as any).store_id).maybeSingle();
        setStore(storeData);
      }
      setLoading(false);
    };
    if (id) fetch();
  }, [id]);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );

  if (error || !order) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <AlertCircle className="h-12 w-12 text-destructive opacity-60" />
      <p className="font-semibold text-lg">OS não encontrada</p>
      <p className="text-sm text-muted-foreground">Verifique o link com a assistência técnica.</p>
    </div>
  );

  const sc = statusConfig[order.status] ?? statusConfig.open;
  const currentStep = steps.indexOf(order.status);
  const finalPrice = Number(order.final_price || order.estimated_price || 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Wrench className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-bold text-sm">{store?.name ?? "Assistência Técnica"}</p>
            {store?.address && <p className="text-[10px] text-muted-foreground">{store.address}</p>}
          </div>
        </div>
        <Badge variant="outline" className={`text-xs ${sc.color}`}>{sc.label}</Badge>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Hero status */}
        <Card className="border-border/50">
          <CardContent className="p-5 text-center space-y-3">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <sc.icon className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-mono">OS #{order.order_number}</p>
              <p className="font-bold text-lg mt-0.5">{sc.label}</p>
              <p className="text-sm text-muted-foreground mt-1">{sc.desc}</p>
            </div>
          </CardContent>
        </Card>

        {/* Progress bar */}
        {order.status !== "cancelled" && (
          <div className="flex items-center gap-1">
            {steps.map((step, i) => {
              const done = currentStep >= i;
              const active = currentStep === i;
              return (
                <div key={step} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`h-2 w-full rounded-full transition-colors ${done ? "bg-primary" : "bg-muted"}`} />
                  <p className={`text-[9px] text-center leading-tight ${active ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                    {statusConfig[step]?.label}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Client & device info */}
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-3 text-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <User className="h-3 w-3" /> Cliente
            </div>
            <p className="font-medium">{order.customer_name}</p>
            {order.customer_phone && <p className="text-muted-foreground text-xs">📞 {order.customer_phone}</p>}

            <div className="border-t border-border pt-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Smartphone className="h-3 w-3" /> Aparelho
            </div>
            <p className="font-medium">{order.device_brand} {order.device_model}</p>
            {order.device_color && <p className="text-muted-foreground text-xs">Cor: {order.device_color}</p>}
            {order.device_imei && <p className="text-muted-foreground text-xs">IMEI: {order.device_imei}</p>}

            <div className="border-t border-border pt-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Wrench className="h-3 w-3" /> Serviço
            </div>
            <p className="font-medium">{order.requested_service}</p>
            <p className="text-muted-foreground text-xs">{order.reported_defect}</p>

            {order.estimated_completion && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <Calendar className="h-3 w-3" />
                Previsão: {new Date(order.estimated_completion).toLocaleString("pt-BR")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Price */}
        {finalPrice > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{order.final_price ? "Valor Final" : "Valor Estimado"}</span>
              </div>
              <span className="font-display font-bold text-primary text-lg">{formatCurrency(finalPrice)}</span>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-[10px] text-muted-foreground pb-4">
          Link gerado por CellManager · {store?.name}
        </p>
      </div>
    </div>
  );
}
