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
import { Plus, Store, MapPin } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const statusLabels: Record<string, string> = {
  active: "Ativa", inactive: "Inativa", renovation: "Em reforma", development: "Em desenvolvimento",
};
const statusColors: Record<string, string> = {
  active: "bg-primary/15 text-primary border-primary/20",
  inactive: "bg-muted text-muted-foreground border-border",
  renovation: "bg-accent/15 text-accent border-accent/20",
  development: "bg-secondary text-secondary-foreground border-border",
};

const Lojas = () => {
  const { userRole } = useAuth();
  const [stores, setStores] = useState<Tables<"stores">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", status: "active" });

  const fetchStores = async () => {
    const { data } = await supabase.from("stores").select("*").order("created_at");
    setStores(data ?? []);
  };

  useEffect(() => { fetchStores(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("stores").insert({
      name: form.name, address: form.address || null, status: form.status,
    });
    if (error) { toast.error(error.message); }
    else {
      toast.success("Loja cadastrada!");
      setDialogOpen(false);
      setForm({ name: "", address: "", status: "active" });
      fetchStores();
    }
    setLoading(false);
  };

  const isAdmin = userRole === "admin";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Lojas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Seus pontos comerciais</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-10"><Plus className="h-4 w-4" /> Nova Loja</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Cadastrar Loja</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Loja Centro" required className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Endereço</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua das Flores, 123" className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="inactive">Inativa</SelectItem>
                      <SelectItem value="renovation">Em reforma</SelectItem>
                      <SelectItem value="development">Em desenvolvimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                  {loading ? "Salvando..." : "Cadastrar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stores.length > 0 ? (
          stores.map((store) => (
            <Card key={store.id} className="border-border/50 shadow-lg shadow-black/10">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-lg bg-primary/15 p-2 shrink-0">
                      <Store className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-semibold text-sm truncate">{store.name}</h3>
                      {store.address && (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{store.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${statusColors[store.status]}`}>
                    {statusLabels[store.status]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="col-span-full border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Store className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium text-sm">Nenhuma loja cadastrada</p>
              <p className="text-xs mt-1">{isAdmin ? "Cadastre sua primeira loja" : "Peça ao admin para cadastrar"}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Lojas;
