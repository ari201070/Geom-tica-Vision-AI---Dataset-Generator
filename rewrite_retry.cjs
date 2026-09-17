const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

code = code.replace(
  /await delay\(Math\.pow\(2, i\) \* 1000 \+ Math\.random\(\) \* 500\);/g,
  'await delay(status === 429 || errorStr.includes("429") || errorStr.includes("quota") ? (i + 1) * 7000 + Math.random() * 1000 : Math.pow(2, i) * 1000 + Math.random() * 500);'
);

// We should also increase retries to 4 to give it more chances
code = code.replace(/retries = 3/g, 'retries = 4');

fs.writeFileSync('src/services/geminiService.ts', code);
console.log('Done');
