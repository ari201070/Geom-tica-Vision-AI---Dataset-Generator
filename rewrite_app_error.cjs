const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `      // Do not log expected 403/429 errors to console to prevent AI Studio error catcher
      if (!errorStr.includes("leaked") && !errorStr.includes("PERMISSION_DENIED") && !errorStr.includes("403") && !errorStr.includes("429")) {
        console.error("Generation stopped:", error);
      }
      
      if (errorStr.includes("EXCEEDED_SPENDING_CAP")) {
        setErrorNotification("Presupuesto agotado en AI Studio. Favor revise su 'Spending Cap' en ai.studio/spend.");
      } else if (errorStr.includes("API_KEY_INVALID") || errorStr.includes("400") || errorStr.includes("INVALID_ARGUMENT")) {
        setErrorNotification("La API Key es inválida o fue revocada por seguridad. Haga clic en 'Configurar API Key' y pegue una nueva.");`;

const replaceStr = `      // Do not log expected auth/rate-limit errors to console to prevent AI Studio error catcher
      if (!errorStr.includes("leaked") && !errorStr.includes("PERMISSION_DENIED") && !errorStr.includes("403") && !errorStr.includes("429") && !errorStr.includes("401") && !errorStr.includes("UNAUTHENTICATED")) {
        console.error("Generation stopped:", error);
      }
      
      if (errorStr.includes("EXCEEDED_SPENDING_CAP")) {
        setErrorNotification("Presupuesto agotado en AI Studio. Favor revise su 'Spending Cap' en ai.studio/spend.");
      } else if (errorStr.includes("API_KEY_INVALID") || errorStr.includes("400") || errorStr.includes("INVALID_ARGUMENT") || errorStr.includes("401") || errorStr.includes("UNAUTHENTICATED") || errorStr.includes("invalid authentication")) {
        setErrorNotification("La API Key es inválida o fue revocada por seguridad. Haga clic en 'Configurar API Key' y pegue una nueva.");`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/App.tsx', code);
console.log('Done');
