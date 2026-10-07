import React, { useEffect } from 'react';
import { X, Phone, Trash2, Edit3, Send } from 'lucide-react';
import { formatPhone } from '@/lib/phoneUtils';

const CLASSE_OPTIONS = ['7ème de Base', '8ème de Base', '9ème de Base', '1ère de Base', '2ème de Base', '3ème de Base', 'BAC'];
const SECTION_OPTIONS = ['Sciences Expérimentales', 'Mathématiques', 'Technique', 'Informatique', 'Économie', 'Lettres', 'Sport'];
const STATUS_OPTIONS = ['Lead', 'N/A', 'Potential Prospect', 'Approved Prospect', 'Approved', 'Rejected'];

interface LeadDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
  theme: 'blue' | 'indigo';
}

export function LeadDetailsModal({ isOpen, onClose, lead, theme }: LeadDetailsModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !lead) return null;

  const bgTheme = theme === 'blue' ? 'bg-blue-600' : 'bg-indigo-600';
  const textTheme = theme === 'blue' ? 'text-blue-600' : 'text-indigo-600';
  const ringTheme = theme === 'blue' ? 'focus:ring-blue-500/20 focus:border-blue-500' : 'focus:ring-indigo-500/20 focus:border-indigo-500';
  const btnTheme = theme === 'blue' ? 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500/50' : 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500/50';

  const initials = lead.name ? lead.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : '??';

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/65 backdrop-blur-md animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-[1.25rem] shadow-2xl w-full max-w-4xl h-[85vh] max-h-[800px] flex flex-col md:flex-row relative transform transition-all scale-100 animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Left Sidebar Profile (Fixed) */}
        <div className="w-full md:w-72 bg-gray-50/50 border-r border-gray-100 p-6 md:p-8 flex flex-col items-center md:items-start shrink-0 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-4">Lead Details</div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-6 text-center md:text-left capitalize tracking-tight">{lead.name || 'Unknown Lead'}</h2>
          
          <div className="w-28 h-28 bg-gray-900 text-white rounded-3xl flex items-center justify-center text-4xl font-extrabold mb-8 shadow-xl shadow-gray-900/10">
            {initials}
          </div>

          <div className="w-full space-y-6">
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Status</div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-gray-200 text-xs font-bold text-gray-700 shadow-sm">
                <span className={`w-1.5 h-1.5 rounded-full ${lead.status === 'Approved' ? 'bg-emerald-500' : lead.status === 'Rejected' ? 'bg-rose-500' : 'bg-gray-400'}`}></span>
                {lead.status || 'N/A'}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Grade & Speciality</div>
              <div className="text-sm font-bold text-gray-900">
                {lead.grade || 'N/A'} {lead.section && lead.section !== 'N/A' ? `- ${lead.section}` : ''}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Source</div>
              <div className="text-sm font-bold text-gray-900">{lead.source || 'Facebook'}</div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Created At</div>
              <div className="text-sm font-bold text-gray-900">
                {new Date(lead.date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Content Area (Scrollable) */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white relative">
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 text-gray-400 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-100 rounded-full transition-colors shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex-1 overflow-y-auto p-6 sm:p-8 pt-16 md:pt-8 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 mb-10">
              
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">First Name</label>
                <input type="text" defaultValue={lead.name?.split(' ')[0]} className={`w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ${ringTheme} text-gray-900 font-medium text-sm transition-all shadow-sm`} />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Last Name</label>
                <input type="text" defaultValue={lead.name?.split(' ').slice(1).join(' ')} className={`w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ${ringTheme} text-gray-900 font-medium text-sm transition-all shadow-sm`} />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Phone Number</label>
                <div className="flex gap-2">
                  <input 
                    type="tel" 
                    placeholder="Ex : 92 330 331"
                    defaultValue={formatPhone(lead.phone)} 
                    className={`flex-1 px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ${ringTheme} text-gray-900 font-medium text-sm transition-all shadow-sm`} 
                  />
                  <button className="px-3.5 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-colors shadow-sm">
                    <Phone className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Offre</label>
                <select defaultValue={lead.offer} className={`w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ${ringTheme} text-gray-900 font-medium text-sm appearance-none transition-all shadow-sm`}>
                  <option value="">Sélectionner une offre</option>
                  <option value="Zero To Hero Primo">Zero To Hero Primo</option>
                  <option value="Zero To Hero Secondo">Zero To Hero Secondo</option>
                  <option value="Zero To Hero Lite">Zero To Hero Lite</option>
                  <option value="Zero To Hero">Zero To Hero</option>
                  <option value="Offre personnalisé">Offre personnalisé</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Montant Payé</label>
                <input type="text" placeholder="Ex: 300 TND" className={`w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ${ringTheme} text-gray-900 font-medium text-sm transition-all shadow-sm`} />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Source</label>
                <select defaultValue={lead.source} className={`w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ${ringTheme} text-gray-900 font-medium text-sm appearance-none transition-all shadow-sm`}>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                  <option value="WhatsApp">WhatsApp</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Classe</label>
                <select defaultValue={lead.grade} className={`w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ${ringTheme} text-gray-900 font-medium text-sm appearance-none transition-all shadow-sm`}>
                  <option value="">Sélectionner...</option>
                  {CLASSE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Section</label>
                <select defaultValue={lead.section} className={`w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ${ringTheme} text-gray-900 font-medium text-sm appearance-none transition-all shadow-sm`}>
                  <option value="">Sélectionner...</option>
                  {SECTION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Status</label>
                <select defaultValue={lead.status} className={`w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ${ringTheme} text-gray-900 font-medium text-sm appearance-none transition-all shadow-sm`}>
                  {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>

            {/* Notes History */}
            <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Historique des notes</div>
                  <div className="text-base font-extrabold text-gray-900">3 événements</div>
                </div>
                <div className="p-2 bg-gray-100 text-gray-400 rounded-full">
                  <Edit3 className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {/* Mock Note 1 */}
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] text-gray-400 font-bold tracking-wide">15 JUIN 2026, 20:36</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 uppercase tracking-wider">Elyes</span>
                  </div>
                  <p className="text-sm font-medium text-gray-700 leading-relaxed">5alset 500 w 3amlit compte w omourha mrigla</p>
                </div>
                {/* Mock Note 2 */}
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] text-gray-400 font-bold tracking-wide">08 JUIN 2026, 19:48</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 uppercase tracking-wider">Soumaya</span>
                  </div>
                  <p className="text-sm font-medium text-gray-700 leading-relaxed">awel tranche 500 dt w ba3ed kol chhar 180 dt 3ala 9 chhour</p>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Add note</div>
                <div className={`bg-white border border-gray-200 rounded-xl p-2.5 focus-within:ring-2 focus-within:border-transparent ${ringTheme} transition-all shadow-sm`}>
                  <textarea 
                    placeholder="Write the next follow-up note..." 
                    className="w-full h-16 bg-transparent border-none focus:outline-none text-sm text-gray-900 font-medium resize-none p-1 custom-scrollbar"
                  ></textarea>
                  <div className="flex justify-end mt-1">
                    <button className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white ${bgTheme} rounded-lg shadow-sm hover:opacity-90 transition-opacity`}>
                      <Send className="w-3 h-3" />
                      Add note
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="shrink-0 px-6 py-4 bg-white border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 z-10">
            <button className="flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-xl transition-colors">
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
            <div className="flex items-center gap-2.5">
              <button className="px-4 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-colors shadow-sm">
                WhatsApp
              </button>
              <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm">
                Annuler
              </button>
              <button className={`px-5 py-2 text-xs font-bold text-white ${btnTheme} rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2`}>
                Save lead
              </button>
            </div>
          </div>

        </div>
      </div>
      
      {/* Custom Scrollbar Styles for Textarea and Modals */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #e5e7eb;
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #d1d5db;
        }
      `}} />
    </div>
  );
}
