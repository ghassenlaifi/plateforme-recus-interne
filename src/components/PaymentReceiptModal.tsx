"use client";

import React, { useRef, useState, useEffect } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { PaymentReceiptTicket, PaymentReceiptData } from './PaymentReceiptTicket';

interface PaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PaymentReceiptData | null;
}

export function PaymentReceiptModal({ isOpen, onClose, data }: PaymentReceiptModalProps) {
  const ticketRef = useRef<HTMLDivElement | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Fermeture par touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  const handleDownload = async () => {
    if (!ticketRef.current) return;
    try {
      setIsDownloading(true);

      // S'assurer que les images du ticket sont prêtes
      const images = ticketRef.current.getElementsByTagName('img');
      await Promise.all(
        Array.from(images).map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) resolve(true);
              else {
                img.onload = () => resolve(true);
                img.onerror = () => resolve(true);
              }
            })
        )
      );

      // Rendu haute fidélité (pixelRatio: 3x, zéro décalage)
      const dataUrl = await toPng(ticketRef.current, {
        quality: 1.0,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          transform: 'none',
          margin: '0',
        },
      });
      const link = document.createElement('a');
      const refName = data.reference || 'recu_elios';
      link.download = `Recu-${refName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erreur téléchargement reçu:', err);
      alert('Impossible de télécharger le reçu.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 overflow-hidden print:static print:bg-white print:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Conteneur wrap responsive & tools sticky (DesignToCloneHTML) */}
      <div 
        className="wrap animate-in zoom-in-95 duration-200"
        id="dc"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          maxHeight: '94vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '6px 4px 18px',
          width: '100%',
          maxWidth: '420px',
          margin: 'auto',
          boxSizing: 'border-box',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Barre d'actions supérieure sticky */}
        <div 
          className="tools w-full flex items-center justify-end gap-2 print:hidden"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            width: 'min(400px, 92vw)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            paddingBottom: '4px',
          }}
        >
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            title="Télécharger le reçu (PNG)"
            className="btn pri inline-flex items-center gap-1.5"
            id="dl"
            style={{ cursor: isDownloading ? 'wait' : 'pointer' }}
          >
            {isDownloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
            ) : (
              <Download className="h-3.5 w-3.5 text-white" />
            )}
            {isDownloading ? 'Téléchargement...' : 'Télécharger'}
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Fermer (Échap)"
            className="btn"
            id="cl"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Le ticket officiel rendu fidèlement */}
        <div 
          onClick={(e) => e.stopPropagation()} 
          style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
        >
          <PaymentReceiptTicket data={data} ticketRef={ticketRef} />
        </div>
      </div>
    </div>
  );
}
