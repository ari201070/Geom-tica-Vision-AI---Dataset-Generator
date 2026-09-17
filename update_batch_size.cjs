const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `const batchSize = 100; // Aumentado para procesar más muestras en un solo llamado a la API`;
const replaceStr = `const batchSize = 10; // Reducido para evitar timeouts y pérdida de sesión (AUTH_EXPIRED)`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/App.tsx', code);
  console.log('App.tsx updated batch size successfully');
} else {
  console.log('Target string not found in App.tsx');
}
