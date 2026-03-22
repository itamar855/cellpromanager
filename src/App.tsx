import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Estoque from "./pages/Estoque";
import Transacoes from "./pages/Transacoes";
import Vendas from "./pages/Vendas";
import Lojas from "./pages/Lojas";
import OrdensServico from "./pages/OrdensServico";
import Equipe from "./pages/Equipe";
import Clientes from "./pages/Clientes";
import Relatorios from "./pages/Relatorios";
import Instalar from "./pages/Instalar";
import ResetPassword from "./pages/ResetPassword";
import AIAssistant from "./pages/AIAssistant";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/estoque" element={<ProtectedRoute><Estoque /></ProtectedRoute>} />
              <Route path="/transacoes" element={<ProtectedRoute><Transacoes /></ProtectedRoute>} />
              <Route path="/vendas" element={<ProtectedRoute><Vendas /></ProtectedRoute>} />
              <Route path="/lojas" element={<ProtectedRoute><Lojas /></ProtectedRoute>} />
              <Route path="/ordens-servico" element={<ProtectedRoute><OrdensServico /></ProtectedRoute>} />
              <Route path="/equipe" element={<ProtectedRoute><Equipe /></ProtectedRoute>} />
              <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
              <Route path="/assistente-ia" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
              <Route path="/instalar" element={<Instalar />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
