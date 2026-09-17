const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `className="fixed inset-0 bg-brand-ink/90 z-[2000] flex items-center justify-center p-4 md:p-6 backdrop-blur-sm"
          >
            <motion.div`;

const replaceStr = `className="fixed inset-0 bg-brand-ink/90 z-[2000] flex items-center justify-center p-4 md:p-6 backdrop-blur-sm"
            onClick={() => setSelectedEntry(null)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/App.tsx', code);
  console.log('App.tsx backdrop updated successfully');
} else {
  console.log('Target string not found in App.tsx');
}
