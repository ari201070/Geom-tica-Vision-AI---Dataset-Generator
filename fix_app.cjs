const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `      } else if (errorStr.includes("EXCEEDED_SPENDING_CAP")) {`;
const replaceStr = `      } else if (errorStr.includes("AUTH_EXPIRED")) {
        setErrorNotification("La sesión de la plataforma caducó. Por favor, refresca la página completa del navegador (F5 o Ctrl+R).");
      } else if (errorStr.includes("EXCEEDED_SPENDING_CAP")) {`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/App.tsx', code);
  console.log('App.tsx updated successfully');
} else {
  console.log('Target string not found in App.tsx');
}
