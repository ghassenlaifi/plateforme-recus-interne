"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { EliosHeader } from '@/components/EliosHeader';
import { BasketballUploadModal } from '@/components/BasketballUploadModal';
import { useToast } from '@/components/Toast';
import { Session, Teacher, SessionStats } from '@/types/session';
import {
  LEVELS,
  SECTIONS,
  SUBJECTS,
  normalizePhone,
  formatPhone,
  formatPhoneInput,
  validatePhone,
  formatDateFR,
  formatTeacherReminder,
  formatGroupReminder,
  formatPdfRequest,
  formatRecRequest,
} from '@/lib/sessionHelpers';
import { CommunicationGroup } from '@/types/communicationGroup';
import { resolveCommunicationGroup } from '@/lib/communicationGroupHelper';
import { WhatsAppTemplates } from '@/types/settings';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Erreur de chargement');
  return res.json();
});

const TINT = ['#23356E', '#F49E1F', '#7BA25B', '#3D4E7F', '#F6B047', '#92B277'];
const hue = (str: string) => TINT[[...str].reduce((a, c) => a + c.charCodeAt(0), 0) % TINT.length];
const initials = (name: string) => name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function SessionsPage() {
  const { toast } = useToast();
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [tab, setTab] = useState<'seances' | 'ens' | 'cal'>('seances');

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

  // Données SWR
  const { data: sessionData, mutate: mutateSessions } = useSWR<{ sessions: Session[]; stats: SessionStats }>(
    '/api/sessions',
    fetcher
  );
  const { data: teachersData, mutate: mutateTeachers } = useSWR<Teacher[]>(
    '/api/sessions/teachers',
    fetcher
  );
  const { data: groupsData } = useSWR<{ groups: CommunicationGroup[] }>(
    '/api/settings/groups',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );
  const { data: whatsappData } = useSWR<{ templates: WhatsAppTemplates }>(
    '/api/settings/whatsapp',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const sessions = sessionData?.sessions || [];
  const commGroups = useMemo(() => groupsData?.groups || [], [groupsData]);
  const stats = sessionData?.stats || {
    totalSessions: 0,
    completedSessions: 0,
    missingDocs: 0,
    todayReminders: 0,
    monthSessions: 0,
  };
  const teachers = teachersData || [];

  // Filtres Onglet Séances
  const [q, setQ] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterChip, setFilterChip] = useState<'all' | 'act' | 'pdf' | 'rec' | 'day' | 'nr' | 'done'>('all');

  // Formulaire Planifier une séance
  const [formSubject, setFormSubject] = useState('');
  const [formTeacher, setFormTeacher] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPhoneErr, setFormPhoneErr] = useState('');
  const [formLevel, setFormLevel] = useState('');
  const [formSection, setFormSection] = useState('Sans section');
  const [formDateTime, setFormDateTime] = useState('');
  const [formErr, setFormErr] = useState('');
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);

  // Formulaire Ajouter un enseignant
  const [tFormName, setTFormName] = useState('');
  const [tFormPhone, setTFormPhone] = useState('');
  const [tFormPhoneErr, setTFormPhoneErr] = useState('');
  const [tFormSubject, setTFormSubject] = useState('');
  const [tFormErr, setTFormErr] = useState('');
  const [isSubmittingTeacher, setIsSubmittingTeacher] = useState(false);

  // Filtres Enseignants
  const [tQuery, setTQuery] = useState('');
  const [tFilterSubject, setTFilterSubject] = useState('');
  const [tSort, setTSort] = useState<'az' | 'most' | 'need'>('az');
  const [tChip, setTChip] = useState<'all' | 'need' | 'act' | 'idle' | 'nophone'>('all');

  // Calendrier
  const [calMonth, setCalMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [calSelectedDate, setCalSelectedDate] = useState<string>(() => ymd(new Date()));
  const [calView, setCalView] = useState<'m' | 'w'>('m');
  const [calFilterTeacher, setCalFilterTeacher] = useState('');
  const [calFilterLevel, setCalFilterLevel] = useState('');
  const [calFilterSection, setCalFilterSection] = useState('');

  // Modales
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editPhoneErr, setEditPhoneErr] = useState('');
  const [editTPhoneErr, setEditTPhoneErr] = useState('');
  const [viewingFicheTeacher, setViewingFicheTeacher] = useState<Teacher | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ text: string; action: () => Promise<void> } | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);
  const [showAllActions, setShowAllActions] = useState(false);

  // Auto-remplissage du téléphone quand l'enseignant est choisi
  const handleTeacherInput = (nameVal: string) => {
    setFormTeacher(nameVal);
    const found = teachers.find(t => t.name.toLowerCase() === nameVal.trim().toLowerCase());
    if (found) {
      if (found.phone && !formPhone) {
        setFormPhone(formatPhoneInput(found.phone));
        setFormPhoneErr('');
      }
      if (found.subject && !formSubject) {
        setFormSubject(found.subject);
      }
    }
  };

  // Envoi WhatsApp
  const sendWhatsApp = (phone?: string, text?: string) => {
    if (!text) return;
    const clean = normalizePhone(phone);
    if (!clean) {
      // Si pas de numéro de téléphone direct (ex: rappel groupe d'élèves), on copie dans le presse-papier et on ouvre WhatsApp
      navigator.clipboard.writeText(text);
      toast({ message: 'Message copié dans le presse-papier ! Ouvrez votre groupe WhatsApp.', tone: 'ok' });
      window.open('https://web.whatsapp.com/', '_blank', 'noopener');
      return;
    }
    window.open(`https://wa.me/${clean}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  // Soumission nouvelle séance
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSubject.trim()) return setFormErr('Saisissez la matière ou le nom de la séance.');
    if (!formLevel) return setFormErr('Sélectionnez le niveau.');
    if (!formDateTime) return setFormErr("Choisissez la date et l'heure.");
    
    // Contrôle strict du téléphone si saisi
    if (formPhone.trim()) {
      const pCheck = validatePhone(formPhone);
      if (!pCheck.isValid) {
        setFormPhoneErr(pCheck.error || 'Numéro invalide');
        return setFormErr(pCheck.error || 'Numéro de téléphone enseignant invalide');
      }
    }
    setFormErr('');
    setFormPhoneErr('');

    try {
      setIsSubmittingSession(true);
      const [startDate, startTime] = formDateTime.split('T');
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: formSubject.trim(),
          teacherName: formTeacher.trim(),
          teacherPhone: formatPhone(formPhone),
          level: formLevel,
          section: formSection,
          startDate,
          startTime: startTime?.slice(0, 5) || '18:00',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de la création');
      }

      toast({ message: 'Séance ajoutée avec succès !', tone: 'ok' });
      setFormSubject('');
      setFormTeacher('');
      setFormPhone('');
      setFormPhoneErr('');
      setFormDateTime('');
      mutateSessions();
      mutateTeachers();
    } catch (err: any) {
      setFormErr(err.message);
    } finally {
      setIsSubmittingSession(false);
    }
  };

  // Soumission nouvel enseignant
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tFormName.trim()) return setTFormErr('Le nom complet est obligatoire.');
    
    // Contrôle strict du téléphone si saisi
    if (tFormPhone.trim()) {
      const pCheck = validatePhone(tFormPhone);
      if (!pCheck.isValid) {
        setTFormPhoneErr(pCheck.error || 'Numéro invalide');
        return setTFormErr(pCheck.error || 'Numéro de téléphone invalide');
      }
    }
    setTFormErr('');
    setTFormPhoneErr('');

    try {
      setIsSubmittingTeacher(true);
      const res = await fetch('/api/sessions/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tFormName.trim(),
          phone: formatPhone(tFormPhone),
          subject: tFormSubject.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de la création');
      }

      toast({ message: 'Enseignant ajouté avec succès !', tone: 'ok' });
      setTFormName('');
      setTFormPhone('');
      setTFormPhoneErr('');
      setTFormSubject('');
      mutateTeachers();
    } catch (err: any) {
      setTFormErr(err.message);
    } finally {
      setIsSubmittingTeacher(false);
    }
  };

  // Toggle drapeau de séance
  const handleToggleSessionFlag = async (session: Session, key: 'remTeacher' | 'remGroup' | 'done' | 'pdf' | 'rec') => {
    try {
      const nextVal = !session[key];
      // Optimistic
      mutateSessions({
        ...sessionData!,
        sessions: sessions.map(s => s._id === session._id ? { ...s, [key]: nextVal } : s)
      }, false);

      await fetch(`/api/sessions/${session._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: nextVal })
      });
      mutateSessions();
    } catch (err) {
      mutateSessions();
    }
  };

  // Envoi Rappel Groupe Élèves synchronisé rigoureusement avec les 19 Groupes de Communication Standards
  const handleSendGroupReminder = (s: Session) => {
    const text = formatGroupReminder(s, 'fr', whatsappData?.templates?.groupReminder);
    navigator.clipboard.writeText(text);

    const targetGroup = resolveCommunicationGroup(s, commGroups);
    if (targetGroup && targetGroup.whatsappLink && targetGroup.whatsappLink.trim()) {
      const link = targetGroup.whatsappLink.trim();
      const finalUrl = link.startsWith('http') ? link : `https://${link}`;
      toast({
        message: `Message copié ! Redirection vers « ${targetGroup.name} »...`,
        tone: 'ok',
      });
      window.open(finalUrl, '_blank', 'noopener');
    } else {
      toast({
        message: `Message copié ! Aucun lien configuré pour « ${targetGroup?.name || 'ce groupe'} » (WhatsApp Web ouvert). Rendez-vous dans Paramètres pour renseigner le lien.`,
        tone: 'warn',
      });
      window.open('https://web.whatsapp.com/', '_blank', 'noopener');
    }

    if (!s.remGroup) {
      handleToggleSessionFlag(s, 'remGroup');
    }
  };

  // Sélection et validation du fichier d'import
  const handleSelectFile = (file: File) => {
    const validExts = ['.csv', '.xlsx', '.xls'];
    const lowerName = file.name.toLowerCase();
    const isValid = validExts.some(ext => lowerName.endsWith(ext));
    if (!isValid) {
      setImportMsg({ text: 'Format non supporté. Veuillez déposer un fichier .csv ou .xlsx', type: 'err' });
      return;
    }
    setImportFile(file);
    setImportMsg(null);
  };

  // Import de fichier
  const handleImportFile = async (e?: React.FormEvent, overrideFile?: File) => {
    if (e) e.preventDefault();
    const targetFile = overrideFile || importFile;
    if (!targetFile) return;
    try {
      setIsImporting(true);
      setImportMsg(null);
      const fd = new FormData();
      fd.append('file', targetFile);
      const res = await fetch('/api/sessions/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'import");
      setImportMsg({ text: data.message, type: 'ok' });
      toast({ message: data.message, tone: 'ok' });
      mutateSessions();
      mutateTeachers();
      setTimeout(() => {
        setIsImportOpen(false);
        setImportFile(null);
        setImportMsg(null);
      }, 1800);
    } catch (err: any) {
      setImportMsg({ text: err.message, type: 'err' });
    } finally {
      setIsImporting(false);
    }
  };

  // Séances filtrées
  const filteredSessions = useMemo(() => {
    const sQuery = q.trim().toLowerCase();
    const today = ymd(new Date());

    return sessions.filter(s => {
      // Recherche textuelle
      if (sQuery) {
        const text = `${s.subject} ${s.title} ${s.teacherName} ${s.level} ${s.section} ${s.room}`.toLowerCase();
        if (!text.includes(sQuery)) return false;
      }
      // Niveau & Section
      if (filterLevel && s.level !== filterLevel) return false;
      if (filterSection && s.section !== filterSection) return false;

      // Chips
      if (filterChip === 'act') return !s.pdf || !s.rec;
      if (filterChip === 'pdf') return !s.pdf;
      if (filterChip === 'rec') return !s.rec;
      if (filterChip === 'day') return s.startDate === today;
      if (filterChip === 'nr') return !s.remTeacher;
      if (filterChip === 'done') return s.done;

      return true;
    }).sort((a, b) => `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`));
  }, [sessions, q, filterLevel, filterSection, filterChip]);

  // Actions requises (manque PDF ou enregistrement)
  const requiredActionSessions = useMemo(() => {
    return sessions.filter(s => !s.pdf || !s.rec).sort((a, b) => `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`));
  }, [sessions]);

  // Enseignants filtrés
  const filteredTeachers = useMemo(() => {
    const sQuery = tQuery.trim().toLowerCase();
    return teachers.filter(t => {
      if (sQuery && !`${t.name} ${t.subject} ${t.phone}`.toLowerCase().includes(sQuery)) return false;
      if (tFilterSubject && t.subject !== tFilterSubject) return false;

      if (tChip === 'need') return (t.missingDocsCount || 0) > 0;
      if (tChip === 'act') return (t.sessionCount || 0) > 0;
      if (tChip === 'idle') return (t.sessionCount || 0) === 0;
      if (tChip === 'nophone') return !t.phone;
      return true;
    }).sort((a, b) => {
      if (tSort === 'most') return (b.sessionCount || 0) - (a.sessionCount || 0);
      if (tSort === 'need') return (b.missingDocsCount || 0) - (a.missingDocsCount || 0);
      return a.name.localeCompare(b.name, 'fr');
    });
  }, [teachers, tQuery, tFilterSubject, tSort, tChip]);

  // Calendrier calculs
  const calSessions = useMemo(() => {
    return sessions.filter(s => {
      if (calFilterTeacher && s.teacherName !== calFilterTeacher) return false;
      if (calFilterLevel && s.level !== calFilterLevel) return false;
      if (calFilterSection && s.section !== calFilterSection) return false;
      return true;
    });
  }, [sessions, calFilterTeacher, calFilterLevel, calFilterSection]);

  const calMonthDays = useMemo(() => {
    const start = new Date(calMonth);
    start.setDate(1 - start.getDay());
    const days: { date: Date; dateStr: string; isCurrentMonth: boolean; sessions: Session[] }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const str = ymd(d);
      const dayEvs = calSessions.filter(s => s.startDate === str).sort((a, b) => a.startTime.localeCompare(b.startTime));
      days.push({
        date: d,
        dateStr: str,
        isCurrentMonth: d.getMonth() === calMonth.getMonth(),
        sessions: dayEvs,
      });
    }
    return days;
  }, [calMonth, calSessions]);

  const selectedDaySessions = useMemo(() => {
    return calSessions.filter(s => s.startDate === calSelectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [calSessions, calSelectedDate]);

  return (
    <div data-page="sessions" className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <EliosHeader 
        crumb="Gestion des séances"
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
        {/* Titre & Description */}
        <div className="hd">
          <div className="pageicon" aria-hidden="true">
            <svg className="i" viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="16" rx="2"/>
              <path d="M8 3v4M16 3v4M3 10h18"/>
              <circle cx="16" cy="16" r="2.5"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h1>Gestion des séances</h1>
            <p className="sub">
              Planifiez les cours, suivez les documents et automatisez les rappels enseignants & groupes d'élèves.
            </p>
          </div>
          <button 
            type="button" 
            className="btn pri" 
            style={{ fontWeight: 600 }}
            onClick={() => {
              setImportMsg(null);
              setIsImportOpen(true);
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            Importer séances (CSV / Excel)
          </button>
        </div>

        {/* Barre des 3 Onglets */}
        <div className="nav-tabs" role="tablist">
          <button 
            role="tab" 
            aria-selected={tab === 'seances'} 
            onClick={() => setTab('seances')}
          >
            <svg className="i" viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="16" rx="2"/>
              <path d="M8 3v4M16 3v4M3 10h18"/>
            </svg>
            Séances
            {requiredActionSessions.length > 0 && (
              <span className="bdg">{requiredActionSessions.length}</span>
            )}
          </button>

          <button 
            role="tab" 
            aria-selected={tab === 'ens'} 
            onClick={() => setTab('ens')}
          >
            <svg className="i" viewBox="0 0 24 24">
              <path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z"/>
              <path d="M12 6v14"/>
            </svg>
            Enseignants
          </button>

          <button 
            role="tab" 
            aria-selected={tab === 'cal'} 
            onClick={() => setTab('cal')}
          >
            <svg className="i" viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="16" rx="2"/>
              <path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01"/>
            </svg>
            Calendrier
          </button>
        </div>

        {/* ========================================================================= */}
        {/* ONGLET 1 : SÉANCES                                                        */}
        {/* ========================================================================= */}
        {tab === 'seances' && (
          <section id="p-seances">
            {/* Actions requises (si des documents manquent) */}
            {requiredActionSessions.length > 0 && (
              <div className="card act-box">
                <div className="act-head">
                  <h2>
                    <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                      <path d="M12 4 2.5 20h19zM12 10v4M12 17h.01"/>
                    </svg>
                    Actions requises ({requiredActionSessions.length})
                  </h2>
                  <div className="act-actions">
                    {requiredActionSessions.length > 6 && (
                      <button 
                        type="button" 
                        className="btn" 
                        style={{ border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', fontSize: '13px', fontWeight: 600, padding: '5px 12px', borderRadius: '8px', cursor: 'pointer' }}
                        onClick={() => setShowAllActions(!showAllActions)}
                      >
                        {showAllActions ? 'Afficher moins' : `Déplier tout (${requiredActionSessions.length})`}
                      </button>
                    )}
                    <button 
                      type="button" 
                      className="btn pri" 
                      style={{ fontSize: '13px', fontWeight: 600, padding: '5px 14px', borderRadius: '8px', cursor: 'pointer' }}
                      onClick={() => {
                        setFilterChip('act');
                        setFilterLevel('');
                        setFilterSection('');
                        setQ('');
                        setTimeout(() => {
                          document.getElementById('list-seances-container')?.scrollIntoView({ behavior: 'smooth' });
                        }, 50);
                      }}
                      title="Afficher et filtrer dans la liste des séances"
                    >
                      Voir dans la liste ({requiredActionSessions.length}) ↓
                    </button>
                  </div>
                </div>
                <div className="ag">
                  {(showAllActions ? requiredActionSessions : requiredActionSessions.slice(0, 6)).map(s => {
                    const missing = [!s.pdf && 'PDF', !s.rec && 'Enregistrement'].filter(Boolean);
                    const tColor = hue(s.teacherName || s.subject);
                    return (
                      <div className="ai" key={s._id}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, minWidth: 0 }}>
                          <span 
                            style={{ 
                              width: 36, 
                              height: 36, 
                              borderRadius: '50%', 
                              background: tColor + '22', 
                              color: tColor, 
                              fontSize: '12px', 
                              fontWeight: 700, 
                              display: 'grid', 
                              placeItems: 'center',
                              flexShrink: 0,
                              border: `1.5px solid ${tColor}33`
                            }}
                            title={`Enseignant : ${s.teacherName}`}
                          >
                            {initials(s.teacherName || s.subject)}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <b style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--ink)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.subject}
                            </b>
                            <p style={{ margin: '0 0 2px 0', fontSize: '12px', color: 'var(--ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <b style={{ color: 'var(--ink)' }}>{s.teacherName}</b> · {s.level}
                            </p>
                            <p style={{ margin: 0, fontSize: '11px', color: 'var(--ink3)' }}>
                              {formatDateFR(s.startDate)} à {s.startTime}
                            </p>
                            <p className="m" style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--warn)', fontWeight: 600 }}>
                              ⚠️ {missing.join(' et ')} manquant{missing.length > 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="r" style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          {!s.pdf && (
                            <button 
                              type="button" 
                              className="chp" 
                              onClick={() => sendWhatsApp(s.teacherPhone, formatPdfRequest(s))}
                              title="Envoyer la demande de PDF via WhatsApp"
                            >
                              <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                                <path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>
                              </svg>
                              PDF
                            </button>
                          )}
                          {!s.rec && (
                            <button 
                              type="button" 
                              className="chp v" 
                              onClick={() => sendWhatsApp(s.teacherPhone, formatRecRequest(s))}
                              title="Envoyer la demande d'enregistrement via WhatsApp"
                            >
                              <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                                <rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3"/>
                              </svg>
                              Enreg.
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Statistiques Séances */}
            <div className="stats-seances">
              <div className="stat" style={{ '--c': 'var(--blue)' } as React.CSSProperties}>
                <small>Total séances</small>
                <b>{stats.totalSessions}</b>
                <i className="si">
                  <svg className="i" viewBox="0 0 24 24">
                    <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>
                  </svg>
                </i>
              </div>

              <div className="stat" style={{ '--c': 'var(--ok)' } as React.CSSProperties}>
                <small>Séances terminées</small>
                <b>{stats.completedSessions}</b>
                <i className="si">
                  <svg className="i" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>
                  </svg>
                </i>
              </div>

              <div className="stat" style={{ '--c': 'var(--warn)' } as React.CSSProperties}>
                <small>Documents manquants</small>
                <b>{stats.missingDocs}</b>
                <i className="si">
                  <svg className="i" viewBox="0 0 24 24">
                    <path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>
                  </svg>
                </i>
              </div>

              <div className="stat" style={{ '--c': 'var(--vio)' } as React.CSSProperties}>
                <small>Rappels du jour</small>
                <b>{stats.todayReminders}</b>
                <i className="si">
                  <svg className="i" viewBox="0 0 24 24">
                    <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>
                  </svg>
                </i>
              </div>
            </div>

            {/* Colonnes Formulaire & Liste */}
            <div className="cols">
              {/* Formulaire Planifier */}
              <form className="card panel" onSubmit={handleCreateSession}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2, color: 'var(--acc)' }}>
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Planifier une séance
                </h2>
                <div className="f">
                  <label>
                    Matière / Nom de séance
                    <input 
                      placeholder="ex. Mathématiques (révision)" 
                      value={formSubject}
                      onChange={(e) => setFormSubject(e.target.value)}
                    />
                  </label>

                  <label>
                    Nom de l'enseignant
                    <input 
                      list="teachers-list-plan"
                      placeholder="ex. Atef Labidi"
                      value={formTeacher}
                      onChange={(e) => handleTeacherInput(e.target.value)}
                    />
                    <datalist id="teachers-list-plan">
                      {teachers.map(t => <option key={t._id} value={t.name} />)}
                    </datalist>
                  </label>

                  <label>
                    Numéro WhatsApp Enseignant
                    <input 
                      inputMode="tel"
                      placeholder="ex. 20 123 456"
                      value={formPhone}
                      onChange={(e) => {
                        const formatted = formatPhoneInput(e.target.value);
                        setFormPhone(formatted);
                        if (formatted) {
                          const check = validatePhone(formatted);
                          setFormPhoneErr(check.isValid ? '' : (check.error || 'Numéro invalide'));
                        } else {
                          setFormPhoneErr('');
                        }
                      }}
                      onBlur={() => {
                        if (formPhone) {
                          const check = validatePhone(formPhone);
                          setFormPhoneErr(check.isValid ? '' : (check.error || 'Numéro invalide'));
                        }
                      }}
                    />
                    {formPhoneErr && <span className="err" style={{ fontSize: '12px', marginTop: '2px' }}>{formPhoneErr}</span>}
                  </label>

                  <div className="two">
                    <label>
                      Niveau
                      <select value={formLevel} onChange={(e) => setFormLevel(e.target.value)}>
                        <option value="">Sélectionner…</option>
                        {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </label>

                    <label>
                      Section
                      <select value={formSection} onChange={(e) => setFormSection(e.target.value)}>
                        {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                  </div>

                  <label>
                    Date et heure
                    <input 
                      type="datetime-local" 
                      value={formDateTime}
                      onChange={(e) => setFormDateTime(e.target.value)}
                    />
                  </label>

                  {formErr && <p className="err" role="alert">{formErr}</p>}

                  <button className="btn pri lg full" type="submit" disabled={isSubmittingSession} style={{ marginTop: '18px' }}>
                    {isSubmittingSession ? 'Ajout en cours...' : 'Ajouter à la liste'}
                  </button>
                </div>
              </form>

              {/* Liste et Filtres */}
              <div className="col-content" id="list-seances-container">
                <div className="card flt">
                  <div className="sb">
                    <svg className="i" viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                    </svg>
                    <input 
                      type="search" 
                      placeholder="Rechercher une matière, un enseignant, une salle…" 
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </div>

                  <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
                    <option value="">Tous les niveaux</option>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>

                  <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)}>
                    <option value="">Toutes les sections</option>
                    {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="chips">
                  {[
                    ['all', 'Tout'],
                    ['act', 'Actions requises'],
                    ['pdf', 'PDF manquant'],
                    ['rec', 'Enregistrement manquant'],
                    ['day', 'Séances du jour'],
                    ['nr', 'Non rappelées'],
                    ['done', 'Terminées'],
                  ].map(([key, label]) => (
                    <button 
                      key={key} 
                      type="button" 
                      aria-pressed={filterChip === key}
                      onClick={() => setFilterChip(key as any)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <p className="count">
                  {filteredSessions.length} séance{filteredSessions.length > 1 ? 's' : ''} trouvée{filteredSessions.length > 1 ? 's' : ''}
                </p>

                <div className="list-seances">
                  {filteredSessions.length === 0 ? (
                    <div className="empty">
                      <b>Aucune séance ne correspond.</b>
                      Modifiez votre recherche ou vos filtres.
                    </div>
                  ) : (
                    filteredSessions.map((s, i) => {
                      const isNeeded = !s.pdf || !s.rec;
                      const missing = [!s.pdf && 'PDF', !s.rec && 'Enregistrement'].filter(Boolean);
                      return (
                        <article 
                          key={s._id} 
                          className={`card ss ${s.done && !isNeeded ? 'fin' : isNeeded ? 'need' : ''}`}
                          style={{ '--i': i } as React.CSSProperties}
                        >
                          <div className="sh">
                            <h3>{s.subject} <small style={{ fontWeight: 400, color: 'var(--ink3)', fontSize: '14px' }}>· {s.title}</small></h3>
                            <button 
                              type="button" 
                              className="ib" 
                              onClick={() => setEditingSession(s)}
                              title="Modifier"
                            >
                              <svg className="i" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>
                            </button>
                            <button 
                              type="button" 
                              className="ib d" 
                              onClick={() => setDeleteConfirm({
                                text: `Supprimer définitivement la séance « ${s.subject} » (${formatDateFR(s.startDate)}) ?`,
                                action: async () => {
                                  await fetch(`/api/sessions/${s._id}`, { method: 'DELETE' });
                                  toast({ message: 'Séance supprimée', tone: 'ok' });
                                  mutateSessions();
                                }
                              })}
                              title="Supprimer"
                            >
                              <svg className="i" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/></svg>
                            </button>
                          </div>

                          <div className="pl">
                            <span className="p" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                              <span 
                                style={{ 
                                  width: 22, 
                                  height: 22, 
                                  borderRadius: '50%', 
                                  background: hue(s.teacherName || s.subject) + '22', 
                                  color: hue(s.teacherName || s.subject), 
                                  fontSize: '11px', 
                                  fontWeight: 700, 
                                  display: 'inline-grid', 
                                  placeItems: 'center',
                                  flexShrink: 0
                                }}
                              >
                                {initials(s.teacherName)}
                              </span>
                              <b>{s.teacherName}</b>
                            </span>
                            <span className="p">
                              <svg className="i" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/></svg>
                              {s.level}
                            </span>
                            <span className="p">
                              <svg className="i" viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>
                              {s.section}
                            </span>
                            <span className="p">
                              <svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                              {formatDateFR(s.startDate)} à {s.startTime}
                            </span>
                            {s.room && (
                              <span className="p" title="Salle Zoom">
                                🏠 {s.room}
                              </span>
                            )}
                            {s.teacherPhone && (
                              <span className="p ph">
                                <svg className="i" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>
                                {formatPhone(s.teacherPhone)}
                              </span>
                            )}
                            {missing.map((m, mIdx) => (
                              <span key={mIdx} className="p w">
                                ⚠️ {m} manquant
                              </span>
                            ))}
                          </div>

                          {/* 4 Boutons de bascule d'état */}
                          <div className="ta">
                            <button 
                              type="button" 
                              className="tg r" 
                              aria-pressed={s.remTeacher}
                              onClick={() => handleToggleSessionFlag(s, 'remTeacher')}
                            >
                              <svg className="i" viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></svg>
                              {s.remTeacher ? 'Rappel prof envoyé' : 'Rappel prof à envoyer'}
                            </button>

                            <button 
                              type="button" 
                              className="tg d" 
                              aria-pressed={s.done}
                              onClick={() => handleToggleSessionFlag(s, 'done')}
                            >
                              <svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>
                              {s.done ? 'Séance terminée' : 'Marquer terminée'}
                            </button>

                            <button 
                              type="button" 
                              className="tg p1" 
                              aria-pressed={s.pdf}
                              onClick={() => handleToggleSessionFlag(s, 'pdf')}
                            >
                              <svg className="i" viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/></svg>
                              {s.pdf ? 'PDF confirmé' : 'Confirmer le PDF'}
                            </button>

                            <button 
                              type="button" 
                              className="tg v" 
                              aria-pressed={s.rec}
                              onClick={() => handleToggleSessionFlag(s, 'rec')}
                            >
                              <svg className="i" viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3"/></svg>
                              {s.rec ? 'Enregistrement prêt' : 'Enregistrement en attente'}
                            </button>
                          </div>

                          {/* Deux boutons WhatsApp : Rappel Enseignant & Rappel Groupe Élèves */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                            <button 
                              type="button" 
                              className="wb" 
                              disabled={!s.teacherPhone}
                              onClick={() => {
                                sendWhatsApp(s.teacherPhone, formatTeacherReminder(s, 'fr', whatsappData?.templates?.teacherReminder));
                                if (!s.remTeacher) handleToggleSessionFlag(s, 'remTeacher');
                              }}
                              title={s.teacherPhone ? 'Envoyer le rappel directement sur WhatsApp à l’enseignant' : 'Aucun téléphone renseigné'}
                            >
                              <svg className="i" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>
                              {s.teacherPhone ? (s.remTeacher ? 'Rappel prof (renvoyer)' : 'Rappel Enseignant') : 'Sans tel enseignant'}
                            </button>

                            <button 
                              type="button" 
                              className="wb group"
                              onClick={() => handleSendGroupReminder(s)}
                              title={`Copier le message et ouvrir ${resolveCommunicationGroup(s, commGroups).name}`}
                            >
                              <svg className="i" viewBox="0 0 24 24"><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/></svg>
                              {s.remGroup ? 'Rappel Groupe Élèves (✓)' : 'Rappel Groupe Élèves'}
                            </button>
                          </div>

                          {/* Demandes documents manquants */}
                          {(!s.pdf || !s.rec) && (
                            <div className="rq">
                              {!s.pdf && (
                                <button 
                                  type="button" 
                                  onClick={() => sendWhatsApp(s.teacherPhone, formatPdfRequest(s))}
                                >
                                  <svg className="i" viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/></svg>
                                  Demander le PDF
                                </button>
                              )}
                              {!s.rec && (
                                <button 
                                  type="button" 
                                  onClick={() => sendWhatsApp(s.teacherPhone, formatRecRequest(s))}
                                >
                                  <svg className="i" viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3"/></svg>
                                  Demander l'enregistrement
                                </button>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* ONGLET 2 : ENSEIGNANTS                                                    */}
        {/* ========================================================================= */}
        {tab === 'ens' && (
          <section id="p-ens">
            {/* Statistiques Enseignants */}
            <div className="stats-seances">
              <div className="stat" style={{ '--c': 'var(--acc)' } as React.CSSProperties}>
                <small>Total enseignants</small>
                <b>{teachers.length}</b>
                <i className="si">
                  <svg className="i" viewBox="0 0 24 24"><path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z"/><path d="M12 6v14"/></svg>
                </i>
              </div>

              <div className="stat" style={{ '--c': 'var(--wa)' } as React.CSSProperties}>
                <small>Avec WhatsApp</small>
                <b>{teachers.filter(t => t.phone).length}</b>
                <i className="si">
                  <svg className="i" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>
                </i>
              </div>

              <div className="stat" style={{ '--c': 'var(--blue)' } as React.CSSProperties}>
                <small>Actifs</small>
                <b>{teachers.filter(t => (t.sessionCount || 0) > 0).length}</b>
                <i className="si">
                  <svg className="i" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
                </i>
              </div>

              <div className="stat" style={{ '--c': 'var(--warn)' } as React.CSSProperties}>
                <small>Suivi requis</small>
                <b>{teachers.filter(t => (t.missingDocsCount || 0) > 0).length}</b>
                <i className="si">
                  <svg className="i" viewBox="0 0 24 24"><path d="M12 4 2.5 20h19zM12 10v4M12 17h.01"/></svg>
                </i>
              </div>
            </div>

            <div className="cols">
              {/* Formulaire Ajouter un enseignant */}
              <form className="card panel" onSubmit={handleCreateTeacher}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2, color: 'var(--acc)' }}>
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Ajouter un enseignant
                </h2>

                <div className="f">
                  <label>
                    Nom complet
                    <input 
                      placeholder="ex. Atef Labidi"
                      value={tFormName}
                      onChange={(e) => setTFormName(e.target.value)}
                    />
                  </label>

                  <label>
                    Téléphone / WhatsApp
                    <input 
                      inputMode="tel"
                      placeholder="ex. 20 123 456"
                      value={tFormPhone}
                      onChange={(e) => {
                        const formatted = formatPhoneInput(e.target.value);
                        setTFormPhone(formatted);
                        if (formatted) {
                          const check = validatePhone(formatted);
                          setTFormPhoneErr(check.isValid ? '' : (check.error || 'Numéro invalide'));
                        } else {
                          setTFormPhoneErr('');
                        }
                      }}
                      onBlur={() => {
                        if (tFormPhone) {
                          const check = validatePhone(tFormPhone);
                          setTFormPhoneErr(check.isValid ? '' : (check.error || 'Numéro invalide'));
                        }
                      }}
                    />
                    {tFormPhoneErr && <span className="err" style={{ fontSize: '12px', marginTop: '2px' }}>{tFormPhoneErr}</span>}
                  </label>

                  <label>
                    Matière principale
                    <input 
                      placeholder="ex. Mathématiques"
                      value={tFormSubject}
                      onChange={(e) => setTFormSubject(e.target.value)}
                    />
                  </label>

                  {tFormErr && <p className="err" role="alert">{tFormErr}</p>}

                  <button className="btn pri lg full" type="submit" disabled={isSubmittingTeacher} style={{ marginTop: '18px' }}>
                    {isSubmittingTeacher ? 'Ajout...' : 'Ajouter'}
                  </button>
                </div>
              </form>

              {/* Grille Enseignants */}
              <div className="col-content">
                <div className="card flt">
                  <div className="sb">
                    <svg className="i" viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                    </svg>
                    <input 
                      type="search" 
                      placeholder="Rechercher par nom ou matière…" 
                      value={tQuery}
                      onChange={(e) => setTQuery(e.target.value)}
                    />
                  </div>

                  <select value={tFilterSubject} onChange={(e) => setTFilterSubject(e.target.value)}>
                    <option value="">Toutes les matières</option>
                    {[...new Set(teachers.map(t => t.subject).filter(Boolean))].sort().map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>

                  <select value={tSort} onChange={(e) => setTSort(e.target.value as any)}>
                    <option value="az">Nom (A à Z)</option>
                    <option value="most">Plus de séances</option>
                    <option value="need">Suivi requis d'abord</option>
                  </select>
                </div>

                <div className="chips">
                  {[
                    ['all', 'Tous'],
                    ['need', 'Suivi requis'],
                    ['act', 'Actifs'],
                    ['idle', 'Sans séance'],
                    ['nophone', 'Sans téléphone'],
                  ].map(([k, l]) => (
                    <button 
                      key={k} 
                      type="button" 
                      aria-pressed={tChip === k}
                      onClick={() => setTChip(k as any)}
                    >
                      {l}
                    </button>
                  ))}
                </div>

                <p className="count">
                  {filteredTeachers.length} enseignant{filteredTeachers.length > 1 ? 's' : ''}
                </p>

                <div className="tgr">
                  {filteredTeachers.length === 0 ? (
                    <div className="empty" style={{ gridColumn: '1 / -1' }}>
                      <b>Aucun enseignant trouvé.</b> Modifiez vos filtres.
                    </div>
                  ) : (
                    filteredTeachers.map((t, i) => {
                      const color = hue(t.subject || t.name);
                      return (
                        <article 
                          key={t._id} 
                          className="card tc"
                          style={{ '--i': i } as React.CSSProperties}
                        >
                          <div className="top2">
                            <span className="ini" style={{ background: color + '22', color, borderRadius: '50%' }}>
                              {initials(t.name)}
                            </span>
                            <div>
                              <b>{t.name}</b>
                              <small style={{ color: 'var(--ink2)' }}>{t.subject || 'Matière non renseignée'}</small>
                            </div>
                            <div className="ac">
                              <button 
                                type="button" 
                                className="ib" 
                                onClick={() => setEditingTeacher(t)}
                                title="Modifier"
                              >
                                <svg className="i" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>
                              </button>
                              <button 
                                type="button" 
                                className="ib d" 
                                onClick={() => setDeleteConfirm({
                                  text: `Supprimer l'enseignant « ${t.name} » ? Ses séances resteront enregistrées.`,
                                  action: async () => {
                                    await fetch(`/api/sessions/teachers/${t._id}`, { method: 'DELETE' });
                                    toast({ message: 'Enseignant supprimé', tone: 'ok' });
                                    mutateTeachers();
                                  }
                                })}
                                title="Supprimer"
                              >
                                <svg className="i" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/></svg>
                              </button>
                            </div>
                          </div>

                          {t.phone ? (
                            <div className="ph2">
                              <svg className="i" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>
                              <span>{formatPhone(t.phone)}</span>
                              <a className="call" href={`tel:+${normalizePhone(t.phone)}`} title="Appeler">
                                <svg className="i" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>
                              </a>
                              <a 
                                href={`https://wa.me/${normalizePhone(t.phone)}`} 
                                target="_blank" 
                                rel="noopener"
                                style={{ background: '#22C55E', color: '#fff' }}
                              >
                                <svg className="i" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>
                                Discuter
                              </a>
                            </div>
                          ) : (
                            <div className="ph2 no">Sans téléphone</div>
                          )}

                          <div className="nx">
                            <svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                            {t.nextSession ? (
                              <span>
                                <b>Prochaine séance</b> · {formatDateFR(t.nextSession.startDate)} à {t.nextSession.startTime} · {t.nextSession.subject}
                              </span>
                            ) : (
                              <span>Aucune séance à venir</span>
                            )}
                          </div>

                          <div className="pl">
                            <span className="p">
                              <svg className="i" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
                              {t.sessionCount || 0} séance{(t.sessionCount || 0) > 1 ? 's' : ''}
                            </span>
                            {(t.missingDocsCount || 0) > 0 ? (
                              <span className="p w">⚠️ {t.missingDocsCount} à suivre</span>
                            ) : (t.sessionCount || 0) > 0 ? (
                              <span className="p ok">✓ À jour</span>
                            ) : null}
                          </div>

                          <div className="bt">
                            <button 
                              type="button" 
                              className="btn" 
                              onClick={() => setViewingFicheTeacher(t)}
                            >
                              Fiche
                            </button>
                            <button 
                              type="button" 
                              className="btn pri"
                              onClick={() => {
                                setTab('seances');
                                setFormTeacher(t.name);
                                setFormPhone(t.phone ? formatPhone(t.phone) : '');
                                setFormSubject(t.subject || '');
                              }}
                            >
                              + Planifier
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* ONGLET 3 : CALENDRIER                                                     */}
        {/* ========================================================================= */}
        {tab === 'cal' && (
          <section id="p-cal">
            {/* Statistiques Calendrier */}
            <div className="stats-seances">
              <div className="stat" style={{ '--c': 'var(--blue)' } as React.CSSProperties}>
                <small>Séances du mois</small>
                <b>{stats.monthSessions}</b>
                <i className="si">
                  <svg className="i" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
                </i>
              </div>

              <div className="stat" style={{ '--c': 'var(--ok)' } as React.CSSProperties}>
                <small>Terminées</small>
                <b>{sessions.filter(s => s.done).length}</b>
                <i className="si">
                  <svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>
                </i>
              </div>

              <div className="stat" style={{ '--c': '#F49E1F' } as React.CSSProperties}>
                <small>À clôturer</small>
                <b>{sessions.filter(s => !s.done && s.startDate < ymd(new Date())).length}</b>
                <i className="si">
                  <svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                </i>
              </div>

              <div className="stat" style={{ '--c': '#23356E' } as React.CSSProperties}>
                <small>Documents manquants</small>
                <b>{stats.missingDocs}</b>
                <i className="si">
                  <svg className="i" viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/></svg>
                </i>
              </div>
            </div>

            <div className="calw">
              {/* Grille Calendrier */}
              <div className="card cal">
                <div className="cth">
                  <h2>
                    <svg className="i" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
                    {calMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </h2>

                  <button 
                    type="button" 
                    className="btn" 
                    onClick={() => {
                      const next = new Date(calMonth);
                      next.setMonth(next.getMonth() - 1);
                      setCalMonth(next);
                    }}
                    aria-label="Mois précédent"
                  >
                    ←
                  </button>

                  <button 
                    type="button" 
                    className="btn" 
                    onClick={() => {
                      const now = new Date();
                      now.setDate(1);
                      setCalMonth(now);
                      setCalSelectedDate(ymd(new Date()));
                    }}
                  >
                    Aujourd'hui
                  </button>

                  <button 
                    type="button" 
                    className="btn" 
                    onClick={() => {
                      const next = new Date(calMonth);
                      next.setMonth(next.getMonth() + 1);
                      setCalMonth(next);
                    }}
                    aria-label="Mois suivant"
                  >
                    →
                  </button>
                </div>

                {/* Filtres internes calendrier */}
                <div className="cf">
                  <input 
                    type="date" 
                    value={calSelectedDate} 
                    onChange={(e) => {
                      if (e.target.value) {
                        setCalSelectedDate(e.target.value);
                        const target = new Date(e.target.value + 'T00:00:00');
                        target.setDate(1);
                        setCalMonth(target);
                      }
                    }}
                  />

                  <select value={calFilterTeacher} onChange={(e) => setCalFilterTeacher(e.target.value)}>
                    <option value="">Tous les enseignants</option>
                    {teachers.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
                  </select>

                  <select value={calFilterLevel} onChange={(e) => setCalFilterLevel(e.target.value)}>
                    <option value="">Tous les niveaux</option>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>

                  <select value={calFilterSection} onChange={(e) => setCalFilterSection(e.target.value)}>
                    <option value="">Toutes les sections</option>
                    {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="lgd">
                  <span><i style={{ '--c': '#23356E' } as React.CSSProperties}></i>Planifiée</span>
                  <span><i style={{ '--c': '#7BA25B' } as React.CSSProperties}></i>Terminée</span>
                  <span><i style={{ '--c': '#F49E1F' } as React.CSSProperties}></i>À clôturer</span>
                </div>

                {/* 42 Jours de la Grille Mensuelle */}
                <div className="dow">
                  <span>Dim</span><span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span>
                </div>

                <div className="cg">
                  {calMonthDays.map((cell, idx) => {
                    const todayStr = ymd(new Date());
                    const isToday = cell.dateStr === todayStr;
                    const isSelected = cell.dateStr === calSelectedDate;
                    return (
                      <button 
                        key={idx} 
                        type="button" 
                        className={`cd ${!cell.isCurrentMonth ? 'o' : ''} ${isToday ? 'td' : ''} ${isSelected ? 'sel' : ''}`}
                        onClick={() => setCalSelectedDate(cell.dateStr)}
                      >
                        <b>{cell.date.getDate()}</b>
                        {cell.sessions.slice(0, 2).map(ev => {
                          const evState = ev.done ? 'ok' : ev.startDate < todayStr ? 'lt' : 'pl2';
                          return (
                            <span key={ev._id} className={`ev ${evState}`}>
                              {ev.startTime} {ev.subject}
                            </span>
                          );
                        })}
                        {cell.sessions.length > 2 && (
                          <span className="more">+{cell.sessions.length - 2} autres</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Agenda du jour sélectionné */}
              <div className="card dl">
                <div className="dhd">
                  <h2>
                    <svg className="i" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
                    <span>{new Date(calSelectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  </h2>
                </div>

                {selectedDaySessions.length === 0 ? (
                  <div className="empty" style={{ marginTop: '8px' }}>
                    <b>Aucune séance ce jour.</b>
                    Sélectionnez un autre jour ou planifiez-en une.
                  </div>
                ) : (
                  selectedDaySessions.map(s => {
                    const todayStr = ymd(new Date());
                    const evState = s.done ? 'ok' : s.startDate < todayStr ? 'lt' : 'pl2';
                    const evLabel = s.done ? 'Terminée' : s.startDate < todayStr ? 'À clôturer' : 'Planifiée';
                    return (
                      <div 
                        key={s._id} 
                        className="dr" 
                        onClick={() => setEditingSession(s)}
                        tabIndex={0}
                      >
                        <span className="h">{s.startTime}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <b className="dr-subject">{s.subject}</b>
                          <div className="dr-teacher-info">
                            <span 
                              className="dr-teacher-circle"
                              style={{ 
                                background: hue(s.teacherName || s.subject) + '22', 
                                color: hue(s.teacherName || s.subject),
                                border: `1.5px solid ${hue(s.teacherName || s.subject)}33`
                              }}
                            >
                              {initials(s.teacherName)}
                            </span>
                            <span className="dr-teacher-name">{s.teacherName}</span>
                            <span className="dr-sep">·</span>
                            <span className="dr-level">{s.level}</span>
                            {s.section && (
                              <>
                                <span className="dr-sep">·</span>
                                <span className="dr-section">{s.section}</span>
                              </>
                            )}
                          </div>
                          <div className="pl" style={{ marginTop: '6px', marginBottom: 0, gap: '6px' }}>
                            <span className={`dbg ${s.pdf ? 'ok' : 'no'}`}>PDF {s.pdf ? '✓' : 'manquant'}</span>
                            <span className={`dbg ${s.rec ? 'ok' : 'no'}`}>Enreg. {s.rec ? '✓' : 'manquant'}</span>
                            <span className={`st ${evState}`}>{evLabel}</span>
                          </div>
                        </div>

                        <div className="q" onClick={(e) => e.stopPropagation()}>
                          <button 
                            type="button" 
                            className="ib" 
                            onClick={() => sendWhatsApp(s.teacherPhone, formatTeacherReminder(s, 'fr', whatsappData?.templates?.teacherReminder))}
                            title="Envoyer le rappel WhatsApp"
                          >
                            <svg className="i" viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></svg>
                          </button>
                          <button 
                            type="button" 
                            className={`ib ${s.done ? 'on' : ''}`} 
                            onClick={() => handleToggleSessionFlag(s, 'done')}
                            title={s.done ? 'Séance terminée' : 'Marquer comme terminée'}
                          >
                            <svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>
                          </button>
                          <button 
                            type="button" 
                            className="ib" 
                            onClick={() => setEditingSession(s)}
                            title="Modifier"
                          >
                            <svg className="i" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}

                <button 
                  type="button" 
                  className="btn pri lg full" 
                  style={{ marginTop: '14px' }}
                  onClick={() => {
                    setTab('seances');
                    setFormDateTime(calSelectedDate + 'T18:00');
                  }}
                >
                  + Planifier une séance ce jour
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODALE : MODIFIER UNE SÉANCE                                              */}
      {/* ========================================================================= */}
      {editingSession && (
        <div className="modal-overlay" style={{ zIndex: 100 }} onClick={(e) => { if (e.target === e.currentTarget) setEditingSession(null); }}>
          <div className="modal-dialog" style={{ width: 'min(500px, 94vw)' }}>
            <div className="dh">
              <h2>Modifier la séance</h2>
              <button type="button" className="x" onClick={() => setEditingSession(null)}>✕</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (editingSession.teacherPhone && editingSession.teacherPhone.trim()) {
                const check = validatePhone(editingSession.teacherPhone);
                if (!check.isValid) {
                  setEditPhoneErr(check.error || 'Numéro invalide');
                  toast({ message: check.error || 'Numéro de téléphone invalide', tone: 'warn' });
                  return;
                }
              }
              setEditPhoneErr('');
              try {
                await fetch(`/api/sessions/${editingSession._id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    ...editingSession,
                    teacherPhone: formatPhone(editingSession.teacherPhone)
                  })
                });
                toast({ message: 'Séance modifiée avec succès', tone: 'ok' });
                setEditingSession(null);
                mutateSessions();
              } catch (err) {
                toast({ message: 'Erreur lors de la modification', tone: 'warn' });
              }
            }}>
              <div className="db">
                <label>
                  Matière / Titre
                  <input 
                    value={editingSession.subject}
                    onChange={(e) => setEditingSession({ ...editingSession, subject: e.target.value })}
                    required
                  />
                </label>

                <label>
                  Enseignant
                  <input 
                    list="teachers-list-edit"
                    value={editingSession.teacherName}
                    onChange={(e) => setEditingSession({ ...editingSession, teacherName: e.target.value })}
                    required
                  />
                  <datalist id="teachers-list-edit">
                    {teachers.map(t => <option key={t._id} value={t.name} />)}
                  </datalist>
                </label>

                <label>
                  Numéro WhatsApp Enseignant
                  <input 
                    inputMode="tel"
                    placeholder="ex. 20 123 456"
                    value={editingSession.teacherPhone || ''}
                    onChange={(e) => {
                      const formatted = formatPhoneInput(e.target.value);
                      setEditingSession({ ...editingSession, teacherPhone: formatted });
                      if (formatted) {
                        const check = validatePhone(formatted);
                        setEditPhoneErr(check.isValid ? '' : (check.error || 'Numéro invalide'));
                      } else {
                        setEditPhoneErr('');
                      }
                    }}
                    onBlur={() => {
                      if (editingSession.teacherPhone) {
                        const check = validatePhone(editingSession.teacherPhone);
                        setEditPhoneErr(check.isValid ? '' : (check.error || 'Numéro invalide'));
                      }
                    }}
                  />
                  {editPhoneErr && <span className="err" style={{ fontSize: '12px', marginTop: '2px' }}>{editPhoneErr}</span>}
                </label>

                <div className="two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label>
                    Niveau
                    <select 
                      value={editingSession.level}
                      onChange={(e) => setEditingSession({ ...editingSession, level: e.target.value })}
                    >
                      {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </label>

                  <label>
                    Section
                    <select 
                      value={editingSession.section}
                      onChange={(e) => setEditingSession({ ...editingSession, section: e.target.value })}
                    >
                      {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                </div>

                <div className="two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label>
                    Date
                    <input 
                      type="date"
                      value={editingSession.startDate}
                      onChange={(e) => setEditingSession({ ...editingSession, startDate: e.target.value })}
                      required
                    />
                  </label>

                  <label>
                    Heure début
                    <input 
                      type="time"
                      value={editingSession.startTime}
                      onChange={(e) => setEditingSession({ ...editingSession, startTime: e.target.value })}
                      required
                    />
                  </label>
                </div>

                <label>
                  Lien de réunion Zoom
                  <input 
                    placeholder="https://us06web.zoom.us/j/..."
                    value={editingSession.zoomJoinUrl || ''}
                    onChange={(e) => setEditingSession({ ...editingSession, zoomJoinUrl: e.target.value })}
                  />
                </label>

                <label>
                  ID Réunion Zoom
                  <input 
                    placeholder="818 1696 9571"
                    value={editingSession.zoomMeetingId || ''}
                    onChange={(e) => setEditingSession({ ...editingSession, zoomMeetingId: e.target.value })}
                  />
                </label>
              </div>

              <div className="df">
                <button 
                  type="button" 
                  className="btn bad" 
                  onClick={() => {
                    const s = editingSession;
                    setEditingSession(null);
                    setDeleteConfirm({
                      text: `Supprimer la séance « ${s.subject} » ?`,
                      action: async () => {
                        await fetch(`/api/sessions/${s._id}`, { method: 'DELETE' });
                        toast({ message: 'Séance supprimée', tone: 'ok' });
                        mutateSessions();
                      }
                    });
                  }}
                >
                  Supprimer
                </button>
                <span className="sp" style={{ flex: 1 }}></span>
                <button type="button" className="btn" onClick={() => setEditingSession(null)}>Annuler</button>
                <button type="submit" className="btn pri">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE : MODIFIER UN ENSEIGNANT                                           */}
      {/* ========================================================================= */}
      {editingTeacher && (
        <div className="modal-overlay" style={{ zIndex: 100 }} onClick={(e) => { if (e.target === e.currentTarget) setEditingTeacher(null); }}>
          <div className="modal-dialog" style={{ width: 'min(460px, 94vw)' }}>
            <div className="dh" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span 
                style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: '50%', 
                  background: hue(editingTeacher.subject || editingTeacher.name) + '22', 
                  color: hue(editingTeacher.subject || editingTeacher.name), 
                  fontSize: '13px', 
                  fontWeight: 700, 
                  display: 'grid', 
                  placeItems: 'center',
                  flexShrink: 0
                }}
              >
                {initials(editingTeacher.name)}
              </span>
              <h2 style={{ margin: 0, flex: 1, fontSize: '18px' }}>Modifier l'enseignant</h2>
              <button type="button" className="x" onClick={() => setEditingTeacher(null)}>✕</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (editingTeacher.phone && editingTeacher.phone.trim()) {
                const check = validatePhone(editingTeacher.phone);
                if (!check.isValid) {
                  setEditTPhoneErr(check.error || 'Numéro invalide');
                  toast({ message: check.error || 'Numéro de téléphone invalide', tone: 'warn' });
                  return;
                }
              }
              setEditTPhoneErr('');
              try {
                await fetch(`/api/sessions/teachers/${editingTeacher._id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    ...editingTeacher,
                    phone: formatPhone(editingTeacher.phone)
                  })
                });
                toast({ message: 'Enseignant mis à jour', tone: 'ok' });
                setEditingTeacher(null);
                mutateTeachers();
                mutateSessions();
              } catch (err) {
                toast({ message: 'Erreur lors de la mise à jour', tone: 'warn' });
              }
            }}>
              <div className="db">
                <label>
                  Nom complet
                  <input 
                    value={editingTeacher.name}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, name: e.target.value })}
                    required
                  />
                </label>

                <label>
                  Téléphone / WhatsApp
                  <input 
                    inputMode="tel"
                    placeholder="ex. 20 123 456"
                    value={editingTeacher.phone || ''}
                    onChange={(e) => {
                      const formatted = formatPhoneInput(e.target.value);
                      setEditingTeacher({ ...editingTeacher, phone: formatted });
                      if (formatted) {
                        const check = validatePhone(formatted);
                        setEditTPhoneErr(check.isValid ? '' : (check.error || 'Numéro invalide'));
                      } else {
                        setEditTPhoneErr('');
                      }
                    }}
                    onBlur={() => {
                      if (editingTeacher.phone) {
                        const check = validatePhone(editingTeacher.phone);
                        setEditTPhoneErr(check.isValid ? '' : (check.error || 'Numéro invalide'));
                      }
                    }}
                  />
                  {editTPhoneErr && <span className="err" style={{ fontSize: '12px', marginTop: '2px' }}>{editTPhoneErr}</span>}
                </label>

                <label>
                  Email
                  <input 
                    type="email"
                    value={editingTeacher.email || ''}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, email: e.target.value })}
                  />
                </label>

                <label>
                  Matière principale
                  <input 
                    value={editingTeacher.subject || ''}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, subject: e.target.value })}
                  />
                </label>
              </div>

              <div className="df">
                <button type="button" className="btn" onClick={() => setEditingTeacher(null)}>Annuler</button>
                <button type="submit" className="btn pri">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE : FICHE ENSEIGNANT DÉTAILLÉE                                       */}
      {/* ========================================================================= */}
      {viewingFicheTeacher && (() => {
        const t = viewingFicheTeacher;
        const teacherSessions = sessions
          .filter(s => (s.teacherName || '').toLowerCase() === t.name.toLowerCase())
          .sort((a, b) => `${b.startDate}T${b.startTime}`.localeCompare(`${a.startDate}T${a.startTime}`));
        const missingSessions = teacherSessions.filter(s => !s.pdf || !s.rec);
        const docsCount = missingSessions.reduce((acc, s) => acc + (!s.pdf ? 1 : 0) + (!s.rec ? 1 : 0), 0);

        return (
          <div className="modal-overlay" style={{ zIndex: 100 }} onClick={(e) => { if (e.target === e.currentTarget) setViewingFicheTeacher(null); }}>
            <div className="modal-dialog" style={{ width: 'min(660px, 96vw)' }}>
              <div className="dh" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="ini" style={{ width: 44, height: 44, borderRadius: 13, background: hue(t.subject || t.name) + '22', color: hue(t.subject || t.name) }}>
                  {initials(t.name)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: '18px' }}>{t.name}</h2>
                  <small style={{ color: 'var(--ink2)' }}>{t.subject || 'Matière non renseignée'}</small>
                </div>
                <button type="button" className="ib" onClick={() => { setEditingTeacher(t); setViewingFicheTeacher(null); }} title="Modifier">
                  <svg className="i" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>
                </button>
                <button type="button" className="x" onClick={() => setViewingFicheTeacher(null)}>✕</button>
              </div>

              <div className="db" style={{ gap: '14px' }}>
                <div className="ft3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div className="mt" style={{ background: 'var(--hover)', borderRadius: '12px', padding: '10px 14px' }}>
                    <small style={{ display: 'block', color: 'var(--ink2)' }}>Séances</small>
                    <b style={{ fontSize: '22px' }}>{teacherSessions.length}</b>
                  </div>
                  <div className="mt" style={{ background: 'var(--hover)', borderRadius: '12px', padding: '10px 14px' }}>
                    <small style={{ display: 'block', color: 'var(--ink2)' }}>Terminées</small>
                    <b style={{ fontSize: '22px' }}>{teacherSessions.filter(s => s.done).length}</b>
                  </div>
                  <div className="mt" style={{ background: 'var(--hover)', borderRadius: '12px', padding: '10px 14px' }}>
                    <small style={{ display: 'block', color: 'var(--ink2)' }}>Docs manquants</small>
                    <b style={{ fontSize: '22px', color: docsCount > 0 ? 'var(--warn)' : 'var(--ok)' }}>{docsCount}</b>
                  </div>
                </div>

                {t.phone ? (
                  <div className="fs" style={{ display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid var(--line)', borderRadius: '14px', padding: '10px 14px' }}>
                    <span className="p ph" style={{ fontWeight: 600 }}>
                      <svg className="i" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>
                      {formatPhone(t.phone)}
                    </span>
                    <div style={{ flex: 1 }}></div>
                    <a className="btn" href={`tel:+${normalizePhone(t.phone)}`}>
                      Appeler
                    </a>
                    <a 
                      className="btn" 
                      href={`https://wa.me/${normalizePhone(t.phone)}`} 
                      target="_blank" 
                      rel="noopener"
                      style={{ color: 'var(--wa)', borderColor: '#25D366' }}
                    >
                      Discuter WhatsApp
                    </a>
                  </div>
                ) : (
                  <div style={{ padding: '8px 12px', background: 'var(--hover)', borderRadius: '10px', color: 'var(--ink3)', fontSize: '13px' }}>
                    Aucun numéro de téléphone WhatsApp renseigné.
                  </div>
                )}

                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '10px 0 8px' }}>Historique des séances</h4>
                  {teacherSessions.length === 0 ? (
                    <div className="empty">Aucune séance pour cet enseignant.</div>
                  ) : (
                    teacherSessions.map(s => {
                      const todayStr = ymd(new Date());
                      const evState = s.done ? 'ok' : s.startDate < todayStr ? 'lt' : 'pl2';
                      const evLabel = s.done ? 'Terminée' : s.startDate < todayStr ? 'À clôturer' : 'Planifiée';
                      return (
                        <div 
                          key={s._id} 
                          className="fr"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '96px 1fr auto',
                            gap: '10px',
                            alignItems: 'center',
                            padding: '10px 0',
                            borderBottom: '1px solid var(--line)',
                            fontSize: '13.5px'
                          }}
                        >
                          <span>
                            {formatDateFR(s.startDate)}
                            <small style={{ display: 'block', color: 'var(--ink3)' }}>{s.startTime}</small>
                          </span>
                          <div>
                            <b>{s.subject}</b>
                            <small style={{ display: 'block', color: 'var(--ink2)' }}>{s.level} · {s.section}</small>
                          </div>
                          <div className="pl" style={{ margin: 0, justifyContent: 'flex-end' }}>
                            <span className={`dbg ${s.pdf ? 'ok' : 'no'}`}>PDF</span>
                            <span className={`dbg ${s.rec ? 'ok' : 'no'}`}>Enreg.</span>
                            <span className={`st ${evState}`}>{evLabel}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="df">
                <button type="button" className="btn" onClick={() => setViewingFicheTeacher(null)}>Fermer</button>
                {missingSessions.length > 0 && t.phone && (
                  <button 
                    type="button" 
                    className="btn" 
                    onClick={() => {
                      const text = `Bonjour ${t.name}, il nous manque encore : ${missingSessions.map(s => `${[!s.pdf && 'PDF', !s.rec && 'Enregistrement'].filter(Boolean).join(' + ')} de ${s.subject} (${formatDateFR(s.startDate)})`).join(' ; ')}. Merci de nous les envoyer dès que possible.`;
                      sendWhatsApp(t.phone, text);
                    }}
                  >
                    Demander les documents ({docsCount})
                  </button>
                )}
                <button 
                  type="button" 
                  className="btn pri" 
                  onClick={() => {
                    setViewingFicheTeacher(null);
                    setTab('seances');
                    setFormTeacher(t.name);
                    setFormPhone(t.phone ? formatPhone(t.phone) : '');
                    setFormSubject(t.subject || '');
                  }}
                >
                  + Planifier une séance
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODALE : IMPORT DE FICHIER CSV / EXCEL - BASKETBALL UPLOAD ANIMATION      */}
      {/* ========================================================================= */}
      <BasketballUploadModal 
        isOpen={isImportOpen}
        onClose={() => {
          setIsImportOpen(false);
          setIsDragging(false);
        }}
        isImporting={isImporting}
        importFile={importFile}
        setImportFile={setImportFile}
        onSelectFile={handleSelectFile}
        onSubmitImport={(fileToImport) => handleImportFile(undefined, fileToImport)}
        importMsg={importMsg}
        setImportMsg={setImportMsg}
      />

      {/* ========================================================================= */}
      {/* MODALE : CONFIRMATION SUPPRESSION                                         */}
      {/* ========================================================================= */}
      {deleteConfirm && (
        <div className="modal-overlay" style={{ zIndex: 110 }} onClick={() => setDeleteConfirm(null)}>
          <div className="modal-dialog" style={{ width: 'min(420px, 92vw)' }}>
            <div className="dh">
              <h2>Confirmation</h2>
              <button type="button" className="x" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="db">
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>
                {deleteConfirm.text}
              </p>
            </div>
            <div className="df">
              <button type="button" className="btn" onClick={() => setDeleteConfirm(null)}>Annuler</button>
              <button 
                type="button" 
                className="btn bad" 
                style={{ background: 'var(--bad)', color: '#fff', borderColor: 'var(--bad)' }}
                onClick={async () => {
                  const act = deleteConfirm.action;
                  setDeleteConfirm(null);
                  await act();
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
