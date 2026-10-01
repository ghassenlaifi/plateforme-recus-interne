const fs = require('fs');
let content = fs.readFileSync('src/components/LeadDetailsModal.tsx', 'utf8');

// Change label "Offre Préférée" to "Offre"
content = content.replace(
  '<label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Offre Préférée</label>',
  '<label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Offre</label>'
);

// Replace the select options
const oldSelect = `<select className={\`w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 \${ringTheme} text-gray-900 font-medium text-sm appearance-none transition-all shadow-sm\`}>
                  <option>Zero to Hero</option>
                  <option>Pack Standard</option>
                </select>`;

const newSelect = `<select defaultValue={lead.offer} className={\`w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 \${ringTheme} text-gray-900 font-medium text-sm appearance-none transition-all shadow-sm\`}>
                  <option value="">Sélectionner une offre</option>
                  <option value="Zero To Hero Primo">Zero To Hero Primo</option>
                  <option value="Zero To Hero Secondo">Zero To Hero Secondo</option>
                  <option value="Zero To Hero Lite">Zero To Hero Lite</option>
                  <option value="Zero To Hero">Zero To Hero</option>
                  <option value="Offre personnalisé">Offre personnalisé</option>
                </select>`;

content = content.replace(oldSelect, newSelect);
fs.writeFileSync('src/components/LeadDetailsModal.tsx', content);
