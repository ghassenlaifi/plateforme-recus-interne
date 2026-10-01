const fs = require('fs');
let content = fs.readFileSync('src/app/layout.tsx', 'utf8');

// Ensure body has background
content = content.replace(
  '<body className="flex flex-col min-h-[100dvh]">',
  '<body className="flex flex-col min-h-[100dvh] bg-slate-50 relative">'
);

// We want the glow to be fixed and behind everything
const newBlobs = `        <ToastProvider>
          {/* Ambient Background Glows */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
            {/* Top-Left Light Blue Glow */}
            <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-blue-300/30 blur-[120px] mix-blend-multiply opacity-80" />
            {/* Bottom-Right Light Blue Glow */}
            <div className="absolute -bottom-[10%] -right-[10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-sky-300/30 blur-[120px] mix-blend-multiply opacity-80" />
          </div>

          <WelcomeModal />`;

content = content.replace(/<ToastProvider>[\s\S]*?<WelcomeModal \/>/, newBlobs);

fs.writeFileSync('src/app/layout.tsx', content);
