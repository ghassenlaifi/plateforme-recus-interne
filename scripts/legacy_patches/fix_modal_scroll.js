const fs = require('fs');

let content = fs.readFileSync('src/components/LeadDetailsModal.tsx', 'utf8');

// Fix main wrapper to have explicit height so scroll works properly
content = content.replace(
  'className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row relative transform transition-all scale-100 animate-in zoom-in-95 duration-200 overflow-hidden"',
  'className="bg-white rounded-[1.25rem] shadow-2xl w-full max-w-4xl h-[85vh] max-h-[800px] flex flex-col md:flex-row relative transform transition-all scale-100 animate-in zoom-in-95 duration-200 overflow-hidden"'
);

// Fix Left Sidebar
content = content.replace(
  'className="w-full md:w-80 bg-gray-50/50 border-r border-gray-100 p-8 flex flex-col items-center md:items-start shrink-0 overflow-y-auto"',
  'className="w-full md:w-72 bg-gray-50/50 border-r border-gray-100 p-6 md:p-8 flex flex-col items-center md:items-start shrink-0 overflow-y-auto custom-scrollbar"'
);

// Fix Right Content Area
content = content.replace(
  'className="flex-1 flex flex-col h-full bg-white overflow-hidden relative"',
  'className="flex-1 flex flex-col min-w-0 min-h-0 bg-white relative"'
);

// Fix Sticky Footer to be absolutely shrink-0
content = content.replace(
  'className="px-6 py-4 bg-white border-t border-gray-100 flex items-center justify-between shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]"',
  'className="shrink-0 px-6 py-4 bg-white border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 z-10"'
);

fs.writeFileSync('src/components/LeadDetailsModal.tsx', content);
