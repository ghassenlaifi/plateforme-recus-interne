const fs = require('fs');

function fixFile(file, crmType) {
  let content = fs.readFileSync(file, 'utf8');

  // Replace mockLeads definition
  const mockLeadsRegex = /const mockLeads = \[[\s\S]*?\];/m;
  content = content.replace(mockLeadsRegex, '');

  // Add the useSWR for leads inside the component
  const hookTarget = `const { data: operators } = useSWR<Operator[]>('/api/operators', fetcher);`;
  const hookReplacement = `${hookTarget}\n  const { data: leads, mutate: mutateLeads } = useSWR<any[]>(\`/api/leads/${crmType}\`, fetcher, { fallbackData: [] });`;
  content = content.replace(hookTarget, hookReplacement);

  // Replace mockLeads usage in useMemo
  content = content.replace(/mockLeads\.filter/g, '(leads || []).filter');
  
  // Replace lead submission logic in NewLeadModal usage (Wait, NewLeadModal currently doesn't submit anywhere. We will need to fix it later if they want to create leads from UI, but for now we just link the read).

  fs.writeFileSync(file, content);
}

fixFile('src/app/crm-elios/page.tsx', 'elios');
fixFile('src/app/crm-formatic/page.tsx', 'formatic');
