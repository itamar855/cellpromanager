import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { 
  Trash2, MessageSquare, ChevronRight, MessageCircle, Phone, 
  Users, Store, Image as ImageIcon, CheckCheck, Clock 
} from "lucide-react";

const Instagram = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
);

export interface LeadListProps {
  leads: any[];
  loading: boolean;
  searchTerm: string;
  allStatuses: string[];
  statusConfig: Record<string, { label: string; color: string }>;
  onStatusChange: (leadId: string, newStatus: any) => void;
  onLeadClick: (lead: any) => void;
  onEditLead: (lead: any) => void;
  onDeleteLead: (leadId: string, leadName: string) => void;
  onResponseClick: (lead: any) => void;
  isAdmin: boolean;
}

export function LeadList({
  leads,
  loading,
  searchTerm,
  allStatuses,
  statusConfig,
  onStatusChange,
  onLeadClick,
  onEditLead,
  onDeleteLead,
  onResponseClick,
  isAdmin
}: LeadListProps) {
  const [currentPages, setCurrentPages] = useState<Record<string, number>>(
    allStatuses.reduce((acc, status) => ({ ...acc, [status]: 1 }), {})
  );
  const leadsPerPage = 20;

  useEffect(() => {
    setCurrentPages(prev => {
      const updated = { ...prev };
      let changed = false;
      allStatuses.forEach(status => {
        const statusLeads = leads.filter((l) => l.status === status);
        const totalPages = Math.ceil(statusLeads.length / leadsPerPage) || 1;
        if (prev[status] > totalPages) {
          updated[status] = totalPages;
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [leads, allStatuses]);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("leadId", leadId);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (e: React.DragEvent, newStatus: any) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("leadId");
    if (leadId) onStatusChange(leadId, newStatus);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground animate-pulse">Carregando seus leads...</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 items-start flex-1 min-h-[500px] scrollbar-thin">
      {allStatuses.map((status) => {
        const statusLeads = leads.filter((l) => l.status === status);
        const totalLeads = statusLeads.length;
        const totalPages = Math.ceil(totalLeads / leadsPerPage);
        const currentPage = currentPages[status] || 1;
        const startIndex = (currentPage - 1) * leadsPerPage;
        const displayedLeads = statusLeads.slice(startIndex, startIndex + leadsPerPage);

        return (
          <div
            key={status}
            className="flex-shrink-0 w-[280px] flex flex-col gap-3 rounded-xl bg-muted/30 p-3 border border-border/40 h-full max-h-[calc(100vh-250px)]"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className="flex items-center justify-between px-1">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Badge className={`h-2 w-2 rounded-full p-0 ${statusConfig[status].color.split(' ')[0]}`} />
                {statusConfig[status].label}
              </h3>
              <Badge variant="secondary" className="text-[10px] bg-muted/50">
                {totalLeads}
              </Badge>
            </div>

            <ScrollArea className="flex-1 pr-3">
              <div className="space-y-3 pb-4">
                {totalLeads === 0 && (
                  <div className="h-20 border-2 border-dashed border-border/30 rounded-xl flex items-center justify-center text-muted-foreground/20 text-[10px]">
                    {searchTerm ? "Nenhum resultado" : "Arraste leads aqui"}
                  </div>
                )}
                {displayedLeads.map((lead) => (
                  <Card
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    className="cursor-pointer border-border/40 hover:border-primary/50 transition-all shadow-sm hover:shadow-md active:scale-[0.98] group"
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm leading-tight group-hover:text-primary transition-colors text-foreground">
                            {lead.name || "Lead sem nome"}
                          </p>
                          {lead.has_unread && (
                            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {lead.source === 'whatsapp' ? (
                            <MessageCircle className="h-3 w-3 text-green-500" />
                          ) : lead.source === 'instagram' ? (
                            <Instagram className="h-3 w-3 text-pink-500" />
                          ) : (
                            <Badge variant="outline" className="text-[7px] h-3 px-1 border-primary/20 bg-primary/5 text-primary">CRM</Badge>
                          )}
                        </div>
                      </div>
                      {lead.phone && (
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Phone className="h-2.5 w-2.5" /> {lead.phone}
                        </div>
                      )}
                      <div className="flex flex-col gap-1 mt-1">
                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                          <Users className="h-2.5 w-2.5" />
                          {lead.assigned_user?.display_name || "Sem Responsável"}
                        </div>
                        {lead.store?.name && (
                          <div className="flex items-center gap-1.5 text-[9px] text-primary/70">
                            <Store className="h-2.5 w-2.5" />
                            {lead.store.name}
                          </div>
                        )}
                      </div>
                      {lead.notes && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2 italic">
                          "{lead.notes}"
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              onLeadClick(lead);
                            }}
                          >
                            <MessageSquare className="h-3 w-3" />
                          </Button>
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditLead(lead);
                              }}
                            >
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              onResponseClick(lead);
                            }}
                          >
                            <MessageCircle className="h-3 w-3 text-green-500" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteLead(lead.id, lead.name);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <span
                          className="text-[9px] text-muted-foreground"
                          title={new Date(lead.last_message_at || lead.created_at).toLocaleString('pt-BR')}
                        >
                          {new Date(lead.last_message_at || lead.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {totalPages > 1 && (
              <div className="mt-2 pt-2 border-t border-border/40">
                <Pagination>
                  <PaginationContent className="flex-wrap justify-center gap-1">
                    <PaginationItem>
                      <PaginationPrevious 
                        className="h-7 px-2 text-[10px] cursor-pointer"
                        onClick={() => setCurrentPages(prev => ({ ...prev, [status]: Math.max(1, currentPage - 1) }))}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="text-[10px] text-muted-foreground mx-1">
                        {currentPage}/{totalPages}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext 
                        className="h-7 px-2 text-[10px] cursor-pointer"
                        onClick={() => setCurrentPages(prev => ({ ...prev, [status]: Math.min(totalPages, currentPage + 1) }))}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}