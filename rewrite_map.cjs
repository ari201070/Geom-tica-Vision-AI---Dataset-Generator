const fs = require('fs');
let code = fs.readFileSync('src/components/MapComponent.tsx', 'utf8');

if (!code.includes('leaflet.css')) {
  code = "import 'leaflet/dist/leaflet.css';\n" + code;
  fs.writeFileSync('src/components/MapComponent.tsx', code);
  console.log('Added leaflet.css');
} else {
  console.log('Already there');
}
