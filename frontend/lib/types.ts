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

export interface OrderItem {
  product_code: string;
  code_note: string;
  product_name: string;
  description: string;
  unit_price: number;
  quantity: number;
  unit: string;
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
  offer_valid_through: string;
  incoterms: string;
  currency: string;
  tax_rate: number;

  bill_to_company: string;
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

  transport_mode: string;
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
  items: OrderItemOut[];
  subtotal: number;
  tax_amount: number;
  grand_total: number;
}
