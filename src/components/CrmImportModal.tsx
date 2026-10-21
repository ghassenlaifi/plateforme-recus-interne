"use client";

import React, { useState, useRef } from 'react';
import * as xlsx from 'xlsx';
import { standardizeImportRow, StandardizedLeadCandidate } from '@/lib/leadNormalizer';
import { ELIOS_SOURCES, ELIOS_STATUSES } from '@/types/crm';

interface CrmImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  crmType: 'elios' | 'formatic' | 'sos-prof';
  crmName: string;
  activeUser: string | null;
  onSuccess: () => void;
}

export function CrmImportModal({
  isOpen,
  onClose,
  crmType,
  crmName,
  activeUser,
  onSuccess
}: CrmImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [previewCandidates, setPreviewCandidates] = useState<StandardizedLeadCandidate[]>([]);
  const [defaultSource, setDefaultSource] = useState(crmType === 'formatic' ? 'Formatic dataBase' : 'Import Excel');
  const [defaultStatus, setDefaultStatus] = useState('Lead');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importReport, setImportReport] = useState<{
    success: boolean;
    totalRows: number;
    imported: number;
    preserved: number;
    invalid: number;
    errors: string[];
    message: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    processSelectedFile(selected);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    processSelectedFile(dropped);
  };

  const processSelectedFile = (selectedFile: File) => {
    setErrorMsg('');
    setImportReport(null);
    setFile(selectedFile);
    setFileName(selectedFile.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = xlsx.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          setErrorMsg('Le fichier ne contient aucune feuille de calcul.');
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const raw = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
        if (!raw || raw.length === 0) {
          setErrorMsg('Le fichier est vide ou aucune donnée n\'a été détectée.');
          return;
        }

        setParsedRows(raw);

        // Pré-analyse des 5 premières lignes avec normalisation
        const preview = raw.slice(0, 5).map(row => 
          standardizeImportRow(row as any, {
            defaultSource,
            defaultStatus,
            operator: activeUser || 'Import Système',
            crmType
          })
        );
        setPreviewCandidates(preview);
      } catch (err: any) {
        setErrorMsg('Erreur lors de la lecture du fichier : ' + (err.message || 'Fichier non pris en charge'));
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleExecuteImport = async () => {
    if (!file && parsedRows.length === 0) return;
    try {
      setIsProcessing(true);
      setErrorMsg('');

      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      } else {
        // Envoi des lignes JSON
        formData.append('rows', JSON.stringify(parsedRows));
      }
      formData.append('defaultSource', defaultSource);
      formData.append('defaultStatus', defaultStatus);
      formData.append('operator', activeUser || 'Import Système');

      const res = await fetch(`/api/leads/${crmType}/import`, {
        method: 'POST',
        body: formData
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Erreur lors de l\'importation');
      }

      setImportReport(result);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur est survenue pendant l\'importation');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setFileName('');
    setParsedRows([]);
    setPreviewCandidates([]);
    setImportReport(null);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-[var(--card)] rounded-2xl sm:rounded-3xl shadow-2xl border border-[var(--line)] overflow-hidden animate-pop">
        {/* En-tête */}
        <div className="p-4 sm:p-5 border-b border-[var(--line)] flex items-center justify-between bg-[var(--hover)]/40">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 font-bold text-lg flex items-center justify-center flex-shrink-0 border border-emerald-500/25">
              📥
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] tracking-tight">
                Importer des prospects Excel / CSV
              </h2>
              <p className="text-xs text-[var(--ink3)]">
                Destination : <strong className="text-[var(--ink)]">{crmName}</strong> • Règle d'or : <span className="text-emerald-600 font-bold">Zéro écrasement des données existantes</span>
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            disabled={isProcessing}
            className="w-8 h-8 rounded-xl border border-[var(--line)] bg-[var(--card)] hover:bg-[var(--hover)] text-[var(--ink3)] hover:text-[var(--ink)] flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Corps défilable */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Rapport de résultat final */}
          {importReport ? (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3 animate-pop">
              <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                <span className="text-lg">✓</span>
                <span>Rapport d'importation terminé avec succès</span>
              </div>
              <p className="text-xs text-[var(--ink)] leading-relaxed">
                {importReport.message}
              </p>
              <div className="grid grid-cols-3 gap-2.5 pt-2">
                <div className="p-2.5 rounded-xl bg-[var(--card)] border border-[var(--line)] text-center">
                  <span className="text-xs text-[var(--ink3)] block">Nouveaux importés</span>
                  <b className="text-base sm:text-lg text-emerald-600">+{importReport.imported}</b>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--card)] border border-[var(--line)] text-center">
                  <span className="text-xs text-[var(--ink3)] block" title="Préservés intacts sans modification">Conservés intacts</span>
                  <b className="text-base sm:text-lg text-blue-600">{importReport.preserved}</b>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--card)] border border-[var(--line)] text-center">
                  <span className="text-xs text-[var(--ink3)] block">Lignes ignorées</span>
                  <b className="text-base sm:text-lg text-amber-600">{importReport.invalid}</b>
                </div>
              </div>

              {importReport.errors && importReport.errors.length > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 max-h-32 overflow-y-auto space-y-1">
                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block">Détail des lignes ignorées :</span>
                  {importReport.errors.map((err, i) => (
                    <div key={i} className="text-[10px] text-[var(--ink2)] font-mono">• {err}</div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Zone Drag & Drop si aucun fichier */}
              {!file && parsedRows.length === 0 ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-8 sm:p-10 rounded-2xl border-2 border-dashed border-[var(--line)] hover:border-emerald-500/50 bg-[var(--hover)]/30 hover:bg-[var(--hover)]/70 flex flex-col items-center justify-center text-center cursor-pointer transition space-y-2.5 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 text-2xl flex items-center justify-center group-hover:scale-105 transition">
                    📄
                  </div>
                  <div>
                    <b className="text-sm sm:text-base text-[var(--ink)] block">
                      Glissez votre fichier Excel ou CSV ici
                    </b>
                    <span className="text-xs text-[var(--ink3)] block mt-0.5">
                      ou cliquez pour parcourir vos fichiers (.xlsx, .xls, .csv)
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[var(--card)] border border-[var(--line)] text-[var(--ink2)]">
                    Format auto-détecté • Normalisation intelligente des colonnes
                  </div>
                </div>
              ) : (
                /* Fichier sélectionné + Résumé */
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-[var(--hover)] border border-[var(--line)] flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-lg">📊</span>
                      <div className="min-w-0">
                        <b className="text-xs sm:text-sm text-[var(--ink)] block truncate">{fileName}</b>
                        <span className="text-[11px] text-[var(--ink3)]">
                          {parsedRows.length} ligne{parsedRows.length > 1 ? 's' : ''} détectée{parsedRows.length > 1 ? 's' : ''} dans le fichier
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-2.5 py-1 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-500/10 transition"
                    >
                      Changer de fichier
                    </button>
                  </div>

                  {/* Paramètres d'importation par défaut */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[var(--hover)]/40 border border-[var(--line)]">
                    <div>
                      <label className="text-[10px] font-bold text-[var(--ink3)] uppercase tracking-wider block mb-1">
                        Source d'acquisition par défaut
                      </label>
                      <select
                        value={defaultSource}
                        onChange={(e) => setDefaultSource(e.target.value)}
                        className="w-full py-1.5 px-2.5 text-xs rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"
                      >
                        <option value="Import Excel">Import Excel</option>
                        {ELIOS_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-[var(--ink3)] uppercase tracking-wider block mb-1">
                        Statut initial si non renseigné
                      </label>
                      <select
                        value={defaultStatus}
                        onChange={(e) => setDefaultStatus(e.target.value)}
                        className="w-full py-1.5 px-2.5 text-xs rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"
                      >
                        {ELIOS_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Aperçu en direct de la normalisation */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[var(--ink)]">
                        Aperçu des 5 premières fiches normalisées :
                      </span>
                      <span className="text-[11px] text-[var(--ink3)]">
                        Standardisation temps réel
                      </span>
                    </div>

                    <div className="border border-[var(--line)] rounded-xl overflow-hidden overflow-x-auto">
                      <table className="w-full text-left text-[11px] divide-y divide-[var(--line)]">
                        <thead className="bg-[var(--hover)] font-bold text-[var(--ink3)] uppercase text-[9px] tracking-wider">
                          <tr>
                            <th className="py-2 px-2.5">Prospect</th>
                            <th className="py-2 px-2.5">Téléphone</th>
                            <th className="py-2 px-2.5">Niveau</th>
                            <th className="py-2 px-2.5">Section</th>
                            <th className="py-2 px-2.5">Statut</th>
                            {crmType === 'sos-prof' && <th className="py-2 px-2.5">Enseignants</th>}
                            <th className="py-2 px-2.5">Source</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--line)] bg-[var(--card)]">
                          {previewCandidates.map((c, i) => (
                            <tr key={i} className="hover:bg-[var(--hover)]/50">
                              <td className="py-2 px-2.5 font-semibold text-[var(--ink)] whitespace-nowrap">
                                {c.name}
                              </td>
                              <td className="py-2 px-2.5 font-mono whitespace-nowrap">
                                <span className={c.isValidPhone ? 'text-emerald-600 font-semibold' : 'text-red-500 font-bold'}>
                                  {c.cleanPhone || '—'}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 whitespace-nowrap">{c.grade || '—'}</td>
                              <td className="py-2 px-2.5 whitespace-nowrap">{c.section || '—'}</td>
                              <td className="py-2 px-2.5 whitespace-nowrap">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600">
                                  {c.status}
                                </span>
                              </td>
                              {crmType === 'sos-prof' && (
                                <td className="py-2 px-2.5 whitespace-nowrap">
                                  {c.assignedTeachers && c.assignedTeachers.length > 0 ? (
                                    <span className="text-purple-600 font-medium">
                                      {c.assignedTeachers.join(', ')}
                                    </span>
                                  ) : '—'}
                                </td>
                              )}
                              <td className="py-2 px-2.5 whitespace-nowrap text-[var(--ink3)]">{c.source}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Bandeau d'intégrité */}
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] flex items-center gap-2">
                    <span className="text-base">🛡️</span>
                    <span>
                      <strong>Règle militaire active :</strong> Si un numéro est déjà présent dans la base de <strong>{crmName}</strong>, sa fiche existante sera <strong>strictement préservée sans écrasement</strong>. Seuls les prospects nouveaux seront ajoutés.
                    </span>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-semibold flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{errorMsg}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pied de page avec actions */}
        <div className="p-3.5 sm:p-4 border-t border-[var(--line)] bg-[var(--hover)]/30 flex items-center justify-end gap-2.5">
          {importReport ? (
            <button
              type="button"
              onClick={onClose}
              className="btn pri text-xs py-2 px-4 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Terminer & Actualiser la liste
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="btn text-xs py-2 px-3.5 rounded-xl font-medium"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isProcessing || (!file && parsedRows.length === 0)}
                onClick={handleExecuteImport}
                className="btn pri text-xs py-2 px-4 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
              >
                {isProcessing ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Importation sécurisée en cours...</span>
                  </>
                ) : (
                  <>
                    <span>📥</span>
                    <span>Lancer l'importation ({parsedRows.length} lignes)</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

