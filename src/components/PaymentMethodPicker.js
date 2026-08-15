'use client';

import { useMemo } from 'react';
import {
  PAYMENT_METHODS,
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  calcPaymentFee,
} from '@/lib/paymentFee';

const formatIDR = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

function formatFeeHint(method, methodKey, base) {
  if (method.fee.flat != null) return `+ ${formatIDR(method.fee.flat)}`;
  if (method.fee.percent != null) {
    const percent = (method.fee.percent * 100).toFixed(method.fee.percent < 0.01 ? 2 : 1);
    if (base > 0) return `+ ${percent}% (${formatIDR(calcPaymentFee(methodKey, base))})`;
    return `+ ${percent}%`;
  }
  return '';
}

/**
 * Picker for DOKU payment methods. Groups by category and shows the fee
 * amount per row so customer sees what they'll pay before picking.
 *
 * @param {string|null} value  — currently selected method key
 * @param {(key:string)=>void} onChange
 * @param {number} base        — subtotal + shipping for percent-fee preview
 */
export default function PaymentMethodPicker({ value, onChange, base = 0 }) {
  const grouped = useMemo(() => {
    const out = {};
    for (const cat of CATEGORY_ORDER) out[cat] = [];
    for (const [key, m] of Object.entries(PAYMENT_METHODS)) {
      if (!out[m.category]) out[m.category] = [];
      out[m.category].push({ key, ...m });
    }
    return out;
  }, []);

  return (
    <div className="payment-picker">
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat] || [];
        if (items.length === 0) return null;
        return (
          <div key={cat} className="payment-picker-group">
            <div className="payment-picker-group-title">{CATEGORY_LABEL[cat] || cat}</div>
            <div className="payment-picker-list">
              {items.map((m) => {
                const selected = value === m.key;
                return (
                  <label
                    key={m.key}
                    className={`payment-picker-item ${selected ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={m.key}
                      checked={selected}
                      onChange={() => onChange(m.key)}
                    />
                    <span className="payment-picker-label">{m.label}</span>
                    <span className="payment-picker-fee">{formatFeeHint(m, m.key, base)}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      <style jsx>{`
        .payment-picker {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .payment-picker-group-title {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          margin-bottom: 0.5rem;
        }
        .payment-picker-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 0.5rem;
        }
        .payment-picker-item {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.7rem 0.9rem;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          background: var(--bg-card);
        }
        .payment-picker-item:hover {
          border-color: var(--primary);
        }
        .payment-picker-item.selected {
          border-color: var(--primary);
          background: color-mix(in oklab, var(--primary) 8%, transparent);
        }
        .payment-picker-item input[type='radio'] {
          margin: 0;
          cursor: pointer;
          accent-color: var(--primary);
        }
        .payment-picker-label {
          flex: 1;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-main);
        }
        .payment-picker-fee {
          font-size: 0.72rem;
          color: var(--text-muted);
          white-space: nowrap;
        }
        @media (max-width: 767px) {
          .payment-picker-list {
            grid-template-columns: 1fr;
          }
          .payment-picker-item {
            padding: 0.6rem 0.75rem;
          }
          .payment-picker-label {
            font-size: 0.82rem;
          }
        }
      `}</style>
    </div>
  );
}
