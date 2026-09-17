const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `    const prompt = \`Actúa como un experto en SIG (Sistemas de Información Geográfica). 
  Para la ubicación: "\${location}", identifica 5-8 puntos de interés REALES (monumentos, plazas, intersecciones famosas, edificios públicos).
  Devuelve un array JSON de objetos con: { "name": string, "lat": number, "lng": number, "type": string }.
  Asegúrate de que las coordenadas sean lo más precisas posible según tu base de datos de conocimiento (OpenStreetMap/Wiki).\`;`;

const replaceStr = `    const prompt = \`Actúa como un experto en SIG (Sistemas de Información Geográfica). 
  El usuario ha solicitado la siguiente ubicación o conjunto de lugares: "\${location}".
  
  INSTRUCCIÓN CRÍTICA: 
  - Si el usuario enumera lugares específicos (ej. "Solo Coliseo y Palatino", "Colosseum and Palatine Hill"), DEBES devolver ÚNICAMENTE esos lugares solicitados. No agregues otros puntos de interés cercanos (como el Foro Romano).
  - Si el usuario da una ubicación general (ej. "Roma", "Madrid"), identifica 5-8 puntos de interés REALES y variados dentro de esa área.
  
  Devuelve un array JSON de objetos con: { "name": string, "lat": number, "lng": number, "type": string }.
  Asegúrate de que las coordenadas sean de ALTA PRECISIÓN (error < 15 metros) según tu base de datos de conocimiento.\`;`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('server.ts', code);
console.log('Done');
