const fs = require('fs');
let code = fs.readFileSync('src/components/MapComponent.tsx', 'utf8');

const oldAnchors = `{anchors.map((anchor, idx) => (
          <Marker 
            key={\`anchor-\${idx}-\${anchor.name}\`}
            position={[anchor.lat, anchor.lng]}`;

const newAnchors = `{anchors.map((anchor, idx) => {
          if (anchor?.lat === undefined || anchor?.lng === undefined) return null;
          return (
          <Marker 
            key={\`anchor-\${idx}-\${anchor.name}\`}
            position={[anchor.lat, anchor.lng]}`;

code = code.replace(oldAnchors, newAnchors);
code = code.replace(`        ))}
        {entries.map`, `          );
        })}
        {entries.map`);

fs.writeFileSync('src/components/MapComponent.tsx', code);
console.log('MapComponent anchors updated');
