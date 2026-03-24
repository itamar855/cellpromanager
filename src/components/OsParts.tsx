import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plus, Trash2, Loader2, Cpu } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  brand: string;
  model: string;
  cost_price: number;
  sale_price: number | null;
}

interface ServiceOrderItem {
  id: string;
  service_order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  created_at: string;
  products?: {
    name: string;
    brand: string;
    model: string;
  };
}

interface OsPartsProps {
  orderId: string;
  storeId: string;
  readonly?: boolean;
}

const formatMonetary = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function OsParts({ orderId, storeId, readonly = false }: OsPartsProps) {
  const [items, setItems] = useState<ServiceOrderItem[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch parts used in this OS
      const { data: itemsData, error: itemsError } = await supabase
        .from("service_order_items" as any)
        .select(`*, products (name, brand, model)`)
        .eq("service_order_id", orderId);

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      // Fetch available parts in stock for this store
      if (!readonly && storeId) {
        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select("id, name, brand, model, cost_price, sale_price")
          .eq("store_id", storeId)
          .eq("status", "em_estoque") // Assuming parts are kept individually with this status
          .in("product_type", ["peca", "acessorio", "outro"]); // Assuming type categorizes parts

        if (productsError) throw productsError;
        setAvailableProducts(productsData || []);
      }
    } catch (error: any) {
      console.error("Error fetching parts:", error);
      toast.error("Erro ao carregar peças da OS");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) fetchData();
  }, [orderId, storeId, readonly]);

  const handleAddPart = async () => {
    if (!selectedProductId) return;
    
    const product = availableProducts.find(p => p.id === selectedProductId);
    if (!product) return;

    setAdding(true);
    try {
      // Begin logical transaction via RPC or sequentially
      // 1. Update product status to indicate it was used in OS
      const { error: prodError } = await supabase
        .from("products")
        .update({ status: "usado_os" })
        .eq("id", selectedProductId)
        .eq("status", "em_estoque"); // Optimistic locking

      if (prodError) throw new Error("Erro ao baixar produto do estoque.");

      // 2. Insert into service_order_items
      const { error: itemError } = await supabase
        .from("service_order_items" as any)
        .insert({
          service_order_id: orderId,
          product_id: selectedProductId,
          quantity: 1,
          unit_price: product.sale_price || product.cost_price * 1.5,
          unit_cost: product.cost_price
        });

      if (itemError) {
        // Rollback product status if insert fails
        await supabase.from("products").update({ status: "em_estoque" }).eq("id", selectedProductId);
        throw itemError;
      }

      toast.success("Peça adicionada e baixada do estoque.");
      setSelectedProductId("");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar peça.");
    } finally {
      setAdding(false);
    }
  };

  const handleRemovePart = async (itemId: string, productId: string) => {
    try {
      // 1. Delete from service_order_items
      const { error: itemError } = await supabase
        .from("service_order_items" as any)
        .delete()
        .eq("id", itemId);

      if (itemError) throw itemError;

      // 2. Return product to stock
      const { error: prodError } = await supabase
        .from("products")
        .update({ status: "em_estoque" })
        .eq("id", productId);

      if (prodError) throw new Error("Peça removida da OS, mas erro ao retornar ao estoque principal.");

      toast.success("Peça removida e retornada ao estoque.");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover peça.");
    }
  };

  if (loading) return <div className="text-muted-foreground text-xs"><Loader2 className="h-4 w-4 animate-spin" /></div>;

  const totalCost = items.reduce((acc, item) => acc + (item.unit_cost * item.quantity), 0);
  const totalCharge = items.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);

  return (
    <div className="space-y-4 rounded-lg bg-card border border-border p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5" /> Peças Utilizadas ({items.length})
        </p>
      </div>

      {!readonly && (
        <div className="flex items-end gap-2 bg-muted/20 p-3 rounded-lg border border-border/50">
          <div className="flex-1 space-y-1.5">
            <Label className="text-[10px] uppercase">Vincular Peça do Estoque</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Selecione uma peça em estoque..." />
              </SelectTrigger>
              <SelectContent>
                {availableProducts.length === 0 ? (
                  <SelectItem value="none" disabled className="text-xs">Nenhuma peça no estoque desta loja.</SelectItem>
                ) : (
                  availableProducts.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-xs flexjustify-between">
                      {p.name} {p.brand} {p.model} - Custo: {formatMonetary(p.cost_price)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button 
            size="sm" 
            className="h-8 shrink-0" 
            onClick={handleAddPart} 
            disabled={!selectedProductId || selectedProductId === "none" || adding}
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-4 border border-dashed rounded bg-muted/10 text-muted-foreground">
          <Package className="h-5 w-5 mx-auto opacity-30 mb-1" />
          <p className="text-[10px]">Nenhuma peça vinculada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between text-xs p-2 rounded border border-border/50 bg-background group">
              <div>
                <p className="font-medium">{item.products?.name} {item.products?.brand}</p>
                <p className="text-[10px] text-muted-foreground">Custo: {formatMonetary(item.unit_cost)} · Cobrado: {formatMonetary(item.unit_price)}</p>
              </div>
              
              {!readonly && (
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemovePart(item.id, item.product_id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
          
          <div className="flex justify-between items-center text-[10px] bg-muted/50 p-2 rounded-md font-semibold text-muted-foreground">
            <span>Total Custo Peças: {formatMonetary(totalCost)}</span>
            <span>Repasse: {formatMonetary(totalCharge)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
