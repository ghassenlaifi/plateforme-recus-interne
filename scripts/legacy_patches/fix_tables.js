const fs = require('fs');

function updateFile(file, theme) {
  let content = fs.readFileSync(file, 'utf8');

  const oldHeaderRegex = /<div className="p-3 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">[\s\S]*?<\/div>\s*<\/div>\s*<div className="overflow-x-auto">/;
  
  const replacement = `
          <div className="p-4 border-b border-gray-200/80 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2 text-gray-700 font-bold text-[11px] uppercase tracking-wider whitespace-nowrap">
              <Filter className="h-3.5 w-3.5" />
              Recherche et filtres
            </div>
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input type="text" placeholder="Rechercher un prospect (nom, téléphone, statut)..." className={\`w-full pl-9 pr-4 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-\${theme}-500/20 focus:border-\${theme}-500 transition-all text-gray-900 shadow-sm\`} />
            </div>
          </div>
          <div className="overflow-x-auto">`;

  // First we need to match carefully because my regex above might be slightly off
  const startStr = '<div className="p-3 border-b border-gray-100 flex flex-col';
  const endStr = '<div className="overflow-x-auto">';
  
  const startIndex = content.indexOf(startStr);
  const endIndex = content.indexOf(endStr);
  
  if (startIndex !== -1 && endIndex !== -1) {
    const toReplace = content.substring(startIndex, endIndex + endStr.length);
    content = content.replace(toReplace, replacement);
  }

  // Header row
  content = content.replace(
    /<thead className="[^"]*">/,
    `<thead className="bg-${theme}-600 text-white text-[11px] uppercase tracking-wider font-bold">`
  );

  fs.writeFileSync(file, content);
}

updateFile('src/app/crm-elios/page.tsx', 'blue');
updateFile('src/app/crm-formatic/page.tsx', 'indigo');

console.log("Done");
