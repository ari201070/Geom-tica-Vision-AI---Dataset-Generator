const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Increase retries in App.tsx
code = code.replace(/hasCustomKey, 3, customCenters/g, 'hasCustomKey, 5, customCenters');

// Ensure delays are present
if (!code.includes('await delay(2000)')) {
  console.log("Delays missing in App.tsx");
}

fs.writeFileSync('src/App.tsx', code);
console.log('Done App');
