"use client";

import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { generateReceiptReference } from '@/lib/receiptReference';
import { resolveExactReceiptDate } from '@/lib/dateUtils';

export interface PaymentReceiptData {
  reference?: string;
  studentName?: string;
  phone: string;
  offer?: string;
  familyGroup?: string;
  amount?: number | string;
  operatorName?: string;
  paymentDate?: string | Date;
  createdAt?: string | Date;
}

interface PaymentReceiptTicketProps {
  data: PaymentReceiptData;
  ticketRef?: React.RefObject<HTMLDivElement | null>;
}

export function PaymentReceiptTicket({ data, ticketRef }: PaymentReceiptTicketProps) {
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  // Date de référence authentique résolue
  const validDate = resolveExactReceiptDate(data.paymentDate, data.createdAt);

  // Format JJ/MM/AAAA HH:mm
  const day = String(validDate.getDate()).padStart(2, '0');
  const month = String(validDate.getMonth() + 1).padStart(2, '0');
  const year = validDate.getFullYear();
  const hours = String(validDate.getHours()).padStart(2, '0');
  const minutes = String(validDate.getMinutes()).padStart(2, '0');
  const formattedDateTime = `${day}/${month}/${year} ${hours}:${minutes}`;

  // Référence officielle normalisée
  const reference = data.reference || generateReceiptReference(data.phone, validDate);

  // Code-barres scannable (Code 128) - 100% responsive et vectoriel
  useEffect(() => {
    if (barcodeRef.current && reference) {
      try {
        JsBarcode(barcodeRef.current, reference, {
          format: 'CODE128',
          lineColor: '#000000',
          width: 1.5,
          height: 48,
          displayValue: false,
          margin: 0,
        });

        // Garantir un dimensionnement SVG 100% fluide et réactif sans débordement horizontal
        const svg = barcodeRef.current;
        const w = svg.getAttribute('width');
        const h = svg.getAttribute('height');
        if (w && h) {
          svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
          svg.removeAttribute('width');
          svg.removeAttribute('height');
          svg.style.width = '100%';
          svg.style.maxWidth = '340px';
          svg.style.height = '48px';
          svg.style.display = 'block';
          svg.style.margin = '0 auto';
        }
      } catch (err) {
        console.error('Erreur génération code-barres:', err);
      }
    }
  }, [reference]);

  const montantAffiche = data.amount !== undefined && data.amount !== null && data.amount !== ''
    ? `${data.amount} DT`
    : 'Non renseigne';

  return (
    <article
      ref={ticketRef as any}
      id="printableTicket"
      className="tk bg-white text-[#1b1b1b] select-none print:shadow-none print:w-full print:p-0"
      style={{
        width: 'min(400px, 92vw)',
        maxWidth: '100%',
        boxSizing: 'border-box',
        padding: '24px 20px 28px',
        fontFamily: "'Courier New', Courier, monospace",
        lineHeight: 1.5,
        position: 'relative',
        background: '#ffffff',
      }}
    >
      {/* 1. Header Logo Officiel Elios Academy */}
      <div className="flex justify-center mb-3">
        <img
          src="/LogoReceipt.png"
          alt="Elios Academy"
          className="w-[145px] sm:w-[160px] h-auto object-contain block mx-auto"
        />
      </div>

      {/* 2. Coordonnées & Cachet Bleu Officiel - Flux flex côte-à-côte transparent sans overlap */}
      <div className="flex justify-between items-start gap-1 sm:gap-2 my-3">
        {/* Adresse Elios Academy */}
        <div 
          className="text-[#2b2b2b] text-[11px] sm:text-[12px] shrink leading-[1.6]"
        >
          <p className="font-bold text-[#111]">Elios Academy</p>
          <p className="whitespace-nowrap">20 Avenue Du 20 Mars 1956</p>
          <p className="whitespace-nowrap">Tunis 1029, Beb Sadoun</p>
        </div>

        {/* Cachet Bleu - Fond transparent, bordure bleue, typographie authentique */}
        <div 
          className="shrink-0 border-[1.8px] border-[#2340C8] text-[#2340C8] px-2 py-1 text-center rounded-[3px] select-none pointer-events-none transform -rotate-[4deg] bg-transparent"
          style={{ maxWidth: '160px', lineHeight: 1.25 }}
        >
          <b className="block font-bold text-[11px] sm:text-[12px] italic" style={{ fontFamily: "var(--font, system-ui, sans-serif)" }}>
            Elios Academy
          </b>
          <i className="block text-[9px] sm:text-[9.5px] italic mt-0.5 text-[#2563eb]" style={{ fontFamily: "var(--font, system-ui, sans-serif)" }}>
            Activités Informatiques
          </i>
          <span className="block text-[8px] sm:text-[8.5px] mt-0.5 text-[#2563eb]" style={{ fontFamily: "Arial, sans-serif" }}>
            20 Av. 20 Mars - Tunis 1029
          </span>
          <code className="block text-[8px] sm:text-[8.5px] font-bold mt-0.5 text-[#2340C8]" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
            MF: 1858166/V/A/M0000
          </code>
        </div>
      </div>

      {/* 3. Date & Référence */}
      <div className="text-[11.5px] sm:text-[12px] text-[#222] my-2 leading-[1.6]">
        <p>
          <span className="font-semibold text-black">Date : </span>
          <span>{formattedDateTime}</span>
        </p>
        <p>
          <span className="font-semibold text-black">Reference : </span>
          <span>{reference}</span>
        </p>
      </div>

      {/* Ligne pointillée séparatrice */}
      <div className="border-t-[1.5px] border-dashed border-[#999] my-2.5" />

      {/* 4. Données de l'élève et encaissement */}
      <div className="space-y-1.5 text-[11.5px] sm:text-[12px] text-[#222]">
        <div className="flex justify-between items-start gap-2">
          <span className="text-[#333] shrink-0">Eleve</span>
          <span className="text-black text-right uppercase font-semibold break-all">
            {data.studentName || 'NON SPECIFIE'}
          </span>
        </div>

        {data.familyGroup && (
          <div className="flex justify-between items-start gap-2">
            <span className="text-[#333] shrink-0">Family Group</span>
            <span className="text-black text-right break-all">
              {data.familyGroup}
            </span>
          </div>
        )}

        <div className="flex justify-between items-start gap-2">
          <span className="text-[#333] shrink-0">Offre</span>
          <span className="text-black text-right break-all">
            {data.offer || 'Zero To Hero'}
          </span>
        </div>

        <div className="flex justify-between items-start gap-2">
          <span className="text-[#333] shrink-0">Montant paye</span>
          <span className="text-black text-right font-bold">
            {montantAffiche}
          </span>
        </div>

        <div className="flex justify-between items-start gap-2">
          <span className="text-[#333] shrink-0">Genere par</span>
          <span className="text-black text-right">
            {data.operatorName || 'Elios'}
          </span>
        </div>
      </div>

      {/* Ligne continue séparatrice noire */}
      <div className="border-t-[1.5px] border-solid border-[#222] my-3" />

      {/* 5. Message de remerciement */}
      <p className="text-center italic text-[#333] text-[11.5px] sm:text-[12px] my-2.5">
        Merci pour votre confiance
      </p>

      {/* 6. Code à barres scannable (Code 128) */}
      <div className="flex flex-col items-center justify-center mt-2.5">
        <svg ref={barcodeRef} className="w-full" style={{ maxHeight: '48px' }} />
        <p className="font-mono text-[10.5px] sm:text-[11px] text-black tracking-wider mt-1.5 font-bold text-center">
          {reference}
        </p>
      </div>
    </article>
  );
}
