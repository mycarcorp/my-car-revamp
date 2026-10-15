  delivery_address: string | null;
  license_status: LicenseStatus;
  // Status is only updated by a verified private-upload server action or authorized staff.
  preferred_appointment_date: string | null;
  preferred_appointment_time: string | null;
  appointment_notes: string | null;
  appointment_status: AppointmentStatus;
  assigned_to: string | null;
  lead_id: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};
export type PurchaseEvent = {
  id: number;
  purchase_id: number;
  event_type: string;
  message: string | null;
  visible_to_customer: boolean;
  author: string | null;
  created_at: string;
};
export const CUSTOMER_EDITABLE_FIELDS = [
  'full_name', 'email', 'phone', 'date_of_birth', 'address', 'city', 'state', 'zip',
  'payment_method', 'lender_name', 'preapproval_amount', 'down_payment_cents', 'finance_term_months',
  'has_trade_in', 'trade_year_make_model', 'trade_mileage', 'trade_vin', 'trade_payoff',
  'fulfillment_method', 'delivery_address',
] as const;
const filled = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== '';
type StepInput = Partial<Purchase>;
export function isStepComplete(p: StepInput, step: PurchaseStep): boolean {
  switch (step) {
    case 'vehicle': return filled(p.vehicle_id) || filled(p.vehicle_title);
    case 'personal': return filled(p.full_name) && filled(p.email) && String(p.email).includes('@') && filled(p.phone) && filled(p.address) && filled(p.zip);
    case 'payment':
      if (!PAYMENT_METHODS.some(m => m.key === p.payment_method)) return false;
      if (p.payment_method === 'outside_financing') return filled(p.lender_name);
      return true;
    case 'trade':
      return p.has_trade_in === false || (p.has_trade_in === true && filled(p.trade_year_make_model) && filled(p.trade_mileage));
    case 'fulfillment': return p.fulfillment_method === 'pickup' || (p.fulfillment_method === 'delivery' && filled(p.delivery_address));
    case 'license': return ['submitted', 'under_review', 'approved'].includes(p.license_status ?? '');
    case 'review': return filled(p.submitted_at) || (p.status !== undefined && p.status !== 'draft');
    case 'schedule': return ['pending_confirmation', 'confirmed'].includes(p.appointment_status ?? '');
    case 'tracking': return p.status === 'completed';
  }
}
/** Must finish customer-side intake, including secure document submission, before submitting. */
export function canSubmit(p: StepInput): boolean {
  return (['vehicle', 'personal', 'payment', 'trade', 'fulfillment', 'license'] as const).every(s => isStepComplete(p, s));
}
/** Progress reflects submitted milestones, not simply visited screens. */
export function progressPercent(p: StepInput): number {
  const done = PURCHASE_STEPS.filter(s => isStepComplete(p, s.key)).length;
  return Math.round(done / PURCHASE_STEPS.length * 100);
}
export const isPurchaseStatus = (v: unknown): v is PurchaseStatus => PURCHASE_STATUSES.some(s => s.key === v);
export const isOpenStatus = (s: PurchaseStatus): boolean => s !== 'completed' && s !== 'cancelled';
export const statusLabel = (s: string) => PURCHASE_STATUSES.find(x => x.key === s)?.label ?? s;
export const paymentLabel = (s: string | null) => PAYMENT_METHODS.find(x => x.key === s)?.label ?? 'Not chosen';
export const PURCHASE_SETUP_PENDING = 'PURCHASE_SETUP_PENDING';
