const fs = require('fs');

function addExportButton(file, themeColor) {
  let content = fs.readFileSync(file, 'utf8');

  // Add Download icon import
  content = content.replace('Users, UserPlus', 'Users, UserPlus, Download');

  // Add the export logic function
  const exportFunction = `
  const handleExport = () => {
    if (!filteredLeads || filteredLeads.length === 0) return;
    const headers = ['ID', 'Nom', 'Téléphone', 'Offre', 'Source', 'Classe', 'Section', 'Statut', 'Date'];
    const rows = filteredLeads.map(l => [
      l.id, l.name, l.phone, l.offer, l.source, l.grade, l.section, l.status, new Date(l.date).toLocaleString('fr-FR')
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', \`prospects_\${new Date().toISOString().split('T')[0]}.csv\`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
`;
  
  if (!content.includes('handleExport')) {
    content = content.replace('const resetFilters = () => {', exportFunction + '\n  const resetFilters = () => {');
  }

  // Add the button to UI next to Nouveau Prospect
  const newProspectBtn = `<button onClick={() => setIsNewLeadModalOpen(true)} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-${themeColor}-600 border border-transparent text-white font-semibold rounded-xl hover:bg-${themeColor}-700 shadow-sm transition-all focus:ring-2 focus:ring-${themeColor}-500/50 focus:ring-offset-2">
              <Plus className="h-4 w-4" />
              Nouveau Prospect
            </button>`;
  
  const replacementBtns = `<button onClick={handleExport} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 shadow-sm transition-all">
              <Download className="h-4 w-4" />
              Exporter (CSV)
            </button>
            ` + newProspectBtn;
  
  content = content.replace(newProspectBtn, replacementBtns);

  fs.writeFileSync(file, content);
}

addExportButton('src/app/crm-elios/page.tsx', 'blue');
addExportButton('src/app/crm-formatic/page.tsx', 'indigo');
