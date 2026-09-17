const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `                    <div className="w-full h-48 border border-brand-line bg-brand-ink/5">
                      <MapComponent 
                        entries={[selectedEntry]} 
                        selectedEntry={selectedEntry} 
                        onSelect={() => {}} 
                        h3Clusters={{}}
                      />
                    </div>`;

const replaceStr = `                    <div className="w-full h-48 border border-brand-line bg-brand-ink/5 relative z-0 isolate">
                      <MapComponent 
                        entries={[selectedEntry]} 
                        selectedEntry={selectedEntry} 
                        onSelect={() => {}} 
                        h3Clusters={{}}
                      />
                    </div>`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/App.tsx', code);
console.log('Done');
