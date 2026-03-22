import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Smartphone, TrendingUp, Shield } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (forgotPassword) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(error.message);
      } else {
        setResetSent(true);
        toast.success("E-mail de recuperação enviado!");
      }
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error("E-mail ou senha incorretos.");
    } else {
      navigate("/");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col lg:flex-row">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar-background flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/15 p-1.5">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold text-sidebar-foreground tracking-tight">
              CellManager
            </h1>
          </div>
          <p className="text-sidebar-foreground/50 mt-2 text-sm">Gestão Financeira Inteligente</p>
        </div>
        <div className="space-y-8">
          {[
            { icon: TrendingUp, title: "Controle Total de Lucros", desc: "Saiba exatamente quanto cada aparelho rendeu, por loja." },
            { icon: Shield, title: "Separação PF vs PJ", desc: "Nunca mais misture gastos pessoais com o caixa da empresa." },
            { icon: Smartphone, title: "Estoque por IMEI", desc: "Controle cada aparelho individualmente com rastreamento completo." },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-4">
              <div className="rounded-xl bg-sidebar-accent p-3">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-sidebar-foreground text-sm">{item.title}</h3>
                <p className="text-xs text-sidebar-foreground/50 mt-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-sidebar-foreground/30">© 2026 CellManager</p>
      </div>

      {/* Right panel - Form (mobile-first) */}
      <div className="flex flex-1 items-center justify-center p-5 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile branding */}
          <div className="lg:hidden flex items-center gap-2.5 justify-center mb-8">
            <div className="rounded-lg bg-primary/15 p-2">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <h1 className="font-display text-xl font-bold tracking-tight">CellManager</h1>
          </div>

          <Card className="border-border/50 shadow-2xl shadow-black/20">
            <CardHeader className="text-center pb-4">
              <CardTitle className="font-display text-xl">
                {isSignUp ? "Criar conta" : "Entrar"}
              </CardTitle>
              <CardDescription className="text-xs">
                {isSignUp ? "Preencha os dados para começar" : "Acesse seu painel de gestão"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                {isSignUp && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs">Nome</Label>
                    <Input
                      id="name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Seu nome"
                      required
                      className="h-11"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                  {loading ? "Carregando..." : isSignUp ? "Criar conta" : "Entrar"}
                </Button>
              </form>
              <div className="mt-5 text-center">
                <button
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  {isSignUp ? "Já tem conta? Entrar" : "Não tem conta? Criar agora"}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;
