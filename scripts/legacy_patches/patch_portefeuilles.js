const fs = require('fs');
let content = fs.readFileSync('src/app/portefeuilles/page.tsx', 'utf8');

// Add MinusCircle icon
content = content.replace(
  'import { Lock, FileText, RotateCcw, AlertTriangle',
  'import { Lock, FileText, RotateCcw, AlertTriangle, MinusCircle, X'
);

// Add state for deduction modal
const stateInsert = `
  const [deductModal, setDeductModal] = useState<{ operator: string, paymentMethod: string } | null>(null);
  const [deductAmount, setDeductAmount] = useState('');
  const [deductLoading, setDeductLoading] = useState(false);
`;
content = content.replace('const [isStatementLoading, setIsStatementLoading] = useState(false);', 'const [isStatementLoading, setIsStatementLoading] = useState(false);\n' + stateInsert);

// Add handleDeduct function
const handleDeductFunc = `
  const handleDeduct = async () => {
    if (!deductModal || !deductAmount || parseFloat(deductAmount) <= 0) return;
    setDeductLoading(true);
    try {
      const amountStr = "-" + deductAmount;
      const res = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId: 'deduction-' + Date.now(),
          operator: deductModal.operator,
          clientDetails: {
            name: 'DÉDUCTION MANUELLE',
            phone: 'N/A',
            offer: 'N/A',
            paymentMethod: deductModal.paymentMethod,
            amount: amountStr,
            date: new Date().toISOString().split('T')[0],
            note: 'Retrait du portefeuille'
          }
        })
      });
      if (res.ok) {
        setDeductModal(null);
        setDeductAmount('');
        fetchWallets();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeductLoading(false);
    }
  };
`;
content = content.replace('const handleReset = async (operator: string, paymentMethod: string) => {', handleDeductFunc + '\n\n  const handleReset = async (operator: string, paymentMethod: string) => {');

// Add the Diminuer button in the wallet card
const btnReplace = `
                  <div className="p-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setStatementModal({ operator: group._id.operator, paymentMethod: group._id.paymentMethod })}
                      disabled={isStatementLoading}
                      className="flex-1 flex justify-center items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                    >
                      <FileText className="h-3 w-3" />
                      Extrait
                    </button>
                    <button
                      onClick={() => setDeductModal({ operator: group._id.operator, paymentMethod: group._id.paymentMethod })}
                      className="flex-1 flex justify-center items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 hover:text-amber-700 transition-colors shadow-sm"
                    >
                      <MinusCircle className="h-3 w-3" />
                      Diminuer
                    </button>
                    <button
                      onClick={() => handleReset(group._id.operator, group._id.paymentMethod)}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-100 hover:text-rose-700 transition-colors shadow-sm"
                      title="Remise à zéro"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  </div>
`;
// We need to carefully replace the bottom div of the card
// Currently it is:
/*
                  <div className="p-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between gap-3">
                    <button
                      onClick={() => setStatementModal({ operator: group._id.operator, paymentMethod: group._id.paymentMethod })}
                      disabled={isStatementLoading}
                      className="flex-1 flex justify-center items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                    >
                      <FileText className="h-3 w-3" />
                      Extrait
                    </button>
                    <button
                      onClick={() => handleReset(group._id.operator, group._id.paymentMethod)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-100 hover:text-rose-700 transition-colors shadow-sm"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Remise à Zéro
                    </button>
                  </div>
*/
const oldDivStart = '<div className="p-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between gap-3">';
const oldDivEnd = 'Remise à Zéro\n                    </button>\n                  </div>';

const sIdx = content.indexOf(oldDivStart);
const eIdx = content.indexOf(oldDivEnd);
if (sIdx !== -1 && eIdx !== -1) {
  content = content.substring(0, sIdx) + btnReplace + content.substring(eIdx + oldDivEnd.length);
}

// Add the modal JSX at the end of <main>
const modalJSX = `
        {deductModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-200">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <MinusCircle className="h-4 w-4 text-amber-500" />
                  Déduire un montant
                </h3>
                <button onClick={() => setDeductModal(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5">
                <p className="text-xs text-gray-500 mb-4">
                  Saisissez le montant à déduire de la caisse <strong className="text-gray-800">{deductModal.paymentMethod}</strong> de <strong className="text-gray-800">{deductModal.operator}</strong>.
                </p>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={deductAmount}
                    onChange={(e) => setDeductAmount(e.target.value)}
                    className="w-full pl-4 pr-12 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-gray-900 font-bold text-lg [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">DT</span>
                </div>
              </div>
              <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex gap-3">
                <button onClick={() => setDeductModal(null)} className="flex-1 px-4 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  Annuler
                </button>
                <button onClick={handleDeduct} disabled={deductLoading} className="flex-1 px-4 py-2 text-xs font-bold text-white bg-amber-500 border border-transparent rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 flex justify-center items-center gap-2">
                  {deductLoading ? '...' : 'Valider'}
                </button>
              </div>
            </div>
          </div>
        )}
`;

content = content.replace('</main>', modalJSX + '\n      </main>');

fs.writeFileSync('src/app/portefeuilles/page.tsx', content);
