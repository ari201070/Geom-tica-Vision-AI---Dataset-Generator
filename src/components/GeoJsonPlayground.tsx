import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { DatasetEntry } from '../services/geminiService';
import { 
  Download, 
  Copy, 
  MapPin, 
  Settings, 
  Database, 
  Eye, 
  FileJson, 
  Sparkles, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Check, 
  RefreshCw, 
  Tag,
  ChevronDown,
  ChevronUp,
  Camera,
  Building2,
  Type,
  Info
} from 'lucide-react';

interface GeoJsonPlaygroundProps {
  entries: DatasetEntry[];
  selectedId?: string | null;
  onSelectId?: (id: string) => void;
}

// Default standard SimpleStyle properties for GeoJSON
const PRESET_COLORS = [
  { name: 'Negro Ink', hex: '#141414' },
  { name: 'Esmeralda', hex: '#059669' },
  { name: 'Carmesí', hex: '#db2777' },
  { name: 'Azul Eléctrico', hex: '#2563eb' },
  { name: 'Ámbar', hex: '#d97706' },
  { name: 'Violeta', hex: '#7c3aed' },
  { name: 'Naranja Fuego', hex: '#ea580c' },
  { name: 'Turquesa', hex: '#0d9488' }
];

export default function GeoJsonPlayground({ entries, selectedId, onSelectId }: GeoJsonPlaygroundProps) {
  // We keep a local state of styled/modified features so the user can interactively customize maps
  const [styledFeatures, setStyledFeatures] = useState<Record<string, {
    markerColor: string;
    markerSize: 'small' | 'medium' | 'large';
    markerSymbol: 'circle' | 'star' | 'pin';
    customProps?: Record<string, string>;
  }>>({});

  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'styles' | 'export' | 'id' | 'geojson'>('styles');
  const [copySuccess, setCopySuccess] = useState(false);
  const [newPropKey, setNewPropKey] = useState('');
  const [newPropVal, setNewPropVal] = useState('');

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: true,
    exif: false,
    urban: false,
    ocr: false
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Active select ID balances controlled (from props) and uncontrolled (internal) modes
  const activeSelectedId = selectedId !== undefined ? selectedId : internalSelectedId;

  const handleSelectId = (id: string) => {
    setInternalSelectedId(id);
    if (onSelectId) onSelectId(id);
  };

  // Auto-select first feature if none selected
  useEffect(() => {
    if (entries.length > 0 && !activeSelectedId) {
      handleSelectId(entries[0].id);
    }
  }, [entries, activeSelectedId]);

  const selectedEntry = useMemo(() => {
    return entries.find(e => e.id === activeSelectedId) || entries[0] || null;
  }, [entries, activeSelectedId]);

  // Handle setting/updating dynamic styles
  const updateStyle = (id: string, key: 'markerColor' | 'markerSize' | 'markerSymbol', value: any) => {
    setStyledFeatures(prev => {
      const existing = prev[id] || {
        markerColor: '#059669', // Default esmeralda
        markerSize: 'medium',
        markerSymbol: 'circle',
        customProps: {}
      };
      return {
        ...prev,
        [id]: {
          ...existing,
          [key]: value
        }
      };
    });
  };

  const addCustomProperty = (id: string) => {
    if (!newPropKey.trim()) return;
    setStyledFeatures(prev => {
      const existing = prev[id] || {
        markerColor: '#059669',
        markerSize: 'medium',
        markerSymbol: 'circle',
        customProps: {}
      };
      const customProps = { ...existing.customProps, [newPropKey.trim()]: newPropVal };
      return {
        ...prev,
        [id]: { ...existing, customProps }
      };
    });
    setNewPropKey('');
    setNewPropVal('');
  };

  const removeCustomProperty = (id: string, key: string) => {
    setStyledFeatures(prev => {
      const existing = prev[id];
      if (!existing || !existing.customProps) return prev;
      const customProps = { ...existing.customProps };
      delete customProps[key];
      return {
        ...prev,
        [id]: { ...existing, customProps }
      };
    });
  };

  // Convert currently loaded data + styles into a valid GeoJSON FeatureCollection
  const geoJsonData = useMemo(() => {
    const features = entries.map(entry => {
      const styles = styledFeatures[entry.id] || {
        markerColor: '#059669',
        markerSize: 'medium',
        markerSymbol: 'circle',
        customProps: {}
      };

      // Simplestyle spec & customized attributes
      return {
        type: 'Feature',
        id: entry.id,
        geometry: {
          type: 'Point',
          coordinates: [entry.coordinates.lng, entry.coordinates.lat] // GeoJSON specifies [longitude, latitude]
        },
        properties: {
          title: `${entry.id} - ${entry.coordinates.corner}`,
          category: entry.category || 'Otros',
          description: `Score de Validación: ${entry.validation?.computedScore || 0} pts • Estilo: ${entry.microPhysiognomy?.urbanElements?.architectureStyle || 'N/A'}`,
          // Spec-defined geojson parameters for styling (Mapbox/geojson.io simple style)
          'marker-color': styles.markerColor,
          'marker-size': styles.markerSize,
          'marker-symbol': styles.markerSymbol,
          // Original metadata properties
          originalId: entry.id,
          lat: entry.coordinates.lat,
          lng: entry.coordinates.lng,
          h3Index: entry.validation?.h3Index || 'N/A',
          groundTruth: entry.groundedFromAnchor || 'N/A',
          exifCamera: `${entry.exif?.make || ''} ${entry.exif?.model || ''}`.trim() || 'N/A',
          ocrDetectedText: entry.ocr?.detectedText || [],
          architectureStyle: entry.microPhysiognomy?.urbanElements?.architectureStyle || 'N/A',
          vegetationScore: entry.microPhysiognomy?.urbanElements?.vegetationScore || 0,
          ...styles.customProps
        }
      };
    });

    return {
      type: 'FeatureCollection',
      features
    };
  }, [entries, styledFeatures]);

  // Copy geojson object
  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(geoJsonData, null, 2));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Download geojson
  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(geoJsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `geojson_export_${Date.now()}.geojson`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to the live mapbox geojson.io web app
  const openExternalGeoJsonIo = () => {
    // We pass the geojson data directly via URL hash to load it instantly in the standard geojson.io engine!
    // To prevent browser URL truncation on 30+ point datasets filled with heavy raw EXIF specs,
    // we create a compressed/lightweight simple style GeoJSON that loads absolutely instantly and keeps color customisation intact!
    try {
      const compactedFeatures = entries.map(entry => {
        const styles = styledFeatures[entry.id] || {
          markerColor: '#059669',
          markerSize: 'medium',
          markerSymbol: 'circle',
          customProps: {}
        };
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [entry.coordinates.lng, entry.coordinates.lat]
          },
          properties: {
            title: entry.id,
            category: entry.category || 'Otros',
            'marker-color': styles.markerColor,
            'marker-size': styles.markerSize,
            'marker-symbol': styles.markerSymbol,
            ...styles.customProps
          }
        };
      });

      const compactedGeoJson = {
        type: 'FeatureCollection',
        features: compactedFeatures
      };

      const stringified = JSON.stringify(compactedGeoJson);
      const encoded = encodeURIComponent(stringified);
      const directUrl = `https://geojson.io/#data=data:application/json,${encoded}`;
      
      // Keep within reliable URL limits (safely below 8000 characters)
      if (directUrl.length < 7900) {
        window.open(directUrl, '_blank');
      } else {
        // Fallback to a clean workspace if it's exceptionally huge
        window.open('https://geojson.io/', '_blank');
      }
    } catch (err) {
      window.open('https://geojson.io/', '_blank');
    }
  };

  // Custom JSX components inside map to center view
  function ChangeMapView({ position }: { position: [number, number] }) {
    const map = useMap();
    useEffect(() => {
      if (position) {
        map.setView(position, 16);
      }
    }, [position, map]);
    return null;
  }

  // Trigger map invalidate size to fix Leaflet gray container sizing bug inside tabs/layout shifts
  function MapSizer() {
    const map = useMap();
    useEffect(() => {
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 200);
      return () => clearTimeout(timer);
    }, [map]);
    return null;
  }

  // Generate dynamic Leaflet Marker based on styling (renders colored SVGs)
  const getCustomMarkerIcon = (color: string, size: 'small' | 'medium' | 'large', symbol: 'circle' | 'star' | 'pin', isSelected: boolean) => {
    const pxSize = size === 'small' ? 24 : size === 'medium' ? 32 : 42;
    const strokeColor = isSelected ? '#FFFFFF' : '#141414';
    const strokeWidth = isSelected ? 3 : 1.5;

    let svgIcon = '';
    if (symbol === 'star') {
      svgIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${pxSize}" height="${pxSize}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}">
          <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
        </svg>
      `;
    } else if (symbol === 'pin') {
      svgIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${pxSize}" height="${pxSize}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>
      `;
    } else {
      // Circle default symbol
      svgIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${pxSize}" height="${pxSize}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" fill="#FFFFFF" opacity="0.6" />
        </svg>
      `;
    }

    return L.divIcon({
      html: svgIcon,
      className: 'custom-geojson-marker',
      iconSize: [pxSize, pxSize],
      iconAnchor: [pxSize / 2, pxSize / 2],
    });
  };

  if (!entries.length) return null;

  const currentStyles = selectedEntry ? (styledFeatures[selectedEntry.id] || {
    markerColor: '#059669',
    markerSize: 'medium',
    markerSymbol: 'circle',
    customProps: {}
  }) : {
    markerColor: '#059669',
    markerSize: 'medium',
    markerSymbol: 'circle',
    customProps: {}
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full border border-brand-line/20 bg-brand-bg rounded-sm overflow-hidden lg:min-h-0 min-h-0 flex-1">
      
      {/* 1. LEFT WORKSPACE: MAP PLAYGROUND & POPUPS */}
      <div className="flex-1 min-h-[350px] lg:min-h-0 lg:h-full relative border-r border-brand-line/20 flex flex-col">
        <div className="bg-white border-b border-brand-line/30 px-4 py-2 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#2B3B4C] flex items-center gap-1.5">
              <MapPin size={13} className="text-emerald-600" />
              <span>Entorno de Visualización Activa (GeoJSON.io)</span>
            </h3>
          </div>
          <span className="text-[9px] font-mono bg-brand-ink/5 px-2 py-0.5 rounded-xs text-brand-ink/50 uppercase font-bold">
            {entries.length} Features
          </span>
        </div>

        <div className="flex-1 min-h-[350px] lg:min-h-0 lg:h-full w-full relative">
          <MapContainer 
            center={selectedEntry ? [selectedEntry.coordinates.lat, selectedEntry.coordinates.lng] : [-34.6622, -58.3653]} 
            zoom={15} 
            scrollWheelZoom={true}
            preferCanvas={true}
            className="h-full w-full"
            style={{ height: '100%', width: '100%', background: '#E4E3E0' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapSizer />

            {selectedEntry && (
              <ChangeMapView position={[selectedEntry.coordinates.lat, selectedEntry.coordinates.lng]} />
            )}

            {entries.map(entry => {
              const itemStyles = styledFeatures[entry.id] || {
                markerColor: '#059669',
                markerSize: 'medium',
                markerSymbol: 'circle',
                customProps: {}
              };
              const isSelected = selectedEntry?.id === entry.id;

              return (
                <Marker
                  key={`${entry.id}-${itemStyles.markerColor}-${itemStyles.markerSize}-${itemStyles.markerSymbol}-${isSelected}`}
                  position={[entry.coordinates.lat, entry.coordinates.lng]}
                  icon={getCustomMarkerIcon(itemStyles.markerColor, itemStyles.markerSize, itemStyles.markerSymbol, isSelected)}
                  eventHandlers={{
                    click: () => handleSelectId(entry.id),
                  }}
                >
                  <Popup>
                    <div className="font-mono text-[10px] p-1 max-w-[200px] whitespace-normal">
                      <p className="font-bold border-b border-[#2B3B4C]/20 pb-1 mb-1 text-[#2B3B4C] uppercase tracking-tighter">
                        {entry.id}
                      </p>
                      <p className="font-bold mb-1 text-emerald-800">{entry.category || 'Otros'}</p>
                      <p className="opacity-80 leading-normal line-clamp-2 italic mb-2">
                        "{entry.microPhysiognomy?.urbanElements?.architectureStyle || 'Arquitectura Local'}"
                      </p>
                      <button
                        onClick={() => {
                          handleSelectId(entry.id);
                          setActiveTab('id'); // Muestra la pestaña ID & Info para detalles
                        }}
                        className="w-full bg-[#2B3B4C] hover:bg-emerald-600 active:bg-emerald-700 text-white text-[9px] font-bold text-center py-1.5 rounded-sm tracking-wider uppercase transition-all duration-150 cursor-pointer border border-[#2B3B4C]/20 hover:border-emerald-600 block shadow-2xs select-none"
                      >
                        Ver Detalles en Editor
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* 2. RIGHT WORKSPACE: FEATURE PROPERTY TABLE & EXPORT TABS */}
      <div className="w-full lg:w-[480px] bg-white flex flex-col h-full shrink-0 border-t lg:border-t-0 lg:border-l border-brand-line/20 overflow-hidden">
        
        {/* Playgound Header */}
        <div className="bg-[#2B3B4C] text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileJson size={15} className="text-emerald-400" />
            <span className="font-bold text-xs uppercase tracking-widest font-mono">Feature Editor</span>
          </div>
          <span className="text-[9px] bg-white/20 px-2 py-0.5 font-bold font-mono">
            {selectedEntry?.id || 'Ninguno'}
          </span>
        </div>

        {/* Feature selection row */}
        <div className="p-3 border-b border-brand-line/20 bg-brand-bg flex items-center gap-2 overflow-x-auto select-none shrink-0 scrollbar-hidden">
          <span className="text-[9px] font-bold text-brand-ink/40 uppercase tracking-widest shrink-0 font-mono">
            Elegir Punto:
          </span>
          {entries.map(e => {
            const itemStyleSpec = styledFeatures[e.id] || {
              markerColor: '#059669',
              markerSize: 'medium',
              markerSymbol: 'circle',
              customProps: {}
            };
            const isSelected = activeSelectedId === e.id;
            return (
              <button
                key={e.id}
                onClick={() => handleSelectId(e.id)}
                className={`px-2.5 py-1 shrink-0 text-[10px] font-bold font-mono uppercase tracking-tight transition-all rounded-xs border flex items-center gap-2 select-none cursor-pointer ${
                  isSelected
                    ? 'text-white shadow-xs font-extrabold scale-105'
                    : 'bg-white border-brand-line/40 text-brand-ink/70 hover:bg-brand-line/10 hover:border-brand-ink/30'
                }`}
                style={{
                  backgroundColor: isSelected ? itemStyleSpec.markerColor : '#FFFFFF',
                  borderColor: isSelected ? itemStyleSpec.markerColor : '#E2E8F0',
                }}
              >
                {/* Un pequeño circulito del color del marcador */}
                <span 
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs border border-[#141414]/10 transition-colors" 
                  style={{ 
                    backgroundColor: isSelected ? '#FFFFFF' : itemStyleSpec.markerColor,
                    borderColor: isSelected ? 'transparent' : 'rgba(20,20,20,0.15)'
                  }} 
                />
                {e.id}
              </button>
            );
          })}
        </div>

        {/* Interactive Properties Table of Selected Element */}
        <div className="flex-1 min-h-[220px] overflow-y-auto p-4 space-y-3.5 border-b border-brand-line/20 scrollbar-thin">
          <div className="flex justify-between items-center mb-1">
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-[#2B3B4C]/60 flex items-center gap-1 font-mono">
              <Database size={11} className="text-brand-ink" />
              <span>Atributos Geoespaciales</span>
            </h4>
            <span className="text-[8px] opacity-40 italic block">(Editables en tiempo real)</span>
          </div>

          {selectedEntry ? (
            <div className="h-[295px] overflow-y-auto border border-brand-line/20 bg-white rounded-md overflow-x-hidden divide-y divide-brand-line/15 scrollbar-thin shadow-2xs">
              
              {/* SECTION 1: DATOS GENERALES */}
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => toggleSection('general')}
                  className="bg-[#2B3B4C]/5 hover:bg-[#2B3B4C]/10 transition-colors uppercase font-mono font-bold text-[9px] text-[#2B3B4C]/80 px-3 py-2 flex items-center justify-between cursor-pointer w-full select-none"
                >
                  <span className="flex items-center gap-1.5">
                    <Info size={11} className="text-emerald-600" />
                    <span>General & Ubicación</span>
                  </span>
                  {openSections.general ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                
                {openSections.general && (
                  <div className="bg-white divide-y divide-brand-line/5">
                    {/* ID del Punto */}
                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 text-[11px] hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">id</div>
                      <div className="col-span-7 font-mono text-emerald-600 font-bold border-l border-brand-line/10 pl-2">{selectedEntry.id}</div>
                    </div>

                    {/* Coordenadas */}
                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 text-[11px] hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">coordinates</div>
                      <div className="col-span-7 font-mono text-brand-ink text-[10px] border-l border-brand-line/10 pl-2">
                        lat: {selectedEntry.coordinates.lat.toFixed(6)}, lng: {selectedEntry.coordinates.lng.toFixed(6)}
                      </div>
                    </div>

                    {/* Intersección / Esquina */}
                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 text-[11px] hover:bg-brand-bg/10">
                      <div className="col-span-5 text-[#2B3B4C]/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">corner</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2 text-[10px]">
                        {selectedEntry.coordinates.corner}
                      </div>
                    </div>

                    {/* Categoría */}
                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 text-[11px] hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">category</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2">
                        <span className="bg-[#2B3B4C]/10 text-[#2B3B4C] px-1.5 py-0.5 rounded-sm font-bold uppercase text-[9px]">
                          {selectedEntry.category || 'Otros'}
                        </span>
                      </div>
                    </div>

                    {/* Ancla Hito Ground Truth */}
                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 text-[11px] hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">groundtruth anchor</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2 text-[10px]" title={selectedEntry.groundedFromAnchor}>
                        {selectedEntry.groundedFromAnchor || 'N/A'}
                      </div>
                    </div>

                    {/* Custom properties key blocks if any */}
                    {currentStyles.customProps && Object.entries(currentStyles.customProps).map(([key, val]) => (
                      <div key={key} className="px-3 py-1.5 grid grid-cols-12 gap-1 text-[11px] hover:bg-[#059669]/5 bg-[#059669]/2 border-l-2 border-l-[#059669]">
                        <div className="col-span-5 text-emerald-800 font-bold text-[8.5px] uppercase tracking-wider font-mono truncate flex items-center gap-1">
                          <Tag size={8} /> {key}
                        </div>
                        <div className="col-span-7 font-mono text-brand-ink/90 border-l border-brand-line/10 pl-2 flex justify-between items-center pr-1 gap-1">
                          <span className="break-all text-[10px]">{val}</span>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCustomProperty(selectedEntry.id, key);
                            }}
                            className="text-red-500 hover:text-red-700 font-bold text-[8px] uppercase tracking-tight py-0.5 px-1 border border-red-200/40 hover:bg-red-50 rounded-xs select-none cursor-pointer shrink-0"
                            title="Eliminar propiedad"
                          >
                            X
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION 2: ATRIBUTOS URBANOS (FISIOGNOMÍA) */}
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => toggleSection('urban')}
                  className="bg-[#2B3B4C]/5 hover:bg-[#2B3B4C]/10 transition-colors uppercase font-mono font-bold text-[9px] text-[#2B3B4C]/80 px-3 py-2 flex items-center justify-between cursor-pointer w-full select-none"
                >
                  <span className="flex items-center gap-1.5">
                    <Building2 size={11} className="text-[#2B3B4C]" />
                    <span>Atributos Urbanos</span>
                  </span>
                  {openSections.urban ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {openSections.urban && (
                  <div className="bg-white divide-y divide-brand-line/5 text-[11px]">
                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">architecture style</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2">
                        {selectedEntry.microPhysiognomy?.urbanElements?.architectureStyle || 'N/A'}
                      </div>
                    </div>

                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">urban furniture</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2">
                        {selectedEntry.microPhysiognomy?.urbanElements?.furniture || 'N/A'}
                      </div>
                    </div>

                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">vegetation score</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2 flex items-center gap-1">
                        <span className="font-bold">
                          {((selectedEntry.microPhysiognomy?.urbanElements?.vegetationScore || 0) * 105).toFixed(0)}%
                        </span>
                        <span className="text-[9px] opacity-45">({selectedEntry.microPhysiognomy?.treeType || 'N/A'})</span>
                      </div>
                    </div>

                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">aerial cables</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2">
                        {selectedEntry.microPhysiognomy?.aerialCables || 'N/A'}
                      </div>
                    </div>

                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">graffiti / art</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2">
                        {selectedEntry.microPhysiognomy?.graffiti || 'N/A'}
                      </div>
                    </div>

                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">shutter style</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2">
                        {selectedEntry.microPhysiognomy?.shutterStyle || 'N/A'}
                      </div>
                    </div>

                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">terrain profile</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2">
                        {selectedEntry.microPhysiognomy?.terrain || 'N/A'}
                      </div>
                    </div>

                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">temporal window</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2 font-bold text-emerald-800">
                        {selectedEntry.microPhysiognomy?.temporalWindow || 'N/A'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: METADATOS EXIF (CÁMARA) */}
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => toggleSection('exif')}
                  className="bg-[#2B3B4C]/5 hover:bg-[#2B3B4C]/10 transition-colors uppercase font-mono font-bold text-[9px] text-[#2B3B4C]/80 px-3 py-2 flex items-center justify-between cursor-pointer w-full select-none"
                >
                  <span className="flex items-center gap-1.5">
                    <Camera size={11} className="text-blue-600" />
                    <span>Metadatos EXIF</span>
                  </span>
                  {openSections.exif ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {openSections.exif && (
                  <div className="bg-white divide-y divide-brand-line/5 text-[11px]">
                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">camera make</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2 font-bold">
                        {selectedEntry.exif?.make || 'N/A'}
                      </div>
                    </div>

                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">camera model</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2">
                        {selectedEntry.exif?.model || 'N/A'}
                      </div>
                    </div>

                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">lens model</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2 text-[10px]">
                        {selectedEntry.exif?.lensModel || 'N/A'}
                      </div>
                    </div>

                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">aperture (f-stop)</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2 font-bold">
                        {selectedEntry.exif?.fStop || 'N/A'}
                      </div>
                    </div>

                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">iso speed</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2 font-bold text-blue-750">
                        {selectedEntry.exif?.iso || 'N/A'}
                      </div>
                    </div>

                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate font-sans">shutter speed</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2">
                        {selectedEntry.exif?.shutterSpeed || 'N/A'}
                      </div>
                    </div>

                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">focal length</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2">
                        {selectedEntry.exif?.focalLength || 'N/A'}
                      </div>
                    </div>

                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">dateTimeOriginal</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2 text-[10px]">
                        {selectedEntry.exif?.dateTimeOriginal || 'N/A'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 4: RECONOCIMIENTO DE TEXTO (OCR) */}
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => toggleSection('ocr')}
                  className="bg-[#2B3B4C]/5 hover:bg-[#2B3B4C]/10 transition-colors uppercase font-mono font-bold text-[9px] text-[#2B3B4C]/80 px-3 py-2 flex items-center justify-between cursor-pointer w-full select-none"
                >
                  <span className="flex items-center gap-1.5">
                    <Type size={11} className="text-amber-600" />
                    <span>Reconocimiento OCR</span>
                  </span>
                  {openSections.ocr ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {openSections.ocr && (
                  <div className="bg-white divide-y divide-brand-line/5 text-[11px]">
                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">detected texts</div>
                      <div className="col-span-7 font-mono text-brand-ink border-l border-brand-line/10 pl-2 flex flex-wrap gap-1 pr-1">
                        {selectedEntry.ocr?.detectedText && selectedEntry.ocr.detectedText.length > 0 ? (
                          selectedEntry.ocr.detectedText.map((t, idx) => (
                            <span key={idx} className="bg-emerald-50 text-emerald-800 text-[9px] px-1 py-0.5 rounded-sm border border-emerald-500/10 font-bold break-all">
                              "{t}"
                            </span>
                          ))
                        ) : (
                          <span className="opacity-50 text-[10px]">No texts detected</span>
                        )}
                      </div>
                    </div>

                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">confidence level</div>
                      <div className="col-span-7 font-mono text-emerald-700 font-bold border-l border-brand-line/10 pl-2">
                        {((selectedEntry.ocr?.confidence || 0) * 100).toFixed(1)}%
                      </div>
                    </div>

                    <div className="px-3 py-1.5 grid grid-cols-12 gap-1 hover:bg-brand-bg/10">
                      <div className="col-span-5 text-brand-ink/60 font-medium text-[8.5px] uppercase tracking-wider font-mono truncate">rapidFuzzScore</div>
                      <div className="col-span-7 font-mono text-blue-750 font-bold border-l border-brand-line/10 pl-2">
                        {selectedEntry.ocr?.rapidFuzzScore || 0} / 100
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="p-4 text-center text-xs opacity-50 bg-[#2B3B4C]/5 border border-dashed border-brand-line/30 rounded-md">
              No hay un punto seleccionado para ver propiedades.
            </div>
          )}

          {/* Add custom key-value block */}
          {selectedEntry && (
            <div className="border border-brand-line/20 rounded-md p-3 bg-brand-bg/40 space-y-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-brand-ink/50 block font-mono">
                + Inyectar Nueva Propiedad Custom
              </span>
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="text" 
                  placeholder="Ej: estadoObras" 
                  value={newPropKey}
                  onChange={e => setNewPropKey(e.target.value)}
                  className="bg-white border border-brand-line/30 px-2 py-1 text-[11px] font-mono rounded-sm outline-none focus:border-brand-ink"
                />
                <input 
                  type="text" 
                  placeholder="Ej: Completado" 
                  value={newPropVal}
                  onChange={e => setNewPropVal(e.target.value)}
                  className="bg-white border border-brand-line/30 px-2 py-1 text-[11px] font-mono rounded-sm outline-none focus:border-brand-ink"
                />
              </div>
              <button 
                onClick={() => addCustomProperty(selectedEntry.id)}
                className="w-full flex items-center justify-center gap-1 px-3 py-1 font-mono text-[9px] uppercase font-bold bg-brand-ink text-brand-bg hover:opacity-90 transition-all rounded-sm cursor-pointer"
              >
                <Plus size={12} /> Agregar Propiedad a GeoJSON
              </button>
            </div>
          )}
        </div>

        {/* Dynamic tabs style panel */}
        <div className="bg-brand-bg border-t border-brand-line/20 shrink-0">
          <div className="flex border-b border-brand-line/20 font-mono text-[9px] uppercase tracking-wider">
            {(['styles', 'id', 'geojson', 'export'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-center font-bold tracking-widest border-r border-brand-line/10 transition-colors ${
                  activeTab === tab 
                    ? 'bg-[#2B3B4C] text-white border-b-2 border-b-[#2B3B4C]' 
                    : 'text-brand-ink/50 hover:bg-white'
                }`}
              >
                {tab === 'styles' && 'Styles (Estilos)'}
                {tab === 'id' && 'ID & Info'}
                {tab === 'geojson' && 'Contenido JSON'}
                {tab === 'export' && 'Exportar'}
              </button>
            ))}
          </div>

          <div className="p-4 bg-white min-h-0">
            {/* TABS CONTAINER */}
            {activeTab === 'styles' && selectedEntry && (
              <div className="space-y-4">
                {/* Marker color choice - custom checkable design */}
                <div>
                  <span className="text-[9px] uppercase font-bold tracking-wider text-brand-ink/60 font-mono block mb-2">
                    Marker Color (Color de Punto simple-style)
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color.hex}
                        onClick={() => updateStyle(selectedEntry.id, 'markerColor', color.hex)}
                        className={`p-1 flex items-center gap-1.5 border hover:border-brand-ink transition-all rounded-sm ${
                          currentStyles.markerColor === color.hex 
                            ? 'border-brand-ink bg-brand-bg font-bold shadow-xs' 
                            : 'border-brand-line/20 bg-transparent'
                        }`}
                        title={color.name}
                      >
                        <span className="w-3 h-3 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: color.hex }} />
                        <span className="text-[8px] truncate tracking-tighter opacity-80">{color.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Marker size choices - matching Screenshot 3 checked markers */}
                <div className="grid grid-cols-2 gap-4 pt-1 border-t border-brand-line/10 mt-2">
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-wider text-brand-ink/60 font-mono block mb-1.5">
                      Marker Size (Tamaño)
                    </span>
                    <div className="flex flex-col gap-1 text-[11px]">
                      {(['small', 'medium', 'large'] as const).map(sz => (
                        <label key={sz} className="flex items-center gap-2 cursor-pointer select-none">
                          <input 
                            type="checkbox"
                            checked={currentStyles.markerSize === sz}
                            onChange={() => updateStyle(selectedEntry.id, 'markerSize', sz)}
                            className="rounded-xs text-brand-ink accent-brand-ink border-brand-line/40 h-3.5 w-3.5"
                          />
                          <span className={`capitalize font-mono text-[10px] ${currentStyles.markerSize === sz ? 'font-bold text-[#2B3B4C]' : 'opacity-60'}`}>
                            {sz} ({sz === 'small' ? 'P' : sz === 'medium' ? 'M' : 'G'})
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-wider text-brand-ink/60 font-mono block mb-1.5">
                      Marker Symbol (Símbolo)
                    </span>
                    <div className="flex flex-col gap-1 text-[11px]">
                      {(['circle', 'star', 'pin'] as const).map(sym => (
                        <label key={sym} className="flex items-center gap-2 cursor-pointer select-none">
                          <input 
                            type="checkbox"
                            checked={currentStyles.markerSymbol === sym}
                            onChange={() => updateStyle(selectedEntry.id, 'markerSymbol', sym)}
                            className="rounded-xs text-brand-ink accent-brand-ink border-brand-line/40 h-3.5 w-3.5"
                          />
                          <span className={`capitalize font-mono text-[10px] ${currentStyles.markerSymbol === sym ? 'font-bold text-[#2B3B4C]' : 'opacity-60'}`}>
                            {sym}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'id' && selectedEntry && (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b pb-1">
                  <span className="text-brand-ink/50 uppercase font-bold font-mono text-[9px]">Ubicación ID:</span>
                  <span className="font-mono font-bold">{selectedEntry.id}</span>
                </div>
                <div className="flex justify-between border-b pb-1 mt-1">
                  <span className="text-brand-ink/50 uppercase font-bold font-mono text-[9px]">Latitud:</span>
                  <span className="font-mono">{selectedEntry.coordinates.lat.toFixed(7)}</span>
                </div>
                <div className="flex justify-between border-b pb-1 mt-1">
                  <span className="text-brand-ink/50 uppercase font-bold font-mono text-[9px]">Longitud:</span>
                  <span className="font-mono">{selectedEntry.coordinates.lng.toFixed(7)}</span>
                </div>
                <div className="flex justify-between border-b pb-1 mt-1">
                  <span className="text-brand-ink/50 uppercase font-bold font-mono text-[9px]">H3 Index (Res 9):</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {selectedEntry.validation?.h3Index || 'N/A'}
                  </span>
                </div>
                <div className="mt-2 bg-brand-bg p-2 text-[10px] leading-relaxed text-[#2B3B4C] border border-brand-line/15 rounded-sm">
                  <span className="font-bold">Referencia de Ingeniería Inversa:</span>
                  <p className="mt-0.5 opacity-85">
                    Este punto representa una muestra geocodificada resuelta bajo la técnica de cascada con un weighted scoring de{' '}
                    <strong className="text-emerald-700 font-bold">{selectedEntry.validation?.computedScore || 0}%</strong>.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'geojson' && (
              <div className="space-y-2 h-full flex flex-col">
                <div className="flex justify-between items-center shrink-0">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-brand-ink/50 font-mono">
                    GeoJSON FeatureCollection Actualizado
                  </span>
                  <button 
                    onClick={handleCopy}
                    className="flex items-center gap-1 font-mono text-[9px] bg-brand-ink hover:opacity-90 transition-all text-brand-bg px-2 py-0.5 rounded-sm"
                  >
                    {copySuccess ? <Check size={10} /> : <Copy size={10} />}
                    {copySuccess ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={JSON.stringify(geoJsonData, null, 2)}
                  className="flex-1 min-h-[140px] xl:min-h-[180px] w-full bg-[#1A2530] text-emerald-400 font-mono text-[9px] p-3 rounded-sm border border-brand-line/30 select-all outline-none resize-none focus:border-brand-ink"
                />
              </div>
            )}

            {activeTab === 'export' && (
              <div className="space-y-4">
                <p className="text-xs text-brand-ink/75 leading-relaxed">
                  Exporta la información geocodificada en formato GeoJSON interactivo. El archivo es completamente compatible con visores GIS (como QGIS), bases de datos y Mapbox.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white font-mono text-xs uppercase font-bold tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-xs rounded-xs"
                  >
                    <Download size={14} /> Descargar .geojson
                  </button>
                  <button
                    onClick={openExternalGeoJsonIo}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#2B3B4C] text-white font-mono text-xs uppercase font-bold tracking-wider hover:opacity-95 active:scale-95 transition-all shadow-xs rounded-xs"
                  >
                    <ExternalLink size={14} /> Abrir geojson.io ↗
                  </button>
                </div>

                <div className="p-3 bg-brand-bg border border-brand-line/10 text-[10px] leading-relaxed italic opacity-85 rounded-xs mt-2">
                  <strong>💡 Tip Pro:</strong> Puedes hacer clic en "Abrir geojson.io", copiar nuestro bloque GeoJSON desde la pestaña "Contenido JSON" y pegarlo directo en el editor de Mapbox para obtener vistas satelitales 3D e informes personalizados en segundos!
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
