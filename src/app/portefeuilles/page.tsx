"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { EliosHeader } from '@/components/EliosHeader';
import { useToast } from '@/components/Toast';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface WalletData {
  mode: string;
  details: string;
  totalAmount: number;
  count: number;
  currentTotalAmount?: number;
  currentCount?: number;
  dayAmount?: number;
  dayOut?: number;
  dayCount?: number;
  selectedDate?: string | null;
}

interface ReceiptItem {
  _id: string;
  reference?: string;
  amount: number;
  paymentMode: string;
  paymentDetails: string;
  paymentDate?: string;
  createdAt: string;
  operatorName?: string;
  clientDetails?: {
    nom?: string;
    telephone?: string;
    classe?: string;
    offer?: string;
    note?: string;
  };
  notes?: {
    text: string;
    addedBy?: string;
    addedAt?: string;
  }[];
  status: string;
}

const OPERATOR_COLORS: Record<string, string> = {
  Amine: '#23356E',   // Bleu Marine officiel
  Elyes: '#3D4E7F',   // Bleu Marine 80%
  Soumaya: '#F49E1F', // Ambre chaud officiel
  Narjess: '#7BA25B', // Vert Olive officiel
  Koussay: '#67759F', // Bleu Marine 60%
  Aya: '#F6B047',     // Ambre 80%
  Mariem: '#92B277',  // Vert Olive 80%
  Asma: '#F8C374',    // Ambre 60%
  Ghassen: '#23356E', // Bleu Marine officiel
};

function getOperatorColor(name?: string): string {
  if (!name) return '#23356E';
  const found = Object.entries(OPERATOR_COLORS).find(
    ([k]) => k.toLowerCase() === name.trim().toLowerCase()
  );
  return found ? found[1] : '#23356E';
}

function getWalletGrads(mode: string, details: string): { g1: string; g2: string } {
  const m = (mode || '').toLowerCase();
  const d = (details || '').toLowerCase();

  if (m.includes('esp')) {
    if (d.includes('bab saadoun') || d.includes('saadoun')) return { g1: '#0FA36B', g2: '#054C38' };
    if (d.includes('soumaya')) return { g1: '#A3143F', g2: '#4A0A24' };
    if (d.includes('douar') || d.includes('hicher')) return { g1: '#C2570A', g2: '#582304' };
    return { g1: '#0FA36B', g2: '#054C38' };
  }

  if (m.includes('edinar') || m.includes('d17')) {
    if (d.includes('soumaya')) return { g1: '#403BC2', g2: '#1D1962' };
    if (d.includes('elyes')) return { g1: '#0A93B4', g2: '#0B4D57' };
    return { g1: '#0A93B4', g2: '#0B4D57' };
  }

  if (m.includes('vir') || m.includes('banque')) {
    if (d.includes('safa')) return { g1: '#7E24D6', g2: '#3E0870' };
    if (d.includes('elyes')) return { g1: '#3B4864', g2: '#0E1932' };
    if (d.includes('baraka')) return { g1: '#C70F1E', g2: '#59050F' };
    return { g1: '#7E24D6', g2: '#3E0870' };
  }

  return { g1: '#374151', g2: '#111827' };
}

const formatDT = (n: number | undefined | null) =>
  (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fdt = (iso: string | Date | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return (
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  );
};

const formatFrenchDate = (isoDate: string): string => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const mIndex = parseInt(month, 10) - 1;
  return `${parseInt(day, 10)} ${months[mIndex] || month} ${year}`;
};

const formatShortFrenchDate = (isoDate: string): string => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const mIndex = parseInt(month, 10) - 1;
  return `${parseInt(day, 10)} ${months[mIndex] || month}`;
};

const getTodayIso = (): string => {
  const now = new Date();
  const tunis = new Date(now.getTime() + 60 * 60 * 1000);
  return tunis.toISOString().slice(0, 10);
};

const getYesterdayIso = (): string => {
  const now = new Date();
  const tunis = new Date(now.getTime() + 60 * 60 * 1000 - 24 * 60 * 60 * 1000);
  return tunis.toISOString().slice(0, 10);
};

export default function PortefeuillesPage() {
  const { toast } = useToast();
  const [activeUser, setActiveUser] = useState<string | null>(null);

  // Security / PIN Gate
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPin, setAuthPin] = useState('');
  const [authPinError, setAuthPinError] = useState('');
  const [isVerifyingAuth, setIsVerifyingAuth] = useState(false);
  const authPinRef = useRef<HTMLInputElement | null>(null);

  // Filtre temporel (Date Filter)
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Data fetching (réactif au filtre de date)
  const walletApiUrl = selectedDate ? `/api/portefeuilles?date=${selectedDate}` : '/api/portefeuilles';
  const { data: wallets, isLoading, error, mutate } = useSWR<WalletData[]>(walletApiUrl, fetcher);
  const { data: allReceipts } = useSWR<ReceiptItem[]>('/api/receipts?status=all', fetcher);

  // Active Category Filter Tab
  const [tab, setTab] = useState<string>('');

  // Retrait Modal (Sole deduction action requested by user)
  const [retraitWallet, setRetraitWallet] = useState<WalletData | null>(null);
  const [retraitAmount, setRetraitAmount] = useState('');
  const [retraitMotif, setRetraitMotif] = useState('');
  const [retraitPin, setRetraitPin] = useState('');
  const [retraitError, setRetraitError] = useState('');
  const [isSubmittingRetrait, setIsSubmittingRetrait] = useState(false);

  // Extrait Modal
  const [extraitWallet, setExtraitWallet] = useState<WalletData | null>(null);
  const [extraitReceipts, setExtraitReceipts] = useState<ReceiptItem[]>([]);
  const [extraitFilter, setExtraitFilter] = useState<'all' | 'upTo' | 'dayOnly'>('all');
  const [isLoadingExtrait, setIsLoadingExtrait] = useState(false);
  const [isDownloadingExtrait, setIsDownloadingExtrait] = useState(false);
  const exportTicketRef = useRef<HTMLDivElement | null>(null);

  // Reset temporal filter handler
  const handleResetDateFilter = () => {
    setSelectedDate('');
    toast({ message: 'Filtre temporel réinitialisé (Vue globale)', tone: 'ok' });
  };

  // Reset Modal
  const [resetWallet, setResetWallet] = useState<WalletData | null>(null);
  const [resetPin, setResetPin] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Change PIN Modal
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [changeOldPin, setChangeOldPin] = useState('');
  const [changeNewPin, setChangeNewPin] = useState('');
  const [changeConfirmPin, setChangeConfirmPin] = useState('');
  const [changePinError, setChangePinError] = useState('');
  const [isSubmittingChangePin, setIsSubmittingChangePin] = useState(false);

  // Restore user from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('elios.user') || localStorage.getItem('receiptHubActiveUser');
      if (saved) {
        const parsed = saved.startsWith('"') ? JSON.parse(saved) : saved;
        setActiveUser(parsed);
      }
    } catch {}
  }, []);

  const handleUserChange = (user: string) => {
    setActiveUser(user);
    try {
      localStorage.setItem('elios.user', JSON.stringify(user));
      localStorage.setItem('receiptHubActiveUser', user);
    } catch {}
  };

  // Focus auth PIN input on mount
  useEffect(() => {
    if (!isAuthenticated) {
      document.body.style.overflow = 'hidden';
      const timer = setTimeout(() => {
        authPinRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isAuthenticated]);

  // Handle Auth PIN verification (auto-called on 6 digits or on submit)
  const verifyAuthPin = async (pinVal: string) => {
    if (!pinVal || pinVal.length !== 6) {
      setAuthPinError('Le code PIN doit comporter exactement 6 chiffres.');
      return;
    }
    setIsVerifyingAuth(true);
    setAuthPinError('');
    try {
      const res = await fetch('/api/settings/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', pin: pinVal })
      });
      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        toast({ message: 'Accès autorisé', tone: 'ok' });
      } else {
        setAuthPinError(data.error || 'Code PIN incorrect.');
        setAuthPin('');
        authPinRef.current?.focus();
      }
    } catch {
      setAuthPinError('Erreur de vérification avec le serveur.');
    } finally {
      setIsVerifyingAuth(false);
    }
  };

  const handleAuthPinChange = (val: string) => {
    const digitsOnly = val.replace(/\D/g, '').slice(0, 6);
    setAuthPin(digitsOnly);
    setAuthPinError('');
    if (digitsOnly.length === 6) {
      verifyAuthPin(digitsOnly);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authPin.length !== 6) {
      setAuthPinError('Le code PIN doit comporter exactement 6 chiffres.');
      return;
    }
    verifyAuthPin(authPin);
  };

  // Helper for categories and counts
  const categories = useMemo(() => {
    if (!wallets) return [];
    const set = new Set<string>();
    wallets.forEach(w => {
      if (w.mode) set.add(w.mode);
    });
    return Array.from(set);
  }, [wallets]);

  const filteredWallets = useMemo(() => {
    if (!wallets) return [];
    if (!tab) return wallets;
    return wallets.filter(w => w.mode === tab);
  }, [wallets, tab]);

  // Overall statistics (synchronisées avec le filtre temporel)
  const totalBalance = useMemo(() => {
    if (!wallets) return 0;
    return wallets.reduce((acc, w) => acc + (w.totalAmount || 0), 0);
  }, [wallets]);

  const allTimeTotalBalance = useMemo(() => {
    if (!wallets) return 0;
    return wallets.reduce((acc, w) => acc + (w.currentTotalAmount ?? w.totalAmount ?? 0), 0);
  }, [wallets]);

  const totalDayCashIn = useMemo(() => {
    if (!wallets) return 0;
    return wallets.reduce((acc, w) => acc + (w.dayAmount || 0), 0);
  }, [wallets]);

  const totalDayMovements = useMemo(() => {
    if (!wallets) return 0;
    return wallets.reduce((acc, w) => acc + (w.dayCount || 0), 0);
  }, [wallets]);

  const activeWalletsCount = useMemo(() => {
    return wallets ? wallets.length : 0;
  }, [wallets]);

  const todayMovementsCount = useMemo(() => {
    if (!allReceipts) return 0;
    const targetDate = selectedDate || getTodayIso();
    return allReceipts.filter(r => {
      const d = (r.paymentDate || r.createdAt || '').slice(0, 10);
      return d === targetDate;
    }).length;
  }, [allReceipts, selectedDate]);

  // 3D Card tilt handlers
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    card.style.setProperty('--mx', `${x * 100}%`);
    card.style.setProperty('--my', `${y * 100}%`);
    card.style.transform = `perspective(700px) rotateY(${(x - 0.5) * 7}deg) rotateX(${(0.5 - y) * 7}deg) translateY(-3px)`;
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    card.style.transform = '';
  };

  // Open Retrait modal
  const openRetrait = (w: WalletData) => {
    setRetraitWallet(w);
    setRetraitAmount('');
    setRetraitMotif('');
    setRetraitPin('');
    setRetraitError('');
  };

  const closeRetrait = () => {
    setRetraitWallet(null);
    setRetraitAmount('');
    setRetraitMotif('');
    setRetraitPin('');
    setRetraitError('');
  };

  const handleConfirmRetrait = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retraitWallet) return;
    const v = Math.round(parseFloat(retraitAmount) * 100) / 100;
    if (isNaN(v) || v <= 0) {
      setRetraitError('Saisissez un montant valide.');
      return;
    }
    if (v > retraitWallet.totalAmount) {
      setRetraitError('Le montant dépasse le solde disponible.');
      return;
    }
    if (!retraitPin || !/^\d{6}$/.test(retraitPin)) {
      setRetraitError('Le code PIN doit comporter exactement 6 chiffres.');
      return;
    }

    setIsSubmittingRetrait(true);
    setRetraitError('');

    try {
      // Step 1: Verify PIN
      const pinRes = await fetch('/api/settings/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', pin: retraitPin })
      });
      const pinData = await pinRes.json();
      if (!pinData.success) {
        setRetraitError(pinData.error || 'Code PIN incorrect.');
        setIsSubmittingRetrait(false);
        return;
      }

      // Step 2: Post negative amount deduction receipt
      const receiptRes = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId: 'retrait-' + Date.now(),
          operator: activeUser || 'Elios',
          reference: `RET-${Date.now().toString().slice(-6)}`,
          clientDetails: {
            name: 'RETRAIT',
            phone: '00000000',
            offer: 'Retrait',
            paymentMethod: `${retraitWallet.mode} - ${retraitWallet.details}`,
            amount: -Math.abs(v),
            date: new Date().toISOString().split('T')[0],
            note: retraitMotif.trim() || 'Retrait du portefeuille'
          }
        })
      });

      if (!receiptRes.ok) {
        throw new Error('Erreur lors de la déduction');
      }

      await mutate();
      toast({ message: `Retrait de ${formatDT(v)} DT enregistré avec succès`, tone: 'ok' });
      closeRetrait();
    } catch (err: any) {
      setRetraitError(err.message || 'Erreur serveur lors du retrait.');
    } finally {
      setIsSubmittingRetrait(false);
    }
  };

  // Open Extrait modal
  const openExtrait = async (w: WalletData) => {
    setExtraitWallet(w);
    setExtraitFilter('all');
    setIsLoadingExtrait(true);
    try {
      const url = new URL('/api/receipts', window.location.origin);
      url.searchParams.append('status', 'all');
      url.searchParams.append('paymentMode', w.mode);
      url.searchParams.append('paymentDetails', w.details);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setExtraitReceipts(data || []);
      }
    } catch {
      toast({ message: "Erreur de chargement de l'extrait", tone: 'warn' });
    } finally {
      setIsLoadingExtrait(false);
    }
  };

  const closeExtrait = () => {
    setExtraitWallet(null);
    setExtraitReceipts([]);
    setExtraitFilter('all');
  };

  // Computed running balance and summary for Extrait (sensible au filtre temporel)
  const { statementRows, totalIn, totalOut } = useMemo(() => {
    if (!extraitReceipts || extraitReceipts.length === 0) {
      return { statementRows: [], totalIn: 0, totalOut: 0 };
    }

    let filtered = extraitReceipts;
    if (selectedDate && extraitFilter === 'upTo') {
      filtered = extraitReceipts.filter(r => {
        const d = (r.paymentDate || r.createdAt || '').slice(0, 10);
        return d <= selectedDate;
      });
    } else if (selectedDate && extraitFilter === 'dayOnly') {
      filtered = extraitReceipts.filter(r => {
        const d = (r.paymentDate || r.createdAt || '').slice(0, 10);
        return d === selectedDate;
      });
    }

    const tIn = filtered.filter(r => (r.amount || 0) > 0).reduce((acc, r) => acc + r.amount, 0);
    const tOut = filtered.filter(r => (r.amount || 0) < 0).reduce((acc, r) => acc + Math.abs(r.amount), 0);

    // Sort chronologically ascending to calculate running balance accurately
    let run = 0;
    const chronological = [...filtered].sort((a, b) => {
      const timeA = new Date(a.paymentDate || a.createdAt).getTime();
      const timeB = new Date(b.paymentDate || b.createdAt).getTime();
      return timeA - timeB;
    });

    const withRunning = chronological.map(r => {
      run = Math.round((run + r.amount) * 100) / 100;
      return {
        ...r,
        runningBalance: run,
      };
    });

    // Display newest first
    return {
      statementRows: withRunning.reverse(),
      totalIn: tIn,
      totalOut: tOut,
    };
  }, [extraitReceipts, selectedDate, extraitFilter]);

  // Handler for downloading high-resolution Extrait/Reçu image
  const handleDownloadExtraitImage = async () => {
    const targetEl = exportTicketRef.current;
    if (!targetEl || !extraitWallet) return;
    setIsDownloadingExtrait(true);
    try {
      // 1. Positionner l'élément en fixed (0,0) pour un repère sans décalage de scroll
      targetEl.style.position = 'fixed';
      targetEl.style.top = '0px';
      targetEl.style.left = '0px';
      targetEl.style.visibility = 'visible';
      targetEl.style.opacity = '1';
      targetEl.style.zIndex = '-9999';

      // 2. S'assurer que toutes les images sont chargées
      const images = Array.from(targetEl.querySelectorAll('img'));
      await Promise.all(
        images.map(
          img =>
            new Promise(resolve => {
              if (img.complete && img.naturalHeight !== 0) resolve(true);
              else {
                img.onload = () => resolve(true);
                img.onerror = () => resolve(true);
              }
            })
        )
      );

      // Petit délai pour la stabilité du rendu DOM
      await new Promise(r => setTimeout(r, 60));

      let dataUrl = '';

      // Moteur principal : html2canvas-pro (peinture directe DOM vers Canvas, pas de foreignObject SVG)
      try {
        const html2canvas = (await import('html2canvas-pro')).default;
        const canvas = await html2canvas(targetEl, {
          scale: 3, // Ultra-HD 3x Retina resolution
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          width: 800,
          height: targetEl.scrollHeight,
          windowWidth: 800,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0,
        });

        // Vérification de sécurité que le canvas n'est pas blanc
        const ctx = canvas.getContext('2d');
        let hasContent = false;
        if (ctx) {
          const sample = ctx.getImageData(0, 0, Math.min(canvas.width, 250), Math.min(canvas.height, 250)).data;
          for (let i = 0; i < sample.length; i += 4) {
            if (sample[i + 3] > 50 && (sample[i] < 240 || sample[i + 1] < 240 || sample[i + 2] < 240)) {
              hasContent = true;
              break;
            }
          }
        }

        if (hasContent) {
          dataUrl = canvas.toDataURL('image/png', 1.0);
        } else {
          throw new Error('Canvas blanc détecté, basculement vers fallback');
        }
      } catch (canvasErr) {
        console.warn('html2canvas fallback vers html-to-image:', canvasErr);
        const { toPng } = await import('html-to-image');
        dataUrl = await toPng(targetEl, {
          quality: 1.0,
          pixelRatio: 3,
          backgroundColor: '#ffffff',
          cacheBust: true,
          style: {
            position: 'static',
            transform: 'none',
            margin: '0',
          },
        });
      }

      if (!dataUrl || dataUrl.length < 500) {
        throw new Error("L'image générée est vide");
      }

      const safeMode = (extraitWallet.mode || 'Mode').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeDetails = (extraitWallet.details || 'Portefeuille').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileDate = selectedDate || new Date().toISOString().slice(0, 10);
      const fileName = `Extrait_${safeMode}_${safeDetails}_${fileDate}.png`;

      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();

      toast({ message: "Image de l'extrait téléchargée avec succès (Haute Résolution)", tone: 'ok' });
    } catch (err) {
      console.error("Erreur lors de la génération de l'image de l'extrait:", err);
      toast({ message: "Erreur lors du téléchargement de l'image", tone: 'warn' });
    } finally {
      setIsDownloadingExtrait(false);
    }
  };

  // Open Reset modal
  const openReset = (w: WalletData) => {
    setResetWallet(w);
    setResetPin('');
    setResetError('');
  };

  const closeReset = () => {
    setResetWallet(null);
    setResetPin('');
    setResetError('');
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetWallet) return;
    if (resetWallet.totalAmount > 0 && (!resetPin || !/^\d{6}$/.test(resetPin))) {
      setResetError('Le code PIN doit comporter exactement 6 chiffres.');
      return;
    }

    setIsResetting(true);
    setResetError('');

    try {
      // Step 1: Verify PIN if wallet has positive balance
      if (resetWallet.totalAmount > 0) {
        const pinRes = await fetch('/api/settings/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify', pin: resetPin })
        });
        const pinData = await pinRes.json();
        if (!pinData.success) {
          setResetError(pinData.error || 'Code PIN incorrect.');
          setIsResetting(false);
          return;
        }
      }

      // Step 2: Delete/reset wallet
      const res = await fetch('/api/portefeuilles/reset', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: resetWallet.mode, details: resetWallet.details })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la remise à zéro');

      await mutate();
      toast({ message: `Portefeuille ${resetWallet.mode} - ${resetWallet.details} remis à zéro.`, tone: 'ok' });
      closeReset();
    } catch (err: any) {
      setResetError(err.message || 'Erreur serveur.');
    } finally {
      setIsResetting(false);
    }
  };

  // Change PIN modal handlers
  const handleConfirmChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeOldPin) {
      setChangePinError('Saisissez votre code PIN actuel.');
      return;
    }
    if (!/^\d{6}$/.test(changeNewPin)) {
      setChangePinError('Le nouveau code PIN doit comporter exactement 6 chiffres.');
      return;
    }
    if (changeNewPin !== changeConfirmPin) {
      setChangePinError('La confirmation ne correspond pas.');
      return;
    }

    setIsSubmittingChangePin(true);
    setChangePinError('');

    try {
      const res = await fetch('/api/settings/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change',
          currentPin: changeOldPin,
          newPin: changeNewPin,
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors du changement de PIN');
      }

      toast({ message: 'Code PIN modifié avec succès', tone: 'ok' });
      setIsChangePinOpen(false);
      setChangeOldPin('');
      setChangeNewPin('');
      setChangeConfirmPin('');
    } catch (err: any) {
      setChangePinError(err.message || 'Erreur lors du changement de PIN.');
    } finally {
      setIsSubmittingChangePin(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      {/* Header bar matching portefeuilles.html */}
      <EliosHeader
        crumb="Portefeuilles"
        parentCrumb="Suivi des encaissements"
        parentHref="/receipt-management"
        activeUser={activeUser}
        setActiveUser={handleUserChange}
      />

      {/* Wave cover banner */}
      <div className="cover" aria-hidden="true">
        <svg viewBox="0 0 800 44" preserveAspectRatio="none">
          <g fill="none" stroke="#fff" strokeWidth="1.2">
            <path d="M0 30C120 8 220 40 360 22S580 6 800 26"/>
            <path d="M0 38C140 18 240 44 380 30S600 14 800 34"/>
          </g>
        </svg>
      </div>

      {/* Authenticated Main Page */}
      {isAuthenticated && (
        <main className="page">
          <div className="hd">
            <div className="pageicon" aria-hidden="true">
              <svg className="i" viewBox="0 0 24 24">
                <path d="M3 7a2 2 0 0 1 2-2h13v4"/>
                <path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/>
                <circle cx="16.5" cy="14.5" r="1"/>
              </svg>
            </div>
            <div className="t">
              <h1>Portefeuilles</h1>
              <p className="sub">Supervisez l'ensemble des encaissements par destination.</p>
            </div>
            <button className="btn" id="pinBtn" onClick={() => setIsChangePinOpen(true)} type="button">
              <svg className="i" viewBox="0 0 24 24">
                <circle cx="8" cy="15" r="4"/>
                <path d="m11 12 9-9M16 7l3 3M14 9l2 2"/>
              </svg>
              Changer PIN
            </button>
          </div>

          {/* =========================================================================
              BARRE DE FILTRE TEMPOREL (Date Picker + Raccourcis + Bouton Reset)
              ========================================================================= */}
          <div
            className="temporal-filter-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              flexWrap: 'wrap',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: '16px',
              padding: '12px 18px',
              marginTop: '18px',
              boxShadow: 'var(--shadow)',
            }}
          >
            {/* Gauche: Titre et état */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '10px',
                  background: selectedDate
                    ? 'linear-gradient(135deg, var(--pri), #1E293B)'
                    : 'var(--fin-s)',
                  color: selectedDate ? '#ffffff' : 'var(--fin)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  boxShadow: selectedDate ? '0 4px 10px rgba(0,0,0,0.15)' : 'none',
                }}
              >
                <svg className="i" style={{ width: 18, height: 18 }} viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)', display: 'block', letterSpacing: '-0.2px' }}>
                  Filtre temporel
                </span>
                <small style={{ fontSize: '12px', color: selectedDate ? 'var(--fin)' : 'var(--ink2)', fontWeight: 600, display: 'block' }}>
                  {selectedDate ? (
                    <>
                      Arrêté au <b>{formatFrenchDate(selectedDate)}</b>
                    </>
                  ) : (
                    'Vue globale (temps réel)'
                  )}
                </small>
              </div>
            </div>

            {/* Centre: Sélecteur de date & Raccourcis */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                max={getTodayIso()}
                style={{
                  padding: '7px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--line)',
                  background: 'var(--hover)',
                  color: 'var(--ink)',
                  fontSize: '13px',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--mono)',
                }}
                title="Choisir une date pour arrêter les soldes et encaissements"
              />

              <div style={{ display: 'inline-flex', background: 'var(--hover)', borderRadius: '9px', padding: '2px', gap: '2px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedDate(getTodayIso())}
                  style={{
                    border: 'none',
                    background: selectedDate === getTodayIso() ? 'var(--card)' : 'transparent',
                    color: selectedDate === getTodayIso() ? 'var(--ink)' : 'var(--ink2)',
                    fontWeight: 600,
                    fontSize: '12px',
                    padding: '5px 10px',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    boxShadow: selectedDate === getTodayIso() ? 'var(--shadow)' : 'none',
                  }}
                >
                  Aujourd'hui
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(getYesterdayIso())}
                  style={{
                    border: 'none',
                    background: selectedDate === getYesterdayIso() ? 'var(--card)' : 'transparent',
                    color: selectedDate === getYesterdayIso() ? 'var(--ink)' : 'var(--ink2)',
                    fontWeight: 600,
                    fontSize: '12px',
                    padding: '5px 10px',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    boxShadow: selectedDate === getYesterdayIso() ? 'var(--shadow)' : 'none',
                  }}
                >
                  Hier
                </button>
              </div>
            </div>

            {/* Droite: Bouton Reset */}
            <div>
              {selectedDate ? (
                <button
                  type="button"
                  onClick={handleResetDateFilter}
                  className="btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    background: 'color-mix(in srgb, var(--bad) 10%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--bad) 30%, transparent)',
                    color: 'var(--bad)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                  }}
                  title="Effacer le filtre temporel et revenir au solde global"
                >
                  <svg className="i" style={{ width: 14, height: 14 }} viewBox="0 0 24 24">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  Réinitialiser le filtre
                </button>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    color: 'var(--ink3)',
                    fontWeight: 500,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--fin)',
                      boxShadow: '0 0 0 3px var(--fin-s)',
                    }}
                  />
                  Toutes les dates
                </span>
              )}
            </div>
          </div>

          {/* Bandeau d'information quand le filtre est actif */}
          {selectedDate && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'color-mix(in srgb, var(--fin) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--fin) 35%, transparent)',
                borderRadius: '12px',
                padding: '10px 16px',
                marginTop: '12px',
                fontSize: '13px',
                color: 'var(--ink)',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>📅</span>
                <span>
                  Affichage arrêté au <b>{formatFrenchDate(selectedDate)}</b>. Chaque carte affiche le <b>solde encaissé ce jour</b> ainsi que sa <b>balance totale à ce jour</b>.
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetDateFilter}
                style={{
                  border: 'none',
                  background: 'none',
                  color: 'var(--fin)',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Réinitialiser le filtre
              </button>
            </div>
          )}

          {/* Stats Summary */}
          <section className="stats stats-enc" aria-label="Résumé">
            <div className="stat">
              <small>
                <i style={{ background: 'var(--fin)' }}></i>
                {selectedDate ? `Solde au ${formatShortFrenchDate(selectedDate)}` : 'Solde total'}
              </small>
              <b>
                {formatDT(totalBalance)} <u>DT</u>
              </b>
              {selectedDate && (
                <span style={{ fontSize: '11.5px', color: 'var(--ink3)', marginTop: '3px', display: 'block' }}>
                  Solde actuel global : {formatDT(allTimeTotalBalance)} DT
                </span>
              )}
            </div>
            <div className="stat">
              <small>
                <i style={{ background: 'var(--fin)' }}></i>
                {selectedDate ? `Encaissé le ${formatShortFrenchDate(selectedDate)}` : "Encaissé aujourd'hui"}
              </small>
              <b style={{ color: totalDayCashIn > 0 ? 'var(--fin)' : undefined }}>
                {totalDayCashIn > 0 ? '+' : ''}{formatDT(totalDayCashIn)} <u>DT</u>
              </b>
              <span style={{ fontSize: '11.5px', color: 'var(--ink3)', marginTop: '3px', display: 'block' }}>
                {totalDayMovements} encaissement{totalDayMovements > 1 ? 's' : ''}
              </span>
            </div>
            <div className="stat">
              <small>
                <i style={{ background: 'var(--fin)' }}></i>
                {selectedDate ? `Mouvements du ${formatShortFrenchDate(selectedDate)}` : 'Mouvements du jour'}
              </small>
              <b>{selectedDate ? totalDayMovements : todayMovementsCount}</b>
              <span style={{ fontSize: '11.5px', color: 'var(--ink3)', marginTop: '3px', display: 'block' }}>
                {activeWalletsCount} portefeuilles actifs
              </span>
            </div>
          </section>

          {/* Filter Tabs */}
          <div className="tabs" role="tablist" id="tabs">
            <button
              role="tab"
              aria-selected={tab === ''}
              onClick={() => setTab('')}
              type="button"
            >
              Tous <em>{wallets ? wallets.length : 0}</em>
            </button>
            {categories.map(cat => {
              const count = wallets ? wallets.filter(w => w.mode === cat).length : 0;
              return (
                <button
                  key={cat}
                  role="tab"
                  aria-selected={tab === cat}
                  onClick={() => setTab(cat)}
                  type="button"
                >
                  {cat} <em>{count}</em>
                </button>
              );
            })}
          </div>

          {/* Grid of Credit Card Style Wallets */}
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
            </div>
          ) : error ? (
            <div className="mt-8 rounded-xl bg-red-50 p-6 text-center text-red-600 border border-red-200">
              Une erreur est survenue lors du chargement des portefeuilles.
            </div>
          ) : !filteredWallets || filteredWallets.length === 0 ? (
            <div className="mt-8 flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--line)] bg-[var(--card)]">
              <p className="text-gray-500">Aucun portefeuille trouvé dans cette catégorie.</p>
            </div>
          ) : (
            <div className="wallet-grid" id="grid">
              {filteredWallets.map((w, idx) => {
                const grads = getWalletGrads(w.mode, w.details);
                return (
                  <article
                    key={`${w.mode}-${w.details}`}
                    className="w-card"
                    style={{
                      '--i': idx,
                      '--g1': grads.g1,
                      '--g2': grads.g2,
                    } as React.CSSProperties}
                  >
                    <div
                      className="face"
                      onPointerMove={handlePointerMove}
                      onPointerLeave={handlePointerLeave}
                    >
                      <span className="cap">ELIOS BALANCE</span>
                      <h3>
                        {w.mode} - {w.details || 'NON SPÉCIFIÉ'}
                      </h3>
                      <div className="mid">
                        <span className="chip" />
                        <div className="bal">
                          <small>
                            {selectedDate
                              ? `BALANCE AU ${formatShortFrenchDate(selectedDate).toUpperCase()}`
                              : 'SOLDE COURANT'}{' '}
                            <svg viewBox="0 0 24 24">
                              <path d="M8 8a6 6 0 0 1 0 8M12 5a10 10 0 0 1 0 14M16 3a14 14 0 0 1 0 18"/>
                            </svg>
                          </small>
                          <b>
                            {formatDT(w.totalAmount)}
                            <i>DT</i>
                          </b>
                        </div>
                      </div>

                      {/* Pillule financière : Solde encaissé le jour mentionné */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(255, 255, 255, 0.14)',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255, 255, 255, 0.22)',
                          borderRadius: '10px',
                          padding: '7px 12px',
                          margin: '4px 0 10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg style={{ width: 13, height: 13, stroke: 'currentColor', fill: 'none', strokeWidth: 2 }} viewBox="0 0 24 24">
                            <path d="M12 5v14M19 12l-7 7-7-7"/>
                          </svg>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', opacity: 0.9 }}>
                            {selectedDate ? `Encaissé le ${formatShortFrenchDate(selectedDate)}` : `Encaissé ce jour`}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <b style={{ fontSize: '14px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: (w.dayAmount || 0) > 0 ? '#8DF5B8' : '#FFFFFF' }}>
                            {(w.dayAmount || 0) > 0 ? `+${formatDT(w.dayAmount || 0)}` : `${formatDT(0)}`}
                            <i style={{ fontStyle: 'normal', fontSize: '10.5px', marginLeft: '3px', fontWeight: 600 }}>DT</i>
                          </b>
                          {(w.dayOut || 0) > 0 && (
                            <span style={{ display: 'block', fontSize: '10px', color: '#FECACA', fontWeight: 600 }}>
                              −{formatDT(w.dayOut || 0)} sortie
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bot">
                        <span className="stt">
                          {selectedDate
                            ? `ARRÊTÉ AU ${formatShortFrenchDate(selectedDate).toUpperCase()}`
                            : 'STATUT: ACTIF'}
                        </span>
                        <span className="wm">ELIOS</span>
                      </div>
                    </div>

                    {/* Action buttons: Single Retrait, Extrait, and Remise à zéro */}
                    <div className="wallet-acts">
                      <button type="button" onClick={() => openRetrait(w)}>
                        <svg className="i" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9"/>
                          <path d="M8 12h8"/>
                        </svg>
                        Retrait
                      </button>
                      <button type="button" onClick={() => openExtrait(w)}>
                        <svg className="i" viewBox="0 0 24 24">
                          <path d="M6 3h9l4 4v14H6z"/>
                          <path d="M14 3v5h5M9 13h7M9 17h5"/>
                        </svg>
                        Extrait
                      </button>
                      <button className="zero" type="button" onClick={() => openReset(w)}>
                        <svg className="i" viewBox="0 0 24 24">
                          <path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>
                        </svg>
                        Remise à zéro
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* =========================================================================
          POPUP 1: ACCÈS SÉCURISÉ PIN (when not authenticated)
          ========================================================================= */}
      {!isAuthenticated && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ width: 'min(440px, 94vw)' }}>
            <div className="dh" style={{ justifyContent: 'flex-start', gap: '14px', alignItems: 'center' }}>
              <div
                style={{
                  width: 44,
                  height: 30,
                  borderRadius: 7,
                  background: 'linear-gradient(135deg, #0F9D82, #054C38)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  flex: 'none',
                  boxShadow: 'var(--shadow)',
                }}
              >
                <svg className="i" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div style={{ flex: 'none', textAlign: 'left' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--ink)' }}>
                  Accès Sécurisé
                </h2>
                <small style={{ display: 'block', color: 'var(--ink2)', fontSize: '13px', marginTop: '2px' }}>
                  Entrez votre code PIN administrateur
                </small>
              </div>
            </div>
            <form onSubmit={handleAuthSubmit} noValidate>
              <div className="db" style={{ padding: '24px 22px', gap: '20px' }}>
                <p className="note" style={{ textAlign: 'center', margin: 0, fontSize: '14px', color: 'var(--ink2)', lineHeight: '1.5' }}>
                  Veuillez saisir votre code PIN pour accéder à la trésorerie des portefeuilles.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink2)', textAlign: 'center' }}>
                    Code PIN
                  </label>
                  <input
                    ref={authPinRef}
                    className="pin"
                    style={{
                      textAlign: 'center',
                      fontSize: '22px',
                      letterSpacing: '8px',
                      padding: '10px 16px',
                      width: '210px',
                      borderRadius: '12px',
                    }}
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="off"
                    placeholder="••••••"
                    value={authPin}
                    onChange={e => handleAuthPinChange(e.target.value)}
                    disabled={isVerifyingAuth}
                  />
                </div>
                {authPinError && (
                  <p className="err" role="alert" style={{ textAlign: 'center', margin: 0 }}>
                    {authPinError}
                  </p>
                )}
              </div>
              <div className="df" style={{ justifyContent: 'center', gap: '12px', padding: '14px 22px' }}>
                <Link href="/" className="btn" style={{ padding: '9px 18px' }}>
                  Retour à l'accueil
                </Link>
                <button
                  className="btn pri"
                  type="submit"
                  disabled={isVerifyingAuth || authPin.length !== 6}
                  style={{ padding: '9px 20px' }}
                >
                  {isVerifyingAuth ? 'Vérification...' : 'Déverrouiller'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          POPUP 2: RETRAIT MODAL (Single deduction action)
          ========================================================================= */}
      {retraitWallet && (
        <div
          className="modal-overlay"
          onClick={e => {
            if (e.target === e.currentTarget && !isSubmittingRetrait) closeRetrait();
          }}
        >
          <div className="modal-dialog">
            <div className="dh" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <span
                  className="mw"
                  style={{
                    '--g1': getWalletGrads(retraitWallet.mode, retraitWallet.details).g1,
                    '--g2': getWalletGrads(retraitWallet.mode, retraitWallet.details).g2,
                  } as React.CSSProperties}
                />
                <div style={{ textAlign: 'left', minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--ink)' }}>
                    Retrait
                  </h2>
                  <small style={{ display: 'block', color: 'var(--ink2)', fontSize: '13px', marginTop: '2px' }}>
                    {retraitWallet.mode} - {retraitWallet.details} · solde {formatDT(retraitWallet.totalAmount)} DT
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="x"
                onClick={closeRetrait}
                disabled={isSubmittingRetrait}
                aria-label="Fermer"
              >
                <svg className="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
              </button>
            </div>
            <form onSubmit={handleConfirmRetrait} noValidate>
              <div className="db">
                <label>
                  Montant (DT)
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={retraitAmount}
                    onChange={e => {
                      setRetraitAmount(e.target.value);
                      setRetraitError('');
                    }}
                    onKeyDown={e => {
                      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    onWheel={e => e.currentTarget.blur()}
                    autoFocus
                  />
                </label>
                <label>
                  Bénéficiaire ou motif (facultatif)
                  <textarea
                    rows={2}
                    placeholder="Bénéficiaire ou motif du retrait..."
                    value={retraitMotif}
                    onChange={e => setRetraitMotif(e.target.value)}
                  />
                </label>
                <div className="pv">
                  <span>Solde après opération</span>
                  <b
                    className={
                      parseFloat(retraitAmount) > retraitWallet.totalAmount ? 'neg' : ''
                    }
                  >
                    {formatDT(
                      Math.max(
                        0,
                        retraitWallet.totalAmount - (parseFloat(retraitAmount) || 0)
                      )
                    )}{' '}
                    DT
                  </b>
                </div>
                <label>
                  Code PIN
                  <input
                    className="pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="off"
                    placeholder="••••"
                    value={retraitPin}
                    onChange={e => {
                      setRetraitPin(e.target.value);
                      setRetraitError('');
                    }}
                  />
                </label>
                {retraitError && <p className="err" role="alert">{retraitError}</p>}
              </div>
              <div className="df">
                <button
                  type="button"
                  className="btn"
                  onClick={closeRetrait}
                  disabled={isSubmittingRetrait}
                >
                  Annuler
                </button>
                <button
                  className="btn pri"
                  type="submit"
                  disabled={isSubmittingRetrait || !retraitAmount || !retraitPin}
                >
                  {isSubmittingRetrait ? 'Validation...' : 'Confirmer le retrait'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          POPUP 3: EXTRAIT DU PORTEFEUILLE MODAL
          ========================================================================= */}
      {extraitWallet && (
        <div
          className="modal-overlay"
          onClick={e => {
            if (e.target === e.currentTarget) closeExtrait();
          }}
        >
          <div className="modal-dialog xl">
            <div className="dh" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <span
                  className="mw"
                  style={{
                    '--g1': getWalletGrads(extraitWallet.mode, extraitWallet.details).g1,
                    '--g2': getWalletGrads(extraitWallet.mode, extraitWallet.details).g2,
                  } as React.CSSProperties}
                />
                <div style={{ textAlign: 'left', minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--ink)' }}>
                    Extrait du portefeuille
                  </h2>
                  <small style={{ display: 'block', color: 'var(--ink2)', fontSize: '13px', marginTop: '2px' }}>
                    {selectedDate
                      ? `${extraitWallet.mode} - ${extraitWallet.details} · balance arrêtée au ${formatShortFrenchDate(selectedDate)} : ${formatDT(extraitWallet.totalAmount)} DT`
                      : `${extraitWallet.mode} - ${extraitWallet.details} · solde ${formatDT(extraitWallet.currentTotalAmount ?? extraitWallet.totalAmount)} DT`}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="x"
                onClick={closeExtrait}
                aria-label="Fermer"
              >
                <svg className="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
              </button>
            </div>

            <div className="db">
              {/* Option de filtrage par date dans l'extrait si un filtre est actif sur la page */}
              {selectedDate && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 14px',
                    background: 'var(--hover)',
                    borderRadius: '11px',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>
                      Filtre d'extrait :
                    </span>
                    <small style={{ fontSize: '11.5px', color: 'var(--ink2)' }}>
                      Arrêté au {formatFrenchDate(selectedDate)}
                    </small>
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      background: 'var(--card)',
                      borderRadius: '8px',
                      padding: '2px',
                      border: '1px solid var(--line)',
                      gap: '2px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setExtraitFilter('all')}
                      style={{
                        border: 'none',
                        background: extraitFilter === 'all' ? 'var(--fin-s)' : 'transparent',
                        color: extraitFilter === 'all' ? 'var(--fin)' : 'var(--ink2)',
                        fontWeight: 600,
                        fontSize: '11.5px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      Tout ({extraitReceipts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setExtraitFilter('upTo')}
                      style={{
                        border: 'none',
                        background: extraitFilter === 'upTo' ? 'var(--fin-s)' : 'transparent',
                        color: extraitFilter === 'upTo' ? 'var(--fin)' : 'var(--ink2)',
                        fontWeight: 600,
                        fontSize: '11.5px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      Jusqu'au {formatShortFrenchDate(selectedDate)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExtraitFilter('dayOnly')}
                      style={{
                        border: 'none',
                        background: extraitFilter === 'dayOnly' ? 'var(--fin-s)' : 'transparent',
                        color: extraitFilter === 'dayOnly' ? 'var(--fin)' : 'var(--ink2)',
                        fontWeight: 600,
                        fontSize: '11.5px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      Le {formatShortFrenchDate(selectedDate)} uniquement
                    </button>
                  </div>
                </div>
              )}

              <div className="sum">
                <div>
                  <small>Total encaissé</small>
                  <b className="pos">+{formatDT(totalIn)} DT</b>
                </div>
                <div>
                  <small>Total sorti</small>
                  <b className="neg">−{formatDT(totalOut)} DT</b>
                </div>
              </div>

              {isLoadingExtrait ? (
                <div className="py-12 text-center text-sm text-[var(--ink3)]">
                  Chargement des transactions...
                </div>
              ) : statementRows.length === 0 ? (
                <div className="py-12 text-center text-sm text-[var(--ink3)] border border-[var(--line)] rounded-xl">
                  Aucun mouvement enregistré pour ce portefeuille.
                </div>
              ) : (
                <div className="tx">
                  <div className="tr h">
                    <span>Date</span>
                    <span>Opération</span>
                    <span style={{ textAlign: 'right' }}>Montant</span>
                    <span style={{ textAlign: 'right' }}>Solde</span>
                  </div>
                  {statementRows.map(tx => {
                    const isNegative = (tx.amount || 0) < 0;
                    const opType = isNegative ? 'Retrait' : 'Encaissement';
                    const opColor = getOperatorColor(tx.operatorName);
                    const labelText =
                      tx.clientDetails?.note ||
                      (isNegative ? 'Retrait manuel' : `Reçu ${tx.reference || tx._id.slice(-8)}`);

                    return (
                      <div key={tx._id} className="tr">
                        <span>{fdt(tx.paymentDate || tx.createdAt)}</span>
                        <span>
                          {opType}
                          <small>
                            {labelText} ·{' '}
                            <span
                              className="by"
                              style={{ '--u': opColor } as React.CSSProperties}
                            >
                              {tx.operatorName || 'Elios'}
                            </span>
                          </small>
                        </span>
                        <span className={`m ${isNegative ? 'neg' : 'pos'}`}>
                          {isNegative ? '−' : '+'}
                          {formatDT(Math.abs(tx.amount))}
                        </span>
                        <span className="s">{formatDT(tx.runningBalance || 0)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="df no-print">
              <button type="button" className="btn" onClick={closeExtrait}>
                Fermer
              </button>
              <button
                type="button"
                className="btn pri"
                onClick={handleDownloadExtraitImage}
                disabled={isDownloadingExtrait || isLoadingExtrait}
                style={{ minWidth: '150px', cursor: isDownloadingExtrait ? 'wait' : 'pointer' }}
              >
                {isDownloadingExtrait ? (
                  <>
                    <svg className="i" style={{ animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"/>
                      <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                    </svg>
                    Téléchargement...
                  </>
                ) : (
                  <>
                    <svg className="i" viewBox="0 0 24 24">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Télécharger
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CONTAINER HAUTE RÉSOLUTION POUR TÉLÉCHARGEMENT DU REÇU / EXTRAIT (PNG 3X SANS COUPURE)
          ========================================================================= */}
      {extraitWallet && (
        <div
          ref={exportTicketRef}
          style={{
            position: 'fixed',
            left: '0px',
            top: '0px',
            width: '800px',
            minHeight: 'fit-content',
            backgroundColor: '#ffffff',
            color: '#1F2937',
            fontFamily: '"DM Sans", system-ui, -apple-system, sans-serif',
            padding: '48px 44px 38px 44px',
            borderRadius: '0px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '22px',
            zIndex: -9999,
            pointerEvents: 'none',
            visibility: 'visible',
            opacity: 1,
          }}
        >
          {/* En-tête officiel */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #F3F4F6', paddingBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img
                src="/LogoReceipt.png"
                alt="Elios Academy"
                style={{ height: '54px', width: 'auto', maxHeight: '58px', objectFit: 'contain', display: 'block' }}
              />
              <div style={{ borderLeft: '1px solid #E5E7EB', paddingLeft: '14px' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#111827', letterSpacing: '-0.3px', display: 'block' }}>
                  Elios Workspace
                </span>
                <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>
                  Gestion & Trésorerie Sécurisée
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  display: 'inline-block',
                  background: '#F3F4F6',
                  color: '#374151',
                  border: '1px solid #E5E7EB',
                  padding: '4px 12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                }}
              >
                {selectedDate ? `Extrait au ${formatShortFrenchDate(selectedDate)}` : 'Extrait de compte'}
              </span>
              <p style={{ margin: 0, fontSize: '12px', color: '#6B7280', textAlign: 'center' }}>
                Émis le : <b>{fdt(new Date())}</b>
              </p>
            </div>
          </div>

          {/* Bannière du Portefeuille avec Dégradé */}
          <div
            style={{
              background: `linear-gradient(135deg, ${getWalletGrads(extraitWallet.mode, extraitWallet.details).g1}, ${getWalletGrads(extraitWallet.mode, extraitWallet.details).g2})`,
              borderRadius: '14px',
              padding: '20px 24px',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            <div>
              <span style={{ fontSize: '10.5px', fontFamily: 'monospace', letterSpacing: '1.6px', opacity: 0.85 }}>
                PORTEFEUILLE ACTIF
              </span>
              <h3 style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 800, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                {extraitWallet.mode} - {extraitWallet.details || 'NON SPÉCIFIÉ'}
              </h3>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '10.5px', fontFamily: 'monospace', letterSpacing: '1.4px', opacity: 0.85, display: 'block' }}>
                {selectedDate ? `BALANCE AU ${formatShortFrenchDate(selectedDate).toUpperCase()}` : 'SOLDE COURANT'}
              </span>
              <b style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', fontFamily: 'monospace' }}>
                {formatDT(selectedDate ? (extraitWallet.totalAmount) : (extraitWallet.currentTotalAmount ?? extraitWallet.totalAmount))} <span style={{ fontSize: '16px', fontWeight: 600 }}>DT</span>
              </b>
            </div>
          </div>

          {/* Résumé des totaux */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '12px', padding: '14px 18px' }}>
              <span style={{ display: 'block', fontSize: '12px', color: '#065F46', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Encaissé
              </span>
              <b style={{ fontSize: '22px', fontWeight: 800, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                +{formatDT(totalIn)} DT
              </b>
            </div>
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '14px 18px' }}>
              <span style={{ display: 'block', fontSize: '12px', color: '#991B1B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Sorti (Retraits)
              </span>
              <b style={{ fontSize: '22px', fontWeight: 800, color: '#DC2626', fontVariantNumeric: 'tabular-nums' }}>
                −{formatDT(totalOut)} DT
              </b>
            </div>
          </div>

          {/* Tableau de toutes les transactions sans limitation de hauteur */}
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 2.4fr 1fr 1fr',
                padding: '12px 18px',
                background: '#F9FAFB',
                borderBottom: '1px solid #E5E7EB',
                fontSize: '12px',
                fontWeight: 700,
                color: '#4B5563',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              <span>Date</span>
              <span>Opération & Libellé</span>
              <span style={{ textAlign: 'right' }}>Montant</span>
              <span style={{ textAlign: 'right' }}>Solde</span>
            </div>
            {statementRows.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#9CA3AF', fontSize: '14px' }}>
                Aucune opération enregistrée pour ce portefeuille.
              </div>
            ) : (
              statementRows.map((tx, idx) => {
                const isNegative = (tx.amount || 0) < 0;
                const opType = isNegative ? 'Retrait' : 'Encaissement';
                const labelText =
                  tx.clientDetails?.note ||
                  (isNegative ? 'Retrait manuel' : `Reçu ${tx.reference || tx._id.slice(-8)}`);

                return (
                  <div
                    key={tx._id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 2.4fr 1fr 1fr',
                      padding: '12px 18px',
                      alignItems: 'center',
                      borderBottom: idx === statementRows.length - 1 ? 'none' : '1px solid #F3F4F6',
                      background: idx % 2 === 0 ? '#ffffff' : '#FAFAFA',
                      fontSize: '13.5px',
                    }}
                  >
                    <span style={{ color: '#4B5563', fontSize: '13px' }}>
                      {fdt(tx.paymentDate || tx.createdAt)}
                    </span>
                    <span style={{ color: '#111827' }}>
                      <span style={{ fontWeight: 700 }}>{opType}</span>
                      {labelText && (
                        <small style={{ display: 'block', color: '#6B7280', fontSize: '12px', marginTop: '2px' }}>
                          {labelText}
                        </small>
                      )}
                    </span>
                    <span
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color: isNegative ? '#DC2626' : '#059669',
                      }}
                    >
                      {isNegative ? '−' : '+'}
                      {formatDT(Math.abs(tx.amount))} DT
                    </span>
                    <span
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        color: '#374151',
                      }}
                    >
                      {formatDT(tx.runningBalance || 0)} DT
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Bas de page officiel */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E5E7EB', paddingTop: '16px', fontSize: '11.5px', color: '#9CA3AF' }}>
            <span>Document certifié conforme · Trésorerie Elios Workspace</span>
            <span>Total mouvements : {statementRows.length}</span>
          </div>
        </div>
      )}

      {/* =========================================================================
          POPUP 4: REMISE À ZÉRO MODAL
          ========================================================================= */}
      {resetWallet && (
        <div
          className="modal-overlay"
          onClick={e => {
            if (e.target === e.currentTarget && !isResetting) closeReset();
          }}
        >
          <div className="modal-dialog">
            <div className="dh" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <span
                  className="mw"
                  style={{
                    '--g1': getWalletGrads(resetWallet.mode, resetWallet.details).g1,
                    '--g2': getWalletGrads(resetWallet.mode, resetWallet.details).g2,
                  } as React.CSSProperties}
                />
                <div style={{ textAlign: 'left', minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--ink)' }}>
                    Remise à zéro
                  </h2>
                  <small style={{ display: 'block', color: 'var(--ink2)', fontSize: '13px', marginTop: '2px' }}>
                    {resetWallet.mode} - {resetWallet.details} · solde {formatDT(resetWallet.totalAmount)} DT
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="x"
                onClick={closeReset}
                disabled={isResetting}
                aria-label="Fermer"
              >
                <svg className="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
              </button>
            </div>
            <form onSubmit={handleConfirmReset} noValidate>
              <div className="db">
                <p className="note">
                  {resetWallet.totalAmount > 0 ? (
                    <>
                      Le solde de <b>{formatDT(resetWallet.totalAmount)} DT</b> sera remis à zéro.
                      Cette action effectuera une purge définitive : tous les reçus liés et leurs fichiers Drive seront effacés.
                    </>
                  ) : (
                    'Le solde de ce portefeuille est déjà à zéro.'
                  )}
                </p>
                {resetWallet.totalAmount > 0 && (
                  <label>
                    Code PIN
                    <input
                      className="pin"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="off"
                      placeholder="••••"
                      value={resetPin}
                      onChange={e => {
                        setResetPin(e.target.value);
                        setResetError('');
                      }}
                      autoFocus
                    />
                  </label>
                )}
                {resetError && <p className="err" role="alert">{resetError}</p>}
              </div>
              <div className="df">
                <button
                  type="button"
                  className="btn"
                  onClick={closeReset}
                  disabled={isResetting}
                >
                  Annuler
                </button>
                <button
                  className="btn dng"
                  type="submit"
                  disabled={isResetting || (resetWallet.totalAmount > 0 && !resetPin)}
                >
                  {isResetting ? 'Réinitialisation...' : 'Remettre à zéro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          POPUP 5: CHANGER LE CODE PIN MODAL
          ========================================================================= */}
      {isChangePinOpen && (
        <div
          className="modal-overlay"
          onClick={e => {
            if (e.target === e.currentTarget && !isSubmittingChangePin) setIsChangePinOpen(false);
          }}
        >
          <div className="modal-dialog">
            <div className="dh" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <div
                  style={{
                    width: 44,
                    height: 30,
                    borderRadius: 7,
                    background: 'linear-gradient(135deg, #4F46E5, #312E81)',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#fff',
                    flex: 'none',
                    boxShadow: 'var(--shadow)',
                  }}
                >
                  <svg className="i" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                    <circle cx="8" cy="15" r="4"/>
                    <path d="m11 12 9-9M16 7l3 3M14 9l2 2"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'left', minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--ink)' }}>
                    Changer le code PIN
                  </h2>
                  <small style={{ display: 'block', color: 'var(--ink2)', fontSize: '13px', marginTop: '2px' }}>
                    Le PIN protège les retraits et remises à zéro (6 chiffres)
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="x"
                onClick={() => setIsChangePinOpen(false)}
                disabled={isSubmittingChangePin}
                aria-label="Fermer"
              >
                <svg className="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
              </button>
            </div>
            <form onSubmit={handleConfirmChangePin} noValidate>
              <div className="db">
                <label>
                  PIN actuel (ou phrase secrète)
                  <input
                    className="pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={30}
                    autoComplete="off"
                    placeholder="••••••"
                    value={changeOldPin}
                    onChange={e => {
                      setChangeOldPin(e.target.value);
                      setChangePinError('');
                    }}
                    autoFocus
                  />
                </label>
                <label>
                  Nouveau PIN (6 chiffres)
                  <input
                    className="pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="off"
                    placeholder="••••••"
                    value={changeNewPin}
                    onChange={e => {
                      setChangeNewPin(e.target.value.replace(/\D/g, ''));
                      setChangePinError('');
                    }}
                  />
                </label>
                <label>
                  Confirmer le nouveau PIN (6 chiffres)
                  <input
                    className="pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="off"
                    placeholder="••••••"
                    value={changeConfirmPin}
                    onChange={e => {
                      setChangeConfirmPin(e.target.value.replace(/\D/g, ''));
                      setChangePinError('');
                    }}
                  />
                </label>
                {changePinError && <p className="err" role="alert">{changePinError}</p>}
              </div>
              <div className="df">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsChangePinOpen(false)}
                  disabled={isSubmittingChangePin}
                >
                  Annuler
                </button>
                <button
                  className="btn pri"
                  type="submit"
                  disabled={isSubmittingChangePin || !changeOldPin || !changeNewPin || !changeConfirmPin}
                >
                  {isSubmittingChangePin ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
