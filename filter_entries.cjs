const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `          let uniqueBatch = batch.map((item, idx) => {`;
const replaceStr = `          let uniqueBatch = batch.filter(item => item?.coordinates?.lat !== undefined && item?.coordinates?.lng !== undefined).map((item, idx) => {`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/App.tsx', code);
  console.log('App.tsx updated filtering');
} else {
  console.log('Target string not found in App.tsx');
}
