const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `  if (status === 400 || status === 401 || status === 403 || status === 429 || message.includes("400") || message.includes("401") || message.includes("403") || message.includes("429") || message.includes("API key not valid") || message.includes("API_KEY_INVALID") || message.includes("INVALID_ARGUMENT") || message.includes("UNAUTHENTICATED") || message.includes("invalid authentication") || message.includes("PERMISSION_DENIED") || message.includes("RESOURCE_EXHAUSTED") || message.includes("leaked")) {`;

const replaceStr = `  if (status === 400 || status === 401 || status === 403 || status === 429 || status === 503 || message.includes("400") || message.includes("401") || message.includes("403") || message.includes("429") || message.includes("503") || message.includes("API key not valid") || message.includes("API_KEY_INVALID") || message.includes("INVALID_ARGUMENT") || message.includes("UNAUTHENTICATED") || message.includes("invalid authentication") || message.includes("PERMISSION_DENIED") || message.includes("RESOURCE_EXHAUSTED") || message.includes("leaked") || message.includes("UNAVAILABLE") || message.includes("fetch failed") || message.includes("Timeout")) {`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('server.ts', code);
console.log('Done');
