"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Trash2, Check, Loader2, Download } from 'lucide-react';
import { useToast } from './Toast';
import { Receipt, Note } from '@/types';
import { useSWRConfig } from 'swr';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface ReceiptModalProps {
  receipt: Receipt | null;
  isOpen: boolean;
  onClose: () => void;
  activeUser: string | null;
}

export function ReceiptModal({ receipt, isOpen, onClose, activeUser }: ReceiptModalProps) {
  const { toast } = useToast();
  const { mutate } = useSWRConfig();
  
  const [noteInput, setNoteInput] = useState('');
  const [closing, setClosing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  
  const [editData, setEditData] = useState({
    nom: '',
    telephone: '',
    email: '',
    classe: '',
    familyGroup: '',
    paymentMode: '',
    paymentDetails: '',
    paymentDate: '',
    amount: ''
  });

  useEffect(() => {
    if (receipt) {
      setEditData({
        nom: receipt.clientDetails?.nom || '',
        telephone: receipt.clientDetails?.telephone || '',
        email: receipt.clientDetails?.email || '',
        classe: receipt.clientDetails?.classe || '',
        familyGroup: receipt.clientDetails?.familyGroup || '',
        paymentMode: receipt.paymentMode || '',
        paymentDetails: receipt.paymentDetails || '',
        paymentDate: receipt.paymentDate ? new Date(receipt.paymentDate).toISOString().split('T')[0] : '',
        amount: receipt.amount !== undefined ? receipt.amount.toString() : ''
      });
    }
  }, [receipt]);

  const notesEndRef = useRef<HTMLLIElement>(null);

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

  const handleClose = useCallback(() => {
    setClosing(true);
    if (receipt?.status === 'PENDING') {
      fetch(`/api/receipts/${receipt._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lock: false })
      });
    }
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  }, [receipt, onClose]);

  useEffect(() => {
    if (receipt && isOpen) {
      document.body.style.overflow = 'hidden';
      setNoteInput('');
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleClose();
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [receipt, isOpen, handleClose]);

  const handleBlurSave = async () => {
    if (!receipt) return;
    
    // Check if anything actually changed
    const current = receipt.clientDetails || {};
    const d = receipt.paymentDate ? new Date(receipt.paymentDate).toISOString().split('T')[0] : '';
    
    if (
      editData.nom === (current.nom || '') &&
      editData.telephone === (current.telephone || '') &&
      editData.email === (current.email || '') &&
      editData.classe === (current.classe || '') &&
      editData.familyGroup === (current.familyGroup || '') &&
      editData.paymentMode === (receipt.paymentMode || '') &&
      editData.paymentDetails === (receipt.paymentDetails || '') &&
      editData.paymentDate === d &&
      editData.amount === (receipt.amount !== undefined ? receipt.amount.toString() : '')
    ) {
      return;
    }

    try {
      await fetch(`/api/receipts/${receipt._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clientDetails: { ...current, nom: editData.nom, telephone: editData.telephone, email: editData.email, classe: editData.classe, familyGroup: editData.familyGroup },
          paymentMode: editData.paymentMode,
          paymentDetails: editData.paymentDetails,
          paymentDate: editData.paymentDate ? new Date(editData.paymentDate).toISOString() : undefined,
          amount: editData.amount !== '' && !isNaN(parseFloat(editData.amount)) ? parseFloat(editData.amount) : undefined
        })
      });
      // Optionally mutate to keep cache in sync
      const API_URL = `/api/receipts?status=${receipt.status}`;
      mutate(API_URL);
      toast({ message: 'Modifications enregistrées', tone: 'ok' });
    } catch (e) {
      toast({ message: 'Erreur lors de la sauvegarde', tone: 'warn' });
    }
  };

  const handleProcess = async () => {
    if (!receipt || !activeUser) return;

    // Optimistic UI update
    handleClose();
    
    const API_URL = `/api/receipts?status=${receipt.status}`;
    const PROCESSED_URL = '/api/receipts?status=PROCESSED';
    
    // Optimistic cache update for PENDING (remove it)
    mutate(API_URL, (currentData: Receipt[] = []) => {
      return currentData.filter(r => r._id !== receipt._id);
    }, false);

    // Optimistic cache update for PROCESSED (add it at the top)
    const processedReceipt = { ...receipt, status: 'PROCESSED' as const, processedBy: activeUser, processedAt: new Date().toISOString() };
    mutate(PROCESSED_URL, (currentData: Receipt[] = []) => {
      return [processedReceipt, ...currentData];
    }, false);

    toast({ message: 'Reçu marqué comme traité.' });

    try {
      await fetch(`/api/receipts/${receipt._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PROCESSED', processedBy: activeUser })
      });
      // Revalidate both lists
      mutate(API_URL);
      mutate(PROCESSED_URL);
    } catch (error) {
      console.error(error);
      toast({ message: 'Erreur lors du traitement.', tone: 'warn' });
      // Revert cache on error
      mutate(API_URL);
    }
  };

  const handleDelete = async () => {
    if (!receipt) return;
    const confirmDelete = window.confirm("Êtes-vous sûr de vouloir supprimer définitivement ce reçu ?");
    if (!confirmDelete) return;

    handleClose();
    
    const API_URL = `/api/receipts?status=${receipt.status}`;
    
    mutate(API_URL, (currentData: Receipt[] = []) => {
      return currentData.filter(r => r._id !== receipt._id);
    }, false);

    try {
      await fetch(`/api/receipts/${receipt._id}`, { method: 'DELETE' });
      mutate(API_URL);
      toast({ message: 'Reçu supprimé avec succès.', tone: 'ok' });
    } catch (error) {
      toast({ message: 'Erreur lors de la suppression.', tone: 'warn' });
      mutate(API_URL);
    }
  };

  const addNote = async () => {
    if (!noteInput.trim() || !activeUser || !receipt) return;
    
    setIsAddingNote(true);
    const text = noteInput.trim();
    const newNote: Note = {
      text,
      addedBy: activeUser,
      addedAt: new Date().toISOString(),
      author: activeUser, // map to old frontend field temporarily for rendering safely
      date: new Date().toISOString(), // map for rendering
    };

    const API_URL = `/api/receipts?status=${receipt.status}`;
    
    // Optimistic UI for note addition
    mutate(API_URL, (currentData: Receipt[] = []) => {
      return currentData.map(r => {
        if (r._id === receipt._id) {
          return { ...r, notes: [...r.notes, newNote] };
        }
        return r;
      });
    }, false);
    
    setNoteInput('');
    setTimeout(() => {
      notesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);

    try {
      await fetch(`/api/receipts/${receipt._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteText: text, addedBy: activeUser })
      });
      mutate(API_URL);
    } catch (error) {
      console.error(error);
      toast({ message: 'Erreur lors de l\'ajout de la note.', tone: 'warn' });
      mutate(API_URL);
    } finally {
      setIsAddingNote(false);
    }
  };

  if (!isOpen && !closing) return null;

  return (
    <div 
      id="modal" 
      className="fixed inset-0 z-50" 
      role="dialog" 
      aria-modal="true" 
      data-state={closing ? 'closing' : 'open'}
    >
      <div className="modal-backdrop absolute inset-0 bg-black/60" onClick={handleClose}></div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3 sm:p-6">
        <div className="modal-panel pointer-events-auto flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] md:h-[min(760px,calc(100dvh-3rem))]">

          {/* Split screen */}
          <div className="thin-scroll grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[5fr_6fr] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">

            {/* Moitié gauche : aperçu du reçu */}
            <div className="relative flex flex-col bg-gray-200 md:min-h-0 md:h-full">
              {receipt?.gDriveViewUrl ? (
                <div className="flex h-[45vh] w-full flex-col md:h-full">
                  <div className="flex-1 relative overflow-hidden bg-gray-200 cursor-grab active:cursor-grabbing">
                    <TransformWrapper
                      initialScale={1}
                      minScale={0.1}
                      maxScale={8}
                      centerOnInit={true}
                    >
                      {({ zoomIn, zoomOut, resetTransform }) => (
                        <>
                          <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={`https://drive.google.com/uc?export=view&id=${receipt.gDriveFileId}`} 
                              alt="Aperçu du reçu"
                              className="max-h-full max-w-full object-contain pointer-events-none select-none"
                            />
                          </TransformComponent>
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 backdrop-blur-sm z-10 text-white shadow-lg">
                            <button type="button" onClick={() => zoomOut()} className="p-1.5 hover:bg-white/20 rounded-full transition" title="Dézoomer"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"/></svg></button>
                            <button type="button" onClick={() => resetTransform()} className="p-1.5 hover:bg-white/20 rounded-full transition text-[11px] font-bold px-3 uppercase tracking-wider" title="Réinitialiser">Ajuster</button>
                            <button type="button" onClick={() => zoomIn()} className="p-1.5 hover:bg-white/20 rounded-full transition" title="Zoomer"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg></button>
                          </div>
                        </>
                      )}
                    </TransformWrapper>
                  </div>
                  <div className="flex items-center justify-end border-t border-gray-200 bg-white px-4 py-2 shadow-sm sm:px-6">
                    <a 
                      href={`https://drive.google.com/uc?export=download&id=${receipt.gDriveFileId}`} 
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center justify-center rounded-md border border-gray-900 bg-gray-50 px-3 py-1.5 text-[13px] font-normal text-gray-900 transition hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-900"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Télécharger
                    </a>
                  </div>
                </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5 sm:p-6">
                    <div id="previewPaper" className="w-48 rounded-sm bg-white p-4 shadow-lg ring-1 ring-black/5 sm:w-56 sm:p-5" aria-hidden="true">
                      <div className="space-y-2.5">
                        <div className="mx-auto h-2 w-16 rounded bg-gray-300"></div>
                        <div className="mx-auto h-1.5 w-24 rounded bg-gray-200"></div>
                        <div className="!mt-4 border-t border-dashed border-gray-300"></div>
                        <div className="flex justify-between"><span className="h-1.5 w-20 rounded bg-gray-200"></span><span className="h-1.5 w-8 rounded bg-gray-200"></span></div>
                        <div className="flex justify-between"><span className="h-1.5 w-14 rounded bg-gray-200"></span><span className="h-1.5 w-10 rounded bg-gray-200"></span></div>
                        <div className="flex justify-between"><span className="h-1.5 w-24 rounded bg-gray-200"></span><span className="h-1.5 w-8 rounded bg-gray-200"></span></div>
                        <div className="!mt-4 border-t border-dashed border-gray-300"></div>
                        <div className="flex justify-between"><span className="h-2 w-10 rounded bg-gray-400"></span><span className="h-2 w-16 rounded bg-gray-700/70"></span></div>
                        <div className="barcode !mt-5 h-8 w-full opacity-70"></div>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Aperçu de l’image</p>
                      <p id="previewName" className="mt-0.5 max-w-[16rem] truncate text-xs text-gray-500">Document indisponible</p>
                    </div>
                  </div>
                )}
            </div>

            {/* Moitié droite : informations */}
            <div className="flex min-h-0 min-w-0 flex-col">
              <div className="relative z-20 flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:gap-4 sm:px-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h2 id="mTitle" className="text-base font-semibold tracking-tight">Vérifier le reçu</h2>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                    <span id="actorDot" className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400"></span>
                    <span>Vous agissez en tant que <span id="actorName" className="font-medium text-gray-700">{activeUser || '—'}</span></span>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <div className="relative group">
                    <button type="button" aria-label="Traçabilité du reçu"
                            className="grid h-10 w-10 place-items-center rounded-full border border-gray-200 bg-white text-[14px] leading-none text-gray-500 transition hover:border-gray-300 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:h-8 sm:w-8">
                      <span className="italic font-serif font-medium">i</span>
                    </button>
                    <div role="tooltip" className="tip absolute right-0 top-full z-30 mt-2.5 w-max max-w-[13rem] rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg ring-1 ring-white/10 sm:max-w-none sm:whitespace-nowrap">
                      <span className="absolute -top-1 right-4 h-2 w-2 rotate-45 bg-gray-900 sm:right-3"></span>
                      <div className="flex flex-col gap-1">
                        <div>Importé par : <span className="font-medium text-white">{receipt?.operatorName}</span> <span className="text-gray-400">({fmtDate(receipt?.createdAt as string)})</span></div>
                        {receipt?.status === 'PROCESSED' ? (
                          <div>Traité par : <span className="font-medium text-white">{receipt?.processedBy || 'Inconnu'}</span> <span className="text-gray-400">({fmtDate((receipt?.processedAt || receipt?.updatedAt) as string)})</span></div>
                        ) : (
                          <div>Traité par : <span className="text-gray-400">En attente</span></div>
                        )}
                      </div>
                    </div>
                  </div>

                  <button type="button" onClick={handleClose} aria-label="Fermer"
                          className="grid h-10 w-10 place-items-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:h-8 sm:w-8">
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </div>

              <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                  <div className="sm:col-span-2 md:col-span-1 lg:col-span-2">
                    <label className="label">Nom et Prénom</label>
                    <input type="text" className={`input ${receipt?.status === 'PROCESSED' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white'}`} readOnly={receipt?.status === 'PROCESSED'} value={editData.nom} onChange={e => setEditData({...editData, nom: e.target.value})} onBlur={handleBlurSave} />
                  </div>
                  <div>
                    <label className="label">Numéro de téléphone</label>
                    <div className="relative">
                      <span className="tnum pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">+216</span>
                      <input type="tel" className={`input tnum pl-12 ${receipt?.status === 'PROCESSED' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white'}`} readOnly={receipt?.status === 'PROCESSED'} value={editData.telephone} onChange={e => setEditData({...editData, telephone: e.target.value.replace(/\D/g, '').slice(0, 8)})} onBlur={handleBlurSave} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input type="text" className={`input ${receipt?.status === 'PROCESSED' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white'}`} readOnly={receipt?.status === 'PROCESSED'} value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} onBlur={handleBlurSave} />
                  </div>
                  <div className="sm:col-span-2 md:col-span-1 lg:col-span-2">
                    <label className="label">Offre</label>
                    <input type="text" className={`input ${receipt?.status === 'PROCESSED' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white'}`} readOnly={receipt?.status === 'PROCESSED'} value={editData.classe} onChange={e => setEditData({...editData, classe: e.target.value})} onBlur={handleBlurSave} />
                  </div>
                  <div>
                    <label className="label">Élève(s)</label>
                    <input type="text" className={`input ${receipt?.status === 'PROCESSED' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white'}`} readOnly={receipt?.status === 'PROCESSED'} value={editData.familyGroup} onChange={e => setEditData({...editData, familyGroup: e.target.value})} onBlur={handleBlurSave} />
                  </div>
                  <div>
                    <label className="label">Mode de paiement</label>
                    <div className="relative">
                      <select 
                        className={`input appearance-none pr-10 ${receipt?.status === 'PROCESSED' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
                        disabled={receipt?.status === 'PROCESSED'}
                        value={editData.paymentMode}
                        onChange={e => setEditData({...editData, paymentMode: e.target.value, paymentDetails: ''})}
                        onBlur={handleBlurSave}
                      >
                        <option value="" disabled>Sélectionner un mode</option>
                        <option value="Espèces">Espèces</option>
                        <option value="Virement Bancaire">Virement Bancaire</option>
                        <option value="Poste">Poste</option>
                        <option value="D17">D17</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  {editData.paymentMode && (
                    <div>
                      <label className="label">
                        {editData.paymentMode === 'Espèces' && 'Local'}
                        {editData.paymentMode === 'Virement Bancaire' && 'Banque'}
                        {editData.paymentMode === 'Poste' && 'Destinataire'}
                        {editData.paymentMode === 'D17' && 'Titulaire de la carte'}
                      </label>
                      {editData.paymentMode === 'Espèces' ? (
                        <div className="relative">
                          <select 
                            className={`input appearance-none pr-10 ${receipt?.status === 'PROCESSED' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
                            disabled={receipt?.status === 'PROCESSED'}
                            value={editData.paymentDetails}
                            onChange={e => setEditData({...editData, paymentDetails: e.target.value})}
                            onBlur={handleBlurSave}
                          >
                            <option value="" disabled>Sélectionner un local</option>
                            <option value="Bab Saadoun">Bab Saadoun</option>
                            <option value="Douar Hicher">Douar Hicher</option>
                            <option value="Soumaya">Soumaya</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <input 
                          type="text" 
                          className={`input ${receipt?.status === 'PROCESSED' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
                          readOnly={receipt?.status === 'PROCESSED'}
                          placeholder={
                            editData.paymentMode === 'Virement Bancaire' ? 'ex. ATB' :
                            editData.paymentMode === 'Poste' ? 'ex. Elyes Laabidi' :
                            'ex. Soumaya'
                          }
                          value={editData.paymentDetails}
                          onChange={e => setEditData({...editData, paymentDetails: e.target.value})}
                          onBlur={handleBlurSave}
                        />
                      )}
                    </div>
                  )}
                  <div>
                    <label className="label">Montant</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="0.01"
                        min="0"
                        className={`input tnum pr-12 ${receipt?.status === 'PROCESSED' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
                        readOnly={receipt?.status === 'PROCESSED'}
                        placeholder="0.00"
                        value={editData.amount}
                        onChange={e => setEditData({...editData, amount: e.target.value})}
                        onBlur={handleBlurSave}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-gray-500">DT</span>
                    </div>
                  </div>
                  <div className="sm:col-span-2 md:col-span-1 lg:col-span-2">
                    <label className="label">Date du paiement</label>
                    <input type="text" className="input tnum bg-gray-200 text-gray-500 cursor-not-allowed" readOnly value={fmtDate(receipt?.paymentDate as string)} />
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-7">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Notes</h3>
                    <span className="tnum text-xs text-gray-400">{receipt?.notes?.length || ''}</span>
                  </div>
                  <ul id="noteList" className="space-y-2">
                    {!receipt?.notes || receipt.notes.length === 0 ? (
                      <li className="rounded-xl border border-dashed border-gray-200 px-3 py-3 text-center text-[13px] text-gray-400">Aucune note pour le moment.</li>
                    ) : (
                      receipt.notes.map((n, i) => (
                        <li key={i} className="whitespace-pre-wrap break-words rounded-xl bg-gray-50 px-3 py-2 text-[13px] leading-relaxed text-gray-700 ring-1 ring-inset ring-gray-100">
                          <span className="font-medium text-gray-900">{n.addedBy || n.author}</span> <span className="text-gray-400">({fmtDate(n.addedAt as string) || n.date})</span>: {n.text}
                        </li>
                      ))
                    )}
                    <li ref={notesEndRef}></li>
                  </ul>

                  <div className="mt-3 rounded-lg border border-gray-200 bg-white shadow-sm transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10">
                    <label htmlFor="noteInput" className="sr-only">Ajouter une note</label>
                    <textarea 
                      id="noteInput" 
                      rows={2} 
                      placeholder="Ajouter une note..."
                      className="block w-full resize-none rounded-lg border-0 bg-transparent px-3 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none sm:text-sm"
                      value={noteInput}
                      onChange={e => setNoteInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); addNote(); } }}
                      disabled={isAddingNote || receipt?.status === 'PROCESSED'}
                    ></textarea>
                    <div className="flex items-center justify-between gap-2 px-2 pb-2">
                      <span className="hidden pl-1 text-[11px] text-gray-400 sm:inline">Ctrl + Entrée pour envoyer</span>
                      <button type="button" onClick={addNote} disabled={isAddingNote || receipt?.status === 'PROCESSED'} className="btn btn-secondary ml-auto h-9 px-3 text-xs sm:h-8 disabled:opacity-50">
                        {isAddingNote ? 'Ajout...' : 'Ajouter'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Zone d'actions */}
          <footer className="border-t border-gray-100 bg-gray-50/70 px-4 pt-4 sm:px-6" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
              <div className="order-3 md:order-1 md:justify-self-start">
                <button type="button" onClick={handleDelete} className="btn btn-danger w-full md:w-auto">
                  <Trash2 className="h-4 w-4 shrink-0" strokeWidth={1.9} />
                  Supprimer
                </button>
              </div>
              <div className="order-2">
                {/* L'update direct n'est plus géré ici car le design originel prévoyait une form editable,
                    mais comme les specs backend ne demandent pas l'update de clientDetails pour le moment, 
                    on le masque ou on le désactive. */}
              </div>
              <div className="order-1 sm:col-span-2 md:order-3 md:col-span-1 md:justify-self-end">
                {receipt?.status === 'PENDING' && (
                  <button type="button" onClick={handleProcess} className="btn btn-success h-12 w-full px-6 sm:h-11 md:w-auto">
                    <Check className="h-4 w-4 shrink-0" strokeWidth={2.2} />
                    Marquer comme Traité
                  </button>
                )}
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
