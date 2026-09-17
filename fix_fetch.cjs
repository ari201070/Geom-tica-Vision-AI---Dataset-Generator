const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const targetStr = `      if (!res.ok) {
        let errStr = "";
        try {
          const errJSON = await res.json();
          errStr = String(errJSON.error || errJSON.message || JSON.stringify(errJSON));
        } catch (parseError) {
          errStr = await res.text();
        }
        const status = res.status;
        const errorStr = String(errStr || status);
        
        const isRetryable = status === 429 || status === 503 || status === 504 || 
                           errorStr.includes("429") || errorStr.includes("503") || 
                           errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("Deadline");
                           
        if (isRetryable) {
          if (errorStr.includes("spending cap")) {
            isSpendingCapExceeded = true;
            throw new Error("EXCEEDED_SPENDING_CAP");
          }
          if (i < retries - 1) {
            await delay(status === 429 || errorStr.includes("429") || errorStr.includes("quota") ? (i + 1) * 7000 + Math.random() * 1000 : Math.pow(2, i) * 1000 + Math.random() * 500);
            continue;
          }
        } else {
          // If not retryable, throw immediately so we don't delay and retry 3 times
          throw new Error(errorStr);
        }
        throw new Error(errorStr);
      }
      const responseText = await res.text();
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(\`Invalid JSON response: \${responseText.substring(0, 50)}...\`);
      }`;

const replaceStr = `      const responseText = await res.text();
      if (!res.ok) {
        let errStr = responseText;
        try {
          const errJSON = JSON.parse(responseText);
          errStr = String(errJSON.error || errJSON.message || JSON.stringify(errJSON));
        } catch (parseError) {}
        
        const status = res.status;
        const errorStr = String(errStr || status);
        
        const isRetryable = status === 429 || status === 503 || status === 504 || 
                           errorStr.includes("429") || errorStr.includes("503") || 
                           errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("Deadline");
                           
        if (isRetryable) {
          if (errorStr.includes("spending cap")) {
            isSpendingCapExceeded = true;
            throw new Error("EXCEEDED_SPENDING_CAP");
          }
          if (i < retries - 1) {
            await delay(status === 429 || errorStr.includes("429") || errorStr.includes("quota") ? (i + 1) * 7000 + Math.random() * 1000 : Math.pow(2, i) * 1000 + Math.random() * 500);
            continue;
          }
        }
        throw new Error(errorStr);
      }
      
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        if (responseText.toLowerCase().includes("<!doctype html>")) {
          throw new Error("AUTH_EXPIRED");
        }
        throw new Error(\`Invalid JSON response: \${responseText.substring(0, 50)}...\`);
      }`;

code = code.replace(targetStr, replaceStr);
code = code.replace(`if (e.message === "EXCEEDED_SPENDING_CAP" || e.message?.includes("Invalid JSON response")) throw e;`, `if (e.message === "EXCEEDED_SPENDING_CAP" || e.message === "AUTH_EXPIRED" || e.message?.includes("Invalid JSON response")) throw e;`);
fs.writeFileSync('src/services/geminiService.ts', code);
console.log('Done fetch');
