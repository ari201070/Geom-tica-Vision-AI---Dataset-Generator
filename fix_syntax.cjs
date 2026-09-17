const fs = require('fs');
let code = fs.readFileSync('src/components/MapComponent.tsx', 'utf8');

code = code.replace(`            </Marker>
        ))}`, `            </Marker>
          );
        })}`);

fs.writeFileSync('src/components/MapComponent.tsx', code);
console.log('Fixed MapComponent syntax');
