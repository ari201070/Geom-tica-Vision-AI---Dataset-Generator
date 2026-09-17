const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `if (!errorStr.includes("leaked") && !errorStr.includes("PERMISSION_DENIED") && !errorStr.includes("403") && !errorStr.includes("429") && !errorStr.includes("401") && !errorStr.includes("UNAUTHENTICATED") && !errorStr.includes("503") && !errorStr.includes("UNAVAILABLE") && !errorStr.includes("fetch failed") && !errorStr.includes("Timeout")) {`;
const replaceStr = `if (!errorStr.includes("leaked") && !errorStr.includes("PERMISSION_DENIED") && !errorStr.includes("403") && !errorStr.includes("429") && !errorStr.includes("401") && !errorStr.includes("UNAUTHENTICATED") && !errorStr.includes("503") && !errorStr.includes("UNAVAILABLE") && !errorStr.includes("fetch failed") && !errorStr.includes("Timeout") && !errorStr.includes("AUTH_EXPIRED")) {`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/App.tsx', code);
  console.log('App.tsx updated successfully');
} else {
  console.log('Target string not found in App.tsx');
}
