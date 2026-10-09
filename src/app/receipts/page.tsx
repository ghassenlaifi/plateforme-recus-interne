"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { EliosHeader } from '@/components/EliosHeader';
import { PaymentReceiptModal } from '@/components/PaymentReceiptModal';
import { Receipt, Operator, getThemeColors } from '@/types';
import { useToast } from '@/components/Toast';
import { formatPhone, extractPhoneDigits } from '@/lib/phoneUtils';
import { resolveExactReceiptDate } from '@/lib/dateUtils';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Erreur chargement données');
  return res.json();
});

export const PAYMENT_MODES_CONFIG: Record<string, { label: string; placeholder: string; options: string[] }> = {
  'Espèces': {
    label: 'Local',
    placeholder: 'Sélectionner un local',
    options: ['Bab Saadoun', 'Douar Hicher', 'Soumaya']
  },
  'Virement Bancaire': {
    label: 'Banque',
    placeholder: 'Sélectionner une banque',
    options: ['El Baraka Elios', 'ATB Safa', 'ATB Elyes']
  },
  'Edinar - D17': {
    label: 'Titulaire de la carte',
    placeholder: 'Sélectionner un titulaire',
    options: ['Soumaya', 'Elyes']
  }
};

const OFFERS = [
  'Zero To Hero Primo',
  'Zero To Hero Secondo',
  'Zero To Hero Lite',
  'Zero To Hero',
  'Offre personnalisé'
];
const MODES = ['Espèces', 'Virement Bancaire', 'Edinar - D17'];
const WALLETS = ['Bab Saadoun', 'Douar Hicher', 'Soumaya', 'El Baraka Elios', 'ATB Safa', 'ATB Elyes', 'Elyes'];

const IC = {
  doc: (
    <>
      <path d="M6 3h9l4 4v14H6z"/>
      <path d="M14 3v5h5M9 13h7M9 17h5"/>
    </>
  ),
  phone: (
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>
  ),
  ok: <path d="m5 12 5 5 9-10"/>,
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="3"/>
      <path d="M3 10h18M16 15h2"/>
    </>
  ),
  gear: (
    <>
      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/>
      <circle cx="12" cy="12" r="3"/>
    </>
  ),
  up: (
    <>
      <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 9.5"/>
      <path d="M12 12v8M9 15l3-3 3 3"/>
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18"/>
};

export default function ReceiptsPage() {
  const { toast } = useToast();
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [tab, setTab] = useState<'todo' | 'done'>('todo');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal détail / traitement & édition
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [isDlgOpen, setIsDlgOpen] = useState(false);

  // Données MongoDB avec mise en cache optimisée
  const { data: rawReceipts, mutate } = useSWR<Receipt[]>('/api/receipts?status=all', fetcher, {
    refreshInterval: isDlgOpen ? 0 : 30000,
    revalidateOnFocus: true,
    dedupingInterval: 10000
  });
  const { data: operators } = useSWR<Operator[]>('/api/operators', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000
  });

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

  // État formulaire nouveau reçu
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isOver, setIsOver] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [fileErr, setFileErr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const digitsOf = (s: string) => s.replace(/\D/g, '');
  const todayFR = () => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const formatDateInput = (val: string) => {
    const d = digitsOf(val).slice(0, 8);
    if (d.length >= 5) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
    if (d.length >= 3) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return d;
  };

  const toISO = (dateStr: string) => {
    const [dd, mm, yyyy] = dateStr.split('/');
    if (!dd || !mm || !yyyy || yyyy.length !== 4) return '';
    const now = new Date();
    const dDay = parseInt(dd, 10);
    const dMonth = parseInt(mm, 10) - 1;
    const dYear = parseInt(yyyy, 10);
    // Injecter l'heure réelle courante pour garantir une traçabilité précise
    const d = new Date(dYear, dMonth, dDay, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    return d.toISOString();
  };

  const buildEditPaymentDate = (dateStr: string, existingDate?: Date | string | null) => {
    if (!dateStr) return new Date();
    const [yyyy, mm, dd] = dateStr.includes('-') ? dateStr.split('-') : dateStr.split('/').reverse();
    const now = new Date();
    const orig = existingDate ? resolveExactReceiptDate(existingDate) : null;
    const d = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
    if (orig && !isNaN(orig.getTime())) {
      d.setHours(orig.getHours(), orig.getMinutes(), orig.getSeconds(), orig.getMilliseconds());
    } else {
      d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    }
    return d;
  };

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    amount: '',
    offer: 'Zero To Hero',
    customOffer: '',
    mode: 'Espèces',
    wallet: 'Bab Saadoun',
    date: todayFR(),
    familyGroup: '',
    note: ''
  });

  const [generatedTicket, setGeneratedTicket] = useState<any | null>(null);

  const clearFile = () => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFile(null);
    setFileUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleModeChange = (newMode: string) => {
    const cfg = PAYMENT_MODES_CONFIG[newMode];
    const defaultWallet = cfg?.options[0] || '';
    setFormData(prev => ({
      ...prev,
      mode: newMode,
      wallet: defaultWallet
    }));
  };

  // Modal détail / traitement & édition
  const [modalNote, setModalNote] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [showAuditInfo, setShowAuditInfo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Champs éditables du reçu dans le popup
  const [editNom, setEditNom] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAmount, setEditAmount] = useState<string | number>('');
  const [editDate, setEditDate] = useState('');
  const [editOffer, setEditOffer] = useState('');
  const [editMode, setEditMode] = useState('');
  const [editWallet, setEditWallet] = useState('');
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const [isDeletingReceipt, setIsDeletingReceipt] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reçu considéré comme traité si PROCESSED ou ARCHIVED
  const isProcessed = selectedReceipt?.status === 'PROCESSED' || selectedReceipt?.status === 'ARCHIVED';

  // Fermeture modale avec libération du verrou
  const closeReceiptModal = () => {
    if (selectedReceipt?._id) {
      fetch(`/api/receipts/${selectedReceipt._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lock: false }),
      }).catch(() => {});
    }
    setIsDlgOpen(false);
    setSelectedReceipt(null);
    setNewNoteText('');
    setShowAuditInfo(false);
    setShowDeleteConfirm(false);
    mutate();
  };

  // Fermeture modale par touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else if (isDlgOpen && !isSavingChanges && !isDeletingReceipt) {
          closeReceiptModal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDlgOpen, showDeleteConfirm, isSavingChanges, isDeletingReceipt, selectedReceipt?._id]);

  const openReceiptModal = async (r: Receipt) => {
    // Si déjà verrouillé par un autre opérateur (< 45s)
    if (r.lockedBy && r.lockedBy !== activeUser && r.lockedAt) {
      const lockAge = Date.now() - new Date(r.lockedAt).getTime();
      if (lockAge < 45000) {
        toast({ message: `Ce reçu est actuellement en cours de traitement par ${r.lockedBy}.`, tone: 'warn' });
        return;
      }
    }

    setSelectedReceipt(r);
    setEditNom(r.clientDetails?.nom || '');
    setEditPhone(formatPhone(r.clientDetails?.telephone || ''));
    setEditAmount(r.amount !== undefined ? String(r.amount) : '');
    const dt = r.paymentDate || r.createdAt;
    setEditDate(dt ? new Date(dt).toISOString().split('T')[0] : '');
    setEditOffer(r.clientDetails?.classe || 'Standard');
    setEditMode(r.paymentMode || 'Espèces');
    setEditWallet(r.paymentDetails || 'Bab Saadoun');
    setModalNote('');
    setNewNoteText('');
    setShowAuditInfo(false);
    setShowDeleteConfirm(false);
    setImgError(false);
    setIsDlgOpen(true);

    // Verrouillage instantané pour masquer immédiatement la fiche auprès des autres opérateurs
    try {
      await fetch(`/api/receipts/${r._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lock: true, lockedBy: activeUser || 'Elios' }),
      });
      mutate();
    } catch (err) {
      console.warn('[Lock] Erreur pose verrou:', err);
    }
  };

  // Heartbeat de verrouillage en temps réel
  useEffect(() => {
    if (!isDlgOpen || !selectedReceipt?._id) return;
    const receiptId = selectedReceipt._id;

    const interval = setInterval(() => {
      fetch(`/api/receipts/${receiptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lock: true, lockedBy: activeUser || 'Elios' }),
      }).catch(() => {});
    }, 20000);

    const handleUnload = () => {
      navigator.sendBeacon(`/api/receipts/${receiptId}`, JSON.stringify({ lock: false }));
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      fetch(`/api/receipts/${receiptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lock: false }),
      }).catch(() => {});
    };
  }, [isDlgOpen, selectedReceipt?._id, activeUser]);

  // Synchronisation instantanée en temps réel des notes lorsque la fiche reçu est ouverte
  const activeReceiptId = isDlgOpen && selectedReceipt ? selectedReceipt._id : null;
  const { data: liveReceipt } = useSWR<Receipt>(
    activeReceiptId ? `/api/receipts/${activeReceiptId}` : null,
    fetcher,
    {
      refreshInterval: 1500,
      revalidateOnFocus: true,
      dedupingInterval: 600
    }
  );

  useEffect(() => {
    if (!liveReceipt || !selectedReceipt) return;
    const currentNotes = selectedReceipt.notes || [];
    const incomingNotes = liveReceipt.notes || [];
    const notesChanged = JSON.stringify(currentNotes) !== JSON.stringify(incomingNotes);

    if (notesChanged) {
      setSelectedReceipt(prev => prev ? { 
        ...prev, 
        notes: incomingNotes,
        updatedAt: liveReceipt.updatedAt || prev.updatedAt,
        lastModifiedBy: liveReceipt.lastModifiedBy || prev.lastModifiedBy,
        status: liveReceipt.status || prev.status,
        processedBy: liveReceipt.processedBy || prev.processedBy,
        processedAt: liveReceipt.processedAt || prev.processedAt
      } : null);
    }
  }, [liveReceipt, selectedReceipt]);

  const handleFileSelect = (f: File | null) => {
    setFileErr('');
    if (!f) return;
    if (!/^(image\/(png|jpeg)|application\/pdf)$/.test(f.type)) {
      setFileErr('Format non pris en charge. Utilisez PNG, JPG ou PDF.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setFileErr('Fichier trop volumineux (10 Mo maximum).');
      return;
    }
    setFile(f);
    setFileUrl(URL.createObjectURL(f));
    setFormData(prev => ({ ...prev, date: prev.date || todayFR() }));
  };

  const resetUploadForm = () => {
    clearFile();
    setFormData({
      name: '',
      phone: '',
      email: '',
      amount: '',
      offer: 'Zero To Hero',
      customOffer: '',
      mode: 'Espèces',
      wallet: 'Bab Saadoun',
      date: todayFR(),
      familyGroup: '',
      note: ''
    });
    setFormErr('');
    setFileErr('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUser) {
      toast({ message: 'Veuillez sélectionner un opérateur dans la barre du haut.', tone: 'warn' });
      return;
    }

    if (!file) {
      setFileErr('Veuillez joindre l\'image ou le PDF du reçu.');
      return;
    }

    const amt = parseFloat(formData.amount);
    if (!(amt > 0)) {
      setFormErr('Saisissez le montant valide du reçu.');
      return;
    }

    const finalOffer = formData.offer === 'Offre personnalisé'
      ? (formData.customOffer.trim() || 'Offre personnalisé')
      : (formData.offer || 'Zero To Hero');

    let normalizedMode = formData.mode;
    if (normalizedMode.toLowerCase().startsWith('virement')) normalizedMode = 'Virement Bancaire';
    else if (normalizedMode.toLowerCase().startsWith('edinar') || normalizedMode.toLowerCase().includes('d17')) normalizedMode = 'Edinar - D17';
    else if (normalizedMode.toLowerCase().includes('esp')) normalizedMode = 'Espèces';

    const effectiveDate = formData.date.trim() ? (toISO(formData.date) || new Date().toISOString()) : new Date().toISOString();

    try {
      setIsSubmitting(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('operatorName', activeUser);
      fd.append('uploadedBy', activeUser);
      fd.append('amount', String(amt));
      fd.append('mode', normalizedMode);
      fd.append('paymentMode', normalizedMode);
      fd.append('wallet', formData.wallet);
      fd.append('paymentDetails', formData.wallet);
      fd.append('name', formData.name.trim() || 'Élève non renseigné');
      fd.append('nom', formData.name.trim() || 'Élève non renseigné');
      const cleanPhone = formatPhone(formData.phone);
      fd.append('phone', cleanPhone);
      fd.append('telephone', cleanPhone);
      if (formData.email.trim()) fd.append('email', formData.email.trim());
      fd.append('classe', finalOffer);
      fd.append('offer', finalOffer);
      if (formData.familyGroup.trim()) fd.append('familyGroup', formData.familyGroup.trim());
      if (formData.note.trim()) fd.append('note', formData.note.trim());
      fd.append('paymentDate', effectiveDate);

      const res = await fetch('/api/receipts', {
        method: 'POST',
        body: fd
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Erreur lors de l’envoi du reçu');
      }

      const createdReceipt = await res.json();

      toast({ message: 'Reçu envoyé avec succès', tone: 'ok' });

      // Afficher le reçu officiel téléchargeable
      setGeneratedTicket({
        reference: createdReceipt.reference,
        studentName: createdReceipt.clientDetails?.nom || formData.name.trim() || 'Élève non renseigné',
        phone: formatPhone(createdReceipt.clientDetails?.telephone || formData.phone),
        offer: createdReceipt.clientDetails?.classe || finalOffer,
        familyGroup: createdReceipt.clientDetails?.familyGroup || formData.familyGroup.trim(),
        amount: createdReceipt.amount || amt,
        operatorName: createdReceipt.operatorName || activeUser,
        paymentDate: createdReceipt.paymentDate || effectiveDate,
      });

      resetUploadForm();
      setTab('todo');
      mutate();
    } catch (err: any) {
      setFormErr(err.message || 'Une erreur est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sauvegarder les modifications du reçu (accessible pour tous les reçus avec traçabilité)
  const handleSaveChanges = async () => {
    if (!selectedReceipt) return;
    try {
      setIsSavingChanges(true);
      const parsedAmount = parseFloat(String(editAmount));
      const payload: any = {
        clientDetails: {
          nom: editNom.trim(),
          telephone: formatPhone(editPhone),
          classe: editOffer.trim(),
          email: selectedReceipt.clientDetails?.email || '',
          familyGroup: selectedReceipt.clientDetails?.familyGroup || ''
        },
        paymentMode: editMode,
        paymentDetails: editWallet,
        amount: isNaN(parsedAmount) ? 0 : parsedAmount,
        paymentDate: editDate
          ? buildEditPaymentDate(editDate, selectedReceipt?.paymentDate || selectedReceipt?.createdAt)
          : resolveExactReceiptDate(selectedReceipt?.paymentDate, selectedReceipt?.createdAt),
        lastModifiedBy: activeUser || 'Elios'
      };
      if (modalNote.trim()) {
        payload.note = modalNote.trim();
        payload.addedBy = activeUser || 'Elios';
      }
      const res = await fetch(`/api/receipts/${selectedReceipt._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Erreur lors de la mise à jour du reçu');
      const updated = await res.json();
      toast({ message: 'Modifications enregistrées avec succès', tone: 'ok' });
      setSelectedReceipt(updated);
      setModalNote('');
      mutate();
    } catch (err: any) {
      toast({ message: err.message || 'Erreur lors de la sauvegarde', tone: 'warn' });
    } finally {
      setIsSavingChanges(false);
    }
  };

  // Ajouter une note dédiée avec bouton et enregistrement de l'auteur
  const handleAddNote = async () => {
    if (!selectedReceipt || !newNoteText.trim()) return;
    try {
      setIsAddingNote(true);
      const res = await fetch(`/api/receipts/${selectedReceipt._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: newNoteText.trim(),
          addedBy: activeUser || 'Elios',
          lastModifiedBy: activeUser || 'Elios'
        }),
      });

      if (!res.ok) throw new Error('Échec de l’enregistrement de la note');
      const updated = await res.json();
      setSelectedReceipt(prev => prev ? { 
        ...prev, 
        notes: updated.notes || prev.notes,
        updatedAt: updated.updatedAt || prev.updatedAt,
        lastModifiedBy: activeUser || 'Elios'
      } : null);
      setNewNoteText('');
      toast({ message: 'Note ajoutée avec succès', tone: 'ok' });
      mutate();
    } catch (err: any) {
      console.error('Erreur ajout note:', err);
      toast({ message: err.message || 'Erreur lors de l’ajout de la note', tone: 'warn' });
    } finally {
      setIsAddingNote(false);
    }
  };

  // Télécharger directement le fichier image / PDF du reçu
  const handleDownloadReceiptImage = async () => {
    if (!selectedReceipt?.gDriveFileId) {
      toast({ message: 'Aucun fichier attaché à ce reçu', tone: 'warn' });
      return;
    }
    try {
      setIsDownloadingImage(true);
      const downloadUrl = `/api/image/${selectedReceipt.gDriveFileId}`;
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error('Erreur de téléchargement');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const isPdf = blob.type.includes('pdf');
      const refClean = (selectedReceipt.reference || selectedReceipt.clientDetails?.nom || 'recu').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Recu-${refClean}.${isPdf ? 'pdf' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ message: 'Reçu téléchargé avec succès', tone: 'ok' });
    } catch (err: any) {
      console.error('Erreur téléchargement reçu:', err);
      window.open(`/api/image/${selectedReceipt.gDriveFileId}`, '_blank');
    } finally {
      setIsDownloadingImage(false);
    }
  };

  // Traiter un reçu (sauvegarde les modifications et marque comme PROCESSED)
  const handleProcessReceipt = async () => {
    if (!selectedReceipt) return;
    try {
      setIsProcessing(true);
      const parsedAmount = parseFloat(String(editAmount));
      const payload: any = {
        status: 'PROCESSED',
        processedBy: activeUser || 'Elios',
        lastModifiedBy: activeUser || 'Elios',
        clientDetails: {
          nom: editNom.trim(),
          telephone: formatPhone(editPhone),
          classe: editOffer.trim(),
          email: selectedReceipt.clientDetails?.email || '',
          familyGroup: selectedReceipt.clientDetails?.familyGroup || ''
        },
        paymentMode: editMode,
        paymentDetails: editWallet,
        amount: isNaN(parsedAmount) ? 0 : parsedAmount,
        paymentDate: editDate
          ? buildEditPaymentDate(editDate, selectedReceipt?.paymentDate || selectedReceipt?.createdAt)
          : resolveExactReceiptDate(selectedReceipt?.paymentDate, selectedReceipt?.createdAt),
        lock: false
      };
      if (modalNote.trim()) {
        payload.note = modalNote.trim();
        payload.addedBy = activeUser || 'Elios';
      }
      const res = await fetch(`/api/receipts/${selectedReceipt._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Erreur lors de la validation du reçu');
      toast({ message: 'Reçu validé et marqué comme traité', tone: 'ok' });
      closeReceiptModal();
      mutate();
    } catch (err: any) {
      toast({ message: err.message, tone: 'warn' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Supprimer définitivement le reçu et décaisser le montant
  const handleDeleteReceipt = async () => {
    if (!selectedReceipt) return;
    try {
      setIsDeletingReceipt(true);
      const res = await fetch(`/api/receipts/${selectedReceipt._id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression du reçu');
      const data = await res.json();
      const decaissAmount = data.deletedAmount ?? selectedReceipt.amount ?? 0;
      const targetDest = data.paymentDetails || selectedReceipt.paymentDetails || 'la destination';
      toast({ 
        message: `Reçu supprimé avec succès. ${decaissAmount} DT a été décaissé de ${targetDest}.`, 
        tone: 'ok' 
      });
      closeReceiptModal();
      mutate();
    } catch (err: any) {
      toast({ message: err.message || 'Impossible de supprimer le reçu', tone: 'warn' });
    } finally {
      setIsDeletingReceipt(false);
    }
  };

  // Normalisation des reçus
  const receipts = rawReceipts || [];

  // Détecter si un reçu est verrouillé par un AUTRE opérateur depuis moins de 45s
  const isLockedByOther = (r: Receipt) => {
    if (!r.lockedBy || r.lockedBy === activeUser) return false;
    if (!r.lockedAt) return false;
    return (Date.now() - new Date(r.lockedAt).getTime()) < 45000;
  };

  // Statistiques avec exclusion des reçus verrouillés par d'autres opérateurs
  const stats = useMemo(() => {
    const available = receipts.filter(r => !isLockedByOther(r));
    const todo = available.filter(r => r.status === 'PENDING');
    const done = available.filter(r => r.status === 'PROCESSED' || r.status === 'ARCHIVED');
    const totalAmount = done.reduce((sum, r) => sum + (r.amount || 0), 0);
    return {
      totalAmount,
      doneCount: done.length,
      todoCount: todo.length
    };
  }, [receipts, activeUser]);

  // Filtrage liste (disparaît instantanément si ouvert par un autre opérateur)
  const filteredRows = useMemo(() => {
    const s = searchQuery.trim().toLowerCase();
    const queryDigits = s.replace(/\D/g, '');
    return receipts.filter(r => {
      // Disparaît de la liste si actuellement ouvert par un autre opérateur
      if (isLockedByOther(r)) return false;

      if (tab === 'todo' && r.status !== 'PENDING') return false;
      if (tab === 'done' && r.status !== 'PROCESSED' && r.status !== 'ARCHIVED') return false;
      if (!s) return true;
      if (queryDigits && queryDigits.length >= 2) {
        const telDigits = (r.clientDetails?.telephone || '').replace(/\D/g, '');
        if (telDigits.includes(queryDigits)) return true;
      }
      const haystack = [
        r.clientDetails?.nom,
        r.clientDetails?.telephone,
        r.paymentMode,
        r.paymentDetails,
        r.clientDetails?.classe,
        r.operatorName
      ].join(' ').toLowerCase();
      return haystack.includes(s);
    });
  }, [receipts, tab, searchQuery, activeUser]);

  const formatFileSize = (b: number) => b > 1e6 ? (b / 1e6).toFixed(1) + ' Mo' : Math.round(b / 1e3) + ' Ko';

  const formatFullDateTime = (d?: string | Date | null) => {
    if (!d) return '—';
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return '—';
    }
  };

  return (
    <div data-page="receipts">
      <EliosHeader 
        crumb="Suivi des encaissements"
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
        {/* Titre & Liens */}
        <div className="hd">
          <div className="pageicon" aria-hidden="true">
            <svg className="i" viewBox="0 0 24 24">
              <path d="M3 7a2 2 0 0 1 2-2h13v4"/>
              <path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/>
              <circle cx="16.5" cy="14.5" r="1"/>
            </svg>
          </div>
          <div className="t">
            <h1>Suivi des encaissements</h1>
            <p className="sub">
              Déposez les reçus, vérifiez-les et suivez chaque encaissement jusqu'au traitement.
            </p>
          </div>
          <div className="acts">
            <Link className="btn" id="lkW" href="/portefeuilles">
              <svg className="i" viewBox="0 0 24 24">{IC.wallet}</svg>
              <span className="txt">Portefeuilles</span>
            </Link>
          </div>
        </div>

        {/* Section Stats */}
        <section className="stats" aria-label="Résumé">
          <div className="stat" style={{ '--c': 'var(--fin)' } as React.CSSProperties}>
            <small><i/>Reçus traités</small>
            <b id="sDone">{stats.doneCount}</b>
          </div>
          <div className="stat" style={{ '--c': 'var(--warn)' } as React.CSSProperties}>
            <small><i/>À traiter</small>
            <b id="sTodo">{stats.todoCount}</b>
          </div>
        </section>

        {/* Grille principale : Formulaire à gauche + Liste à droite */}
        <div className="grid-enc">
          {/* Panneau Nouveau Reçu */}
          <section className="panel" aria-labelledby="hNew">
            <h2 id="hNew">Nouveau reçu</h2>
            <p className="hint">Déposez l'image du reçu, puis renseignez les informations de l'élève.</p>

            {/* Dropzone */}
            <div 
              className={`dz ${isOver ? 'over' : ''}`} 
              id="dz" 
              role="button" 
              tabIndex={0} 
              aria-label="Choisir un fichier"
              style={{ display: file ? 'none' : '' }}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
              onDragLeave={() => setIsOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsOver(false);
                if (e.dataTransfer.files) handleFileSelect(e.dataTransfer.files[0]);
              }}
            >
              <div className="up">
                <svg className="i" viewBox="0 0 24 24">{IC.up}</svg>
              </div>
              <b>Glissez-déposez le reçu ici ou <u>Parcourir</u></b>
              <small>PNG, JPG ou PDF, jusqu'à 10 Mo</small>
            </div>

            <input 
              type="file" 
              id="fi" 
              ref={fileInputRef}
              accept="image/png,image/jpeg,application/pdf" 
              hidden 
              onChange={(e) => {
                if (e.target.files) handleFileSelect(e.target.files[0]);
              }}
            />

            {/* Fichier sélectionné */}
            {file && (
              <div className="file on" id="file">
                {file.type.startsWith('image/') && fileUrl ? (
                  <img src={fileUrl} alt="Aperçu reçu" className="ph" />
                ) : (
                  <span className="ph" id="fph">
                    <svg className="i" viewBox="0 0 24 24">{IC.doc}</svg>
                  </span>
                )}
                <span>
                  <b id="fname">{file.name}</b>
                  <small id="fsize">{formatFileSize(file.size)}</small>
                </span>
                <button 
                  type="button" 
                  id="chipRemove" 
                  onClick={clearFile}
                  disabled={isSubmitting}
                  aria-label="Retirer le fichier"
                  style={{
                    marginLeft: 'auto',
                    display: 'grid',
                    placeItems: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--ink3)',
                    cursor: 'pointer',
                    transition: '.15s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.background = 'var(--hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink3)'; e.currentTarget.style.background = 'transparent'; }}
                  title="Retirer le fichier"
                >
                  <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {fileErr && <p className="err" id="ferr" role="alert">{fileErr}</p>}

            {/* Formulaire complet */}
            <form 
              id="f" 
              noValidate 
              className={`form-enc ${file ? 'on' : ''}`}
              onSubmit={handleSubmit}
            >
              {/* Élève(s) */}
              <label className="full">
                Élève(s)
                <input 
                  id="fn" 
                  placeholder="Nom(s) de l'élève..." 
                  autoComplete="off"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </label>

              {/* Téléphone & Email */}
              <label title="Numéro de téléphone">
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Numéro de téléphone
                </span>
                <input 
                  id="fp" 
                  inputMode="tel" 
                  placeholder="Ex : 92 330 331"
                  maxLength={16}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                />
              </label>

              <label title="Email">
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Email
                </span>
                <input 
                  id="fe" 
                  type="email"
                  placeholder="email@gmail.com"
                  autoComplete="off"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </label>

              {/* Offre */}
              <label className="full">
                Offre
                <select 
                  id="fo"
                  value={formData.offer}
                  onChange={(e) => setFormData({ ...formData, offer: e.target.value, customOffer: '' })}
                >
                  <option value="" disabled>Sélectionner une offre</option>
                  {OFFERS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>

              {/* Nature de l'offre si Offre personnalisé */}
              {formData.offer === 'Offre personnalisé' && (
                <label className="full">
                  Nature de l'offre
                  <input 
                    id="fco"
                    placeholder="Précisez l'offre..."
                    autoComplete="off"
                    value={formData.customOffer}
                    onChange={(e) => setFormData({ ...formData, customOffer: e.target.value })}
                  />
                </label>
              )}

              {/* Mode de paiement */}
              <label title="Mode de paiement">
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Mode de paiement
                </span>
                <select 
                  id="fm"
                  value={formData.mode}
                  onChange={(e) => handleModeChange(e.target.value)}
                >
                  <option value="" disabled>Sélectionner un mode</option>
                  {MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>

              {/* Portefeuille / Local / Banque / Titulaire */}
              <label title={formData.mode && PAYMENT_MODES_CONFIG[formData.mode]?.label ? PAYMENT_MODES_CONFIG[formData.mode].label : 'Portefeuille'}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formData.mode && PAYMENT_MODES_CONFIG[formData.mode]?.label 
                    ? PAYMENT_MODES_CONFIG[formData.mode].label 
                    : 'Portefeuille'}
                </span>
                <select 
                  id="fw"
                  value={formData.wallet}
                  disabled={!formData.mode}
                  onChange={(e) => setFormData({ ...formData, wallet: e.target.value })}
                >
                  {!formData.mode ? (
                    <option value="" disabled>Choisir un mode d'abord</option>
                  ) : (
                    <>
                      <option value="" disabled>{PAYMENT_MODES_CONFIG[formData.mode]?.placeholder || 'Sélectionner'}</option>
                      {PAYMENT_MODES_CONFIG[formData.mode]?.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </>
                  )}
                </select>
              </label>

              {/* Montant avec DT */}
              <label>
                Montant
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                  <input 
                    id="fa" 
                    type="number" 
                    min="1" 
                    step="any" 
                    inputMode="decimal" 
                    required
                    placeholder="0.00"
                    style={{ paddingRight: '36px', width: '100%', boxSizing: 'border-box' }}
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    onWheel={(e) => e.currentTarget.blur()}
                    onKeyDown={(e) => {
                      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                  />
                  <span style={{ position: 'absolute', right: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink3)', pointerEvents: 'none' }}>
                    DT
                  </span>
                </div>
              </label>

              {/* Date du paiement */}
              <label title="Date du paiement (JJ/MM/AAAA)">
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Date du paiement
                </span>
                <input 
                  id="fd" 
                  placeholder="JJ/MM/AAAA"
                  maxLength={10}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: formatDateInput(e.target.value) })}
                />
              </label>

              {/* Groupe familial */}
              <label className="full">
                Family Group <span style={{ color: 'var(--ink3)', fontWeight: 400, fontSize: '12px' }}>(si applicable)</span>
                <input 
                  id="ffg"
                  placeholder="Ex: Fratrie Ben Ali / Groupe Famille..."
                  autoComplete="off"
                  value={formData.familyGroup}
                  onChange={(e) => setFormData({ ...formData, familyGroup: e.target.value })}
                />
              </label>

              {/* Note facultative */}
              <label className="full">
                Note <span style={{ color: 'var(--ink3)', fontWeight: 400, fontSize: '12px' }}>(Facultatif)</span>
                <textarea 
                  id="fnte"
                  rows={2}
                  placeholder="Ajouter une note..."
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </label>

              {formErr && <p className="err full" id="err" role="alert">{formErr}</p>}

              <button 
                className="btn pri full" 
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Envoi en cours...' : 'Envoyer le reçu'}
              </button>
            </form>
          </section>

          {/* Panneau Liste des Reçus */}
          <section aria-labelledby="hList">
            <div className="bar">
              <div>
                <h2 id="hList">{tab === 'todo' ? 'Reçus en attente' : 'Reçus traités'}</h2>
                <p className="hint" id="hHint">
                  {tab === 'todo' 
                    ? 'Ouvrez un reçu pour vérifier les informations, ajouter une note puis le marquer comme traité.'
                    : 'Consultez l’historique des reçus validés et traités.'
                  }
                </p>
              </div>

              {/* Onglets */}
              <div className="tabs" role="tablist">
                <button 
                  role="tab" 
                  id="tTodo" 
                  aria-selected={tab === 'todo'}
                  onClick={() => setTab('todo')}
                  type="button"
                >
                  À traiter <em id="cTodo">{stats.todoCount}</em>
                </button>
                <button 
                  role="tab" 
                  id="tDone" 
                  aria-selected={tab === 'done'}
                  onClick={() => setTab('done')}
                  type="button"
                >
                  Traités <em id="cDone">{stats.doneCount}</em>
                </button>
              </div>
            </div>

            {/* Recherche */}
            <div className="find">
              <svg className="i" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7"/>
                <path d="m20 20-3.5-3.5"/>
              </svg>
              <input 
                id="q" 
                type="search" 
                placeholder="Rechercher un élève, un numéro, un portefeuille…" 
                aria-label="Rechercher un reçu"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Cartes */}
            <div className="list" id="list">
              {filteredRows.length > 0 ? (
                filteredRows.map((r, n) => {
                  const opMatch = Array.isArray(operators) ? operators.find(o => o.name.toLowerCase() === (r.operatorName || '').toLowerCase()) : undefined;
                  const opColor = opMatch ? getThemeColors(opMatch.theme).dot : '#7BA25B';
                  const dateStr = new Date(r.paymentDate || r.createdAt).toLocaleDateString("fr-FR");

                  return (
                    <article 
                      key={r._id} 
                      className={`rc ${r.status === 'PENDING' ? 'todo' : 'done'}`} 
                      style={{ '--i': n } as React.CSSProperties}
                    >
                      <div className="rt">
                        <span className="doc">
                          <svg className="i" viewBox="0 0 24 24">{IC.doc}</svg>
                        </span>
                        <div>
                          <h3>{r.clientDetails?.nom || 'Élève non renseigné'}</h3>
                          <div className="ph2">
                            <svg className="i" viewBox="0 0 24 24">{IC.phone}</svg>
                            {r.clientDetails?.telephone ? formatPhone(r.clientDetails.telephone) : 'Sans numéro'}
                          </div>
                        </div>
                        <div className="rr">
                          <time>{dateStr}</time>
                          <span className="amt">{(r.amount || 0).toLocaleString('fr-FR')} DT</span>
                        </div>
                      </div>

                      <div className="offer">
                        <small>Offre</small>
                        {r.clientDetails?.classe || 'Standard'}
                      </div>

                      <div className="ft">
                        <span className="by" style={{ '--u': opColor } as React.CSSProperties}>
                          <i/>Importé par {r.operatorName || 'Elios'}
                        </span>
                        <span className="pay">
                          {r.paymentMode || 'Espèces'}, {r.paymentDetails || 'Bab Saadoun'}
                        </span>
                      </div>

                      <button 
                        className="see" 
                        type="button"
                        onClick={() => openReceiptModal(r)}
                      >
                        {r.status === 'PENDING' ? 'Traiter' : 'Voir'}
                      </button>
                    </article>
                  );
                })
              ) : (
                <div className="empty">
                  <div className="ok">
                    <svg className="i" viewBox="0 0 24 24">{IC.ok}</svg>
                  </div>
                  {searchQuery ? (
                    <b>Aucun résultat. Essayez un autre nom ou numéro.</b>
                  ) : tab === 'todo' ? (
                    <b>Tous les reçus sont traités. Les nouveaux reçus envoyés apparaîtront ici.</b>
                  ) : (
                    <b>Aucun reçu traité. Les reçus traités apparaîtront ici.</b>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Modale Visualisation, Traitement & Édition */}
      {/* Modale Visualisation, Traitement & Édition */}
      {isDlgOpen && selectedReceipt && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 100 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSavingChanges && !isDeletingReceipt) {
              closeReceiptModal();
            }
          }}
        >
          <div 
            className="enc-dialog-container animate-in fade-in zoom-in-95 duration-150" 
            id="dc" 
            style={{ 
              width: 'min(620px, 95vw)', 
              maxHeight: '92vh', 
              display: 'flex', 
              flexDirection: 'column',
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}
          >
            <div className="dh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 20px', borderBottom: '1px solid var(--line)', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                <h2 id="dt" style={{ margin: 0, fontSize: '17px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {editNom || selectedReceipt.clientDetails?.nom || 'Élève non renseigné'}
                </h2>
                <span className="amt" style={{ flexShrink: 0 }}>
                  {(Number(editAmount) || selectedReceipt.amount || 0).toLocaleString('fr-FR')} DT
                </span>
                
                {/* Badge Statut Fiable */}
                {isProcessed ? (
                  <span style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '5px', 
                    fontSize: '11px', 
                    fontWeight: 700,
                    padding: '3px 9px', 
                    borderRadius: '20px',
                    background: '#ECFDF5', 
                    color: '#065F46', 
                    border: '1px solid #A7F3D0' 
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                    {selectedReceipt.processedBy ? `Traité par ${selectedReceipt.processedBy}` : 'Traité'}
                  </span>
                ) : (
                  <span style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '5px', 
                    fontSize: '11px', 
                    fontWeight: 700,
                    padding: '3px 9px', 
                    borderRadius: '20px',
                    background: '#FFFBEB', 
                    color: '#92400E', 
                    border: '1px solid #FDE68A' 
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
                    À traiter
                  </span>
                )}

                {/* Petit i informatif & traçabilité (Non gras & Italique) */}
                <button
                  type="button"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    border: showAuditInfo ? '1.5px solid #2563EB' : '1px solid var(--line)',
                    background: showAuditInfo ? '#EFF6FF' : 'var(--card)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: showAuditInfo ? '#2563EB' : 'var(--ink2)',
                    padding: 0,
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    fontStyle: 'italic',
                    fontWeight: 400,
                    fontSize: '14px',
                    lineHeight: 1,
                    boxShadow: showAuditInfo ? '0 0 0 3px rgba(37, 99, 235, 0.12)' : '0 1px 2px rgba(0,0,0,0.04)',
                    transition: 'all 0.18s ease',
                    userSelect: 'none',
                    flexShrink: 0
                  }}
                  onClick={() => setShowAuditInfo(!showAuditInfo)}
                  title="Historique des modifications & Traçabilité"
                  aria-label="Historique et audit"
                >
                  i
                </button>
              </div>

              <button 
                type="button" 
                className="x" 
                onClick={closeReceiptModal}
                disabled={isSavingChanges || isDeletingReceipt}
                aria-label="Fermer"
              >
                <svg className="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
              </button>

              {/* Volet de Traçabilité & Historique - Ancré responsivement à l'en-tête de la modale */}
              {showAuditInfo && (
                <>
                  {/* Overlay invisible pour fermer au clic en dehors */}
                  <div 
                    style={{ position: 'fixed', inset: 0, zIndex: 70 }} 
                    onClick={() => setShowAuditInfo(false)} 
                  />
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: '16px',
                    background: 'var(--card)',
                    border: '1px solid var(--line)',
                    borderRadius: '12px',
                    padding: '13px 15px',
                    boxShadow: '0 18px 38px -6px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.05)',
                    zIndex: 75,
                    width: 'min(330px, calc(100% - 32px))',
                    maxWidth: 'calc(100% - 32px)',
                    fontSize: '12px',
                    color: 'var(--ink)',
                    animation: 'rise .15s ease both',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '9px', borderBottom: '1px solid var(--line)', paddingBottom: '7px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          width: 18, 
                          height: 18, 
                          borderRadius: '50%', 
                          background: '#EFF6FF', 
                          color: '#2563EB', 
                          fontSize: '11px', 
                          fontFamily: 'Georgia, serif', 
                          fontStyle: 'italic', 
                          fontWeight: 400 
                        }}>i</span>
                        <strong style={{ fontSize: '12.5px', color: 'var(--ink)' }}>Traçabilité & Historique</strong>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setShowAuditInfo(false)} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink3)', fontSize: '18px', lineHeight: 1, padding: '2px 4px', borderRadius: '4px' }}
                        aria-label="Fermer"
                      >
                        ×
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <span style={{ color: 'var(--ink3)', flexShrink: 0 }}>Référence :</span>
                        <span style={{ fontWeight: 600, wordBreak: 'break-all', textAlign: 'right' }}>{selectedReceipt.reference || selectedReceipt._id}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: 'var(--ink3)', flexShrink: 0 }}>Importé par :</span>
                        <span style={{ fontWeight: 600, textAlign: 'right' }}>{selectedReceipt.operatorName || 'Système'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: 'var(--ink3)', flexShrink: 0 }}>Créé le :</span>
                        <span style={{ textAlign: 'right' }}>{formatFullDateTime(selectedReceipt.createdAt)}</span>
                      </div>
                      {selectedReceipt.updatedAt && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                          <span style={{ color: 'var(--ink3)', flexShrink: 0 }}>Dernière modif :</span>
                          <span style={{ textAlign: 'right' }}>
                            {formatFullDateTime(selectedReceipt.updatedAt)}
                            {selectedReceipt.lastModifiedBy ? ` (${selectedReceipt.lastModifiedBy})` : ''}
                          </span>
                        </div>
                      )}
                      {isProcessed && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F0FDF4', padding: '6px 8px', borderRadius: '7px', color: '#166534', border: '1px solid #DCFCE7', marginTop: '2px', gap: '8px' }}>
                          <span style={{ fontWeight: 600, flexShrink: 0 }}>Validé / Traité :</span>
                          <span style={{ fontWeight: 600, textAlign: 'right' }}>
                            {formatFullDateTime(selectedReceipt.processedAt || selectedReceipt.updatedAt)}
                            {selectedReceipt.processedBy ? ` (${selectedReceipt.processedBy})` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="db" style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', gap: '14px' }}>
              {/* Image ou Lien Reçu */}
              <div className="shot" style={{ position: 'relative', minHeight: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                {selectedReceipt.gDriveFileId && !imgError ? (
                  <>
                    <a 
                      href={`/api/image/${selectedReceipt.gDriveFileId}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      title="Cliquez pour agrandir l'image dans un nouvel onglet"
                      style={{ display: 'block', width: '100%', textAlign: 'center' }}
                    >
                      <img 
                        src={`/api/image/${selectedReceipt.gDriveFileId}`} 
                        alt={`Reçu ${editNom || selectedReceipt.clientDetails?.nom || ''}`}
                        onError={() => setImgError(true)}
                        style={{ maxHeight: '320px', width: 'auto', margin: '0 auto', display: 'block', borderRadius: '8px' }}
                      />
                    </a>
                    {/* Bouton d'action Télécharger */}
                    <button
                      type="button"
                      onClick={handleDownloadReceiptImage}
                      disabled={isDownloadingImage}
                      className="btn"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        padding: '7px 16px',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        background: 'var(--card)',
                        border: '1px solid var(--line)',
                        borderRadius: '9px',
                        cursor: 'pointer',
                        color: 'var(--ink)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                      }}
                      title="Télécharger le fichier original du reçu"
                    >
                      <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      {isDownloadingImage ? 'Téléchargement...' : 'Télécharger le reçu'}
                    </button>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    {selectedReceipt.gDriveFileId ? (
                      <>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 16px',
                          background: 'var(--hover)',
                          borderRadius: '10px',
                          border: '1px solid var(--line)',
                          color: 'var(--ink)'
                        }}>
                          <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, color: '#DC2626' }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="9" y1="15" x2="15" y2="15"/>
                          </svg>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>Document PDF / Fichier attaché</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                          <a
                            href={`/api/image/${selectedReceipt.gDriveFileId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn"
                            style={{ fontSize: '12.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            Ouvrir le document ↗
                          </a>
                          <button
                            type="button"
                            onClick={handleDownloadReceiptImage}
                            disabled={isDownloadingImage}
                            className="btn"
                            style={{ fontSize: '12.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                              <polyline points="7 10 12 15 17 10"/>
                              <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            {isDownloadingImage ? 'Téléchargement...' : 'Télécharger le document'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p style={{ color: '#9CA3AF', fontSize: '13.5px', margin: 0 }}>
                          Aucune image jointe
                        </p>
                        {selectedReceipt.gDriveViewUrl && (
                          <a
                            href={selectedReceipt.gDriveViewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn"
                            style={{ fontSize: '12.5px', fontWeight: 600 }}
                          >
                            Ouvrir sur Google Drive ↗
                          </a>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Confirmation de suppression et décaissement */}
              {showDeleteConfirm && (
                <div style={{
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  animation: 'rise .2s ease both'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991B1B', fontWeight: 700, fontSize: '13.5px' }}>
                    <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                      <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    Confirmation de suppression et décaissement
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#7F1D1D', lineHeight: 1.5 }}>
                    Êtes-vous sûr de vouloir supprimer définitivement ce reçu ? Le montant de <b>{editAmount || selectedReceipt.amount} DT</b> sera immédiatement <b>décaissé</b> du portefeuille destination (<b>{editMode || selectedReceipt.paymentMode} - {editWallet || selectedReceipt.paymentDetails}</b>) et le fichier Drive sera effacé.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                    <button 
                      type="button" 
                      className="btn" 
                      style={{ padding: '6px 12px', fontSize: '12.5px' }}
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeletingReceipt}
                    >
                      Annuler
                    </button>
                    <button 
                      type="button" 
                      className="btn" 
                      style={{ 
                        padding: '6px 14px', 
                        fontSize: '12.5px', 
                        background: '#DC2626', 
                        color: '#fff', 
                        borderColor: '#DC2626',
                        fontWeight: 600
                      }}
                      onClick={handleDeleteReceipt}
                      disabled={isDeletingReceipt}
                    >
                      {isDeletingReceipt ? 'Suppression en cours...' : 'Confirmer et décaisser'}
                    </button>
                  </div>
                </div>
              )}


              {/* Formulaire complet et modifiable */}
              <div 
                className="form-enc on" 
                style={{ 
                  margin: 0, 
                  display: 'grid', 
                  gap: '12px', 
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' 
                }}
              >
                {/* Nom élève */}
                <label title="Nom de l'élève">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Élève(s)</span>
                  <input 
                    placeholder="Nom(s) de l'élève..." 
                    value={editNom}
                    onChange={(e) => setEditNom(e.target.value)}
                  />
                </label>

                {/* Téléphone */}
                <label title="Numéro de téléphone">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Téléphone</span>
                  <input 
                    inputMode="tel"
                    placeholder="Ex : 92 330 331"
                    maxLength={16}
                    value={editPhone}
                    onChange={(e) => setEditPhone(formatPhone(e.target.value))}
                  />
                </label>

                {/* Montant */}
                <label title="Montant en Dinars Tunisiens">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Montant</span>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                    <input 
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      style={{ paddingRight: '36px', width: '100%', boxSizing: 'border-box' }}
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      onKeyDown={(e) => {
                        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                    />
                    <span style={{ position: 'absolute', right: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink3)', pointerEvents: 'none' }}>
                      DT
                    </span>
                  </div>
                </label>

                {/* Date */}
                <label title="Date du paiement">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Date</span>
                  <input 
                    type="date"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </label>

                {/* Mode de paiement */}
                <label title="Mode de paiement">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Mode</span>
                  <select 
                    value={editMode}
                    onChange={(e) => {
                      const newMode = e.target.value;
                      setEditMode(newMode);
                      const opts = PAYMENT_MODES_CONFIG[newMode]?.options || [];
                      setEditWallet(opts[0] || '');
                    }}
                  >
                    {MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>

                {/* Détails / Portefeuille */}
                <label title={PAYMENT_MODES_CONFIG[editMode]?.label || 'Portefeuille'}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {PAYMENT_MODES_CONFIG[editMode]?.label || 'Portefeuille'}
                  </span>
                  <select 
                    value={editWallet}
                    onChange={(e) => setEditWallet(e.target.value)}
                  >
                    {PAYMENT_MODES_CONFIG[editMode]?.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </label>

                {/* Offre */}
                <label title="Offre / Formation">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Offre</span>
                  <input 
                    placeholder="Offre / Formation..."
                    value={editOffer}
                    onChange={(e) => setEditOffer(e.target.value)}
                    list="dlg-offers-list"
                  />
                  <datalist id="dlg-offers-list">
                    {OFFERS.map(o => <option key={o} value={o} />)}
                  </datalist>
                </label>

                {/* Importé par (Lecture seule) */}
                <label title="Opérateur ayant téléversé le reçu">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Importé par</span>
                  <div style={{
                    padding: '10px 12px',
                    background: 'var(--hover)',
                    borderRadius: '11px',
                    fontSize: '13px',
                    color: 'var(--ink2)',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    border: '1px solid var(--line)'
                  }}>
                    {selectedReceipt.operatorName || 'Elios'}
                  </div>
                </label>
              </div>

              {/* Section Notes Collaborative & Traçable */}
              <div style={{
                border: '1px solid var(--line)',
                borderRadius: '12px',
                padding: '14px 16px',
                background: 'var(--card)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginTop: '4px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2, color: 'var(--ink3)' }}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                      Notes & Observations internes ({selectedReceipt.notes?.length || 0})
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--ink3)' }}>
                    Synchronisation active
                  </span>
                </div>

                {/* Historique des notes */}
                <div style={{
                  maxHeight: '140px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  paddingRight: '4px'
                }}>
                  {selectedReceipt.notes && selectedReceipt.notes.length > 0 ? (
                    selectedReceipt.notes.map((n, idx) => (
                      <div 
                        key={idx} 
                        style={{
                          background: 'var(--hover)',
                          borderRadius: '8px',
                          padding: '9px 12px',
                          border: '1px solid var(--line)',
                          fontSize: '12.5px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', display: 'inline-block' }} />
                            {n.addedBy || n.author || (n as any).by || 'Opérateur'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--ink3)' }}>
                            {formatFullDateTime(n.addedAt || n.date)}
                          </span>
                        </div>
                        <p style={{ margin: 0, color: 'var(--ink2)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                          {n.text}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--ink3)', fontSize: '12px', fontStyle: 'italic' }}>
                      Aucune note sur ce reçu pour le moment.
                    </div>
                  )}
                </div>

                {/* Compositeur de nouvelle note */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
                  <textarea
                    rows={2}
                    placeholder="Rédiger une observation ou remarque..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      fontSize: '13px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--card)',
                      color: 'var(--ink)',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={handleAddNote}
                      disabled={isAddingNote || !newNoteText.trim()}
                      className="btn"
                      style={{
                        padding: '6px 14px',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        background: newNoteText.trim() ? '#2563EB' : 'var(--hover)',
                        color: newNoteText.trim() ? '#fff' : 'var(--ink3)',
                        borderColor: newNoteText.trim() ? '#2563EB' : 'var(--line)',
                        cursor: newNoteText.trim() ? 'pointer' : 'not-allowed',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                      {isAddingNote ? 'Enregistrement...' : 'Ajouter la note'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="df" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Bouton Reçu officiel (s'ouvre en avant-plan) */}
                <button 
                  className="btn" 
                  type="button" 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => {
                    setGeneratedTicket({
                      reference: selectedReceipt.reference,
                      studentName: editNom || selectedReceipt.clientDetails?.nom,
                      phone: formatPhone(editPhone || selectedReceipt.clientDetails?.telephone || ''),
                      offer: editOffer || selectedReceipt.clientDetails?.classe,
                      familyGroup: selectedReceipt.clientDetails?.familyGroup,
                      amount: Number(editAmount) || selectedReceipt.amount || 0,
                      operatorName: selectedReceipt.operatorName,
                      paymentDate: editDate
                        ? buildEditPaymentDate(editDate, selectedReceipt.paymentDate || selectedReceipt.createdAt)
                        : resolveExactReceiptDate(selectedReceipt.paymentDate, selectedReceipt.createdAt),
                    });
                  }}
                >
                  <svg className="i" viewBox="0 0 24 24" style={{ width: 15, height: 15 }}>
                    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/>
                    <path d="M9 8h6M9 12h6"/>
                  </svg>
                  Reçu officiel
                </button>

                {/* Bouton Supprimer */}
                <button 
                  className="btn" 
                  type="button" 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    color: '#DC2626', 
                    borderColor: '#FECACA',
                    background: '#FEF2F2' 
                  }}
                  disabled={isDeletingReceipt || isSavingChanges}
                  onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                  title="Supprimer ce reçu et décaisser le montant de la destination"
                >
                  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                  Supprimer
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  className="btn" 
                  type="button" 
                  onClick={closeReceiptModal}
                  disabled={isSavingChanges || isDeletingReceipt}
                >
                  Fermer
                </button>

                {/* Enregistrer les modifications */}
                <button 
                  className="btn" 
                  type="button" 
                  disabled={isSavingChanges || isDeletingReceipt}
                  onClick={handleSaveChanges}
                  style={{ fontWeight: 600 }}
                  title="Enregistrer les modifications avec traçabilité complète de l'auteur et de l'heure"
                >
                  {isSavingChanges ? 'Enregistrement...' : 'Enregistrer'}
                </button>

                {selectedReceipt.status === 'PENDING' && (
                  <button 
                    className="btn pri" 
                    type="button" 
                    id="ok"
                    disabled={isProcessing || isSavingChanges || isDeletingReceipt}
                    onClick={handleProcessReceipt}
                  >
                    {isProcessing ? 'Validation...' : 'Marquer comme traité'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {generatedTicket && (
        <PaymentReceiptModal
          isOpen={!!generatedTicket}
          onClose={() => setGeneratedTicket(null)}
          data={generatedTicket}
        />
      )}
    </div>
  );
}

