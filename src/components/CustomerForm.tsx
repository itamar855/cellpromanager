import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

// Props definition
interface CustomerFormProps {
  initialData: {
    name: string;
    phone: string;
    email: string;
    cpf: string;
    address: string;
    notes: string;
    birth_date: string;
  };
  onSubmit: (data: typeof initialData) => Promise<void>;
  loading: boolean;
  close: () => void;
}

/**
 * Memoized form component to avoid re‑rendering the Dialog on each keystroke.
 * It manages its own local state and only notifies the parent when the form is submitted.
 */
const CustomerForm: React.FC<CustomerFormProps> = React.memo(({ initialData, onSubmit, loading, close }) => {
  const [form, setForm] = useState(initialData);

  // Keep form in sync when parent changes the initial data (e.g., editing a different customer)
  useEffect(() => {
    setForm(initialData);
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
    close();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Nome *</Label>
        <Input
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Nome completo"
          required
          className="h-10"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Telefone</Label>
          <Input
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="(74) 99999-9999"
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">CPF</Label>
          <Input
            value={form.cpf}
            onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))}
            placeholder="000.000.000-00"
            className="h-10"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">E-mail</Label>
          <Input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="email@exemplo.com"
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Data de Nascimento</Label>
          <Input
            type="date"
            value={form.birth_date}
            onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
            className="h-10"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Observações</Label>
        <Textarea
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Notas sobre o cliente..."
          className="min-h-[60px]"
        />
      </div>
      <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
        {loading ? "Salvando..." : initialData?.name ? "Salvar Alterações" : "Cadastrar Cliente"}
      </Button>
    </form>
  );
});

export default CustomerForm;
