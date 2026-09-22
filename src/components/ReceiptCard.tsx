"use client";

import React from 'react';
import { Phone, FileText } from 'lucide-react';
import { Receipt, Operator, getThemeColors, FALLBACK_USER } from '@/types';

interface ReceiptCardProps {
  receipt: Receipt;
  operators?: Operator[];
  justAddedId: string | null;
  onOpen: (id: string) => void;
}

export function ReceiptCard({ receipt, operators, justAddedId, onOpen }: ReceiptCardProps) {
  const op = (operators || []).find((o) => o.name === receipt.operatorName);
  const u = op ? { name: op.name, ...getThemeColors(op.theme) } : FALLBACK_USER;
  
  const formatPhone = (raw: string) => {
    let d = raw.replace(/\D/g, '');
    if (d.length > 8 && d.startsWith('216')) d = d.slice(3);
    d = d.slice(0, 8);
    return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8)].filter(Boolean).join(' ');
  };

  const fmtDate = (iso: string | undefined) => { 
    if (!iso) return '—'; 
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
      return '—';
    }
  };

  return (
    <article 
      data-id={receipt._id} 
      className={`flex min-w-0 flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-300 transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-gray-400 ${receipt._id === justAddedId ? 'card-new' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-14 w-11 shrink-0 place-items-center overflow-hidden rounded-md bg-gray-50 text-gray-400 ring-1 ring-gray-200">
          <FileText className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-gray-900">{receipt.clientDetails?.nom || 'Élève non renseigné'}</h3>
          <p className="tnum mt-1 flex items-center gap-1.5 text-sm text-gray-500">
            <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
            <span className="truncate">{formatPhone(receipt.clientDetails?.telephone || '')}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs font-medium text-gray-500">{fmtDate(receipt.paymentDate)}</span>
          {receipt.amount !== undefined && (
            <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700 ring-1 ring-inset ring-green-600/20">
              {receipt.amount} DT
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
        {receipt.clientDetails?.classe && (
          <div className="flex-1 min-w-[100px] rounded-lg bg-gray-50 px-2.5 py-1.5 text-gray-700 ring-1 ring-inset ring-gray-100">
            <span className="block text-[11px] font-medium text-gray-400">Offre</span>
            <span className="block truncate">{receipt.clientDetails.classe}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-2 border-t border-gray-100 pt-3">
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: u.bg, color: u.fg }}>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: u.dot }}></span>
          <span className="truncate">Importé par {u.name}</span>
        </span>
        {receipt.paymentMode && receipt.paymentDetails && (
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-900">
            <span className="truncate">{receipt.paymentMode}, {receipt.paymentDetails}</span>
          </span>
        )}
      </div>

      <button 
        type="button" 
        onClick={() => onOpen(receipt._id)}
        className="btn btn-secondary mt-3 w-full hover:!bg-gray-900 hover:!text-white hover:!ring-gray-900"
      >
        {receipt.status === 'PROCESSED' ? 'Voir' : 'Voir et Traiter'}
      </button>
    </article>
  );
}
