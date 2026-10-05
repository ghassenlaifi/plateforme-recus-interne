"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { EliosHeader } from '@/components/EliosHeader';
import { Operator, getThemeColors, getOperatorColors } from '@/types';
import {
  LeadItem,
  LeadNote,
  FORMATIC_STATUSES,
  FORMATIC_STATUS_COLORS,
  FORMATIC_CLASSES,
  FORMATIC_SECTIONS,
  FORMATIC_SOURCES,
  FORMATIC_OFFERS,
  isLeadInRappels,
  getRappelsDelayDays
} from '@/types/crm';
import { WhatsAppDispatchModal } from '@/components/WhatsAppDispatchModal';
import { PaymentMethod, WhatsAppTemplates, DEFAULT_PAYMENT_METHODS, DEFAULT_WHATSAPP_TEMPLATES } from '@/types/settings';
import { buildApprovedProspectMessage, buildNaMessage } from '@/lib/whatsappHelper';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Erreur chargement données Formatic');
  return res.json();
});

const IC = {
  users: <><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/></>,
  up: <><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/></>,
  ok: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></>,
  share: <><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></>,
  lightning: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  dl: <path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>,
  chat: <path d="M4 5h16v11H9l-5 4z"/>,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>,
  x: <path d="M6 6l12 12M18 6 6 18"/>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  open: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>,
  edit: <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>,
  warning: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  chevronLeft: <path d="m15 18-6-6 6-6"/>,
  chevronRight: <path d="m9 18 6-6-6-6"/>,
  usersGroup: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
};

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

export default function CRMFormaticPage() {
  const [activeUser, setActiveUser] = useState<string | null>(null);

  // Persistence utilisateur actif
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

  // Récupération des données Formatic depuis MongoDB Atlas
  const { data: leads, mutate } = useSWR<LeadItem[]>('/api/leads/formatic', fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true
  });
  const { data: operators } = useSWR<Operator[]>('/api/operators', fetcher);
  const safeOperators = useMemo(() => Array.isArray(operators) ? operators : [], [operators]);

  // Liste exhaustive de tous les opérateurs réels
  const availableStaff = useMemo(() => {
    const set = new Set<string>();
    safeOperators.forEach(o => {
      if (o.name) set.add(o.name.trim());
    });
    if (Array.isArray(leads)) {
      leads.forEach(l => {
        if (l.staff && l.staff !== 'Système' && l.staff !== 'Non assigné') set.add(l.staff.trim());
        if (l.lastModifiedBy && l.lastModifiedBy !== 'Système' && l.lastModifiedBy !== 'Non assigné') set.add(l.lastModifiedBy.trim());
      });
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [safeOperators, leads]);

  // État de sélection de carte KPI ('all', 'approved', 'potential', 'to_elios', 'rappels')
  const [activeCard, setActiveCard] = useState<'all' | 'approved' | 'potential' | 'to_elios' | 'rappels' | null>('all');

  // Filtres Formatic
  const [filterQuery, setFilterQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterClasse, setFilterClasse] = useState('ALL');
  const [filterSection, setFilterSection] = useState('ALL');
  const [filterStaff, setFilterStaff] = useState('ALL');
  const [filterDate, setFilterDate] = useState('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Modales & Fiche Prospect
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [lastInteractedLeadId, setLastInteractedLeadId] = useState<string | null>(null);

  // Déterminer le dernier prospect modifié / consulté (conserve sa position dans la liste)
  const effectiveLastModifiedId = useMemo(() => {
    if (lastInteractedLeadId) return lastInteractedLeadId;
    if (!leads || !Array.isArray(leads) || leads.length === 0) return null;
    let latest = leads[0];
    let latestTime = 0;
    for (const l of leads) {
      if (l.updatedAt) {
        const t = new Date(l.updatedAt).getTime();
        if (t > latestTime) {
          latestTime = t;
          latest = l;
        }
      }
    }
    return latestTime > 0 ? (latest._id || latest.id) : null;
  }, [lastInteractedLeadId, leads]);

  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Formulaire Nouveau Prospect
  const [newPhone, setNewPhone] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [newSection, setNewSection] = useState('');
  const [newErr, setNewErr] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Formulaire Fiche Prospect
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editOffer, setEditOffer] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editSource, setEditSource] = useState('Formatic dataBase');
  const [editGrade, setEditGrade] = useState('');
  const [editSection, setEditSection] = useState('');
  const [editStatus, setEditStatus] = useState('Lead');
  const [editStaff, setEditStaff] = useState('');
  const [editFamilyGroup, setEditFamilyGroup] = useState('');
  const [editToElios, setEditToElios] = useState(false);
  const [editErr, setEditErr] = useState('');
  const [isDeleteArmed, setIsDeleteArmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Instantané pour dirty checking
  const [initialFormValues, setInitialFormValues] = useState<any>(null);

  // Gestion des notes
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Modale WhatsApp automatique
  const [whatsAppModal, setWhatsAppModal] = useState<{
    isOpen: boolean;
    studentName: string;
    studentPhone: string;
    targetStatus: string;
    message: string;
  }>({
    isOpen: false,
    studentName: '',
    studentPhone: '',
    targetStatus: '',
    message: ''
  });

  // Données de configuration pour WhatsApp et Modes de paiement
  const { data: paymentsConfig } = useSWR<{ methods: PaymentMethod[] }>('/api/settings/payments', fetcher);
  const { data: whatsappConfig } = useSWR<{ templates: WhatsAppTemplates }>('/api/settings/whatsapp', fetcher);

  const paymentMethods = useMemo(() => paymentsConfig?.methods || DEFAULT_PAYMENT_METHODS, [paymentsConfig]);
  const whatsappTemplates = useMemo(() => whatsappConfig?.templates || DEFAULT_WHATSAPP_TEMPLATES, [whatsappConfig]);

  const triggerWhatsAppPopup = (studentName: string, phone: string, status: string) => {
    let msg = '';
    const st = (status || '').trim().toLowerCase();
    if (st === 'approved prospect' || st === 'approved' || st === 'converti') {
      msg = buildApprovedProspectMessage(
        whatsappTemplates.approvedProspectHeader,
        whatsappTemplates.approvedProspectFooter,
        studentName,
        paymentMethods
      );
    } else if (st === 'n/a') {
      msg = buildNaMessage(whatsappTemplates.naMessage, studentName);
    } else {
      msg = `Bonjour ${studentName || ''},\n\nNous vous contactons de la part de Formatic concernant votre inscription.`;
    }

    setWhatsAppModal({
      isOpen: true,
      studentName,
      studentPhone: phone,
      targetStatus: status,
      message: msg
    });
  };

  const showToast = (m: string) => {
    setToastMsg(m);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMsg(''), 2800);
  };

  // Calcul ergonomique des initiales
  const getInitials = (name?: string, first?: string, last?: string) => {
    const f = (first || '').trim();
    const l = (last || '').trim();
    if (f && l) return (f[0] + l[0]).toUpperCase();
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].substring(0, 2).toUpperCase();
    if (parts.length === 1 && parts[0].length === 1) return parts[0].toUpperCase();
    return 'PS';
  };

  // Synchronisation des champs d'édition lors de l'ouverture d'un prospect
  useEffect(() => {
    if (selectedLead) {
      const fName = selectedLead.firstName !== undefined 
        ? selectedLead.firstName 
        : (selectedLead.name || '').trim().split(/\s+/)[0] || '';
      const lName = selectedLead.lastName !== undefined 
        ? selectedLead.lastName 
        : (selectedLead.name || '').trim().split(/\s+/).slice(1).join(' ') || '';
      const rawStatus = selectedLead.status === 'Converti' ? 'Approved' : (selectedLead.status || 'N/A');
      const initialGrade = selectedLead.grade === 'Bac' ? 'BAC' : (selectedLead.grade || '');
      const initialSource = selectedLead.source || 'Formatic dataBase';
      const initialStaff = selectedLead.staff || selectedLead.lastModifiedBy || '';
      const initialFamily = selectedLead.familyGroup || '';
      const initialToElios = Boolean(selectedLead.toElios);

      setEditFirst(fName);
      setEditLast(lName);
      setEditPhone(selectedLead.phone || '');
      setEditOffer(selectedLead.offer || '');
      setEditAmount(selectedLead.amount || '');
      setEditSource(initialSource);
      setEditGrade(initialGrade);
      setEditSection(selectedLead.section || '');
      setEditStatus(rawStatus);
      setEditStaff(initialStaff);
      setEditFamilyGroup(initialFamily);
      setEditToElios(initialToElios);
      setEditErr('');
      setNewNoteText('');
      setEditingNoteId(null);
      setEditingNoteText('');
      setIsDeleteArmed(false);

      setInitialFormValues({
        firstName: fName,
        lastName: lName,
        phone: selectedLead.phone || '',
        offer: selectedLead.offer || '',
        amount: selectedLead.amount || '',
        source: initialSource,
        grade: initialGrade,
        section: selectedLead.section || '',
        status: rawStatus,
        staff: initialStaff,
        familyGroup: initialFamily,
        toElios: initialToElios
      });
    } else {
      setInitialFormValues(null);
    }
  }, [selectedLead]);

  // Détection des modifications non enregistrées
  const hasUnsavedChanges = useMemo(() => {
    if (!initialFormValues) return false;
    return (
      editFirst !== initialFormValues.firstName ||
      editLast !== initialFormValues.lastName ||
      editPhone !== initialFormValues.phone ||
      editOffer !== initialFormValues.offer ||
      editAmount !== initialFormValues.amount ||
      editSource !== initialFormValues.source ||
      editGrade !== initialFormValues.grade ||
      editSection !== initialFormValues.section ||
      editStatus !== initialFormValues.status ||
      editFamilyGroup !== initialFormValues.familyGroup ||
      editToElios !== initialFormValues.toElios
    );
  }, [initialFormValues, editFirst, editLast, editPhone, editOffer, editAmount, editSource, editGrade, editSection, editStatus, editFamilyGroup, editToElios]);

  // Fermeture sécurisée
  const handleRequestCloseFiche = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedConfirm(true);
    } else {
      setSelectedLead(null);
    }
  };

  // KPI Stats avec TO ELIOS et Règle Métier des Rappels
  const stats = useMemo(() => {
    const list = Array.isArray(leads) ? leads : [];
    const countStatus = (st: string) => list.filter(l => (l.status || '').trim().toLowerCase() === st.toLowerCase()).length;
    
    // Rappels stricts : N/A (>=5 jours), Potential/Approved Prospect (>=3 jours)
    const rappelsCount = list.filter(l => isLeadInRappels(l)).length;
    
    // TO ELIOS stats
    const toEliosCount = list.filter(l => Boolean(l.toElios)).length;

    return {
      total: list.length,
      approved: list.filter(l => {
        const s = (l.status || '').trim().toLowerCase();
        return s === 'approved' || s === 'converti';
      }).length,
      potential: countStatus('Potential Prospect'),
      toElios: toEliosCount,
      rappels: rappelsCount
    };
  }, [leads]);

  // Gestion des clics sur les cartes KPI
  const handleCardClick = (card: 'all' | 'approved' | 'potential' | 'to_elios' | 'rappels') => {
    if (activeCard === card && card !== 'all') {
      setActiveCard('all');
    } else {
      setActiveCard(card);
    }
    setCurrentPage(1);
  };

  // Filtrage multi-critères
  const filteredLeads = useMemo(() => {
    if (!leads || !Array.isArray(leads)) return [];

    const query = filterQuery.trim().toLowerCase().replace(/\s/g, '');

    return leads.filter(l => {
      // 1. Recherche texte (Nom, Téléphone, Groupe)
      if (query) {
        const nom = (l.name || '').toLowerCase().replace(/\s/g, '');
        const tel = (l.phone || '').replace(/\s/g, '');
        const fam = (l.familyGroup || '').toLowerCase().replace(/\s/g, '');
        if (!nom.includes(query) && !tel.includes(query) && !fam.includes(query)) {
          return false;
        }
      }

      // 2. Filtre par carte KPI active
      if (activeCard === 'approved') {
        const st = (l.status || '').trim().toLowerCase();
        if (st !== 'approved' && st !== 'converti') return false;
      } else if (activeCard === 'potential') {
        if ((l.status || '').trim().toLowerCase() !== 'potential prospect') return false;
      } else if (activeCard === 'to_elios') {
        if (!Boolean(l.toElios)) return false;
      } else if (activeCard === 'rappels') {
        if (!isLeadInRappels(l)) return false;
      }

      // 3. Filtre STATUT
      if (filterStatus !== 'ALL') {
        const leadStatus = (l.status || '').trim().toLowerCase();
        const target = filterStatus.trim().toLowerCase();
        if (target === 'approved') {
          if (leadStatus !== 'approved' && leadStatus !== 'converti') return false;
        } else if (leadStatus !== target) {
          return false;
        }
      }

      // 4. Filtre CLASSE
      if (filterClasse !== 'ALL') {
        const leadGrade = (l.grade || '').trim().toLowerCase();
        const targetGrade = filterClasse.trim().toLowerCase();
        if (targetGrade === 'bac') {
          if (leadGrade !== 'bac') return false;
        } else if (!leadGrade.includes(targetGrade)) {
          return false;
        }
      }

      // 5. Filtre SECTION
      if (filterSection !== 'ALL') {
        const leadSec = (l.section || '').trim().toLowerCase();
        const targetSec = filterSection.trim().toLowerCase();
        if (!leadSec.includes(targetSec)) return false;
      }

      // 6. Filtre STAFF
      if (filterStaff !== 'ALL') {
        const staffVal = (l.staff || '').trim().toLowerCase();
        const modVal = (l.lastModifiedBy || '').trim().toLowerCase();
        const targetStaff = filterStaff.trim().toLowerCase();
        if (staffVal !== targetStaff && modVal !== targetStaff) return false;
      }

      // 7. Filtre DATE
      if (filterDate !== 'ALL') {
        const leadDate = l.updatedAt ? new Date(l.updatedAt) : new Date(l.date);
        const dateToEval = new Date(leadDate);
        const now = new Date();

        if (filterDate === 'today') {
          if (dateToEval.toDateString() !== now.toDateString()) return false;
        } else if (filterDate === 'week') {
          const startOfWeek = new Date(now);
          const day = startOfWeek.getDay() || 7;
          startOfWeek.setDate(startOfWeek.getDate() - day + 1);
          startOfWeek.setHours(0, 0, 0, 0);
          if (dateToEval < startOfWeek) return false;
        } else if (filterDate === 'month') {
          if (dateToEval.getMonth() !== now.getMonth() || dateToEval.getFullYear() !== now.getFullYear()) {
            return false;
          }
        } else if (filterDate === 'custom') {
          if (customStartDate) {
            const start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            if (dateToEval < start) return false;
          }
          if (customEndDate) {
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            if (dateToEval > end) return false;
          }
        }
      }

      return true;
    }).sort((a, b) => {
      // Tri stable par date de création : les modifications/consultations ne changent jamais l'ordre de la liste
      const timeB = b.date ? new Date(b.date).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      const timeA = a.date ? new Date(a.date).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      if (timeB !== timeA) return timeB - timeA;
      return String(b.id || b._id).localeCompare(String(a.id || a._id));
    });
  }, [leads, filterQuery, activeCard, filterStatus, filterClasse, filterSection, filterStaff, filterDate, customStartDate, customEndDate]);

  // Données paginées
  const totalPages = Math.ceil(filteredLeads.length / pageSize) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage, pageSize]);

  // Réinitialisation de tous les filtres
  const handleResetFilters = () => {
    setFilterQuery('');
    setActiveCard('all');
    setFilterStatus('ALL');
    setFilterClasse('ALL');
    setFilterSection('ALL');
    setFilterStaff('ALL');
    setFilterDate('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setCurrentPage(1);
    showToast('Filtres réinitialisés');
  };

  const isFiltered = Boolean(
    filterQuery ||
    activeCard !== 'all' ||
    filterStatus !== 'ALL' ||
    filterClasse !== 'ALL' ||
    filterSection !== 'ALL' ||
    filterStaff !== 'ALL' ||
    filterDate !== 'ALL' ||
    customStartDate ||
    customEndDate
  );

  // Création d'un prospect Formatic
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = newPhone.replace(/\D/g, '').replace(/^216(?=\d{8}$)/, '');
    if (!/^\d{8}$/.test(cleanPhone)) {
      setNewErr('Veuillez saisir un numéro de téléphone valide à 8 chiffres.');
      return;
    }

    try {
      setIsCreating(true);
      const res = await fetch('/api/leads/formatic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          grade: newGrade || '',
          section: newSection || '',
          status: 'Lead',
          source: 'Facebook',
          staff: activeUser || 'Non assigné',
          familyGroup: '',
          toElios: false,
          lastModifiedBy: activeUser || 'Système',
          notes: []
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur lors de la création');
      }

      const created = await res.json();
      setIsNewLeadOpen(false);
      setNewPhone('');
      setNewGrade('');
      setNewSection('');
      setNewErr('');
      mutate();
      showToast('Prospect Formatic créé avec succès !');
      setSelectedLead(created);
    } catch (err: any) {
      setNewErr(err.message || 'Une erreur est survenue.');
    } finally {
      setIsCreating(false);
    }
  };

  // Enregistrement des modifications du prospect
  const handleSaveLead = async () => {
    if (!selectedLead) return;
    const cleanPhone = editPhone.replace(/\D/g, '').replace(/^216(?=\d{8}$)/, '');
    if (cleanPhone.length !== 8) {
      setEditErr('Le numéro de téléphone doit comporter exactement 8 chiffres.');
      return;
    }

    try {
      setIsSaving(true);
      const computedFullName = [editFirst.trim(), editLast.trim()].filter(Boolean).join(' ') || 'Prospect sans nom';
      const targetId = selectedLead._id || selectedLead.id;

      const res = await fetch(`/api/leads/formatic/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editFirst.trim(),
          lastName: editLast.trim(),
          name: computedFullName,
          phone: cleanPhone,
          offer: editOffer,
          amount: editAmount,
          source: editSource,
          grade: editGrade,
          section: editSection,
          status: editStatus,
          staff: selectedLead.staff || activeUser || 'Non assigné',
          familyGroup: editFamilyGroup.trim(),
          toElios: editToElios,
          lastModifiedBy: activeUser || selectedLead.staff || 'Système'
        })
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Erreur lors de la sauvegarde');
      }

      const savedStatus = (editStatus || '').trim();
      const shouldTrigger = (
        savedStatus.toLowerCase() === 'approved prospect' ||
        savedStatus.toLowerCase() === 'approved' ||
        savedStatus.toLowerCase() === 'converti' ||
        savedStatus.toLowerCase() === 'n/a'
      );

      if (selectedLead) {
        setLastInteractedLeadId(selectedLead._id || selectedLead.id);
      }
      setSelectedLead(null);
      setShowUnsavedConfirm(false);
      mutate();
      showToast(editToElios ? 'Prospect synchronisé vers Elios avec succès !' : 'Prospect mis à jour avec succès');

      if (shouldTrigger) {
        triggerWhatsAppPopup(computedFullName, cleanPhone, savedStatus);
      }
    } catch (err: any) {
      setEditErr(err.message || 'Une erreur est survenue.');
    } finally {
      setIsSaving(false);
    }
  };

  // Ajout atomique d'une note
  const handleAddNote = async () => {
    if (!selectedLead || !newNoteText.trim()) return;
    try {
      setIsAddingNote(true);
      const targetId = selectedLead._id || selectedLead.id;
      setLastInteractedLeadId(targetId);
      const res = await fetch(`/api/leads/formatic/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_note',
          lastModifiedBy: activeUser || 'Système',
          note: {
            text: newNoteText.trim(),
            by: activeUser || 'Système'
          }
        })
      });

      if (!res.ok) throw new Error('Impossible d’ajouter la note');
      const updated = await res.json();
      setSelectedLead(updated);
      setLastInteractedLeadId(targetId);
      setNewNoteText('');
      mutate();
      showToast('Note ajoutée');
    } catch {
      showToast('Erreur lors de l’ajout de la note');
    } finally {
      setIsAddingNote(false);
    }
  };

  // Modification atomique d'une note
  const handleSaveEditedNote = async (noteId: string) => {
    if (!selectedLead || !editingNoteText.trim()) return;
    try {
      const targetId = selectedLead._id || selectedLead.id;
      const res = await fetch(`/api/leads/formatic/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_note',
          noteId,
          noteText: editingNoteText.trim(),
          lastModifiedBy: activeUser || 'Système'
        })
      });

      if (!res.ok) throw new Error('Impossible de modifier la note');
      const updated = await res.json();
      setSelectedLead(updated);
      setLastInteractedLeadId(targetId);
      setEditingNoteId(null);
      setEditingNoteText('');
      mutate();
      showToast('Note mise à jour');
    } catch {
      showToast('Erreur modification note');
    }
  };

  // Suppression atomique d'une note
  const handleDeleteNote = async (noteId: string) => {
    if (!selectedLead) return;
    try {
      const targetId = selectedLead._id || selectedLead.id;
      const res = await fetch(`/api/leads/formatic/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_note',
          noteId,
          lastModifiedBy: activeUser || 'Système'
        })
      });

      if (!res.ok) throw new Error('Impossible de supprimer la note');
      const updated = await res.json();
      setSelectedLead(updated);
      mutate();
      showToast('Note supprimée');
    } catch {
      showToast('Erreur suppression note');
    }
  };

  // Suppression d'un prospect
  const handleDeleteLead = async () => {
    if (!selectedLead) return;
    if (!isDeleteArmed) {
      setIsDeleteArmed(true);
      return;
    }

    try {
      const targetId = selectedLead._id || selectedLead.id;
      const res = await fetch(`/api/leads/formatic/${targetId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Erreur lors de la suppression');
      setSelectedLead(null);
      setShowUnsavedConfirm(false);
      mutate();
      showToast('Prospect supprimé');
    } catch {
      showToast('Erreur suppression prospect');
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    window.location.href = '/api/leads/formatic/export';
    showToast('Export Excel en cours...');
  };

  // Formatage téléphone
  const formatPhone = (p: string) => {
    const raw = (p || '').replace(/\D/g, '');
    if (raw.length === 8) {
      return `${raw.slice(0, 2)} ${raw.slice(2, 5)} ${raw.slice(5)}`;
    }
    return p || '—';
  };

  // Formatage date/heure FR
  const formatDateTimeFr = (d: any) => {
    if (!d) return '—';
    try {
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return String(d);
      return dateObj.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '—';
    }
  };

  return (
    <div data-crm="formatic" className="min-h-screen bg-[var(--bg)]">
      <EliosHeader 
        crumb="CRM Formatic" 
        activeUser={activeUser} 
        setActiveUser={handleUserChange} 
      />

      {/* Bandeau Vague Formatic */}
      <div className="cover" aria-hidden="true">
        <svg viewBox="0 0 800 44" preserveAspectRatio="none">
          <g fill="none" stroke="#fff" strokeWidth="1.2">
            <path d="M0 30C120 8 220 40 360 22S580 6 800 26"/>
            <path d="M0 38C140 18 240 44 380 30S600 14 800 34"/>
          </g>
        </svg>
      </div>

      <main className="page max-w-7xl mx-auto px-3 sm:px-6 pb-16">
        {/* Titre & Boutons d'action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[var(--card)] border border-[var(--line)] shadow-xs flex items-center justify-center text-[var(--acc)] flex-shrink-0">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {IC.users}
              </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink)]">CRM Formatic</h1>
              <p className="text-xs sm:text-sm text-[var(--ink2)]">
                Suivi des prospects, pipeline de conversion et rappels programmés.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
            <button className="btn flex-1 sm:flex-initial text-xs sm:text-sm py-2 px-3.5" type="button" onClick={handleExportExcel} title="Exporter la base Excel">
              <svg className="i" viewBox="0 0 24 24">{IC.dl}</svg>
              <span>Exporter Excel</span>
            </button>
            <button className="btn pri flex-1 sm:flex-initial text-xs sm:text-sm py-2 px-3.5" type="button" onClick={() => {
              setNewPhone('');
              setNewGrade('');
              setNewSection('');
              setNewErr('');
              setIsNewLeadOpen(true);
            }}>
              <svg className="i" viewBox="0 0 24 24">{IC.plus}</svg>
              <span>Nouveau prospect</span>
            </button>
          </div>
        </div>

        {/* Bandeau d'identification Opérateur Réel si non sélectionné */}
        {!activeUser && (
          <div className="mb-6 p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">👤</span>
              <div>
                <b className="text-xs sm:text-sm text-[var(--ink)] block">Sélectionnez votre profil opérateur pour commencer</b>
                <span className="text-[11px] sm:text-xs text-[var(--ink2)]">Chaque action sera signée avec votre vrai nom au lieu de "Système".</span>
              </div>
            </div>
            <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
              {safeOperators.map(op => {
                const opTheme = getOperatorColors(op.name, safeOperators);
                const isSelected = (activeUser || '').toLowerCase() === op.name.toLowerCase();
                return (
                  <button
                    key={op._id}
                    type="button"
                    onClick={() => handleUserChange(op.name)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer border ${
                      isSelected ? 'ring-2 ring-offset-1' : ''
                    }`}
                    style={{
                      backgroundColor: `color-mix(in srgb, ${opTheme.dot} ${isSelected ? '22%' : '10%'}, var(--card))`,
                      color: opTheme.dot,
                      borderColor: `color-mix(in srgb, ${opTheme.dot} ${isSelected ? '65%' : '30%'}, transparent)`
                    }}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opTheme.dot }}></span>
                    <span>{op.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 5 CARTES KPI FORMATIC (RAPPELS STRICTEMENT LA DERNIÈRE À DROITE) */}
        {/* ========================================================= */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4 mb-6" aria-label="Indicateurs KPI">
          {/* CARTE 1 : TOTAL PROSPECTS */}
          <button 
            className={`stat clickable ${activeCard === 'all' ? 'active-card' : ''}`}
            style={{ '--c': 'var(--acc)' } as React.CSSProperties}
            aria-pressed={activeCard === 'all'}
            onClick={() => handleCardClick('all')}
            type="button"
          >
            <small>Total prospects</small>
            <b className="text-xl sm:text-2xl">{stats.total.toLocaleString('fr-FR')}</b>
            <span className="text-xs">Base active globale</span>
            <i className="si"><svg className="i" viewBox="0 0 24 24">{IC.users}</svg></i>
          </button>

          {/* CARTE 2 : APPROVED */}
          <button 
            className={`stat clickable ${activeCard === 'approved' ? 'active-card' : ''}`}
            style={{ '--c': '#16A34A' } as React.CSSProperties}
            aria-pressed={activeCard === 'approved'}
            onClick={() => handleCardClick('approved')}
            type="button"
          >
            <small>Approved</small>
            <b className="text-xl sm:text-2xl" style={{ color: '#16A34A' }}>{stats.approved.toLocaleString('fr-FR')}</b>
            <span className="text-xs">Validés & Payés</span>
            <i className="si" style={{ color: '#16A34A', background: 'rgba(22, 163, 74, 0.12)' }}>
              <svg className="i" viewBox="0 0 24 24">{IC.ok}</svg>
            </i>
          </button>

          {/* CARTE 3 : POTENTIAL PROSPECT */}
          <button 
            className={`stat clickable ${activeCard === 'potential' ? 'active-card' : ''}`}
            style={{ '--c': '#0891B2' } as React.CSSProperties}
            aria-pressed={activeCard === 'potential'}
            onClick={() => handleCardClick('potential')}
            type="button"
          >
            <small>Potential Prospect</small>
            <b className="text-xl sm:text-2xl" style={{ color: '#0891B2' }}>{stats.potential.toLocaleString('fr-FR')}</b>
            <span className="text-xs">Forte Intention</span>
            <i className="si" style={{ color: '#0891B2', background: 'rgba(8, 145, 178, 0.12)' }}>
              <svg className="i" viewBox="0 0 24 24">{IC.up}</svg>
            </i>
          </button>

          {/* CARTE 4 : TO ELIOS (SPÉCIFIQUE FORMATIC) */}
          <button 
            className={`stat clickable ${activeCard === 'to_elios' ? 'active-card' : ''}`}
            style={{ '--c': '#6366F1' } as React.CSSProperties}
            aria-pressed={activeCard === 'to_elios'}
            onClick={() => handleCardClick('to_elios')}
            type="button"
          >
            <small>TO ELIOS</small>
            <b className="text-xl sm:text-2xl" style={{ color: '#6366F1' }}>{stats.toElios.toLocaleString('fr-FR')}</b>
            <span className="text-xs">Copiés vers Elios</span>
            <i className="si" style={{ color: '#6366F1', background: 'rgba(99, 102, 241, 0.12)' }}>
              <svg className="i" viewBox="0 0 24 24">{IC.share}</svg>
            </i>
          </button>

          {/* CARTE 5 : RAPPELS (DERNIÈRE CARTE À DROITE, COULEUR DISTINCTIVE FORMATIC) */}
          <button 
            className={`stat clickable ${activeCard === 'rappels' ? 'active-card' : ''}`}
            style={{ 
              '--c': '#5B45E0',
              background: 'color-mix(in srgb, #5B45E0 6%, var(--card))',
              borderColor: activeCard === 'rappels' ? '#5B45E0' : 'color-mix(in srgb, #5B45E0 35%, var(--line))'
            } as React.CSSProperties}
            aria-pressed={activeCard === 'rappels'}
            onClick={() => handleCardClick('rappels')}
            type="button"
          >
            <small>Rappels</small>
            <b className="text-xl sm:text-2xl" style={{ color: '#5B45E0' }}>{stats.rappels.toLocaleString('fr-FR')}</b>
            <span className="text-xs">A Relancer</span>
            <i className="si" style={{ color: '#5B45E0', background: 'rgba(91, 69, 224, 0.12)' }}>
              <svg className="i" viewBox="0 0 24 24">{IC.bell}</svg>
            </i>
          </button>
        </section>

        {/* Barre de Filtres Complète & Responsive */}
        <div className="bg-[var(--card)] border border-[var(--line)] rounded-2xl p-3 sm:p-4 shadow-xs mb-4">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Recherche textuelle */}
            <div className="sb flex-1 min-w-[220px] w-full sm:w-auto">
              <svg className="i pointer-events-none" viewBox="0 0 24 24">
                {IC.search}
              </svg>
              <input 
                id="search-box" 
                type="search" 
                placeholder="Rechercher nom, prénom, téléphone, groupe…" 
                autoComplete="off"
                className="w-full text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)]"
                value={filterQuery}
                onChange={(e) => {
                  setFilterQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Filtre STATUS */}
            <div className="w-full sm:w-auto">
              <select 
                id="filter-status"
                aria-label="Statut"
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  if (activeCard === 'rappels' || activeCard === 'to_elios') setActiveCard(null);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)]"
              >
                <option value="ALL">Statut : Tous</option>
                {FORMATIC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Filtre CLASSE */}
            <div className="w-full sm:w-auto">
              <select 
                id="filter-classe"
                aria-label="Classe"
                value={filterClasse}
                onChange={(e) => {
                  setFilterClasse(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)]"
              >
                <option value="ALL">Classe : Toutes</option>
                {FORMATIC_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Filtre SECTION */}
            <div className="w-full sm:w-auto">
              <select 
                id="filter-section"
                aria-label="Section"
                value={filterSection}
                onChange={(e) => {
                  setFilterSection(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)]"
              >
                <option value="ALL">Section : Toutes</option>
                {FORMATIC_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Filtre STAFF */}
            <div className="w-full sm:w-auto">
              <select 
                id="filter-staff"
                aria-label="Staff"
                value={filterStaff}
                onChange={(e) => {
                  setFilterStaff(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)]"
              >
                <option value="ALL">Staff : Tous</option>
                {availableStaff.map(staffName => (
                  <option key={staffName} value={staffName}>{staffName}</option>
                ))}
              </select>
            </div>

            {/* Filtre DATE */}
            <div className="w-full sm:w-auto">
              <select 
                id="filter-date"
                aria-label="Période"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)]"
              >
                <option value="ALL">Date : Toutes</option>
                <option value="today">Aujourd'hui</option>
                <option value="week">Cette semaine (7 jours)</option>
                <option value="month">Ce mois-ci</option>
                <option value="custom">Période personnalisée</option>
              </select>
            </div>

            {/* Sélecteurs de date personnalisée */}
            {filterDate === 'custom' && (
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <input 
                  type="date" 
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="py-1.5 px-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--card)] flex-1 sm:flex-initial"
                  title="Date début"
                />
                <span className="text-xs text-[var(--ink3)]">à</span>
                <input 
                  type="date" 
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="py-1.5 px-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--card)] flex-1 sm:flex-initial"
                  title="Date fin"
                />
              </div>
            )}

            {/* Bouton Reset */}
            {isFiltered && (
              <button 
                type="button" 
                onClick={handleResetFilters}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[var(--hover)] hover:bg-[var(--line)] text-[var(--ink2)] transition ml-auto"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* Compteur et info filtres */}
        <div className="flex items-center justify-between text-xs text-[var(--ink3)] mb-3 px-1">
          <div>
            {isFiltered ? (
              <span>
                <strong className="text-[var(--ink)]">{filteredLeads.length.toLocaleString('fr-FR')}</strong> résultat{filteredLeads.length > 1 ? 's' : ''} sur {leads?.length || 0}
                {activeCard === 'rappels' && <span className="ml-2 font-semibold text-[#5B45E0]">(Mode Rappels)</span>}
                {activeCard === 'to_elios' && <span className="ml-2 font-semibold text-indigo-600">(Filtre TO ELIOS)</span>}
              </span>
            ) : (
              <span>Affichage de <strong>{leads?.length || 0}</strong> prospects</span>
            )}
          </div>
          <span>Page {currentPage} sur {totalPages}</span>
        </div>

        {/* ========================================================= */}
        {/* TABLEAU DES PROSPECTS (RESPONSIVE TABLET / DESKTOP) */}
        {/* ========================================================= */}
        <div className="hidden md:block tbl">
          <div className="th">
            <div>Prospect</div>
            <div>Téléphone</div>
            <div>Classe & Section</div>
            <div>Statut</div>
            <div>Dernière modification</div>
            <div>Actions</div>
          </div>

          <div id="rows">
            {paginatedLeads.length > 0 ? (
              paginatedLeads.map((l, n) => {
                const modifierName = (l.lastModifiedBy && l.lastModifiedBy !== 'Système')
                  ? l.lastModifiedBy
                  : (l.staff && l.staff !== 'Système' ? l.staff : (l.lastModifiedBy || l.staff || 'Non assigné'));
                const opTheme = getOperatorColors(modifierName, safeOperators);
                const lastUpdatedDateStr = formatDateTimeFr(l.updatedAt || l.date);
                const classSec = [l.grade, l.section].filter(Boolean).join(" · ") || "—";
                const hasFullName = Boolean(l.name && l.name.trim() && l.name !== 'Prospect sans nom');
                const isOverdueRappel = isLeadInRappels(l);
                const statusColor = FORMATIC_STATUS_COLORS[l.status] || '#77766F';
                const isLastModified = Boolean(effectiveLastModifiedId && (l._id === effectiveLastModifiedId || l.id === effectiveLastModifiedId));
                const isRappelFilterActive = activeCard === 'rappels';

                return (
                  <div 
                    key={l._id || l.id} 
                    className={`tr hover:bg-[var(--hover)] transition ${isLastModified ? 'is-last-modified' : ''}`}
                    style={{ '--i': n } as React.CSSProperties}
                    onClick={() => {
                      setSelectedLead(l);
                      setLastInteractedLeadId(l._id || l.id);
                    }}
                  >
                    {/* Nom et Initiale (SANS LA REFERENCE PRO-XXXXX) */}
                    <div className="c1">
                      <span className="ini">{getInitials(l.name, l.firstName, l.lastName)}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isRappelFilterActive && (
                            <span 
                              className="rappel-beacon" 
                              title="Filtre Rappel actif : relance prioritaire requise pour cet élève"
                            >
                              <span className="rappel-beacon-ping"></span>
                              <span className="rappel-beacon-dot"></span>
                            </span>
                          )}
                          <b className={hasFullName ? "text-[var(--ink)]" : "nn text-[var(--ink3)]"}>
                            {hasFullName ? l.name : "Nom non renseigné"}
                          </b>
                          {isLastModified && (
                            <span 
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide"
                              style={{
                                backgroundColor: 'color-mix(in srgb, var(--acc, #5B45E0) 16%, transparent)',
                                color: 'var(--acc, #5B45E0)',
                                border: '1px solid color-mix(in srgb, var(--acc, #5B45E0) 32%, transparent)',
                              }}
                              title="Dernière modification enregistrée"
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--acc, #5B45E0)' }}></span>
                              Dernière modification
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {l.familyGroup && (
                            <span className="text-[11px] text-[var(--acc)] font-medium truncate" title={`Groupe : ${l.familyGroup}`}>
                              👪 {l.familyGroup}
                            </span>
                          )}
                          {Boolean(l.toElios) && (
                            <span className="text-[10px] text-indigo-600 font-bold inline-flex items-center gap-0.5" title="Copié vers CRM Elios">
                              To Elios
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Téléphone */}
                    <div className="num font-mono text-sm" data-l="Téléphone">
                      {formatPhone(l.phone)}
                    </div>

                    {/* Classe et Section */}
                    <div data-l="Classe & Section" className="text-sm">
                      {classSec}
                    </div>

                    {/* Statut + Badge Rappel si délai dépassé */}
                    <div data-l="Statut" className="flex items-center gap-2">
                      <span className="st" style={{ '--s': statusColor } as React.CSSProperties}>
                        {l.status}
                      </span>
                      {isOverdueRappel && (
                        <span 
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/15 text-amber-600 border border-amber-500/30 flex items-center gap-1"
                          title={`Délai dépassé (${getRappelsDelayDays(l)}j depuis la dernière mise à jour)`}
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            {IC.bell}
                          </svg>
                          Rappel
                        </span>
                      )}
                    </div>

                    {/* Dernière modification : Opérateur et Date */}
                    <div data-l="Dernière modif" className="text-xs">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span 
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition shadow-2xs"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${opTheme.dot} 14%, var(--card))`,
                            color: opTheme.dot,
                            border: `1px solid color-mix(in srgb, ${opTheme.dot} 32%, transparent)`
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: opTheme.dot }}></span>
                          <span className="truncate max-w-[120px]">{modifierName}</span>
                        </span>
                      </div>
                      <span className="text-[var(--ink3)] block">{lastUpdatedDateStr}</span>
                    </div>

                    {/* Actions : Fiche + WhatsApp */}
                    <div className="act">
                      <button 
                        className="ib" 
                        type="button"
                        title="Ouvrir la fiche" 
                        aria-label="Ouvrir la fiche"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLead(l);
                        }}
                      >
                        <svg className="i" viewBox="0 0 24 24">{IC.open}</svg>
                      </button>
                      <a 
                        className="ib wa" 
                        href={`https://wa.me/216${(l.phone || '').replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        title="WhatsApp" 
                        aria-label="WhatsApp"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="i" viewBox="0 0 24 24">{IC.chat}</svg>
                      </a>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty p-12 text-center text-[var(--ink3)]">
                <b className="block text-base text-[var(--ink)] mb-1">Aucun prospect ne correspond à ces critères.</b>
                Modifiez vos termes de recherche ou réinitialisez les filtres.
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* CARTE RESPONSIVE MOBILE (< 768px) POUR ERGONOMIE PARFAITE */}
        {/* ========================================================= */}
        <div className="md:hidden space-y-2.5">
          {paginatedLeads.length > 0 ? (
            paginatedLeads.map((l) => {
              const modifierName = (l.lastModifiedBy && l.lastModifiedBy !== 'Système')
                ? l.lastModifiedBy
                : (l.staff && l.staff !== 'Système' ? l.staff : (l.lastModifiedBy || l.staff || 'Non assigné'));
              const opTheme = getOperatorColors(modifierName, safeOperators);
              const lastUpdatedDateStr = formatDateTimeFr(l.updatedAt || l.date);
              const classSec = [l.grade, l.section].filter(Boolean).join(" · ") || "—";
              const hasFullName = Boolean(l.name && l.name.trim() && l.name !== 'Prospect sans nom');
              const isOverdueRappel = isLeadInRappels(l);
              const statusColor = FORMATIC_STATUS_COLORS[l.status] || '#77766F';
              const isLastModified = Boolean(effectiveLastModifiedId && (l._id === effectiveLastModifiedId || l.id === effectiveLastModifiedId));
              const isRappelFilterActive = activeCard === 'rappels';

              return (
                <div 
                  key={l._id || l.id}
                  onClick={() => {
                    setSelectedLead(l);
                    setLastInteractedLeadId(l._id || l.id);
                  }}
                  className={`bg-[var(--card)] p-3.5 rounded-2xl border border-[var(--line)] shadow-xs active:bg-[var(--hover)] transition ${isLastModified ? 'card-last-modified' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-[var(--acc-s)] text-[var(--acc)] font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {getInitials(l.name, l.firstName, l.lastName)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isRappelFilterActive && (
                            <span 
                              className="rappel-beacon" 
                              title="Filtre Rappel actif : relance prioritaire requise pour cet élève"
                            >
                              <span className="rappel-beacon-ping"></span>
                              <span className="rappel-beacon-dot"></span>
                            </span>
                          )}
                          <b className={`text-sm block truncate ${hasFullName ? 'text-[var(--ink)]' : 'text-[var(--ink3)]'}`}>
                            {hasFullName ? l.name : "Nom non renseigné"}
                          </b>
                          {isLastModified && (
                            <span 
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide"
                              style={{
                                backgroundColor: 'color-mix(in srgb, var(--acc, #5B45E0) 16%, transparent)',
                                color: 'var(--acc, #5B45E0)',
                                border: '1px solid color-mix(in srgb, var(--acc, #5B45E0) 32%, transparent)',
                              }}
                              title="Dernière modification enregistrée"
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--acc, #5B45E0)' }}></span>
                              Dernière modification
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {l.familyGroup && (
                            <span className="text-[10px] text-[var(--acc)] font-medium block truncate">
                              👪 {l.familyGroup}
                            </span>
                          )}
                          {Boolean(l.toElios) && (
                            <span className="text-[10px] text-indigo-600 font-bold block truncate">
                              To Elios
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="st text-[11px] py-0.5 px-2" style={{ '--s': statusColor } as React.CSSProperties}>
                      {l.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[var(--ink2)] py-1.5 border-y border-[var(--line)]/50">
                    <span className="font-mono">{formatPhone(l.phone)}</span>
                    <span>{classSec}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="text-[11px] text-[var(--ink3)] flex items-center gap-1.5">
                      <span 
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold transition"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${opTheme.dot} 14%, var(--card))`,
                          color: opTheme.dot,
                          border: `1px solid color-mix(in srgb, ${opTheme.dot} 32%, transparent)`
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: opTheme.dot }}></span>
                        <span className="truncate max-w-[100px]">{modifierName}</span>
                      </span>
                      <span>{lastUpdatedDateStr}</span>
                      {isOverdueRappel && (
                        <span className="text-[10px] text-amber-600 font-bold bg-amber-500/15 px-1 rounded">Rappel</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <a 
                        className="ib wa w-7 h-7"
                        href={`https://wa.me/216${(l.phone || '').replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        title="WhatsApp"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{IC.chat}</svg>
                      </a>
                      <button 
                        className="ib w-7 h-7" 
                        type="button" 
                        onClick={() => setSelectedLead(l)}
                        title="Ouvrir"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{IC.open}</svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-[var(--ink3)] bg-[var(--card)] rounded-2xl border border-[var(--line)]">
              Aucun prospect Formatic trouvé.
            </div>
          )}
        </div>

        {/* Barre de Pagination Avancée avec Possibilité de Choisir Directement la Page */}
        {totalPages > 1 && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t border-[var(--line)] px-2 text-xs text-[var(--ink2)]">
            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
              <span className="text-[var(--ink3)]">
                Affichage {((currentPage - 1) * pageSize + 1).toLocaleString('fr-FR')} - {Math.min(currentPage * pageSize, filteredLeads.length).toLocaleString('fr-FR')} sur {filteredLeads.length.toLocaleString('fr-FR')} prospects
              </span>
              <span className="hidden sm:inline text-[var(--line)]">|</span>
              <div className="flex items-center gap-1.5">
                <label htmlFor="formatic-page-select" className="text-[var(--ink3)] whitespace-nowrap font-medium">
                  Aller à la page :
                </label>
                <select
                  id="formatic-page-select"
                  value={currentPage}
                  onChange={(e) => setCurrentPage(Number(e.target.value))}
                  className="py-1 px-2.5 text-xs font-semibold rounded-lg border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] cursor-pointer hover:border-[var(--acc)] transition focus:outline-none focus:ring-1 focus:ring-[var(--acc)] shadow-2xs"
                >
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <option key={p} value={p}>
                      Page {p} sur {totalPages}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-wrap justify-center">
              <button
                type="button"
                className="btn py-1 px-2 text-xs font-medium"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                title="Première page"
              >
                «
              </button>
              <button
                type="button"
                className="btn py-1 px-2.5 text-xs font-medium"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                Précédent
              </button>

              {getPageNumbers(currentPage, totalPages).map((p, idx) => (
                p === '...' ? (
                  <span key={`dots-${idx}`} className="px-1 text-[var(--ink3)] select-none">...</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`py-1 px-2.5 text-xs font-semibold rounded-lg transition ${
                      currentPage === p
                        ? 'bg-[var(--acc)] text-white shadow-xs'
                        : 'hover:bg-[var(--hover)] text-[var(--ink)] border border-transparent'
                    }`}
                    onClick={() => setCurrentPage(Number(p))}
                  >
                    {p}
                  </button>
                )
              ))}

              <button
                type="button"
                className="btn py-1 px-2.5 text-xs font-medium"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                Suivant
              </button>
              <button
                type="button"
                className="btn py-1 px-2 text-xs font-medium"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                title="Dernière page"
              >
                »
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* MODALE : NOUVEAU PROSPECT FORMATIC (MINIMALISTE & STRICT) */}
      {/* ========================================================= */}
      {isNewLeadOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsNewLeadOpen(false);
          }}
        >
          <div className="max-w-md w-full p-5 sm:p-6 bg-[var(--card)] rounded-2xl shadow-xl border border-[var(--line)]">
            <div className="flex items-center justify-between pb-3.5 border-b border-[var(--line)]">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[var(--ink)]">Nouveau prospect Formatic</h2>
                <p className="text-xs text-[var(--ink3)]">Enregistrement immédiat dans le CRM Formatic</p>
              </div>
              <button className="text-[var(--ink3)] hover:text-[var(--ink)] p-1" type="button" aria-label="Fermer" onClick={() => setIsNewLeadOpen(false)}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{IC.x}</svg>
              </button>
            </div>

            <form onSubmit={handleCreateLead} noValidate className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink2)] mb-1">
                  Numéro de téléphone
                </label>
                <input 
                  id="new-phone-formatic" 
                  inputMode="tel" 
                  placeholder="Ex : 20 123 456" 
                  autoComplete="off"
                  maxLength={8}
                  required
                  value={newPhone}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 8);
                    setNewPhone(raw);
                    if (newErr) setNewErr('');
                  }}
                  className={`w-full text-base font-mono py-2 px-3 rounded-xl border ${newErr ? 'border-red-500' : 'border-[var(--line)]'} bg-[var(--card)] text-[var(--ink)]`}
                />
                {newPhone.length > 0 && (
                  <div className="flex justify-end mt-1 text-[11px]">
                    <span className={newPhone.length === 8 ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                      {newPhone.length === 8 ? "✓ Valide" : `${newPhone.length} / 8`}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink2)] mb-1">Classe</label>
                  <select 
                    value={newGrade}
                    onChange={(e) => setNewGrade(e.target.value)}
                    className="w-full py-2 px-2.5 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"
                  >
                    <option value="">Sélectionner…</option>
                    {FORMATIC_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--ink2)] mb-1">Section</label>
                  <select 
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    className="w-full py-2 px-2.5 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"
                  >
                    <option value="">Sélectionner…</option>
                    {FORMATIC_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {newErr && <p className="text-xs text-red-500 font-semibold">{newErr}</p>}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
                <button type="button" className="btn text-xs py-1.5 px-3" onClick={() => setIsNewLeadOpen(false)}>
                  Annuler
                </button>
                <button className="btn pri text-xs py-1.5 px-3" type="submit" disabled={isCreating}>
                  {isCreating ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALE : FICHE PROSPECT FORMATIC AVEC CASE À COCHER TO ELIOS */}
      {/* ========================================================= */}
      {selectedLead && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleRequestCloseFiche();
          }}
        >
          <div className="max-w-3xl w-full max-h-[92vh] flex flex-col bg-[var(--card)] rounded-2xl shadow-2xl border border-[var(--line)] overflow-hidden animate-pop">
            
            {/* EN-TETE MODERNE (AVATAR CERCLE + NOM + LABEL STATUT + BADGE TO ELIOS) */}
            <div className="p-4 sm:p-5 border-b border-[var(--line)] bg-[var(--card)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[var(--acc-s)] text-[var(--acc)] border border-[var(--acc)]/30 flex items-center justify-center font-bold text-sm sm:text-base flex-shrink-0 shadow-2xs">
                  {getInitials(selectedLead.name, editFirst, editLast)}
                </div>
                
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] truncate">
                      {[editFirst, editLast].filter(Boolean).join(' ') || selectedLead.name || 'Prospect sans nom'}
                    </h2>

                    {/* LABEL STATUT PUR */}
                    <span 
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${FORMATIC_STATUS_COLORS[editStatus] || '#77766F'} 14%, transparent)`,
                        color: FORMATIC_STATUS_COLORS[editStatus] || '#77766F'
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: FORMATIC_STATUS_COLORS[editStatus] || '#77766F' }}></span>
                      {editStatus}
                    </span>

                    {/* Badge Rappel si délai dépassé */}
                    {isLeadInRappels(selectedLead) && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                        ⚠️ Rappel
                      </span>
                    )}

                    {/* Badge To Elios si actif */}
                    {editToElios && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/15 text-indigo-600 border border-indigo-500/30 flex items-center gap-1 shadow-2xs">
                        <span>To Elios</span>
                      </span>
                    )}
                  </div>

                  <span className="font-mono text-xs text-[var(--ink3)] block mt-0.5">
                    {formatPhone(editPhone)}
                  </span>
                </div>
              </div>

              <button 
                className="text-[var(--ink3)] hover:text-[var(--ink)] p-1.5 rounded-xl hover:bg-[var(--hover)] transition"
                type="button" 
                aria-label="Fermer" 
                onClick={handleRequestCloseFiche}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{IC.x}</svg>
              </button>
            </div>

            {/* CORPS DE LA MODALE SCROLLABLE */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              
              {/* Case à cocher TO ELIOS (compacte, sans explication) */}
              <label className="inline-flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 transition shadow-2xs w-fit">
                <input 
                  type="checkbox"
                  checked={editToElios}
                  onChange={(e) => setEditToElios(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                />
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  TO ELIOS
                </span>
              </label>

              {/* Grille des informations prospect */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                <label className="text-xs font-semibold text-[var(--ink2)] flex flex-col gap-1">
                  Prénom
                  <input 
                    value={editFirst} 
                    onChange={(e) => setEditFirst(e.target.value)}
                    placeholder="Ex : Mohamed"
                    className="py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"
                  />
                </label>

                <label className="text-xs font-semibold text-[var(--ink2)] flex flex-col gap-1">
                  Nom
                  <input 
                    value={editLast} 
                    onChange={(e) => setEditLast(e.target.value)}
                    placeholder="Ex : Ben Ali"
                    className="py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"
                  />
                </label>

                <label className="text-xs font-semibold text-[var(--ink2)] flex flex-col gap-1">
                  Téléphone
                  <div className="flex gap-2">
                    <input 
                      inputMode="tel" 
                      maxLength={8}
                      value={editPhone} 
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '').slice(0, 8);
                        setEditPhone(raw);
                      }}
                      className="py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] flex-1 font-mono"
                    />
                    <a 
                      className="p-2 rounded-xl border border-[var(--line)] bg-[var(--card)] hover:bg-emerald-500/15 hover:text-emerald-600 text-emerald-600 transition flex items-center justify-center flex-shrink-0 shadow-2xs"
                      href={editPhone.trim() ? `tel:+216${editPhone.replace(/\D/g, '')}` : '#'} 
                      title="Appeler le client" 
                      aria-label="Appeler le client"
                      onClick={(e) => {
                        if (!editPhone.trim()) e.preventDefault();
                      }}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{IC.phone}</svg>
                    </a>
                  </div>
                </label>

                <label className="text-xs font-semibold text-[var(--ink2)] flex flex-col gap-1">
                  Statut
                  <select 
                    value={editStatus} 
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] font-semibold"
                  >
                    {FORMATIC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>

                <label className="text-xs font-semibold text-[var(--ink2)] flex flex-col gap-1">
                  Source
                  <select 
                    value={editSource} 
                    onChange={(e) => setEditSource(e.target.value)}
                    className="py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"
                  >
                    {FORMATIC_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>

                <label className="text-xs font-semibold text-[var(--ink2)] flex flex-col gap-1">
                  Classe
                  <select 
                    value={editGrade} 
                    onChange={(e) => setEditGrade(e.target.value)}
                    className="py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"
                  >
                    <option value="">Sélectionner…</option>
                    {FORMATIC_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>

                <label className="text-xs font-semibold text-[var(--ink2)] flex flex-col gap-1">
                  Section
                  <select 
                    value={editSection} 
                    onChange={(e) => setEditSection(e.target.value)}
                    className="py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"
                  >
                    <option value="">Sélectionner…</option>
                    {FORMATIC_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>

                <label className="text-xs font-semibold text-[var(--ink2)] flex flex-col gap-1">
                  Offre
                  <select 
                    value={editOffer} 
                    onChange={(e) => setEditOffer(e.target.value)}
                    className="py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"
                  >
                    <option value="">Aucune</option>
                    {FORMATIC_OFFERS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>

                <label className="text-xs font-semibold text-[var(--ink2)] flex flex-col gap-1">
                  Montant payé (DT)
                  <input 
                    inputMode="decimal" 
                    placeholder="Ex : 500"
                    value={editAmount} 
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] font-mono"
                  />
                </label>

                {/* CHAMP : FAMILY GROUP (FACULTATIF) */}
                <label className="text-xs font-semibold text-[var(--ink2)] flex flex-col gap-1 col-span-full">
                  Family Group (Facultatif)
                  <input 
                    value={editFamilyGroup} 
                    onChange={(e) => setEditFamilyGroup(e.target.value)}
                    placeholder="Ex : Famille Ben Ali / Groupe 1"
                    className="py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"
                  />
                </label>
              </div>

              {editErr && <p className="text-xs text-red-500 font-semibold" role="alert">{editErr}</p>}

              {/* Section Notes & Historique avec Concurrence Atomique */}
              <section className="bg-[var(--hover)] p-3.5 sm:p-4 rounded-2xl border border-[var(--line)]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs sm:text-sm font-bold text-[var(--ink)]">Historique des notes</h3>
                  <small className="text-xs text-[var(--ink3)]">
                    {selectedLead.notes?.length || 0} note{(selectedLead.notes?.length || 0) > 1 ? 's' : ''}
                  </small>
                </div>

                {/* Liste des notes */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {selectedLead.notes && selectedLead.notes.length > 0 ? (
                    selectedLead.notes.map((n: any, idx: number) => {
                      const noteId = n.id || `n-${idx}`;
                      const author = n.by || n.addedBy || 'Système';
                      const authorTheme = getOperatorColors(author, safeOperators);
                      const isBeingEdited = editingNoteId === noteId;

                      return (
                        <div key={noteId} className="bg-[var(--card)] p-2.5 sm:p-3 rounded-xl border border-[var(--line)] shadow-2xs">
                          <header className="flex items-center justify-between text-xs mb-1">
                            <span 
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold transition"
                              style={{
                                backgroundColor: `color-mix(in srgb, ${authorTheme.dot} 14%, var(--card))`,
                                color: authorTheme.dot,
                                border: `1px solid color-mix(in srgb, ${authorTheme.dot} 32%, transparent)`
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: authorTheme.dot }}></span>
                              <span>{author}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <small className="text-[10px] sm:text-xs text-[var(--ink3)]">
                                {formatDateTimeFr(n.addedAt || n.date)}
                              </small>
                              <button 
                                type="button" 
                                onClick={() => {
                                  setEditingNoteId(noteId);
                                  setEditingNoteText(n.text || '');
                                }}
                                className="text-[var(--ink3)] hover:text-[var(--acc)] p-0.5"
                                title="Modifier"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{IC.edit}</svg>
                              </button>
                              <button 
                                type="button" 
                                onClick={() => handleDeleteNote(noteId)}
                                className="text-[var(--ink3)] hover:text-red-500 p-0.5"
                                title="Supprimer"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{IC.trash}</svg>
                              </button>
                            </div>
                          </header>

                          {isBeingEdited ? (
                            <div className="mt-2 space-y-2">
                              <textarea 
                                value={editingNoteText}
                                onChange={(e) => setEditingNoteText(e.target.value)}
                                className="w-full text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--hover)]"
                                rows={2}
                              />
                              <div className="flex justify-end gap-1">
                                <button 
                                  type="button" 
                                  className="btn py-0.5 px-2 text-xs" 
                                  onClick={() => setEditingNoteId(null)}
                                >
                                  Annuler
                                </button>
                                <button 
                                  type="button" 
                                  className="btn pri py-0.5 px-2 text-xs" 
                                  onClick={() => handleSaveEditedNote(noteId)}
                                >
                                  Enregistrer
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-[var(--ink)] leading-relaxed whitespace-pre-wrap">{n.text}</p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-[var(--ink3)] italic py-2">Aucune note enregistrée pour ce prospect.</p>
                  )}
                </div>

                {/* Zone d'ajout d'une nouvelle note */}
                <div className="mt-3 pt-3 border-t border-[var(--line)]">
                  <textarea 
                    placeholder={`Ajouter une note (signé par ${activeUser || 'Système'})…`}
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"
                    rows={2}
                  />
                  <div className="flex justify-end mt-2">
                    <button 
                      className="btn text-xs font-semibold py-1.5 px-3" 
                      type="button" 
                      onClick={handleAddNote}
                      disabled={!newNoteText.trim() || isAddingNote}
                    >
                      {isAddingNote ? 'Ajout...' : 'Ajouter la note'}
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {/* PIED DE MODALE RESPONSIVE */}
            <div className="p-3 sm:p-4 border-t border-[var(--line)] bg-[var(--card)] flex flex-wrap items-center justify-between gap-2.5">
              <button 
                className={`btn del text-xs py-1.5 px-3 ${isDeleteArmed ? 'armed bg-red-600 text-white' : ''}`} 
                type="button" 
                onClick={handleDeleteLead}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{IC.trash}</svg>
                <span>{isDeleteArmed ? 'Confirmer ?' : 'Supprimer'}</span>
              </button>

              <div className="flex items-center gap-2 ml-auto">
                <button 
                  type="button" 
                  onClick={() => triggerWhatsAppPopup([editFirst.trim(), editLast.trim()].filter(Boolean).join(' ') || selectedLead.name, editPhone, editStatus)}
                  className="btn text-xs py-1.5 px-3 hover:bg-emerald-500 hover:text-white transition flex items-center gap-1.5"
                  title="Envoyer un message WhatsApp avec aperçu"
                >
                  <svg className="w-3.5 h-3.5 text-emerald-500 hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {IC.chat}
                  </svg>
                  <span>WhatsApp</span>
                </button>

                <button className="btn text-xs py-1.5 px-3" type="button" onClick={handleRequestCloseFiche}>
                  Annuler
                </button>

                <button 
                  className="btn pri text-xs py-1.5 px-3 font-semibold" 
                  type="button" 
                  onClick={handleSaveLead}
                  disabled={isSaving}
                >
                  {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE ALERTE DIRTY GUARD */}
      {showUnsavedConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs">
          <div className="box max-w-md w-full p-5 sm:p-6 bg-[var(--card)] rounded-2xl shadow-2xl border border-amber-500/40">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 flex-shrink-0">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {IC.warning}
                </svg>
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[var(--ink)]">Modifications non enregistrées !</h3>
                <p className="text-xs text-[var(--ink2)] mt-1 leading-relaxed">
                  Vous avez des modifications en cours pour ce prospect. Voulez-vous quitter sans enregistrer ou enregistrer vos modifications ?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-[var(--line)]">
              <button 
                type="button" 
                className="btn text-xs text-red-600 hover:bg-red-500/10 py-1.5 px-3"
                onClick={() => {
                  setShowUnsavedConfirm(false);
                  setSelectedLead(null);
                }}
              >
                Quitter
              </button>
              <button 
                type="button" 
                className="btn text-xs py-1.5 px-3"
                onClick={() => setShowUnsavedConfirm(false)}
              >
                Continuer
              </button>
              <button 
                type="button" 
                className="btn pri text-xs font-semibold py-1.5 px-3"
                onClick={handleSaveLead}
              >
                Enregistrer et quitter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale d'envoi WhatsApp automatique & responsive */}
      <WhatsAppDispatchModal
        isOpen={whatsAppModal.isOpen}
        onClose={() => setWhatsAppModal(prev => ({ ...prev, isOpen: false }))}
        studentName={whatsAppModal.studentName}
        studentPhone={whatsAppModal.studentPhone}
        targetStatus={whatsAppModal.targetStatus}
        defaultMessage={whatsAppModal.message}
        onSent={() => showToast('WhatsApp ouvert avec succès !')}
      />

      {/* Notification Toast */}
      {toastMsg && (
        <aside className="toast on" role="status" aria-live="polite">
          {toastMsg}
        </aside>
      )}
    </div>
  );
}
