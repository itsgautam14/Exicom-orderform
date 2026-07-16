// Predefined Payment Terms options, shared by the Quote Form and the Approval page
// so both dropdowns stay identical.
export const PAYMENT_PRESETS = [
  "100% advance",
  "50% advance payment on PO release, 50% on material dispatch",
];

/** Whether a stored payment-terms value should open as "Custom…". */
export function isCustomPaymentTerm(type?: string, text?: string): boolean {
  if (type === "custom") return true;
  if (type === "predefined") return false;
  // Fallback for older records with no type: custom if the text isn't a preset.
  return !!text && !PAYMENT_PRESETS.includes(text);
}
