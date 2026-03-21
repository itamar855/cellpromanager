import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Users, Shield, ShieldCheck, User } from "lucide-react";
import type { Tables, Enums } from "@/integrations/supabase/types";

const roleConfig: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  admin: { label: "Administrador", color: "bg-destructive/15 text-destructive border-destructive/20", icon: ShieldCheck },
  gerente: { label: "Gerente", color: "bg-accent/15 text-accent border-accent/20", icon: Shield },
  vendedor: { label: "Vendedor", color: "bg-primary/15 text-primary border-primary/20", icon: User },
};

type ProfileWithRole = Tables<"profiles"> & { role?: Enums<"app_role"> | null };

const Equipe = () => {
  const { userRole, user } = useAuth();
  const [members, setMembers] = useState<ProfileWithRole[]>([]);
  const [selectedMember, setSelectedMember] = useState<ProfileWithRole | null>(null);
  const [newRole, setNewRole] = useState<string>("");

  const fetchData = async () => {
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
    ]);

    const profiles = profilesRes.data ?? [];
    const roles = rolesRes.data ?? [];
    const roleMap = new Map(roles.map((r) => [r.user_id, r.role]));

    setMembers(
      profiles.map((p) => ({
        ...p,
        role: roleMap.get(p.user_id) ?? null,
      }))
    );
  };

  useEffect(() => { fetchData(); }, []);

  const isAdmin = userRole === "admin";

  const handleRoleChange = async () => {
    if (!selectedMember || !newRole) return;

    // Check existing role
    const { data: existing } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", selectedMember.user_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole as any })
        .eq("user_id", selectedMember.user_id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: selectedMember.user_id, role: newRole as any });
      if (error) { toast.error(error.message); return; }
    }

    toast.success("Cargo atualizado!");
    setSelectedMember(null);
    setNewRole("");
    fetchData();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight">Equipe</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{members.length} membros cadastrados</p>
      </div>

      <div className="space-y-2">
        {members.length > 0 ? (
          members.map((member) => {
            const rc = member.role ? roleConfig[member.role] : null;
            return (
              <Card
                key={member.id}
                className="border-border/50 shadow-lg shadow-black/10 cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => {
                  if (isAdmin) {
                    setSelectedMember(member);
                    setNewRole(member.role || "vendedor");
                  }
                }}
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {member.display_name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{member.display_name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.user_id === user?.id ? "Você" : ""}</p>
                    </div>
                  </div>
                  {rc ? (
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${rc.color}`}>
                      {rc.label}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">Sem cargo</Badge>
                  )}
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

      {/* Role edit dialog */}
      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent>
          {selectedMember && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Editar Cargo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                    {selectedMember.display_name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <p className="font-medium">{selectedMember.display_name}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Cargo</label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="gerente">Gerente</SelectItem>
                      <SelectItem value="vendedor">Vendedor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleRoleChange} className="w-full h-11 font-semibold">
                  Salvar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Equipe;
