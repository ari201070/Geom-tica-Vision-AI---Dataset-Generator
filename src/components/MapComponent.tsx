import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Tooltip, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import { DatasetEntry, LocationAnchor } from '../services/geminiService';
import { useEffect, useMemo } from 'react';
import * as h3 from 'h3-js';
import { Star } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

// Fix for Leaflet marker icons in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapComponentProps {
  entries: DatasetEntry[];
  selectedEntry: DatasetEntry | null;
  onSelect: (entry: DatasetEntry) => void;
  h3Clusters: Record<string, number>;
  showH3Layer?: boolean;
  h3Opacity?: number;
  geofence?: string[];
  isDrawingMode?: boolean;
  onUpdateGeofence?: (cells: string[]) => void;
  anchors?: LocationAnchor[];
  forcedCenter?: [number, number];
}

const anchorIcon = L.divIcon({
  html: renderToStaticMarkup(<Star size={24} fill="#fbbf24" color="#92400e" strokeWidth={2} />),
  className: 'anchor-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function ChangeView({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom || map.getZoom());
  }, [center, zoom, map]);
  return null;
}

function MapEvents({ isDrawingMode, geofence, onUpdateGeofence }: { isDrawingMode: boolean; geofence: string[]; onUpdateGeofence?: (cells: string[]) => void }) {
  const map = useMap();
  
  useEffect(() => {
    if (!isDrawingMode || !onUpdateGeofence) return;

    const onClick = (e: L.LeafletMouseEvent) => {
      const h3Idx = h3.latLngToCell(e.latlng.lat, e.latlng.lng, 9);
      const newGeofence = [...geofence];
      const existingIdx = newGeofence.indexOf(h3Idx);
      
      if (existingIdx > -1) {
        newGeofence.splice(existingIdx, 1);
      } else {
        newGeofence.push(h3Idx);
      }
      onUpdateGeofence(newGeofence);
    };

    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [isDrawingMode, geofence, onUpdateGeofence, map]);

  return null;
}

export default function MapComponent({ 
  entries, 
  selectedEntry, 
  onSelect, 
  h3Clusters,
  showH3Layer = true,
  h3Opacity = 0.4,
  geofence = [],
  isDrawingMode = false,
  onUpdateGeofence,
  anchors = [],
  forcedCenter
}: MapComponentProps) {
  const center: [number, number] = forcedCenter
    ? forcedCenter
    : selectedEntry 
    ? [selectedEntry.coordinates.lat, selectedEntry.coordinates.lng] 
    : entries.length > 0 
      ? [entries[0].coordinates.lat, entries[0].coordinates.lng] 
      : [-34.6622, -58.3653]; // Default Avellaneda

  const isSingleView = entries.length === 1 || forcedCenter;
  const targetZoom = isSingleView ? 16 : 14;

  // Generate H3 Polygons for clusters
  const h3Polygons = useMemo(() => Object.entries(h3Clusters).map(([h3Idx, count]) => {
    const boundary = h3.cellToBoundary(h3Idx);
    return {
      id: h3Idx,
      path: boundary.map(([lat, lng]) => [lat, lng] as [number, number]),
      count
    };
  }), [h3Clusters]);

  // Generate H3 Polygons for geofence
  const geofencePolygons = useMemo(() => geofence.map(h3Idx => {
    const boundary = h3.cellToBoundary(h3Idx);
    return {
      id: h3Idx,
      path: boundary.map(([lat, lng]) => [lat, lng] as [number, number])
    };
  }), [geofence]);

  return (
    <div className={`h-full w-full grayscale contrast-[1.2] transition-all ${isDrawingMode ? 'cursor-crosshair ring-4 ring-brand-line ring-inset' : ''}`}>
      <MapContainer 
        center={center} 
        zoom={targetZoom} 
        scrollWheelZoom={true} 
        preferCanvas={true}
        style={{ height: '100%', width: '100%', background: '#E4E3E0' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapEvents isDrawingMode={isDrawingMode} geofence={geofence} onUpdateGeofence={onUpdateGeofence} />
        
        {selectedEntry && <ChangeView center={[selectedEntry.coordinates.lat, selectedEntry.coordinates.lng]} zoom={targetZoom} />}

        {/* Geofence Layer */}
        {geofencePolygons.map(poly => (
          <Polygon 
            key={`fence-${poly.id}`}
            positions={poly.path}
            pathOptions={{
              color: '#ea580c',
              weight: 2,
              fillColor: '#f97316',
              fillOpacity: 0.3,
              dashArray: '5, 5'
            }}
          />
        ))}

        {showH3Layer && h3Polygons.map(poly => {
          const isInGeofence = geofence.includes(poly.id);
          return (
            <Polygon 
              key={poly.id}
              positions={poly.path}
              pathOptions={{
                color: isInGeofence ? '#ea580c' : '#141414',
                weight: isInGeofence ? 2 : 1,
                fillColor: isInGeofence ? '#f97316' : '#059669',
                fillOpacity: Math.min(h3Opacity + (isInGeofence ? 0.2 : 0), 0.8)
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} className="h3-tooltip bg-emerald-600 border-none rounded px-2 py-1 text-white font-bold text-[10px] shadow-lg">
                Cluster: {poly.count} muestras {isInGeofence ? '(ZONA ACTIVA)' : ''}
              </Tooltip>
              <Popup>
                <div className="font-mono text-xs p-1">
                  <p className="font-bold border-b border-brand-line pb-1 mb-1">DETALLE DE CLUSTER</p>
                  <p>H3: <span className="text-[10px]">{poly.id}</span></p>
                  <p className="text-lg font-bold text-emerald-700">{poly.count} MUESTRAS</p>
                  {isInGeofence && <p className="mt-2 text-[9px] bg-orange-100 text-orange-700 px-1 py-0.5 font-bold">DENTRO DE GEOVALLA DE GENERACIÓN</p>}
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {anchors.map((anchor, idx) => (
          <Marker 
            key={`anchor-${idx}-${anchor.name}`}
            position={[anchor.lat, anchor.lng]}
            icon={anchorIcon}
          >
            <Tooltip direction="top" className="bg-amber-100 border-amber-500 text-amber-900 font-bold text-xs px-2 py-1">
              GROUND TRUTH: {anchor.name}
            </Tooltip>
            <Popup>
              <div className="font-sans p-1">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Referencia Real (Ground Truth)</p>
                <h4 className="font-bold text-sm mb-1">{anchor.name}</h4>
                <p className="text-[10px] text-brand-ink/60 mb-2">{anchor.type}</p>
                <div className="text-[9px] font-mono bg-amber-50 p-1 border border-amber-100 italic">
                  Lat: {anchor.lat}<br/>
                  Lng: {anchor.lng}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {entries.map(entry => {
          const isSelected = selectedEntry?.id === entry.id;
          return (
            <CircleMarker 
              key={entry.id} 
              center={[entry.coordinates.lat, entry.coordinates.lng]}
              radius={isSelected ? 6 : 4}
              pathOptions={{
                fillColor: isSelected ? '#141414' : '#059669',
                color: isSelected ? '#fff' : '#141414',
                weight: isSelected ? 2 : 1,
                fillOpacity: 1,
              }}
              eventHandlers={{
                click: () => onSelect(entry),
              }}
            >
              <Popup>
                <div className="font-mono text-[10px]">
                  <p className="font-bold border-b border-brand-ink/20 pb-1 mb-1 text-emerald-700 uppercase tracking-tighter">{entry.id}</p>
                  <p className="mt-1 font-bold">{entry.category || 'Sin categoría'}</p>
                  <p className="opacity-80 line-clamp-2">{entry.microPhysiognomy.urbanElements.architectureStyle}</p>
                  <div className="mt-2 text-[9px] bg-brand-ink text-brand-bg px-1 inline-block">CLICK PARA VER DETALLES</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
