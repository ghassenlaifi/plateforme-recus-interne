"use client";

import React, { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { Header } from '@/components/Header';
import { useToast } from '@/components/Toast';
import { Wallet, RefreshCw, AlertTriangle, Building, User, LayoutGrid, Wifi, Copy, Lock, KeyRound, FileText } from 'lucide-react';
import { StatementModal } from '@/components/StatementModal';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface WalletData {
  mode: string;
  details: string;
  totalAmount: number;
  count: number;
}

export default function PortefeuillesPage() {
  const { toast } = useToast();
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [resetModal, setResetModal] = useState<{ isOpen: boolean; wallet: any | null }>({ isOpen: false, wallet: null });
  const [isResetting, setIsResetting] = useState(false);
  const [statementModal, setStatementModal] = useState<{isOpen: boolean, wallet: any | null}>({ isOpen: false, wallet: null });

  // Security state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Change PIN state
  const [isChangePinModalOpen, setIsChangePinModalOpen] = useState(false);
  const [securityPhrase, setSecurityPhrase] = useState('');
  const [newPin, setNewPin] = useState(['', '', '', '', '', '']);
  const [changePinError, setChangePinError] = useState('');
  const [changePinSuccess, setChangePinSuccess] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  const newPinInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      document.body.style.overflow = 'hidden';
      if (pinInputRefs.current[0]) {
        pinInputRefs.current[0].focus();
      }
    } else {
      document.body.style.overflow = '';
    }
    
    return () => { document.body.style.overflow = ''; };
  }, [isAuthenticated]);

  const handlePinChange = (index: number, value: string, isNewPin = false) => {
    if (!/^[0-9]*$/.test(value)) return;
    
    const stateSetter = isNewPin ? setNewPin : setPin;
    const currentState = isNewPin ? newPin : pin;
    const refs = isNewPin ? newPinInputRefs : pinInputRefs;
    const errorSetter = isNewPin ? setChangePinError : setPinError;
    
    errorSetter('');
    const newArr = [...currentState];
    newArr[index] = value;
    stateSetter(newArr);
    
    if (value && index < 5 && refs.current[index + 1]) {
      refs.current[index + 1]?.focus();
    }

    if (!isNewPin && newArr.every(d => d !== '')) {
      verifyPin(newArr.join(''));
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>, isNewPin = false) => {
    const refs = isNewPin ? newPinInputRefs : pinInputRefs;
    if (e.key === 'Backspace' && !e.currentTarget.value && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const verifyPin = async (fullPin: string) => {
    setIsVerifying(true);
    try {
      const res = await fetch('/api/settings/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', pin: fullPin })
      });
      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        toast({ message: 'Accès autorisé', tone: 'ok' });
      } else {
        setPinError('Code PIN incorrect');
        setPin(['', '', '', '', '', '']);
        pinInputRefs.current[0]?.focus();
      }
    } catch (err) {
      setPinError('Erreur de vérification');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullPin = newPin.join('');
    if (fullPin.length !== 6) {
      setChangePinError('Code PIN incomplet');
      return;
    }
    setIsChangingPin(true);
    try {
      const res = await fetch('/api/settings/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change', phrase: securityPhrase, newPin: fullPin })
      });
      const data = await res.json();
      if (data.success) {
        setChangePinSuccess('Code PIN modifié avec succès.');
        setTimeout(() => {
          setIsChangePinModalOpen(false);
          setSecurityPhrase('');
          setNewPin(['', '', '', '', '', '']);
          setChangePinSuccess('');
        }, 1500);
      } else {
        setChangePinError(data.error || 'Erreur');
      }
    } catch (err) {
      setChangePinError('Erreur serveur');
    } finally {
      setIsChangingPin(false);
    }
  };


  // Restore user from localStorage if exists
  useEffect(() => {
    const saved = localStorage.getItem('elios_active_user');
    if (saved) setActiveUser(saved);
  }, []);

  const handleUserChange = (user: string) => {
    setActiveUser(user);
    localStorage.setItem('elios_active_user', user);
  };

  const { data: wallets, isLoading, error, mutate } = useSWR<WalletData[]>('/api/portefeuilles', fetcher);

  const handleReset = async () => {
    if (!resetModal.wallet) return;
    setIsResetting(true);
    try {
      const res = await fetch('/api/portefeuilles/reset', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: resetModal.wallet.mode, details: resetModal.wallet.details })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur de réinitialisation');
      
      toast({ message: data.message || 'Portefeuille réinitialisé avec succès.', tone: 'ok' });
      mutate();
      setResetModal({ isOpen: false, wallet: null });
    } catch (err: any) {
      toast({ message: err.message, tone: 'warn' });
    } finally {
      setIsResetting(false);
    }
  };

  // Helper pour les couleurs et icônes
  const getCardStyle = (mode: string, details: string) => {
    const key = `${mode}-${details}`;
    switch (key) {
      case 'Espèces-Bab Saadoun':
        return { bg: 'from-emerald-600 to-emerald-900', shadow: 'shadow-emerald-900/40' }; // Vert Émeraude
      case 'Espèces-Soumaya':
        return { bg: 'from-rose-800 to-rose-950', shadow: 'shadow-rose-900/40' }; // Rose Rubis très sombre
      case 'Espèces-Douar Hicher':
        return { bg: 'from-amber-700 to-amber-950', shadow: 'shadow-amber-900/40' }; // Or / Ambre très sombre
      
      case 'D17-Soumaya':
        return { bg: 'from-indigo-800 to-indigo-950', shadow: 'shadow-indigo-900/40' }; // Bleu Indigo très sombre
      case 'D17-Elyes':
        return { bg: 'from-cyan-600 to-teal-900', shadow: 'shadow-cyan-900/40' }; // Cyan / Sarcelle
      
      case 'Virement Bancaire-ATB Safa':
        return { bg: 'from-purple-800 to-purple-950', shadow: 'shadow-purple-900/40' }; // Violet Améthyste très sombre
      case 'Virement Bancaire-ATB Elyes':
        return { bg: 'from-slate-700 to-slate-900', shadow: 'shadow-slate-900/40' }; // Graphite / Ardoise
      case 'Virement Bancaire-El Baraka Elios':
        return { bg: 'from-red-700 to-red-950', shadow: 'shadow-red-900/40' }; // Rouge Cramoisi
      
      default:
        return { bg: 'from-gray-700 to-slate-900', shadow: 'shadow-gray-900/40' };
    }
  };

  return (
    <div className="min-h-[100dvh] bg-transparent font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-20 relative">
      <Header activeUser={activeUser} setActiveUser={handleUserChange} attention={!activeUser} />

      {!isAuthenticated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-xl">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl ring-1 ring-gray-900/10">
            <div className="flex justify-center mb-6">
              <div className="h-16 w-16 rounded-full bg-indigo-50 flex items-center justify-center ring-4 ring-indigo-50/50">
                <Lock className="h-8 w-8 text-indigo-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-center text-gray-900 tracking-tight">Accès Sécurisé</h2>
            <p className="text-sm text-gray-500 text-center mt-2 mb-8">Veuillez entrer votre code PIN administrateur pour accéder à la trésorerie.</p>
            
            <div className="flex gap-1.5 justify-center mb-6">
              {pin.map((digit, i) => (
                <input
                  key={i}
                  // @ts-ignore
                  ref={el => pinInputRefs.current[i] = el}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handlePinChange(i, e.target.value)}
                  onKeyDown={e => handlePinKeyDown(i, e)}
                  disabled={isVerifying}
                  className="w-10 h-12 text-center text-xl font-bold rounded-lg border border-gray-200 bg-gray-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-50 shadow-inner"
                />
              ))}
            </div>

            {pinError && (
              <p className="text-center text-red-500 text-sm font-medium animate-in slide-in-from-top-1 mb-4">{pinError}</p>
            )}

            <Link href="/" className="block w-full text-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors mt-6">
              &larr; Retour à l'accueil
            </Link>
          </div>
        </div>
      )}

      {isAuthenticated && (<main className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8 mt-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-gray-900 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-indigo-600" />
              Portefeuilles
            </h1>
            <p className="text-xs text-gray-500 mt-1">Supervisez l'ensemble des encaissements par destination.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsChangePinModalOpen(true)}
              className="text-xs font-medium text-gray-600 hover:text-gray-900 bg-white ring-1 ring-gray-200 hover:bg-transparent px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              title="Modifier le code PIN"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Changer PIN
            </button>
            <Link href="/" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors shadow-sm">
              &larr; Retour
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 p-6 text-center text-red-600">
            Une erreur est survenue lors du chargement des portefeuilles.
          </div>
        ) : !wallets || wallets.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white">
            <Wallet className="h-12 w-12 text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-900">Aucun portefeuille actif</h3>
            <p className="text-gray-500 mt-1">Les cartes apparaîtront dès que des reçus seront traités.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {wallets.map((wallet, idx) => {
              const style = getCardStyle(wallet.mode, wallet.details);
              return (
                <div key={`${wallet.mode}-${wallet.details}`} className="flex flex-col gap-3">
                  {/* Card Element */}
                  <div 
                    className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${style.bg} p-6 shadow-xl ${style.shadow} text-white flex flex-col justify-between h-[210px] transition-transform hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4 duration-500`}
                    style={{ animationFillMode: 'both', animationDelay: `${idx * 100}ms` }}
                  >
                    {/* Glassmorphism effects */}
                    <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
                    <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
                    <div className="absolute inset-0 border border-white/10 rounded-2xl pointer-events-none"></div>
                    
                    {/* Top Row: Labels */}
                    <div className="relative z-10 flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60 mb-1">Elios Balance</p>
                        <h3 className="text-sm font-bold tracking-widest uppercase">{wallet.mode} - {wallet.details || 'NON SPÉCIFIÉ'}</h3>
                      </div>
                    </div>

                    {/* Middle Row: Chip & Balance */}
                    <div className="relative z-10 flex items-center justify-between mt-4">
                      {/* Fake Chip */}
                      <div className="h-9 w-12 rounded bg-gradient-to-br from-amber-200 to-amber-500 opacity-90 shadow-inner overflow-hidden flex flex-wrap gap-[1px] p-[2px]">
                         <div className="w-full h-full border border-amber-600/30 rounded-sm"></div>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-[10px] font-medium text-white/70 uppercase tracking-widest mb-1 flex items-center justify-end gap-1">
                          SOLDE COURANT
                          <Wifi className="h-3 w-3 rotate-90" />
                        </p>
                        <div className="flex items-baseline justify-end gap-1">
                          <span className="text-3xl font-bold tracking-tight font-mono">
                            {wallet.totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-xl font-medium">DT</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Logo */}
                    <div className="relative z-10 mt-auto pt-4 flex items-end justify-between">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-300">
                        STATUT: ACTIF
                      </div>
                      <div className="text-2xl font-bold italic tracking-tighter">
                        ELIOS
                      </div>
                    </div>
                  </div>

                  {/* Buttons below the card */}
                  <div className="flex justify-end gap-2">
                     <button 
                       onClick={() => setStatementModal({ isOpen: true, wallet })}
                       className="flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-200/50 hover:bg-gray-200 text-gray-600 text-[10px] font-medium uppercase tracking-wider transition-colors shadow-sm backdrop-blur-sm border border-gray-300/50"
                       title="Voir l'extrait"
                     >
                       <FileText className="h-2.5 w-2.5" />
                       Extrait
                     </button>
                     <button 
                       onClick={() => setResetModal({ isOpen: true, wallet })}
                       className="flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-200/50 hover:bg-gray-200 text-gray-600 text-[10px] font-medium uppercase tracking-wider transition-colors shadow-sm backdrop-blur-sm border border-gray-300/50"
                       title="Remettre à zéro"
                     >
                       <RefreshCw className="h-2.5 w-2.5" />
                       Remise à Zéro
                     </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      )} {/* End isAuthenticated check for main */}

      {/* Change PIN Modal */}
      {isChangePinModalOpen && (
        <div className="relative z-50" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => !isChangingPin && setIsChangePinModalOpen(false)}></div>
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-md ring-1 ring-gray-200 p-8 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-center mb-6">
                  <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center">
                    <KeyRound className="h-6 w-6 text-indigo-600" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-center text-gray-900 mb-2">Modifier le code PIN</h3>
                <p className="text-sm text-center text-gray-500 mb-6">Pour des raisons de sécurité, veuillez entrer la phrase de confiance secrète, suivie de votre nouveau code PIN.</p>
                
                <form onSubmit={handleChangePin} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">Phrase de confiance</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Saisissez la phrase de confiance"
                      className="block w-full rounded-lg border border-gray-200 bg-gray-100 py-2 px-3 text-sm text-gray-900 shadow-inner focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={securityPhrase}
                      onChange={e => {setSecurityPhrase(e.target.value); setChangePinError('');}}
                      disabled={isChangingPin || !!changePinSuccess}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">Nouveau code PIN</label>
                    <div className="flex gap-1.5 justify-center">
                      {newPin.map((digit, i) => (
                        <input
                          key={i}
                          // @ts-ignore
                          ref={el => newPinInputRefs.current[i] = el}
                          type="password"
                          inputMode="numeric"
                          maxLength={1}
                          required
                          value={digit}
                          onChange={e => handlePinChange(i, e.target.value, true)}
                          onKeyDown={e => handlePinKeyDown(i, e, true)}
                          disabled={isChangingPin || !!changePinSuccess}
                          className="w-8 h-10 text-center text-lg font-bold rounded-md border border-gray-200 bg-gray-100 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                        />
                      ))}
                    </div>
                  </div>

                  {changePinError && <p className="text-red-500 text-sm font-medium text-center">{changePinError}</p>}
                  {changePinSuccess && <p className="text-emerald-600 text-sm font-medium text-center">{changePinSuccess}</p>}

                  <div className="mt-5 sm:mt-6 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsChangePinModalOpen(false)}
                      disabled={isChangingPin || !!changePinSuccess}
                      className="inline-flex flex-1 justify-center rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-transparent"
                    >
                      Annuler
                    </button>
                    <button 
                      type="submit"
                      disabled={isChangingPin || !!changePinSuccess}
                      className="inline-flex flex-1 justify-center items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {isChangingPin && <RefreshCw className="h-4 w-4 animate-spin" />}
                      Sauvegarder
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statement Modal */}
      {statementModal.isOpen && statementModal.wallet && (
        <StatementModal 
          wallet={statementModal.wallet}
          onClose={() => setStatementModal({ isOpen: false, wallet: null })}
        />
      )}

      {/* Modal de confirmation */}
      {resetModal.isOpen && resetModal.wallet && (
        <div className="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div 
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => !isResetting && setResetModal({ isOpen: false, wallet: null })}
          ></div>
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg ring-1 ring-gray-200 p-6 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-4 mb-4 text-red-600">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 shrink-0">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 leading-6" id="modal-title">Confirmation de purge</h3>
                </div>
                <div className="mt-2">
                  <p className="text-sm text-gray-500 mb-6">
                    Êtes-vous sûr de vouloir remettre à zéro le portefeuille 
                    <strong className="text-gray-900 mx-1">{resetModal.wallet.mode} - {resetModal.wallet.details}</strong> ? 
                    Cette action effectuera un "Hard Delete" : tous les reçus liés (et leurs images sur le Drive) seront définitivement effacés. 
                    Cette action est irréversible.
                  </p>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                  <button 
                    type="button"
                    onClick={handleReset}
                    disabled={isResetting}
                    className="inline-flex w-full justify-center items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:w-auto disabled:opacity-50"
                  >
                    {isResetting && <RefreshCw className="h-4 w-4 animate-spin" />}
                    Oui, remettre à zéro
                  </button>
                  <button 
                    type="button"
                    onClick={() => setResetModal({ isOpen: false, wallet: null })}
                    disabled={isResetting}
                    className="mt-3 inline-flex w-full justify-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-transparent sm:mt-0 sm:w-auto disabled:opacity-50"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
