const fs = require('fs');
let content = fs.readFileSync('src/app/layout.tsx', 'utf8');

const bgBlobs = `        <ToastProvider>
          {/* Ambient Background Glows */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-gray-50/50">
            {/* Top-Left Light Blue Glow */}
            <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] rounded-full bg-blue-400/20 blur-[120px] mix-blend-multiply opacity-70 animate-pulse-slow" style={{ animationDuration: '8s' }} />
            {/* Bottom-Right Indigo Glow */}
            <div className="absolute -bottom-[20%] -right-[10%] w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] rounded-full bg-indigo-400/20 blur-[120px] mix-blend-multiply opacity-70 animate-pulse-slow" style={{ animationDuration: '10s', animationDelay: '1s' }} />
          </div>

          <WelcomeModal />`;

content = content.replace('<ToastProvider>\n          <WelcomeModal />', bgBlobs);

fs.writeFileSync('src/app/layout.tsx', content);
