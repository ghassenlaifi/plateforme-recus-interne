const fs = require('fs');
let content = fs.readFileSync('src/components/Header.tsx', 'utf8');

// Add Home icon import
content = content.replace(
  "import { Settings } from 'lucide-react';",
  "import { Settings, Home } from 'lucide-react';"
);

// Change title and add Home link
content = content.replace(
  `              <span 
                className="text-[15px] font-bold italic tracking-tight"
                style={{ 
                  color: '#28326a', 
                  fontFamily: '"Nunito", "Quicksand", "Arial Rounded MT Bold", "Varela Round", sans-serif'
                }}
              >
                RECEIPT Management
              </span>`,
  `              <Link href="/" className="text-[15px] font-bold italic tracking-tight hover:opacity-80 transition-opacity flex items-center gap-2" style={{ color: '#28326a', fontFamily: '"Nunito", "Quicksand", "Arial Rounded MT Bold", "Varela Round", sans-serif' }}>
                ELIOS WORKSPACE
              </Link>`
);

// Make the logo also link to home
content = content.replace(
  `              <div className="relative h-8 w-8 overflow-hidden rounded-md border border-gray-100 shadow-sm">`,
  `              <Link href="/" className="relative h-8 w-8 overflow-hidden rounded-md border border-gray-100 shadow-sm block hover:opacity-90 transition-opacity">`
);
content = content.replace(
  `                  sizes="32px"\n                />\n              </div>`,
  `                  sizes="32px"\n                />\n              </Link>`
);

fs.writeFileSync('src/components/Header.tsx', content);
