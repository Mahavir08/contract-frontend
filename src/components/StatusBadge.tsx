import type { ContractStatus } from "@/lib/types";

const styles: Record<ContractStatus, { badge: string; dot: string }> = {
  DRAFT: { badge: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  FINALIZED: { badge: "bg-brand-50 text-brand-700 ring-brand-600/20", dot: "bg-brand-500" },
  ARCHIVED: { badge: "bg-gray-100 text-gray-600 ring-gray-500/20", dot: "bg-gray-400" },
};

export function StatusBadge({ status }: { status: ContractStatus }) {
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${s.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}
