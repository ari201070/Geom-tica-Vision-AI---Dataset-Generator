const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `const batchSize = 10; // Reducido para evitar timeouts y pérdida de sesión (AUTH_EXPIRED)`;
const replaceStr = `const batchSize = 5; // Aún más reducido para evitar cortes de JSON por token limit`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/App.tsx', code);
  console.log('App.tsx batchSize updated successfully');
} else {
  console.log('Target string not found in App.tsx');
}
