const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `      if (errorStr.includes("EXCEEDED_SPENDING_CAP")) {
        setErrorNotification("Presupuesto agotado en AI Studio. Favor revise su 'Spending Cap' en ai.studio/spend.");
      } else if (errorStr.includes("leaked") || errorStr.includes("PERMISSION_DENIED") || errorStr.includes("403")) {
        setErrorNotification("La clave por defecto alcanzó su límite. Haga clic en 'Configurar API Key' para usar su propia clave GRATUITA de AI Studio.");`;

const replaceStr = `      if (errorStr.includes("EXCEEDED_SPENDING_CAP")) {
        setErrorNotification("Presupuesto agotado en AI Studio. Favor revise su 'Spending Cap' en ai.studio/spend.");
      } else if (errorStr.includes("API_KEY_INVALID") || errorStr.includes("400") || errorStr.includes("INVALID_ARGUMENT")) {
        setErrorNotification("La API Key es inválida o fue revocada por seguridad. Haga clic en 'Configurar API Key' y pegue una nueva.");
      } else if (errorStr.includes("leaked") || errorStr.includes("PERMISSION_DENIED") || errorStr.includes("403")) {
        setErrorNotification("La clave por defecto alcanzó su límite. Haga clic en 'Configurar API Key' para usar su propia clave GRATUITA de AI Studio.");`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/App.tsx', code);
console.log('Done');
