import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "owner" | "editor" | "shopper";

type AuthState = {
  user: User | null;
  session: Session | null;
  roles: Role[];
  isStaff: boolean;
  isOwner: boolean;
  emailVerified: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  roles: [],
  isStaff: false,
  isOwner: false,
  emailVerified: false,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
      if (next?.user) {
        setTimeout(() => {
          void supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", next.user.id)
            .then(({ data }) => setRoles((data ?? []).map((r) => r.role as Role)));
        }, 0);
      } else {
        setRoles([]);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) {
        void supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.session.user.id)
          .then(({ data: r }) => setRoles((r ?? []).map((x) => x.role as Role)));
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    user: session?.user ?? null,
    session,
    roles,
    isStaff: roles.includes("owner") || roles.includes("editor"),
    isOwner: roles.includes("owner"),
    emailVerified: Boolean(
      session?.user?.email_confirmed_at ?? (session?.user as { confirmed_at?: string } | undefined)?.confirmed_at,
    ),
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
