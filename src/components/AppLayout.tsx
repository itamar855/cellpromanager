import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  LayoutDashboard, Package, ArrowUpDown, ShoppingBag, Store, Landmark, PiggyBank,
  LogOut, Smartphone, Wrench, Users, Sun, Moon, UserCircle, FileText, Download, Brain, Settings, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/", permission: "dashboard" },
  { label: "Vendas", icon: ShoppingBag, path: "/vendas", permission: "vendas" },
  { label: "Estoque", icon: Package, path: "/estoque", permission: "estoque" },
  { label: "OS", icon: Wrench, path: "/ordens-servico", permission: "os" },
  { label: "Clientes", icon: UserCircle, path: "/clientes", permission: "clientes" },
  { label: "Transações", icon: ArrowUpDown, path: "/transacoes", permission: "transacoes" },
  { label: "Relatórios", icon: FileText, path: "/relatorios", permission: "relatorios" },
  { label: "Lojas", icon: Store, path: "/lojas", permission: "lojas" },
  { label: "Equipe", icon: Users, path: "/equipe", permission: "equipe" },
  { label: "Contas", icon: Landmark, path: "/contas", permission: "contas" },
  { label: "Caixa", icon: PiggyBank, path: "/caixa", permission: "caixa" },
  { label: "Auditoria", icon: Activity, path: "/auditoria", permission: "auditoria" },
  { label: "Config.", icon: Settings, path: "/configuracoes", permission: "configuracoes" },
  { label: "IA", icon: Brain, path: "/assistente-ia", permission: "ia" },
];

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, userRole, userPermissions, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const filteredNavItems = navItems.filter((item) => {
    // Admins see everything
    if (userRole === "admin") return true;
    
    // If item has no specific permission required, it's public (for logged in users)
    if (!item.permission) return true;
    
    // Check granular permission
    return userPermissions?.[item.permission] === true;
  });

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar-background border-r border-sidebar-border">
        <div className="p-6">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/15 p-1.5">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <h1 className="font-display text-lg font-bold text-sidebar-foreground tracking-tight">
              CellManager
            </h1>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const Icon = item.icon || Smartphone;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  location.pathname === item.path
                    ? "bg-primary/15 text-primary shadow-sm"
                    : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.email}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              className="h-9 px-3 justify-start bg-transparent text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
              {theme === "dark" ? "Claro" : "Escuro"}
            </Button>
            <Link to="/instalar">
              <Button className="h-9 px-3 bg-transparent text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent">
                <Download className="h-4 w-4 mr-2" /> App
              </Button>
            </Link>
          </div>
          <Button
            className="h-9 px-3 w-full justify-start bg-transparent text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between border-b border-border bg-card px-4 py-3 safe-top">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/15 p-1">
              <Smartphone className="h-4 w-4 text-primary" />
            </div>
            <span className="font-display font-bold text-sm">CellManager</span>
          </div>
          <div className="flex items-center gap-1">
            <Button className="h-8 w-8 p-0 bg-transparent hover:bg-muted" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button className="h-8 w-8 p-0 bg-transparent hover:bg-muted" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-8 pb-24 md:pb-8">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border safe-bottom z-50">
          <div className="flex overflow-x-auto scrollbar-none py-1.5 px-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon || Smartphone;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg transition-all duration-200 min-w-[48px] shrink-0",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground active:scale-95"
                  )}
                >
                  <div className={cn(
                    "rounded-lg p-1 transition-colors",
                    isActive && "bg-primary/15"
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[9px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default AppLayout;
