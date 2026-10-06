"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { toPng } from 'html-to-image';
import { EliosHeader } from '@/components/EliosHeader';
import { PaymentReceiptTicket } from '@/components/PaymentReceiptTicket';
import { Receipt, Operator, getThemeColors } from '@/types';
import { generateReceiptReference } from '@/lib/receiptReference';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Erreur chargement données');
  return res.json();
});

const IC = {
  cal: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <path d="M8 3v4M16 3v4M3 10h18"/>
    </>
  ),
  phone: (
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>
  ),
  rc: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/>
      <path d="M9 8h6M9 12h6"/>
    </>
  ),
  dl: <path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>,
  x: <path d="M6 6l12 12M18 6 6 18"/>
};

export default function PaymentReceiptsPage() {
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOp, setSelectedOp] = useState<string>('');
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [isDlgOpen, setIsDlgOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const ticketRef = useRef<HTMLDivElement | null>(null);

  // Fermeture par touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDlgOpen(false);
    };
    if (isDlgOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDlgOpen]);

  // Persistence utilisateur
  useEffect(() => {
    try {
      const saved = localStorage.getItem('elios.user') || localStorage.getItem('receiptHubActiveUser');
      if (saved) {
        const parsed = saved.startsWith('"') ? JSON.parse(saved) : saved;
        setActiveUser(parsed);
      }
    } catch {}
  }, []);

  const handleUserChange = (u: string) => {
    setActiveUser(u);
    try {
      localStorage.setItem('elios.user', JSON.stringify(u));
      localStorage.setItem('receiptHubActiveUser', u);
    } catch {}
  };

  // Récupération des données depuis MongoDB
  const { data: rawReceipts } = useSWR<Receipt[]>('/api/receipts?status=all', fetcher);
  const { data: operators } = useSWR<Operator[]>('/api/operators', fetcher);
  const safeOperators = useMemo(() => Array.isArray(operators) ? operators : [], [operators]);

  // Normalisation des reçus
  const receipts = useMemo(() => {
    if (!rawReceipts || !Array.isArray(rawReceipts)) return [];
    return rawReceipts.map(r => {
      const phone = r.clientDetails?.telephone || '';
      const date = r.paymentDate ? new Date(r.paymentDate) : new Date(r.createdAt);
      const reference = r.reference || generateReceiptReference(phone, date);
      return {
        ...r,
        computedRef: reference,
        computedDate: date,
      };
    });
  }, [rawReceipts]);

  // Deep linking par URL (?ref=EA-... ou ?preview=1)
  useEffect(() => {
    if (typeof window !== 'undefined' && receipts.length > 0 && !selectedReceipt && !isDlgOpen) {
      try {
        const params = new URLSearchParams(window.location.search);
        const refParam = params.get('ref');
        if (refParam) {
          const match = receipts.find(
            r => r.computedRef.toLowerCase() === refParam.toLowerCase() ||
                 r.computedRef.replace(/[\s-]/g, '') === refParam.replace(/[\s-]/g, '')
          );
          if (match) {
            setSelectedReceipt(match);
            setIsDlgOpen(true);
          }
        } else if (params.get('preview') === '1' && receipts[0]) {
          setSelectedReceipt(receipts[0]);
          setIsDlgOpen(true);
        }
      } catch {}
    }
  }, [receipts, selectedReceipt, isDlgOpen]);

  // Filtrage
  const filtered = useMemo(() => {
    let list = receipts;
    if (selectedOp !== '') {
      list = list.filter(r => (r.operatorName || '').toLowerCase() === selectedOp.toLowerCase());
    }
    if (!searchQuery.trim()) return list;

    const s = searchQuery.trim().toLowerCase().replace(/[\s-]/g, '');
    return list.filter(r => {
      const nom = (r.clientDetails?.nom || '').toLowerCase();
      const tel = (r.clientDetails?.telephone || '').replace(/\D/g, '');
      const ref = (r.computedRef || '').toLowerCase().replace(/-/g, '');
      return (nom + tel + ref).includes(s);
    });
  }, [receipts, selectedOp, searchQuery]);

  // Statistiques
  const stats = useMemo(() => {
    const totalCount = receipts.length;
    const uniqueStudents = new Set(receipts.map(r => r.clientDetails?.telephone).filter(Boolean)).size;
    const totalAmount = receipts.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    return { totalCount, uniqueStudents, totalAmount };
  }, [receipts]);

  // Téléchargement direct HD (300 DPI sans décalage ni marge superflue)
  const handleDownload = async () => {
    if (!ticketRef.current || !selectedReceipt) return;
    try {
      setIsDownloading(true);

      // S'assurer que le logo et toutes les images du ticket sont chargées
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
      link.download = `Recu-${selectedReceipt.computedRef}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erreur téléchargement image reçu:', err);
      document.title = `Recu-${selectedReceipt.computedRef}`;
      window.print();
    } finally {
      setIsDownloading(false);
    }
  };


  return (
    <div data-page="payment-receipts">
      <EliosHeader 
        crumb="Reçus de paiement"
        activeUser={activeUser}
        setActiveUser={handleUserChange}
      />

      {/* Bandeau Vague */}
      <div className="cover" aria-hidden="true">
        <svg viewBox="0 0 800 44" preserveAspectRatio="none">
          <g fill="none" stroke="#fff" strokeWidth="1.2">
            <path d="M0 30C120 8 220 40 360 22S580 6 800 26"/>
            <path d="M0 38C140 18 240 44 380 30S600 14 800 34"/>
          </g>
        </svg>
      </div>

      <main className="page">
        {/* Titre & Pageicon */}
        <div className="hd">
          <div className="pageicon" aria-hidden="true">
            <svg className="i" viewBox="0 0 24 24">
              {IC.rc}
            </svg>
          </div>
          <div>
            <h1>Reçus de paiement</h1>
            <p className="sub">
              Recherchez un reçu par nom ou numéro de téléphone, et réimprimez à la demande les reçus officiels d'Elios Academy.
            </p>
          </div>
        </div>

        {/* Section Stats */}
        <section className="stats" aria-label="Résumé">
          <div className="stat" style={{ '--c': 'var(--fin)' } as React.CSSProperties}>
            <small><i/>Reçus</small>
            <b>{stats.totalCount}</b>
          </div>
          <div className="stat" style={{ '--c': '#3B6BF0' } as React.CSSProperties}>
            <small><i/>Élèves</small>
            <b>{stats.uniqueStudents}</b>
          </div>
        </section>

        {/* Barre de Recherche & Filtre Opérateur */}
        <div className="find">
          <div className="sb">
            <svg className="i" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7"/>
              <path d="m20 20-3.5-3.5"/>
            </svg>
            <input 
              id="q" 
              type="search" 
              placeholder="Nom de l'élève, téléphone (ex : 92330331) ou référence…" 
              aria-label="Rechercher un reçu" 
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            id="op" 
            aria-label="Filtrer par opérateur"
            value={selectedOp}
            onChange={(e) => setSelectedOp(e.target.value)}
          >
            <option value="">Tous les opérateurs</option>
            {safeOperators.map(op => (
              <option key={op._id} value={op.name}>{op.name}</option>
            ))}
          </select>
        </div>

        <p className="count" id="count" aria-live="polite">
          {filtered.length === receipts.length ? "" : `${filtered.length} résultat${filtered.length > 1 ? "s" : ""} sur ${receipts.length}`}
        </p>

        {/* Liste des cartes reçus */}
        <div className="list" id="list">
          {filtered.length > 0 ? (
            filtered.map((r, n) => {
              const opName = r.operatorName || 'Elios';
              const opMatch = safeOperators.find(o => o.name.toLowerCase() === opName.toLowerCase());
              const opColor = opMatch ? getThemeColors(opMatch.theme).dot : '#0F9D82';
              const hasName = Boolean(r.clientDetails?.nom && r.clientDetails.nom.trim());
              const dateStr = r.computedDate.toLocaleDateString("fr-FR");
              const timeStr = r.computedDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

              return (
                <article key={r._id} className="rc" style={{ '--i': n } as React.CSSProperties}>
                  <span className="ref">{r.computedRef}</span>
                  <div className="dt">
                    <svg className="i" viewBox="0 0 24 24">{IC.cal}</svg>
                    {dateStr} à {timeStr}
                  </div>
                  <div className="who">
                    <h3 className={hasName ? "" : "nn"}>
                      {hasName ? r.clientDetails?.nom : "Nom non spécifié"}
                    </h3>
                    <p>
                      <svg className="i" viewBox="0 0 24 24">{IC.phone}</svg>
                      {r.clientDetails?.telephone || '—'}
                    </p>
                  </div>
                  <div className="kv">
                    <div>
                      <small>Offre</small>
                      <b>{r.clientDetails?.classe || 'Standard'}</b>
                    </div>
                    <div className="m">
                      <small>Montant</small>
                      <b>{(r.amount || 0).toLocaleString("fr-FR")} DT</b>
                    </div>
                  </div>
                  <div className="ft">
                    <span className="by" style={{ '--u': opColor } as React.CSSProperties}>
                      <i/>Par {opName}
                    </span>
                    <button 
                      className="see" 
                      type="button"
                      onClick={() => {
                        setSelectedReceipt(r);
                        setIsDlgOpen(true);
                      }}
                    >
                      <svg className="i" viewBox="0 0 24 24">{IC.rc}</svg>
                      Voir le reçu
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty">
              <b>Aucun reçu trouvé</b>
              Vérifiez le nom, le numéro ou la référence saisis.
            </div>
          )}
        </div>
      </main>

      {/* Popup : Reçu de Paiement Officiel (Clonage symétrique fidèle et 100% responsive) */}
      {isDlgOpen && selectedReceipt && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-hidden print:static print:bg-white print:p-0"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDlgOpen(false);
          }}
        >
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
              if (e.target === e.currentTarget) setIsDlgOpen(false);
            }}
          >
            {/* Barre d'outils sticky au-dessus du ticket */}
            <div 
              className="tools w-full flex items-center justify-end gap-2"
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
                className="btn pri" 
                id="dl" 
                type="button" 
                disabled={isDownloading}
                onClick={handleDownload}
                style={{ cursor: isDownloading ? 'wait' : 'pointer' }}
              >
                <svg className="i" viewBox="0 0 24 24">{IC.dl}</svg>
                {isDownloading ? 'Téléchargement...' : 'Télécharger'}
              </button>
              <button 
                className="btn" 
                id="cl" 
                type="button" 
                aria-label="Fermer" 
                onClick={() => setIsDlgOpen(false)}
              >
                <svg className="i" viewBox="0 0 24 24">{IC.x}</svg>
              </button>
            </div>

            {/* Ticket Officiel Elios Academy */}
            <div 
              onClick={(e) => e.stopPropagation()} 
              style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
            >
              <PaymentReceiptTicket
                ticketRef={ticketRef}
                data={{
                  reference: selectedReceipt.computedRef,
                  studentName: selectedReceipt.clientDetails?.nom,
                  phone: selectedReceipt.clientDetails?.telephone || '',
                  offer: selectedReceipt.clientDetails?.classe,
                  familyGroup: selectedReceipt.clientDetails?.familyGroup,
                  amount: selectedReceipt.amount,
                  operatorName: selectedReceipt.operatorName,
                  paymentDate: selectedReceipt.computedDate,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

