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
  Trash2, MoreVertical, MessageSquare, ChevronRight, Download,
  MessageCircle, Phone, Plus, Users, Mail, Search, Shield,
  Image as ImageIcon, Mic, Send, Paperclip, UserPlus, Filter,
  Play, Pause, X, CheckCheck, Clock
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
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
  const { user, userRole, userPermissions } = useAuth();
  
  if (userRole !== "admin" && !userPermissions?.leads) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-muted-foreground">
        <Shield className="h-12 w-12 mb-4 opacity-20" />
        <h2 className="text-xl font-semibold">Acesso Restrito</h2>
        <p>Você não tem permissão para acessar o CRM.</p>
      </div>
    );
  }

  const isAdmin = userRole === "admin" || userRole === "gerente";
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [responseModalOpen, setResponseModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [responseText, setResponseText] = useState("");
  const [form, setForm] = useState({
    name: "", phone: "", email: "", source: "whatsapp", status: "novo" as LeadStatus, notes: "", store_id: "", assigned_to: ""
  });
  const [stores, setStores] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStore, setFilterStore] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterVendedor, setFilterVendedor] = useState("all");
  const [editModalOpen, setEditModalOpen] = useState(false);
  
  // Media states
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const fetchData = async () => {
    let query = supabase.from("leads").select(`
      *,
      assigned_user:profiles!leads_assigned_to_fkey(display_name)
    `).order("last_message_at", { ascending: false, nullsFirst: false });

    // Multi-agent filtering: only see assigned leads if not admin/gerente
    if (userRole !== "admin" && userRole !== "gerente") {
      query = query.eq("assigned_to", user?.id);
    }

    const { data: leadsData } = await query;
    const { data: storesData } = await supabase.from("stores").select("*");
    const { data: profilesData } = await supabase.from("profiles").select("user_id, display_name");

    setLeads(leadsData ?? []);
    setStores(storesData ?? []);
    setVendedores(profilesData ?? []);
  };

  const fetchMessages = async (leadId: string) => {
    const { data } = await supabase
      .from("lead_messages")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });
    setChatMessages(data ?? []);
  };

  useEffect(() => {
    fetchData();

    console.log("Subscribing to realtime...");
    const leadsChannel = supabase
      .channel('leads-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (p) => {
        console.log("Lead change detected!", p);
        fetchData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_messages' }, (payload) => {
        console.log("Message change detected!", payload);
        if (selectedLead && payload.new.lead_id === selectedLead.id) {
          fetchMessages(selectedLead.id);
        }
      })
      .subscribe((status) => {
        console.log("Realtime subscription status:", status);
      });

    return () => {
      console.log("Unsubscribing from realtime...");
      supabase.removeChannel(leadsChannel);
    };
  }, [selectedLead?.id]); // Only re-subscribe if the selected lead ID changes

  useEffect(() => {
    const scrollContainer = document.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [chatMessages, chatModalOpen]);

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
      setForm({ name: "", phone: "", email: "", source: "whatsapp", status: "novo", notes: "", store_id: "", assigned_to: "" });
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

  const handleEditLead = (lead: any) => {
    setSelectedLead(lead);
    setForm({
      name: lead.name,
      phone: lead.phone || "",
      email: lead.email || "",
      source: lead.source,
      status: lead.status,
      notes: lead.notes || "",
      store_id: lead.store_id || "",
      assigned_to: lead.assigned_to || ""
    });
    setEditModalOpen(true);
  };

  const saveEditLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    setLoading(true);
    const { error } = await supabase.from("leads").update({
      name: form.name,
      phone: form.phone,
      email: form.email,
      source: form.source,
      notes: form.notes,
      store_id: form.store_id || null,
      assigned_to: form.assigned_to || null
    }).eq("id", selectedLead.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Lead atualizado!");
      setEditModalOpen(false);
      fetchData();
    }
    setLoading(false);
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (lead.phone && lead.phone.includes(searchTerm));
    const matchesStore = filterStore === "all" || lead.store_id === filterStore;
    const matchesSource = filterSource === "all" || lead.source === filterSource;
    const matchesVendedor = filterVendedor === "all" || lead.assigned_to === filterVendedor;
    return matchesSearch && matchesStore && matchesSource && matchesVendedor;
  });

  const kpis = {
    total: leads.length,
    newToday: leads.filter(l => new Date(l.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length,
    atendimento: leads.filter(l => l.status === 'atendimento').length,
    concluded: leads.filter(l => l.status === 'concluido').length,
    conversion: leads.length > 0 ? Math.round((leads.filter(l => l.status === 'concluido').length / leads.length) * 100) : 0
  };

  const handleResponse = (lead: any) => {
    setSelectedLead(lead);
    setResponseModalOpen(true);
    setResponseText("");
  };

  const handleDeleteLead = async (leadId: string, leadName: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o lead ${leadName}? Esta ação não pode ser desfeita.`)) {
      const { error } = await supabase.from("leads").delete().eq("id", leadId);
      if (error) {
        toast.error("Erro ao excluir: " + error.message);
      } else {
        toast.success("Lead excluído com sucesso!");
        logAction?.("DELETE_RECORD", "Leads", leadId);
        setLeads(prev => prev.filter(l => l.id !== leadId));
      }
    }
  };

  const sendResponse = async () => {
    if (!selectedLead || !responseText.trim()) return;
    
    setLoading(true);
    try {
      let currentPhone = selectedLead.phone;
      if (!currentPhone && form.phone) {
        const { data: updatedLead } = await supabase
          .from("leads")
          .update({ phone: form.phone })
          .eq("id", selectedLead.id)
          .select()
          .single();
        if (updatedLead) {
          currentPhone = updatedLead.phone;
          setSelectedLead(updatedLead);
        }
      }

      if (!currentPhone) throw new Error("Telefone do lead é necessário.");

      // Check for direct WhatsApp API config
      const { data: waConfig } = await supabase.from("whatsapp_config").select("id").eq("is_active", true).maybeSingle();

      if (waConfig) {
        // Use Direct API
        let mediaUrlToUpload = null;
        let finalMessageType = 'text';

        if (imageFile) {
          const path = `chat/${Date.now()}_${imageFile.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage.from("chat_media").upload(path, imageFile);
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from("chat_media").getPublicUrl(uploadData.path);
          mediaUrlToUpload = urlData.publicUrl;
          finalMessageType = 'image';
        } else if (audioBlob) {
          const path = `chat/${Date.now()}.ogg`;
          const { data: uploadData, error: uploadError } = await supabase.storage.from("chat_media").upload(path, audioBlob);
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from("chat_media").getPublicUrl(uploadData.path);
          mediaUrlToUpload = urlData.publicUrl;
          finalMessageType = 'audio';
        }

        const { data: callRes, error: callError } = await supabase.functions.invoke('whatsapp-send', {
          body: {
            phone: currentPhone,
            content: responseText,
            messageType: finalMessageType,
            mediaUrl: mediaUrlToUpload,
            leadId: selectedLead.id,
            userId: user?.id
          }
        });

        if (callError) throw callError;
        toast.success("Mensagem enviada via API!");
      } else {
        // Fallback or old logic (Lead Responses table for extension)
        const { error: queueError } = await (supabase as any).from("lead_responses")
          .insert({
            lead_id: selectedLead.id,
            content: responseText,
            status: 'pending'
          });

        if (queueError) throw queueError;
        toast.success("Enviado para a fila da extensão.");
      }
      
      // 3. Mark as atendimento if it was novo
      if (selectedLead.status === 'novo') {
        await updateStatus(selectedLead.id, 'atendimento');
      }

      setResponseModalOpen(false);
      setResponseText("");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex flex-col gap-4 border-b pb-4 mb-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-white">CRM de Leads</h1>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 h-9 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
              onClick={() => window.open(`https://github.com/itamar855/cellpromanager/archive/refs/heads/main.zip`, '_blank')}
            >
              <Download className="h-4 w-4" /> Instalar Extensão
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 h-9 shadow-lg shadow-primary/20"><Plus className="h-4 w-4" /> Novo Lead</Button>
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
                        <Label className="text-xs">Responsável</Label>
                        <Select value={form.assigned_to} onValueChange={v => setForm({...form, assigned_to: v})}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Atribuir a..." /></SelectTrigger>
                          <SelectContent>
                            {vendedores.map(v => <SelectItem key={v.user_id} value={v.user_id}>{v.display_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Loja</Label>
                      <Select value={form.store_id} onValueChange={v => setForm({...form, store_id: v})}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  <div className="space-y-1.5"><Label className="text-xs">Observações</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="min-h-[80px]" /></div>
                  <Button type="submit" className="w-full h-11" disabled={loading}>{loading ? "Salvando..." : "Cadastrar Lead"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-muted/30 border-border/40"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Leads</p><p className="text-xl font-bold text-white">{kpis.total}</p></CardContent></Card>
          <Card className="bg-muted/30 border-border/40"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Novos (24h)</p><p className="text-xl font-bold text-blue-400">{kpis.newToday}</p></CardContent></Card>
          <Card className="bg-muted/30 border-border/40"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Conversão</p><p className="text-xl font-bold text-green-400">{kpis.conversion}%</p></CardContent></Card>
          <Card className="bg-muted/30 border-border/40"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Concluídos</p><p className="text-xl font-bold text-purple-400">{kpis.concluded}</p></CardContent></Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar por nome ou telefone..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="pl-9 h-10 bg-muted/20 border-border/40 focus:bg-muted/40 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filterVendedor} onValueChange={setFilterVendedor}>
              <SelectTrigger className="w-[140px] h-10 bg-muted/20 border-border/40"><SelectValue placeholder="Vendedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Vendedores</SelectItem>
                {vendedores.map(v => <SelectItem key={v.user_id} value={v.user_id}>{v.display_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStore} onValueChange={setFilterStore}>
              <SelectTrigger className="w-[140px] h-10 bg-muted/20 border-border/40"><SelectValue placeholder="Loja" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas Lojas</SelectItem>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-[140px] h-10 bg-muted/20 border-border/40"><SelectValue placeholder="Origem" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas Origens</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="trafego_pago">Tráfego Pago</SelectItem><SelectItem value="indicacao">Indicação</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
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
              <Badge variant="secondary" className="text-[10px] bg-muted/50">{filteredLeads.filter(l => l.status === status).length}</Badge>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1">
              {filteredLeads.filter(l => l.status === status).length === 0 && (
                <div className="h-20 border-2 border-dashed border-border/30 rounded-xl flex items-center justify-center text-muted-foreground/20 text-[10px]">
                  {searchTerm ? "Nenhum resultado" : "Arraste leads aqui"}
                </div>
              )}
              {filteredLeads.filter(l => l.status === status).map(lead => (
                <Card 
                  key={lead.id} 
                  draggable 
                  onDragStart={e => handleDragStart(e, lead.id)}
                  className="cursor-pointer border-border/40 hover:border-primary/50 transition-all shadow-sm hover:shadow-md active:scale-[0.98] group"
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">{lead.name}</p>
                        {(lead as any).has_unread && (
                          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                        )}
                      </div>
                      {lead.source === 'whatsapp' ? <MessageCircle className="h-3 w-3 text-green-500" /> : <Instagram className="h-3 w-3 text-pink-500" />}
                    </div>
                    {lead.phone && <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Phone className="h-2.5 w-2.5" /> {lead.phone}</div>}
                    <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground mt-1">
                      <Users className="h-2.5 w-2.5" /> 
                      {lead.assigned_user?.display_name || "Sem Responsável"}
                    </div>
                    {lead.notes && <p className="text-[10px] text-muted-foreground line-clamp-2 italic">"{lead.notes}"</p>}
                    
                    <div className="flex items-center justify-between pt-2 border-t border-border/40">
                      <div className="flex gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost"
                          className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={() => {
                            setSelectedLead(lead);
                            setChatModalOpen(true);
                            fetchMessages(lead.id);
                          }}
                        >
                          <MessageSquare className="h-3 w-3" />
                        </Button>
                        {isAdmin && (
                          <Button 
                            size="icon" 
                            variant="ghost"
                            className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={() => handleEditLead(lead)}
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        )}
                        <Button 
                          size="icon" 
                          variant="ghost"
                          className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={() => handleResponse(lead)}
                        >
                          <MessageCircle className="h-3 w-3 text-green-500" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLead(lead.id, lead.name);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="text-[9px] text-muted-foreground">{new Date(lead.created_at).toLocaleDateString("pt-BR")}</span>
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
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    {selectedLead.phone ? (
                      <span className="text-xs">{selectedLead.phone}</span>
                    ) : (
                      <Input 
                        placeholder="Digite o WhatsApp (com DDD)" 
                        className="h-8 text-xs" 
                        value={form.phone}
                        onChange={e => setForm({...form, phone: e.target.value})}
                      />
                    )}
                  </div>
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

      {/* Edit Lead Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Lead: {selectedLead?.name}</DialogTitle></DialogHeader>
          <form onSubmit={saveEditLead} className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">Nome</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="h-10" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Telefone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="h-10" /></div>
              <div className="space-y-1.5"><Label className="text-xs">E-mail</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email" className="h-10" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Origem</Label>
                <Select value={form.source} onValueChange={v => setForm({...form, source: v})}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="trafego_pago">Tráfego Pago</SelectItem><SelectItem value="indicacao">Indicação</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Responsável</Label>
                <Select value={form.assigned_to} onValueChange={v => setForm({...form, assigned_to: v})}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Atribuir a..." /></SelectTrigger>
                  <SelectContent>
                    {vendedores.map(v => <SelectItem key={v.user_id} value={v.user_id}>{v.display_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Loja</Label>
              <Select value={form.store_id} onValueChange={v => setForm({...form, store_id: v})}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Observações</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="min-h-[80px]" /></div>
            <Button type="submit" className="w-full h-11" disabled={loading}>{loading ? "Salvando..." : "Salvar Alterações"}</Button>
            <Button type="button" variant="outline" className="w-full h-11" onClick={() => {
              setEditModalOpen(false);
              handleResponse(selectedLead);
            }}>Pular para Responder</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Chat History Modal (Restored) */}
      <Dialog open={chatModalOpen} onOpenChange={setChatModalOpen}>
        <DialogContent className="max-w-md h-[600px] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-muted/30">
            <DialogTitle className="flex items-center justify-between w-full pr-6">
              <div className="flex items-center gap-2">
                {selectedLead?.source === 'whatsapp' ? <MessageCircle className="h-5 w-5 text-green-500" /> : <Instagram className="h-5 w-5 text-pink-500" />}
                Conversa com {selectedLead?.name}
              </div>
              <Badge variant="outline" className="animate-pulse bg-green-500/10 text-green-500 border-green-500/20 text-[10px]">
                LIVE SYNC
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-4 bg-muted/10">
            <div className="space-y-3 pb-4">
              {chatMessages.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  Nenhuma mensagem capturada ainda. <br/> Use o botão "Enviar p/ CRM" na extensão para sincronizar.
                </div>
              ) : (
                chatMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'vendedor' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm relative group ${
                      msg.sender === 'vendedor' 
                      ? 'bg-primary/20 text-foreground rounded-tr-none border border-primary/20' 
                      : 'bg-muted border text-slate-700 rounded-tl-none'
                    }`}>
                      {msg.message_type === 'image' ? (
                        <div className="space-y-1">
                          <img src={msg.media_url} className="rounded-lg max-h-60 object-cover cursor-pointer hover:opacity-90" onClick={() => window.open(msg.media_url, '_blank')} />
                          {msg.content && <p>{msg.content}</p>}
                        </div>
                      ) : msg.message_type === 'audio' ? (
                        <div className="flex items-center gap-2 bg-black/5 p-2 rounded-lg min-w-[200px]">
                          <Mic className="h-4 w-4 text-primary" />
                          <audio controls src={msg.media_url} className="h-8 max-w-full" />
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                      
                      <div className={`text-[8px] mt-1 opacity-60 flex items-center gap-1 ${msg.sender === 'vendedor' ? 'justify-end' : ''}`}>
                        {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                        {msg.sender === 'vendedor' && <CheckCheck className="h-2.5 w-2.5 text-blue-500" />}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <footer className="p-3 border-t bg-muted/20">
            <div className="flex flex-col gap-2">
              {imageFile && (
                <div className="flex items-center gap-2 bg-primary/10 p-2 rounded-lg text-xs">
                  <ImageIcon className="h-4 w-4" /> 
                  <span className="truncate">{imageFile.name}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => setImageFile(null)}><X className="h-3 w-3" /></Button>
                </div>
              )}
              {audioBlob && (
                <div className="flex items-center gap-2 bg-primary/10 p-2 rounded-lg text-xs">
                  <Mic className="h-4 w-4" /> 
                  <span>Áudio gravado pronto p/ envio</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => setAudioBlob(null)}><X className="h-3 w-3" /></Button>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <input type="file" id="chat-img" className="hidden" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => document.getElementById('chat-img')?.click()}>
                  <Paperclip className="h-5 w-5" />
                </Button>
                
                <Input 
                  placeholder="Escrava uma mensagem..." 
                  value={responseText} 
                  onChange={e => setResponseText(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendResponse()}
                  className="flex-1"
                />
                
                <Button 
                  variant={recording ? "destructive" : "ghost"} 
                  size="icon" 
                  className={`h-9 w-9 ${recording ? 'animate-pulse' : 'text-muted-foreground'}`}
                  onClick={() => {
                    if (recording) {
                      mediaRecorder?.stop();
                      setRecording(false);
                    } else {
                      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                        const mr = new MediaRecorder(stream);
                        const chunks: any = [];
                        mr.ondataavailable = e => chunks.push(e.data);
                        mr.onstop = () => {
                          const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
                          setAudioBlob(blob);
                        };
                        mr.start();
                        setMediaRecorder(mr);
                        setRecording(true);
                      });
                    }
                  }}
                >
                  <Mic className="h-5 w-5" />
                </Button>
                
                <Button 
                  size="icon" 
                  className="h-9 w-9" 
                  disabled={loading || (!responseText.trim() && !imageFile && !audioBlob)}
                  onClick={sendResponse}
                >
                  {loading ? <Clock className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </footer>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Leads;
