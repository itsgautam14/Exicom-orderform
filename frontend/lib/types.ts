/** [min_qty, max_qty_or_null, price] */
export type PriceTier = [number, number | null, number];
export type PriceMatrix = Record<string, PriceTier[]>;

export interface CatalogProduct {
  id: string;
  product_code: string;
  code_note: string;
  product_name: string;
  description: string;
  unit_price: number;
  currency: string;
  unit: string;
  category: string;
  prices: PriceMatrix;
  is_active: boolean;
}

export interface LogisticsRate {
  id: string;
  country: string;
  sea_rate: number | null;
  air_up_to_500: number | null;
  air_above_500: number | null;
  status: string; // "pending" | "approved"
}

export interface OrderItem {
  product_code: string;
  code_note: string;
  product_name: string;
  description: string;
  unit_price: number;
  quantity: number;
  unit: string;
  /** Per-line discount percentage (0–100). */
  discount_pct?: number;
  /** EUR only: which pricebook price to use — "with" (MoQ tiers) / "without" (list) / "". */
  eur_discount?: string;
  /** Whether the input cable is included ("Yes" / "No" / ""). */
  input_cable?: string;
  /** Links the line back to its catalog product so currency/qty can re-price it. */
  catalog_id?: string;
}

export interface OrderItemOut extends OrderItem {
  id: string;
  position: number;
  line_total: number;
}

export interface OrderInput {
  quote_number: string;
  prepared_for: string;
  customer_phone?: string;
  customer_email?: string;
  customer_postal_code?: string;
  /** EUR only: EU customs Economic Operators Registration and Identification number. */
  eori_number?: string;
  proposed_by: string;
  quote_date: string;
  offer_valid_through: string;
  incoterms: string;
  currency: string;
  tax_rate: number;

  bill_to_company: string;
  bill_to_gst: string;
  bill_to_address: string;
  bill_to_country: string;

  ship_to_company: string;
  ship_to_gst: string;
  ship_to_address: string;
  ship_to_country: string;

  payment_terms: string;
  /** "predefined" | "custom" */
  payment_term_type?: string;
  /** Actual payment-terms text shown in the PDF. */
  payment_term_text?: string;
  warranty: string;
  validity: string;
  lead_time: string;
  comments: string;

  transport_mode: string;
  transport_country: string;
  transport_qty: number;
  port_of_loading: string;
  port_of_destination: string;
  freight_charge: number;
  insurance_charge: number;
  /** Free-text packing/shipment details entered when requesting logistic approval. */
  packing_details?: string;

  po_required: boolean;
  /** Auto-generated (not user-entered) when "PO/Order Received" is clicked. */
  po_number: string;
  po_amount: string;
  po_date?: string;

  /** Per-browser creator id (set when the quote is saved). */
  created_by?: string;
  /** Internal reason for quoting below pricebook — never shown on the PDF. */
  approval_note?: string;

  items: OrderItem[];
}

export interface OrderOut extends Omit<OrderInput, "items"> {
  id: string;
  /** Approval workflow: "draft" | "submitted" | "approved". */
  status: string;
  /** Why a draft needs sign-off: comma list of "logistics" / "pricebook". */
  approval_reason?: string;
  items: OrderItemOut[];
  subtotal: number;
  tax_amount: number;
  grand_total: number;
}

export interface TrackingStageEvent {
  id: string;
  /** "in_production" | "fg_ready" | "dispatched" | "shipment" | "receipt" */
  stage: string;
  remarks: string;
  /** Who logged this stage entry — hand-entered, not inferred. */
  kam: string;
  created_at: string;
}

export interface TrackingDispatch {
  id: string;
  qty: number | null;
  date: string;
  created_at: string;
}

export interface OrderTracking {
  id: string;
  /** Links back to the quotation this row was generated from; blank if added manually. */
  quote_number?: string;
  partner: string;
  /** Destination country — shown in the UI as "Country". */
  market: string;
  kam: string;
  ordered: string;
  /** Product code(s), auto-filled from the linked quotation's line items — never hand-typed. */
  part_code?: string;
  specifications: string;
  date_of_order: string;
  /** Plain hand-entered date, not part of the Fulfillment Tracker pipeline. */
  advance_received_date?: string;
  value: number | null;
  currency: string;
  /** Total ordered quantity — divides into `value` for the dispatch price split. */
  total_quantity?: number | null;
  /** Airways / Sea Freight, fetched from the linked quotation's logistics section. */
  transport_mode?: string;
  date_of_dispatch: string;
  ex_date_of_delivery: string;
  status: string;
  notes: string;

  /** Freely editable by anyone. */
  expected_dispatch_date?: string;
  /** Locked — only settable via api.updatePlannedDates (admin password required). */
  planned_production_date?: string;
  /** Locked — only settable via api.updatePlannedDates (admin password required). */
  planned_fg_readiness_date?: string;
  /** Locked — only settable via api.updatePlannedDates (admin password required). */
  planned_dispatch_date?: string;

  /** Null until the "dispatch in tranches?" prompt is answered. */
  dispatch_in_tranches?: boolean | null;
  /** Open-ended list of dispatch tranche slots — add/remove as many as needed. */
  dispatches?: TrackingDispatch[];

  /** Single consolidated dispatch, used when dispatch_in_tranches is false. */
  bulk_product?: string;
  bulk_part_code?: string;
  bulk_qty?: number | null;
  bulk_date?: string;
  bulk_kam?: string;

  /** Fulfillment pipeline position: "in_production" | "fg_ready" | "dispatched" | "shipment" | "receipt". */
  current_stage: string;
  doc_filename: string;
  doc_content_type: string;
  stage_events: TrackingStageEvent[];
}

/** Fields an admin can set while publishing a draft. */
export interface OrderPublish {
  incoterms?: string;
  transport_mode?: string;
  transport_country?: string;
  transport_qty?: number;
  port_of_loading?: string;
  port_of_destination?: string;
  freight_charge?: number;
  insurance_charge?: number;
  payment_terms?: string;
  payment_term_type?: string;
  payment_term_text?: string;
  /** Standing per-unit rate (INR/pallet or INR/box) — saved as this country's rate too. */
  unit_rate?: number;
  /** Filled in by the logistics reviewer, not the sales person. */
  packing_details?: string;
}
