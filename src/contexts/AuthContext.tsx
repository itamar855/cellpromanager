import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  userRole: Enums<"app_role"> | null;
  userPermissions: Record<string, boolean> | null;
  userStoreId: string | null;
  activeStoreId: string | null;
  setActiveStoreId: (id: string) => void;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  userRole: null,
  userPermissions: null,
  userStoreId: null,
  activeStoreId: null,
  setActiveStoreId: () => {},
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<Enums<"app_role"> | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean> | null>(null);
  const [userStoreId, setUserStoreId] = useState<string | null>(null);
  const [activeStoreId, setActiveStoreIdState] = useState<string | null>(() => localStorage.getItem("cellmanager-active-store-id"));
  const [loading, setLoading] = useState(true);

  const setActiveStoreId = (id: string) => {
    localStorage.setItem("cellmanager-active-store-id", id);
    setActiveStoreIdState(id);
    window.dispatchEvent(new CustomEvent("store-changed", { detail: { id } }));
  };

  const fetchUserData = async (userId: string) => {
    const [roleRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role, permissions").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("store_id").eq("user_id", userId).maybeSingle()
    ]);
    
    if (roleRes.data) {
      setUserRole((roleRes.data as any).role);
      setUserPermissions((roleRes.data as any).permissions as Record<string, boolean>);
    } else {
      setUserRole(null);
      setUserPermissions(null);
    }

    const storeId = profileRes.data ? (profileRes.data as any).store_id : null;
    setUserStoreId(storeId);

    if (storeId && (roleRes.data as any)?.role !== 'admin') {
      setActiveStoreId(storeId);
    } else if (!localStorage.getItem("cellmanager-active-store-id")) {
      // Falbeack: se não tiver storeId no localstorage, pegamos a 1º ou deixamos null pra carregar dps.
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setUserRole(null);
          setUserPermissions(null);
          setUserStoreId(null);
          setActiveStoreIdState(null);
          localStorage.removeItem("cellmanager-active-store-id");
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, userRole, userPermissions, userStoreId, activeStoreId, setActiveStoreId, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
