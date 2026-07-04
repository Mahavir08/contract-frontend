export type ContractStatus = "DRAFT" | "FINALIZED" | "ARCHIVED";

export type Organisation = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};

export type ContractItem = {
  description: string;
  quantity: number;
  quantity_unit?: string;
  unit_price: number;
  pricing_unit?: string;
  total?: number;
};

export type ContractPayload = {
  client_name: string;
  po_ref_no: string;
  po_date: string;
  payment_terms?: string;
  delivery_terms?: string;
  items: ContractItem[];
};

export type Contract = {
  id: string;
  orgId: string;
  clientName: string;
  poRefNo: string;
  poDate: string;
  status: ContractStatus;
  fieldData: ContractPayload;
  createdAt: string;
  updatedAt: string;
};

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type EventType = "CREATED" | "UPDATED" | "STATUS_CHANGED" | "DELETED";

export type ContractEvent = {
  id: string;
  orgId: string;
  contractId: string | null;
  eventType: EventType;
  fromStatus: ContractStatus | null;
  toStatus: ContractStatus | null;
  changes: unknown;
  actor: string;
  createdAt: string;
};

export type Attachment = {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
};

export type FieldError = { path: string; message: string };
