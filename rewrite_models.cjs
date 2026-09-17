const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/gemini-3-flash-preview/g, 'gemini-2.5-flash');
code = code.replace(/gemini-3.1-pro-preview/g, 'gemini-2.5-pro');

fs.writeFileSync('server.ts', code);
console.log('Done Models');
