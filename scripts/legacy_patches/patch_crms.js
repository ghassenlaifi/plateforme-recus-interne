const fs = require('fs');

function shrinkUI(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Remove animations
  content = content.replace(/animate-fade-in-up/g, '');
  content = content.replace(/style=\{\{ animationDelay: '[^']+' \}\}/g, '');

  // Shrink page padding
  content = content.replace(/py-8/g, 'py-5');
  content = content.replace(/mb-8/g, 'mb-5');

  // Shrink Header Section
  content = content.replace(/text-2xl sm:text-3xl/g, 'text-xl sm:text-2xl');
  content = content.replace(/px-4 py-2\.5/g, 'px-3 py-1.5 text-xs');
  
  // Shrink Stats Grid
  content = content.replace(/p-5/g, 'p-4');
  content = content.replace(/text-3xl font-extrabold/g, 'text-2xl font-extrabold');
  content = content.replace(/gap-5/g, 'gap-3 sm:gap-4');
  content = content.replace(/w-24 h-24/g, 'w-16 h-16');

  // Shrink Alerts
  content = content.replace(/p-4/g, 'p-3');
  content = content.replace(/gap-4/g, 'gap-3');
  content = content.replace(/text-sm font-bold/g, 'text-xs font-bold');
  content = content.replace(/px-4 py-2/g, 'px-3 py-1.5');

  // Shrink Table
  content = content.replace(/px-6 py-4/g, 'px-4 py-2.5');
  content = content.replace(/text-sm/g, 'text-xs');
  content = content.replace(/text-xs font-bold/g, 'text-[11px] font-bold');
  content = content.replace(/h-8 w-8/g, 'h-6 w-6');

  fs.writeFileSync(file, content);
}

shrinkUI('src/app/crm-elios/page.tsx');
shrinkUI('src/app/crm-formatic/page.tsx');

// Also remove animations from Hub (page.tsx) to stop jitter
let hubContent = fs.readFileSync('src/app/page.tsx', 'utf8');
hubContent = hubContent.replace(/animate-fade-in-up/g, '');
hubContent = hubContent.replace(/style=\{\{ animationDelay: '[^']+' \}\}/g, '');
fs.writeFileSync('src/app/page.tsx', hubContent);

console.log("Shrunk UI and removed animations.");
