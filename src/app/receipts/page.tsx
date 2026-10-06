"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { EliosHeader } from '@/components/EliosHeader';
import { PaymentReceiptModal } from '@/components/PaymentReceiptModal';
import { Receipt, Operator, getThemeColors } from '@/types';
import { useToast } from '@/components/Toast';

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

  // Données MongoDB
  const { data: rawReceipts, mutate } = useSWR<Receipt[]>('/api/receipts?status=all', fetcher);
  const { data: operators } = useSWR<Operator[]>('/api/operators', fetcher);

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
    return `${yyyy}-${mm}-${dd}T12:00:00Z`;
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

  const formatPhone = (val: string) => {
    let p = val.replace(/[^\d+]/g, '');
    if (p.startsWith('+216')) p = p.substring(4);
    else if (p.startsWith('00216')) p = p.substring(5);
    const d = p.replace(/\D/g, '').slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`;
    return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
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
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [isDlgOpen, setIsDlgOpen] = useState(false);
  const [modalNote, setModalNote] = useState('');
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
  const isProcessed = selectedReceipt?.status === 'PROCESSED';

  // Fermeture modale par touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else if (isDlgOpen && !isSavingChanges && !isDeletingReceipt) {
          setIsDlgOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDlgOpen, showDeleteConfirm, isSavingChanges, isDeletingReceipt]);

  const openReceiptModal = (r: Receipt) => {
    setSelectedReceipt(r);
    setEditNom(r.clientDetails?.nom || '');
    setEditPhone(r.clientDetails?.telephone || '');
    setEditAmount(r.amount !== undefined ? String(r.amount) : '');
    const dt = r.paymentDate || r.createdAt;
    setEditDate(dt ? new Date(dt).toISOString().split('T')[0] : '');
    setEditOffer(r.clientDetails?.classe || 'Standard');
    setEditMode(r.paymentMode || 'Espèces');
    setEditWallet(r.paymentDetails || 'Bab Saadoun');
    setModalNote(r.notes && r.notes.length > 0 ? r.notes[0].text : '');
    setShowDeleteConfirm(false);
    setImgError(false);
    setIsDlgOpen(true);
  };

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
      fd.append('phone', formData.phone.trim());
      fd.append('telephone', formData.phone.trim());
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
        phone: createdReceipt.clientDetails?.telephone || formData.phone.trim(),
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

  // Sauvegarder les modifications du reçu
  const handleSaveChanges = async () => {
    if (!selectedReceipt || isProcessed) return;
    try {
      setIsSavingChanges(true);
      const parsedAmount = parseFloat(String(editAmount));
      const payload: any = {
        clientDetails: {
          nom: editNom.trim(),
          telephone: editPhone.trim(),
          classe: editOffer.trim(),
          email: selectedReceipt.clientDetails?.email || '',
          familyGroup: selectedReceipt.clientDetails?.familyGroup || ''
        },
        paymentMode: editMode,
        paymentDetails: editWallet,
        amount: isNaN(parsedAmount) ? 0 : parsedAmount,
        paymentDate: editDate ? new Date(editDate) : new Date(),
      };
      if (modalNote.trim()) {
        payload.note = modalNote.trim();
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
      mutate();
    } catch (err: any) {
      toast({ message: err.message || 'Erreur lors de la sauvegarde', tone: 'warn' });
    } finally {
      setIsSavingChanges(false);
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
        clientDetails: {
          nom: editNom.trim(),
          telephone: editPhone.trim(),
          classe: editOffer.trim(),
          email: selectedReceipt.clientDetails?.email || '',
          familyGroup: selectedReceipt.clientDetails?.familyGroup || ''
        },
        paymentMode: editMode,
        paymentDetails: editWallet,
        amount: isNaN(parsedAmount) ? 0 : parsedAmount,
        paymentDate: editDate ? new Date(editDate) : new Date(),
        note: modalNote.trim(),
        lock: false,
        lockedBy: null
      };
      const res = await fetch(`/api/receipts/${selectedReceipt._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Erreur lors de la validation du reçu');
      toast({ message: 'Reçu modifié et marqué comme traité', tone: 'ok' });
      setIsDlgOpen(false);
      setSelectedReceipt(null);
      setModalNote('');
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
      setShowDeleteConfirm(false);
      setIsDlgOpen(false);
      setSelectedReceipt(null);
      mutate();
    } catch (err: any) {
      toast({ message: err.message || 'Impossible de supprimer le reçu', tone: 'warn' });
    } finally {
      setIsDeletingReceipt(false);
    }
  };

  // Normalisation des reçus
  const receipts = rawReceipts || [];

  // Statistiques
  const stats = useMemo(() => {
    const todo = receipts.filter(r => r.status === 'PENDING');
    const done = receipts.filter(r => r.status === 'PROCESSED' || r.status === 'ARCHIVED');
    const totalAmount = done.reduce((sum, r) => sum + (r.amount || 0), 0);
    return {
      totalAmount,
      doneCount: done.length,
      todoCount: todo.length
    };
  }, [receipts]);

  // Filtrage liste
  const filteredRows = useMemo(() => {
    const s = searchQuery.trim().toLowerCase();
    return receipts.filter(r => {
      if (tab === 'todo' && r.status !== 'PENDING') return false;
      if (tab === 'done' && r.status !== 'PROCESSED' && r.status !== 'ARCHIVED') return false;
      if (!s) return true;
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
  }, [receipts, tab, searchQuery]);

  const formatFileSize = (b: number) => b > 1e6 ? (b / 1e6).toFixed(1) + ' Mo' : Math.round(b / 1e3) + ' Ko';

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
                  placeholder="+216 XX XXX XXX"
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
                  const opColor = opMatch ? getThemeColors(opMatch.theme).dot : '#0F9D82';
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
                            {r.clientDetails?.telephone || 'Sans numéro'}
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
      {isDlgOpen && selectedReceipt && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 60 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSavingChanges && !isDeletingReceipt) {
              setIsDlgOpen(false);
            }
          }}
        >
          <div 
            className="enc-dialog-container animate-in fade-in zoom-in-95 duration-150" 
            id="dc" 
            style={{ 
              width: 'min(580px, 95vw)', 
              maxHeight: '92vh', 
              display: 'flex', 
              flexDirection: 'column',
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}
          >
            <div className="dh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                <h2 id="dt" style={{ margin: 0, fontSize: '17px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {editNom || 'Élève non renseigné'}
                </h2>
                <span className="amt" style={{ flexShrink: 0 }}>
                  {(Number(editAmount) || 0).toLocaleString('fr-FR')} DT
                </span>
                {isProcessed ? (
                  <span style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '4px', 
                    fontSize: '11px', 
                    fontWeight: 700,
                    padding: '3px 8px', 
                    borderRadius: '20px',
                    background: '#ECFDF5', 
                    color: '#065F46', 
                    border: '1px solid #A7F3D0' 
                  }}>
                    <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 }}>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Traité (Verrouillé)
                  </span>
                ) : (
                  <span style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    fontSize: '11px', 
                    fontWeight: 700,
                    padding: '3px 8px', 
                    borderRadius: '20px',
                    background: '#FFFBEB', 
                    color: '#92400E', 
                    border: '1px solid #FDE68A' 
                  }}>
                    À traiter
                  </span>
                )}
              </div>
              <button 
                type="button" 
                className="x" 
                onClick={() => setIsDlgOpen(false)}
                disabled={isSavingChanges || isDeletingReceipt}
                aria-label="Fermer"
              >
                <svg className="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
              </button>
            </div>

            <div className="db" style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', gap: '14px' }}>
              {/* Image ou Lien Reçu */}
              <div className="shot" style={{ position: 'relative', minHeight: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selectedReceipt.gDriveFileId && !imgError ? (
                  <a 
                    href={`/api/image/${selectedReceipt.gDriveFileId}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    title="Cliquez pour agrandir l'image"
                    style={{ display: 'block', width: '100%', height: '100%' }}
                  >
                    <img 
                      src={`/api/image/${selectedReceipt.gDriveFileId}`} 
                      alt={`Reçu ${editNom || selectedReceipt.clientDetails?.nom || ''}`}
                      onError={() => setImgError(true)}
                      style={{ maxHeight: '320px', width: 'auto', margin: '0 auto', display: 'block', borderRadius: '8px' }}
                    />
                  </a>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <p style={{ color: '#9CA3AF', fontSize: '13.5px', marginBottom: selectedReceipt.gDriveViewUrl ? '10px' : '0' }}>
                      Aucune image jointe
                    </p>
                    {selectedReceipt.gDriveViewUrl && (
                      <a
                        href={selectedReceipt.gDriveViewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#F3F4F6',
                          color: '#374151',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          textDecoration: 'none',
                          border: '1px solid #E5E7EB',
                        }}
                      >
                        Ouvrir le document sur Google Drive ↗
                      </a>
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

              {/* Bannière explicative si le reçu est déjà traité */}
              {isProcessed && (
                <div style={{
                  background: 'var(--hover)',
                  border: '1px solid var(--line)',
                  borderRadius: '11px',
                  padding: '11px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: 'var(--ink2)',
                  fontSize: '12.5px'
                }}>
                  <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2, flexShrink: 0, color: 'var(--ink3)' }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span>
                    Ce reçu est <strong>traité et comptabilisé</strong>. Ses informations sont verrouillées en lecture seule et ne peuvent plus être modifiées.
                  </span>
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
                    disabled={isProcessed}
                  />
                </label>

                {/* Téléphone */}
                <label title="Numéro de téléphone">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Téléphone</span>
                  <input 
                    inputMode="tel"
                    placeholder="XX XXX XXX"
                    maxLength={14}
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    disabled={isProcessed}
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
                      disabled={isProcessed}
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
                    disabled={isProcessed}
                  />
                </label>

                {/* Mode de paiement */}
                <label title="Mode de paiement">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Mode</span>
                  <select 
                    value={editMode}
                    disabled={isProcessed}
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
                    disabled={isProcessed}
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
                    list={isProcessed ? undefined : "dlg-offers-list"}
                    disabled={isProcessed}
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

                {/* Note */}
                <label className="full" title="Note">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Note</span>
                  <textarea 
                    rows={2} 
                    placeholder={isProcessed ? "Aucune note" : "Ajoutez ou modifiez une note..."}
                    value={modalNote}
                    onChange={(e) => setModalNote(e.target.value)}
                    disabled={isProcessed}
                  />
                </label>
              </div>
            </div>

            <div className="df" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', padding: '14px 20px' }}>
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
                      phone: editPhone || selectedReceipt.clientDetails?.telephone || '',
                      offer: editOffer || selectedReceipt.clientDetails?.classe,
                      familyGroup: selectedReceipt.clientDetails?.familyGroup,
                      amount: Number(editAmount) || selectedReceipt.amount || 0,
                      operatorName: selectedReceipt.operatorName,
                      paymentDate: editDate ? new Date(editDate) : (selectedReceipt.paymentDate || selectedReceipt.createdAt),
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
                  onClick={() => setIsDlgOpen(false)}
                  disabled={isSavingChanges || isDeletingReceipt}
                >
                  Fermer
                </button>

                {/* Enregistrer les modifications (uniquement pour les reçus non traités) */}
                {!isProcessed && (
                  <button 
                    className="btn" 
                    type="button" 
                    disabled={isSavingChanges || isDeletingReceipt}
                    onClick={handleSaveChanges}
                    style={{ fontWeight: 600 }}
                  >
                    {isSavingChanges ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                )}

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

