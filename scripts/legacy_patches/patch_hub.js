const fs = require('fs');

let content = fs.readFileSync('src/app/page.tsx', 'utf8');

// Reduce space between header and title
content = content.replace(
  '<main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col justify-center">',
  '<main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-10 flex flex-col">'
);

// Update card styling
content = content.replace(
  'className={`group relative bg-white/60 backdrop-blur-md rounded-2xl p-5 border border-gray-100 hover:border-gray-200 hover:bg-white hover:shadow-xl hover:shadow-gray-200/30 transition-all duration-300 flex flex-col h-full overflow-hidden`}',
  'className={`group relative bg-white rounded-2xl p-5 border border-gray-200/70 shadow-sm shadow-gray-200/40 hover:border-gray-300/80 hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 flex flex-col h-full overflow-hidden`}'
);

fs.writeFileSync('src/app/page.tsx', content);
