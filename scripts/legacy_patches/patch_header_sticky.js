const fs = require('fs');
let content = fs.readFileSync('src/components/Header.tsx', 'utf8');

// Replace fixed with sticky and remove spacer logic
content = content.replace(
  'className="hdr-wrap pointer-events-none fixed inset-x-0 top-0 z-30"',
  'className="hdr-wrap sticky top-0 z-30 mb-4"'
);

// Remove the spacer div at the bottom
content = content.replace(
  /<div id="hdrSpacer" aria-hidden="true" style=\{\{ height: headerHeight \}\}\><\/div>/g,
  ''
);

// We need to change pointer-events-none to pointer-events-auto on hdr-wrap because it's no longer fixed over everything
content = content.replace(
  'className="hdr-wrap sticky top-0 z-30 mb-4"',
  'className="hdr-wrap sticky top-2 z-30 mb-6"'
);

// We should also remove the pointer-events-auto from inner
content = content.replace(
  'pointer-events-auto relative',
  'relative'
);

fs.writeFileSync('src/components/Header.tsx', content);
