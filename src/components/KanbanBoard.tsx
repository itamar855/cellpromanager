import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface KanbanBoardProps {
  orders: any[];
  statusConfig: Record<string, { label: string; color: string; icon: any }>;
  allStatuses: string[];
  storeMap: Map<string, string>;
  profileMap: Map<string, string>;
  formatCurrency: (v: number) => string;
  onOrderClick: (order: any) => void;
  onStatusChange: (orderId: string, newStatus: string, oldStatus: string) => void;
}

export function KanbanBoard({
  orders,
  statusConfig,
  allStatuses,
  profileMap,
  formatCurrency,
  onOrderClick,
  onStatusChange,
}: KanbanBoardProps) {
  const handleDragStart = (e: React.DragEvent, orderId: string, oldStatus: string) => {
    e.dataTransfer.setData("orderId", orderId);
    e.dataTransfer.setData("oldStatus", oldStatus);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Permitir drop
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData("orderId");
    const oldStatus = e.dataTransfer.getData("oldStatus");
    if (orderId && oldStatus !== newStatus) {
      onStatusChange(orderId, newStatus, oldStatus);
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 items-start h-[calc(100vh-270px)] min-h-[500px] scrollbar-thin">
      {allStatuses.map((status) => {
        const config = statusConfig[status];
        const statusOrders = orders.filter((o) => o.status === status);
        const Icon = config.icon;

        return (
          <div
            key={status}
            className="flex-shrink-0 w-[300px] flex flex-col gap-3 rounded-lg bg-muted/20 p-3 border border-border/40 h-full"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className="flex items-center justify-between px-1 mb-1">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground/90">
                {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                {config.label}
              </h3>
              <Badge variant="secondary" className="text-xs bg-muted/50">
                {statusOrders.length}
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-10 scrollbar-none">
              {statusOrders.length === 0 && (
                <div className="h-20 border-2 border-dashed border-border/50 rounded-lg flex items-center justify-center text-muted-foreground/30 text-xs">
                  Solte OS aqui
                </div>
              )}
              {statusOrders.map((order) => (
                <Card
                  key={order.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, order.id, order.status)}
                  onClick={() => onOrderClick(order)}
                  className="cursor-pointer border-border/40 bg-card hover:border-primary/50 transition-all shadow-sm hover:shadow-md active:cursor-grabbing active:scale-[0.98]"
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                        #{order.order_number}
                      </span>
                      <p className="font-bold text-xs">
                        {formatCurrency(Number(order.final_price || order.estimated_price || 0))}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-sm leading-tight truncate">
                        {order.customer_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.device_brand} {order.device_model}
                      </p>
                    </div>
                    <div className="flex justify-between items-center pt-2 mt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                      <span>{new Date(order.created_at).toLocaleDateString("pt-BR")}</span>
                      {order.technician_id && (
                        <span className="truncate max-w-[100px] text-right">
                          {profileMap.get(order.technician_id)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
