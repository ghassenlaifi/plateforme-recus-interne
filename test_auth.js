const fs = require('fs');
let content = fs.readFileSync('src/app/portefeuilles/page.tsx', 'utf8');

// Use fixed inset-0 for the modal to fix mobile scrolling gaps
content = content.replace(
  'className="fixed top-0 left-0 h-[100dvh] w-full z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-md"',
  'className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-xl"'
);

// Block scrolling on body when not authenticated
const effectHook = `  useEffect(() => {
    if (!isAuthenticated) {
      document.body.style.overflow = 'hidden';
      if (pinInputRefs.current[0]) {
        pinInputRefs.current[0].focus();
      }
    } else {
      document.body.style.overflow = '';
    }
    
    return () => { document.body.style.overflow = ''; };
  }, [isAuthenticated]);`;

content = content.replace(
  `  useEffect(() => {
    if (!isAuthenticated && pinInputRefs.current[0]) {
      pinInputRefs.current[0].focus();
    }
  }, [isAuthenticated]);`,
  effectHook
);

// Don't render the main content if not authenticated, to prevent DOM inspection hacks
// We replace the <main> tag with a conditional render
content = content.replace(
  '<main className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8 mt-6">',
  '{isAuthenticated && (<main className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8 mt-6">'
);

// Close the conditional render just before the change pin modal
content = content.replace(
  '      {/* Change PIN Modal */}',
  '      )} {/* End isAuthenticated check for main */}\n\n      {/* Change PIN Modal */}'
);

fs.writeFileSync('src/app/portefeuilles/page.tsx', content);
