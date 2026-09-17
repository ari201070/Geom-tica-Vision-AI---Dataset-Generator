const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `      } else if (error?.status === 429 || errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("Max retries reached") || errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("Quota")) {
        setErrorNotification("Cuota de la API agotada o límite de tasa excedido. Favor reduzca la muestra o espere 1 minuto.");`;

const replaceStr = `      } else if (error?.status === 429 || errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("Max retries reached") || errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("Quota")) {
        setErrorNotification("Cuota de la API agotada (429). Google dice: " + (errorStr.substring(0, 100)) + ". Espere 1 min.");`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/App.tsx', code);
console.log('Done App Error');
