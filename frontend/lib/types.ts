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

  po_required: boolean;
  po_number: string;
  po_amount: string;

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

/** Logistics fields an admin fills before publishing a draft. */
export interface OrderPublish {
  incoterms?: string;
  transport_mode?: string;
  transport_country?: string;
  transport_qty?: number;
  port_of_loading?: string;
  port_of_destination?: string;
  freight_charge?: number;
  insurance_charge?: number;
}
