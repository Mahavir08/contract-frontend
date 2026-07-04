"use client";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

// Lazily create a single shared socket connection for the browser tab.
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
  }
  return socket;
}
