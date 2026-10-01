"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { EliosHeader } from '@/components/EliosHeader';
import { useToast } from '@/components/Toast';
import { Operator, getOperatorColors } from '@/types';
import { TaskItem, TaskCategory, TaskPriority, TaskNote } from '@/types/task';

const fetcher = (url: string) => fetch(url).then(res => res.ok ? res.json() : null);

const initials = (name: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();
};

const getTodayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getTomorrowYMD = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getInDaysYMD = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getEndOfWeekYMD = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDueDateDisplay = (dateStr?: string) => {
  if (!dateStr) return '';
  if (['Aujourd\'hui', 'Demain', 'Cette semaine'].includes(dateStr)) return dateStr;

  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const target = new Date(`${dateStr}T00:00:00`);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === 0) return 'Aujourd\'hui';
    if (diff === 1) return 'Demain';
    if (diff === -1) return 'Hier (En retard)';
    if (diff < -1) return `En retard (${target.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })})`;
    return target.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  return dateStr;
};

const formatNoteTime = (dateInput?: string | Date) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Aujourd'hui à ${timeStr}`;
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${timeStr}`;
};

export default function TasksPage() {
  const { toast } = useToast();
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Filtres
  const [q, setQ] = useState('');
  const [filterAssignee, setFilterAssignee] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'TODO' | 'DONE'>('ALL');

  // Modale création / édition
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formAssignees, setFormAssignees] = useState<string[]>([]);
  const [formCategory, setFormCategory] = useState<TaskCategory>('Commercial');
  const [formPriority, setFormPriority] = useState<TaskPriority>('Haute');
  const [formDueDate, setFormDueDate] = useState<string>(getTodayYMD());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fiche de tâche (Sheet modal)
  const [sheetTask, setSheetTask] = useState<TaskItem | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Opérateurs
  const { data: operatorsData } = useSWR<Operator[]>('/api/operators', fetcher);
  const operators = useMemo(() => Array.isArray(operatorsData) ? operatorsData : [], [operatorsData]);

  // Opérateur actif automatiquement aspiré par le système
  const activeOperatorName = activeUser || (operators.length > 0 ? operators[0].name : 'Ghassen');
  const activeOperatorColors = getOperatorColors(activeOperatorName, operators);

  // Tâches SWR
  const { data: tasksData, mutate: mutateTasks } = useSWR<{ tasks: TaskItem[] }>(
    '/api/tasks',
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: true }
  );

  const rawTasks: TaskItem[] = useMemo(() => tasksData?.tasks || [], [tasksData]);

  // Normalisation frontend pour garantir que assignedTo est toujours un string[]
  const tasks: TaskItem[] = useMemo(() => {
    return rawTasks.map(t => {
      let assignedTo: string[] = [];
      if (Array.isArray(t.assignedTo)) {
        assignedTo = t.assignedTo;
      } else if (typeof t.assignedTo === 'string' && (t.assignedTo as string).trim()) {
        const str = (t.assignedTo as string).trim();
        assignedTo = str.includes(',') ? str.split(',').map(s => s.trim()) : [str];
      } else {
        assignedTo = ['Ghassen'];
      }
      return {
        ...t,
        assignedTo,
        notes: Array.isArray(t.notes) ? t.notes : []
      };
    });
  }, [rawTasks]);

  // Synchronisation de la fiche de tâche avec les données à jour
  useEffect(() => {
    if (sheetTask) {
      const currentId = sheetTask._id || sheetTask.id;
      const updated = tasks.find(t => (t._id || t.id) === currentId);
      if (updated) {
        setSheetTask(updated);
      }
    }
  }, [tasks]);

  // Initialisation de l'utilisateur actif
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('elios.user') || localStorage.getItem('receiptHubActiveUser');
      if (savedUser) {
        const parsed = savedUser.startsWith('"') ? JSON.parse(savedUser) : savedUser;
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

  // Basculer l'état terminé
  const handleToggleComplete = async (task: TaskItem) => {
    const nextCompleted = !task.completed;
    const taskId = task._id || task.id;
    if (!taskId) return;

    // Optimistic update
    mutateTasks(
      (current) => current ? {
        tasks: current.tasks.map(t => (t._id || t.id) === taskId ? { 
          ...t, 
          completed: nextCompleted,
          completedBy: nextCompleted ? (activeUser || 'Opérateur') : null
        } : t)
      } : current,
      false
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          completed: nextCompleted,
          completedBy: nextCompleted ? (activeUser || 'Opérateur') : null
        }),
      });
      if (!res.ok) throw new Error();
      mutateTasks();
      toast({
        message: nextCompleted ? 'Tâche validée et marquée terminée !' : 'Tâche remise en attente',
        tone: 'ok',
      });
    } catch {
      mutateTasks();
      toast({ message: 'Erreur lors de la mise à jour', tone: 'warn' });
    }
  };

  // Supprimer une tâche
  const handleDeleteTask = async (task: TaskItem) => {
    const taskId = task._id || task.id;
    if (!taskId) return;
    if (!window.confirm(`Supprimer définitivement la tâche « ${task.title} » ?`)) return;

    // Optimistic update
    mutateTasks(
      (current) => current ? {
        tasks: current.tasks.filter(t => (t._id || t.id) !== taskId)
      } : current,
      false
    );

    if (sheetTask && (sheetTask._id || sheetTask.id) === taskId) {
      setSheetTask(null);
    }

    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      mutateTasks();
      toast({ message: 'Tâche supprimée', tone: 'ok' });
    } catch {
      mutateTasks();
      toast({ message: 'Erreur lors de la suppression', tone: 'warn' });
    }
  };

  // Ouvrir la modale en création
  const handleOpenCreateModal = () => {
    setEditingTask(null);
    setFormTitle('');
    const defaultAssignee = activeUser || (operators[0]?.name || 'Ghassen');
    setFormAssignees([defaultAssignee]);
    setFormCategory('Commercial');
    setFormPriority('Haute');
    setFormDueDate(getTodayYMD());
    setIsModalOpen(true);
  };

  // Ouvrir la modale en édition
  const handleOpenEditModal = (task: TaskItem) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormAssignees(Array.isArray(task.assignedTo) && task.assignedTo.length > 0 ? task.assignedTo : ['Ghassen']);
    setFormCategory(task.category);
    setFormPriority(task.priority);
    if (task.dueDate === "Aujourd'hui") {
      setFormDueDate(getTodayYMD());
    } else if (task.dueDate === "Demain") {
      setFormDueDate(getTomorrowYMD());
    } else {
      setFormDueDate(task.dueDate || getTodayYMD());
    }
    setIsModalOpen(true);
  };

  // Basculer la sélection d'un opérateur dans le formulaire
  const toggleFormAssignee = (name: string) => {
    setFormAssignees(prev => {
      if (prev.includes(name)) {
        if (prev.length === 1) return prev; // Au moins un assigné
        return prev.filter(n => n !== name);
      } else {
        return [...prev, name];
      }
    });
  };

  // Soumission du formulaire création / édition
  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    try {
      setIsSubmitting(true);
      const assigneesToSave = formAssignees.length > 0 ? formAssignees : ['Ghassen'];

      if (editingTask) {
        const taskId = editingTask._id || editingTask.id;
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formTitle.trim(),
            assignedTo: assigneesToSave,
            category: formCategory,
            priority: formPriority,
            dueDate: formDueDate || getTodayYMD(),
          }),
        });
        if (!res.ok) throw new Error();
        toast({ message: 'Tâche mise à jour avec succès', tone: 'ok' });
      } else {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formTitle.trim(),
            assignedTo: assigneesToSave,
            category: formCategory,
            priority: formPriority,
            dueDate: formDueDate || getTodayYMD(),
            completed: false,
          }),
        });
        if (!res.ok) throw new Error();
        toast({ message: 'Nouvelle tâche ajoutée à l’équipe !', tone: 'ok' });
      }
      setIsModalOpen(false);
      mutateTasks();
    } catch (err: any) {
      toast({ message: err.message || 'Erreur lors de l’enregistrement', tone: 'warn' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ouvrir la fiche de tâche
  const handleOpenSheet = (task: TaskItem) => {
    setSheetTask(task);
    setNoteText('');
  };

  // Ajouter une note d'avancement
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetTask || !noteText.trim()) return;

    const taskId = sheetTask._id || sheetTask.id;
    if (!taskId) return;

    try {
      setIsSubmittingNote(true);
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newNote: {
            author: activeOperatorName,
            text: noteText.trim(),
          },
        }),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.task) {
        setSheetTask(data.task);
      }
      setNoteText('');
      mutateTasks();
      toast({ message: 'Note d’avancement ajoutée !', tone: 'ok' });
    } catch {
      toast({ message: 'Erreur lors de l’ajout de la note', tone: 'warn' });
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Filtrage
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Recherche textuelle
      if (q.trim()) {
        const term = q.trim().toLowerCase();
        const inTitle = t.title.toLowerCase().includes(term);
        const inAssignees = t.assignedTo.some(a => a.toLowerCase().includes(term));
        const inCat = t.category.toLowerCase().includes(term);
        if (!inTitle && !inAssignees && !inCat) return false;
      }

      // Filtre Collaborateur
      if (filterAssignee !== 'ALL') {
        const isAssigned = t.assignedTo.some(a => a.toLowerCase() === filterAssignee.toLowerCase());
        if (!isAssigned) return false;
      }

      // Filtre Catégorie
      if (filterCategory !== 'ALL' && t.category !== filterCategory) {
        return false;
      }

      // Filtre Priorité
      if (filterPriority !== 'ALL' && t.priority !== filterPriority) {
        return false;
      }

      // Filtre Statut
      if (filterStatus === 'TODO' && t.completed) return false;
      if (filterStatus === 'DONE' && !t.completed) return false;

      return true;
    });
  }, [tasks, q, filterAssignee, filterCategory, filterPriority, filterStatus]);

  // Statistiques Bento
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const highPriority = tasks.filter(t => !t.completed && t.priority === 'Haute').length;
    return { total, completed, pending, highPriority };
  }, [tasks]);

  return (
    <div data-page="tasks" className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col">
      {/* Barre Header Universelle Elios */}
      <EliosHeader 
        crumb="Tâches et équipe" 
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

      <main className="page" style={{ flex: 1 }}>
        {/* En-tête de la page */}
        <div className="tasks-page-header">
          <div className="tasks-header-left">
            <div 
              className="pageicon" 
              aria-hidden="true" 
              style={{ 
                background: 'color-mix(in srgb, var(--pri) 15%, transparent)', 
                color: 'var(--pri)' 
              }}
            >
              <svg className="i" viewBox="0 0 24 24" style={{ width: 28, height: 28 }}>
                <path d="m9 11 3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <div>
              <h1>Tâches et équipe</h1>
              <p className="sub">
                Créez des tâches, assignez vos collaborateurs et suivez votre to-do list d'équipe en temps réel.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="btn pri tasks-add-btn" 
            onClick={handleOpenCreateModal}
          >
            <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2 }}>
              <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>Nouvelle tâche</span>
          </button>
        </div>

        {/* 4 Indicateurs Bento / Stats Cards (Anti-débordement garanti) */}
        <div className="tasks-stats-grid">
          <div className="stat" style={{ '--c': 'var(--pri)' } as React.CSSProperties}>
            <small>Total des tâches</small>
            <b>{stats.total}</b>
            <i className="si">
              <svg className="i" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </i>
          </div>

          <div className="stat" style={{ '--c': 'var(--ok)' } as React.CSSProperties}>
            <small>Tâches terminées</small>
            <b>{stats.completed}</b>
            <i className="si">
              <svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>
            </i>
          </div>

          <div className="stat" style={{ '--c': 'var(--warn)' } as React.CSSProperties}>
            <small>En cours / À traiter</small>
            <b>{stats.pending}</b>
            <i className="si">
              <svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            </i>
          </div>

          <div className="stat" style={{ '--c': 'var(--bad)' } as React.CSSProperties}>
            <small>Priorité haute</small>
            <b>{stats.highPriority}</b>
            <i className="si">
              <svg className="i" viewBox="0 0 24 24"><path d="M12 4 2.5 20h19zM12 10v4M12 17h.01"/></svg>
            </i>
          </div>
        </div>

        {/* Filtres par collaborateur (Barre défilante fluide sans overflow horizontal) */}
        <div className="task-collaborators-bar">
          <button
            type="button"
            onClick={() => setFilterAssignee('ALL')}
            className={`task-collab-btn ${filterAssignee === 'ALL' ? 'active' : ''}`}
          >
            <span>Tous les membres ({tasks.length})</span>
          </button>

          {operators.map(op => {
            const count = tasks.filter(t => t.assignedTo.some(a => a.toLowerCase() === op.name.toLowerCase())).length;
            const isSelected = filterAssignee.toLowerCase() === op.name.toLowerCase();
            const colors = getOperatorColors(op.name, operators);

            return (
              <button
                key={op._id || op.name}
                type="button"
                onClick={() => setFilterAssignee(op.name)}
                className={`task-collab-btn ${isSelected ? 'active' : ''}`}
              >
                <span 
                  className="task-collab-avatar" 
                  style={{ backgroundColor: colors.dot }}
                >
                  {initials(op.name)}
                </span>
                <span>{op.name}</span>
                <span style={{ opacity: isSelected ? 1 : 0.65, fontSize: '11.5px' }}>({count})</span>
              </button>
            );
          })}
        </div>

        {/* Barre de recherche et filtres secondaires */}
        <div className="card flt tasks-filter-bar">
          <div className="sb">
            <svg className="i" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
            </svg>
            <input 
              type="search" 
              placeholder="Rechercher une tâche, un collaborateur..." 
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="tasks-filter-selects-row">
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="ALL">Toutes les catégories</option>
              <option value="Commercial">Commercial</option>
              <option value="Finance">Finance</option>
              <option value="Pédagogie">Pédagogie</option>
              <option value="Général">Général</option>
            </select>

            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
              <option value="ALL">Toutes les priorités</option>
              <option value="Haute">Haute priorité</option>
              <option value="Normale">Priorité normale</option>
              <option value="Basse">Basse priorité</option>
            </select>
          </div>
        </div>

        {/* Chips Statut : Tout / À faire / Terminées */}
        <div className="chips">
          {[
            ['ALL', `Toutes (${tasks.length})`],
            ['TODO', `À faire (${stats.pending})`],
            ['DONE', `Terminées (${stats.completed})`],
          ].map(([key, label]) => (
            <button 
              key={key} 
              type="button" 
              aria-pressed={filterStatus === key}
              onClick={() => setFilterStatus(key as any)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Liste des tâches */}
        <div className="task-card-list">
          {filteredTasks.length === 0 ? (
            <div className="empty" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink3)' }}>
              <svg viewBox="0 0 24 24" style={{ width: 44, height: 44, margin: '0 auto 12px', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, opacity: 0.5 }}>
                <path d="m9 11 3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <b style={{ display: 'block', fontSize: '15px', color: 'var(--ink)' }}>Aucune tâche trouvée</b>
              <span style={{ fontSize: '13px' }}>Modifiez vos critères de recherche ou créez une nouvelle tâche.</span>
            </div>
          ) : (
            filteredTasks.map(task => {
              const taskId = task._id || task.id;
              const catClass = 
                task.category === 'Finance' ? 'cat-finance' :
                task.category === 'Commercial' ? 'cat-commercial' :
                task.category === 'Pédagogie' ? 'cat-pedagogie' : 'cat-general';

              const prioClass = 
                task.priority === 'Haute' ? 'priority-haute' :
                task.priority === 'Normale' ? 'priority-normale' : 'priority-basse';

              const formattedDue = formatDueDateDisplay(task.dueDate);
              const isOverdue = formattedDue.includes('retard');
              const notesCount = task.notes?.length || 0;

              return (
                <div 
                  key={taskId} 
                  className={`task-item ${task.completed ? 'completed' : ''}`}
                  onClick={() => handleOpenSheet(task)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
                    {/* Checkbox toggle rapide */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleComplete(task);
                      }}
                      className={`task-check-btn ${task.completed ? 'checked' : ''}`}
                      title={task.completed ? 'Marquer comme non terminée' : 'Marquer comme terminée'}
                    >
                      {task.completed && (
                        <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, fill: 'none', stroke: '#fff', strokeWidth: 3 }}>
                          <path d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </button>

                    {/* Contenu textuel et métadonnées */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="task-title">
                        {task.title}
                      </p>
                      
                      <div className="task-meta">
                        {/* Multi-opérateurs assignés */}
                        <span className="task-assignees-pill" title={task.assignedTo.join(', ')}>
                          <div className="task-avatar-stack">
                            {task.assignedTo.slice(0, 3).map((name, idx) => {
                              const colors = getOperatorColors(name, operators);
                              return (
                                <span 
                                  key={name + idx}
                                  className="avatar-circle" 
                                  style={{ backgroundColor: colors.dot }}
                                  title={name}
                                >
                                  {initials(name)}
                                </span>
                              );
                            })}
                          </div>
                          <span>
                            {task.assignedTo.length <= 2 
                              ? task.assignedTo.join(', ')
                              : `${task.assignedTo.slice(0, 2).join(', ')} +${task.assignedTo.length - 2}`
                            }
                          </span>
                        </span>

                        {/* Catégorie */}
                        <span className={`task-pill ${catClass}`}>
                          {task.category}
                        </span>

                        {/* Priorité */}
                        <span className={`task-pill ${prioClass}`}>
                          {task.priority === 'Haute' ? '🔥 Haute' : task.priority === 'Normale' ? '⚡ Normale' : '🌱 Basse'}
                        </span>

                        {/* Échéance */}
                        {formattedDue && (
                          <span 
                            className="task-pill" 
                            style={{ 
                              color: isOverdue ? 'var(--bad)' : 'var(--ink2)',
                              borderColor: isOverdue ? 'color-mix(in srgb, var(--bad) 35%, transparent)' : 'var(--line)',
                              background: isOverdue ? 'color-mix(in srgb, var(--bad) 10%, transparent)' : 'var(--hover)'
                            }}
                            title="À réaliser pour le"
                          >
                            <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                            </svg>
                            {formattedDue}
                          </span>
                        )}

                        {/* Badge notes d'avancement si existantes */}
                        {notesCount > 0 && (
                          <span 
                            className="task-pill"
                            style={{ 
                              color: 'var(--pri)', 
                              background: 'color-mix(in srgb, var(--pri) 10%, transparent)',
                              borderColor: 'color-mix(in srgb, var(--pri) 25%, transparent)' 
                            }}
                            title={`${notesCount} note(s) d'avancement`}
                          >
                            <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            <span>{notesCount} {notesCount === 1 ? 'note' : 'notes'}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Rapides Horizontales */}
                  <div className="task-item-actions">
                    <button
                      type="button"
                      className="task-btn-fiche"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSheet(task);
                      }}
                      title="Ouvrir la fiche de tâche"
                    >
                      <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <span>Fiche</span>
                    </button>

                    <button
                      type="button"
                      className="ib"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditModal(task);
                      }}
                      title="Modifier la tâche"
                    >
                      <svg className="i" viewBox="0 0 24 24">
                        <path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>
                      </svg>
                    </button>

                    <button
                      type="button"
                      className="ib d"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTask(task);
                      }}
                      title="Supprimer la tâche"
                    >
                      <svg className="i" viewBox="0 0 24 24">
                        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* ========================================================
          FICHE DE TÂCHE DÉTAILLÉE (Sheet Modal avec Avancements)
          ======================================================== */}
      {sheetTask && (
        <div 
          className="task-sheet-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setSheetTask(null); }}
        >
          <div className="task-sheet-dialog">
            {/* Header de la Fiche */}
            <div className="task-sheet-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div 
                  style={{ 
                    width: 36, 
                    height: 36, 
                    borderRadius: '10px', 
                    background: 'color-mix(in srgb, var(--pri) 15%, transparent)', 
                    color: 'var(--pri)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0
                  }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--ink)' }}>
                    Fiche de tâche
                  </h3>
                  <small style={{ color: 'var(--ink3)', fontSize: '12px' }}>
                    {sheetTask.completed ? 'Statut : Terminée' : 'Statut : En cours'}
                  </small>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  type="button" 
                  className="ib" 
                  onClick={() => {
                    handleOpenEditModal(sheetTask);
                  }}
                  title="Modifier les détails"
                >
                  <svg className="i" viewBox="0 0 24 24">
                    <path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>
                  </svg>
                </button>
                <button 
                  type="button" 
                  className="x" 
                  onClick={() => setSheetTask(null)}
                  title="Fermer la fiche"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Corps de la Fiche */}
            <div className="task-sheet-body">
              {/* Titre & Statut */}
              <div>
                <h2 style={{ 
                  margin: '0 0 10px 0', 
                  fontSize: '18px', 
                  fontWeight: 700, 
                  lineHeight: 1.4,
                  textDecoration: sheetTask.completed ? 'line-through' : 'none',
                  color: sheetTask.completed ? 'var(--ink3)' : 'var(--ink)'
                }}>
                  {sheetTask.title}
                </h2>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {sheetTask.completed ? (
                    <span 
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        padding: '4px 10px', 
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: 'color-mix(in srgb, var(--ok) 15%, transparent)',
                        color: 'var(--ok)',
                        border: '1px solid color-mix(in srgb, var(--ok) 30%, transparent)'
                      }}
                    >
                      <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 }}>
                        <path d="M5 13l4 4L19 7"/>
                      </svg>
                      Terminée {sheetTask.completedBy ? `par ${sheetTask.completedBy}` : ''}
                    </span>
                  ) : (
                    <span 
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        padding: '4px 10px', 
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: 'color-mix(in srgb, var(--warn) 15%, transparent)',
                        color: 'var(--warn)',
                        border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)'
                      }}
                    >
                      <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 }}>
                        <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
                      </svg>
                      En cours de traitement
                    </span>
                  )}

                  <span className={`task-pill cat-${sheetTask.category.toLowerCase()}`}>
                    {sheetTask.category}
                  </span>

                  <span className={`task-pill priority-${sheetTask.priority.toLowerCase()}`}>
                    {sheetTask.priority === 'Haute' ? '🔥 Priorité Haute' : sheetTask.priority === 'Normale' ? '⚡ Priorité Normale' : '🌱 Basse'}
                  </span>

                  <span className="task-pill">
                    <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                    </svg>
                    À réaliser pour le : {formatDueDateDisplay(sheetTask.dueDate)}
                  </span>
                </div>
              </div>

              {/* Bouton de validation ergonomique */}
              <div style={{
                background: sheetTask.completed ? 'color-mix(in srgb, var(--ok) 8%, var(--card))' : 'color-mix(in srgb, var(--pri) 8%, var(--card))',
                border: `1px solid ${sheetTask.completed ? 'color-mix(in srgb, var(--ok) 25%, transparent)' : 'color-mix(in srgb, var(--pri) 25%, transparent)'}`,
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div>
                  <b style={{ display: 'block', fontSize: '13.5px', color: 'var(--ink)' }}>
                    {sheetTask.completed ? 'Tâche accomplie' : 'Validation par l’équipe'}
                  </b>
                  <span style={{ fontSize: '12.5px', color: 'var(--ink2)' }}>
                    {sheetTask.completed 
                      ? 'La tâche a été validée. Vous pouvez la rouvrir si de nouvelles étapes sont requises.' 
                      : 'Une fois vos actions finalisées, validez la tâche pour la clore.'
                    }
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleComplete(sheetTask)}
                  className={`btn ${sheetTask.completed ? '' : 'pri'}`}
                  style={{
                    borderRadius: '10px',
                    fontWeight: 600,
                    fontSize: '13px',
                    padding: '8px 16px',
                    ...(sheetTask.completed ? {} : { background: 'var(--ok)', borderColor: 'var(--ok)', color: '#fff' })
                  }}
                >
                  {sheetTask.completed ? (
                    <>
                      <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                        <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                      </svg>
                      <span>Rouvrir la tâche</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 }}>
                        <path d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Valider & Terminer</span>
                    </>
                  )}
                </button>
              </div>

              {/* Collaborateurs assignés */}
              <div>
                <b style={{ display: 'block', fontSize: '13.5px', color: 'var(--ink)', marginBottom: '8px' }}>
                  Collaborateurs assignés ({sheetTask.assignedTo.length}) :
                </b>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {sheetTask.assignedTo.map(name => {
                    const colors = getOperatorColors(name, operators);
                    return (
                      <span 
                        key={name}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '7px',
                          padding: '5px 12px',
                          borderRadius: '10px',
                          background: 'var(--hover)',
                          border: '1px solid var(--line)',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          color: 'var(--ink)'
                        }}
                      >
                        <span 
                          style={{ 
                            width: 18, 
                            height: 18, 
                            borderRadius: '50%', 
                            backgroundColor: colors.dot, 
                            color: '#fff', 
                            display: 'grid', 
                            placeItems: 'center', 
                            fontSize: '9px',
                            fontWeight: 700 
                          }}
                        >
                          {initials(name)}
                        </span>
                        <span>{name}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Section Notes & Avancements */}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <b style={{ fontSize: '14px', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'var(--pri)', strokeWidth: 2 }}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    Notes et avancements de l'équipe ({(sheetTask.notes || []).length})
                  </b>
                  <small style={{ color: 'var(--ink3)', fontSize: '11.5px' }}>
                    Temps réel
                  </small>
                </div>

                {/* Formulaire pour ajouter une note d'avancement (Opérateur automatiquement aspiré) */}
                <form onSubmit={handleAddNote} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <small style={{ color: 'var(--ink2)', fontSize: '12.5px', fontWeight: 600 }}>
                      Note rédigée par :
                    </small>
                    <span 
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        background: 'color-mix(in srgb, var(--pri) 10%, var(--card))',
                        border: '1px solid color-mix(in srgb, var(--pri) 22%, transparent)',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--ink)'
                      }}
                    >
                      <span 
                        style={{ 
                          width: 16, 
                          height: 16, 
                          borderRadius: '50%', 
                          backgroundColor: activeOperatorColors.dot, 
                          color: '#fff', 
                          display: 'grid', 
                          placeItems: 'center', 
                          fontSize: '9px', 
                          fontWeight: 700 
                        }}
                      >
                        {initials(activeOperatorName)}
                      </span>
                      <span>{activeOperatorName}</span>
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <textarea
                      required
                      rows={2}
                      placeholder="Indiquez votre avancement, un appel effectué, un statut particulier..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: '12px',
                        border: '1px solid var(--line)',
                        background: 'var(--card)',
                        color: 'var(--ink)',
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        minHeight: '44px'
                      }}
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingNote || !noteText.trim()}
                      className="btn pri"
                      style={{
                        borderRadius: '12px',
                        padding: '10px 14px',
                        fontSize: '13px',
                        fontWeight: 600,
                        flexShrink: 0
                      }}
                    >
                      {isSubmittingNote ? 'Ajout...' : 'Ajouter'}
                    </button>
                  </div>
                </form>

                {/* Historique des notes d'avancement */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(!sheetTask.notes || sheetTask.notes.length === 0) ? (
                    <div style={{
                      padding: '24px 14px',
                      textAlign: 'center',
                      background: 'var(--hover)',
                      borderRadius: '14px',
                      color: 'var(--ink3)',
                      fontSize: '13px'
                    }}>
                      Aucune note d’avancement enregistrée pour le moment.
                    </div>
                  ) : (
                    [...sheetTask.notes].reverse().map((n: TaskNote, idx: number) => {
                      const noteAuthorColors = getOperatorColors(n.author, operators);
                      return (
                        <div key={n._id || idx} className="task-note-item">
                          <div className="task-note-header">
                            <div className="task-note-author">
                              <span 
                                style={{ 
                                  width: 18, 
                                  height: 18, 
                                  borderRadius: '50%', 
                                  backgroundColor: noteAuthorColors.dot, 
                                  color: '#fff', 
                                  display: 'grid', 
                                  placeItems: 'center', 
                                  fontSize: '9px',
                                  fontWeight: 700 
                                }}
                              >
                                {initials(n.author)}
                              </span>
                              <span>{n.author}</span>
                            </div>
                            <span className="task-note-time">
                              {formatNoteTime(n.createdAt)}
                            </span>
                          </div>
                          <p className="task-note-text">
                            {n.text}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Footer de la Fiche */}
            <div className="task-sheet-footer">
              <button 
                type="button" 
                className="btn d" 
                onClick={() => handleDeleteTask(sheetTask)}
                style={{ fontSize: '13px' }}
              >
                Supprimer
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => handleOpenEditModal(sheetTask)}
                  style={{ fontSize: '13px' }}
                >
                  Modifier
                </button>
                <button 
                  type="button" 
                  className="btn pri" 
                  onClick={() => setSheetTask(null)}
                  style={{ fontSize: '13px' }}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODALE STANDARD ELIOS : CRÉATION & ÉDITION DE TÂCHE
          ======================================================== */}
      {isModalOpen && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 90 }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div className="modal-dialog" style={{ width: 'min(520px, 94vw)' }}>
            <div className="dh" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div 
                style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: '10px', 
                  background: 'color-mix(in srgb, var(--pri) 15%, transparent)', 
                  color: 'var(--pri)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0
                }}
              >
                <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                  <path d="m9 11 3 3L22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              </div>
              <h2 style={{ margin: 0, flex: 1, fontSize: '18px' }}>
                {editingTask ? 'Modifier la tâche' : 'Nouvelle tâche'}
              </h2>
              <button 
                type="button" 
                className="x" 
                onClick={() => setIsModalOpen(false)}
                title="Fermer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitTask}>
              <div className="db">
                <label>
                  Titre de la tâche
                  <input
                    type="text"
                    required
                    placeholder="Ex: Rappeler les prospects Elios..."
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    autoFocus
                  />
                </label>

                {/* Sélection multi-opérateurs */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <small style={{ fontWeight: 600, color: 'var(--ink2)', fontSize: '13px' }}>
                      Collaborateurs assignés ({formAssignees.length})
                    </small>
                    <small style={{ color: 'var(--pri)', fontSize: '11.5px', fontWeight: 600 }}>
                      Sélection multiple
                    </small>
                  </div>

                  <div className="task-multi-assignee-select">
                    {operators.map(op => {
                      const isSelected = formAssignees.includes(op.name);
                      const opColors = getOperatorColors(op.name, operators);

                      return (
                        <button
                          key={op._id || op.name}
                          type="button"
                          onClick={() => toggleFormAssignee(op.name)}
                          className={`task-assignee-chip-btn ${isSelected ? 'selected' : ''}`}
                        >
                          <span 
                            style={{ 
                              width: 14, 
                              height: 14, 
                              borderRadius: '50%', 
                              backgroundColor: opColors.dot, 
                              display: 'inline-block' 
                            }} 
                          />
                          <span>{op.name}</span>
                          {isSelected && (
                            <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 }}>
                              <path d="M5 13l4 4L19 7"/>
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="two" style={{ marginTop: '12px' }}>
                  <label>
                    Catégorie
                    <select
                      value={formCategory}
                      onChange={(e: any) => setFormCategory(e.target.value)}
                    >
                      <option value="Commercial">Commercial</option>
                      <option value="Finance">Finance</option>
                      <option value="Pédagogie">Pédagogie</option>
                      <option value="Général">Général</option>
                    </select>
                  </label>

                  <label>
                    Priorité
                    <select
                      value={formPriority}
                      onChange={(e: any) => setFormPriority(e.target.value)}
                    >
                      <option value="Haute">Haute</option>
                      <option value="Normale">Normale</option>
                      <option value="Basse">Basse</option>
                    </select>
                  </label>
                </div>

                <div>
                  <label>
                    À réaliser pour le
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        ref={dateInputRef}
                        type="date"
                        required
                        value={formDueDate}
                        onChange={(e) => setFormDueDate(e.target.value)}
                        style={{ width: '100%', paddingRight: '36px', cursor: 'pointer' }}
                        onClick={() => {
                          try {
                            dateInputRef.current?.showPicker();
                          } catch {}
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            dateInputRef.current?.showPicker();
                          } catch {}
                        }}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--acc)',
                          display: 'grid',
                          placeItems: 'center',
                          padding: '4px'
                        }}
                        title="Ouvrir le calendrier"
                      >
                        <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                        </svg>
                      </button>
                    </div>
                  </label>
                </div>

                {/* Raccourcis rapides de date */}
                <div style={{ marginTop: '2px' }}>
                  <small style={{ color: 'var(--ink3)', fontSize: '11.5px', display: 'block', marginBottom: '4px' }}>
                    Raccourcis rapides :
                  </small>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[
                      ['Aujourd\'hui', getTodayYMD()],
                      ['Demain', getTomorrowYMD()],
                      ['Dans 3 jours', getInDaysYMD(3)],
                      ['Fin de semaine', getEndOfWeekYMD()],
                    ].map(([label, val]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setFormDueDate(val)}
                        style={{
                          border: formDueDate === val ? '1.5px solid var(--acc)' : '1px solid var(--line)',
                          background: formDueDate === val ? 'color-mix(in srgb, var(--acc) 14%, var(--card))' : 'var(--hover)',
                          color: formDueDate === val ? 'var(--acc)' : 'var(--ink2)',
                          borderRadius: '8px',
                          padding: '4px 10px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: '.15s'
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="df" style={{ marginTop: '18px' }}>
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => setIsModalOpen(false)}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn pri" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Enregistrement...' : editingTask ? 'Enregistrer les modifications' : 'Ajouter la tâche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
