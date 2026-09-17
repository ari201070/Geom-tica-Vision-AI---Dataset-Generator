const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `message.includes("fetch failed") || message.includes("Timeout")) {`;
const replaceStr = `message.includes("fetch failed") || message.includes("Timeout") || message.includes("SyntaxError") || message.includes("JSON")) {`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('server.ts', code);
  console.log('server.ts error log updated successfully');
} else {
  console.log('Target string not found in server.ts');
}

let serviceCode = fs.readFileSync('src/services/geminiService.ts', 'utf8');
const targetServiceStr = `errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("Deadline");`;
const replaceServiceStr = `errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("Deadline") || errorStr.includes("SyntaxError") || errorStr.includes("JSON");`;

if (serviceCode.includes(targetServiceStr)) {
  serviceCode = serviceCode.replace(targetServiceStr, replaceServiceStr);
  fs.writeFileSync('src/services/geminiService.ts', serviceCode);
  console.log('geminiService.ts retry updated successfully');
} else {
  console.log('Target string not found in geminiService.ts');
}
