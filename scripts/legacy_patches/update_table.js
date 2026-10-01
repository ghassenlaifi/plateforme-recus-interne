const fs = require('fs');

function updateCRM(file, themeColor) {
  let content = fs.readFileSync(file, 'utf8');

  // Replace Pipeline Actuel with Recherche et filtres
  const oldPipelineRegex = /<div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">[\s\S]*?<\/div>\n\s*<div className="overflow-x-auto">/;
  // Wait, in my previous shrinkUI I might have changed p-5 to p-4. Let's use a more robust regex or string replacement.
  
  // Let's replace the whole block by finding the start of the table container
  const tableContainerStart = content.indexOf('<div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden">');
  const tableWrapStart = content.indexOf('<div className="overflow-x-auto">');
  
  if (tableContainerStart !== -1 && tableWrapStart !== -1) {
    const originalTopBar = content.substring(tableContainerStart + 90, tableWrapStart);
    
    const newTopBar = `
          <div className="p-4 border-b border-gray-200/80 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2 text-gray-700 font-bold text-xs uppercase tracking-wider whitespace-nowrap">
              <Filter className="h-4 w-4" />
              Recherche et filtres
            </div>
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Rechercher un prospect (nom, téléphone, statut)..." className={\`w-full pl-9 pr-4 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-\${themeColor}-500/20 focus:border-\${themeColor}-500 transition-all text-gray-900 shadow-sm\`} />
            </div>
          </div>
          `;
          
    content = content.replace(originalTopBar, newTopBar);
  }

  // Update table header row color
  // Old: <thead className="bg-gray-50/80 text-gray-500 text-[11px] uppercase tracking-wider font-bold border-b border-gray-100">
  const theadRegex = /<thead className="[^"]*">/;
  content = content.replace(theadRegex, `<thead className="bg-${themeColor}-600 text-white text-[11px] uppercase tracking-wider font-bold">`);
  
  // Also we need to make sure the border doesn't look weird, so let's keep it clean without a bottom border or with a darker blue border
  
  fs.writeFileSync(file, content);
}

updateCRM('src/app/crm-elios/page.tsx', 'blue');
updateCRM('src/app/crm-formatic/page.tsx', 'indigo');

console.log("Updated CRM tables.");
