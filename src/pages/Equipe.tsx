import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Shield, ShieldCheck, User, Plus, Phone, Store, Trash2 } from "lucide-react";
import type { Tables, Enums } from "@/integrations/supabase/types";

const roleConfig: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  admin: { label: "Administrador", color: "bg-destructive/15 text-destructive border-destructive/20", icon: ShieldCheck },
  gerente: { label: "Gerente", color: "bg-accent/15 text-accent border-accent/20", icon: Shield },
  vendedor: { label: "Vendedor", color: "bg-primary/15 text-primary border-primary/20", icon: User },
};

const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "vendas", label: "Vendas" },
  { key: "estoque", label: "Estoque" },
  { key: "os", label: "Ordens de Serviço" },
  { key: "clientes", label: "Clientes" },
  { key: "transacoes", label: "Transações" },
  { key: "relatorios", label: "Relatórios" },
  { key: "lojas", label: "Lojas" },
  { key: "equipe", label: "Equipe" },
  { key: "contas", label: "Contas" },
  { key: "caixa", label: "Caixa" },
  { key: "auditoria", label: "Auditoria" },
  { key: "configuracoes", label: "Configurações" },
  { key: "ia", label: "IA" },
];

type Permissions = Record<string, boolean>;

const defaultPermissions = (role: string): Permissions => {
  if (role === "admin") return Object.fromEntries(MODULES.map((m) => [m.key, true]));
  if (role === "gerente") return Object.fromEntries(MODULES.map((m) => [m.key, !["lojas", "equipe", "auditoria", "configuracoes"].includes(m.key)]));
  return Object.fromEntries(MODULES.map((m) => [m.key, ["dashboard", "vendas", "estoque", "os", "clientes", "caixa"].includes(m.key)]));
};

type ProfileWithRole = Tables<"profiles"> & {
  role?: Enums<"app_role"> | null;
  phone?: string | null;
  store_id?: string | null;
  permissions?: Permissions;
};

const Equipe = () => {
  const { userRole, user, userPermissions } = useAuth();
  const [members, setMembers] = useState<ProfileWithRole[]>([]);
  const [stores, setStores] = useState<Tables<"stores">[]>([]);
  const [selectedMember, setSelectedMember] = useState<ProfileWithRole | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<ProfileWithRole | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [editPhone, setEditPhone] = useState("");
  const [editStoreId, setEditStoreId] = useState("");
  const [permissions, setPermissions] = useState<Permissions>({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "", password: "", display_name: "", phone: "", role: "vendedor", store_id: "",
  });
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    const [profilesRes, rolesRes, storesRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
      supabase.from("stores").select("*"),
    ]);

    const profiles = profilesRes.data ?? [];
    const roles = rolesRes.data ?? [];
    const roleMap = new Map((roles as any[]).map((r) => [r.user_id, { role: r.role, permissions: r.permissions }]));

    setMembers(
      profiles.map((p: any) => {
        const roleData = roleMap.get(p.user_id);
        return {
          ...p,
          role: (roleData as any)?.role ?? null,
          permissions: ((roleData as any)?.permissions as Permissions) ?? null,
        };
      })
    );
    setStores(storesRes.data ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const isAdmin = userRole === "admin" || (userRole === "gerente" && userPermissions?.equipe);
  const storeMap = new Map(stores.map((s) => [s.id, s.name]));

  const openEditDialog = (member: ProfileWithRole) => {
    if (!isAdmin) return;
    setSelectedMember(member);
    setNewRole(member.role || "vendedor");
    setEditPhone((member as any).phone || "");
    setEditStoreId((member as any).store_id || "");
    setPermissions(member.permissions || defaultPermissions(member.role || "vendedor"));
  };

  const handleRoleChange = async () => {
    if (!selectedMember || !newRole) return;
    setLoading(true);

    const { data: existing } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", selectedMember.user_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("user_roles")
        .update({ 
          role: newRole as any,
          permissions: permissions
        })
        .eq("user_id", selectedMember.user_id);
      if (error) { toast.error(error.message); setLoading(false); return; }
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ 
          user_id: selectedMember.user_id, 
          role: newRole as any,
          permissions: permissions
        });
      if (error) { toast.error(error.message); setLoading(false); return; }
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        phone: editPhone || null,
        store_id: editStoreId === "none" ? null : editStoreId || null,
      } as any)
      .eq("user_id", selectedMember.user_id);

    if (profileError) toast.error(profileError.message);
    else toast.success("Membro atualizado!");

    setSelectedMember(null);
    setLoading(false);
    fetchData();
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;
    setLoading(true);

    try {
      await supabase.from("user_roles").delete().eq("user_id", memberToDelete.user_id);
      await supabase.from("profiles").delete().eq("user_id", memberToDelete.user_id);
      toast.success("Membro removido com sucesso!");
      setMemberToDelete(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover membro");
    }
    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await supabase.functions.invoke("create-user", {
        body: {
          email: createForm.email,
          password: createForm.password,
          display_name: createForm.display_name,
          phone: createForm.phone,
          role: createForm.role,
          store_id: createForm.store_id || null,
        },
      });

      if (response.error) {
        toast.error(response.error.message || "Erro ao criar usuário");
      } else {
        toast.success("Usuário criado com sucesso!");
        setCreateDialogOpen(false);
        setCreateForm({ email: "", password: "", display_name: "", phone: "", role: "vendedor", store_id: "" });
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar usuário");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Equipe</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{members.length} membros cadastrados</p>
        </div>
        {isAdmin && (
          <Button className="gap-2 h-10" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Novo Membro
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {members.length > 0 ? (
          members.map((member) => {
            const rc = member.role ? roleConfig[member.role] : null;
            const isMe = member.user_id === user?.id;
            return (
              <Card
                key={member.id}
                className="border-border/50 shadow-lg shadow-black/10 cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => openEditDialog(member)}
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {member.display_name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{member.display_name || "Sem nome"}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {(member as any).phone && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Phone className="h-2.5 w-2.5" /> {(member as any).phone}
                          </span>
                        )}
                        {(member as any).store_id && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Store className="h-2.5 w-2.5" /> {storeMap.get((member as any).store_id) || ""}
                          </span>
                        )}
                        {isMe && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0">Você</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {rc ? (
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${rc.color}`}>
                        {rc.label}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Sem cargo</Badge>
                    )}
                    {isAdmin && !isMe && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => { e.stopPropagation(); setMemberToDelete(member); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium text-sm">Nenhum membro</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit member dialog */}
      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {selectedMember && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Editar Membro</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                    {selectedMember.display_name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <p className="font-medium">{selectedMember.display_name}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cargo</Label>
                  <Select value={newRole} onValueChange={(v) => { setNewRole(v); setPermissions(defaultPermissions(v)); }}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="gerente">Gerente</SelectItem>
                      <SelectItem value="vendedor">Vendedor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone</Label>
                  <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="(11) 99999-9999" className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Loja de Atuação</Label>
                  <Select value={editStoreId || "none"} onValueChange={setEditStoreId}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {stores.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Permissões por módulo */}
                <div className="space-y-2">
                  <Label className="text-xs">Permissões de Acesso</Label>
                  <div className="rounded-lg border border-border/50 divide-y divide-border/50">
                    {MODULES.map((mod) => (
                      <div key={mod.key} className="flex items-center justify-between px-3 py-2.5">
                        <span className="text-sm">{mod.label}</span>
                        <Switch
                          checked={permissions[mod.key] ?? false}
                          onCheckedChange={(v) => setPermissions((prev) => ({ ...prev, [mod.key]: v }))}
                          disabled={newRole === "admin"}
                        />
                      </div>
                    ))}
                  </div>
                  {newRole === "admin" && (
                    <p className="text-[11px] text-muted-foreground">Administradores têm acesso total ao sistema.</p>
                  )}
                </div>

                <Button onClick={handleRoleChange} className="w-full h-11 font-semibold" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!memberToDelete} onOpenChange={(open) => !open && setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{memberToDelete?.display_name || memberToDelete?.user_id}</strong> da equipe? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDeleteMember}
              disabled={loading}
            >
              {loading ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create user dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Cadastrar Novo Membro</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input value={createForm.display_name} onChange={(e) => setCreateForm({ ...createForm, display_name: e.target.value })} placeholder="Nome completo" required className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">E-mail</Label>
              <Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="email@exemplo.com" required className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Senha</Label>
              <Input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} placeholder="Mínimo 6 caracteres" required minLength={6} className="h-10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="(11) 99999-9999" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cargo</Label>
                <Select value={createForm.role} onValueChange={(v) => setCreateForm({ ...createForm, role: v })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Loja de Atuação</Label>
              <Select value={createForm.store_id || "none"} onValueChange={(v) => setCreateForm({ ...createForm, store_id: v === "none" ? "" : v })}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {stores.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
              {loading ? "Criando..." : "Cadastrar Membro"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Equipe;
