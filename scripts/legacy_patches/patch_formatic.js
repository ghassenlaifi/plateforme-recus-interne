const fs = require('fs');

let eliosContent = fs.readFileSync('src/app/crm-elios/page.tsx', 'utf8');

// Replace specific wording and styling
let formaticContent = eliosContent
  .replace(/CRMEliosPage/g, 'CRMFormaticPage')
  .replace(/Elios Academy/g, 'Formatic Academy')
  .replace(/blue-/g, 'indigo-')
  .replace(/Users className/g, 'BookOpen className');

if (!formaticContent.includes('BookOpen')) {
  formaticContent = formaticContent.replace('import { Users', 'import { Users, BookOpen');
}

fs.writeFileSync('src/app/crm-formatic/page.tsx', formaticContent);
console.log('CRM Formatic updated');
