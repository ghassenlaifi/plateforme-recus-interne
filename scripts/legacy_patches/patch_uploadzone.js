const fs = require('fs');

let content = fs.readFileSync('src/components/UploadZone.tsx', 'utf8');

// 1. Phone Normalization onBlur
const normalizeFunc = `
  const handlePhoneBlur = () => {
    let p = phone.replace(/[^\\d+]/g, '');
    if (p.startsWith('+216')) p = p.substring(4);
    else if (p.startsWith('00216')) p = p.substring(5);
    setPhone(p);
  };
`;
// Insert before return
content = content.replace('const handleUpload = async () => {', normalizeFunc + '\n  const handleUpload = async () => {');

// Attach onBlur to phone input
content = content.replace(
  'onChange={(e) => setPhone(e.target.value)}',
  'onChange={(e) => setPhone(e.target.value)} onBlur={handlePhoneBlur}'
);

// 2. Prevent scroll and arrows on Montant
content = content.replace(
  'type="number"\n                step="0.01"\n                value={amount}',
  'type="number"\n                step="0.01"\n                value={amount}\n                onKeyDown={(e) => { if (e.key === \'ArrowUp\' || e.key === \'ArrowDown\') e.preventDefault(); }}\n                onWheel={(e) => (e.target as HTMLInputElement).blur()}'
);

// We should also remove arrows via tailwind class just to be safe
content = content.replace(
  'className="w-full pl-3 pr-10 py-2 bg-gray-50/50 border border-gray-200 rounded-xl',
  'className="w-full pl-3 pr-10 py-2 bg-gray-50/50 border border-gray-200 rounded-xl [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"'
);

fs.writeFileSync('src/components/UploadZone.tsx', content);
