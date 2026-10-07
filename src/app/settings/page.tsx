"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { EliosHeader } from '@/components/EliosHeader';
import { useToast } from '@/components/Toast';
import { THEMES, getThemeColors, Operator } from '@/types';
import { PaymentMethod, WhatsAppTemplates, DEFAULT_PAYMENT_METHODS, DEFAULT_WHATSAPP_TEMPLATES } from '@/types/settings';
import { CommunicationGroup } from '@/types/communicationGroup';
import { formatPaymentMethodsForWhatsApp, buildApprovedProspectMessage, buildNaMessage, buildGroupReminderMessage, buildTeacherReminderMessage } from '@/lib/whatsappHelper';

const fetcher = (url: string) => fetch(url).then(res => res.ok ? res.json() : null);

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownGroup {
  groupLabel?: string;
  options: DropdownOption[];
}

const LEVEL_GROUPS: DropdownGroup[] = [
  {
    groupLabel: 'Collège (Sans section)',
    options: [
      { value: '7ème de Base', label: '7ème de Base' },
      { value: '8ème de Base', label: '8ème de Base' },
      { value: '9ème de Base', label: '9ème de Base' },
    ],
  },
  {
    groupLabel: 'Lycée',
    options: [
      { value: '1ère Année', label: '1ère Année (Tronc commun)' },
      { value: '2ème Année', label: '2ème Année' },
      { value: '3ème Année', label: '3ème Année' },
      { value: 'BAC', label: 'BAC' },
    ],
  },
  {
    groupLabel: 'Formatic & Autres',
    options: [
      { value: 'Formatic', label: 'Formatic' },
      { value: 'Autre', label: 'Autre niveau' },
    ],
  },
];

const SECTION_GROUPS: DropdownGroup[] = [
  {
    options: [
      { value: 'Sans section', label: 'Sans section' },
      { value: 'Science', label: 'Science (Expérimentales)' },
      { value: 'Mathématiques', label: 'Mathématiques' },
      { value: 'Informatique', label: 'Informatique' },
      { value: 'Technique', label: 'Technique' },
      { value: 'Économie', label: 'Économie & Gestion' },
      { value: 'Lettres', label: 'Lettres' },
      { value: 'Toutes sections', label: 'Toutes sections' },
    ],
  },
];

function CustomSelect({
  value,
  onChange,
  groups,
  placeholder = 'Sélectionner...',
  disabled = false,
  disabledLabel,
}: {
  value: string;
  onChange: (val: string) => void;
  groups: DropdownGroup[];
  placeholder?: string;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  let selectedLabel = placeholder;
  for (const g of groups) {
    const found = g.options.find(o => o.value === value);
    if (found) {
      selectedLabel = found.label;
      break;
    }
  }

  if (disabled) {
    return (
      <div className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--hover)] text-[var(--ink3)] text-xs sm:text-sm font-medium flex items-center justify-between cursor-not-allowed select-none opacity-80">
        <span className="truncate">{disabledLabel || selectedLabel}</span>
        <svg className="w-4 h-4 text-[var(--ink3)] shrink-0 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-11 px-3.5 rounded-xl border transition-all text-xs sm:text-sm font-medium flex items-center justify-between bg-[var(--card)] text-[var(--ink)] cursor-pointer shadow-xs ${
          isOpen
            ? 'border-slate-500 ring-2 ring-slate-500/20'
            : 'border-[var(--line)] hover:border-slate-400'
        }`}
      >
        <span className="truncate font-semibold">{selectedLabel}</span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ml-2 ${
            isOpen ? 'rotate-180 text-slate-700 dark:text-slate-300' : ''
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-[120] left-0 right-0 mt-1.5 bg-[var(--card)] border border-[var(--line)] rounded-xl shadow-xl max-h-60 overflow-y-auto py-1 animate-in fade-in zoom-in-95 duration-150">
          {groups.map((grp, gIdx) => (
            <div key={grp.groupLabel || gIdx}>
              {grp.groupLabel && (
                <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ink3)] bg-[var(--hover)] sticky top-0 backdrop-blur-md">
                  {grp.groupLabel}
                </div>
              )}
              {grp.options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3.5 py-2 text-xs sm:text-sm font-medium flex items-center justify-between text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-slate-100 text-slate-900 font-bold'
                        : 'text-[var(--ink)] hover:bg-[var(--hover)] hover:text-slate-900'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && (
                      <svg className="w-4 h-4 text-slate-700 shrink-0 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'payments' | 'whatsapp' | 'operators' | 'groups'>('payments');

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

  // Modèle 1 : Approved Prospect (FR & AR)
  const [approvedHeader, setApprovedHeader] = useState(DEFAULT_WHATSAPP_TEMPLATES.approvedProspectHeader);
  const [approvedFooter, setApprovedFooter] = useState(DEFAULT_WHATSAPP_TEMPLATES.approvedProspectFooter);
  const [approvedHeaderAr, setApprovedHeaderAr] = useState(DEFAULT_WHATSAPP_TEMPLATES.approvedProspectHeader_ar);
  const [approvedFooterAr, setApprovedFooterAr] = useState(DEFAULT_WHATSAPP_TEMPLATES.approvedProspectFooter_ar);

  // Modèle 2 : Statut N/A (FR & AR)
  const [naMessage, setNaMessage] = useState(DEFAULT_WHATSAPP_TEMPLATES.naMessage);
  const [naMessageAr, setNaMessageAr] = useState(DEFAULT_WHATSAPP_TEMPLATES.naMessage_ar);

  // Modèle 3 : Rappel Séance Groupe Élèves (FR & AR)
  const [groupReminder, setGroupReminder] = useState(DEFAULT_WHATSAPP_TEMPLATES.groupReminder);
  const [groupReminderAr, setGroupReminderAr] = useState(DEFAULT_WHATSAPP_TEMPLATES.groupReminder_ar);

  // Modèle 4 : Rappel Enseignant (FR & AR)
  const [teacherReminder, setTeacherReminder] = useState(DEFAULT_WHATSAPP_TEMPLATES.teacherReminder);
  const [teacherReminderAr, setTeacherReminderAr] = useState(DEFAULT_WHATSAPP_TEMPLATES.teacherReminder_ar);

  // Sélecteur de langue pour chaque modèle ('fr' | 'ar')
  const [m1Lang, setM1Lang] = useState<'fr' | 'ar'>('fr');
  const [m2Lang, setM2Lang] = useState<'fr' | 'ar'>('fr');
  const [m3Lang, setM3Lang] = useState<'fr' | 'ar'>('fr');
  const [m4Lang, setM4Lang] = useState<'fr' | 'ar'>('fr');

  const [isSavingWhatsApp, setIsSavingWhatsApp] = useState(false);

  useEffect(() => {
    if (whatsappData?.templates) {
      if (!hasLoadedWhatsAppRef.current) {
        setApprovedHeader(whatsappData.templates.approvedProspectHeader || DEFAULT_WHATSAPP_TEMPLATES.approvedProspectHeader);
        setApprovedFooter(whatsappData.templates.approvedProspectFooter || DEFAULT_WHATSAPP_TEMPLATES.approvedProspectFooter);
        setApprovedHeaderAr(whatsappData.templates.approvedProspectHeader_ar || DEFAULT_WHATSAPP_TEMPLATES.approvedProspectHeader_ar);
        setApprovedFooterAr(whatsappData.templates.approvedProspectFooter_ar || DEFAULT_WHATSAPP_TEMPLATES.approvedProspectFooter_ar);

        setNaMessage(whatsappData.templates.naMessage || DEFAULT_WHATSAPP_TEMPLATES.naMessage);
        setNaMessageAr(whatsappData.templates.naMessage_ar || DEFAULT_WHATSAPP_TEMPLATES.naMessage_ar);

        setGroupReminder(whatsappData.templates.groupReminder || DEFAULT_WHATSAPP_TEMPLATES.groupReminder);
        setGroupReminderAr(whatsappData.templates.groupReminder_ar || DEFAULT_WHATSAPP_TEMPLATES.groupReminder_ar);

        setTeacherReminder(whatsappData.templates.teacherReminder || DEFAULT_WHATSAPP_TEMPLATES.teacherReminder);
        setTeacherReminderAr(whatsappData.templates.teacherReminder_ar || DEFAULT_WHATSAPP_TEMPLATES.teacherReminder_ar);

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
          approvedProspectHeader_ar: approvedHeaderAr,
          approvedProspectFooter_ar: approvedFooterAr,
          naMessage: naMessage,
          naMessage_ar: naMessageAr,
          groupReminder: groupReminder,
          groupReminder_ar: groupReminderAr,
          teacherReminder: teacherReminder,
          teacherReminder_ar: teacherReminderAr
        })
      });
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde des modèles');
      const data = await res.json();
      await mutateWhatsApp(data, false);
      toast({ message: 'Modèles WhatsApp enregistrés avec succès !', tone: 'ok' });
    } catch (err: any) {
      toast({ message: err.message || 'Erreur lors de la sauvegarde des modèles', tone: 'warn' });
    } finally {
      setIsSavingWhatsApp(false);
    }
  };

  const handleResetWhatsAppDefaults = () => {
    if (window.confirm('Voulez-vous réinitialiser tous les modèles WhatsApp aux textes par défaut (Français & Arabe) ?')) {
      setApprovedHeader(DEFAULT_WHATSAPP_TEMPLATES.approvedProspectHeader);
      setApprovedFooter(DEFAULT_WHATSAPP_TEMPLATES.approvedProspectFooter);
      setApprovedHeaderAr(DEFAULT_WHATSAPP_TEMPLATES.approvedProspectHeader_ar);
      setApprovedFooterAr(DEFAULT_WHATSAPP_TEMPLATES.approvedProspectFooter_ar);
      setNaMessage(DEFAULT_WHATSAPP_TEMPLATES.naMessage);
      setNaMessageAr(DEFAULT_WHATSAPP_TEMPLATES.naMessage_ar);
      setGroupReminder(DEFAULT_WHATSAPP_TEMPLATES.groupReminder);
      setGroupReminderAr(DEFAULT_WHATSAPP_TEMPLATES.groupReminder_ar);
      setTeacherReminder(DEFAULT_WHATSAPP_TEMPLATES.teacherReminder);
      setTeacherReminderAr(DEFAULT_WHATSAPP_TEMPLATES.teacherReminder_ar);
      toast({ message: 'Modèles par défaut rétablis (n\'oubliez pas d\'enregistrer).', tone: 'ok' });
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

  // 5. Gestion des Groupes de Communication WhatsApp Élèves (19 groupes standards)
  const hasLoadedGroupsRef = useRef(false);
  const { data: groupsData, mutate: mutateGroups } = useSWR<{ groups: CommunicationGroup[] }>(
    '/api/settings/groups',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const [groups, setGroups] = useState<CommunicationGroup[]>([]);
  const [isSavingGroups, setIsSavingGroups] = useState(false);
  const [hasUnsavedGroupChanges, setHasUnsavedGroupChanges] = useState(false);
  const [groupCategoryFilter, setGroupCategoryFilter] = useState<string>('all');
  const [groupSearchQuery, setGroupSearchQuery] = useState<string>('');
  const [savingRowCode, setSavingRowCode] = useState<string | null>(null);
  const [savedRowCode, setSavedRowCode] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ code: string; message: string } | null>(null);
  const [saveAllStatus, setSaveAllStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveAllMessage, setSaveAllMessage] = useState<string>('');

  // Modale CRUD Groupe (Création / Édition)
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CommunicationGroup | null>(null);
  const [isSubmittingGroupModal, setIsSubmittingGroupModal] = useState(false);
  const [groupFormError, setGroupFormError] = useState('');
  const [groupForm, setGroupForm] = useState({
    name: '',
    level: 'BAC',
    section: 'Sans section',
    category: 'Lycée',
    whatsappLink: '',
    description: '',
    active: true,
  });

  // Modale Suppression Sécurisée
  const [deletingGroup, setDeletingGroup] = useState<CommunicationGroup | null>(null);
  const [isDeletingGroupAction, setIsDeletingGroupAction] = useState(false);

  useEffect(() => {
    if (groupsData?.groups && Array.isArray(groupsData.groups)) {
      if (!hasLoadedGroupsRef.current) {
        setGroups(groupsData.groups);
        hasLoadedGroupsRef.current = true;
      }
    }
  }, [groupsData]);

  const handleGroupLinkChange = (code: string, newLink: string) => {
    setGroups(prev => prev.map(g => g.code === code ? { ...g, whatsappLink: newLink } : g));
    setHasUnsavedGroupChanges(true);
  };

  const handleSaveSingleGroupFromList = async (group: CommunicationGroup) => {
    try {
      setSavingRowCode(group.code);
      setRowError(null);
      const res = await fetch('/api/settings/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: group.code,
          whatsappLink: group.whatsappLink
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de la sauvegarde');
      }
      const data = await res.json();
      if (data?.groups) {
        setGroups(data.groups);
        await mutateGroups(data, false);
      }
      setSavedRowCode(group.code);
      setTimeout(() => {
        setSavedRowCode(prev => prev === group.code ? null : prev);
      }, 3500);
    } catch (err: any) {
      setRowError({ code: group.code, message: err.message || 'Erreur lors de la sauvegarde' });
      setTimeout(() => {
        setRowError(prev => prev?.code === group.code ? null : prev);
      }, 4000);
    } finally {
      setSavingRowCode(null);
    }
  };

  const handleSaveAllGroups = async () => {
    try {
      setIsSavingGroups(true);
      setSaveAllStatus('idle');
      const res = await fetch('/api/settings/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de la sauvegarde');
      }
      const data = await res.json();
      if (data?.groups) {
        setGroups(data.groups);
        await mutateGroups(data, false);
      }
      setHasUnsavedGroupChanges(false);
      setSaveAllStatus('saved');
      setSaveAllMessage('Tous les liens ont été enregistrés !');
      setTimeout(() => {
        setSaveAllStatus('idle');
      }, 4000);
    } catch (err: any) {
      setSaveAllStatus('error');
      setSaveAllMessage(err.message || 'Erreur lors de la sauvegarde');
      setTimeout(() => {
        setSaveAllStatus('idle');
      }, 4000);
    } finally {
      setIsSavingGroups(false);
    }
  };

  // CRUD Handlers
  const handleOpenCreateGroupModal = () => {
    setEditingGroup(null);
    setGroupForm({
      name: '',
      level: 'BAC',
      section: 'Sans section',
      category: 'Lycée',
      whatsappLink: '',
      description: '',
      active: true,
    });
    setGroupFormError('');
    setIsGroupModalOpen(true);
  };

  const handleOpenEditGroupModal = (grp: CommunicationGroup) => {
    setEditingGroup(grp);
    setGroupForm({
      name: grp.name || '',
      level: grp.level || 'Lycée',
      section: grp.section || 'Sans section',
      category: grp.category || 'Lycée',
      whatsappLink: grp.whatsappLink || '',
      description: grp.description || '',
      active: grp.active !== false,
    });
    setGroupFormError('');
    setIsGroupModalOpen(true);
  };

  const handleSaveGroupModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.name.trim()) {
      setGroupFormError('Le nom du groupe est obligatoire.');
      return;
    }
    if (!groupForm.level.trim()) {
      setGroupFormError('Le niveau / classe est obligatoire.');
      return;
    }

    try {
      setIsSubmittingGroupModal(true);
      setGroupFormError('');

      if (editingGroup) {
        // UPDATE (PATCH)
        const id = editingGroup._id || editingGroup.code;
        const res = await fetch(`/api/settings/groups/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: groupForm.name.trim(),
            level: groupForm.level.trim(),
            section: groupForm.section.trim(),
            category: groupForm.category.trim(),
            whatsappLink: groupForm.whatsappLink.trim(),
            description: groupForm.description.trim(),
            active: groupForm.active,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur lors de la modification');
        if (data.groups) {
          setGroups(data.groups);
          await mutateGroups(data, false);
        } else {
          mutateGroups();
        }
        toast({ message: `Groupe « ${groupForm.name.trim()} » modifié avec succès`, tone: 'ok' });
      } else {
        // CREATE (POST)
        const res = await fetch('/api/settings/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            name: groupForm.name.trim(),
            level: groupForm.level.trim(),
            section: groupForm.section.trim(),
            category: groupForm.category.trim(),
            whatsappLink: groupForm.whatsappLink.trim(),
            description: groupForm.description.trim(),
            active: groupForm.active,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur lors de la création');
        if (data.groups) {
          setGroups(data.groups);
          await mutateGroups(data, false);
        } else {
          mutateGroups();
        }
        toast({ message: `Nouveau groupe « ${groupForm.name.trim()} » ajouté !`, tone: 'ok' });
      }

      setIsGroupModalOpen(false);
    } catch (err: any) {
      setGroupFormError(err.message || 'Une erreur est survenue');
    } finally {
      setIsSubmittingGroupModal(false);
    }
  };

  const handleConfirmDeleteGroup = async () => {
    if (!deletingGroup) return;
    try {
      setIsDeletingGroupAction(true);
      const id = deletingGroup._id || deletingGroup.code;
      const res = await fetch(`/api/settings/groups/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la suppression');
      if (data.groups) {
        setGroups(data.groups);
        await mutateGroups(data, false);
      } else {
        setGroups(prev => prev.filter(g => (g._id || g.code) !== id));
        mutateGroups();
      }
      toast({ message: `Groupe « ${deletingGroup.name} » supprimé définitivement`, tone: 'ok' });
      setDeletingGroup(null);
    } catch (err: any) {
      toast({ message: err.message || 'Erreur lors de la suppression', tone: 'warn' });
    } finally {
      setIsDeletingGroupAction(false);
    }
  };

  const handleToggleGroupActive = async (group: CommunicationGroup) => {
    const newActive = !group.active;
    // Mise à jour optimiste immédiate
    setGroups(prev => prev.map(g => (g._id === group._id || g.code === group.code) ? { ...g, active: newActive } : g));
    try {
      const id = group._id || group.code;
      const res = await fetch(`/api/settings/groups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur mise à jour statut');
      if (data.groups) {
        setGroups(data.groups);
        await mutateGroups(data, false);
      }
      toast({ message: `Groupe « ${group.name} » ${newActive ? 'activé' : 'désactivé'}`, tone: 'ok' });
    } catch (err: any) {
      setGroups(prev => prev.map(g => (g._id === group._id || g.code === group.code) ? { ...g, active: group.active } : g));
      toast({ message: err.message || 'Erreur lors de la mise à jour', tone: 'warn' });
    }
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: groups.length,
      'Collège': 0,
      'Lycée': 0,
      'Formatic': 0,
      'Autre': 0,
    };
    groups.forEach(g => {
      const cat = g.category || 'Lycée';
      if (counts[cat] !== undefined) {
        counts[cat]++;
      } else {
        counts['Autre'] = (counts['Autre'] || 0) + 1;
      }
    });
    return counts;
  }, [groups]);

  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      if (groupCategoryFilter !== 'all') {
        const cat = g.category || 'Lycée';
        if (groupCategoryFilter === 'Autre') {
          if (cat === 'Collège' || cat === 'Lycée' || cat === 'Formatic') return false;
        } else if (cat !== groupCategoryFilter) {
          return false;
        }
      }
      if (groupSearchQuery.trim()) {
        const q = groupSearchQuery.trim().toLowerCase();
        const matchesName = (g.name || '').toLowerCase().includes(q);
        const matchesLevel = (g.level || '').toLowerCase().includes(q);
        const matchesSection = (g.section || '').toLowerCase().includes(q);
        const matchesDesc = (g.description || '').toLowerCase().includes(q);
        if (!matchesName && !matchesLevel && !matchesSection && !matchesDesc) return false;
      }
      return true;
    });
  }, [groups, groupCategoryFilter, groupSearchQuery]);

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

          <button 
            type="button" 
            className={`settings-tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
              <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/>
            </svg>
            <span>Groupes de Communication ({groups.length})</span>
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
            ONGLET 2 : MODÈLES WHATSAPP (BILINGUES FR & AR)
            ======================================================== */}
        {activeTab === 'whatsapp' && (
          <div className="mt-5 flex flex-col gap-6 w-full min-w-0">
            {/* Bannière explicative */}
            <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--line)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base">💬</span>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--ink)]">
                    Modèles de messages WhatsApp bilingues (Français / Arabe)
                  </h3>
                </div>
                <p className="text-xs text-[var(--ink2)] mt-1">
                  Personnalisez les messages automatiques en français et en arabe. Les balises dynamiques comme <code>{'{nom}'}</code>, <code>{'{matiere}'}</code> ou <code>{'{heure}'}</code> sont automatiquement remplacées lors de l'envoi.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                <button
                  type="button"
                  className="btn text-xs py-2 px-3 w-full sm:w-auto justify-center"
                  onClick={handleResetWhatsAppDefaults}
                  title="Rétablir les textes d'origine"
                >
                  ↺ Rétablir défauts
                </button>
                <button
                  type="button"
                  className="btn pri text-xs font-semibold py-2 px-4 w-full sm:w-auto justify-center"
                  onClick={handleSaveWhatsApp}
                  disabled={isSavingWhatsApp}
                >
                  {isSavingWhatsApp ? 'Sauvegarde...' : '💾 Sauvegarder tout'}
                </button>
              </div>
            </div>

            {/* ==================== MODÈLE 1 : APPROVED PROSPECT ==================== */}
            <div className="settings-card">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[var(--line)]">
                <div>
                  <small style={{ color: 'var(--pri)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    MODÈLE 1 : APPROVED PROSPECT
                  </small>
                  <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] mt-0.5">
                    Validation des modes de paiement
                  </h2>
                  <p className="text-xs text-[var(--ink2)] mt-0.5">
                    Déclenché lorsqu'un élève passe au statut « Approved Prospect ». La liste des modes de paiement actifs est automatiquement intercalée entre l'en-tête et le pied de page.
                  </p>
                </div>

                {/* Sélecteur de langue */}
                <div className="inline-flex p-1 rounded-xl bg-[var(--hover)] border border-[var(--line)] shrink-0 self-start">
                  <button
                    type="button"
                    onClick={() => setM1Lang('fr')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      m1Lang === 'fr'
                        ? 'bg-[var(--card)] text-[var(--pri)] shadow-sm'
                        : 'text-[var(--ink3)] hover:text-[var(--ink)]'
                    }`}
                  >
                    🇫🇷 Français
                  </button>
                  <button
                    type="button"
                    onClick={() => setM1Lang('ar')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      m1Lang === 'ar'
                        ? 'bg-[var(--card)] text-[var(--pri)] shadow-sm'
                        : 'text-[var(--ink3)] hover:text-[var(--ink)]'
                    }`}
                  >
                    🇹🇳 العربية
                  </button>
                </div>
              </div>

              {/* Badges variables dynamiques */}
              <div className="flex flex-wrap items-center gap-1.5 my-3 text-xs text-[var(--ink2)]">
                <span className="font-semibold text-[var(--ink3)] text-[11px] uppercase tracking-wider">Balises :</span>
                <span className="px-2 py-0.5 rounded-md bg-[var(--hover)] border border-[var(--line)] font-mono text-[11px] text-[var(--pri)] font-bold">
                  {'{nom}'}
                </span>
                <span className="text-[11px] text-[var(--ink3)]">(Nom complet de l'élève)</span>
              </div>

              {m1Lang === 'fr' ? (
                <div className="flex flex-col gap-3.5 w-full min-w-0">
                  <div className="w-full min-w-0">
                    <label className="block text-xs sm:text-sm font-semibold text-[var(--ink2)] mb-1">
                      En-tête du message (avant la liste des modes de paiement) :
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
                      Pied du message (après la liste des modes de paiement) :
                    </label>
                    <textarea
                      rows={2}
                      value={approvedFooter}
                      onChange={(e) => setApprovedFooter(e.target.value)}
                      className="w-full p-2.5 sm:p-3 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] text-xs sm:text-sm leading-relaxed box-border resize-y"
                    />
                  </div>

                  <div className="w-full min-w-0 mt-1">
                    <small className="block text-[11px] font-bold text-[var(--ink3)] uppercase mb-1 tracking-wide">
                      Aperçu complet du message envoyé (Français) :
                    </small>
                    <div className="whatsapp-preview-box">
                      {buildApprovedProspectMessage(approvedHeader, approvedFooter, '{Nom de l\'élève}', methods, 'fr')}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3.5 w-full min-w-0" dir="rtl">
                  <div className="w-full min-w-0">
                    <label className="block text-xs sm:text-sm font-semibold text-[var(--ink2)] mb-1 text-right">
                      ترويسة الرسالة (قبل تفاصيل طرق الدفع) :
                    </label>
                    <textarea
                      rows={3}
                      dir="rtl"
                      value={approvedHeaderAr}
                      onChange={(e) => setApprovedHeaderAr(e.target.value)}
                      className="w-full p-2.5 sm:p-3 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] text-xs sm:text-sm leading-relaxed box-border resize-y text-right"
                    />
                  </div>

                  <div className="w-full min-w-0">
                    <label className="block text-xs sm:text-sm font-semibold text-[var(--ink2)] mb-1 text-right">
                      خاتمة الرسالة (بعد تفاصيل طرق الدفع) :
                    </label>
                    <textarea
                      rows={2}
                      dir="rtl"
                      value={approvedFooterAr}
                      onChange={(e) => setApprovedFooterAr(e.target.value)}
                      className="w-full p-2.5 sm:p-3 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] text-xs sm:text-sm leading-relaxed box-border resize-y text-right"
                    />
                  </div>

                  <div className="w-full min-w-0 mt-1">
                    <small className="block text-[11px] font-bold text-[var(--ink3)] uppercase mb-1 tracking-wide text-right">
                      معاينة الرسالة الكاملة (العربية) :
                    </small>
                    <div className="whatsapp-preview-box text-right" dir="rtl">
                      {buildApprovedProspectMessage(approvedHeaderAr, approvedFooterAr, '{اسم التلميذ}', methods, 'ar')}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ==================== MODÈLE 2 : STATUT N/A ==================== */}
            <div className="settings-card">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[var(--line)]">
                <div>
                  <small style={{ color: 'var(--pri)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    MODÈLE 2 : STATUT N/A (PAS DE RÉPONSE)
                  </small>
                  <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] mt-0.5">
                    Relance automatique prospect non joignable
                  </h2>
                  <p className="text-xs text-[var(--ink2)] mt-0.5">
                    Déclenché lorsqu'un élève passe au statut « N/A ». Message professionnel pour inviter le prospect à recontacter Elios Academy.
                  </p>
                </div>

                {/* Sélecteur de langue */}
                <div className="inline-flex p-1 rounded-xl bg-[var(--hover)] border border-[var(--line)] shrink-0 self-start">
                  <button
                    type="button"
                    onClick={() => setM2Lang('fr')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      m2Lang === 'fr'
                        ? 'bg-[var(--card)] text-[var(--pri)] shadow-sm'
                        : 'text-[var(--ink3)] hover:text-[var(--ink)]'
                    }`}
                  >
                    🇫🇷 Français
                  </button>
                  <button
                    type="button"
                    onClick={() => setM2Lang('ar')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      m2Lang === 'ar'
                        ? 'bg-[var(--card)] text-[var(--pri)] shadow-sm'
                        : 'text-[var(--ink3)] hover:text-[var(--ink)]'
                    }`}
                  >
                    🇹🇳 العربية
                  </button>
                </div>
              </div>

              {/* Badges variables dynamiques */}
              <div className="flex flex-wrap items-center gap-1.5 my-3 text-xs text-[var(--ink2)]">
                <span className="font-semibold text-[var(--ink3)] text-[11px] uppercase tracking-wider">Balises :</span>
                <span className="px-2 py-0.5 rounded-md bg-[var(--hover)] border border-[var(--line)] font-mono text-[11px] text-[var(--pri)] font-bold">
                  {'{nom}'}
                </span>
                <span className="text-[11px] text-[var(--ink3)]">(Nom complet de l'élève)</span>
              </div>

              {m2Lang === 'fr' ? (
                <div className="flex flex-col gap-3.5 w-full min-w-0">
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

                  <div className="w-full min-w-0 mt-1">
                    <small className="block text-[11px] font-bold text-[var(--ink3)] uppercase mb-1 tracking-wide">
                      Aperçu du message N/A (Français) :
                    </small>
                    <div className="whatsapp-preview-box">
                      {buildNaMessage(naMessage, '{Nom de l\'élève}', 'fr')}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3.5 w-full min-w-0" dir="rtl">
                  <div className="w-full min-w-0">
                    <label className="block text-xs sm:text-sm font-semibold text-[var(--ink2)] mb-1 text-right">
                      نص رسالة التذكير وعدم الرد :
                    </label>
                    <textarea
                      rows={5}
                      dir="rtl"
                      value={naMessageAr}
                      onChange={(e) => setNaMessageAr(e.target.value)}
                      className="w-full p-2.5 sm:p-3 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] text-xs sm:text-sm leading-relaxed box-border resize-y text-right"
                    />
                  </div>

                  <div className="w-full min-w-0 mt-1">
                    <small className="block text-[11px] font-bold text-[var(--ink3)] uppercase mb-1 tracking-wide text-right">
                      معاينة رسالة عدم الرد N/A (العربية) :
                    </small>
                    <div className="whatsapp-preview-box text-right" dir="rtl">
                      {buildNaMessage(naMessageAr, '{اسم التلميذ}', 'ar')}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ==================== MODÈLE 3 : RAPPEL SÉANCE GROUPE ÉLÈVES ==================== */}
            <div className="settings-card">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[var(--line)]">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <small style={{ color: 'var(--pri)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      MODÈLE 3 : RAPPEL SÉANCE GROUPE ÉLÈVES
                    </small>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      Sans lien Zoom
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] mt-0.5">
                    Rappel de cours pour le groupe d'élèves
                  </h2>
                  <p className="text-xs text-[var(--ink2)] mt-0.5">
                    Modèle pour rappeler une séance aux élèves. Injecte dynamiquement la matière, le niveau, « aujourd'hui » et l'heure exacte. Strictement aucun lien Zoom n'est mentionné.
                  </p>
                </div>

                {/* Sélecteur de langue */}
                <div className="inline-flex p-1 rounded-xl bg-[var(--hover)] border border-[var(--line)] shrink-0 self-start">
                  <button
                    type="button"
                    onClick={() => setM3Lang('fr')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      m3Lang === 'fr'
                        ? 'bg-[var(--card)] text-[var(--pri)] shadow-sm'
                        : 'text-[var(--ink3)] hover:text-[var(--ink)]'
                    }`}
                  >
                    🇫🇷 Français
                  </button>
                  <button
                    type="button"
                    onClick={() => setM3Lang('ar')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      m3Lang === 'ar'
                        ? 'bg-[var(--card)] text-[var(--pri)] shadow-sm'
                        : 'text-[var(--ink3)] hover:text-[var(--ink)]'
                    }`}
                  >
                    🇹🇳 العربية
                  </button>
                </div>
              </div>

              {/* Badges variables dynamiques */}
              <div className="flex flex-wrap items-center gap-1.5 my-3 text-xs text-[var(--ink2)]">
                <span className="font-semibold text-[var(--ink3)] text-[11px] uppercase tracking-wider">Balises :</span>
                <span className="px-2 py-0.5 rounded-md bg-[var(--hover)] border border-[var(--line)] font-mono text-[11px] text-[var(--pri)] font-bold">
                  {'{matiere}'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[var(--hover)] border border-[var(--line)] font-mono text-[11px] text-[var(--pri)] font-bold">
                  {'{niveau}'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[var(--hover)] border border-[var(--line)] font-mono text-[11px] text-[var(--pri)] font-bold">
                  {'{heure}'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[var(--hover)] border border-[var(--line)] font-mono text-[11px] text-[var(--pri)] font-bold">
                  {'{prof}'}
                </span>
              </div>

              {m3Lang === 'fr' ? (
                <div className="flex flex-col gap-3.5 w-full min-w-0">
                  <div className="w-full min-w-0">
                    <label className="block text-xs sm:text-sm font-semibold text-[var(--ink2)] mb-1">
                      Contenu du message de rappel Groupe (Français) :
                    </label>
                    <textarea
                      rows={5}
                      value={groupReminder}
                      onChange={(e) => setGroupReminder(e.target.value)}
                      className="w-full p-2.5 sm:p-3 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] text-xs sm:text-sm leading-relaxed box-border resize-y"
                    />
                  </div>

                  <div className="w-full min-w-0 mt-1">
                    <small className="block text-[11px] font-bold text-[var(--ink3)] uppercase mb-1 tracking-wide">
                      Aperçu du rappel Groupe (Français) :
                    </small>
                    <div className="whatsapp-preview-box">
                      {buildGroupReminderMessage(groupReminder, {
                        matiere: 'Mathématiques',
                        niveau: '3ème Année - Sc',
                        heure: '18:00',
                        enseignant: 'Prof. Riadh'
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3.5 w-full min-w-0" dir="rtl">
                  <div className="w-full min-w-0">
                    <label className="block text-xs sm:text-sm font-semibold text-[var(--ink2)] mb-1 text-right">
                      نص رسالة تذكير مجموعة التلاميذ (العربية) :
                    </label>
                    <textarea
                      rows={5}
                      dir="rtl"
                      value={groupReminderAr}
                      onChange={(e) => setGroupReminderAr(e.target.value)}
                      className="w-full p-2.5 sm:p-3 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] text-xs sm:text-sm leading-relaxed box-border resize-y text-right"
                    />
                  </div>

                  <div className="w-full min-w-0 mt-1">
                    <small className="block text-[11px] font-bold text-[var(--ink3)] uppercase mb-1 tracking-wide text-right">
                      معاينة تذكير مجموعة التلاميذ (العربية) :
                    </small>
                    <div className="whatsapp-preview-box text-right" dir="rtl">
                      {buildGroupReminderMessage(groupReminderAr, {
                        matiere: 'الرياضيات',
                        niveau: '3 ثانوي علوم',
                        heure: '18:00',
                        enseignant: 'أستاذ رياض'
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ==================== MODÈLE 4 : RAPPEL ENSEIGNANT ==================== */}
            <div className="settings-card">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[var(--line)]">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <small style={{ color: 'var(--pri)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      MODÈLE 4 : RAPPEL ENSEIGNANT (PROFESSEUR)
                    </small>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      Sans lien Zoom
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] mt-0.5">
                    Rappel avant le direct pour l'enseignant
                  </h2>
                  <p className="text-xs text-[var(--ink2)] mt-0.5">
                    Inclut formule de salutation, nom du prof, matière, niveau, « aujourd'hui » et heure exacte du direct. Strictement aucun lien Zoom n'est mentionné.
                  </p>
                </div>

                {/* Sélecteur de langue */}
                <div className="inline-flex p-1 rounded-xl bg-[var(--hover)] border border-[var(--line)] shrink-0 self-start">
                  <button
                    type="button"
                    onClick={() => setM4Lang('fr')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      m4Lang === 'fr'
                        ? 'bg-[var(--card)] text-[var(--pri)] shadow-sm'
                        : 'text-[var(--ink3)] hover:text-[var(--ink)]'
                    }`}
                  >
                    🇫🇷 Français
                  </button>
                  <button
                    type="button"
                    onClick={() => setM4Lang('ar')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      m4Lang === 'ar'
                        ? 'bg-[var(--card)] text-[var(--pri)] shadow-sm'
                        : 'text-[var(--ink3)] hover:text-[var(--ink)]'
                    }`}
                  >
                    🇹🇳 العربية
                  </button>
                </div>
              </div>

              {/* Badges variables dynamiques */}
              <div className="flex flex-wrap items-center gap-1.5 my-3 text-xs text-[var(--ink2)]">
                <span className="font-semibold text-[var(--ink3)] text-[11px] uppercase tracking-wider">Balises :</span>
                <span className="px-2 py-0.5 rounded-md bg-[var(--hover)] border border-[var(--line)] font-mono text-[11px] text-[var(--pri)] font-bold">
                  {'{prof}'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[var(--hover)] border border-[var(--line)] font-mono text-[11px] text-[var(--pri)] font-bold">
                  {'{matiere}'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[var(--hover)] border border-[var(--line)] font-mono text-[11px] text-[var(--pri)] font-bold">
                  {'{niveau}'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[var(--hover)] border border-[var(--line)] font-mono text-[11px] text-[var(--pri)] font-bold">
                  {'{heure}'}
                </span>
              </div>

              {m4Lang === 'fr' ? (
                <div className="flex flex-col gap-3.5 w-full min-w-0">
                  <div className="w-full min-w-0">
                    <label className="block text-xs sm:text-sm font-semibold text-[var(--ink2)] mb-1">
                      Contenu du rappel Enseignant (Français) :
                    </label>
                    <textarea
                      rows={4}
                      value={teacherReminder}
                      onChange={(e) => setTeacherReminder(e.target.value)}
                      className="w-full p-2.5 sm:p-3 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] text-xs sm:text-sm leading-relaxed box-border resize-y"
                    />
                  </div>

                  <div className="w-full min-w-0 mt-1">
                    <small className="block text-[11px] font-bold text-[var(--ink3)] uppercase mb-1 tracking-wide">
                      Aperçu du rappel Enseignant (Français) :
                    </small>
                    <div className="whatsapp-preview-box">
                      {buildTeacherReminderMessage(teacherReminder, {
                        prof: 'M. Riadh',
                        matiere: 'Physique-Chimie',
                        niveau: '4ème BAC Informatique',
                        heure: '19:30'
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3.5 w-full min-w-0" dir="rtl">
                  <div className="w-full min-w-0">
                    <label className="block text-xs sm:text-sm font-semibold text-[var(--ink2)] mb-1 text-right">
                      نص رسالة تذكير الأستاذ (العربية) :
                    </label>
                    <textarea
                      rows={4}
                      dir="rtl"
                      value={teacherReminderAr}
                      onChange={(e) => setTeacherReminderAr(e.target.value)}
                      className="w-full p-2.5 sm:p-3 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] text-xs sm:text-sm leading-relaxed box-border resize-y text-right"
                    />
                  </div>

                  <div className="w-full min-w-0 mt-1">
                    <small className="block text-[11px] font-bold text-[var(--ink3)] uppercase mb-1 tracking-wide text-right">
                      معاينة تذكير الأستاذ (العربية) :
                    </small>
                    <div className="whatsapp-preview-box text-right" dir="rtl">
                      {buildTeacherReminderMessage(teacherReminderAr, {
                        prof: 'أ. رياض',
                        matiere: 'الفيزياء والكيمياء',
                        niveau: 'بكالوريا إعلامية',
                        heure: '19:30'
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Barre d'action finale */}
            <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--line)] flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-[var(--ink2)]">
                💡 Les modifications apportées s'appliquent immédiatement à l'ensemble des modules CRM et Séances.
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                <button
                  type="button"
                  className="btn text-xs py-2 px-3.5 w-full sm:w-auto justify-center"
                  onClick={handleResetWhatsAppDefaults}
                >
                  ↺ Rétablir les textes par défaut
                </button>
                <button
                  type="button"
                  className="btn pri text-xs sm:text-sm font-semibold py-2 px-6 w-full sm:w-auto justify-center"
                  onClick={handleSaveWhatsApp}
                  disabled={isSavingWhatsApp}
                >
                  {isSavingWhatsApp ? 'Sauvegarde en cours...' : '💾 Sauvegarder les 4 modèles'}
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

        {/* ========================================================
            ONGLET 4 : GROUPES DE COMMUNICATION WHATSAPP ÉLÈVES (CRUD COMPLET)
            ======================================================== */}
        {activeTab === 'groups' && (
          <div className="mt-5 flex flex-col gap-5 w-full min-w-0">
            {/* CARTE : Configuration & CRUD des Groupes de Communication */}
            <div className="settings-card">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div>
                  <small style={{ color: 'var(--pri)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    COMMUNICATION ÉLÈVES & CLASSES
                  </small>
                  <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] mt-1">
                    Gestion des Groupes ({groups.length} au total, {filteredGroups.length} affiché{filteredGroups.length > 1 ? 's' : ''})
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--ink2)] mt-0.5">
                    Gérez, créez, modifiez ou supprimez les groupes de communication et leurs liens d'invitation WhatsApp.
                  </p>
                </div>

                {/* Actions principales du haut de carte */}
                <div className="flex items-center gap-2 self-start md:self-center shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={handleOpenCreateGroupModal}
                    className="btn pri text-xs sm:text-sm font-semibold py-2 px-3.5 inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 }}>
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    <span>Nouveau Groupe</span>
                  </button>
                </div>
              </div>

              {/* Barre de recherche et filtres de catégorie */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 pt-3 border-t border-[var(--line)]">
                {/* Champ de recherche rapide */}
                <div className="relative flex-1 max-w-md">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--ink3)]">
                    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={groupSearchQuery}
                    onChange={(e) => setGroupSearchQuery(e.target.value)}
                    placeholder="Filtrer par nom, classe, section..."
                    className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-[var(--line)] bg-[var(--hover)] text-[var(--ink)] text-xs placeholder:text-[var(--ink3)] focus:outline-none focus:border-[var(--pri)] transition"
                  />
                  {groupSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setGroupSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[var(--ink3)] hover:text-[var(--ink)]"
                    >
                      <span className="text-xs">✕</span>
                    </button>
                  )}
                </div>

                {/* Filtres de catégorie par boutons épurés */}
                <div className="flex items-center rounded-xl p-1 bg-[var(--hover)] border border-[var(--line)] self-start sm:self-auto overflow-x-auto max-w-full">
                  {(['all', 'Collège', 'Lycée', 'Formatic', ...(categoryCounts['Autre'] ? ['Autre'] : [])] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setGroupCategoryFilter(cat)}
                      className={`text-xs font-semibold py-1 px-2.5 rounded-lg transition whitespace-nowrap ${
                        groupCategoryFilter === cat 
                          ? 'bg-[var(--card)] text-[var(--ink)] shadow-sm' 
                          : 'text-[var(--ink2)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {cat === 'all' ? `Tous (${categoryCounts.all || groups.length})` : `${cat} (${categoryCounts[cat] || 0})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grille des groupes */}
              {filteredGroups.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-[var(--line)] bg-[var(--hover)] my-2">
                  <p className="text-sm font-semibold text-[var(--ink2)]">Aucun groupe ne correspond à votre recherche.</p>
                  <button
                    type="button"
                    onClick={() => { setGroupSearchQuery(''); setGroupCategoryFilter('all'); }}
                    className="mt-2 text-xs text-[var(--pri)] underline font-medium"
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {filteredGroups.map((grp) => {
                    const isConfigured = !!grp.whatsappLink?.trim();
                    const isActive = grp.active !== false;

                    return (
                      <div
                        key={grp.code || grp._id}
                        className={`p-3 sm:p-3.5 rounded-xl border bg-[var(--card)] transition flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                          isActive 
                            ? 'border-[var(--line)] hover:border-[var(--pri)]' 
                            : 'border-dashed border-[var(--line)] opacity-70 bg-[var(--hover)]'
                        }`}
                      >
                        {/* En-tête groupe, statut & badges */}
                        <div className="min-w-0 lg:w-4/12">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleGroupActive(grp)}
                              title={isActive ? 'Groupe actif (cliquer pour désactiver)' : 'Groupe inactif (cliquer pour activer)'}
                              className="focus:outline-none"
                            >
                              <span 
                                className={`w-2.5 h-2.5 rounded-full shrink-0 block cursor-pointer transition ${
                                  !isActive 
                                    ? 'bg-gray-400 hover:ring-2 hover:ring-gray-300' 
                                    : isConfigured 
                                    ? 'bg-emerald-500 hover:ring-2 hover:ring-emerald-300' 
                                    : 'bg-amber-400 hover:ring-2 hover:ring-amber-300'
                                }`}
                              />
                            </button>
                            <b 
                              onClick={() => handleOpenEditGroupModal(grp)}
                              className="text-xs sm:text-sm font-bold text-[var(--ink)] truncate cursor-pointer hover:text-[var(--pri)] transition" 
                              title={`Modifier ${grp.name}`}
                            >
                              {grp.name}
                            </b>
                            {!isActive && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                Inactif
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--ink3)] flex-wrap">
                            <span className="px-1.5 py-0.5 rounded bg-[var(--hover)] border border-[var(--line)] font-medium">
                              {grp.level}
                            </span>
                            <span>•</span>
                            <span className="truncate max-w-[140px]" title={grp.section}>
                              {grp.section}
                            </span>
                            <span>•</span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/90 font-medium text-[11px]">
                              {grp.category}
                            </span>
                          </div>
                        </div>

                        {/* Champ de lien WhatsApp inline */}
                        <div className="min-w-0 flex-1">
                          <input
                            type="url"
                            placeholder="https://chat.whatsapp.com/..."
                            value={grp.whatsappLink || ''}
                            onChange={(e) => handleGroupLinkChange(grp.code, e.target.value)}
                            className="w-full py-1.5 px-3 rounded-lg border border-[var(--line)] bg-[var(--hover)] text-[var(--ink)] text-xs font-mono"
                          />
                        </div>

                        {/* Actions complètes par groupe (Tester, Enreg., Modifier, Supprimer) */}
                        <div className="flex items-center gap-1.5 shrink-0 justify-end flex-wrap sm:flex-nowrap w-full lg:w-auto">
                          {/* Message de confirmation rapide */}
                          {savedRowCode === grp.code && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 animate-fadeIn whitespace-nowrap shadow-xs">
                              <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 }}>
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              <span>Enreg. !</span>
                            </span>
                          )}

                          {rowError?.code === grp.code && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 animate-fadeIn whitespace-nowrap">
                              <span>{rowError.message}</span>
                            </span>
                          )}

                          {/* Bouton Tester */}
                          <button
                            type="button"
                            onClick={() => {
                              if (!grp.whatsappLink) return;
                              const testUrl = grp.whatsappLink.startsWith('http') ? grp.whatsappLink : `https://${grp.whatsappLink}`;
                              window.open(testUrl, '_blank', 'noopener');
                            }}
                            disabled={!grp.whatsappLink}
                            style={{ height: '31px', padding: '0 8px' }}
                            className="btn text-xs shrink-0 inline-flex items-center justify-center gap-1 whitespace-nowrap"
                            title="Tester le lien dans WhatsApp"
                          >
                            <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                            <span className="hidden sm:inline">Tester</span>
                          </button>

                          {/* Bouton Enregistrer le lien inline */}
                          <button
                            type="button"
                            onClick={() => handleSaveSingleGroupFromList(grp)}
                            disabled={savingRowCode === grp.code || isSavingGroups}
                            style={{ height: '31px', padding: '0 8px' }}
                            className="btn pri text-xs shrink-0 inline-flex items-center justify-center gap-1 whitespace-nowrap"
                            title="Enregistrer ce lien"
                          >
                            {savingRowCode === grp.code ? (
                              <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full shrink-0" />
                            ) : (
                              <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            )}
                            <span className="hidden sm:inline">{savingRowCode === grp.code ? '...' : 'Enreg.'}</span>
                          </button>

                          {/* Bouton Modifier (Édition Complète) */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditGroupModal(grp)}
                            style={{ height: '31px', padding: '0 8px' }}
                            className="btn text-xs shrink-0 inline-flex items-center justify-center gap-1 whitespace-nowrap hover:border-[var(--pri)]"
                            title="Modifier les détails du groupe (Nom, Classe, Section, etc.)"
                          >
                            <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            <span>Modifier</span>
                          </button>

                          {/* Bouton Supprimer */}
                          <button
                            type="button"
                            onClick={() => setDeletingGroup(grp)}
                            style={{ height: '31px', width: '31px', padding: 0 }}
                            className="btn text-xs shrink-0 inline-flex items-center justify-center text-rose-600 hover:bg-rose-50 hover:border-rose-300 dark:hover:bg-rose-950/30"
                            title="Supprimer ce groupe"
                          >
                            <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pied de carte : Enregistrement global */}
              <div className="mt-4 pt-3 border-t border-[var(--line)] flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-[var(--ink3)]">
                  {groups.filter(g => !!g.whatsappLink?.trim()).length} / {groups.length} groupes ont un lien WhatsApp configuré.
                </span>

                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap justify-end w-full sm:w-auto">
                  {saveAllStatus === 'saved' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 animate-fadeIn shadow-xs whitespace-nowrap w-full sm:w-auto justify-center">
                      <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 }}>
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span>Tous les liens ont été enregistrés !</span>
                    </span>
                  )}

                  {saveAllStatus === 'error' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 animate-fadeIn whitespace-nowrap w-full sm:w-auto justify-center">
                      <span>{saveAllMessage || 'Erreur lors de la sauvegarde'}</span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveAllGroups}
                    disabled={isSavingGroups || groups.length === 0}
                    className="btn pri text-xs sm:text-sm font-semibold py-2 px-5 w-full sm:w-auto justify-center inline-flex items-center gap-2 shrink-0"
                  >
                    <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                    </svg>
                    <span>{isSavingGroups ? 'Sauvegarde en cours...' : `Enregistrer tous les liens (${groups.length} groupes)`}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* ========================================================================= */}
      {/* MODALE : CRÉATION & ÉDITION D'UN GROUPE DE COMMUNICATION                 */}
      {/* ========================================================================= */}
      {isGroupModalOpen && (() => {
        const isSectionLocked = ['7ème de Base', '8ème de Base', '9ème de Base', '1ère Année'].includes(groupForm.level);

        // Filtrage dynamique strict des niveaux selon la catégorie sélectionnée
        const filteredLevelGroups: DropdownGroup[] = (() => {
          if (groupForm.category === 'Collège') {
            return [
              {
                groupLabel: 'Classes Collège (Sans section)',
                options: [
                  { value: '7ème de Base', label: '7ème de Base' },
                  { value: '8ème de Base', label: '8ème de Base' },
                  { value: '9ème de Base', label: '9ème de Base' },
                ],
              },
            ];
          }
          if (groupForm.category === 'Lycée') {
            return [
              {
                groupLabel: 'Classes Lycée',
                options: [
                  { value: '1ère Année', label: '1ère Année (Tronc commun)' },
                  { value: '2ème Année', label: '2ème Année' },
                  { value: '3ème Année', label: '3ème Année' },
                  { value: 'BAC', label: 'BAC' },
                ],
              },
            ];
          }
          if (groupForm.category === 'Formatic') {
            return [
              {
                groupLabel: 'Formatic',
                options: [
                  { value: 'Formatic', label: 'Formatic' },
                ],
              },
            ];
          }
          return [
            {
              groupLabel: 'Autres Niveaux',
              options: [
                { value: 'Autre', label: 'Autre niveau' },
              ],
            },
          ];
        })();

        const handleCategoryChange = (cat: 'Collège' | 'Lycée' | 'Formatic' | 'Autre') => {
          let newLevel = groupForm.level;
          let newSection = groupForm.section;

          if (cat === 'Collège') {
            if (!['7ème de Base', '8ème de Base', '9ème de Base'].includes(newLevel)) {
              newLevel = '7ème de Base';
            }
            newSection = 'Sans section';
          } else if (cat === 'Lycée') {
            if (!['1ère Année', '2ème Année', '3ème Année', 'BAC'].includes(newLevel)) {
              newLevel = '1ère Année';
              newSection = 'Sans section';
            } else if (newLevel === '1ère Année') {
              newSection = 'Sans section';
            } else if (newSection === 'Sans section') {
              newSection = 'Science';
            }
          } else if (cat === 'Formatic') {
            newLevel = 'Formatic';
            newSection = 'Sans section';
          } else if (cat === 'Autre') {
            if (['7ème de Base', '8ème de Base', '9ème de Base', '1ère Année', '2ème Année', '3ème Année', 'BAC', 'Formatic'].includes(newLevel)) {
              newLevel = 'Autre';
            }
            newSection = 'Sans section';
          }

          setGroupForm(prev => ({
            ...prev,
            category: cat,
            level: newLevel,
            section: newSection,
          }));
        };

        const handleLevelChange = (newLevel: string) => {
          const isNoSection = ['7ème de Base', '8ème de Base', '9ème de Base', '1ère Année'].includes(newLevel);
          setGroupForm(prev => ({
            ...prev,
            level: newLevel,
            section: isNoSection ? 'Sans section' : (prev.section === 'Sans section' ? 'Science' : prev.section),
          }));
        };

        return (
          <div 
            className="modal-overlay" 
            style={{ zIndex: 100 }}
            onClick={(e) => { if (e.target === e.currentTarget && !isSubmittingGroupModal) setIsGroupModalOpen(false); }}
          >
            <div className="modal-dialog" style={{ width: 'min(560px, 94vw)' }}>
              {/* En-tête (dh) */}
              <div className="dh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
                <div className="flex items-center gap-3">
                  <div 
                    style={{ 
                      width: 38, 
                      height: 38, 
                      borderRadius: '12px', 
                      background: 'color-mix(in srgb, var(--pri) 15%, transparent)', 
                      color: 'var(--pri)',
                      display: 'grid',
                      placeItems: 'center'
                    }}
                  >
                    <svg viewBox="0 0 24 24" style={{ width: 19, height: 19, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                      {editingGroup ? 'Modifier le groupe de communication' : 'Nouveau groupe de communication'}
                    </h2>
                    <small style={{ color: 'var(--ink3)', fontSize: '12px' }}>
                      {editingGroup ? `Identifiant : ${editingGroup.code}` : 'Ajout d\'un groupe de discussion pour les élèves'}
                    </small>
                  </div>
                </div>
                <button 
                  type="button" 
                  className="x" 
                  onClick={() => setIsGroupModalOpen(false)}
                  disabled={isSubmittingGroupModal}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveGroupModal} className="flex flex-col flex-1 min-h-0 overflow-hidden" style={{ margin: 0 }}>
                {/* Corps de formulaire déroulant (db) */}
                <div className="db" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
                  {groupFormError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                      <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2, flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <span>{groupFormError}</span>
                    </div>
                  )}

                  {/* Nom du groupe */}
                  <div>
                    <label className="text-xs font-bold text-[var(--ink2)] mb-1.5 uppercase tracking-wide" style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: '4px' }}>
                      <span>Nom du groupe</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Groupe BAC Science, Groupe 1ère Année..."
                      value={groupForm.name}
                      onChange={(e) => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--hover)] text-[var(--ink)] text-xs sm:text-sm font-medium focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20 shadow-xs"
                    />
                  </div>

                  {/* Catégorie : Contrôle segmenté ultra clair et épuré */}
                  <div>
                    <label className="text-xs font-bold text-[var(--ink2)] mb-1.5 uppercase tracking-wide" style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: '4px' }}>
                      <span>Catégorie</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
                      {(['Lycée', 'Collège', 'Formatic', 'Autre'] as const).map((cat) => {
                        const isSelected = groupForm.category === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => handleCategoryChange(cat)}
                            className={`h-9 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                              isSelected
                                ? 'bg-white text-slate-900 border border-slate-300 shadow-sm font-extrabold'
                                : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/70'
                            }`}
                          >
                            <span>{cat}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Niveau / Classe & Section : Sélecteurs Personnalisés Filtrés selon la Catégorie */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-xs font-bold text-[var(--ink2)] mb-1.5 uppercase tracking-wide" style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: '4px' }}>
                        <span>Niveau / Classe</span>
                        <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <CustomSelect
                        value={groupForm.level}
                        onChange={handleLevelChange}
                        groups={filteredLevelGroups}
                        placeholder="Choisir le niveau..."
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[var(--ink2)] mb-1.5 uppercase tracking-wide" style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: '4px' }}>
                        <span>Section</span>
                        <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <CustomSelect
                        value={groupForm.section}
                        onChange={(val) => setGroupForm(prev => ({ ...prev, section: val }))}
                        groups={SECTION_GROUPS}
                        disabled={isSectionLocked}
                        disabledLabel="Sans section (Automatique)"
                        placeholder="Choisir la section..."
                      />
                    </div>
                  </div>

                  {/* Lien WhatsApp */}
                  <div>
                    <label className="text-xs font-bold text-[var(--ink2)] mb-1.5 uppercase tracking-wide" style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: '4px' }}>
                      <span>Lien d'invitation WhatsApp</span>
                    </label>
                    <input
                      type="url"
                      placeholder="https://chat.whatsapp.com/..."
                      value={groupForm.whatsappLink}
                      onChange={(e) => setGroupForm(prev => ({ ...prev, whatsappLink: e.target.value }))}
                      className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--hover)] text-[var(--ink)] text-xs sm:text-sm font-mono focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 shadow-xs"
                    />
                    <small style={{ color: 'var(--ink3)', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                      Le lien officiel du groupe sur lequel les élèves cliquent pour rejoindre la discussion.
                    </small>
                  </div>

                  {/* Description facultative */}
                  <div>
                    <label className="text-xs font-bold text-[var(--ink2)] mb-1.5 uppercase tracking-wide" style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: '4px' }}>
                      <span>Description / Remarques (Optionnel)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Consignes ou détails sur ce groupe..."
                      value={groupForm.description}
                      onChange={(e) => setGroupForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full p-3 rounded-xl border border-[var(--line)] bg-[var(--hover)] text-[var(--ink)] text-xs sm:text-sm focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 resize-none shadow-xs"
                    />
                  </div>

                  {/* Statut actif / inactif : discret, petite taille et placé dans le coin gauche */}
                  <div className="flex items-center justify-start pt-0.5">
                    <label 
                      htmlFor="grp-active-check"
                      className="inline-flex items-center gap-2 cursor-pointer select-none text-[11px] text-[var(--ink2)] hover:text-[var(--ink)] transition py-0.5"
                      style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: '6px', width: 'auto' }}
                    >
                      <input
                        type="checkbox"
                        id="grp-active-check"
                        checked={groupForm.active}
                        onChange={(e) => setGroupForm(prev => ({ ...prev, active: e.target.checked }))}
                        style={{ width: '14px', height: '14px', margin: 0, minWidth: '14px', flexShrink: 0 }}
                        className="w-3.5 h-3.5 rounded text-slate-600 cursor-pointer accent-slate-600 shrink-0"
                      />
                      <span className="font-semibold text-[var(--ink)] text-[11px]">Groupe actif</span>
                      <span className="text-[10px] text-[var(--ink3)]">(disponible pour séances et rappels WhatsApp)</span>
                    </label>
                  </div>
                </div>

                {/* Pied de dialogue fixe (df) : Boutons de taille strictement identique avec Gris clair */}
                <div className="df" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', padding: '14px 20px', borderTop: '1px solid var(--line)', background: 'var(--card)', flexShrink: 0, marginTop: 'auto' }}>
                  <button 
                    type="button" 
                    onClick={() => setIsGroupModalOpen(false)}
                    disabled={isSubmittingGroupModal}
                    className="h-11 px-6 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink2)] text-xs sm:text-sm font-bold hover:bg-[var(--hover)] hover:text-[var(--ink)] transition inline-flex items-center justify-center min-w-[130px] w-full sm:w-auto shadow-xs cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmittingGroupModal}
                    className="h-11 px-6 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 text-xs sm:text-sm font-bold transition inline-flex items-center justify-center gap-2 min-w-[140px] w-full sm:w-auto shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {isSubmittingGroupModal && (
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-slate-700 border-t-transparent rounded-full" />
                    )}
                    <span>{isSubmittingGroupModal ? 'Enregistrement...' : editingGroup ? 'Enregistrer les modifications' : 'Créer le groupe'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODALE : CONFIRMATION SUPPRESSION D'UN GROUPE DE COMMUNICATION            */}
      {/* ========================================================================= */}
      {deletingGroup && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 110 }} 
          onClick={(e) => { if (e.target === e.currentTarget && !isDeletingGroupAction) setDeletingGroup(null); }}
        >
          <div className="modal-dialog" style={{ width: 'min(460px, 94vw)' }}>
            <div className="dh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-sm">
                  ⚠️
                </span>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>Supprimer le groupe</h2>
              </div>
              <button 
                type="button" 
                className="x" 
                onClick={() => setDeletingGroup(null)}
                disabled={isDeletingGroupAction}
              >
                ✕
              </button>
            </div>
            <div className="db" style={{ padding: '18px 20px' }}>
              <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.5, color: 'var(--ink)' }}>
                Êtes-vous sûr de vouloir supprimer définitivement le groupe de communication <b>« {deletingGroup.name} »</b> ?
              </p>
              <div className="mt-3 p-2.5 rounded-xl bg-[var(--hover)] border border-[var(--line)] text-xs text-[var(--ink2)] flex flex-wrap items-center gap-2">
                <span>Niveau : <b>{deletingGroup.level}</b></span>
                <span>•</span>
                <span>Section : <b>{deletingGroup.section}</b></span>
                <span>•</span>
                <span>Catégorie : <b>{deletingGroup.category}</b></span>
              </div>
              <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#E11D48', fontWeight: 500 }}>
                Cette action retirera définitivement ce groupe et son lien WhatsApp de la base de données.
              </p>
            </div>
            <div className="df" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', padding: '14px 20px', borderTop: '1px solid var(--line)', background: 'var(--card)', flexShrink: 0 }}>
              <button 
                type="button" 
                className="h-11 px-6 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink2)] text-xs sm:text-sm font-bold hover:bg-[var(--hover)] hover:text-[var(--ink)] transition inline-flex items-center justify-center min-w-[130px] w-full sm:w-auto shadow-xs cursor-pointer"
                onClick={() => setDeletingGroup(null)}
                disabled={isDeletingGroupAction}
              >
                Annuler
              </button>
              <button 
                type="button" 
                className="h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold transition inline-flex items-center justify-center gap-2 min-w-[130px] w-full sm:w-auto shadow-xs cursor-pointer disabled:opacity-60" 
                onClick={handleConfirmDeleteGroup}
                disabled={isDeletingGroupAction}
              >
                {isDeletingGroupAction && (
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                )}
                <span>{isDeletingGroupAction ? 'Suppression...' : 'Supprimer définitivement'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}

