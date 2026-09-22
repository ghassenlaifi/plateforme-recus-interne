const fs = require('fs');
let content = fs.readFileSync('src/app/layout.tsx', 'utf8');

const oldBlobs = `        <ToastProvider>
          {/* Ambient Background Glows */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
            {/* Top-Left Light Blue Glow */}
            <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-blue-300/30 blur-[120px] mix-blend-multiply opacity-80" />
            {/* Bottom-Right Light Blue Glow */}
            <div className="absolute -bottom-[10%] -right-[10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-sky-300/30 blur-[120px] mix-blend-multiply opacity-80" />
          </div>

          <WelcomeModal />`;

const newBlobs = `        <ToastProvider>
          {/* Ambient Background Glows */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
            {/* Top-Left Very Light Gray Glow */}
            <div className="absolute -top-[5%] -left-[5%] w-[35vw] h-[35vw] max-w-[400px] max-h-[400px] rounded-full bg-gray-200/60 blur-[100px] mix-blend-multiply opacity-50" />
            {/* Bottom-Right Very Light Gray Glow */}
            <div className="absolute -bottom-[5%] -right-[5%] w-[35vw] h-[35vw] max-w-[400px] max-h-[400px] rounded-full bg-slate-200/60 blur-[100px] mix-blend-multiply opacity-50" />
          </div>

          <WelcomeModal />`;

content = content.replace(oldBlobs, newBlobs);

fs.writeFileSync('src/app/layout.tsx', content);
