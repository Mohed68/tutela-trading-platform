import React from "react";
import { useLocation } from "wouter";
import { demoApi, DemoApiError } from "./api";
import type { DemoSessionView } from "./types";

interface DemoContextValue {
  session: DemoSessionView | null;
  loading: boolean;
  expired: boolean;
  refresh(): Promise<void>;
  reset(): Promise<void>;
}

const DemoContext = React.createContext<DemoContextValue | null>(null);

export function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<DemoSessionView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [expired, setExpired] = React.useState(false);
  const [, navigate] = useLocation();

  const refresh = React.useCallback(async () => {
    try {
      setSession(await demoApi.getSession());
      setExpired(false);
    } catch (error) {
      if (error instanceof DemoApiError && error.code === "session_expired") {
        setExpired(true);
        setSession(null);
      } else {
        setSession(null);
        navigate("/demo/request");
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const reset = React.useCallback(async () => {
    setSession(await demoApi.resetSession());
  }, []);

  return <DemoContext.Provider value={{ session, loading, expired, refresh, reset }}>{children}</DemoContext.Provider>;
}

export function useDemoSession(): DemoContextValue {
  const value = React.useContext(DemoContext);
  if (!value) throw new Error("useDemoSession must be used within DemoSessionProvider");
  return value;
}
