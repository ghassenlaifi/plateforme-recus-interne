"use client";

import React, { useState, useRef, FormEvent } from 'react';
import { CloudUpload, X, FileText, Loader2 } from 'lucide-react';
import { useToast } from './Toast';

interface UploadZoneProps {
  activeUser: string | null;
  triggerAttention: () => void;
  onUploadSuccess: (message: string) => void;
}

export function UploadZone({ activeUser, triggerAttention, onUploadSuccess }: UploadZoneProps) {
  const { toast } = useToast();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isOver, setIsOver] = useState(false);
  const [fileData, setFileData] = useState<{ file: File; name: string; size: number; type: string; url: string | null } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    classeSelect: '',
    classeCustom: '',
    email: '',
    mode: '',
    paymentDetails: '',
    amount: '',
    date: '',
    note: ''
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const digitsOf = (s: string) => s.replace(/\D/g, '');
  const formatPhone = (val: string) => {
    const d = digitsOf(val).slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0,2)} ${d.slice(2)}`;
    return `${d.slice(0,2)} ${d.slice(2,5)} ${d.slice(5)}`;
  };

  const formatDateInput = (val: string) => {
    const d = digitsOf(val).slice(0, 8);
    if (d.length >= 5) return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
    if (d.length >= 3) return `${d.slice(0,2)}/${d.slice(2)}`;
    return d;
  };

  const toISO = (dateStr: string) => {
    const [dd, mm, yyyy] = dateStr.split('/');
    if (!dd || !mm || !yyyy || yyyy.length !== 4) return '';
    return `${yyyy}-${mm}-${dd}T12:00:00Z`;
  };

  const todayFR = () => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  };

  const fmtSize = (b: number) => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} Ko` : `${(b / 1048576).toFixed(1).replace('.', ',')} Mo`);

  const handleFile = (file: File | null) => {
    if (!activeUser) {
      triggerAttention();
      return;
    }
    if (!file) return;
    const okType = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!okType) { 
      toast({ message: 'Format non pris en charge. Utilisez PNG, JPG ou PDF.', tone: 'warn' }); 
      return; 
    }
    if (file.size > 10 * 1024 * 1024) { 
      toast({ message: 'Fichier trop volumineux (10 Mo maximum).', tone: 'warn' }); 
      return; 
    }
    
    setFileData({
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    });
    setFormData(prev => ({ ...prev, date: prev.date || todayFR() }));
  };

  const clearFile = () => {
    if (fileData?.url) URL.revokeObjectURL(fileData.url);
    setFileData(null);
  };

  const loadDemo = async () => {
    clearFile();
    const blob = new Blob(['dummy content'], { type: 'image/jpeg' });
    const dummyFile = new File([blob], 'recu-demo.jpg', { type: 'image/jpeg' });

    setFileData({
      file: dummyFile,
      name: dummyFile.name,
      size: dummyFile.size,
      type: dummyFile.type,
      url: null
    });
    setFormData({
      name: 'Sarra Ben Youssef',
      phone: '22 345 678',
      classeSelect: 'Zero To Hero',
      classeCustom: '',
      email: '',
      mode: 'Edinar - D17',
      paymentDetails: 'Soumaya',
      amount: '150',
      date: todayFR(),
      note: ''
    });
    setErrors({});
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeUser) {
      triggerAttention();
      return;
    }

    const newErrors: Record<string, boolean> = {};
    let firstBad = '';

    const check = (field: keyof typeof formData, condition: boolean) => {
      if (condition) {
        newErrors[field] = true;
        if (!firstBad) firstBad = field;
      }
    };

    const finalClasse = formData.classeSelect === 'Offre personnalisé' ? formData.classeCustom : formData.classeSelect;

    check('phone', digitsOf(formData.phone).length !== 8);
    check('mode', !formData.mode);
    check('paymentDetails', !formData.paymentDetails.trim());
    check('amount', !formData.amount.trim() || isNaN(parseFloat(formData.amount)));

    setErrors(newErrors);

    if (firstBad) {
      toast({ message: 'Complétez les champs obligatoires signalés en rouge.', tone: 'warn' });
      const el = document.getElementById(`f-${firstBad}`);
      if (el) el.focus();
      return;
    }

    if (!fileData) {
      toast({ message: 'Veuillez joindre un fichier.', tone: 'warn' });
      return;
    }

    setIsUploading(true);

    try {
      const payload = new FormData();
      payload.append('file', fileData.file);
      payload.append('nom', formData.name.trim());
      payload.append('telephone', digitsOf(formData.phone));
      payload.append('classe', finalClasse.trim());
      if (formData.email.trim()) payload.append('email', formData.email.trim());
      if (formData.note.trim()) payload.append('note', formData.note.trim());
      payload.append('paymentMode', formData.mode.trim());
      payload.append('paymentDetails', formData.paymentDetails.trim());
      payload.append('amount', formData.amount.trim());
      if (formData.date.trim()) payload.append('paymentDate', toISO(formData.date));
      payload.append('uploadedBy', activeUser);

      const res = await fetch('/api/receipts', {
        method: 'POST',
        body: payload
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erreur lors de la soumission du reçu');
      }

      setFormData({ name: '', phone: '', classeSelect: '', classeCustom: '', email: '', mode: '', paymentDetails: '', amount: '', date: '', note: '' });
      setErrors({});
      clearFile();
      
      onUploadSuccess(`Reçu de ${formData.name.trim()} ajouté à la file d’attente.`);
      
      if (window.matchMedia('(max-width: 1023px)').matches) {
        document.getElementById('zoneQueue')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err: any) {
      console.error(err);
      toast({ message: err.message || 'Une erreur est survenue lors de l’envoi.', tone: 'warn' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section id="zoneUpload" className="min-w-0" aria-labelledby="hUpload">
      <div className="mb-4">
        <h2 id="hUpload" className="text-base font-semibold tracking-tight">Nouveau reçu</h2>
        <p className="mt-1 text-sm text-gray-500">Déposez l’image du reçu, puis remplir les informations du client.</p>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5 sm:p-6">
        <input 
          id="fileInput" 
          type="file" 
          accept="image/*,application/pdf" 
          className="sr-only" 
          tabIndex={-1} 
          aria-hidden="true"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files) handleFile(e.target.files[0]);
            e.target.value = '';
          }}
        />

        {/* Dropzone */}
        <div 
          id="dropzone" 
          role="button" 
          tabIndex={0} 
          aria-label="Choisir un reçu à téléverser"
          className={`dz group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/60 px-4 py-9 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 sm:px-6 sm:py-10 ${isOver ? 'is-over' : ''} ${fileData ? 'hidden' : ''}`}
          onClick={() => { if (!activeUser) { triggerAttention(); } else { fileInputRef.current?.click(); } }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!activeUser) { triggerAttention(); } else { fileInputRef.current?.click(); } } }}
          onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsOver(false); }}
          onDrop={(e) => { e.preventDefault(); setIsOver(false); if (e.dataTransfer.files) handleFile(e.dataTransfer.files[0]); }}
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200 transition group-hover:scale-105">
            <CloudUpload className="h-6 w-6" strokeWidth={1.6} />
          </span>
          <p className="hover-only mt-4 text-sm text-gray-700">Glissez-déposez le reçu ici ou <span className="font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-4">Parcourir</span></p>
          <p className="touch-only mt-4 text-sm text-gray-700"><span className="font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-4">Touchez ici</span> pour choisir le reçu</p>
          <p className="mt-1 text-xs text-gray-400">PNG, JPG ou PDF, jusqu’à 10 Mo</p>
        </div>



        {/* Fichier sélectionné */}
        {fileData && (
          <div id="fileChip" className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 ring-1 ring-inset ring-gray-200">
            <div id="chipThumb" className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-white text-gray-400 ring-1 ring-gray-200">
              {fileData.url ? (
                <img src={fileData.url} alt="" className="h-full w-full object-cover" />
              ) : fileData.type === 'application/pdf' ? (
                <FileText className="h-5 w-5" strokeWidth={1.6} />
              ) : (
                <div className="flex h-full w-full flex-col gap-1 p-2">
                  <span className="h-1 w-4 rounded bg-gray-300"></span>
                  <span className="h-1 w-full rounded bg-gray-200"></span>
                  <span className="h-1 w-3/4 rounded bg-gray-200"></span>
                  <span className="mt-auto h-1.5 w-1/2 self-end rounded bg-gray-400/70"></span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p id="chipName" className="truncate text-sm font-medium text-gray-900">{fileData.name}</p>
              <p id="chipSize" className="text-xs text-gray-500">{fmtSize(fileData.size)}</p>
            </div>
            <button 
              type="button" 
              id="chipRemove" 
              onClick={clearFile}
              disabled={isUploading}
              aria-label="Retirer le fichier"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-gray-400 transition hover:bg-gray-200/60 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:h-8 sm:w-8 disabled:opacity-50"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Formulaire */}
        <div id="formReveal" className={`reveal ${fileData ? 'is-open' : ''}`}>
          <div className="reveal-inner">
            <form id="uploadForm" noValidate onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
                <label className="label" htmlFor="f-name">Élève(s)</label>
                <input 
                  id="f-name" 
                  name="name" 
                  type="text" 
                  className="input" 
                  placeholder="Nom(s) de l'élève..." 
                  autoComplete="off" 
                  aria-invalid={errors.name ? 'true' : 'false'}
                  value={formData.name}
                  disabled={isUploading}
                  onChange={(e) => { setFormData({...formData, name: e.target.value}); setErrors({...errors, name: false}); }}
                />
              </div>

              <div>
                <label className="label" htmlFor="f-phone">Numéro de téléphone</label>
                <div className="relative">
                  <span className="tnum pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">+216</span>
                  <input 
                    id="f-phone" 
                    name="phone" 
                    type="tel" 
                    inputMode="tel" 
                    maxLength={10} 
                    className="input tnum pl-12" 
                    placeholder="XX XXX XXX" 
                    autoComplete="off" 
                    aria-invalid={errors.phone ? 'true' : 'false'}
                    value={formData.phone}
                    disabled={isUploading}
                    onChange={(e) => { setFormData({...formData, phone: formatPhone(e.target.value)}); setErrors({...errors, phone: false}); }}
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="f-email">Email</label>
                <input 
                  id="f-email" 
                  name="email" 
                  type="email" 
                  className="input" 
                  placeholder="email@gmail.com" 
                  autoComplete="off" 
                  value={formData.email}
                  disabled={isUploading}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
                <label className="label" htmlFor="f-classeSelect">Offre</label>
                <div className="relative">
                  <select
                    id="f-classeSelect"
                    className="input appearance-none pr-10"
                    aria-invalid={errors.classeSelect ? 'true' : 'false'}
                    value={formData.classeSelect}
                    disabled={isUploading}
                    onChange={(e) => {
                      setFormData({...formData, classeSelect: e.target.value, classeCustom: ''});
                      setErrors({...errors, classeSelect: false});
                    }}
                  >
                    <option value="" disabled>Sélectionner une offre</option>
                    <option value="Zero To Hero Primo">Zero To Hero Primo</option>
                    <option value="Zero To Hero Secondo">Zero To Hero Secondo</option>
                    <option value="Zero To Hero Lite">Zero To Hero Lite</option>
                    <option value="Zero To Hero">Zero To Hero</option>
                    <option value="Offre personnalisé">Offre personnalisé</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {formData.classeSelect === 'Offre personnalisé' && (
                <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
                  <label className="label" htmlFor="f-classeCustom">Nature de l'offre</label>
                  <input 
                    id="f-classeCustom" 
                    name="classeCustom" 
                    type="text" 
                    className="input" 
                    placeholder="Précisez l'offre..." 
                    autoComplete="off"
                    aria-invalid={errors.classeCustom ? 'true' : 'false'}
                    value={formData.classeCustom}
                    disabled={isUploading}
                    onChange={(e) => { setFormData({...formData, classeCustom: e.target.value}); setErrors({...errors, classeCustom: false}); }}
                  />
                </div>
              )}

              <div>
                <label className="label" htmlFor="f-mode">Mode de paiement</label>
                <div className="relative">
                  <select 
                    id="f-mode" 
                    name="mode" 
                    className="input appearance-none pr-10"
                    aria-invalid={errors.mode ? 'true' : 'false'}
                    value={formData.mode}
                    disabled={isUploading}
                    onChange={(e) => { setFormData({...formData, mode: e.target.value, paymentDetails: ''}); setErrors({...errors, mode: false}); }}
                  >
                    <option value="" disabled>Sélectionner un mode</option>
                    <option value="Espèces">Espèces</option>
                    <option value="Virement Bancaire">Virement Bancaire</option>
                    <option value="Edinar - D17">Edinar - D17</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {formData.mode && (
                <div>
                  <label className="label" htmlFor="f-paymentDetails">
                    {formData.mode === 'Espèces' && 'Local'}
                    {formData.mode === 'Virement Bancaire' && 'Banque'}
                    {formData.mode === 'Edinar - D17' && 'Titulaire de la carte'}
                  </label>
                  <div className="relative">
                    <select 
                      id="f-paymentDetails" 
                      name="paymentDetails" 
                      className="input appearance-none pr-10"
                      aria-invalid={errors.paymentDetails ? 'true' : 'false'}
                      value={formData.paymentDetails}
                      disabled={isUploading}
                      onChange={(e) => { setFormData({...formData, paymentDetails: e.target.value}); setErrors({...errors, paymentDetails: false}); }}
                    >
                      {formData.mode === 'Espèces' && (
                        <>
                          <option value="" disabled>Sélectionner un local</option>
                          <option value="Bab Saadoun">Bab Saadoun</option>
                          <option value="Douar Hicher">Douar Hicher</option>
                          <option value="Soumaya">Soumaya</option>
                        </>
                      )}
                      {formData.mode === 'Edinar - D17' && (
                        <>
                          <option value="" disabled>Sélectionner un titulaire</option>
                          <option value="Soumaya">Soumaya</option>
                          <option value="Elyes">Elyes</option>
                        </>
                      )}
                      {formData.mode === 'Virement Bancaire' && (
                        <>
                          <option value="" disabled>Sélectionner une banque</option>
                          <option value="ATB Safa">ATB Safa</option>
                          <option value="ATB Elyes">ATB Elyes</option>
                          <option value="El Baraka Elios">El Baraka Elios</option>
                        </>
                      )}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="label" htmlFor="f-amount">Montant</label>
                <div className="relative">
                  <input 
                    id="f-amount" 
                    name="amount" 
                    type="number" 
                    step="0.01"
                    min="0"
                    className="input tnum pr-12" 
                    placeholder="0.00" 
                    autoComplete="off" 
                    aria-invalid={errors.amount ? 'true' : 'false'}
                    value={formData.amount}
                    disabled={isUploading}
                    onChange={(e) => { setFormData({...formData, amount: e.target.value}); setErrors({...errors, amount: false}); }}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-gray-500">DT</span>
                </div>
              </div>

              <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
                <label className="label" htmlFor="f-date">Date du paiement (JJ/MM/AAAA)</label>
                <input 
                  id="f-date" 
                  name="date" 
                  type="text" 
                  inputMode="numeric"
                  className="input tnum" 
                  placeholder="JJ/MM/AAAA"
                  aria-invalid={errors.date ? 'true' : 'false'}
                  value={formData.date}
                  disabled={isUploading}
                  onChange={(e) => { setFormData({...formData, date: formatDateInput(e.target.value)}); setErrors({...errors, date: false}); }}
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
                <label className="label" htmlFor="f-note">Note <span className="text-gray-400 font-normal">(Facultatif)</span></label>
                <textarea 
                  id="f-note" 
                  name="note" 
                  rows={2}
                  className="input py-2" 
                  placeholder="Ajouter une note..." 
                  value={formData.note}
                  disabled={isUploading}
                  onChange={(e) => setFormData({...formData, note: e.target.value})}
                />
              </div>

              <div className="mt-2 sm:col-span-2 lg:col-span-1 xl:col-span-2">
                <button type="submit" disabled={isUploading} className="btn btn-accent h-12 w-full text-[15px] sm:h-12 disabled:opacity-75 disabled:cursor-not-allowed">
                  {isUploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  {isUploading ? 'Envoi en cours...' : 'Soumettre le reçu'}
                </button>
                <p id="submitHint" className="mt-2.5 text-center text-xs text-gray-500">
                  {activeUser ? (
                    <>Sera enregistré au nom de <span className="font-medium text-gray-700">{activeUser}</span>.</>
                  ) : (
                    'Sélectionnez votre nom en haut de page pour soumettre.'
                  )}
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

