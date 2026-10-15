import { NextResponse } from 'next/server';
import {
  PAYMENT_METHODS,
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  getSelectableMethods,
} from '@/lib/paymentFee';
import { getRuntimeInactiveTypes } from '@/lib/channelStatus';

/**
 * GET /api/payment/channels
 *
 * Returns the list of payment methods currently available for the picker.
 * Combines the hardcoded `inactive` flag in paymentFee.js with runtime
 * detection from channelStatus.js (auto-populated when DOKU rejects a
 * channel with "PAYMENT CHANNEL IS INACTIVE").
 *
 * Public endpoint — no auth needed. Only exposes channel keys, labels,
 * categories, and fee info. No PII, no order data.
 */
export async function GET() {
  try {
    // Start with hardcoded-selectable channels (already excludes inactive: true)
    const hardcodeSelectable = getSelectableMethods();

    // Filter out channels that DOKU has recently rejected at runtime
    const runtimeInactive = getRuntimeInactiveTypes();
    const available = hardcodeSelectable.filter(
      (m) => !runtimeInactive.has(m.dokuType)
    );

    // Group by category for the picker
    const grouped = {};
    for (const cat of CATEGORY_ORDER) grouped[cat] = [];
    for (const m of available) {
      if (!grouped[m.category]) grouped[m.category] = [];
      grouped[m.category].push(m);
    }

    return NextResponse.json({
      methods: available,
      grouped,
      categoryOrder: CATEGORY_ORDER,
      categoryLabels: CATEGORY_LABEL,
      // Let the client know how many channels are runtime-disabled so admin
      // can investigate if the count seems high.
      runtimeDisabledCount: runtimeInactive.size,
    });
  } catch (error) {
    console.error('Error fetching payment channels:', error);
    return NextResponse.json(
      { error: 'Gagal memuat daftar metode pembayaran.' },
      { status: 500 }
    );
  }
}
