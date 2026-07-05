"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useOrg } from "@/lib/org";
import { getSocket } from "@/lib/socket";
import { ApiError } from "@/lib/api";
import { Alert, Button, Input } from "@/components/ui";

function LiveIndicator() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const socket = getSocket();
    // setConnected(socket.connected);
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    socket.on("connect", on);
    socket.on("disconnect", off);
    return () => {
      socket.off("connect", on);
      socket.off("disconnect", off);
    };
  }, []);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 sm:px-2.5"
      title="Realtime connection status"
      aria-label={connected ? "Realtime connection: live" : "Realtime connection: offline"}
    >
      <span className="relative flex h-2 w-2">
        {connected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-gray-300"}`} />
      </span>
      {/* On phones the header is tight; the dot alone carries the status. */}
      <span className="hidden sm:inline">{connected ? "Live" : "Offline"}</span>
    </span>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {label}
    </Link>
  );
}

// Lightweight modal for creating a new organisation. Kept inline since the app
// has no shared Dialog primitive yet. Rendered through a portal: the sticky
// header's backdrop-blur creates a containing block for fixed descendants, so
// an overlay rendered inline would only cover the header strip.
function NewOrgDialog({ onClose }: { onClose: () => void }) {
  const { createOrg } = useOrg();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape and lock page scroll while the dialog is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Organisation name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createOrg(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the organisation.");
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-[2px] animate-overlay-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-org-title"
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-950/10 animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-0">
          <div className="flex items-start justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" />
              </svg>
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="-mr-2 -mt-2 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <h2 id="new-org-title" className="mt-4 text-base font-semibold tracking-tight text-gray-900">
            New organisation
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            Create a workspace for your team. Contracts you upload are scoped to it.
          </p>
        </div>
        <form onSubmit={submit}>
          <div className="space-y-3 p-6">
            <div>
              <label htmlFor="new-org-name" className="mb-1.5 block text-xs font-medium text-gray-700">
                Organisation name
              </label>
              <Input
                id="new-org-name"
                autoFocus
                placeholder="e.g. Acme Legal"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                disabled={submitting}
              />
            </div>
            {error && <Alert>{error}</Alert>}
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Creating…" : "Create organisation"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// Custom listbox replacing the native <select>: option popups can't be styled
// cross-browser (and trying degrades them), so the list is rendered ourselves.
// The trigger stays a plain button, so open/close is as fast as the native one.
function OrgSelect() {
  const { orgs, orgId, setOrgId, loading } = useOrg();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const current = orgs.find((o) => o.id === orgId);

  // Close on click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Keep the keyboard-active option visible while navigating a long list.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function toggle() {
    if (!open) setActiveIndex(orgs.findIndex((o) => o.id === orgId));
    setOpen(!open);
  }

  function choose(id: string) {
    setOrgId(id);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => Math.min(orgs.length - 1, Math.max(0, i + delta)));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (orgs[activeIndex]) choose(orgs[activeIndex].id);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        disabled={loading}
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select organisation"
        className={`flex h-9 items-center gap-2 rounded-lg border bg-white pl-3 pr-2.5 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50 ${
          open ? "border-brand-500" : "border-gray-300"
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-gray-400">
          <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" />
        </svg>
        <span className="max-w-[6.5rem] truncate sm:max-w-[12rem]">
          {current?.name ?? (loading ? "Loading…" : "Select organisation")}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Organisations"
          className="absolute right-0 top-full z-30 mt-1.5 max-h-64 w-full min-w-[14rem] max-w-[calc(100vw-1.5rem)] overflow-auto rounded-xl bg-white p-1 shadow-lg ring-1 ring-gray-950/10 animate-dropdown-in"
        >
          {orgs.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-400">No organisations yet</li>
          )}
          {orgs.map((o, i) => {
            const selected = o.id === orgId;
            return (
              <li key={o.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => choose(o.id)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    i === activeIndex ? "bg-gray-100" : ""
                  } ${selected ? "font-medium text-brand-700" : "text-gray-700"}`}
                >
                  <span className="truncate">{o.name}</span>
                  {selected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 text-brand-600">
                      <path d="m5 13 4 4L19 7" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function Header() {
  const [creating, setCreating] = useState(false);
  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:h-16 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/contracts" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 6h9M8 12h9M8 18h5M4 6h.01M4 12h.01M4 18h.01" />
              </svg>
            </span>
            <span className="hidden text-[15px] font-semibold tracking-tight text-gray-900 min-[420px]:inline">
              Contract Ops
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink href="/contracts" label="Contracts" />
            <NavLink href="/upload" label="Upload" />
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <LiveIndicator />
          <OrgSelect />
          <Button variant="secondary" size="sm" onClick={() => setCreating(true)} title="Create organisation">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="hidden sm:inline">New org</span>
          </Button>
        </div>
      </div>
      {/* Phone-only nav row: the inline nav above is hidden below sm, and
          without this the Upload page would be unreachable on mobile. */}
      <nav className="mx-auto flex max-w-6xl items-center gap-1 px-2 pb-2 sm:hidden">
        <NavLink href="/contracts" label="Contracts" />
        <NavLink href="/upload" label="Upload" />
      </nav>
      {creating && <NewOrgDialog onClose={() => setCreating(false)} />}
    </header>
  );
}
