"use client";

import React, { useState } from 'react';
import useSWR from 'swr';
import { Loader2, Trash2, Plus, UserCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { THEMES, getThemeColors, Operator } from '@/types';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function OperatorsAdmin() {
  const { data: operators, error, isLoading, mutate } = useSWR<Operator[]>('/api/operators', fetcher);
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [theme, setTheme] = useState('indigo');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/operators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), theme }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la création');

      toast({ message: 'Opérateur ajouté avec succès', tone: 'ok' });
      setName('');
      mutate(); // Rafraichir la liste
    } catch (err: any) {
      toast({ message: err.message, tone: 'warn' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, operatorName: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'opérateur "${operatorName}" ?`)) return;

    // Optimistic UI
    mutate(operators?.filter(op => op._id !== id), false);

    try {
      const res = await fetch(`/api/operators/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Erreur de suppression');
      
      toast({ message: 'Opérateur supprimé' });
      mutate();
    } catch (err) {
      toast({ message: 'Erreur lors de la suppression', tone: 'warn' });
      mutate();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 antialiased">
      <header className="sticky top-0 z-40 bg-white shadow-sm ring-1 ring-gray-200">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-semibold tracking-tight">Administration des Opérateurs</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8">
          <h2 className="text-base font-semibold leading-7 text-gray-900">Ajouter un Opérateur</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            Créez un nouvel opérateur qui pourra traiter les reçus. Choisissez un thème de couleur pour l'identifier facilement.
          </p>

          <form onSubmit={handleSubmit} className="mt-6">
            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div className="sm:col-span-4">
                <label htmlFor="name" className="label">Nom de l'opérateur</label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="name"
                    id="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input bg-white"
                    placeholder="ex: Elios"
                  />
                </div>
              </div>

              <div className="sm:col-span-6">
                <label className="label">Thème de couleur</label>
                <div className="mt-3 flex flex-wrap gap-4">
                  {Object.entries(THEMES).map(([key, t]) => (
                    <label key={key} className="relative flex cursor-pointer items-center gap-3 rounded-full border border-gray-200 px-3 py-2 hover:bg-gray-50 transition focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2">
                      <input 
                        type="radio" 
                        name="theme" 
                        value={key} 
                        checked={theme === key}
                        onChange={() => setTheme(key)}
                        className="sr-only" 
                      />
                      <span className="h-5 w-5 rounded-full ring-1 ring-inset ring-black/10" style={{ backgroundColor: t.dot }}></span>
                      <span className="text-sm font-medium text-gray-900">{t.label}</span>
                      {theme === key && (
                        <div className="absolute inset-0 rounded-full border-2 border-indigo-600"></div>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-x-6 border-t border-gray-100 pt-6">
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="inline-flex items-center justify-center rounded-lg border border-gray-900 bg-gray-100 px-6 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" strokeWidth={2.5} />
                )}
                Créer l'opérateur
              </button>
            </div>
          </form>
        </div>

        <div className="mt-10">
          <h2 className="text-base font-semibold leading-7 text-gray-900">Opérateurs existants</h2>
          <div className="mt-4">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-600">
                Erreur lors du chargement des opérateurs.
              </div>
            ) : operators?.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-12 text-center">
                <UserCircle className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-4 text-sm font-medium text-gray-900">Aucun opérateur</p>
                <p className="mt-1 text-sm text-gray-500">Commencez par ajouter un opérateur ci-dessus.</p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {operators?.map(op => {
                  const colors = getThemeColors(op.theme);
                  return (
                    <li key={op._id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 transition hover:shadow-md">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ backgroundColor: colors.bg, color: colors.fg }}>
                          <span className="text-sm font-bold leading-none">{op.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">{op.name}</p>
                          <p className="text-xs text-gray-500">{colors.label}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDelete(op._id, op.name)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                        title="Supprimer l'opérateur"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}

