const fs = require('fs');
let code = fs.readFileSync('src/components/MapComponent.tsx', 'utf8');

const targetStr = `          </Marker>
        ))}
        {entries.map`;
const replaceStr = `          </Marker>
          );
        })}
        {entries.map`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync('src/components/MapComponent.tsx', code);
console.log('Fixed MapComponent syntax 2');
