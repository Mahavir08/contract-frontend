"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg } from "@/lib/org";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/useRealtime";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert, Button, Card, EmptyState, Input } from "@/components/ui";
import type { Contract, ContractStatus, Paginated } from "@/lib/types";

const PAGE_SIZE = 10;
const FILTERS: { label: string; value: ContractStatus | "" }[] = [
  { label: "All", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Finalized", value: "FINALIZED" },
  { label: "Archived", value: "ARCHIVED" },
];

// Per-column visibility, least important columns collapse first on narrow
// screens: phones keep Client / Value / Status. Shared by the header, data
// and skeleton rows so cells always line up.
const COL_VIS = [
  "", // Client
  "hidden md:table-cell", // PO Reference
  "hidden lg:table-cell", // PO Date
  "", // Value
  "", // Status
  "hidden sm:table-cell", // chevron
];

function contractTotal(c: Contract): number {
  return (c.fieldData.items ?? []).reduce(
    (sum, it) => sum + (it.total ?? it.quantity * it.unit_price),
    0
  );
}

const currency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function ContractsPage() {
  const { orgId, org, loading: orgLoading } = useOrg();
  const [clientName, setClientName] = useState("");
  const [contractId, setContractId] = useState("");
  const [status, setStatus] = useState<ContractStatus | "">("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<Contract> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.listContracts(orgId, { status, clientName, contractId, page, pageSize: PAGE_SIZE });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load contracts");
    } finally {
      setLoading(false);
    }
  }, [orgId, status, clientName, contractId, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status, clientName, contractId, orgId]);

  useRealtime(useCallback(() => { load(); }, [load]));

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const from = result && result.total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = result ? Math.min(page * PAGE_SIZE, result.total) : 0;
  const busy = orgLoading || loading;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Contracts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Managing contracts for <span className="font-medium text-gray-700">{org?.name ?? "…"}</span>
          </p>
        </div>
        <Link href="/upload">
          <Button>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New contract
          </Button>
        </Link>
      </div>

      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
              </svg>
              <Input
                className="pl-9"
                placeholder="Search by client name…"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <Input
              className="sm:max-w-[220px]"
              placeholder="Contract ID…"
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
            />
          </div>
          {/* Segmented status filter: full-width with equal segments while the
              toolbar is stacked, natural width once it sits inline at lg. */}
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 lg:inline-flex">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatus(f.value)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors lg:flex-none ${
                  status === f.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {error && <Alert>{error}</Alert>}

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className={`px-4 py-3 sm:px-5 ${COL_VIS[0]}`}>Client</th>
                <th className={`px-4 py-3 sm:px-5 ${COL_VIS[1]}`}>PO Reference</th>
                <th className={`px-4 py-3 sm:px-5 ${COL_VIS[2]}`}>PO Date</th>
                <th className={`px-4 py-3 text-right sm:px-5 ${COL_VIS[3]}`}>Value</th>
                <th className={`px-4 py-3 sm:px-5 ${COL_VIS[4]}`}>Status</th>
                <th className={`px-4 py-3 sm:px-5 ${COL_VIS[5]}`} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {busy ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className={`px-4 py-4 sm:px-5 ${COL_VIS[j]}`}>
                        <div className="h-4 animate-pulse rounded bg-gray-100" style={{ width: j === 0 ? "70%" : "50%" }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : result && result.data.length > 0 ? (
                result.data.map((c) => (
                  <tr key={c.id} className="group transition-colors hover:bg-gray-50/70">
                    <td className={`px-4 py-3.5 sm:px-5 ${COL_VIS[0]}`}>
                      <Link href={`/contracts/${c.id}`} className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                          {c.clientName.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="font-medium text-gray-900 group-hover:text-brand-700">{c.clientName}</span>
                      </Link>
                    </td>
                    <td className={`px-4 py-3.5 text-gray-600 sm:px-5 ${COL_VIS[1]}`}>{c.poRefNo}</td>
                    <td className={`whitespace-nowrap px-4 py-3.5 text-gray-600 sm:px-5 ${COL_VIS[2]}`}>{c.poDate.slice(0, 10)}</td>
                    <td className={`whitespace-nowrap px-4 py-3.5 text-right font-medium tabular-nums text-gray-800 sm:px-5 ${COL_VIS[3]}`}>{currency(contractTotal(c))}</td>
                    <td className={`px-4 py-3.5 sm:px-5 ${COL_VIS[4]}`}><StatusBadge status={c.status} /></td>
                    <td className={`px-4 py-3.5 text-right sm:px-5 ${COL_VIS[5]}`}>
                      <Link href={`/contracts/${c.id}`} className="inline-flex text-gray-300 group-hover:text-gray-500">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="No contracts found" hint="Try adjusting your filters, or upload a new contract." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {result && result.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm text-gray-500 sm:px-5">
            <span>
              Showing <span className="font-medium text-gray-700">{from}–{to}</span> of{" "}
              <span className="font-medium text-gray-700">{result.total}</span>
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <span className="px-1 text-xs">Page {page} of {totalPages}</span>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
