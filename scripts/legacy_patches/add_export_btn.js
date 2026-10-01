const fs = require('fs');

function addExportButton(file, themeColor, crmType) {
  let content = fs.readFileSync(file, 'utf8');

  // Add Download icon to imports
  if (!content.includes('Download,')) {
    content = content.replace('Plus, ', 'Plus, Download, ');
  }

  const handleExportStr = `
  const handleExport = () => {
    window.open(\`/api/leads/${crmType}/export\`, '_blank');
  };
`;

  // Insert handleExport
  if (!content.includes('handleExport')) {
    content = content.replace('const resetFilters = () => {', handleExportStr + '\n  const resetFilters = () => {');
  }

  // Find Nouveau Prospect button and insert Export button BEFORE it
  const nouveauBtnStr = `<button onClick={() => setIsNewLeadModalOpen(true)} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-${themeColor}-600 border border-transparent text-white font-semibold rounded-xl hover:bg-${themeColor}-700 shadow-sm transition-all focus:ring-2 focus:ring-${themeColor}-500/50 focus:ring-offset-2">`;
  
  const exportBtnStr = `<button onClick={handleExport} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 shadow-sm transition-all focus:ring-2 focus:ring-gray-200 focus:ring-offset-2">
              <Download className="h-4 w-4" />
              Exporter Excel
            </button>\n            ` + nouveauBtnStr;
  
  content = content.replace(nouveauBtnStr, exportBtnStr);

  fs.writeFileSync(file, content);
}

addExportButton('src/app/crm-elios/page.tsx', 'blue', 'elios');
addExportButton('src/app/crm-formatic/page.tsx', 'indigo', 'formatic');
