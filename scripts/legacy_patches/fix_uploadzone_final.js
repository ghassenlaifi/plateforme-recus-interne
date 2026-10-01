const fs = require('fs');

let content = fs.readFileSync('src/components/UploadZone.tsx', 'utf8');

// 1. Fix formatPhone
const oldFormatPhone = `const formatPhone = (val: string) => {
    const d = digitsOf(val).slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 5) return \`\${d.slice(0,2)} \${d.slice(2)}\`;
    return \`\${d.slice(0,2)} \${d.slice(2,5)} \${d.slice(5)}\`;
  };`;

const newFormatPhone = `const formatPhone = (val: string) => {
    let p = val.replace(/[^\\d+]/g, '');
    if (p.startsWith('+216')) p = p.substring(4);
    else if (p.startsWith('00216')) p = p.substring(5);
    const d = p.replace(/\\D/g, '').slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 5) return \`\${d.slice(0,2)} \${d.slice(2)}\`;
    return \`\${d.slice(0,2)} \${d.slice(2,5)} \${d.slice(5)}\`;
  };`;

content = content.replace(oldFormatPhone, newFormatPhone);


// 2. Fix Montant input
const oldMontantInput = `<input 
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
                  />`;

const newMontantInput = `<input 
                    id="f-amount" 
                    name="amount" 
                    type="number" 
                    step="0.01"
                    min="0"
                    className="input tnum pr-12 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" 
                    placeholder="0.00" 
                    autoComplete="off" 
                    aria-invalid={errors.amount ? 'true' : 'false'}
                    value={formData.amount}
                    disabled={isUploading}
                    onChange={(e) => { setFormData({...formData, amount: e.target.value}); setErrors({...errors, amount: false}); }}
                    onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  />`;

content = content.replace(oldMontantInput, newMontantInput);

fs.writeFileSync('src/components/UploadZone.tsx', content);
console.log('UploadZone fixed perfectly');
