"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { EliosHeader } from '@/components/EliosHeader';
import { useToast } from '@/components/Toast';
import { THEMES, getThemeColors, Operator } from '@/types';
import { PaymentMethod, WhatsAppTemplates, DEFAULT_PAYMENT_METHODS, DEFAULT_WHATSAPP_TEMPLATES } from '@/types/settings';
import { formatPaymentMethodsForWhatsApp, buildApprovedProspectMessage, buildNaMessage } from '@/lib/whatsappHelper';

const fetcher = (url: string) => fetch(url).then(res => res.ok ? res.json() : null);

export default function SettingsPage() {
  const { toast } = useToast();
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'payments' | 'whatsapp' | 'operators'>('payments');

  // 1. Initialisation utilisateur actif
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

  // 2. Gestion des Modes de Paiement
  const hasLoadedPaymentsRef = useRef(false);
  const { data: paymentsData, mutate: mutatePayments } = useSWR<{ methods: PaymentMethod[] }>(
    '/api/settings/payments',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const [methods, setMethods] = useState<PaymentMethod[]>(DEFAULT_PAYMENT_METHODS);
  const [isSavingPayments, setIsSavingPayments] = useState(false);
  const [hasUnsavedPaymentChanges, setHasUnsavedPaymentChanges] = useState(false);

  useEffect(() => {
    if (paymentsData?.methods && Array.isArray(paymentsData.methods)) {
      if (!hasLoadedPaymentsRef.current) {
        setMethods(paymentsData.methods);
        hasLoadedPaymentsRef.current = true;
      }
    }
  }, [paymentsData]);

  const activeWhatsAppPreview = useMemo(() => {
    return formatPaymentMethodsForWhatsApp(methods);
  }, [methods]);

  const handleSavePayments = async (methodsToSave?: PaymentMethod[]) => {
    const listToSave = methodsToSave || methods;
    try {
      setIsSavingPayments(true);
      const res = await fetch('/api/settings/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ methods: listToSave })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erreur lors de la sauvegarde');
      }
      const data = await res.json();
      if (data?.methods && Array.isArray(data.methods)) {
        setMethods(data.methods);
        await mutatePayments(data, false);
      }
      setHasUnsavedPaymentChanges(false);
      toast({ message: 'Modes de paiement enregistrés avec succès !', tone: 'ok' });
      return true;
    } catch (err: any) {
      toast({ message: err.message || 'Erreur lors de la sauvegarde des paiements', tone: 'warn' });
      return false;
    } finally {
      setIsSavingPayments(false);
    }
  };

  const handleMoveMethod = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= methods.length) return;
    const updated = [...methods];
    const item = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = item;
    setMethods(updated);
    await handleSavePayments(updated);
  };

  const handleToggleMethod = async (id: string) => {
    const updated = methods.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m);
    setMethods(updated);
    await handleSavePayments(updated);
  };

  const handleUpdateField = (id: string, field: keyof PaymentMethod, val: any) => {
    setMethods(prev => prev.map(m => m.id === id ? { ...m, [field]: val } : m));
    setHasUnsavedPaymentChanges(true);
  };

  const handleDeleteMethod = async (id: string) => {
    if (methods.length <= 1) {
      toast({ message: 'Vous devez conserver au moins un mode de paiement', tone: 'warn' });
      return;
    }
    const updated = methods.filter(m => m.id !== id);
    setMethods(updated);
    // Sauvegarde immédiate et définitive en base de données
    await handleSavePayments(updated);
    toast({ message: 'Mode supprimé et enregistré en base !', tone: 'ok' });
  };

  const handleAddMethod = () => {
    const newId = `method_${Date.now()}`;
    const newMethod: PaymentMethod = {
      id: newId,
      enabled: true,
      label: 'Bank',
      account: '',
      holder: '',
      bank: ''
    };
    setMethods(prev => [...prev, newMethod]);
    setHasUnsavedPaymentChanges(true);
  };

  const handleResetMethods = async () => {
    if (window.confirm('Restaurer la liste des modes de paiement par défaut ?')) {
      setMethods(DEFAULT_PAYMENT_METHODS);
      await handleSavePayments(DEFAULT_PAYMENT_METHODS);
    }
  };

  // 3. Gestion des Modèles WhatsApp
  const hasLoadedWhatsAppRef = useRef(false);
  const { data: whatsappData, mutate: mutateWhatsApp } = useSWR<{ templates: WhatsAppTemplates }>(
    '/api/settings/whatsapp',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const [approvedHeader, setApprovedHeader] = useState(DEFAULT_WHATSAPP_TEMPLATES.approvedProspectHeader);
  const [approvedFooter, setApprovedFooter] = useState(DEFAULT_WHATSAPP_TEMPLATES.approvedProspectFooter);
  const [naMessage, setNaMessage] = useState(DEFAULT_WHATSAPP_TEMPLATES.naMessage);
  const [isSavingWhatsApp, setIsSavingWhatsApp] = useState(false);

  useEffect(() => {
    if (whatsappData?.templates) {
      if (!hasLoadedWhatsAppRef.current) {
        setApprovedHeader(whatsappData.templates.approvedProspectHeader || DEFAULT_WHATSAPP_TEMPLATES.approvedProspectHeader);
        setApprovedFooter(whatsappData.templates.approvedProspectFooter || DEFAULT_WHATSAPP_TEMPLATES.approvedProspectFooter);
        setNaMessage(whatsappData.templates.naMessage || DEFAULT_WHATSAPP_TEMPLATES.naMessage);
        hasLoadedWhatsAppRef.current = true;
      }
    }
  }, [whatsappData]);

  const handleSaveWhatsApp = async () => {
    try {
      setIsSavingWhatsApp(true);
      const res = await fetch('/api/settings/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvedProspectHeader: approvedHeader,
          approvedProspectFooter: approvedFooter,
          naMessage: naMessage
        })
      });
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde des modèles');
      const data = await res.json();
      await mutateWhatsApp(data, false);
      toast({ message: 'Modèles WhatsApp enregistrés !', tone: 'ok' });
    } catch (err: any) {
      toast({ message: err.message || 'Erreur lors de la sauvegarde des modèles', tone: 'warn' });
    } finally {
      setIsSavingWhatsApp(false);
    }
  };

  // 4. Gestion des Opérateurs
  const { data: operatorsData, mutate: mutateOperators } = useSWR<Operator[]>('/api/operators', fetcher);
  const operators = useMemo(() => Array.isArray(operatorsData) ? operatorsData : [], [operatorsData]);

  const [newOpName, setNewOpName] = useState('');
  const [newOpTheme, setNewOpTheme] = useState('indigo');
  const [isSubmittingOp, setIsSubmittingOp] = useState(false);

  const handleCreateOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpName.trim()) return;

    try {
      setIsSubmittingOp(true);
      const res = await fetch('/api/operators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newOpName.trim(), theme: newOpTheme })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur création opérateur');
      toast({ message: 'Opérateur ajouté avec succès', tone: 'ok' });
      setNewOpName('');
      mutateOperators();
    } catch (err: any) {
      toast({ message: err.message, tone: 'warn' });
    } finally {
      setIsSubmittingOp(false);
    }
  };

  const handleDeleteOperator = async (id: string, name: string) => {
    if (!window.confirm(`Supprimer définitivement l'opérateur « ${name} » ?`)) return;
    try {
      const res = await fetch(`/api/operators/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast({ message: 'Opérateur supprimé', tone: 'ok' });
      mutateOperators();
    } catch {
      toast({ message: 'Erreur lors de la suppression', tone: 'warn' });
    }
  };

  return (
    <div data-page="settings" className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col">
      <EliosHeader 
        crumb="Paramètres" 
        activeUser={activeUser} 
        setActiveUser={handleUserChange} 
      />

      {/* Bandeau Vague Signature Elios */}
      <div className="cover" aria-hidden="true">
        <svg viewBox="0 0 800 44" preserveAspectRatio="none">
          <g fill="none" stroke="#fff" strokeWidth="1.2">
            <path d="M0 30C120 8 220 40 360 22S580 6 800 26" />
            <path d="M0 38C140 18 240 44 380 30S600 14 800 34" />
          </g>
        </svg>
      </div>

      <main className="page">
        {/* En-tête de la page */}
        <div className="settings-header">
          <div className="settings-header-left">
            <div 
              className="pageicon" 
              style={{ 
                background: 'color-mix(in srgb, var(--pri) 15%, transparent)', 
                color: 'var(--pri)' 
              }}
            >
              <svg className="i" viewBox="0 0 24 24" style={{ width: 28, height: 28 }}>
                <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink)]">
                Paramètres
              </h1>
              <p className="sub text-xs sm:text-sm text-[var(--ink2)] mt-0.5">
                Modes de paiement WhatsApp, modèles de relance automatique et profils d'opérateurs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button 
              type="button" 
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-elios-welcome'));
              }} 
              className="btn inline-flex items-center gap-1.5"
              title="Tester l'affichage de la modale d'accueil quotidienne (24h)"
            >
              <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
              <span>Aperçu Accueil 24h</span>
            </button>

            <Link href="/" className="btn inline-flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                <path d="m15 18-6-6 6-6"/>
              </svg>
              <span>Retour à l'accueil</span>
            </Link>
          </div>
        </div>

        {/* Barre d'onglets épurée & responsive */}
        <div className="settings-tabs-bar">
          <button 
            type="button" 
            className={`settings-tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
            onClick={() => setActiveTab('payments')}
          >
            <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
            <span>Modes de Paiement ({methods.length})</span>
          </button>

          <button 
            type="button" 
            className={`settings-tab-btn ${activeTab === 'whatsapp' ? 'active' : ''}`}
            onClick={() => setActiveTab('whatsapp')}
          >
            <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Modèles WhatsApp</span>
          </button>

          <button 
            type="button" 
            className={`settings-tab-btn ${activeTab === 'operators' ? 'active' : ''}`}
            onClick={() => setActiveTab('operators')}
          >
            <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>Opérateurs ({operators.length})</span>
          </button>
        </div>

        {/* ========================================================
            ONGLET 1 : GESTION DES MODES DE PAIEMENT
            ======================================================== */}
        {activeTab === 'payments' && (
          <div className="mt-5 flex flex-col gap-5 w-full min-w-0">
            <div className="settings-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5">
                <div className="min-w-0">
                  <small style={{ color: 'var(--pri)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    MODES DE PAIEMENT
                  </small>
                  <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] mt-1">
                    {methods.length} mode(s) configuré(s)
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--ink2)] mt-0.5">
                    L'ordre ci-dessous est l'ordre affiché dans le message WhatsApp. Seuls les modes activés sont envoyés.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button 
                    type="button" 
                    className="btn text-xs sm:text-sm py-1.5 px-3 flex-1 sm:flex-initial justify-center"
                    onClick={handleResetMethods}
                    title="Restaurer la liste par défaut"
                  >
                    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                    </svg>
                    <span>Restaurer</span>
                  </button>

                  <button 
                    type="button" 
                    className="btn text-xs sm:text-sm py-1.5 px-3 flex-1 sm:flex-initial justify-center"
                    onClick={handleAddMethod}
                  >
                    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    <span>Ajouter un mode</span>
                  </button>

                  <button 
                    type="button" 
                    className={`btn pri text-xs sm:text-sm font-semibold py-1.5 px-3.5 flex-1 sm:flex-initial justify-center shadow-xs ${hasUnsavedPaymentChanges ? 'ring-2 ring-[var(--pri)]/50' : ''}`}
                    onClick={() => handleSavePayments()}
                    disabled={isSavingPayments}
                  >
                    {isSavingPayments ? 'Enregistrement...' : '💾 Enregistrer'}
                  </button>
                </div>
              </div>

              {/* Liste ordonnable des modes de paiement */}
              <div className="flex flex-col gap-3.5 w-full min-w-0">
                {methods.map((m, idx) => (
                  <div 
                    key={m.id}
                    className="p-3.5 sm:p-4 rounded-2xl border border-[var(--line)] transition shadow-2xs w-full min-w-0 box-border"
                    style={{
                      background: m.enabled ? 'var(--card)' : 'color-mix(in srgb, var(--hover) 60%, var(--card))',
                    }}
                  >
                    {/* Ligne haute : Boutons Déplacement + Switch Toggle + Supprimer */}
                    <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveMethod(idx, 'up')}
                            className="w-6 h-6 rounded-md border border-[var(--line)] bg-[var(--hover)] flex items-center justify-center text-xs disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--card)] transition"
                            title="Monter"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={idx === methods.length - 1}
                            onClick={() => handleMoveMethod(idx, 'down')}
                            className="w-6 h-6 rounded-md border border-[var(--line)] bg-[var(--hover)] flex items-center justify-center text-xs disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--card)] transition"
                            title="Descendre"
                          >
                            ▼
                          </button>
                        </div>

                        {/* Toggle Activé / Désactivé */}
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={m.enabled} 
                            onChange={() => handleToggleMethod(m.id)}
                            className="w-4 h-4 accent-[var(--pri)] cursor-pointer"
                          />
                          <span className={`text-xs sm:text-sm font-semibold ${m.enabled ? 'text-[var(--pri)]' : 'text-[var(--ink3)]'}`}>
                            {m.enabled ? 'Activé' : 'Désactivé'}
                          </span>
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteMethod(m.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--bad)] hover:bg-red-500/10 px-2 py-1 rounded-md transition"
                      >
                        <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        <span>Supprimer</span>
                      </button>
                    </div>

                    {/* Grille responsive des 4 champs */}
                    <div className="payment-fields-grid">
                      <div className="min-w-0">
                        <small className="block text-[11px] font-bold text-[var(--ink3)] mb-1 uppercase tracking-wide">
                          LABEL
                        </small>
                        <input
                          type="text"
                          required
                          value={m.label}
                          onChange={(e) => handleUpdateField(m.id, 'label', e.target.value)}
                          placeholder="Ex: Par Poste, D17, Bank..."
                          className="w-full py-2 px-3 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] text-xs sm:text-sm font-medium box-border"
                        />
                      </div>

                      <div className="min-w-0">
                        <small className="block text-[11px] font-bold text-[var(--ink3)] mb-1 uppercase tracking-wide">
                          COMPTE / RIB
                        </small>
                        <input
                          type="text"
                          required
                          value={m.account}
                          onChange={(e) => handleUpdateField(m.id, 'account', e.target.value)}
                          placeholder="Numéro de RIB ou de compte"
                          className="w-full py-2 px-3 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] text-xs sm:text-sm font-semibold box-border"
                        />
                      </div>

                      <div className="min-w-0">
                        <small className="block text-[11px] font-bold text-[var(--ink3)] mb-1 uppercase tracking-wide">
                          AU NOM DE (TITULAIRE)
                        </small>
                        <input
                          type="text"
                          value={m.holder || ''}
                          onChange={(e) => handleUpdateField(m.id, 'holder', e.target.value)}
                          placeholder="Optionnel (ex: ELIOS ACADEMY)"
                          className="w-full py-2 px-3 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] text-xs sm:text-sm box-border"
                        />
                      </div>

                      <div className="min-w-0">
                        <small className="block text-[11px] font-bold text-[var(--ink3)] mb-1 uppercase tracking-wide">
                          BANQUE
                        </small>
                        <input
                          type="text"
                          value={m.bank || ''}
                          onChange={(e) => handleUpdateField(m.id, 'bank', e.target.value)}
                          placeholder="Optionnel (ex: El Baraka, ATB)"
                          className="w-full py-2 px-3 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] text-xs sm:text-sm box-border"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pied de liste : Sauvegarde et statut */}
              <div className="mt-4 pt-3.5 border-t border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-[var(--ink3)]">
                  {hasUnsavedPaymentChanges ? (
                    <span className="text-amber-500 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      Modifications en attente d'enregistrement
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Tous les modes sont enregistrés et synchronisés
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn text-xs sm:text-sm py-1.5 px-3 w-full sm:w-auto justify-center"
                    onClick={() => {
                      setMethods(paymentsData?.methods || DEFAULT_PAYMENT_METHODS);
                      setHasUnsavedPaymentChanges(false);
                    }}
                    disabled={isSavingPayments || !hasUnsavedPaymentChanges}
                  >
                    Annuler
                  </button>

                  <button
                    type="button"
                    className="btn pri text-xs sm:text-sm font-semibold py-1.5 px-4 w-full sm:w-auto justify-center shadow-xs"
                    onClick={() => handleSavePayments()}
                    disabled={isSavingPayments}
                  >
                    {isSavingPayments ? 'Enregistrement...' : '💾 Enregistrer les modifications'}
                  </button>
                </div>
              </div>
            </div>

            {/* Aperçu WhatsApp en temps réel */}
            <div className="settings-card">
              <small style={{ color: 'var(--pri)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                APERÇU WHATSAPP
              </small>
              <h3 className="text-base sm:text-lg font-bold text-[var(--ink)] mt-1">
                Rendu dynamique des modes actifs
              </h3>
              <p className="text-xs sm:text-sm text-[var(--ink2)] mt-0.5 mb-3.5">
                Cet aperçu reflète exactement ce qui est injecté dans le message envoyé aux élèves au statut Approved Prospect.
              </p>

              <div className="whatsapp-preview-box">
                {activeWhatsAppPreview}
              </div>

              {/* Bouton de sauvegarde */}
              <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-end gap-2.5">
                <button
                  type="button"
                  className="btn text-xs sm:text-sm py-2 px-4 w-full sm:w-auto justify-center"
                  onClick={() => setMethods(paymentsData?.methods || DEFAULT_PAYMENT_METHODS)}
                  disabled={isSavingPayments}
                >
                  Annuler les modifications
                </button>

                <button
                  type="button"
                  className="btn pri text-xs sm:text-sm font-semibold py-2 px-5 w-full sm:w-auto justify-center"
                  onClick={() => handleSavePayments()}
                  disabled={isSavingPayments}
                >
                  {isSavingPayments ? 'Sauvegarde...' : '💾 Sauvegarder les modes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            ONGLET 2 : MODÈLES WHATSAPP (APPROVED & N/A)
            ======================================================== */}
        {activeTab === 'whatsapp' && (
          <div className="mt-5 flex flex-col gap-5 w-full min-w-0">
            <div className="settings-card">
              <small style={{ color: 'var(--pri)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                MODÈLE 1 : APPROVED PROSPECT
              </small>
              <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] mt-1">
                Message de validation des modes de paiement
              </h2>
              <p className="text-xs sm:text-sm text-[var(--ink2)] mt-0.5 mb-4">
                Ce modèle est déclenché automatiquement lorsqu'un prospect passe au statut « Approved Prospect ». Utilisez <code>{'{nom}'}</code> pour injecter dynamiquement le nom de l'élève.
              </p>

              <div className="flex flex-col gap-3.5 w-full min-w-0">
                <div className="w-full min-w-0">
                  <label className="block text-xs sm:text-sm font-semibold text-[var(--ink2)] mb-1">
                    En-tête du message (avant la liste des modes) :
                  </label>
                  <textarea
                    rows={3}
                    value={approvedHeader}
                    onChange={(e) => setApprovedHeader(e.target.value)}
                    className="w-full p-2.5 sm:p-3 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] text-xs sm:text-sm leading-relaxed box-border resize-y"
                  />
                </div>

                <div className="w-full min-w-0">
                  <label className="block text-xs sm:text-sm font-semibold text-[var(--ink2)] mb-1">
                    Pied du message (après la liste des modes) :
                  </label>
                  <textarea
                    rows={2}
                    value={approvedFooter}
                    onChange={(e) => setApprovedFooter(e.target.value)}
                    className="w-full p-2.5 sm:p-3 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] text-xs sm:text-sm leading-relaxed box-border resize-y"
                  />
                </div>

                {/* Prévisualisation globale */}
                <div className="w-full min-w-0 mt-1">
                  <small className="block text-[11px] font-bold text-[var(--ink3)] uppercase mb-1 tracking-wide">
                    Aperçu complet du message envoyé :
                  </small>
                  <div className="whatsapp-preview-box">
                    {buildApprovedProspectMessage(approvedHeader, approvedFooter, '{Nom de l\'élève}', methods)}
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-card">
              <small style={{ color: 'var(--pri)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                MODÈLE 2 : STATUT N/A (PAS DE RÉPONSE)
              </small>
              <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] mt-1">
                Message de relance automatique N/A
              </h2>
              <p className="text-xs sm:text-sm text-[var(--ink2)] mt-0.5 mb-4">
                Déclenché lorsqu'un élève passe au statut « N/A ». Utilisez <code>{'{nom}'}</code> pour injecter dynamiquement le nom de l'élève.
              </p>

              <div className="w-full min-w-0">
                <label className="block text-xs sm:text-sm font-semibold text-[var(--ink2)] mb-1">
                  Contenu du message de relance :
                </label>
                <textarea
                  rows={5}
                  value={naMessage}
                  onChange={(e) => setNaMessage(e.target.value)}
                  className="w-full p-2.5 sm:p-3 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] text-xs sm:text-sm leading-relaxed box-border resize-y"
                />
              </div>

              {/* Prévisualisation N/A */}
              <div className="w-full min-w-0 mt-3.5">
                <small className="block text-[11px] font-bold text-[var(--ink3)] uppercase mb-1 tracking-wide">
                  Aperçu du message N/A :
                </small>
                <div className="whatsapp-preview-box">
                  {buildNaMessage(naMessage, '{Nom de l\'élève}')}
                </div>
              </div>

              {/* Bouton de sauvegarde */}
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  className="btn pri text-xs sm:text-sm font-semibold py-2 px-5 w-full sm:w-auto justify-center"
                  onClick={handleSaveWhatsApp}
                  disabled={isSavingWhatsApp}
                >
                  {isSavingWhatsApp ? 'Sauvegarde...' : '💾 Sauvegarder les modèles'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            ONGLET 3 : ADMINISTRATION DES OPÉRATEURS
            ======================================================== */}
        {activeTab === 'operators' && (
          <div className="mt-5 flex flex-col gap-5 w-full min-w-0">
            <div className="settings-card">
              <small style={{ color: 'var(--pri)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ÉQUIPE & COLLABORATEURS
              </small>
              <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] mt-1">
                Ajouter un nouvel opérateur
              </h2>
              <p className="text-xs sm:text-sm text-[var(--ink2)] mt-0.5 mb-4">
                Chaque opérateur dispose de sa couleur signature pour l'attribution des tâches, reçus et dossiers CRM.
              </p>

              <form onSubmit={handleCreateOperator}>
                <div className="operator-form-grid">
                  <div className="min-w-0">
                    <label className="block text-xs sm:text-sm font-semibold text-[var(--ink2)] mb-1">
                      Nom de l'opérateur
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Sarah, Mehdi..."
                      value={newOpName}
                      onChange={(e) => setNewOpName(e.target.value)}
                      className="w-full py-2 px-3 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] text-xs sm:text-sm box-border"
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="block text-xs sm:text-sm font-semibold text-[var(--ink2)] mb-1">
                      Thème de couleur signature
                    </label>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {Object.entries(THEMES).map(([key, t]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setNewOpTheme(key)}
                          className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-semibold cursor-pointer transition select-none"
                          style={{
                            border: newOpTheme === key ? `2px solid ${t.dot}` : '1px solid var(--line)',
                            background: newOpTheme === key ? `color-mix(in srgb, ${t.dot} 14%, var(--card))` : 'var(--hover)',
                            color: 'var(--ink)'
                          }}
                        >
                          <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: t.dot }} />
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    className="btn pri text-xs sm:text-sm font-semibold py-2 px-5 w-full sm:w-auto justify-center"
                    disabled={isSubmittingOp || !newOpName.trim()}
                  >
                    {isSubmittingOp ? 'Création...' : 'Créer l\'opérateur'}
                  </button>
                </div>
              </form>
            </div>

            {/* Liste des opérateurs existants */}
            <div className="settings-card">
              <h3 className="text-base sm:text-lg font-bold text-[var(--ink)] mb-3.5">
                Opérateurs actifs ({operators.length})
              </h3>

              <div className="operators-list-grid">
                {operators.map(op => {
                  const colors = getThemeColors(op.theme);
                  return (
                    <div 
                      key={op._id || op.name}
                      className="flex items-center justify-between p-3 rounded-xl border border-[var(--line)] bg-[var(--hover)] gap-2 min-w-0"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{
                            backgroundColor: colors.bg,
                            color: colors.fg,
                          }}
                        >
                          {op.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <b className="block text-xs sm:text-sm font-bold text-[var(--ink)] truncate">
                            {op.name}
                          </b>
                          <small className="text-[11px] text-[var(--ink3)]">
                            {colors.label}
                          </small>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="ib d shrink-0"
                        onClick={() => handleDeleteOperator(op._id, op.name)}
                        title="Supprimer cet opérateur"
                      >
                        <svg className="i" viewBox="0 0 24 24">
                          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

