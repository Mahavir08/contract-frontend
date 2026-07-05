"use client";
import { useEffect } from "react";
import { getSocket } from "./socket";
import type { Contract, ContractStatus } from "./types";

// `contract` is present on updates so the list can patch a single row in place
// (no refetch, no full-table rerender). Absent on create/delete.
export type RealtimePayload = { id: string; status?: ContractStatus; contract?: Contract };

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
