"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useOrg } from "@/lib/org";
import { api, ApiError } from "@/lib/api";
import { useRealtime } from "@/lib/useRealtime";
import { StatusBadge } from "@/components/StatusBadge";
import { PdfViewer } from "@/components/PdfViewer";
import { Alert, Button, Card, EmptyState, Modal, Spinner, Textarea } from "@/components/ui";
import type { Attachment, Contract, ContractEvent, EventType, FieldError } from "@/lib/types";
import { formatBytes } from "@/lib/format";

const currency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const EVENT_META: Record<EventType, { color: string; label: string }> = {
  CREATED: { color: "bg-green-500", label: "Created" },
  UPDATED: { color: "bg-amber-500", label: "Updated" },
  STATUS_CHANGED: { color: "bg-brand-500", label: "Status changed" },
  DELETED: { color: "bg-red-500", label: "Deleted" },
};

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { orgId } = useOrg();

  const [contract, setContract] = useState<Contract | null>(null);
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Bumped when a realtime update for this contract arrives, to flash the card.
  const [flash, setFlash] = useState(0);
  const itemsRef = useRef<HTMLDivElement>(null);

  async function openPreview(a: Attachment) {
    if (!orgId || previewLoading) return;
    setError(null);
    setPreviewLoading(a.id);
    try {
      const url = await api.getAttachmentBlobUrl(orgId, id, a.id);
      setPreview({ name: a.fileName, url });
    } catch {
      setError("Failed to load PDF preview.");
    } finally {
      setPreviewLoading(null);
    }
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  const load = useCallback(async () => {
    if (!orgId) return;
    setError(null);
    try {
      const [c, ev, at] = await Promise.all([
        api.getContract(orgId, id),
        api.listEvents(orgId, id),
        api.listAttachments(orgId, id),
      ]);
      setContract(c);
      setEvents(ev);
      setAttachments(at);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? "Contract not found in this organisation." : "Failed to load contract.");
      setContract(null);
    } finally {
      setLoading(false);
    }
  }, [orgId, id]);

  useEffect(() => { load(); }, [load]);

  useRealtime(useCallback((_e, payload) => {
    if (payload.id === id) {
      load();
      setFlash((n) => n + 1);
    }
  }, [id, load]));

  // Replay the "updated over socket" ring on the line-items card each time a
  // realtime update lands (skips initial mount when flash is 0).
  useEffect(() => {
    if (!flash) return;
    const el = itemsRef.current;
    if (!el) return;
    el.classList.remove("animate-flash-ring");
    void el.offsetWidth;
    el.classList.add("animate-flash-ring");
  }, [flash]);

  async function runStatus(fn: (o: string, i: string) => Promise<Contract>, label: string) {
    if (!orgId) return;
    setAction(label);
    setError(null);
    try {
      await fn(orgId, id);
      setEditing(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : `Failed to ${label}.`);
    } finally {
      setAction(null);
    }
  }

  async function remove() {
    if (!orgId || !confirm("Delete this draft contract? This cannot be undone.")) return;
    setAction("delete");
    try {
      await api.deleteContract(orgId, id);
      router.push("/contracts");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to delete.");
      setAction(null);
    }
  }

  function startEdit() {
    if (!contract) return;
    setDraftText(JSON.stringify(contract.fieldData, null, 2));
    setFieldErrors([]);
    setEditing(true);
  }

  async function saveEdit() {
    if (!orgId) return;
    setFieldErrors([]);
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(draftText);
    } catch {
      setError("Invalid JSON.");
      return;
    }
    setAction("save");
    try {
      await api.updateContract(orgId, id, parsed as never);
      setEditing(false);
      await load();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        if (e.details) setFieldErrors(e.details);
      } else setError("Failed to save.");
    } finally {
      setAction(null);
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;
    setError(null);
    setAction("upload");
    try {
      await api.uploadAttachment(orgId, id, file);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setAction(null);
      e.target.value = "";
    }
  }

  async function removeAttachment(a: Attachment) {
    if (!orgId || deletingId) return;
    if (!confirm(`Delete "${a.fileName}"? This cannot be undone.`)) return;
    setError(null);
    setDeletingId(a.id);
    try {
      await api.deleteAttachment(orgId, id, a.id);
      // Drop the row locally instead of blocking on a full 3-endpoint reload;
      // the realtime broadcast reconciles other tabs.
      setAttachments((prev) => prev.filter((x) => x.id !== a.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete attachment.");
    } finally {
      setDeletingId(null);
    }
  }

  function copyId() {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (error && !contract) return <Alert>{error}</Alert>;
  if (!contract) return null;

  const isDraft = contract.status === "DRAFT";
  const items = contract.fieldData.items ?? [];
  const grandTotal = items.reduce((s, it) => s + (it.total ?? it.quantity * it.unit_price), 0);

  return (
    <div className="space-y-6">
      <Link href="/contracts" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
        Back to contracts
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-semibold text-brand-700">
            {contract.clientName.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">{contract.clientName}</h1>
              <StatusBadge status={contract.status} />
            </div>
            <button onClick={copyId} className="mt-1 flex max-w-full items-center gap-1.5 font-mono text-xs text-gray-400 hover:text-gray-600" title="Copy ID">
              <span className="truncate">{id}</span>
              <svg className="shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              {copied && <span className="shrink-0 text-green-600">copied</span>}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft && !editing && <Button variant="secondary" onClick={startEdit}>Edit</Button>}
          {isDraft && (
            <Button onClick={() => runStatus(api.finalizeContract, "finalize")} disabled={!!action}>
              {action === "finalize" ? "Finalizing…" : "Finalize"}
            </Button>
          )}
          {contract.status === "FINALIZED" && (
            <Button onClick={() => runStatus(api.archiveContract, "archive")} disabled={!!action}>
              {action === "archive" ? "Archiving…" : "Archive"}
            </Button>
          )}
          {isDraft && (
            <Button variant="danger" onClick={remove} disabled={!!action}>Delete</Button>
          )}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {editing && isDraft ? (
            <Card className="overflow-hidden">
              <div className="border-b border-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700">Edit contract (JSON)</div>
              <Textarea className="block h-96 rounded-none border-0 text-xs shadow-none focus:outline-none" value={draftText} onChange={(e) => setDraftText(e.target.value)} spellCheck={false} />
              {fieldErrors.length > 0 && (
                <div className="border-t border-red-100 bg-red-50/50 p-4">
                  <ul className="space-y-1 text-sm text-red-700">
                    {fieldErrors.map((f, i) => (
                      <li key={i} className="flex gap-2">
                        <code className="rounded bg-red-100 px-1.5 py-0.5 text-xs">{f.path || "root"}</code>{f.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
                <Button onClick={saveEdit} disabled={action === "save"}>{action === "save" ? "Saving…" : "Save changes"}</Button>
                <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </Card>
          ) : (
            <>
              <Card className="p-5">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">Contract details</h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                  <Field label="PO Reference" value={contract.poRefNo} />
                  <Field label="PO Date" value={contract.poDate.slice(0, 10)} />
                  <Field label="Payment terms" value={contract.fieldData.payment_terms ?? "—"} />
                  <Field label="Delivery terms" value={contract.fieldData.delivery_terms ?? "—"} />
                </dl>
              </Card>

              <div ref={itemsRef} className="rounded-xl">
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                  <h2 className="text-sm font-semibold text-gray-900">Line items</h2>
                  <span className="text-xs text-gray-400">{items.length} item{items.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-2.5 sm:px-5">Description</th>
                        <th className="px-4 py-2.5 text-right sm:px-5">Qty</th>
                        <th className="px-4 py-2.5 text-right sm:px-5">Unit price</th>
                        <th className="px-4 py-2.5 text-right sm:px-5">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {items.map((it, i) => (
                        <tr key={i}>
                          <td className="min-w-[10rem] px-4 py-3 text-gray-800 sm:px-5">{it.description}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-600 sm:px-5">{it.quantity}{it.quantity_unit ? ` ${it.quantity_unit}` : ""}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-600 sm:px-5">{currency(it.unit_price)}{it.pricing_unit ? ` ${it.pricing_unit}` : ""}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-gray-800 sm:px-5">{currency(it.total ?? it.quantity * it.unit_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200">
                        <td colSpan={3} className="px-4 py-3 text-right text-sm font-medium text-gray-500 sm:px-5">Total</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums text-gray-900 sm:px-5">{currency(grandTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Attachments */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Attachments</h2>
              {isDraft && (
                <label className="cursor-pointer text-xs font-medium text-brand-600 hover:text-brand-700">
                  {action === "upload" ? "Uploading…" : "+ Add PDF"}
                  <input type="file" accept="application/pdf" className="hidden" onChange={onUpload} disabled={action === "upload"} />
                </label>
              )}
            </div>
            {attachments.length === 0 ? (
              <p className="text-xs text-gray-400">No attachments yet.</p>
            ) : (
              <ul className="space-y-2">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <svg className="shrink-0 text-red-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                      <span className="truncate text-xs text-gray-700">{a.fileName}</span>
                      <span className="shrink-0 text-[11px] text-gray-400">{formatBytes(a.size)}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => openPreview(a)}
                        disabled={!!previewLoading}
                        aria-label={`Preview ${a.fileName}`}
                        title="Preview PDF"
                        className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
                      >
                        {previewLoading === a.id ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                      <button onClick={() => orgId && api.downloadAttachment(orgId, id, a.id, a.fileName)} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                        Download
                      </button>
                      {isDraft && (
                        <button
                          onClick={() => removeAttachment(a)}
                          disabled={!!deletingId}
                          aria-label={`Delete ${a.fileName}`}
                          title="Delete PDF"
                          className="rounded-md p-1 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          {deletingId === a.id ? (
                            <Spinner className="h-4 w-4" />
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                          )}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Audit trail timeline */}
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Audit trail</h2>
            {events.length === 0 ? (
              <EmptyState title="No events" />
            ) : (
              <ol className="relative space-y-5 border-l border-gray-200 pl-5">
                {events.map((e) => {
                  const meta = EVENT_META[e.eventType];
                  return (
                    <li key={e.id} className="relative">
                      <span className={`absolute -left-[26px] top-0.5 h-3 w-3 rounded-full ring-4 ring-white ${meta.color}`} />
                      <p className="text-sm font-medium text-gray-800">
                        {meta.label}
                        {e.fromStatus && e.toStatus ? (
                          <span className="font-normal text-gray-500"> · {e.fromStatus} → {e.toStatus}</span>
                        ) : e.toStatus ? (
                          <span className="font-normal text-gray-500"> · {e.toStatus}</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">{new Date(e.createdAt).toLocaleString()}</p>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
      </div>

      <Modal open={!!preview} onClose={closePreview} title={preview?.name}>
        {preview && (
          <div className="flex h-full flex-col">
            <div className="min-h-0 w-full flex-1">
              <PdfViewer url={preview.url} />
            </div>
            <div className="border-t border-gray-100 px-4 py-2 text-center">
              <a
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Not showing? Open in a new tab
              </a>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value}</dd>
    </div>
  );
}
