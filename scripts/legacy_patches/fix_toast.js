const fs = require('fs');
let content = fs.readFileSync('src/app/portefeuilles/page.tsx', 'utf8');

content = content.replace(/toast\(\{\s*message: \`Un retrait de \$\{deductAmount\} DT a été effectué.\`, tone: "ok"\s*description: \`Un retrait de \$\{deductAmount\} DT a été effectué.\`,\s*\}\);/g, 'toast({ message: `Un retrait de ${deductAmount} DT a été effectué.`, tone: "ok" });');

fs.writeFileSync('src/app/portefeuilles/page.tsx', content);
