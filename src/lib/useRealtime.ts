"use client";
import { useEffect } from "react";
import { getSocket } from "./socket";
import type { ContractStatus } from "./types";

export type RealtimePayload = { id: string; status?: ContractStatus };

// Subscribe to contract realtime events for the current tab. The handler is
// invoked on create/update/delete so pages can refetch or patch local state.
export function useRealtime(
  handler: (event: "created" | "updated" | "deleted", payload: RealtimePayload) => void
) {
  useEffect(() => {
    const socket = getSocket();
    const onCreated = (p: RealtimePayload) => handler("created", p);
    const onUpdated = (p: RealtimePayload) => handler("updated", p);
    const onDeleted = (p: RealtimePayload) => handler("deleted", p);
    socket.on("contract:created", onCreated);
    socket.on("contract:updated", onUpdated);
    socket.on("contract:deleted", onDeleted);
    return () => {
      socket.off("contract:created", onCreated);
      socket.off("contract:updated", onUpdated);
      socket.off("contract:deleted", onDeleted);
    };
  }, [handler]);
}
