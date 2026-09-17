const fs = require('fs');
let code = fs.readFileSync('src/components/MapComponent.tsx', 'utf8');

const targetStr = `            </Popup>
          </Marker>
        ))}
        {entries.map(entry => {`;
const replaceStr = `            </Popup>
          </Marker>
          );
        })}
        {entries.map(entry => {`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync('src/components/MapComponent.tsx', code);
console.log('Fixed MapComponent syntax 3');
