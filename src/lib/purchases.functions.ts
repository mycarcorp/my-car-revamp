
export const saveMyPurchase = createServerFn({ method: 'POST' })
  .inputValidator((input: { accessToken: string; id: number; patch: Record<string, unknown>; step?: string }) => {
    const patch: Record<string, unknown> = {};
    for (const f of CUSTOMER_EDITABLE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(input?.patch ?? {}, f)) continue;
      const v = input.patch[f];
      if (f === 'has_trade_in') {
        if (v !== null && typeof v !== 'boolean') throw new Error('Invalid trade-in selection.');
        patch[f] = v;
      } else if (['preapproval_amount', 'trade_mileage', 'trade_payoff', 'down_payment_cents', 'finance_term_months'].includes(f)) {
        const n = numOrNull(v);
        if (n !== null && (n < 0 || (f === 'finance_term_months' && (!Number.isInteger(n) || n > 120)))) throw new Error(`Invalid ${f}.`);
        patch[f] = n;
      } else if (f === 'date_of_birth') {
        patch[f] = isoDate(v);
      } else if (f === 'payment_method') {
        if (v !== null && !['cash', 'mycar_financing', 'outside_financing'].includes(String(v))) throw new Error('Invalid payment method.');
        patch[f] = v;
      } else if (f === 'fulfillment_method') {
        if (v !== null && v !== 'pickup' && v !== 'delivery') throw new Error('Invalid pickup/delivery option.');
        patch[f] = v;
      } else {
        patch[f] = clip(v, f === 'address' || f === 'delivery_address' ? 500 : 255);
      }
    }
    const step = PURCHASE_STEPS.some(s => s.key === input?.step) ? input.step as PurchaseStep : undefined;
    return { accessToken: token(input), id: validId(input.id), patch, step };
  })
  .handler(async ({ data }): Promise<Purchase> => {
    const { requireUser, getPurchaseRow, rest } = await import('./purchases.server');
    const user = await requireUser(data.accessToken);
    const p = await getPurchaseRow(data.id);
    if (!p || p.user_id !== user.id) throw new Error('Purchase not found.');
    if (p.status !== 'draft') throw new Error('This purchase was already submitted. Contact us to change purchase details.');
    const body: Record<string, unknown> = { ...data.patch, updated_at: new Date().toISOString() };
    // Schedule and tracking must not become the active step before submission.
    if (data.step && data.step !== 'schedule' && data.step !== 'tracking') body.current_step = data.step;
    const rows = await rest<Purchase[]>(`mc_purchases?id=eq.${p.id}`, { method: 'PATCH', prefer: 'return=representation', body });
    return rows[0]!;
  });

export const submitMyPurchase = createServerFn({ method: 'POST' })
  .inputValidator((input: { accessToken: string; id: number; attribution?: Record<string, string> }) => {
    const attribution: Record<string, string> = {};
    for (const [k, v] of Object.entries(input?.attribution ?? {}).slice(0, 60)) attribution[String(k).slice(0, 60)] = String(v ?? '').slice(0, 500);
    return { accessToken: token(input), id: validId(input.id), attribution };
  })
  .handler(async ({ data }): Promise<Purchase> => {
    const { requireUser, getPurchaseRow, rest, addEvent } = await import('./purchases.server');
    const user = await requireUser(data.accessToken);
    const p = await getPurchaseRow(data.id);
    if (!p || p.user_id !== user.id) throw new Error('Purchase not found.');
    if (p.status !== 'draft') return p;
    if (!canSubmit(p)) throw new Error('Complete purchase details, pickup/delivery choice, and secure license submission before submitting.');
    const now = new Date().toISOString();
    const details = {
      purchase_id: p.id, vehicle_title: p.vehicle_title, vehicle_vin: p.vehicle_vin,
      vehicle_price: p.vehicle_price_cents != null ? (p.vehicle_price_cents / 100).toFixed(2) : null,
      payment_method: p.payment_method, lender_name: p.lender_name,
      preapproval_amount: p.preapproval_amount, down_payment_cents: p.down_payment_cents,
      finance_term_months: p.finance_term_months, has_trade_in: p.has_trade_in,
      trade_year_make_model: p.trade_year_make_model, trade_mileage: p.trade_mileage,
      trade_payoff: p.trade_payoff, fulfillment_method: p.fulfillment_method,
      delivery_address: p.delivery_address, license_status: p.license_status,
      ...data.attribution,
    };
    let leadId: string | null = null;
    const isUuid = /^[0-9a-f-]{36}$/i.test(p.vehicle_id ?? '');
    const leadBody = {
      status: 'new', full_name: p.full_name ?? 'Customer', email: p.email ?? user.email ?? '',
      phone: p.phone, message: `Buy a car: ${p.vehicle_title ?? ''}`, user_id: user.id,
      vehicle_id: isUuid ? p.vehicle_id : null, details,
    };
    for (const lead_type of ['purchase', 'availability']) {
      try {
        const rows = await rest<Array<{ id: string }>>('leads', {
          method: 'POST', profile: 'public', prefer: 'return=representation',
          body: { ...leadBody, lead_type, details: { ...details, request_kind: 'purchase' } },
        });
        leadId = rows?.[0]?.id ?? null;
        break;
      } catch (e) { console.error('[purchases] lead insert failed', lead_type, e); }
    }
    const rows = await rest<Purchase[]>(`mc_purchases?id=eq.${p.id}`, {
      method: 'PATCH', prefer: 'return=representation',
      body: { status: 'submitted', current_step: 'schedule', submitted_at: now, updated_at: now, lead_id: leadId },
    });
    await addEvent({ purchase_id: p.id, event_type: 'submitted', message: 'Purchase submitted for dealership review. Request a pickup or delivery appointment next.', visible_to_customer: true, author: null });
    try {
      const { postToGhl } = await import('./ghl-webhook.server');
      const [first, ...last] = String(p.full_name ?? '').trim().split(/\s+/);
      await postToGhl({
        event_type: 'purchase_submitted', source: 'MyCar Website', full_name: p.full_name,
        first_name: first ?? '', last_name: last.join(' '), email: p.email, phone: p.phone,
        address: p.address, city: p.city, state: p.state, zip: p.zip,
        vehicle_id: p.vehicle_id, vin: p.vehicle_vin, vehicle_title: p.vehicle_title,
        vehicle_price: details.vehicle_price, payment_method: p.payment_method,
        lender_name: p.lender_name, has_trade_in: p.has_trade_in ? 'yes' : 'no',
        trade_year_make_model: p.trade_year_make_model, fulfillment_method: p.fulfillment_method,
        submitted_at: now, ...data.attribution,
      });
    } catch (e) { console.error('[purchases] GHL delivery failed', e); }
    return rows[0]!;
  });

/** Customer requests a preferred time only; dealership staff must separately confirm it. */
export const requestPurchaseAppointment = createServerFn({ method: 'POST' })
  .inputValidator((input: { accessToken: string; id: number; date: string; time: string; notes?: string }) => {
    const date = isoDate(input.date);
    const time = String(input.time ?? '');
    if (!date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Choose a valid appointment date and time.');
    return { accessToken: token(input), id: validId(input.id), date, time, notes: clip(input.notes, 1000) };
  })
  .handler(async ({ data }): Promise<Purchase> => {
    const { requireUser, getPurchaseRow, rest, addEvent } = await import('./purchases.server');
    const user = await requireUser(data.accessToken);
    const p = await getPurchaseRow(data.id);
    if (!p || p.user_id !== user.id) throw new Error('Purchase not found.');
    if (p.status === 'draft' || p.status === 'completed' || p.status === 'cancelled') throw new Error('Submit an active purchase first.');
    if (!p.fulfillment_method) throw new Error('Select pickup or delivery before scheduling.');
    const today = new Date().toISOString().slice(0, 10);
    if (data.date < today) throw new Error('Select a future appointment date.');
    const rows = await rest<Purchase[]>(`mc_purchases?id=eq.${p.id}`, {
      method: 'PATCH', prefer: 'return=representation',
      body: {
        preferred_appointment_date: data.date, preferred_appointment_time: data.time,
        appointment_notes: data.notes, appointment_status: 'pending_confirmation',
