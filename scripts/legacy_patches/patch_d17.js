const fs = require('fs');

const replaceInFile = (file, replacements) => {
  let content = fs.readFileSync(file, 'utf8');
  for (const [oldStr, newStr] of replacements) {
    content = content.split(oldStr).join(newStr);
  }
  fs.writeFileSync(file, content);
};

// 1. src/app/portefeuilles/page.tsx
replaceInFile('src/app/portefeuilles/page.tsx', [
  ["case 'D17-Soumaya':", "case 'Edinar - D17-Soumaya':"],
  ["case 'D17-Elyes':", "case 'Edinar - D17-Elyes':"]
]);

// 2. src/app/api/portefeuilles/route.ts
replaceInFile('src/app/api/portefeuilles/route.ts', [
  ["{ mode: 'D17', details: 'Soumaya' }", "{ mode: 'Edinar - D17', details: 'Soumaya' }"],
  ["{ mode: 'D17', details: 'Elyes' }", "{ mode: 'Edinar - D17', details: 'Elyes' }"]
]);

// 3. src/app/page.tsx
replaceInFile('src/app/page.tsx', [
  ['<option value="D17"></option>', '<option value="Edinar - D17"></option>']
]);

// 4. src/components/UploadZone.tsx
replaceInFile('src/components/UploadZone.tsx', [
  ["mode: 'D17',", "mode: 'Edinar - D17',"],
  ['<option value="D17">D17</option>', '<option value="Edinar - D17">Edinar - D17</option>'],
  ["formData.mode === 'D17'", "formData.mode === 'Edinar - D17'"]
]);

// 5. src/components/ReceiptModal.tsx
replaceInFile('src/components/ReceiptModal.tsx', [
  ['<option value="D17">D17</option>', '<option value="Edinar - D17">Edinar - D17</option>'],
  ["editData.paymentMode === 'D17'", "editData.paymentMode === 'Edinar - D17'"]
]);

console.log("Done patching D17.");
