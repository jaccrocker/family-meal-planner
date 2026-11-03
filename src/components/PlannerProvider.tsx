"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CartResult } from "@/lib/engine/types";
import type { Features } from "@/lib/features";
import { DEMO_STATE, EMPTY_STATE, PlannerStateSchema, cartFor, nextWeekLabel, type PlannerState } from "@/lib/planner";

/**
 * The signed in person, as returned by /api/me.
 */
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
  features: Features;
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

/**
 * Holds the planner state for the whole app and shares it through context. Signed in visitors
 * load their household from the server; everyone else gets the demo week, kept in this browser's
 * localStorage. Changes save about 400ms later, to /api/household with the last seen version
 * (adopting the server's copy on a conflict) or to localStorage in demo mode. While signed in
 * and the tab is visible, it also checks the server every 20 seconds for changes made elsewhere.
 */
export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [features, setFeatures] = useState<Features>({ calendar: false, alexa: false, skylight: false });
  const [state, setState] = useState<PlannerState>(DEMO_STATE);
  const [mode, setMode] = useState<Mode>("none");
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const loaded = useRef(false);
  // The server's version of the household this tab last saw; see saveState.
  const version = useRef<string | undefined>(undefined);
  // Set when the state change came from the server, so it is not saved straight back.
  const fromServer = useRef(false);
  const [weekOf, setWeekOf] = useState("");

  const refreshMembership = useCallback(async () => {
    const res = await fetch("/api/household");
    if (!res.ok) return;
    const record = await res.json();
    setMembership({ isOwner: record.isOwner, ownerEmail: record.ownerEmail, members: record.members });
    return record as { state: unknown; version: string };
  }, []);

  // Load: the account's household when signed in, else any saved demo week.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = (await fetch("/api/me").then((r) => r.json()).catch(() => ({}))) as {
        user?: SessionUser | null;
        googleConfigured?: boolean;
        features?: Features;
      };
      if (cancelled) return;
      setWeekOf(nextWeekLabel());
      setGoogleConfigured(Boolean(me.googleConfigured));
      if (me.features) setFeatures(me.features);
      if (me.user) {
        setUser(me.user);
        setMode("account");
        setState(EMPTY_STATE);
        const record = await refreshMembership();
        if (!cancelled && record) {
          version.current = record.version;
          fromServer.current = true;
          setState(PlannerStateSchema.parse(record.state));
        }
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
    if (fromServer.current) {
      fromServer.current = false;
      return;
    }
    const t = setTimeout(async () => {
      if (mode === "account") {
        const res = await fetch("/api/household", {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...(version.current ? { "x-base-version": version.current } : {}) },
          body: JSON.stringify(state),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) version.current = json.version;
        else if (res.status === 409 && json.record) {
          // Someone else (another adult, or a voice command) changed the plan first: show theirs.
          version.current = json.record.version;
          fromServer.current = true;
          setState(PlannerStateSchema.parse(json.record.state));
        }
      } else if (mode === "demo") {
        writeLocal(state);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [state, mode]);

  // Pick up changes made elsewhere (another adult, a voice command) while this tab is open and idle.
  useEffect(() => {
    if (mode !== "account") return;
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const res = await fetch("/api/household");
      if (!res.ok) return;
      const record = await res.json();
      if (record.version && record.version !== version.current) {
        version.current = record.version;
        fromServer.current = true;
        setState(PlannerStateSchema.parse(record.state));
      }
    }, 20_000);
    return () => clearInterval(t);
  }, [mode]);

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
    features,
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

/**
 * Reads the planner context. Throws when used outside PlannerProvider.
 */
export function usePlanner(): PlannerContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlanner must be used inside PlannerProvider");
  return ctx;
}
