"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EliosHeader } from '@/components/EliosHeader';

const G = { fin: "Finance", com: "Commercial", ped: "Pédagogie", team: "Équipe" };

const IC = {
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/>
      <path d="M9 8h6M9 12h6"/>
    </>
  ),
  wallet: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h13v4"/>
      <path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/>
      <circle cx="16.5" cy="14.5" r="1"/>
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5"/>
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0"/>
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>
    </>
  ),
  book: (
    <>
      <path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z"/>
      <path d="M12 6v14"/>
    </>
  ),
  cal: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <path d="M8 3v4M16 3v4M3 10h18"/>
      <circle cx="16" cy="16" r="2.5"/>
    </>
  ),
  check: (
    <>
      <path d="m4 6 2 2 3-3M4 14l2 2 3-3"/>
      <path d="M13 7h8M13 15h8"/>
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6"/>
};

const PREV = {
  recus: (
    <svg viewBox="0 0 320 78">
      <rect x="8" y="6" width="120" height="66" rx="8" fill="currentColor" opacity=".1"/>
      <g fill="currentColor">
        <rect x="20" y="16" width="52" height="5" rx="2.5" opacity=".7"/>
        <rect x="20" y="28" width="90" height="4" rx="2" opacity=".3"/>
        <rect x="20" y="37" width="70" height="4" rx="2" opacity=".3"/>
      </g>
      <g fill="currentColor" opacity=".8">
        <rect x="20" y="50" width="2" height="16"/>
        <rect x="25" y="50" width="4" height="16"/>
        <rect x="32" y="50" width="2" height="16"/>
        <rect x="37" y="50" width="3" height="16"/>
        <rect x="43" y="50" width="5" height="16"/>
        <rect x="51" y="50" width="2" height="16"/>
        <rect x="56" y="50" width="4" height="16"/>
        <rect x="63" y="50" width="2" height="16"/>
        <rect x="68" y="50" width="3" height="16"/>
        <rect x="74" y="50" width="2" height="16"/>
        <rect x="79" y="50" width="4" height="16"/>
      </g>
      <g fill="currentColor" opacity=".18">
        <rect x="150" y="10" width="160" height="16" rx="8"/>
        <rect x="150" y="32" width="160" height="16" rx="8"/>
        <rect x="150" y="54" width="160" height="16" rx="8"/>
      </g>
    </svg>
  ),
  receipts: (
    <svg viewBox="0 0 320 78">
      <g fill="currentColor">
        <rect x="10" y="44" width="24" height="30" rx="5" opacity=".2"/>
        <rect x="44" y="30" width="24" height="44" rx="5" opacity=".3"/>
        <rect x="78" y="38" width="24" height="36" rx="5" opacity=".4"/>
        <rect x="112" y="18" width="24" height="56" rx="5" opacity=".6"/>
        <rect x="146" y="8" width="24" height="66" rx="5"/>
      </g>
      <path d="M190 52c30-6 40-30 70-24s34-2 54-16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".5"/>
    </svg>
  ),
  crm: (
    <svg viewBox="0 0 240 78">
      <g fill="currentColor">
        <rect x="0" y="4" width="240" height="16" rx="8" opacity=".25"/>
        <rect x="20" y="30" width="200" height="16" rx="8" opacity=".45"/>
        <rect x="50" y="56" width="140" height="16" rx="8" opacity=".85"/>
      </g>
    </svg>
  ),
  formatic: (
    <svg viewBox="0 0 240 78">
      <g fill="currentColor">
        <circle cx="24" cy="24" r="14" opacity=".25"/>
        <circle cx="24" cy="24" r="6"/>
        <rect x="50" y="16" width="120" height="6" rx="3" opacity=".7"/>
        <rect x="50" y="28" width="80" height="5" rx="2.5" opacity=".3"/>
        <circle cx="24" cy="56" r="14" opacity=".25"/>
        <circle cx="24" cy="56" r="6" opacity=".6"/>
        <rect x="50" y="48" width="100" height="6" rx="3" opacity=".7"/>
        <rect x="50" y="60" width="140" height="5" rx="2.5" opacity=".3"/>
      </g>
    </svg>
  ),
  taches: (
    <svg viewBox="0 0 240 78">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="1" y="5" width="16" height="16" rx="5" fill="currentColor"/>
        <rect x="1" y="31" width="16" height="16" rx="5" opacity=".5"/>
        <rect x="1" y="57" width="16" height="16" rx="5" opacity=".5"/>
        <path d="m5 13 3 3 5-6" stroke="#fff" strokeWidth="2.2"/>
      </g>
      <g fill="currentColor">
        <rect x="30" y="11" width="110" height="5" rx="2.5" opacity=".35"/>
        <rect x="30" y="37" width="140" height="5" rx="2.5" opacity=".7"/>
        <rect x="30" y="63" width="90" height="5" rx="2.5" opacity=".7"/>
        <circle cx="200" cy="39" r="10" opacity=".9"/>
        <circle cx="218" cy="39" r="10" opacity=".45"/>
        <circle cx="224" cy="65" r="10" opacity=".6"/>
      </g>
    </svg>
  ),
  seances: (
    <svg viewBox="0 0 240 78">
      <g fill="currentColor">
        {[0,1,2,3,4,5].map(c => 
          [0,1,2].map(r => (
            <rect 
              key={`${c}-${r}`}
              x={c * 38} 
              y={r * 26} 
              width="30" 
              height="20" 
              rx="6" 
              opacity={(c * 3 + r) % 4 === 1 ? .9 : (c + r) % 3 === 0 ? .35 : .12}
            />
          ))
        )}
      </g>
    </svg>
  )
};

const MODS = [
  { id: "recus", name: "Reçus de paiement", desc: "Recherchez, consultez et imprimez les reçus thermiques avec code-barres.", g: "fin" as const, ic: "receipt" as const, href: "/payment-receipts", w: 1, p: "recus" as const },
  { id: "receipts", name: "Suivi des encaissements", desc: "Centralisez les encaissements et les portefeuilles.", g: "fin" as const, ic: "wallet" as const, href: "/receipts", w: 1, p: "receipts" as const },
  { id: "crm", name: "CRM Elios", desc: "Gérez les prospects, les leads et le suivi commercial.", g: "com" as const, ic: "users" as const, href: "/crm-elios", w: 0, p: "crm" as const },
  { id: "formatic", name: "CRM Formatic", desc: "Gérez les prospects des formations.", g: "com" as const, ic: "book" as const, href: "/crm-formatic", w: 0, p: "formatic" as const },
  { id: "seances", name: "Gestion des séances", desc: "Planifiez les cours et automatisez les rappels.", g: "ped" as const, ic: "cal" as const, href: "/sessions", w: 0, p: "seances" as const },
  { id: "taches", name: "Tâches et équipe", desc: "Créez des tâches, assignez vos collaborateurs et suivez votre to-do list.", g: "team" as const, ic: "check" as const, href: "/tasks", w: 0, p: "taches" as const }
];

export default function WorkspaceHome() {
  const router = useRouter();
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [isPalOpen, setIsPalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Persistence de l'utilisateur actif
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

  // Gestion des raccourcis Ctrl+K et Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPalOpen(true);
      }
      if (e.key === 'Escape') {
        setIsPalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isPalOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 40);
    } else {
      setQuery('');
      setSelectedIdx(0);
    }
  }, [isPalOpen]);

  // Gradient radial dynamique qui suit le pointeur de la souris
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const card = (e.target as HTMLElement).closest('.card') as HTMLElement | null;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    card.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  const filteredHits = MODS.filter(m => 
    (m.name + m.desc + G[m.g]).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <EliosHeader 
        activeUser={activeUser} 
        setActiveUser={handleUserChange}
        showSearch={true}
        onOpenSearch={() => setIsPalOpen(true)}
        showSettings={true}
      />

      <main className="page">
        <div className="bento" id="bento" onPointerMove={handlePointerMove}>
          {MODS.map((m, idx) => (
            <Link
              key={m.id}
              href={m.href}
              className={`card ${m.g}${m.w ? ' w' : ''}`}
              style={{ '--i': idx } as React.CSSProperties}
              data-id={m.id}
            >
              <span className="tag">{G[m.g]}</span>

              <div className="row">
                <span className="ic">
                  <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                    {IC[m.ic]}
                  </svg>
                </span>
                <h3>{m.name}</h3>
              </div>

              <p>{m.desc}</p>

              <div className="prev" aria-hidden="true">
                {PREV[m.p]}
              </div>

              <span className="open">
                <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                  {IC.arrow}
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </main>

      {/* Palette de commande (Recherche rapide Ctrl + K) */}
      <div 
        className={`pal ${isPalOpen ? 'open' : ''}`} 
        id="pal" 
        role="dialog" 
        aria-modal="true" 
        aria-label="Rechercher un outil"
        onClick={(e) => {
          if ((e.target as HTMLElement).id === 'pal') setIsPalOpen(false);
        }}
      >
        <div className="box">
          <input 
            ref={searchInputRef}
            id="q" 
            placeholder="Rechercher un outil…" 
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIdx(prev => (prev + 1) % (filteredHits.length || 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIdx(prev => (prev - 1 + filteredHits.length) % (filteredHits.length || 1));
              } else if (e.key === 'Enter' && filteredHits[selectedIdx]) {
                e.preventDefault();
                setIsPalOpen(false);
                router.push(filteredHits[selectedIdx].href);
              }
            }}
          />
          <ul id="res">
            {filteredHits.length > 0 ? (
              filteredHits.map((m, i) => (
                <li
                  key={m.id}
                  className={m.g}
                  role="option"
                  aria-selected={i === selectedIdx}
                  onClick={() => {
                    setIsPalOpen(false);
                    router.push(m.href);
                  }}
                >
                  <span className="ic">
                    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                      {IC[m.ic]}
                    </svg>
                  </span>
                  <span>{m.name}</span>
                  <small>{G[m.g]}</small>
                </li>
              ))
            ) : (
              <li style={{ color: 'var(--ink3)' }}>Aucun résultat</li>
            )}
          </ul>
        </div>
      </div>
    </>
  );
}

