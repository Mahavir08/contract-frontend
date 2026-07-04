"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/org";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Card, Textarea } from "@/components/ui";
import { validateContractPayload } from "@/lib/validateContract";
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

          <div className="flex gap-2">
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
    </div>
  );
}
