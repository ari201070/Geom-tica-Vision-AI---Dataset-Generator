const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `      // Do not log expected auth/rate-limit errors to console to prevent AI Studio error catcher
      if (!errorStr.includes("leaked") && !errorStr.includes("PERMISSION_DENIED") && !errorStr.includes("403") && !errorStr.includes("429") && !errorStr.includes("401") && !errorStr.includes("UNAUTHENTICATED")) {
        console.error("Generation stopped:", error);
      }
      
      if (errorStr.includes("EXCEEDED_SPENDING_CAP")) {
        setErrorNotification("Presupuesto agotado en AI Studio. Favor revise su 'Spending Cap' en ai.studio/spend.");
      } else if (errorStr.includes("API_KEY_INVALID") || errorStr.includes("400") || errorStr.includes("INVALID_ARGUMENT") || errorStr.includes("401") || errorStr.includes("UNAUTHENTICATED") || errorStr.includes("invalid authentication")) {
        setErrorNotification("La API Key es inválida o fue revocada por seguridad. Haga clic en 'Configurar API Key' y pegue una nueva.");
      } else if (errorStr.includes("leaked") || errorStr.includes("PERMISSION_DENIED") || errorStr.includes("403")) {
        setErrorNotification("La clave por defecto alcanzó su límite. Haga clic en 'Configurar API Key' para usar su propia clave GRATUITA de AI Studio.");
      } else if (error?.status === 429 || errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("Max retries reached") || errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("Quota")) {
        setErrorNotification("Cuota de la API agotada o límite de tasa excedido. Favor reduzca la muestra o espere 1 minuto.");
      } else {
        setErrorNotification("Error en la generación. Revise conexión o API Key.");
      }`;

const replaceStr = `      // Do not log expected auth/rate-limit errors to console to prevent AI Studio error catcher
      if (!errorStr.includes("leaked") && !errorStr.includes("PERMISSION_DENIED") && !errorStr.includes("403") && !errorStr.includes("429") && !errorStr.includes("401") && !errorStr.includes("UNAUTHENTICATED") && !errorStr.includes("503") && !errorStr.includes("UNAVAILABLE") && !errorStr.includes("fetch failed") && !errorStr.includes("Timeout")) {
        console.error("Generation stopped:", error);
      }
      
      if (errorStr.includes("EXCEEDED_SPENDING_CAP")) {
        setErrorNotification("Presupuesto agotado en AI Studio. Favor revise su 'Spending Cap' en ai.studio/spend.");
      } else if (errorStr.includes("API_KEY_INVALID") || errorStr.includes("400") || errorStr.includes("INVALID_ARGUMENT") || errorStr.includes("401") || errorStr.includes("UNAUTHENTICATED") || errorStr.includes("invalid authentication")) {
        setErrorNotification("La API Key es inválida o fue revocada por seguridad. Haga clic en 'Configurar API Key' y pegue una nueva.");
      } else if (errorStr.includes("leaked") || errorStr.includes("PERMISSION_DENIED") || errorStr.includes("403")) {
        setErrorNotification("La clave por defecto alcanzó su límite. Haga clic en 'Configurar API Key' para usar su propia clave GRATUITA de AI Studio.");
      } else if (error?.status === 429 || errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("Max retries reached") || errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("Quota")) {
        setErrorNotification("Cuota de la API agotada o límite de tasa excedido. Favor reduzca la muestra o espere 1 minuto.");
      } else if (errorStr.includes("503") || errorStr.includes("UNAVAILABLE") || errorStr.includes("fetch failed") || errorStr.includes("Timeout") || errorStr.includes("overloaded")) {
        setErrorNotification("Los servidores de Google Gemini están temporalmente saturados. Por favor, espera unos minutos e intenta de nuevo.");
      } else {
        setErrorNotification("Error en la generación. Revise conexión o API Key.");
      }`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/App.tsx', code);
console.log('Done');
