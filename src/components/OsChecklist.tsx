import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const CHECKLIST_ITEMS = [
  "Câmera Frontal",
  "Câmera Traseira",
  "Alto-falante",
  "Microfone",
  "Wi-Fi",
  "Bluetooth",
  "Sinal de Rede / Chip",
  "Touch Screen",
  "Display / LCD",
  "Botão Home / Biometria",
  "Botão Power",
  "Botões de Volume",
  "Conector de Carga",
  "Face ID / Reconhecimento Facial",
  "Sensor de Proximidade",
  "Bateria (Saúde/Carga)",
  "Carcaça Exterior",
  "Vidro Traseiro",
  "Parafusos do Fundo",
  "Gaveta do Chip"
];

export type CheckItemStatus = "ok" | "defeito" | "na" | "nao_testado";

export type ChecklistData = Record<string, CheckItemStatus>;

interface OsChecklistProps {
  data: ChecklistData;
  onChange: (newData: ChecklistData) => void;
  title?: string;
  readonly?: boolean;
}

export function OsChecklist({ data, onChange, title = "Checklist do Aparelho", readonly = false }: OsChecklistProps) {
  const handleChange = (item: string, status: CheckItemStatus) => {
    if (readonly) return;
    onChange({ ...data, [item]: status });
  };

  const getStatusColor = (status?: CheckItemStatus) => {
    switch (status) {
      case "ok": return "text-green-500 bg-green-500/10 border-green-500/20";
      case "defeito": return "text-destructive bg-destructive/10 border-destructive/20";
      case "na": return "text-muted-foreground bg-muted border-border";
      default: return "text-muted-foreground bg-muted/30 border-border/50";
    }
  };

  const getStatusLabel = (status?: CheckItemStatus) => {
    switch (status) {
      case "ok": return "✅ OK";
      case "defeito": return "❌ Defeito";
      case "na": return "N/A";
      default: return "Pendente";
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3 bg-card w-full">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </p>

      {readonly ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {CHECKLIST_ITEMS.map((item) => {
            const status = data[item] || "nao_testado";
            return (
              <div key={item} className="flex flex-col gap-1 p-2 rounded border border-border/50 bg-muted/20">
                <span className="text-[10px] leading-tight text-muted-foreground font-medium">{item}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-semibold w-fit border ${getStatusColor(status)}`}>
                  {getStatusLabel(status)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {CHECKLIST_ITEMS.map((item) => {
            const value = data[item] || "nao_testado";
            return (
              <div key={item} className="space-y-1.5">
                <Label className="text-[10px] truncate max-w-full block" title={item}>
                  {item}
                </Label>
                <Select value={value} onValueChange={(val) => handleChange(item, val as CheckItemStatus)}>
                  <SelectTrigger className={`h-8 text-xs ${getStatusColor(value)}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_testado" className="text-xs">Pendente</SelectItem>
                    <SelectItem value="ok" className="text-xs text-green-500 font-medium">✅ OK</SelectItem>
                    <SelectItem value="defeito" className="text-xs text-destructive font-medium">❌ Defeito</SelectItem>
                    <SelectItem value="na" className="text-xs">N/A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
