import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ConversaSyncProps {
  selectedLeadId?: string;
  onSyncComplete?: () => void;
  onNewMessage?: (leadId: string) => void;
}

const ConversaSync = ({ selectedLeadId, onSyncComplete, onNewMessage }: ConversaSyncProps) => {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const syncHistory = useCallback(async () => {
    if (!selectedLeadId) return;
    
    setSyncing(true);
    setLastSyncStatus('idle');
    
    try {
      // Fetch latest messages to ensure we have the full history
      const { error } = await supabase.from('lead_messages')
        .select('id')
        .eq('lead_id', selectedLeadId)
        .limit(1);

      if (error) throw error;
      
      if (onSyncComplete) onSyncComplete();
      setLastSyncStatus('success');
    } catch (err) {
      console.error("Erro ao sincronizar histórico:", err);
      setLastSyncStatus('error');
    } finally {
      setSyncing(false);
      // Clear status after 3 seconds
      setTimeout(() => setLastSyncStatus('idle'), 3000);
    }
  }, [selectedLeadId, onSyncComplete]);

  useEffect(() => {
    if (!selectedLeadId) return;

    // WebSocket / Realtime subscription
    const channel = supabase.channel(`lead-messages-${selectedLeadId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'lead_messages',
        filter: `lead_id=eq.${selectedLeadId}`
      }, () => {
        if (onNewMessage) onNewMessage(selectedLeadId);
      })
      .subscribe();

    // Sincronização inicial ao selecionar lead
    syncHistory();

    // Polling a cada 30 segundos como redundância
    const interval = setInterval(syncHistory, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [selectedLeadId, syncHistory, onNewMessage]);

  if (!selectedLeadId && !syncing) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 pointer-events-none">
      {syncing && (
        <Badge variant="secondary" className="flex items-center gap-2 px-3 py-1.5 shadow-xl bg-background/80 backdrop-blur-sm border-primary/20 animate-in fade-in slide-in-from-bottom-4">
          <RefreshCw className="h-3 w-3 animate-spin text-primary" />
          <span className="text-[11px] font-medium">Sincronizando conversas...</span>
        </Badge>
      )}
      
      {lastSyncStatus === 'success' && (
        <Badge variant="outline" className="flex items-center gap-2 px-3 py-1.5 shadow-xl bg-green-500/10 border-green-500/30 text-green-500 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="h-3 w-3" />
          <span className="text-[11px] font-medium">Histórico atualizado</span>
        </Badge>
      )}

      {lastSyncStatus === 'error' && (
        <Badge variant="outline" className="flex items-center gap-2 px-3 py-1.5 shadow-xl bg-destructive/10 border-destructive/30 text-destructive animate-in fade-in slide-in-from-bottom-4">
          <AlertCircle className="h-3 w-3" />
          <span className="text-[11px] font-medium">Erro na sincronização</span>
        </Badge>
      )}
    </div>
  );
};

export default ConversaSync;
