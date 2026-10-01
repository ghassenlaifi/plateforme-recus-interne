const fs = require('fs');

function fixRoute(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  // Fix Next.js 15 params promise for GET
  content = content.replace(
    /export async function GET\(request: Request, \{ params \}: \{ params: \{ crmType: string \} \}\) \{/g,
    'export async function GET(request: Request, { params }: { params: Promise<{ crmType: string }> }) {\n  const { crmType } = await params;'
  );
  // Fix Next.js 15 params promise for POST
  content = content.replace(
    /export async function POST\(request: Request, \{ params \}: \{ params: \{ crmType: string \} \}\) \{/g,
    'export async function POST(request: Request, { params }: { params: Promise<{ crmType: string }> }) {\n  const { crmType } = await params;'
  );
  
  // Also fix if it was written with NextRequest or Request
  content = content.replace(
    /const crmType = params\.crmType;/g,
    ''
  );
  fs.writeFileSync(filePath, content);
}

fixRoute('src/app/api/leads/[crmType]/route.ts');
fixRoute('src/app/api/leads/[crmType]/export/route.ts');

function fixPage(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/mockLeads\./g, '(leads || []).');
  fs.writeFileSync(filePath, content);
}

fixPage('src/app/crm-elios/page.tsx');
fixPage('src/app/crm-formatic/page.tsx');

