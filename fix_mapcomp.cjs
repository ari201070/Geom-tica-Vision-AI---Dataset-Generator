const fs = require('fs');
let code = fs.readFileSync('src/components/MapComponent.tsx', 'utf8');

code = code.replace(/className=\{\`h-full w-full/g, 'className={`h-full w-full overflow-hidden');

fs.writeFileSync('src/components/MapComponent.tsx', code);
console.log('MapComponent.tsx updated');
