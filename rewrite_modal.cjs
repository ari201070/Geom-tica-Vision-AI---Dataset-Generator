const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace showCostWarning -> showConfirmModal
code = code.replace(/showCostWarning/g, 'showConfirmModal');
code = code.replace(/setShowCostWarning/g, 'setShowConfirmModal');

// Replace the JSX for the modal
code = code.replace(
  /<h3 className="text-xl font-bold uppercase tracking-tight">Estimación de Costo \(Flash\)<\/h3>/g,
  '<h3 className="text-xl font-bold uppercase tracking-tight">Confirmación de Consumo API</h3>'
);

code = code.replace(
  /<p className="text-\[10px\] opacity-60 uppercase tracking-widest">Modelo de Bajo Costo Seleccionado<\/p>/g,
  '<p className="text-[10px] opacity-60 uppercase tracking-widest">Uso con clave gratuita permitida (Uso Justo)</p>'
);

// We need to replace the cost block:
// <div className="bg-brand-ink/5 p-4 border border-brand-line/30 font-mono text-xs">
// ...
// </div>

const startMarker = '<div className="bg-brand-ink/5 p-4 border border-brand-line/30 font-mono text-xs">';
const endMarker = '(El costo se calcula restando la data de zonas previamente procesadas)';

// It's safer to just regex replace the specific inner parts.
code = code.replace(
  /<div className="flex justify-between border-b border-brand-line\/30 pb-2 mb-2">\s*<span className="opacity-70">Costo máx\. por muestra \(Aprox\.\):<\/span>\s*<span>\$0\.0003 USD<\/span>\s*<\/div>/g,
  ''
);

code = code.replace(
  /<span>Costo Total Estimado:<\/span>/g,
  '<span>Muestras a Consultar a la API:</span>'
);

code = code.replace(
  /return \(sampleCount \* 0\.0003\)\.toFixed\(5\);/g,
  'return sampleCount.toString();'
);

code = code.replace(
  /if \(totalUncached === 0\) return "0\.00000";\s*return \(totalUncached \* 0\.0003\)\.toFixed\(5\);/g,
  'return totalUncached.toString();'
);

code = code.replace(
  /\(El costo se calcula restando la data de zonas previamente procesadas\)/g,
  '(Las muestras cacheadas previamente no consumen peticiones a la API)'
);

code = code.replace(
  / USD<\/span>/g,
  '</span>'
);

code = code.replace(
  /Colección: Dataset "(.*?)" cargado desde almacenamiento local - Costo \$0!/g,
  'Colección: Dataset "$1" cargado desde almacenamiento local (Caché)'
);

code = code.replace(
  /Colecciones Locales \(Costo \$0\):/g,
  'Colecciones Locales (Caché):'
);


fs.writeFileSync('src/App.tsx', code);
console.log('Done');
