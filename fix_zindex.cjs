const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace all z-50 with z-[2000] to ensure they are above leaflet's 1000
code = code.replace(/z-50/g, 'z-[2000]');

// Add overflow-hidden to the MapComponent containers
code = code.replace(/relative z-0 isolate/g, 'relative z-0 isolate overflow-hidden');

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx updated');
