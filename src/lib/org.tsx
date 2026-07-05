"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "./api";
import { getSocket } from "./socket";
import type { Organisation } from "./types";

type OrgContextValue = {
  orgs: Organisation[];
  orgId: string | null;
  org: Organisation | null;
  setOrgId: (id: string) => void;
  createOrg: (name: string) => Promise<Organisation>;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

const OrgContext = createContext<OrgContextValue | null>(null);

const STORAGE_KEY = "selectedOrgId";

// The active org is per-tab: sessionStorage keeps each tab's selection across
// refreshes, while localStorage only seeds brand-new tabs with the last-used
// org. Without this split, tabs overwrite each other's selection on refresh.
function readStoredOrgId(): string | null {
  return sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
}

function writeStoredOrgId(id: string) {
  sessionStorage.setItem(STORAGE_KEY, id);
  localStorage.setItem(STORAGE_KEY, id);
}

// Turn a failed org fetch into a message the UI can show instead of a blank app.
function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.status >= 500
      ? "The server couldn't load organisations — it may be starting up or its database is unavailable."
      : err.message;
  }
  return "Couldn't reach the server. Make sure the backend is running, then retry.";
}

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [orgId, setOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumping this re-runs the load effect — used by the retry button.
  const [reloadKey, setReloadKey] = useState(0);

  // Load orgs and restore the previously selected org from localStorage.
  // Failures are captured into `error` so the app degrades gracefully instead
  // of leaving an empty selector and an unhandled promise rejection.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .listOrganisations()
      .then((list) => {
        if (!active) return;
        setOrgs(list);
        const stored = readStoredOrgId();
        const initial = stored && list.some((o) => o.id === stored) ? stored : list[0]?.id ?? null;
        if (initial) sessionStorage.setItem(STORAGE_KEY, initial);
        setOrgIdState(initial);
      })
      .catch((err) => {
        if (!active) return;
        setError(describeError(err));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  // Keep the org list in sync across tabs: the backend broadcasts
  // organisation:created to every client, so a new org shows up in other
  // tabs' selectors without a refresh. The creating tab receives its own
  // broadcast too; the id-dedupe below makes that a no-op.
  useEffect(() => {
    const socket = getSocket();
    const onOrgCreated = (created: Organisation) => {
      setOrgs((prev) =>
        [...prev.filter((o) => o.id !== created.id), created].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
    };
    socket.on("organisation:created", onOrgCreated);
    return () => {
      socket.off("organisation:created", onOrgCreated);
    };
  }, []);

  // Keep the socket subscribed to the current org's room (across tabs).
  useEffect(() => {
    if (!orgId) return;
    const socket = getSocket();
    const join = () => socket.emit("join", orgId);
    join();
    socket.on("connect", join);
    return () => {
      socket.emit("leave", orgId);
      socket.off("connect", join);
    };
  }, [orgId]);

  const setOrgId = useCallback((id: string) => {
    writeStoredOrgId(id);
    setOrgIdState(id);
  }, []);

  // Create an org, then add it to the list and switch to it immediately.
  const createOrg = useCallback(async (name: string) => {
    const created = await api.createOrganisation(name);
    setOrgs((prev) =>
      [...prev.filter((o) => o.id !== created.id), created].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );
    setOrgId(created.id);
    return created;
  }, [setOrgId]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const org = useMemo(() => orgs.find((o) => o.id === orgId) ?? null, [orgs, orgId]);

  // Memoise the context value so consumers only re-render when a field they
  // read actually changes, not on every provider render.
  const value = useMemo(
    () => ({ orgs, orgId, org, setOrgId, createOrg, loading, error, reload }),
    [orgs, orgId, org, setOrgId, createOrg, loading, error, reload]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
