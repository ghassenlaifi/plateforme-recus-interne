const fs = require('fs');

const eliosContent = `
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/Header';
import { Users, UserPlus, CheckCircle2, BellRing, Search, Filter, Plus, FileText, ArrowUpRight, ChevronLeft, ChevronRight, RotateCcw, Calendar } from 'lucide-react';
import useSWR from 'swr';
import { Operator } from '@/types';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const mockLeads = [
  { id: 1, name: 'Rania Skini', phone: '26073913', offer: 'Zero to Hero', source: 'Facebook', grade: 'BAC', section: 'Économie', status: 'N/A', staff: 'Elyes', date: '2026-09-27T10:00:00Z', note: 'S' },
  { id: 2, name: 'Sans nom', phone: '99179580', offer: 'Zero to Hero', source: 'Facebook', grade: 'BAC', section: 'Sciences Expérimentales', status: 'Approved', staff: 'Aya', date: '2026-09-26T10:00:00Z', note: 'na' },
  { id: 3, name: 'Omar Manai', phone: '95262554', offer: 'Zero to Hero', source: 'Facebook', grade: 'BAC', section: 'Économie', status: 'Approved', staff: 'Soumaya', date: '2026-09-20T10:00:00Z', note: 'payed' },
  { id: 4, name: 'Feres', phone: '20057851', offer: 'Zero to Hero Primo', source: 'Facebook', grade: '1ère de Base', section: 'N/A', status: 'Rejected', staff: 'Aya', date: '2026-09-15T10:00:00Z', note: 'mech' },
  { id: 5, name: 'Nermine Khlifi', phone: '99057890', offer: 'Zero to Hero', source: 'WhatsApp', grade: 'BAC', section: 'Technique', status: 'Rejected', staff: 'Narjess', date: '2026-08-20T10:00:00Z', note: 'mskr' },
];

const STATUS_OPTIONS = ['Lead', 'N/A', 'Potential Prospect', 'Approved Prospect', 'Approved', 'Rejected'];
const CLASSE_OPTIONS = ['7ème de Base', '8ème de Base', '9ème de Base', '1ère de Base', '2ème de Base', '3ème de Base', 'BAC'];
const SECTION_OPTIONS = ['Sciences Expérimentales', 'Mathématiques', 'Technique', 'Informatique', 'Économie', 'Lettres', 'Sport', 'N/A'];
const DATE_OPTIONS = ['Aujourd\\'hui', 'Cette semaine', 'Ce mois-ci', 'Période personnalisée'];

export default function CRMEliosPage() {
  const [activeUser, setActiveUser] = useState<string | null>(null);
  
  const { data: operators } = useSWR<Operator[]>('/api/operators', fetcher);

  // Filters State
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterClasse, setFilterClasse] = useState('ALL');
  const [filterSection, setFilterSection] = useState('ALL');
  const [filterStaff, setFilterStaff] = useState('ALL');
  const [filterDate, setFilterDate] = useState('ALL');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('receiptHubActiveUser');
    if (savedUser) setActiveUser(savedUser);
  }, []);

  const handleSetActiveUser = (user: string) => {
    setActiveUser(user);
    localStorage.setItem('receiptHubActiveUser', user);
  };

  const resetFilters = () => {
    setSearch('');
    setFilterStatus('ALL');
    setFilterClasse('ALL');
    setFilterSection('ALL');
    setFilterStaff('ALL');
    setFilterDate('ALL');
    setCustomDateStart('');
    setCustomDateEnd('');
  };

  const filteredLeads = useMemo(() => {
    return mockLeads.filter(lead => {
      if (search && !lead.name.toLowerCase().includes(search.toLowerCase()) && !lead.phone.includes(search)) return false;
      if (filterStatus !== 'ALL' && lead.status !== filterStatus) return false;
      if (filterClasse !== 'ALL' && lead.grade !== filterClasse) return false;
      if (filterSection !== 'ALL' && lead.section !== filterSection) return false;
      if (filterStaff !== 'ALL' && lead.staff !== filterStaff) return false;

      if (filterDate !== 'ALL') {
        const leadDate = new Date(lead.date);
        const today = new Date();
        
        if (filterDate === "Aujourd'hui") {
          if (leadDate.toDateString() !== today.toDateString()) return false;
        } else if (filterDate === 'Cette semaine') {
          const firstDay = new Date(today.setDate(today.getDate() - today.getDay() + 1));
          if (leadDate < firstDay) return false;
        } else if (filterDate === 'Ce mois-ci') {
          if (leadDate.getMonth() !== today.getMonth() || leadDate.getFullYear() !== today.getFullYear()) return false;
        } else if (filterDate === 'Période personnalisée') {
          if (customDateStart && leadDate < new Date(customDateStart)) return false;
          if (customDateEnd && leadDate > new Date(customDateEnd + 'T23:59:59')) return false;
        }
      }
      return true;
    });
  }, [search, filterStatus, filterClasse, filterSection, filterStaff, filterDate, customDateStart, customDateEnd]);

  return (
    <div className="min-h-[100dvh] bg-transparent font-sans text-gray-900 antialiased overflow-x-hidden flex flex-col">
      <Header activeUser={activeUser} setActiveUser={handleSetActiveUser} attention={!activeUser} />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 text-blue-600 font-semibold text-xs tracking-wider uppercase mb-1">
              <Users className="h-4 w-4" />
              Elios Academy
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">Prospects Non Inscrits</h1>
            <p className="text-xs text-gray-500 mt-1">Gérez les clients externes et suivez les appels avant la création de leur compte.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-600 border border-transparent text-white font-semibold rounded-xl hover:bg-blue-700 shadow-sm transition-all focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2">
              <Plus className="h-4 w-4" />
              Nouveau Prospect
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
          {/* Card 1 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-100 relative overflow-hidden group hover:shadow-md transition-all">
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500"></div>
            <div className="flex justify-between items-start mb-4">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Prospects</p>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900 mb-1">3,065</h3>
            <p className="text-[10px] text-gray-500 font-medium">Base active globale</p>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all">
            <div className="flex justify-between items-start mb-4">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nouveaux</p>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <UserPlus className="h-4 w-4" />
              </div>
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900 mb-1">15</h3>
            <p className="text-[10px] text-gray-500 font-medium">À qualifier d'urgence</p>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all">
            <div className="flex justify-between items-start mb-4">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Convertis</p>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900 mb-1">680</h3>
            <p className="text-[10px] text-gray-500 font-medium">Prêts pour l'inscription</p>
          </div>

          {/* Card 4 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200 hover:shadow-md transition-all relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500"></div>
            <div className="flex justify-between items-start mb-4">
              <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Rappels</p>
              <div className="p-2 bg-amber-100 text-amber-700 rounded-lg animate-pulse">
                <BellRing className="h-4 w-4" />
              </div>
            </div>
            <h3 className="text-2xl font-extrabold text-amber-700 mb-1">1,806</h3>
            <p className="text-[10px] text-amber-600 font-medium">À relancer</p>
          </div>
        </div>

        {/* Table/List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          {/* SEARCH & FILTERS BAR */}
          <div className="p-4 border-b border-gray-200/80 bg-gray-50/50 flex flex-col gap-4">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-gray-800 font-bold text-[11px] uppercase tracking-widest whitespace-nowrap">
                <Filter className="h-4 w-4 text-blue-600" />
                Recherche et filtres
              </div>
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input 
                  type="text" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher (nom, téléphone)..." 
                  className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 shadow-sm" 
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-[11px] bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-700 font-medium cursor-pointer shadow-sm min-w-[120px]">
                <option value="ALL">Statut (Tous)</option>
                {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>

              <select value={filterClasse} onChange={(e) => setFilterClasse(e.target.value)} className="text-[11px] bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-700 font-medium cursor-pointer shadow-sm min-w-[120px]">
                <option value="ALL">Classe (Toutes)</option>
                {CLASSE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>

              <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)} className="text-[11px] bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-700 font-medium cursor-pointer shadow-sm min-w-[120px]">
                <option value="ALL">Section (Toutes)</option>
                {SECTION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>

              <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} className="text-[11px] bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-700 font-medium cursor-pointer shadow-sm min-w-[120px]">
                <option value="ALL">STAFF (Tous)</option>
                {operators?.map(op => <option key={op.name} value={op.name}>{op.name}</option>)}
              </select>

              <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="text-[11px] bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-700 font-medium cursor-pointer shadow-sm min-w-[120px]">
                <option value="ALL">Date (Toutes)</option>
                {DATE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>

              {(search !== '' || filterStatus !== 'ALL' || filterClasse !== 'ALL' || filterSection !== 'ALL' || filterStaff !== 'ALL' || filterDate !== 'ALL') && (
                <button 
                  onClick={resetFilters} 
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-100 font-bold rounded-lg transition-colors shadow-sm ml-auto"
                >
                  <RotateCcw className="h-3 w-3" />
                  RESET
                </button>
              )}
            </div>

            {filterDate === 'Période personnalisée' && (
              <div className="flex items-center gap-2 mt-1 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-gray-500">Du</span>
                  <input type="date" value={customDateStart} onChange={e => setCustomDateStart(e.target.value)} className="text-[11px] bg-white border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-700 shadow-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-gray-500">Au</span>
                  <input type="date" value={customDateEnd} onChange={e => setCustomDateEnd(e.target.value)} className="text-[11px] bg-white border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-700 shadow-sm" />
                </div>
              </div>
            )}
          </div>
          
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-blue-600 text-white text-[11px] uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-4 py-2.5">Nom Complet</th>
                  <th className="px-4 py-2.5">Téléphone</th>
                  <th className="px-4 py-2.5">Niveau & Section</th>
                  <th className="px-4 py-2.5">Statut</th>
                  <th className="px-4 py-2.5">Staff & Date</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                      Aucun prospect ne correspond à ces filtres.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead, idx) => (
                    <tr key={lead.id} className="hover:bg-blue-50/30 transition-colors group cursor-pointer">
                      <td className="px-4 py-2.5 text-gray-900 flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {lead.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-bold">{lead.name}</span>
                        {idx === 1 && filterStatus === 'ALL' && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">Modifié</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-gray-600 text-[11px]">{lead.phone}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col">
                          <span className="text-gray-900">{lead.grade}</span>
                          <span className="text-[10px] text-gray-500 uppercase">{lead.section}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {lead.status === 'Approved' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Validé
                          </span>
                        ) : lead.status === 'Rejected' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Rejeté
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span> En attente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[11px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-gray-800">{lead.staff}</span>
                          <span className="text-[10px] text-gray-500 flex items-center gap-1"><Calendar className="h-3 w-3"/> {new Date(lead.date).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100">
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-gray-100 flex items-center justify-between text-[11px] font-semibold text-gray-500 bg-gray-50/50">
            <span>Affichage de {filteredLeads.length} sur {mockLeads.length} prospects</span>
            <div className="flex gap-2">
              <button className="p-1 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 hover:text-gray-900 transition-colors shadow-sm"><ChevronLeft className="h-3 w-3" /></button>
              <button className="p-1 bg-white border border-gray-200 rounded hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"><ChevronRight className="h-3 w-3" /></button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
`;
fs.writeFileSync('src/app/crm-elios/page.tsx', eliosContent);
console.log('CRM Elios updated');
