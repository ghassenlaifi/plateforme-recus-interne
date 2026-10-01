const fs = require('fs');

let content = fs.readFileSync('src/app/crm-elios/page.tsx', 'utf8');

// 1. Add Imports
if (!content.includes('NewLeadModal')) {
  content = content.replace(
    "import { Operator } from '@/types';", 
    "import { Operator } from '@/types';\nimport { NewLeadModal } from '@/components/NewLeadModal';\nimport { LeadDetailsModal } from '@/components/LeadDetailsModal';"
  );
}

// 2. Add State for Modals
const modalStates = `
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
`;
if (!content.includes('isNewLeadModalOpen')) {
  content = content.replace('const [searchQuery, setSearchQuery] = useState("");', modalStates + '\n  const [searchQuery, setSearchQuery] = useState("");');
}

// 3. Connect "Nouveau Prospect" button
content = content.replace(
  '<button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm">',
  '<button onClick={() => setIsNewLeadModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm">'
);

// 4. Connect Table row click to open Details Modal
// Look for `<tr key={idx} className="hover:bg-gray-50/50 transition-colors group">`
content = content.replace(
  /key={idx} className="hover:bg-gray-50\/50 transition-colors group"/g,
  'key={idx} onClick={() => setSelectedLead(lead)} className="hover:bg-gray-50/50 transition-colors group cursor-pointer"'
);

// 5. Render Modals at the end of the file, just before `</main>`
const modalsJSX = `
      <NewLeadModal isOpen={isNewLeadModalOpen} onClose={() => setIsNewLeadModalOpen(false)} theme="blue" />
      <LeadDetailsModal isOpen={!!selectedLead} onClose={() => setSelectedLead(null)} lead={selectedLead} theme="blue" />
`;
if (!content.includes('<NewLeadModal')) {
  content = content.replace('</main>', modalsJSX + '\n    </main>');
}

fs.writeFileSync('src/app/crm-elios/page.tsx', content);
