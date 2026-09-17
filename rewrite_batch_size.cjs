const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `        const batchSize = 30;`;
const replaceStr = `        const batchSize = 100; // Aumentado para procesar más muestras en un solo llamado a la API`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/App.tsx', code);
console.log('Done');
