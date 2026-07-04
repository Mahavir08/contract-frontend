import type { FieldError } from "./types";

// Client-side mirror of the backend `contractPayloadSchema`
// (backend/src/schemas/contract.ts). Kept dependency-free so the upload UI can
// give instant required-key feedback before hitting the API. The backend Zod
// schema remains the source of truth; this only front-runs the round-trip.
//
// Paths and messages are aligned with the backend so inline errors read the
// same whether they come from here or from a 400 response.

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function requireString(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  errors: FieldError[]
) {
  const v = obj[key];
  if (typeof v !== "string" || v.trim().length === 0) {
    errors.push({ path, message: `${key} is required` });
  }
}

function checkItem(item: unknown, index: number, errors: FieldError[]) {
  const base = `items.${index}`;
  if (!isPlainObject(item)) {
    errors.push({ path: base, message: "item must be an object" });
    return;
  }

  requireString(item, "description", `${base}.description`, errors);

  const quantity = item.quantity;
  if (typeof quantity !== "number" || Number.isNaN(quantity) || quantity <= 0) {
    errors.push({ path: `${base}.quantity`, message: "quantity must be > 0" });
  }

  const unitPrice = item.unit_price;
  if (typeof unitPrice !== "number" || Number.isNaN(unitPrice) || unitPrice < 0) {
    errors.push({ path: `${base}.unit_price`, message: "unit_price must be >= 0" });
  }
}

/**
 * Validate a parsed contract payload against the required schema.
 * Returns an empty array when valid.
 */
export function validateContractPayload(payload: unknown): FieldError[] {
  const errors: FieldError[] = [];

  if (!isPlainObject(payload)) {
    errors.push({ path: "", message: "Contract must be a JSON object." });
    return errors;
  }

  requireString(payload, "client_name", "client_name", errors);
  requireString(payload, "po_ref_no", "po_ref_no", errors);

  const poDate = payload.po_date;
  if (typeof poDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(poDate)) {
    errors.push({ path: "po_date", message: "po_date must be in YYYY-MM-DD format" });
  } else if (Number.isNaN(Date.parse(poDate))) {
    errors.push({ path: "po_date", message: "po_date must be a valid date" });
  }

  const items = payload.items;
  if (!Array.isArray(items) || items.length === 0) {
    errors.push({ path: "items", message: "at least one item is required" });
  } else {
    items.forEach((item, i) => checkItem(item, i, errors));
  }

  return errors;
}
