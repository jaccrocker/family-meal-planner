"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CartResult } from "@/lib/engine/types";
import { DEMO_STATE, EMPTY_STATE, PlannerStateSchema, cartFor, nextWeekLabel, type PlannerState } from "@/lib/planner";

export interface SessionUser {
  name: string;
  email: string;
  image: string | null;
}

/** demo: sample week, nothing saved to an account. account: signed in with Google. */
export type Mode = "demo" | "account" | "none";

interface Membership {
  isOwner: boolean;
  ownerEmail: string;
  members: string[];
}

interface PlannerContext {
  state: PlannerState;
  update: (fn: (s: PlannerState) => PlannerState) => void;
  cart: CartResult;
  mode: Mode;
  user: SessionUser | null;
  googleConfigured: boolean;
  membership: Membership | null;
  loading: boolean;
  weekOf: string;
  startDemo: () => void;
  refreshMembership: () => Promise<void>;
}

const Ctx = createContext<PlannerContext | null>(null);
const LOCAL_KEY = "fmp-demo-state";

function readLocal(): PlannerState | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = PlannerStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeLocal(state: PlannerState | null) {
  try {
    if (state) localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    else localStorage.removeItem(LOCAL_KEY);
  } catch {
    // Storage can be unavailable in private windows; demo mode still works in memory.
  }
}

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [state, setState] = useState<PlannerState>(DEMO_STATE);
  const [mode, setMode] = useState<Mode>("none");
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const loaded = useRef(false);
  const [weekOf, setWeekOf] = useState("");

  const refreshMembership = useCallback(async () => {
    const res = await fetch("/api/household");
    if (!res.ok) return;
    const record = await res.json();
    setMembership({ isOwner: record.isOwner, ownerEmail: record.ownerEmail, members: record.members });
    return record;
  }, []);

  // Load: the account's household when signed in, else any saved demo week.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = (await fetch("/api/me").then((r) => r.json()).catch(() => ({}))) as {
        user?: SessionUser | null;
        googleConfigured?: boolean;
      };
      if (cancelled) return;
      setWeekOf(nextWeekLabel());
      setGoogleConfigured(Boolean(me.googleConfigured));
      if (me.user) {
        setUser(me.user);
        setMode("account");
        setState(EMPTY_STATE);
        const record = await refreshMembership();
        if (!cancelled && record) setState(PlannerStateSchema.parse(record.state));
      } else {
        // Signed out visitors always run the demo: the saved demo week, or the sample one.
        setState(readLocal() ?? DEMO_STATE);
        setMode("demo");
      }
      if (!cancelled) {
        loaded.current = true;
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMembership]);

  // Save shortly after each change.
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      if (mode === "account") {
        fetch("/api/household", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state),
        });
      } else if (mode === "demo") {
        writeLocal(state);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [state, mode]);

  const update = useCallback((fn: (s: PlannerState) => PlannerState) => {
    setState((s) => fn(s));
  }, []);

  const startDemo = useCallback(() => {
    setState(DEMO_STATE);
    setMode("demo");
    loaded.current = true;
    writeLocal(DEMO_STATE);
  }, []);

  const cart = useMemo(() => cartFor(state), [state]);

  const value: PlannerContext = {
    state,
    update,
    cart,
    mode,
    user,
    googleConfigured,
    membership,
    loading,
    weekOf,
    startDemo,
    refreshMembership: async () => {
      await refreshMembership();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlanner(): PlannerContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlanner must be used inside PlannerProvider");
  return ctx;
}
