"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/org";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Card, Modal, Textarea } from "@/components/ui";
import { validateContractPayload } from "@/lib/validateContract";
import { formatBytes } from "@/lib/format";
import type { FieldError } from "@/lib/types";

const SAMPLE = `{
  "client_name": "Acme Retail",
  "po_ref_no": "PO-3001",
  "po_date": "2026-05-01",
  "payment_terms": "Net 45",
  "delivery_terms": "FOB Origin",
  "items": [
    {
      "description": "Widget A",
      "quantity": 100,
      "quantity_unit": "pcs",
      "unit_price": 9.99,
      "pricing_unit": "per pc",
      "total": 999
    }
  ]
}`;

const REQUIRED_FIELDS = [
  ["client_name", "string"],
  ["po_ref_no", "string"],
  ["po_date", "YYYY-MM-DD"],
  ["items[].description", "string"],
  ["items[].quantity", "number > 0"],
  ["items[].unit_price", "number ≥ 0"],
];

export default function UploadPage() {
  const { orgId, org } = useOrg();
  const router = useRouter();
  const [text, setText] = useState(SAMPLE);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke the preview object URL when it is replaced or on unmount.
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  function onPickPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.type !== "application/pdf") {
      setMessage("Only PDF files are allowed.");
      e.target.value = "";
      return;
    }
    setMessage(null);
    setPdf(file);
    setPdfUrl(URL.createObjectURL(file));
  }

  function removePdf() {
    setPdf(null);
    setPdfUrl(null);
    setPreviewOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submit() {
    setFieldErrors([]);
    setMessage(null);
    if (!orgId) {
      setMessage("Select an organisation first.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setMessage("Invalid JSON — the document could not be parsed.");
      return;
    }
    // Validate required keys client-side before hitting the API, so the user
    // gets instant feedback. The backend re-validates as the source of truth.
    const localErrors = validateContractPayload(parsed);
    if (localErrors.length > 0) {
      setMessage("Some required fields are missing or invalid.");
      setFieldErrors(localErrors);
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createContract(orgId, parsed as never);
      if (pdf) {
        try {
          await api.uploadAttachment(orgId, created.id, pdf);
        } catch {
          // The contract exists either way — land on it and let the user
          // retry the upload from the attachments panel there.
        }
      }
      router.push(`/contracts/${created.id}`);
    } catch (e) {
      if (e instanceof ApiError) {
        setMessage(e.message);
        if (e.details) setFieldErrors(e.details);
      } else {
        setMessage("Upload failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/contracts" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
          Back to contracts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">Upload contract</h1>
        <p className="mt-1 text-sm text-gray-500">
          Paste structured JSON. It is validated against the required schema and created as a{" "}
          <span className="font-medium text-gray-700">DRAFT</span> in{" "}
          <span className="font-medium text-gray-700">{org?.name ?? "…"}</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
              <span className="text-sm font-medium text-gray-700">Contract JSON</span>
              <button onClick={() => setText(SAMPLE)} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                Reset to sample
              </button>
            </div>
            <Textarea
              className="block h-[26rem] rounded-none border-0 text-xs shadow-none focus:border-0 focus:outline-none"
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />
          </Card>

          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Contract PDF</p>
                <p className="text-xs text-gray-400">Optional — attached to the contract after it is created.</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={onPickPdf}
              />
              <Button
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => fileInputRef.current?.click()}
              >
                {pdf ? "Replace PDF" : "Choose PDF"}
              </Button>
            </div>
            {pdf && (
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
                  <svg className="shrink-0 text-red-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M6 4h9l5 5v11a1 1 0 01-1 1H6a1 1 0 01-1-1V5a1 1 0 011-1zM14 4v6h6" />
                  </svg>
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{pdf.name}</span>
                </div>
                <span className="shrink-0 text-xs text-gray-400">{formatBytes(pdf.size)}</span>
                <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
                  <button
                    onClick={() => setPreviewOpen(true)}
                    aria-label="Preview PDF"
                    title="Preview PDF"
                    className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button
                    onClick={removePdf}
                    aria-label="Remove PDF"
                    title="Remove PDF"
                    className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </Card>

          {message && <Alert>{message}</Alert>}
          {fieldErrors.length > 0 && (
            <Card className="border-red-200 bg-red-50/50 p-4">
              <p className="mb-2 text-sm font-medium text-red-700">Validation errors</p>
              <ul className="space-y-1 text-sm text-red-700">
                {fieldErrors.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <code className="rounded bg-red-100 px-1.5 py-0.5 text-xs">{f.path || "root"}</code>
                    <span>{f.message}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Validating…" : "Validate & create"}
            </Button>
            <Link href="/contracts">
              <Button variant="secondary">Cancel</Button>
            </Link>
          </div>
        </div>

        {/* Helper panel */}
        <Card className="h-fit p-5">
          <h2 className="text-sm font-semibold text-gray-900">Required fields</h2>
          <p className="mt-1 text-xs text-gray-500">All contracts must include the following.</p>
          <ul className="mt-4 space-y-2.5">
            {REQUIRED_FIELDS.map(([field, type]) => (
              <li key={field} className="flex items-center justify-between gap-2 text-xs">
                <code className="text-gray-700">{field}</code>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-500">{type}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-lg bg-brand-50 p-3 text-xs text-brand-700">
            Optional: <code>payment_terms</code>, <code>delivery_terms</code>,{" "}
            <code>quantity_unit</code>, <code>pricing_unit</code>, <code>total</code>.
          </div>
        </Card>
      </div>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title={pdf?.name}>
        {pdfUrl && <iframe src={pdfUrl} title="PDF preview" className="h-full w-full" />}
      </Modal>
    </div>
  );
}
