import type {
  Attachment,
  Contract,
  ContractEvent,
  ContractPayload,
  ContractStatus,
  FieldError,
  Organisation,
  Paginated,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Error carrying the HTTP status and (for 400s) the structured field errors
// so the UI can render inline validation feedback.
export class ApiError extends Error {
  status: number;
  details?: FieldError[];
  constructor(status: number, message: string, details?: FieldError[]) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// What is T here
async function request<T>(
  path: string,
  opts: { method?: string; orgId?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.orgId) headers["x-org-id"] = opts.orgId;
  if (opts.body !== undefined) headers["content-type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? "Request failed", data?.details);
  }
  return data as T;
}

export const api = {
  listOrganisations: () => request<Organisation[]>("/api/organisations"),

  createOrganisation: (name: string) =>
    request<Organisation>("/api/organisations", { method: "POST", body: { name } }),

  listContracts: (
    orgId: string,
    params: { status?: ContractStatus | ""; clientName?: string; contractId?: string; page?: number; pageSize?: number }
  ) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.clientName) q.set("clientName", params.clientName);
    if (params.contractId) q.set("contractId", params.contractId);
    if (params.page) q.set("page", String(params.page));
    if (params.pageSize) q.set("pageSize", String(params.pageSize));
    return request<Paginated<Contract>>(`/api/contracts?${q.toString()}`, { orgId });
  },

  getContract: (orgId: string, id: string) => request<Contract>(`/api/contracts/${id}`, { orgId }),

  createContract: (orgId: string, payload: ContractPayload) =>
    request<Contract>("/api/contracts", { method: "POST", orgId, body: payload }),

  updateContract: (orgId: string, id: string, payload: ContractPayload) =>
    request<Contract>(`/api/contracts/${id}`, { method: "PATCH", orgId, body: payload }),

  finalizeContract: (orgId: string, id: string) =>
    request<Contract>(`/api/contracts/${id}/finalize`, { method: "POST", orgId }),

  archiveContract: (orgId: string, id: string) =>
    request<Contract>(`/api/contracts/${id}/archive`, { method: "POST", orgId }),

  deleteContract: (orgId: string, id: string) =>
    request<void>(`/api/contracts/${id}`, { method: "DELETE", orgId }),

  listEvents: (orgId: string, id: string) =>
    request<ContractEvent[]>(`/api/contracts/${id}/events`, { orgId }),

  listAttachments: (orgId: string, id: string) =>
    request<Attachment[]>(`/api/contracts/${id}/attachments`, { orgId }),

  uploadAttachment: async (orgId: string, id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/api/contracts/${id}/attachments`, {
      method: "POST",
      headers: { "x-org-id": orgId },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data?.error ?? "Upload failed", data?.details);
    return data as Attachment;
  },

  // Download via fetch (so we can send the X-Org-Id header) then trigger a save.
  downloadAttachment: async (orgId: string, id: string, attachmentId: string, fileName: string) => {
    const res = await fetch(`${API_URL}/api/contracts/${id}/attachments/${attachmentId}/download`, {
      headers: { "x-org-id": orgId },
    });
    if (!res.ok) throw new ApiError(res.status, "Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export { API_URL };
