import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const CLASSE_OPTIONS = ['7ème de Base', '8ème de Base', '9ème de Base', '1ère de Base', '2ème de Base', '3ème de Base', 'BAC'];
const SECTION_OPTIONS = ['Sciences Expérimentales', 'Mathématiques', 'Technique', 'Informatique', 'Économie', 'Lettres', 'Sport'];

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'blue' | 'indigo';
}

export function NewLeadModal({ isOpen, onClose, theme }: NewLeadModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const themeBtn = theme === 'blue' ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500/50' : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500/50';
  const themeRing = theme === 'blue' ? 'focus:ring-blue-500/20 focus:border-blue-500' : 'focus:ring-indigo-500/20 focus:border-indigo-500';

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col transform transition-all scale-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-[17px] font-extrabold text-gray-900 tracking-tight">Nouveau Prospect</h2>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
              Téléphone (Requis)
            </label>
            <input 
              type="tel"
              placeholder="Ex: 20 123 456"
              className={`w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ${themeRing} text-gray-900 font-medium text-sm transition-all shadow-sm`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Classe
              </label>
              <select className={`w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ${themeRing} text-gray-900 font-medium text-sm appearance-none transition-all shadow-sm`}>
                <option value="">Sélectionner...</option>
                {CLASSE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                Section
              </label>
              <select className={`w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ${themeRing} text-gray-900 font-medium text-sm appearance-none transition-all shadow-sm`}>
                <option value="">Sélectionner...</option>
                {SECTION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50/80 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 hover:text-gray-900 transition-all shadow-sm"
          >
            Annuler
          </button>
          <button 
            className={`px-5 py-2 text-xs font-bold text-white ${themeBtn} rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2`}
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}
