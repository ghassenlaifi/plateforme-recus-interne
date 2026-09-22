import React, { useEffect, useState, useRef } from 'react';
import { X, Download, Loader2 } from 'lucide-react';


interface Receipt {
  _id: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  paymentDetails: string;
  clientDetails?: {
    nom?: string;
    telephone?: string;
    classe?: string;
    email?: string;
    familyGroup?: string;
  };
  status: string;
  createdAt: string;
}

interface Wallet {
  mode: string;
  details: string;
  totalAmount: number;
}

interface StatementModalProps {
  wallet: Wallet | null;
  onClose: () => void;
}

export function StatementModal({ wallet, onClose }: StatementModalProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wallet) return;

    const fetchReceipts = async () => {
      setIsLoading(true);
      try {
        const url = new URL('/api/receipts', window.location.origin);
        url.searchParams.append('status', 'all');
        url.searchParams.append('paymentMode', wallet.mode);
        url.searchParams.append('paymentDetails', wallet.details);

        const res = await fetch(url.toString());
        if (res.ok) {
          const data = await res.json();
          setReceipts(data);
        }
      } catch (err) {
        console.error("Failed to fetch statement receipts", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReceipts();
  }, [wallet]);

  if (!wallet) return null;

  const total = receipts.reduce((acc, curr) => acc + curr.amount, 0);

  const handleDownload = async () => {
    if (!ticketRef.current) return;
    setIsDownloading(true);
    
    try {
      const htmlToImage = await import('html-to-image');
      const dataUrl = await htmlToImage.toPng(ticketRef.current, {
        pixelRatio: 4, // Ultra High resolution
        backgroundColor: '#ffffff'
      });
      
      const link = document.createElement('a');
      link.download = `Extrait_EliosBalance_${wallet.mode}_${wallet.details}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to generate statement image", err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6">
      <div className="relative w-full max-w-lg bg-gray-100 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-200/50">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-1.5 bg-white/40 backdrop-blur-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-all"
          title="Fermer"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 thin-scroll flex justify-center items-start">
          
          {/* Ticket Container */}
          <div 
            ref={ticketRef} 
            className="bg-white shadow-md border border-gray-200 p-6 sm:p-8 w-full relative"
            style={{ fontFamily: "'Courier New', Courier, monospace", maxWidth: '420px' }}
          >
            {/* Top ZigZag Pattern */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-repeat-x opacity-30" style={{ backgroundImage: "linear-gradient(-45deg, transparent 33.33%, #d1d5db 33.33%, #d1d5db 66.66%, transparent 66.66%), linear-gradient(45deg, transparent 33.33%, #d1d5db 33.33%, #d1d5db 66.66%, transparent 66.66%)", backgroundSize: "8px 16px" }}></div>

            <div className="text-center mb-5 border-b-2 border-dashed border-gray-300 pb-4 mt-2">
              <h3 className="font-bold text-black text-sm sm:text-base uppercase tracking-wider leading-snug">Elios Balance<br/>{wallet.mode} - {wallet.details}</h3>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : receipts.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-500 italic">
                Aucun encaissement actif.
              </div>
            ) : (
              <div className="flex flex-col gap-0 mb-4">
                {receipts.map((receipt) => {
                  const date = receipt.paymentDate ? new Date(receipt.paymentDate) : new Date(receipt.createdAt);
                  return (
                    <div key={receipt._id} className="flex flex-col text-[11px] border-b border-gray-200 border-dashed py-2.5 last:border-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-black">{date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="font-bold text-black text-[13px]">{receipt.amount.toFixed(3)} DT</span>
                      </div>
                      
                      <div className="text-gray-700 leading-tight">
                        {receipt.clientDetails?.nom && <><span className="font-semibold text-gray-900">Nom:</span> {receipt.clientDetails.nom} &nbsp;</>}
                        {receipt.clientDetails?.telephone && <><span className="font-semibold text-gray-900">Tél:</span> {receipt.clientDetails.telephone} &nbsp;</>}
                        {receipt.clientDetails?.classe && <><span className="font-semibold text-gray-900">Classe:</span> {receipt.clientDetails.classe} &nbsp;</>}
                        {receipt.clientDetails?.email && <><span className="font-semibold text-gray-900">Email:</span> {receipt.clientDetails.email} &nbsp;</>}
                        {receipt.clientDetails?.familyGroup && <><span className="font-semibold text-gray-900">Groupe:</span> {receipt.clientDetails.familyGroup}</>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!isLoading && receipts.length > 0 && (
              <div className="border-t-2 border-dashed border-gray-400 pt-3 flex justify-between items-end mt-2">
                <span className="font-bold text-black uppercase text-sm">Total</span>
                <span className="font-bold text-black text-lg">{total.toFixed(3)} DT</span>
              </div>
            )}
            
            <div className="text-center text-[9px] text-gray-400 mt-6">
              Document généré le {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-200 flex justify-end gap-3 bg-white">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-normal text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            Fermer
          </button>
          <button
            onClick={handleDownload}
            disabled={isDownloading || receipts.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-normal text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors shadow-sm disabled:opacity-50"
          >
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Télécharger PNG
          </button>
        </div>
      </div>
    </div>
  );
}
