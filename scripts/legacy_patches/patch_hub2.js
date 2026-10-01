const fs = require('fs');

let content = fs.readFileSync('src/app/page.tsx', 'utf8');

// Remove footer
content = content.replace(
  /<footer[\s\S]*?<\/footer>/,
  ''
);

// Reduce top padding
content = content.replace(
  '<main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-10 flex flex-col">',
  '<main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-10 flex flex-col">'
);

// Refine cards: add a very subtle gradient, refine border and shadow
content = content.replace(
  /className=\{`group relative bg-white rounded-2xl p-5 border border-gray-200\/70 shadow-sm shadow-gray-200\/40 hover:border-gray-300\/80 hover:shadow-lg hover:shadow-gray-200\/50 transition-all duration-300 flex flex-col h-full overflow-hidden`\}/g,
  'className={`group relative bg-gradient-to-b from-white to-gray-50/30 rounded-2xl p-5 border border-gray-200/50 shadow-sm shadow-gray-200/50 hover:border-gray-300/80 hover:shadow-md hover:-translate-y-0.5 hover:shadow-gray-300/40 transition-all duration-300 flex flex-col h-full overflow-hidden`}'
);

// Refine the small background blob in the card to be slightly more visible on hover
content = content.replace(
  /className=\{`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-gray-50 to-transparent rounded-bl-full opacity-60 -z-10 group-hover:scale-125 transition-transform duration-500`\}/g,
  'className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-\\\${tool.color}/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 -z-10 group-hover:scale-110 transition-all duration-500`}'
);


fs.writeFileSync('src/app/page.tsx', content);
