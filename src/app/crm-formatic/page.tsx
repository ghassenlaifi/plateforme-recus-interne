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
  getRappelsDelayDays,
  isClassWithoutSection,
  getFormaticStatusColor,
  getLeadLastModifier,
  isLeadTouchedByStaff,
  extractAllLeadStaff,
  isLeadMatchingStaffAndDate
} from '@/types/crm';
import { WhatsAppDispatchModal } from '@/components/WhatsAppDispatchModal';
import { PaymentMethod, WhatsAppTemplates, DEFAULT_PAYMENT_METHODS, DEFAULT_WHATSAPP_TEMPLATES } from '@/types/settings';
import { buildApprovedProspectMessage, buildNaMessage } from '@/lib/whatsappHelper';
import { formatPhone, extractPhoneDigits, normalizePhoneForUrl } from '@/lib/phoneUtils';

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

  // Modales & Fiche Prospect
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [lastInteractedLeadId, setLastInteractedLeadId] = useState<string | null>(null);

  // Récupération des données Formatic depuis MongoDB Atlas avec rafraîchissement temps réel
  const { data: leads, mutate } = useSWR<LeadItem[]>('/api/leads/formatic', fetcher, {
    refreshInterval: selectedLead ? 2000 : 4000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true
  });
  const { data: operators } = useSWR<Operator[]>('/api/operators', fetcher);
  const safeOperators = useMemo(() => Array.isArray(operators) ? operators : [], [operators]);

  // Liste exhaustive de tous les opérateurs réels
  const availableStaff = useMemo(() => {
    const set = new Set<string>();
    safeOperators.forEach(o => {
      if (o.name && o.name.trim() && o.name !== 'Système' && o.name !== 'Non assigné') {
        set.add(o.name.trim());
      }
    });
    if (Array.isArray(leads)) {
      leads.forEach(l => {
        const staffList = extractAllLeadStaff(l);
        staffList.forEach(s => set.add(s));
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
    frenchMessage?: string;
    arabicMessage?: string;
  }>({
    isOpen: false,
    studentName: '',
    studentPhone: '',
    targetStatus: '',
    message: '',
    frenchMessage: '',
    arabicMessage: ''
  });

  // Données de configuration pour WhatsApp et Modes de paiement
  const { data: paymentsConfig } = useSWR<{ methods: PaymentMethod[] }>('/api/settings/payments', fetcher);
  const { data: whatsappConfig } = useSWR<{ templates: WhatsAppTemplates }>('/api/settings/whatsapp', fetcher, { revalidateOnFocus: true });

  const paymentMethods = useMemo(() => paymentsConfig?.methods || DEFAULT_PAYMENT_METHODS, [paymentsConfig]);
  const whatsappTemplates = useMemo(() => whatsappConfig?.templates || DEFAULT_WHATSAPP_TEMPLATES, [whatsappConfig]);

  const triggerWhatsAppPopup = (studentName: string, phone: string, status: string) => {
    let msgFr = '';
    let msgAr = '';
    const st = (status || '').trim().toLowerCase();
    if (st === 'approved prospect') {
      msgFr = buildApprovedProspectMessage(
        whatsappTemplates.approvedProspectHeader,
        whatsappTemplates.approvedProspectFooter,
        studentName,
        paymentMethods,
        'fr'
      );
      msgAr = buildApprovedProspectMessage(
        whatsappTemplates.approvedProspectHeader_ar || DEFAULT_WHATSAPP_TEMPLATES.approvedProspectHeader_ar,
        whatsappTemplates.approvedProspectFooter_ar || DEFAULT_WHATSAPP_TEMPLATES.approvedProspectFooter_ar,
        studentName,
        paymentMethods,
        'ar'
      );
    } else if (st === 'n/a') {
      msgFr = buildNaMessage(whatsappTemplates.naMessage, studentName, 'fr');
      msgAr = buildNaMessage(whatsappTemplates.naMessage_ar || DEFAULT_WHATSAPP_TEMPLATES.naMessage_ar, studentName, 'ar');
    } else {
      msgFr = `Bonjour ${studentName || ''},\n\nNous vous contactons de la part de Formatic concernant votre inscription.`;
      msgAr = `مرحباً ${studentName || ''}،\n\nنتواصل معكم من Formatic بخصوص طلب تسجيلكم.`;
    }

    setWhatsAppModal({
      isOpen: true,
      studentName,
      studentPhone: phone,
      targetStatus: status,
      message: msgFr,
      frenchMessage: msgFr,
      arabicMessage: msgAr
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

  const openedLeadIdRef = useRef<string | null>(null);

  // Synchronisation des champs d'édition lors de l'ouverture d'un prospect
  useEffect(() => {
    if (selectedLead) {
      const currentId = selectedLead._id || selectedLead.id;
      // Ne réinitialiser les champs du formulaire que lors du changement de fiche
      if (openedLeadIdRef.current !== currentId) {
        openedLeadIdRef.current = currentId;

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
        setEditPhone(formatPhone(selectedLead.phone || ''));
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
          phone: formatPhone(selectedLead.phone || ''),
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
      }
    } else {
      openedLeadIdRef.current = null;
      setInitialFormValues(null);
    }
  }, [selectedLead]);

  // Détection des modifications non enregistrées (champs, toElios ou note en cours)
  const hasUnsavedChanges = useMemo(() => {
    if (!initialFormValues) return false;
    const formFieldsChanged = (
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
    const hasPendingNewNote = Boolean(newNoteText.trim().length > 0);
    const hasPendingNoteEdit = Boolean(editingNoteId && editingNoteText.trim().length > 0);
    return formFieldsChanged || hasPendingNewNote || hasPendingNoteEdit;
  }, [initialFormValues, editFirst, editLast, editPhone, editOffer, editAmount, editSource, editGrade, editSection, editStatus, editFamilyGroup, editToElios, newNoteText, editingNoteId, editingNoteText]);

  // Écoute de la touche Échap pour la fermeture sécurisée
  useEffect(() => {
    if (!selectedLead) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showUnsavedConfirm) {
          setShowUnsavedConfirm(false);
        } else {
          handleRequestCloseFiche();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLead, showUnsavedConfirm, hasUnsavedChanges]);

  // Fermeture sécurisée
  const handleRequestCloseFiche = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedConfirm(true);
    } else {
      setSelectedLead(null);
    }
  };

  // Synchronisation instantanée en temps réel des notes lorsque la fiche prospect est ouverte
  const activeLeadId = selectedLead ? (selectedLead._id || selectedLead.id) : null;
  const { data: liveLead } = useSWR<LeadItem>(
    activeLeadId ? `/api/leads/formatic/${activeLeadId}` : null,
    fetcher,
    {
      refreshInterval: 1500, // scrutation réactive haute fréquence
      revalidateOnFocus: true,
      dedupingInterval: 600
    }
  );

  useEffect(() => {
    if (!liveLead || !selectedLead) return;
    
    const currentNotes = selectedLead.notes || [];
    const incomingNotes = liveLead.notes || [];
    
    // Détection stricte et instantanée de modifications dans les notes (ajout, modification, suppression par d'autres opérateurs)
    const notesChanged = JSON.stringify(currentNotes) !== JSON.stringify(incomingNotes);

    if (notesChanged) {
      setSelectedLead(prev => {
        if (!prev) return null;
        return {
          ...prev,
          notes: incomingNotes,
          updatedAt: liveLead.updatedAt,
          lastModifiedBy: liveLead.lastModifiedBy
        };
      });
      // Synchroniser également dans le cache global SWR des prospects sans perturber le formulaire
      mutate((currentLeads: LeadItem[] = []) => {
        return currentLeads.map(l => 
          (l._id === liveLead._id || l.id === liveLead.id) 
            ? { ...l, notes: incomingNotes, updatedAt: liveLead.updatedAt, lastModifiedBy: liveLead.lastModifiedBy } 
            : l
        );
      }, false);
    }
  }, [liveLead, selectedLead, mutate]);

  // KPI Stats avec TO ELIOS et Règle Métier des Rappels
  const stats = useMemo(() => {
    const list = Array.isArray(leads) ? leads : [];
    const activeList = list.filter((l: any) => !l.isMigratedToElios);
    const countStatus = (st: string) => activeList.filter(l => (l.status || '').trim().toLowerCase() === st.toLowerCase()).length;
    
    // Rappels stricts : N/A (>=5 jours), Potential/Approved Prospect (>=3 jours)
    const rappelsCount = activeList.filter(l => isLeadInRappels(l)).length;
    
    // TO ELIOS stats (tous les prospects migrés vers Elios)
    const toEliosCount = list.filter((l: any) => Boolean(l.toElios || l.isMigratedToElios)).length;

    return {
      total: activeList.length,
      approved: activeList.filter(l => {
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
        const queryDigits = extractPhoneDigits(filterQuery) || filterQuery.replace(/\D/g, '');
        const telDigits = extractPhoneDigits(l.phone);
        const matchPhone = (queryDigits && queryDigits.length >= 2 && telDigits.includes(queryDigits)) || tel.includes(query);
        if (!nom.includes(query) && !matchPhone && !fam.includes(query)) {
          return false;
        }
      }

      // 2. Filtre par carte KPI active
      if (activeCard === 'to_elios') {
        if (!Boolean(l.toElios || (l as any).isMigratedToElios)) return false;
      } else {
        // En dehors du filtre TO ELIOS, les prospects migrés vers Elios ne polluent pas les listes actives Formatic
        if ((l as any).isMigratedToElios) return false;
      }

      if (activeCard === 'approved') {
        const st = (l.status || '').trim().toLowerCase();
        if (st !== 'approved' && st !== 'converti') return false;
      } else if (activeCard === 'potential') {
        if ((l.status || '').trim().toLowerCase() !== 'potential prospect') return false;
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
      if (filterSection !== 'ALL' && !isClassWithoutSection(filterClasse)) {
        const leadSec = (l.section || '').trim().toLowerCase();
        const targetSec = filterSection.trim().toLowerCase();
        if (!leadSec.includes(targetSec)) return false;
      }

      // 6 & 7. Filtre STAFF et DATE unifiés et rigoureux
      // - Si Staff seul : tous les clients auxquels cet opérateur a contribué à n'importe quelle date
      // - Si Date seule : tous les clients ayant eu une activité durant cette période
      // - Si Staff ET Date : STRICTEMENT les clients que cet opérateur a modifiés/créés/annotés durant cette période exacte
      if (!isLeadMatchingStaffAndDate(l, filterStaff, filterDate, customStartDate, customEndDate)) {
        return false;
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
    (filterSection !== 'ALL' && !isClassWithoutSection(filterClasse)) ||
    filterStaff !== 'ALL' ||
    filterDate !== 'ALL' ||
    customStartDate ||
    customEndDate
  );

  // Création d'un prospect Formatic
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = extractPhoneDigits(newPhone);
    if (digits.length !== 8) {
      setNewErr('Veuillez saisir un numéro de téléphone valide à 8 chiffres.');
      return;
    }
    const cleanPhone = formatPhone(digits);

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
    const digits = extractPhoneDigits(editPhone);
    if (digits.length !== 8) {
      setEditErr('Le numéro de téléphone doit comporter exactement 8 chiffres.');
      return;
    }
    const cleanPhone = formatPhone(digits);

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
        savedStatus.toLowerCase() === 'approved prospect'
      );

      if (selectedLead) {
        setLastInteractedLeadId(selectedLead._id || selectedLead.id);
      }
      if (editToElios) {
        mutate((current: any) => Array.isArray(current) ? current.filter((l: any) => (l._id !== targetId && l.id !== targetId)) : current, false);
      }
      setSelectedLead(null);
      setShowUnsavedConfirm(false);
      mutate();
      showToast(editToElios ? 'Prospect migré vers le CRM Elios avec succès !' : 'Prospect mis à jour avec succès');

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

  // Modification atomique d'une note (réservée à l'auteur de la note)
  const handleSaveEditedNote = async (noteId: string) => {
    if (!selectedLead || !editingNoteText.trim()) return;
    const targetNote = (selectedLead.notes || []).find((n: any, idx: number) => (n.id || `n-${idx}`) === noteId);
    const author = targetNote?.by || targetNote?.addedBy || 'Système';
    if (!activeUser || author.trim().toLowerCase() !== activeUser.trim().toLowerCase()) {
      showToast('Seul l\'auteur de cette note peut la modifier');
      return;
    }
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

  // Suppression atomique d'une note (réservée à l'auteur de la note)
  const handleDeleteNote = async (noteId: string) => {
    if (!selectedLead) return;
    const targetNote = (selectedLead.notes || []).find((n: any, idx: number) => (n.id || `n-${idx}`) === noteId);
    const author = targetNote?.by || targetNote?.addedBy || 'Système';
    if (!activeUser || author.trim().toLowerCase() !== activeUser.trim().toLowerCase()) {
      showToast('Seul l\'auteur de cette note peut la supprimer');
      return;
    }
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

  // Affichage téléphone normalisé (aperçu XX XXX XXX)
  const displayPhone = (p?: string | null) => formatPhone(p) || '—';

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
            style={{ '--c': '#7BA25B' } as React.CSSProperties}
            aria-pressed={activeCard === 'approved'}
            onClick={() => handleCardClick('approved')}
            type="button"
          >
            <small>Approved</small>
            <b className="text-xl sm:text-2xl" style={{ color: '#7BA25B' }}>{stats.approved.toLocaleString('fr-FR')}</b>
            <span className="text-xs">Validés & Payés</span>
            <i className="si" style={{ color: '#7BA25B', background: 'rgba(123, 162, 91, 0.12)' }}>
              <svg className="i" viewBox="0 0 24 24">{IC.ok}</svg>
            </i>
          </button>

          {/* CARTE 3 : POTENTIAL PROSPECT */}
          <button 
            className={`stat clickable ${activeCard === 'potential' ? 'active-card' : ''}`}
            style={{ '--c': '#F49E1F' } as React.CSSProperties}
            aria-pressed={activeCard === 'potential'}
            onClick={() => handleCardClick('potential')}
            type="button"
          >
            <small>Potential Prospect</small>
            <b className="text-xl sm:text-2xl" style={{ color: '#F49E1F' }}>{stats.potential.toLocaleString('fr-FR')}</b>
            <span className="text-xs">Forte Intention</span>
            <i className="si" style={{ color: '#F49E1F', background: 'rgba(244, 158, 31, 0.12)' }}>
              <svg className="i" viewBox="0 0 24 24">{IC.up}</svg>
            </i>
          </button>

          {/* CARTE 4 : TO ELIOS (SPÉCIFIQUE FORMATIC) */}
          <button 
            className={`stat clickable ${activeCard === 'to_elios' ? 'active-card' : ''}`}
            style={{ '--c': '#F49E1F' } as React.CSSProperties}
            aria-pressed={activeCard === 'to_elios'}
            onClick={() => handleCardClick('to_elios')}
            type="button"
          >
            <small>TO ELIOS</small>
            <b className="text-xl sm:text-2xl" style={{ color: '#F49E1F' }}>{stats.toElios.toLocaleString('fr-FR')}</b>
            <span className="text-xs">Migrés vers Elios</span>
            <i className="si" style={{ color: '#F49E1F', background: 'rgba(244, 158, 31, 0.12)' }}>
              <svg className="i" viewBox="0 0 24 24">{IC.share}</svg>
            </i>
          </button>

          {/* CARTE 5 : RAPPELS (DERNIÈRE CARTE À DROITE, BLEU MARINE OFFICIEL) */}
          <button 
            className={`stat clickable ${activeCard === 'rappels' ? 'active-card' : ''}`}
            style={{ 
              '--c': '#23356E',
              background: 'color-mix(in srgb, #23356E 6%, var(--card))',
              borderColor: activeCard === 'rappels' ? '#23356E' : 'color-mix(in srgb, #23356E 35%, var(--line))'
            } as React.CSSProperties}
            aria-pressed={activeCard === 'rappels'}
            onClick={() => handleCardClick('rappels')}
            type="button"
          >
            <small>Rappels</small>
            <b className="text-xl sm:text-2xl" style={{ color: '#23356E' }}>{stats.rappels.toLocaleString('fr-FR')}</b>
            <span className="text-xs">A Relancer</span>
            <i className="si" style={{ color: '#23356E', background: 'rgba(35, 53, 110, 0.12)' }}>
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
                  const val = e.target.value;
                  setFilterClasse(val);
                  if (isClassWithoutSection(val)) {
                    setFilterSection('ALL');
                  }
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
                disabled={isClassWithoutSection(filterClasse)}
                onChange={(e) => {
                  setFilterSection(e.target.value);
                  setCurrentPage(1);
                }}
                title={isClassWithoutSection(filterClasse) ? "Les classes de 7ème à 1ère Année n'ont pas de section" : "Section"}
                className="w-full sm:w-auto py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--hover)] transition-all"
              >
                {isClassWithoutSection(filterClasse) ? (
                  <option value="ALL">Sans section</option>
                ) : (
                  <>
                    <option value="ALL">Section : Toutes</option>
                    {FORMATIC_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </>
                )}
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
                {activeCard === 'rappels' && <span className="ml-2 font-semibold text-[#23356E]">(Mode Rappels)</span>}
                {activeCard === 'to_elios' && <span className="ml-2 font-semibold text-[#F49E1F]">(Filtre TO ELIOS)</span>}
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
                const modifierName = getLeadLastModifier(l);
                const opTheme = getOperatorColors(modifierName, safeOperators);
                const lastUpdatedDateStr = formatDateTimeFr(l.updatedAt || l.date);
                const classSec = [l.grade, l.section].filter(Boolean).join(" · ") || "—";
                const hasFullName = Boolean(l.name && l.name.trim() && l.name !== 'Prospect sans nom');
                const isOverdueRappel = isLeadInRappels(l);
                const statusColor = getFormaticStatusColor(l.status);
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
                          {Boolean(l.toElios || (l as any).isMigratedToElios) && (
                            <span className="text-[10px] text-indigo-600 font-bold inline-flex items-center gap-0.5" title="Prospect migré vers le CRM Elios">
                              Migré vers Elios
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Téléphone */}
                    <div className="num font-mono text-sm" data-l="Téléphone">
                      {displayPhone(l.phone)}
                    </div>

                    {/* Classe et Section */}
                    <div data-l="Classe & Section" className="text-sm">
                      {classSec}
                    </div>

                    {/* Statut + Badge Rappel si délai dépassé (alignement vertical sans déséquilibre de colonne) */}
                    <div data-l="Statut" className="flex flex-col items-start gap-1 min-w-0">
                      <span 
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition shadow-2xs whitespace-nowrap"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${statusColor} 14%, var(--card))`,
                          color: statusColor,
                          border: `1px solid color-mix(in srgb, ${statusColor} 32%, transparent)`
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusColor }}></span>
                        <span>{l.status}</span>
                      </span>
                      {isOverdueRappel && (
                        <span 
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap shadow-2xs"
                          title={`Délai dépassé (${getRappelsDelayDays(l)}j depuis la dernière mise à jour) — Relance requise`}
                        >
                          <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            {IC.bell}
                          </svg>
                          <span>Rappel</span>
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
                        href={normalizePhoneForUrl(l.phone) ? `https://wa.me/${normalizePhoneForUrl(l.phone)}` : '#'} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        title="WhatsApp" 
                        aria-label="WhatsApp"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!normalizePhoneForUrl(l.phone)) e.preventDefault();
                        }}
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
              const modifierName = getLeadLastModifier(l);
              const opTheme = getOperatorColors(modifierName, safeOperators);
              const lastUpdatedDateStr = formatDateTimeFr(l.updatedAt || l.date);
              const classSec = [l.grade, l.section].filter(Boolean).join(" · ") || "—";
              const hasFullName = Boolean(l.name && l.name.trim() && l.name !== 'Prospect sans nom');
              const isOverdueRappel = isLeadInRappels(l);
              const statusColor = getFormaticStatusColor(l.status);
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
                          {Boolean(l.toElios || (l as any).isMigratedToElios) && (
                            <span className="text-[10px] text-indigo-600 font-bold block truncate" title="Prospect migré vers le CRM Elios">
                              Migré vers Elios
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span 
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold transition shadow-2xs whitespace-nowrap"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${statusColor} 14%, var(--card))`,
                          color: statusColor,
                          border: `1px solid color-mix(in srgb, ${statusColor} 32%, transparent)`
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusColor }}></span>
                        <span>{l.status}</span>
                      </span>
                      {isOverdueRappel && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-bold bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-md">
                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">{IC.bell}</svg>
                          <span>Rappel</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[var(--ink2)] py-1.5 border-y border-[var(--line)]/50">
                    <span className="font-mono">{displayPhone(l.phone)}</span>
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
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <a 
                        className="ib wa w-7 h-7"
                        href={normalizePhoneForUrl(l.phone) ? `https://wa.me/${normalizePhoneForUrl(l.phone)}` : '#'} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        title="WhatsApp"
                        onClick={(e) => {
                          if (!normalizePhoneForUrl(l.phone)) e.preventDefault();
                        }}
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
      {/* MODALE : NOUVEAU PROSPECT FORMATIC (DESIGN EXECUTIVE INSPIRÉ DE LA NOUVELLE IDENTITÉ) */}
      {/* ========================================================= */}
      {isNewLeadOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsNewLeadOpen(false);
          }}
        >
          <div className="max-w-lg w-full bg-[var(--card)] rounded-2xl sm:rounded-3xl shadow-2xl border border-[var(--line)] overflow-hidden animate-pop">
            <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-widest text-amber-600 dark:text-amber-400 uppercase block">
                  NOUVEAU PROSPECT
                </span>
                <h2 className="text-lg sm:text-xl font-black text-[var(--ink)] mt-0.5">Nouveau prospect Formatic</h2>
              </div>
              <button 
                className="w-8 h-8 rounded-lg border border-[var(--line)] bg-[var(--card)] hover:bg-[var(--hover)] text-[var(--ink3)] hover:text-[var(--ink)] flex items-center justify-center transition shadow-2xs" 
                type="button" 
                aria-label="Fermer" 
                onClick={() => setIsNewLeadOpen(false)}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{IC.x}</svg>
              </button>
            </div>

            <form onSubmit={handleCreateLead} noValidate className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-[var(--ink3)] uppercase tracking-wider block mb-1">
                  NUMÉRO DE TÉLÉPHONE
                </label>
                <input 
                  id="new-phone-formatic" 
                  inputMode="tel" 
                  placeholder="Ex : 92 330 331" 
                  autoComplete="off"
                  maxLength={16}
                  required
                  value={newPhone}
                  onChange={(e) => {
                    setNewPhone(formatPhone(e.target.value));
                    if (newErr) setNewErr('');
                  }}
                  className={`w-full text-base font-mono py-2 px-3 rounded-xl border ${newErr ? 'border-red-500' : 'border-[var(--line)]'} bg-[var(--card)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-amber-500`}
                />
                {newPhone.length > 0 && (
                  <div className="flex justify-end mt-1 text-[11px]">
                    <span className={extractPhoneDigits(newPhone).length === 8 ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                      {extractPhoneDigits(newPhone).length === 8 ? "✓ Valide (8 chiffres)" : `${extractPhoneDigits(newPhone).length} / 8`}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-[var(--ink3)] uppercase tracking-wider block mb-1">CLASSE</label>
                  <select 
                    value={newGrade}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewGrade(val);
                      if (isClassWithoutSection(val)) {
                        setNewSection('');
                      }
                    }}
                    className="w-full py-2 px-2.5 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">Sélectionner…</option>
                    {FORMATIC_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--ink3)] uppercase tracking-wider block mb-1">SECTION</label>
                  <select 
                    value={isClassWithoutSection(newGrade) ? '' : newSection}
                    disabled={isClassWithoutSection(newGrade)}
                    onChange={(e) => setNewSection(e.target.value)}
                    title={isClassWithoutSection(newGrade) ? "Les classes de 7ème à 1ère Année n'ont pas de section" : "Section"}
                    className="w-full py-2 px-2.5 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--hover)] transition-all"
                  >
                    {isClassWithoutSection(newGrade) ? (
                      <option value="">Sans section</option>
                    ) : (
                      <>
                        <option value="">Sélectionner…</option>
                        {FORMATIC_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </>
                    )}
                  </select>
                </div>
              </div>

              {newErr && <p className="text-xs text-red-500 font-semibold">{newErr}</p>}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--line)]">
                <button type="button" className="btn text-xs py-2 px-3.5 rounded-xl font-medium" onClick={() => setIsNewLeadOpen(false)}>
                  Cancel
                </button>
                <button className="btn text-xs py-2 px-4 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition disabled:opacity-50" type="submit" disabled={isCreating}>
                  {isCreating ? 'Saving...' : 'Save lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALE : FICHE PROSPECT FORMATIC (DESIGN PANORAMIQUE 3 COLONNES HARMONISÉ) */}
      {/* ========================================================= */}
      {selectedLead && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleRequestCloseFiche();
          }}
        >
          <div className="w-full max-w-6xl xl:max-w-7xl max-h-[92vh] flex flex-col bg-[var(--card)] rounded-2xl sm:rounded-3xl shadow-2xl border border-[var(--line)] overflow-hidden animate-pop">
            
            {/* EN-TETE EXECUTIVE EN FRANÇAIS (EYEBROW + NOM + BADGES + BOUTON FERMER SQUIRCLE) */}
            <div className="px-5 py-3.5 border-b border-[var(--line)] bg-[var(--card)] flex items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="text-[10px] font-bold tracking-widest text-amber-600 dark:text-amber-400 uppercase block">
                  FICHE PROSPECT
                </span>
                <div className="flex items-center gap-2.5 flex-wrap mt-0.5">
                  <h2 className="text-lg sm:text-xl font-black text-[var(--ink)] truncate">
                    {[editFirst, editLast].filter(Boolean).join(' ') || selectedLead.name || 'Prospect sans nom'}
                  </h2>

                  {/* LABEL STATUT PUR */}
                  <span 
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-2xs whitespace-nowrap"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${getFormaticStatusColor(editStatus)} 14%, var(--card))`,
                      color: getFormaticStatusColor(editStatus),
                      border: `1px solid color-mix(in srgb, ${getFormaticStatusColor(editStatus)} 32%, transparent)`
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getFormaticStatusColor(editStatus) }}></span>
                    <span>{editStatus}</span>
                  </span>

                  {/* Badge Rappel si délai dépassé */}
                  {isLeadInRappels(selectedLead) && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                      ⚠️ Rappel
                    </span>
                  )}

                  {/* Badge To Elios si actif ou migré */}
                  {(editToElios || (selectedLead as any).isMigratedToElios || selectedLead.toElios) && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/15 text-indigo-600 border border-indigo-500/30 flex items-center gap-1 shadow-2xs">
                      <span>{(selectedLead as any).isMigratedToElios ? 'Migré vers Elios' : 'To Elios'}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Bouton fermer Squircle design */}
              <button 
                className="w-8 h-8 rounded-lg border border-[var(--line)] bg-[var(--card)] hover:bg-[var(--hover)] text-[var(--ink3)] hover:text-[var(--ink)] flex items-center justify-center transition shadow-2xs flex-shrink-0"
                type="button" 
                aria-label="Fermer" 
                onClick={handleRequestCloseFiche}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{IC.x}</svg>
              </button>
            </div>

            {/* CORPS PANORAMIQUE 3 COLONNES DEVANT L'OPERATEUR (COLONNE GAUCHE COMPACTÉE POUR FAVORISER LE CENTRE) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {(selectedLead as any).isMigratedToElios && (
                <div className="mb-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="text-base">🚀</span>
                    <span>Ce prospect a été migré définitivement vers le <b>CRM Elios</b>.</span>
                  </span>
                  <a href="/crm-elios" className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[11px] hover:bg-indigo-700 transition">
                    Accéder à CRM Elios →
                  </a>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
                
                {/* COLONNE 1 : SIDEBAR COMPACTÉE (lg:col-span-2) AVEC AVATAR CERCLE OFFICIEL DU CRM */}
                <div className="lg:col-span-2 space-y-3 border-b lg:border-b-0 lg:border-r border-[var(--line)] pr-0 lg:pr-3 pb-3 lg:pb-0">
                  {/* Avatar Cercle officiel du CRM */}
                  <div className="w-12 h-12 rounded-full bg-[var(--acc-s)] text-[var(--acc)] border border-[var(--acc)]/30 flex items-center justify-center font-bold text-sm sm:text-base shadow-2xs">
                    {getInitials(selectedLead.name, editFirst, editLast)}
                  </div>

                  {/* Pile d'informations compacte en français */}
                  <div className="space-y-2.5 pt-1">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-[var(--ink3)] uppercase tracking-wider block">STATUT</span>
                      <div 
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold shadow-2xs whitespace-nowrap"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${getFormaticStatusColor(editStatus)} 14%, var(--card))`,
                          color: getFormaticStatusColor(editStatus),
                          border: `1px solid color-mix(in srgb, ${getFormaticStatusColor(editStatus)} 32%, transparent)`
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getFormaticStatusColor(editStatus) }}></span>
                        <span>{editStatus}</span>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-[var(--ink3)] uppercase tracking-wider block">CLASSE & SECTION</span>
                      <p className="text-[11px] font-semibold text-[var(--ink)] truncate" title={[editGrade, editSection].filter(Boolean).join(' • ') || 'Non renseigné'}>
                        {[editGrade, editSection].filter(Boolean).join(' • ') || '—'}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-[var(--ink3)] uppercase tracking-wider block">SOURCE</span>
                      <p className="text-[11px] font-semibold text-[var(--ink)] truncate">
                        {editSource || '—'}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-[var(--ink3)] uppercase tracking-wider block">ASSIGNÉ À</span>
                      <p className="text-[11px] font-semibold text-[var(--ink)] truncate" title={selectedLead.staff || activeUser || 'Non assigné'}>
                        {selectedLead.staff || activeUser || 'Non assigné'}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-[var(--ink3)] uppercase tracking-wider block">DERNIÈRE MODIF PAR</span>
                      <p className="text-[11px] font-semibold text-[var(--ink)] truncate" title={getLeadLastModifier(selectedLead)}>
                        {getLeadLastModifier(selectedLead)}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-[var(--ink3)] uppercase tracking-wider block">DATE CRÉATION</span>
                      <p className="text-[10px] text-[var(--ink2)] font-mono">
                        {formatDateTimeFr(selectedLead.createdAt || selectedLead.date)}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-[var(--ink3)] uppercase tracking-wider block">RAPPEL</span>
                      <p className="text-[11px] text-[var(--ink2)]">
                        {isLeadInRappels(selectedLead) ? '⚠️ Relance active' : 'Aucun rappel'}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-[var(--ink3)] uppercase tracking-wider block">OFFRE & PAIEMENT</span>
                      <p className="text-[11px] font-medium text-[var(--ink)]">
                        {editOffer || 'Sans offre'} {editAmount ? `• ${editAmount} DT` : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* COLONNE 2 : FORMULAIRE PRINCIPAL ÉLARGI (lg:col-span-6) AVEC PETIT BOUTON TO ELIOS STYLISÉ */}
                <div className="lg:col-span-6 space-y-3.5">
                  {/* Bannière profil lié avec petit bouton TO ELIOS interactif élégant */}
                  <div className="bg-[var(--hover)]/70 border border-[var(--line)] rounded-xl py-2.5 px-3.5 flex items-center justify-between shadow-2xs">
                    <div className="flex flex-col pr-2">
                      <span className="text-xs sm:text-sm font-bold text-[var(--ink)] tracking-tight">
                        To Elios
                      </span>
                      <span className="text-[10px] text-[var(--ink3)]">
                        {(selectedLead as any).isMigratedToElios
                          ? 'Ce prospect est déjà migré vers le CRM Elios'
                          : editToElios
                            ? 'Ce prospect sera migré vers le CRM Elios lors de l\'enregistrement'
                            : 'Activer pour migrer ce prospect vers le CRM Elios'}
                      </span>
                    </div>
                    {/* Bouton switch style iPhone (Hotspot iOS) */}
                    <button
                      type="button"
                      role="switch"
                      disabled={Boolean((selectedLead as any).isMigratedToElios)}
                      aria-checked={editToElios}
                      onClick={() => setEditToElios(!editToElios)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-500/30 ${
                        editToElios ? 'bg-[#34C759]' : 'bg-[#E9E9EA] dark:bg-slate-600'
                      } ${(selectedLead as any).isMigratedToElios ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
                      title={(selectedLead as any).isMigratedToElios ? "Déjà migré vers CRM Elios" : editToElios ? "To Elios : Activé (Migrera vers Elios)" : "To Elios : Désactivé"}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          editToElios ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Grille des champs de saisie (2 colonnes) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-[var(--ink3)] uppercase tracking-wider block mb-1">
                        PRÉNOM
                      </label>
                      <input 
                        value={editFirst} 
                        onChange={(e) => setEditFirst(e.target.value)}
                        placeholder="Ex : Mohamed"
                        className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-[var(--ink3)] uppercase tracking-wider block mb-1">
                        NOM
                      </label>
                      <input 
                        value={editLast} 
                        onChange={(e) => setEditLast(e.target.value)}
                        placeholder="Ex : Ben Ali"
                        className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-[var(--ink3)] uppercase tracking-wider block mb-1">
                        NUMÉRO DE TÉLÉPHONE
                      </label>
                      <div className="flex gap-2">
                        <input 
                          inputMode="tel" 
                          maxLength={16}
                          placeholder="Ex : 92 330 331"
                          value={editPhone} 
                          onChange={(e) => {
                            setEditPhone(formatPhone(e.target.value));
                            if (editErr) setEditErr('');
                          }}
                          className="py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] flex-1 min-w-0 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <a 
                          className="p-2 rounded-xl border border-[var(--line)] bg-[var(--card)] hover:bg-emerald-500/15 hover:text-emerald-600 text-emerald-600 transition flex items-center justify-center flex-shrink-0 shadow-2xs"
                          href={normalizePhoneForUrl(editPhone) ? `tel:+${normalizePhoneForUrl(editPhone)}` : '#'} 
                          title="Appeler le client" 
                          aria-label="Appeler le client"
                          onClick={(e) => {
                            if (!normalizePhoneForUrl(editPhone)) e.preventDefault();
                          }}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{IC.phone}</svg>
                        </a>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-[var(--ink3)] uppercase tracking-wider block mb-1">
                        SOURCE
                      </label>
                      <select 
                        value={editSource} 
                        onChange={(e) => setEditSource(e.target.value)}
                        className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        {FORMATIC_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-[var(--ink3)] uppercase tracking-wider block mb-1">
                        CLASSE
                      </label>
                      <select 
                        value={editGrade} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditGrade(val);
                          if (isClassWithoutSection(val)) {
                            setEditSection('');
                          }
                        }}
                        className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="">Sélectionner…</option>
                        {FORMATIC_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-[var(--ink3)] uppercase tracking-wider block mb-1">
                        SECTION
                      </label>
                      <select 
                        value={isClassWithoutSection(editGrade) ? '' : editSection} 
                        disabled={isClassWithoutSection(editGrade)}
                        onChange={(e) => setEditSection(e.target.value)}
                        title={isClassWithoutSection(editGrade) ? "Les classes de 7ème à 1ère Année n'ont pas de section" : "Section"}
                        className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--hover)] transition-all"
                      >
                        {isClassWithoutSection(editGrade) ? (
                          <option value="">Sans section</option>
                        ) : (
                          <>
                            <option value="">Sélectionner…</option>
                            {FORMATIC_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-[var(--ink3)] uppercase tracking-wider block mb-1">
                        STATUT
                      </label>
                      <select 
                        value={editStatus} 
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        {FORMATIC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-[var(--ink3)] uppercase tracking-wider block mb-1">
                        OFFRE
                      </label>
                      <select 
                        value={editOffer} 
                        onChange={(e) => setEditOffer(e.target.value)}
                        className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="">Aucune</option>
                        {FORMATIC_OFFERS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-[var(--ink3)] uppercase tracking-wider block mb-1">
                        MONTANT PAYÉ (DT)
                      </label>
                      <input 
                        inputMode="decimal" 
                        placeholder="Ex : 500"
                        value={editAmount} 
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-[var(--ink3)] uppercase tracking-wider block mb-1">
                        GROUPE FAMILIAL (FACULTATIF)
                      </label>
                      <input 
                        value={editFamilyGroup} 
                        onChange={(e) => setEditFamilyGroup(e.target.value)}
                        placeholder="Ex : Famille Ben Ali / Groupe 1"
                        className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {editErr && <p className="text-xs text-red-500 font-semibold" role="alert">{editErr}</p>}
                </div>

                {/* COLONNE 3 : CONTACT & HISTORIQUE DES NOTES (lg:col-span-4) */}
                <div className="lg:col-span-4 space-y-3.5">
                  
                  {/* Carte Contact WhatsApp rapide */}
                  <div className="bg-[var(--card)] border border-[var(--line)] rounded-2xl p-3 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{IC.chat}</svg>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest block">CONTACT</span>
                          <span className="text-xs font-bold text-[var(--ink)]">Message WhatsApp</span>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => triggerWhatsAppPopup([editFirst.trim(), editLast.trim()].filter(Boolean).join(' ') || selectedLead.name, editPhone, editStatus)}
                        className="text-xs font-mono font-semibold text-[var(--ink2)] hover:text-[var(--acc)] px-2.5 py-1 rounded-lg hover:bg-[var(--hover)] transition border border-[var(--line)]"
                        title="Ouvrir le module WhatsApp"
                      >
                        {formatPhone(editPhone) || 'Envoyer'}
                      </button>
                    </div>
                  </div>

                  {/* Section Contact Activity / Historique des notes */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-[var(--ink3)] uppercase tracking-wider block">HISTORIQUE DES NOTES</span>
                      <span className="text-xs text-[var(--ink3)] font-semibold">
                        {selectedLead.notes?.length || 0} note{(selectedLead.notes?.length || 0) > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Liste des notes */}
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {selectedLead.notes && selectedLead.notes.length > 0 ? (
                        selectedLead.notes.map((n: any, idx: number) => {
                          const noteId = n.id || `n-${idx}`;
                          const author = n.by || n.addedBy || 'Système';
                          const authorTheme = getOperatorColors(author, safeOperators);
                          const isBeingEdited = editingNoteId === noteId;
                          // Seul l'opérateur qui a écrit la note peut la modifier ou la supprimer
                          const isAuthor = Boolean(
                            activeUser && 
                            author && 
                            activeUser.trim().toLowerCase() === author.trim().toLowerCase()
                          );

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
                                  {isAuthor && (
                                    <>
                                      <button 
                                        type="button" 
                                        onClick={() => {
                                          setEditingNoteId(noteId);
                                          setEditingNoteText(n.text || '');
                                        }}
                                        className="text-[var(--ink3)] hover:text-[var(--acc)] p-0.5 transition"
                                        title="Modifier votre note"
                                      >
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{IC.edit}</svg>
                                      </button>
                                      <button 
                                        type="button" 
                                        onClick={() => handleDeleteNote(noteId)}
                                        className="text-[var(--ink3)] hover:text-red-500 p-0.5 transition"
                                        title="Supprimer votre note"
                                      >
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{IC.trash}</svg>
                                      </button>
                                    </>
                                  )}
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
                  </div>

                  {/* Carte Clairement « Ajouter une note » en français */}
                  <div className="bg-[var(--hover)]/60 border border-amber-500/30 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--ink)] block">Ajouter une note</span>
                    </div>
                    <textarea 
                      placeholder="Écrire une note…"
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                      rows={2}
                    />
                    <div className="flex justify-end">
                      <button 
                        type="button"
                        className="btn text-xs font-bold py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-2xs transition disabled:opacity-50"
                        onClick={handleAddNote}
                        disabled={!newNoteText.trim() || isAddingNote}
                      >
                        {isAddingNote ? 'Ajout...' : 'Ajouter la note'}
                      </button>
                    </div>
                  </div>

                </div>

              </div>
            </div>

            {/* PIED DE MODALE PANORAMIQUE RESPONSIVE TOUT EN FRANÇAIS */}
            <div className="px-5 py-3 border-t border-[var(--line)] bg-[var(--card)] flex flex-wrap items-center justify-between gap-2.5">
              <button 
                className={`btn del text-xs py-2 px-3.5 rounded-xl ${isDeleteArmed ? 'armed bg-red-600 text-white' : ''}`} 
                type="button" 
                onClick={handleDeleteLead}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{IC.trash}</svg>
                <span>{isDeleteArmed ? 'Confirmer ?' : 'Supprimer'}</span>
              </button>

              <div className="flex items-center gap-2.5 ml-auto">
                <button 
                  type="button" 
                  onClick={() => triggerWhatsAppPopup([editFirst.trim(), editLast.trim()].filter(Boolean).join(' ') || selectedLead.name, editPhone, editStatus)}
                  className="btn text-xs py-2 px-3.5 rounded-xl hover:bg-emerald-500 hover:text-white transition flex items-center gap-1.5 border border-emerald-500/30 text-emerald-600"
                  title="Envoyer un message WhatsApp avec aperçu"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {IC.chat}
                  </svg>
                  <span>WhatsApp</span>
                </button>

                <button className="btn text-xs py-2 px-3.5 rounded-xl font-medium" type="button" onClick={handleRequestCloseFiche}>
                  Annuler
                </button>

                <button 
                  className="btn text-xs py-2 px-4 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition disabled:opacity-50 flex items-center gap-1.5" 
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

      {/* MODALE : AVERTISSEMENT MODIFICATIONS NON ENREGISTREES (DIRTY GUARD) */}
      {showUnsavedConfirm && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowUnsavedConfirm(false);
          }}
        >
          <div className="max-w-md w-full p-5 sm:p-6 bg-[var(--card)] rounded-2xl sm:rounded-3xl shadow-2xl border border-amber-500/40 animate-pop">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center flex-shrink-0 shadow-2xs">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {IC.warning}
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-[var(--ink)]">
                  Modifications non enregistrées
                </h3>
                <p className="text-xs text-[var(--ink2)] mt-1.5 leading-relaxed">
                  Des modifications ou une note sont en cours pour <strong className="text-[var(--ink)]">{[editFirst, editLast].filter(Boolean).join(' ') || selectedLead?.name || 'ce prospect'}</strong>. Si vous quittez sans enregistrer, vos changements seront perdus.
                </p>
                {newNoteText.trim() && (
                  <div className="mt-2 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                    ⚠️ Une note en cours de rédaction n'a pas encore été enregistrée.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 mt-6 pt-4 border-t border-[var(--line)]">
              {/* Option 1 : Quitter sans enregistrer */}
              <button 
                type="button" 
                className="btn text-xs py-2 px-3.5 rounded-xl text-red-600 hover:bg-red-500/10 border border-red-500/20 font-medium transition order-3 sm:order-1"
                onClick={() => {
                  setShowUnsavedConfirm(false);
                  setSelectedLead(null);
                  setNewNoteText('');
                  setEditingNoteId(null);
                  setEditingNoteText('');
                }}
              >
                Quitter sans enregistrer
              </button>

              {/* Option 2 : Revenir à la fiche */}
              <button 
                type="button" 
                className="btn text-xs py-2 px-3.5 rounded-xl border border-[var(--line)] hover:bg-[var(--hover)] font-medium transition order-2"
                onClick={() => setShowUnsavedConfirm(false)}
              >
                Revenir
              </button>

              {/* Option 3 : Enregistrer et quitter */}
              <button 
                type="button" 
                className="btn pri text-xs py-2 px-4 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition disabled:opacity-50 order-1 sm:order-3"
                onClick={async () => {
                  if (newNoteText.trim()) {
                    await handleAddNote();
                  }
                  if (editingNoteId && editingNoteText.trim()) {
                    await handleSaveEditedNote(editingNoteId);
                  }
                  await handleSaveLead();
                }}
                disabled={isSaving || isAddingNote}
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
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
        frenchMessage={whatsAppModal.frenchMessage}
        arabicMessage={whatsAppModal.arabicMessage}
        defaultLanguage={
          (whatsAppModal.targetStatus?.trim().toLowerCase() === 'approved prospect' || whatsAppModal.targetStatus?.trim().toLowerCase() === 'approved' || whatsAppModal.targetStatus?.trim().toLowerCase() === 'converti')
            ? (whatsappTemplates.approvedProspectLang || 'fr')
            : (whatsAppModal.targetStatus?.trim().toLowerCase() === 'n/a')
            ? (whatsappTemplates.naMessageLang || 'fr')
            : 'fr'
        }
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
