const fs = require('fs');
let code = fs.readFileSync('src/components/MapComponent.tsx', 'utf8');

const oldCenterStr = `  const center: [number, number] = forcedCenter
    ? forcedCenter
    : selectedEntry 
    ? [selectedEntry.coordinates.lat, selectedEntry.coordinates.lng] 
    : entries.length > 0 
      ? [entries[0].coordinates.lat, entries[0].coordinates.lng] 
      : [-34.6622, -58.3653]; // Default Avellaneda`;

const newCenterStr = `  const center: [number, number] = forcedCenter
    ? forcedCenter
    : (selectedEntry?.coordinates?.lat !== undefined && selectedEntry?.coordinates?.lng !== undefined)
    ? [selectedEntry.coordinates.lat, selectedEntry.coordinates.lng] 
    : (entries.length > 0 && entries[0]?.coordinates?.lat !== undefined && entries[0]?.coordinates?.lng !== undefined)
      ? [entries[0].coordinates.lat, entries[0].coordinates.lng] 
      : [-34.6622, -58.3653]; // Default Avellaneda`;

code = code.replace(oldCenterStr, newCenterStr);

const oldChangeViewStr = `{selectedEntry && <ChangeView center={[selectedEntry.coordinates.lat, selectedEntry.coordinates.lng]} zoom={targetZoom} />}`;
const newChangeViewStr = `{(selectedEntry?.coordinates?.lat !== undefined && selectedEntry?.coordinates?.lng !== undefined) && <ChangeView center={[selectedEntry.coordinates.lat, selectedEntry.coordinates.lng]} zoom={targetZoom} />}`;

code = code.replace(oldChangeViewStr, newChangeViewStr);

const oldEntriesMapStr = `{entries.map(entry => {
          const isSelected = selectedEntry?.id === entry.id;
          return (
            <CircleMarker 
              key={entry.id} 
              center={[entry.coordinates.lat, entry.coordinates.lng]}`;

const newEntriesMapStr = `{entries.map(entry => {
          if (entry?.coordinates?.lat === undefined || entry?.coordinates?.lng === undefined) return null;
          const isSelected = selectedEntry?.id === entry.id;
          return (
            <CircleMarker 
              key={entry.id} 
              center={[entry.coordinates.lat, entry.coordinates.lng]}`;

code = code.replace(oldEntriesMapStr, newEntriesMapStr);

fs.writeFileSync('src/components/MapComponent.tsx', code);
console.log('MapComponent updated');
