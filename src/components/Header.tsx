"use client";

import React, { useEffect, useState, useRef } from 'react';
import useSWR from 'swr';
import { getThemeColors, Operator } from '@/types';
import Link from 'next/link';
import { 
  ChevronDown, 
  User, 
  Settings, 
  Check, 
  AlertCircle, 
  Search, 
  Moon, 
  Sun,
  X,
  Receipt,
  ReceiptText,
  Users,
  BookOpen,
  CalendarClock,
  CheckSquare,
  ArrowRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface HeaderProps {
  activeUser: string | null;
  setActiveUser: (user: string) => void;
  attention?: boolean;
}

const SEARCH_ITEMS = [
  { name: 'Reçus de paiement', desc: 'Recherche, consultation et impression des reçus thermiques', href: '/payment-receipts', icon: Receipt, category: 'Finance', badge: 'bg-[#e6f7f2] text-[#0d9488]' },
  { name: 'Suivi des encaissements', desc: 'Centralisation des encaissements et portefeuilles', href: '/receipts', icon: ReceiptText, category: 'Finance', badge: 'bg-[#e6f7f2] text-[#0d9488]' },
  { name: 'CRM Elios', desc: 'Gestion des prospects, leads et suivi commercial', href: '/crm-elios', icon: Users, category: 'Commercial', badge: 'bg-[#e0edff] text-[#2563eb]' },
  { name: 'CRM Formatic', desc: 'Gestion des prospects pour les formations', href: '/crm-formatic', icon: BookOpen, category: 'Commercial', badge: 'bg-[#e0edff] text-[#2563eb]' },
  { name: 'Gestion des séances', desc: 'Planification des cours et automatisation des rappels', href: '/sessions', icon: CalendarClock, category: 'Pédagogie', badge: 'bg-[#fef3c7] text-[#d97706]' },
  { name: 'Tâches et équipe', desc: 'Créez des tâches, assignez vos collaborateurs et to-do list', href: '/tasks', icon: CheckSquare, category: 'Équipe', badge: 'bg-[#f3e8ff] text-[#9333ea]' },
  { name: 'Trésorerie & Portefeuilles', desc: 'Gestion sécurisée des caisses et comptes bancaires', href: '/portefeuilles', icon: ReceiptText, category: 'Finance', badge: 'bg-[#e6f7f2] text-[#0d9488]' },
  { name: 'Configuration des Opérateurs', desc: 'Gestion des profils et attributions d’équipes', href: '/admin/operators', icon: Settings, category: 'Admin', badge: 'bg-gray-100 text-gray-700' },
];

export function Header({ activeUser, setActiveUser, attention }: HeaderProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hdrWrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const { data: operators, isLoading } = useSWR<Operator[]>('/api/operators', fetcher);

  // Écouteur global pour raccourci clavier Ctrl+K / Cmd+K et Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus automatique du champ de recherche à l'ouverture
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isSearchOpen]);

  // Fermer le dropdown lors d'un clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Déterminer l'opérateur actif actuel et son thème
  const currentOp = Array.isArray(operators) ? operators.find(op => op.name.toLowerCase() === (activeUser || '').toLowerCase()) : undefined;
  const currentTheme = currentOp ? getThemeColors(currentOp.theme) : null;

  // Filtrer les résultats de recherche du modal
  const filteredSearchItems = SEARCH_ITEMS.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <style jsx global>{`
        @keyframes headerShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .header-attention {
          animation: headerShake 0.5s ease-in-out infinite, pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      <div ref={hdrWrapRef} id="hdrWrap" className="sticky top-2 z-40 mb-6 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1400px]">
          <header className="relative flex w-full items-center justify-between rounded-2xl bg-white px-4 py-2 sm:px-6 shadow-xs border border-gray-100/90 backdrop-blur-md">
            {/* Logo & Workspace Title */}
            <div className="flex shrink-0 items-center gap-3">
              <Link href="/" className="flex items-center gap-2.5 group select-none">
                <div 
                  className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full overflow-hidden shadow-xs border border-gray-100 bg-white transition-transform group-hover:scale-105"
                >
                  <img 
                    src="/LogoCircle.png" 
                    alt="Logo Elios" 
                    className="h-full w-full object-cover block"
                  />
                </div>
                <span className="text-[15px] font-bold text-gray-900 tracking-tight">
                  Elios Workspace
                </span>
              </Link>
            </div>

            {/* Barre d'outils droite : Recherche Ctrl+K, Mode Sombre, Sélecteur d'opérateur */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Bouton Recherche Ctrl+K */}
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="hidden sm:flex items-center gap-2.5 rounded-xl bg-white border border-gray-200/80 px-3 py-1.5 text-xs text-gray-500 shadow-2xs hover:border-gray-300 hover:bg-gray-50/50 transition-all select-none"
                title="Rechercher (Ctrl + K)"
              >
                <Search className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-gray-600 font-normal">Rechercher</span>
                <kbd className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
                  Ctrl K
                </kbd>
              </button>

              {/* Bouton Mode Sombre */}
              <button
                type="button"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-gray-200/80 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all shadow-2xs"
                title={isDarkMode ? "Activer le mode clair" : "Activer le mode sombre"}
                aria-label="Toggle theme"
              >
                {isDarkMode ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-gray-500" />}
              </button>

              {/* Menu Déroulant de Sélection de l'Opérateur */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsOpen(!isOpen)}
                  className={`relative inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs sm:text-sm font-medium transition-all duration-200 border shadow-2xs focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    attention && !activeUser
                      ? 'header-attention bg-rose-50 border-rose-400 text-rose-700 ring-4 ring-rose-400/40'
                      : 'bg-white hover:bg-gray-50/80 border-gray-200/80 text-gray-800'
                  }`}
                  aria-haspopup="true"
                  aria-expanded={isOpen}
                >
                  {/* Pastille / Avatar Rond avec couleur personnalisée */}
                  {activeUser && currentTheme ? (
                    <span 
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white text-[11px] font-bold shadow-xs"
                      style={{ backgroundColor: currentTheme.dot }}
                    >
                      {activeUser.charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      attention ? 'bg-rose-200 text-rose-800' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {attention ? <AlertCircle className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                    </span>
                  )}

                  {/* Nom ou Choisir un opérateur */}
                  <span className="truncate max-w-[110px] sm:max-w-[160px] text-xs font-medium text-gray-800">
                    {activeUser || 'Choisir un opérateur'}
                  </span>

                  {/* Flèche Chevron */}
                  <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-gray-700' : ''}`} />
                </button>

                {/* Panneau Déroulant Flottant (Dropdown) */}
                {isOpen && (
                  <div 
                    className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl bg-white p-2 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150 z-50 select-none"
                    role="menu"
                  >
                    <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100/80 mb-1">
                      Changer d'utilisateur
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-0.5 custom-scrollbar">
                      {isLoading ? (
                        <div className="py-4 text-center text-xs text-gray-400">
                          Chargement des opérateurs...
                        </div>
                      ) : operators && operators.length > 0 ? (
                        operators.map((op) => {
                          const isSelected = (activeUser || '').toLowerCase() === op.name.toLowerCase();
                          const colors = getThemeColors(op.theme);

                          return (
                            <button
                              key={op._id}
                              type="button"
                              onClick={() => {
                                setActiveUser(op.name);
                                setIsOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                                isSelected
                                  ? 'bg-slate-100/90 text-gray-900 font-semibold shadow-xs'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                              role="menuitem"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white text-[11px] font-bold shadow-xs"
                                  style={{ backgroundColor: colors.dot }}
                                >
                                  {op.name.charAt(0).toUpperCase()}
                                </span>
                                <span className="truncate">{op.name}</span>
                              </div>

                              {isSelected && (
                                <Check className="h-4 w-4 text-blue-600 shrink-0 ml-2" />
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="py-3 px-2 text-center text-xs text-gray-500">
                          Aucun opérateur configuré.
                        </div>
                      )}
                    </div>

                    {/* Lien rapide vers la gestion des opérateurs */}
                    <div className="border-t border-gray-100/80 mt-1 pt-1">
                      <Link
                        href="/admin/operators"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors w-full"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        Gérer les opérateurs
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>
        </div>
      </div>

      {/* Modal Palette de Commande / Recherche Rapide (Ctrl + K) */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 sm:pt-24 px-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Input de recherche */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
              <Search className="h-5 w-5 text-gray-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un module, un élève ou une action..."
                className="w-full bg-transparent text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Liste des résultats */}
            <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
              {filteredSearchItems.length > 0 ? (
                filteredSearchItems.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setIsSearchOpen(false);
                        router.push(item.href);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 text-left transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 truncate">{item.name}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.badge}`}>
                              {item.category}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-3" />
                    </button>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-gray-400">
                  Aucun résultat correspondant à "{searchQuery}".
                </div>
              )}
            </div>

            {/* Pied de page du modal */}
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
              <div className="flex items-center gap-2">
                <span>Appuyez sur <kbd className="font-semibold text-gray-600 bg-white px-1.5 py-0.5 rounded border border-gray-200">Entrée</kbd> pour ouvrir</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Fermer avec <kbd className="font-semibold text-gray-600 bg-white px-1.5 py-0.5 rounded border border-gray-200">Échap</kbd></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
