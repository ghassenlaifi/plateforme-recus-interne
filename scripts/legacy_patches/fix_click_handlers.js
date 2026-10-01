const fs = require('fs');

function fixFile(file, themeColor) {
  let content = fs.readFileSync(file, 'utf8');

  // Fix button Nouveau Prospect
  const buttonRegex = new RegExp(`<button className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-${themeColor}-600 border border-transparent text-white font-semibold rounded-xl hover:bg-${themeColor}-700 shadow-sm transition-all focus:ring-2 focus:ring-${themeColor}-500\\/50 focus:ring-offset-2">`, 'g');
  
  content = content.replace(buttonRegex, `<button onClick={() => setIsNewLeadModalOpen(true)} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-${themeColor}-600 border border-transparent text-white font-semibold rounded-xl hover:bg-${themeColor}-700 shadow-sm transition-all focus:ring-2 focus:ring-${themeColor}-500/50 focus:ring-offset-2">`);

  // Fix row onClick
  const rowRegex = new RegExp(`<tr key=\\{lead.id\\} className="hover:bg-${themeColor}-50\\/30 transition-colors group cursor-pointer">`, 'g');
  content = content.replace(rowRegex, `<tr key={lead.id} onClick={() => setSelectedLead(lead)} className="hover:bg-${themeColor}-50/30 transition-colors group cursor-pointer">`);

  fs.writeFileSync(file, content);
}

fixFile('src/app/crm-elios/page.tsx', 'blue');
fixFile('src/app/crm-formatic/page.tsx', 'indigo');
