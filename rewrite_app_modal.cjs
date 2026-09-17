const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-brand-bg w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col border border-brand-line"
            >
              <div className="p-6 border-b border-brand-line flex justify-between items-center bg-brand-bg">`;

const replaceStr = `            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-brand-bg w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col border border-brand-line relative"
            >
              <div className="p-6 border-b border-brand-line flex justify-between items-center bg-brand-bg relative z-20">`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/App.tsx', code);
console.log('Done');
