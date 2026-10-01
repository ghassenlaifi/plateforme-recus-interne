const fs = require('fs');
let content = fs.readFileSync('src/app/portefeuilles/page.tsx', 'utf8');

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
        mutate();
        toast({
          title: "Déduction réussie",
          description: \`Un retrait de \${deductAmount} DT a été effectué.\`,
          type: "success"
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeductLoading(false);
    }
  };
`;

if (!content.includes('const handleDeduct')) {
  content = content.replace('const handleReset = async () => {', handleDeductFunc + '\n\n  const handleReset = async () => {');
}

fs.writeFileSync('src/app/portefeuilles/page.tsx', content);
