import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Users, Plus, MessageCircle, Phone, Mail, Search, 
  Trash2, MoreVertical, MessageSquare, ChevronRight
} from "lucide-react";
// Placeholder for Instagram if not in lucide-react
const Instagram = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
);
import { logAction } from "@/utils/auditLogger";

type LeadStatus = 'novo' | 'atendimento' | 'negociacao' | 'concluido' | 'perdido';

const statusConfig: Record<LeadStatus, { label: string; color: string }> = {
  novo: { label: "Novo", color: "bg-blue-500/15 text-blue-500 border-blue-500/20" },
  atendimento: { label: "Em Atendimento", color: "bg-yellow-500/15 text-yellow-500 border-yellow-500/20" },
  negociacao: { label: "Negociação", color: "bg-purple-500/15 text-purple-500 border-purple-500/20" },
  concluido: { label: "Concluído", color: "bg-green-500/15 text-green-500 border-green-500/20" },
  perdido: { label: "Perdido", color: "bg-destructive/15 text-destructive border-destructive/20" },
};

const allStatuses: LeadStatus[] = ['novo', 'atendimento', 'negociacao', 'concluido', 'perdido'];

const Leads = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [responseModalOpen, setResponseModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [responseText, setResponseText] = useState("");
  const [form, setForm] = useState({
    name: "", phone: "", email: "", source: "whatsapp", status: "novo" as LeadStatus, notes: "", store_id: ""
  });
  const [stores, setStores] = useState<any[]>([]);

  const fetchData = async () => {
    const { data: leadsData } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    const { data: storesData } = await supabase.from("stores").select("*");
    setLeads(leadsData ?? []);
    setStores(storesData ?? []);
  };

  useEffect(() => {
    fetchData();

    // Configurar Realtime para atualizações automáticas
    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("leads").insert({
      ...form,
      created_by: user.id,
      store_id: form.store_id || null
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Lead cadastrado!");
      setDialogOpen(false);
      setForm({ name: "", phone: "", email: "", source: "whatsapp", status: "novo", notes: "", store_id: "" });
      fetchData();
    }
    setLoading(false);
  };

  const updateStatus = async (leadId: string, newStatus: LeadStatus) => {
    const { error } = await supabase.from("leads").update({ status: newStatus }).eq("id", leadId);
    if (error) toast.error(error.message);
    else {
      toast.success(`Status atualizado para ${statusConfig[newStatus].label}`);
      fetchData();
    }
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("leadId", leadId);
  };

  const handleDrop = (e: React.DragEvent, newStatus: LeadStatus) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("leadId");
    if (leadId) updateStatus(leadId, newStatus);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleResponse = (lead: any) => {
    setSelectedLead(lead);
    setResponseModalOpen(true);
    setResponseText(`Olá ${lead.name.split(' ')[0]}! Vi que você se interessou pela nossa loja...`);
  };

  const sendResponse = () => {
    if (!selectedLead) return;
    
    const phone = selectedLead.phone?.replace(/\D/g, "");
    const message = encodeURIComponent(responseText);

    if (selectedLead.source === 'whatsapp') {
      if (phone) {
        window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
        toast.success("Abrindo WhatsApp Web...");
        updateStatus(selectedLead.id, 'atendimento');
      } else {
        toast.error("Este lead não possui telefone cadastrado.");
      }
    } else if (selectedLead.source === 'instagram') {
      // Instagram doesn't have a direct "wa.me" equivalent for DM with text easily,
      // but we can open the profile or a general DM link.
      toast.info("Para Instagram, responda diretamente pelo App ou Web. Capture o lead para registro.");
      window.open(`https://www.instagram.com/direct/inbox/`, "_blank");
      updateStatus(selectedLead.id, 'atendimento');
    }
    
    setResponseModalOpen(false);
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">CRM de Leads</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{leads.length} leads no funil</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 h-10"><Plus className="h-4 w-4" /> Novo Lead</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar Lead</DialogTitle></DialogHeader>
            <form onSubmit={handleCreateLead} className="space-y-3">
              <div className="space-y-1.5"><Label className="text-xs">Nome</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="h-10" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Telefone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="(87) 99999-9999" className="h-10" /></div>
                <div className="space-y-1.5"><Label className="text-xs">E-mail</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email" className="h-10" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Origem</Label>
                  <Select value={form.source} onValueChange={v => setForm({...form, source: v})}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="trafego_pago">Tráfego Pago</SelectItem><SelectItem value="indicacao">Indicação</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Loja</Label>
                  <Select value={form.store_id} onValueChange={v => setForm({...form, store_id: v})}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Observações</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="min-h-[80px]" /></div>
              <Button type="submit" className="w-full h-11" disabled={loading}>{loading ? "Salvando..." : "Cadastrar Lead"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {leads.length === 0 && (
        <Card className="bg-primary/5 border-dashed border-primary/30">
          <CardContent className="p-6 text-center space-y-3">
            <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
              <Plus className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-bold text-lg">Seu funil está vazio</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Use a nossa <strong>Extensão do Chrome</strong> no WhatsApp Web ou Instagram para capturar leads com um clique, ou clique em "Novo Lead" para adicionar manualmente.
            </p>
            <div className="flex justify-center gap-4 pt-2">
              <div className="text-xs flex items-center gap-1.5"><Badge variant="outline" className="h-5">1</Badge> Capture no WhatsApp</div>
              <div className="text-xs flex items-center gap-1.5"><Badge variant="outline" className="h-5">2</Badge> Gerencie no Kanban</div>
              <div className="text-xs flex items-center gap-1.5"><Badge variant="outline" className="h-5">3</Badge> Responda e Venda!</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 items-start flex-1 min-h-[500px] scrollbar-thin">
        {allStatuses.map(status => (
          <div 
            key={status} 
            className="flex-shrink-0 w-[280px] flex flex-col gap-3 rounded-xl bg-muted/30 p-3 border border-border/40 min-h-[400px]"
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, status)}
          >
            <div className="flex items-center justify-between px-1">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Badge className={`h-2 w-2 rounded-full p-0 ${statusConfig[status].color.split(' ')[0]}`} />
                {statusConfig[status].label}
              </h3>
              <Badge variant="secondary" className="text-[10px] bg-muted/50">{leads.filter(l => l.status === status).length}</Badge>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1">
              {leads.filter(l => l.status === status).length === 0 && (
                <div className="h-20 border-2 border-dashed border-border/30 rounded-xl flex items-center justify-center text-muted-foreground/20 text-[10px]">
                  Arraste leads aqui
                </div>
              )}
              {leads.filter(l => l.status === status).map(lead => (
                <Card 
                  key={lead.id} 
                  draggable 
                  onDragStart={e => handleDragStart(e, lead.id)}
                  className="cursor-pointer border-border/40 hover:border-primary/50 transition-all shadow-sm hover:shadow-md active:scale-[0.98] group"
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <p className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">{lead.name}</p>
                      {lead.source === 'whatsapp' ? <MessageCircle className="h-3 w-3 text-green-500" /> : <Instagram className="h-3 w-3 text-pink-500" />}
                    </div>
                    {lead.phone && <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Phone className="h-2.5 w-2.5" /> {lead.phone}</div>}
                    {lead.notes && <p className="text-[10px] text-muted-foreground line-clamp-2 italic">"{lead.notes}"</p>}
                    
                    <div className="flex items-center justify-between pt-2 border-t border-border/40">
                      <span className="text-[9px] text-muted-foreground">{new Date(lead.created_at).toLocaleDateString("pt-BR")}</span>
                      <Button 
                        size="icon" 
                        className="h-7 w-7 bg-primary text-white rounded-full shadow-lg shadow-primary/20 hover:scale-110 transition-transform"
                        onClick={() => handleResponse(lead)}
                      >
                        <MessageSquare className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Response Integrated Modal */}
      <Dialog open={responseModalOpen} onOpenChange={setResponseModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" /> Responder Lead</DialogTitle></DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                <p className="text-sm font-semibold">{selectedLead.name}</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedLead.phone}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 uppercase font-bold text-[9px]"><ChevronRight className="h-3 w-3" /> {selectedLead.source}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Sua Resposta</Label>
                <Textarea 
                  value={responseText} 
                  onChange={e => setResponseText(e.target.value)} 
                  placeholder="Escreva sua mensagem aqui..."
                  className="min-h-[120px] text-sm focus:ring-primary shadow-inner"
                />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 h-11 gap-2 font-bold" onClick={sendResponse}>
                  <MessageCircle className="h-4 w-4" /> Enviar Mensagem
                </Button>
                <Button variant="outline" className="h-11" onClick={() => setResponseModalOpen(false)}>Cancelar</Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                A extensão do navegador será usada para processar o envio automático.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Leads;
