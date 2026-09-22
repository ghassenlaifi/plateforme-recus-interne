"use client";

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Header } from '@/components/Header';
import { UploadZone } from '@/components/UploadZone';
import { ReceiptCard } from '@/components/ReceiptCard';
import { ReceiptModal } from '@/components/ReceiptModal';
import { useToast } from '@/components/Toast';
import { Receipt, Operator } from '@/types';
import { Check, Loader2, Settings, Wallet } from 'lucide-react';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Erreur lors du chargement des données');
  return res.json();
});

function ReceiptHubApp() {
  const { toast } = useToast();
  
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [attention, setAttention] = useState(false);
  const [openModalId, setOpenModalId] = useState<string | null>(null);

  // Restaurer l'utilisateur actif depuis le localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('receiptHubActiveUser');
    if (savedUser) setActiveUser(savedUser);
  }, []);

  const [activeTab, setActiveTab] = useState<'PENDING' | 'PROCESSED'>('PENDING');

  // Sauvegarder l'utilisateur actif quand il change
  const handleSetActiveUser = (user: string) => {
    setActiveUser(user);
    localStorage.setItem('receiptHubActiveUser', user);
  };

  const API_URL = `/api/receipts?status=${activeTab}`;
  const { data: receipts, error, isLoading, mutate } = useSWR<Receipt[]>(API_URL, fetcher);
  const { data: operators } = useSWR<Operator[]>('/api/operators', fetcher);

  // Clear justAddedId after animation
  useEffect(() => {
    if (justAddedId !== null) {
      const timer = setTimeout(() => setJustAddedId(null), 500);
      return () => clearTimeout(timer);
    }
  }, [justAddedId]);

  const triggerAttention = () => {
    setAttention(false);
    setTimeout(() => setAttention(true), 10);
    toast({ message: 'Accès bloqué : Vous devez impérativement choisir un opérateur avant de continuer.', tone: 'warn' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUploadSuccess = (message: string) => {
    if (activeTab !== 'PENDING') setActiveTab('PENDING');
    mutate();
    toast({ message });
  };

  const visibleReceipts = (receipts || []).filter(r => {
    if (activeTab === 'PROCESSED') return true; // Show all processed
    // In PENDING, hide receipts locked by other users
    return !r.lockedBy || r.lockedBy === activeUser;
  });
  
  const openReceipt = visibleReceipts.find(r => r._id === openModalId) || null;

  return (
    <div className="min-h-[100dvh] bg-transparent font-sans text-gray-900 antialiased overflow-x-hidden">
      <Header activeUser={activeUser} setActiveUser={handleSetActiveUser} attention={attention} />
      
      <main className="mx-auto grid max-w-[90rem] gap-8 px-4 pb-10 pt-6 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:pb-12">
        <div className="lg:col-span-5 flex flex-col gap-3">
          <UploadZone 
            activeUser={activeUser} 
            triggerAttention={triggerAttention}
            onUploadSuccess={handleUploadSuccess} 
          />

          <div className="flex justify-end gap-2 pr-1">
            <Link 
              href="/portefeuilles" 
              title="Portefeuilles"
              className="flex items-center justify-center h-10 w-10 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors shadow-sm ring-1 ring-indigo-600/10"
            >
              <Wallet className="h-[18px] w-[18px]" />
            </Link>
            <Link 
              href="/admin/operators" 
              title="Paramètres & Opérateurs"
              className="flex items-center justify-center h-10 w-10 rounded-full bg-white text-gray-500 hover:bg-transparent hover:text-gray-900 transition-colors shadow-sm ring-1 ring-gray-900/5"
            >
              <Settings className="h-[18px] w-[18px]" />
            </Link>
          </div>
        </div>
        
        <section id="zoneQueue" className="min-w-0 lg:col-span-7" aria-labelledby="hQueue">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="hQueue" className="text-base font-semibold tracking-tight">
                {activeTab === 'PENDING' ? 'Reçus en attente' : 'Reçus traités'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {activeTab === 'PENDING' ? 'Ouvrez un reçu pour vérifier les informations, ajouter une note puis le marquer comme traité.' : 'Consultez l\'historique des reçus validés et traités.'}
              </p>
            </div>
            
            <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gray-200/50 p-1">
              <button 
                onClick={() => setActiveTab('PENDING')}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${activeTab === 'PENDING' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/50' : 'text-gray-500 hover:text-gray-700'}`}
              >
                À traiter
                <span className="tnum rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{activeTab === 'PENDING' ? visibleReceipts.length : ''}</span>
              </button>
              <button 
                onClick={() => setActiveTab('PROCESSED')}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${activeTab === 'PROCESSED' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/50' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Traités
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-600">
              Une erreur est survenue lors du chargement des reçus.
            </div>
          ) : (
            <>
              <div id="queueGrid" className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 ${visibleReceipts.length === 0 ? 'hidden' : ''}`}>
                {visibleReceipts.map(r => (
                  <ReceiptCard 
                    key={r._id} 
                    receipt={r} 
                    operators={operators}
                    justAddedId={justAddedId}
                    onOpen={(id) => {
                      if (!activeUser) {
                        triggerAttention();
                      } else {
                        // Call lock API here!
                        fetch(`/api/receipts/${id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ lock: true, lockedBy: activeUser })
                        });
                        setOpenModalId(id);
                      }
                    }}
                  />
                ))}
              </div>

              <div id="queueEmpty" className={`rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-16 text-center ${visibleReceipts.length > 0 ? 'hidden' : ''}`}>
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check className="h-5 w-5" strokeWidth={2} />
                </span>
                <p className="mt-4 text-sm font-medium text-gray-900">{activeTab === 'PENDING' ? 'Tous les reçus sont traités' : 'Aucun reçu traité'}</p>
                <p className="mt-1 text-sm text-gray-500">{activeTab === 'PENDING' ? 'Les nouveaux reçus soumis apparaîtront ici.' : 'Les reçus traités s\'afficheront ici.'}</p>
              </div>
            </>
          )}
        </section>
      </main>

      <datalist id="modes">
        <option value="Espèces"></option>
        <option value="Virement"></option>
        <option value="Chèque"></option>
        <option value="D17"></option>
        <option value="Flouci"></option>
      </datalist>

      <ReceiptModal 
        receipt={openReceipt} 
        isOpen={openModalId !== null} 
        onClose={() => setOpenModalId(null)}
        activeUser={activeUser}
      />
    </div>
  );
}

export default function Page() {
  return <ReceiptHubApp />;
}
