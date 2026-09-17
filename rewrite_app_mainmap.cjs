const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `              <>
                <div className="h-[400px] w-full border-b border-brand-line shrink-0">
                  <MapComponent `;

const replaceStr = `              <>
                <div className="h-[400px] w-full border-b border-brand-line shrink-0 relative z-0 isolate">
                  <MapComponent `;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/App.tsx', code);
console.log('Done');
