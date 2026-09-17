const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `<button 
                    onClick={() => setSelectedEntry(null)}
                    className="p-2 border border-brand-line hover:bg-brand-ink hover:text-brand-bg transition-colors"
                  >
                    <X size={20} />
                  </button>`;

const replaceStr = `<button 
                    onClick={(e) => { e.stopPropagation(); setSelectedEntry(null); }}
                    className="p-2 border border-brand-line hover:bg-brand-ink hover:text-brand-bg transition-colors relative z-50 cursor-pointer"
                  >
                    <X size={20} pointerEvents="none" />
                  </button>`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/App.tsx', code);
  console.log('App.tsx close button updated successfully');
} else {
  console.log('Target string not found in App.tsx');
}
