import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  LayoutDashboard, Package, ArrowUpDown, ShoppingBag, Store,
  LogOut, Smartphone, Wrench, Users, Sun, Moon, UserCircle, FileText, Download, Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Vendas", icon: ShoppingBag, path: "/vendas" },
  { label: "Estoque", icon: Package, path: "/estoque" },
  { label: "OS", icon: Wrench, path: "/ordens-servico" },
  { label: "Clientes", icon: UserCircle, path: "/clientes" },
  { label: "Transações", icon: ArrowUpDown, path: "/transacoes" },
  { label: "Relatórios", icon: FileText, path: "/relatorios" },
  { label: "Lojas", icon: Store, path: "/lojas" },
  { label: "Equipe", icon: Users, path: "/equipe" },
  { label: "IA", icon: Brain, path: "/assistente-ia" },
];

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

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
          {navItems.map((item) => (
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
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
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
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="justify-start text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
              {theme === "dark" ? "Claro" : "Escuro"}
            </Button>
            <Link to="/instalar">
              <Button variant="ghost" size="sm" className="text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent">
                <Download className="h-4 w-4 mr-2" /> App
              </Button>
            </Link>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
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
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8">
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
                    <item.icon className="h-4 w-4" />
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
