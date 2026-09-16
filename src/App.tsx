/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

import { 
  Database, 
  MapPin, 
  Sun, 
  Camera, 
  Download, 
  Play, 
  Loader2, 
  ChevronRight, 
  X,
  FileJson,
  Layers,
  Hexagon,
  ShieldCheck,
  Zap,
  LayoutGrid,
  FileText,
  Clock,
  Search,
  AlertTriangle,
  Info,
  BarChart3 as ChartIcon
, Folder, Save, HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateDatasetBatch, geocodeLocation, parseLocations, validateGeocoordinatesBatch, DatasetEntry, getGeographySuggestions, isSpendingCapExceeded, researchLocationAnchors, LocationAnchor } from './services/geminiService';
import MapComponent from './components/MapComponent';
import StatisticsView from './components/StatisticsView';
import GeoJsonPlayground from './components/GeoJsonPlayground';
import * as h3 from 'h3-js';

// Weights from "Guía de Programación: Ingeniería Inversa Geográfica"
const WEIGHTS = {
  OCR: 40,
  MICRO_PHYSIOGNOMY: 20,
  VEGETATION: 15,
  ARCHITECTURE: 15,
  EXIF: 10
};

// Haversine distance in meters
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface SavedDataset {
  id: string;
  location: string;
  sampleCount: number;
  timestamp: string;
  entries: DatasetEntry[];
  anchors?: LocationAnchor[];
}

export default function App() {
  const [entries, setEntries] = useState<DatasetEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<DatasetEntry | null>(null);
  const [viewMode, setViewMode] = useState<'dataset' | 'analysis' | 'stats' | 'geojson'>('dataset');
  const [geofence, setGeofence] = useState<string[]>([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [anchors, setAnchors] = useState<LocationAnchor[]>([]);
  
  const [savedDatasets, setSavedDatasets] = useState<SavedDataset[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem('saved_datasets');
      if (stored) {
        setSavedDatasets(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load saved datasets", e);
    }
  }, []);

  const loadSavedDataset = (dataset: SavedDataset) => {
    setEntries(dataset.entries);
    setAnchors(dataset.anchors || []);
    setLocation(dataset.location);
    setSampleCount(dataset.sampleCount);
    setForcedMapCenter(undefined);
    setViewMode('dataset');
    setErrorNotification(`Colección: Dataset "${dataset.location}" cargado desde almacenamiento local - Costo $0!`);
  };

  const deleteSavedDataset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedDatasets.filter(d => d.id !== id);
    setSavedDatasets(updated);
    localStorage.setItem('saved_datasets', JSON.stringify(updated));
  };

  const handleSaveCurrentDataset = (customName?: string) => {
    if (entries.length === 0) return;
    
    const finalName = customName || location || 'Colección Manual';
    const newSaved: SavedDataset = {
      id: `ds_${Date.now()}`,
      location: finalName,
      sampleCount: entries.length,
      timestamp: new Date().toLocaleString('es-ES', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      entries: entries,
      anchors: anchors
    };
    
    setSavedDatasets(prev => {
      const updated = [newSaved, ...prev.filter(d => d.location.toLowerCase().trim() !== newSaved.location.toLowerCase().trim())].slice(0, 50);
      try {
        localStorage.setItem('saved_datasets', JSON.stringify(updated));
        setErrorNotification(`Éxito: Colección para "${newSaved.location}" archivada con éxito en historia local.`);
      } catch (err) {
        console.error("Could not write saved_datasets to local storage", err);
      }
      return updated;
    });
  };
  const [forcedMapCenter, setForcedMapCenter] = useState<[number, number] | undefined>(undefined);

  // Logic to handle selection from map and switch view
  const handleSelectFromMap = (entry: DatasetEntry) => {
    if (isDrawingMode) return; // Don't switch view if drawing
    setSelectedEntry(entry);
    setViewMode('dataset');
  };

  // Auto-scroll to selected card when view changes or selection changes
  useEffect(() => {
    if (selectedEntry && viewMode === 'dataset') {
      // Small timeout to ensure DOM is ready if view just switched
      const timer = setTimeout(() => {
        const element = document.getElementById(`card-${selectedEntry.id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedEntry, viewMode]);
  const [showH3Layer, setShowH3Layer] = useState(true);
  const [h3Opacity, setH3Opacity] = useState(0.4);
  
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  
  // Validation status logic
  const exifDuplicates = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach(e => {
      const sig = `${e.exif.make}-${e.exif.model}-${e.exif.lensModel}-${e.exif.dateTimeOriginal}`;
      counts.set(sig, (counts.get(sig) || 0) + 1);
    });
    return counts;
  }, [entries]);

  const getValidationIssues = useCallback((entry: DatasetEntry) => {
    const issues: string[] = [];
    const score = calculateScore(entry);
    
    if (score < 45) issues.push('Baja confianza total (<45pts)');
    if (entry.ocr.rapidFuzzScore < 30) issues.push('OCR poco fiable (RapidFuzz bajo)');
    if (entry.microPhysiognomy.urbanElements.vegetationScore < 0.2) issues.push('Entorno botánico genérico');
    if (entry.ocr.detectedText.length === 0) issues.push('Sin evidencia de texto (OCR null)');
    
    const sig = `${entry.exif.make}-${entry.exif.model}-${entry.exif.lensModel}-${entry.exif.dateTimeOriginal}`;
    if ((exifDuplicates.get(sig) || 0) > 1) {
      issues.push('Metadatos EXIF duplicados (Baja varianza)');
    }

    if (entry.validation?.isOutlier) {
      issues.push(`Anomalía Geográfica (Desvío de ${Math.round(entry.validation.distanceFromCenter)}m)`);
    }

    if (entry.validation?.cornerMismatch) {
      issues.push(`Inconsistencia Geográfica: ${entry.validation.suspiciousReason || 'Intersección o coordenadas inválidas para la zona.'}`);
    }
    
    return issues;
  }, [exifDuplicates]);

  // Configuration states
  const [location, setLocation] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [activeLocationFilter, setActiveLocationFilter] = useState<string | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none');
  const [sampleCount, setSampleCount] = useState(30);
  const [history, setHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('geocoding_history');
    return saved ? JSON.parse(saved) : ['Manhattan, NY; Brooklyn, NY', 'Berlin, Germany', 'Shibuya, Tokyo; Shinjuku, Tokyo'];
  });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasPaidKey, setHasPaidKey] = useState(false);
  const [showCostWarning, setShowCostWarning] = useState(false);

  // Check for paid API key on mount
  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasPaidKey(hasKey);
      }
    };
    checkApiKey();
  }, []);

  const handleSelectApiKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasPaidKey(true);
    }
  };

  // Derived filtered entries
  const filteredEntries = useMemo(() => {
    let result = [...entries];
    if (activeLocationFilter) {
      result = result.filter(e => e.locationContext === activeLocationFilter);
    }
    if (activeCategoryFilter) {
      result = result.filter(e => e.category === activeCategoryFilter);
    }
    
    if (sortOrder === 'asc') {
      result.sort((a, b) => (a.validation?.computedScore || 0) - (b.validation?.computedScore || 0));
    } else if (sortOrder === 'desc') {
      result.sort((a, b) => (b.validation?.computedScore || 0) - (a.validation?.computedScore || 0));
    }
    
    return result;
  }, [entries, activeLocationFilter, activeCategoryFilter, sortOrder]);

  // Unique session locations for the filter bar
  const sessions = useMemo(() => {
    const locs = Array.from(new Set(entries.map(e => e.locationContext).filter((l): l is string => !!l)));
    return locs;
  }, [entries]);

  // Unique categories for the filter bar
  const categories = useMemo(() => {
    const cats = Array.from(new Set(entries.map(e => e.category).filter((c): c is string => !!c)));
    return cats.sort();
  }, [entries]);

  // Derivations for clustering
  const h3Clusters = useMemo(() => {
    const mapping: Record<string, number> = {};
    entries.forEach(e => {
      const h3Idx = h3.latLngToCell(e.coordinates.lat, e.coordinates.lng, 9);
      mapping[h3Idx] = (mapping[h3Idx] || 0) + 1;
    });
    return mapping;
  }, [entries]);

  const visibleHistory = useMemo(() => history.filter(h => h.toLowerCase().includes(location.toLowerCase())), [history, location]);
  const dropdownOptions = useMemo(() => [...visibleHistory, ...suggestions], [visibleHistory, suggestions]);

  // Suggestions logic
  useEffect(() => {
    const timer = setTimeout(async () => {
      const parts = location.split(';');
      const currentQuery = parts[parts.length - 1].trim();

      if (currentQuery.length >= 3) {
        setIsSearching(true);
        try {
          const results = await getGeographySuggestions(currentQuery);
          if (isSpendingCapExceeded) {
            setErrorNotification("Presupuesto agotado en AI Studio. Favor revise su 'Spending Cap' en ai.studio/spend.");
            setSuggestions([]);
          } else {
            setSuggestions(results);
          }
        } catch (e: any) {
          const errorStr = String(e.message || e);
          if (errorStr.includes("EXCEEDED_SPENDING_CAP")) {
            setErrorNotification("Presupuesto agotado en AI Studio. Favor revise su 'Spending Cap' en ai.studio/spend.");
          }
          setSuggestions([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSuggestions([]);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [location]);

  const addToHistory = (loc: string) => {
    if (!loc.trim()) return;
    const newHistory = [loc, ...history.filter(h => h !== loc)].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('geocoding_history', JSON.stringify(newHistory));
  };

  const handleLocateOnMap = async (name?: string) => {
    const locToFind = name || location.split(';').pop()?.trim() || location;
    if (!locToFind) return;

    setIsSearching(true);
    try {
      const coords = await geocodeLocation(locToFind);
      if (coords) {
        setForcedMapCenter([coords.lat, coords.lng]);
        setViewMode('analysis');
      }
    } catch (e) {
      console.error("Geocoding failed:", e);
    } finally {
      setIsSearching(false);
    }
  };

  const generateFullDataset = async () => {
    setIsGenerating(true);
    setProgress(0);

    addToHistory(location);
    
    const totalNeeded = sampleCount;
    let allEntries: DatasetEntry[] = [...entries];
    const initialGlobalIndex = entries.length;

    try {
      const locationList = await parseLocations(location);
      if (isSpendingCapExceeded) {
        setErrorNotification("Presupuesto agotado en AI Studio. Favor revise su 'Spending Cap' en ai.studio/spend.");
        setIsGenerating(false);
        return;
      }
      if (locationList.length === 0) {
        setIsGenerating(false);
        return;
      }
      
      const samplesPerLocation = Math.ceil(totalNeeded / locationList.length);

      for (let lIdx = 0; lIdx < locationList.length; lIdx++) {
        const currentLoc = locationList[lIdx];
        const locStartIdx = initialGlobalIndex + (lIdx * samplesPerLocation);
        
        // Number of samples for this specific location (last one takes the remainder)
        const locSamples = (lIdx === locationList.length - 1) 
          ? (totalNeeded - (lIdx * samplesPerLocation)) 
          : samplesPerLocation;

        if (locSamples <= 0) continue;

        // FASE DE INVESTIGACIÓN: Obtener anclas reales para fundamentar el dataset
        const newAnchors = await researchLocationAnchors(currentLoc, hasPaidKey);
        setAnchors(prev => [...prev, ...newAnchors]);
        console.log(`Anclando dataset en ${currentLoc} con ${newAnchors.length} hitos reales.`);

        // CACHE LOGIC: Check if this exact zone and sample count was requested before
        // Skip cache if geofence is active to ensure custom area generation
        const cacheKey = `dataset_cache_${currentLoc.toLowerCase().trim()}_${locSamples}`;
        if (geofence.length === 0) {
          try {
            const cachedString = localStorage.getItem(cacheKey);
            if (cachedString) {
              const cachedItems: DatasetEntry[] = JSON.parse(cachedString);
              if (Array.isArray(cachedItems) && cachedItems.length === locSamples) {
                // Map old IDs to valid sequential index for the current state
                const validCachedItems = cachedItems.map((item, idx) => ({
                  ...item,
                  id: `REF-${(locStartIdx + idx + 1).toString().padStart(4, '0')}`
                }));
                allEntries = [...allEntries, ...validCachedItems];
                setEntries(allEntries);
                setActiveLocationFilter(currentLoc);
                setProgress(Math.min(100, Math.round(((lIdx * samplesPerLocation) + locSamples) / totalNeeded * 100)));
                continue; // Skip API calls for this cached location
              }
            }
          } catch (e) {
            console.error("Failed to read dataset cache", e);
          }
        }

        // Geocode central coordinate first
        const centerCoord = await geocodeLocation(currentLoc);
        if (isSpendingCapExceeded) {
          setErrorNotification("Presupuesto agotado en AI Studio. Favor revise su 'Spending Cap' en ai.studio/spend.");
          setIsGenerating(false);
          return;
        }

        const batchSize = 30;
        let locItemsToCache: DatasetEntry[] = [];

          for (let i = 0; i < locSamples; i += batchSize) {
            const currentBatchSize = Math.min(batchSize, locSamples - i);

            // Si hay geovalla, usamos celdas H3. Si no, usamos las anclas reales investigadas.
            let customCenters: {lat: number, lng: number}[] | null = null;
            if (geofence.length > 0) {
              customCenters = [];
              for (let j = 0; j < currentBatchSize; j++) {
                const cell = geofence[Math.floor(Math.random() * geofence.length)];
                const [lat, lng] = h3.cellToLatLng(cell);
                customCenters.push({
                  lat: lat + (Math.random() - 0.5) * 0.001,
                  lng: lng + (Math.random() - 0.5) * 0.001
                });
              }
            } else if (newAnchors.length > 0) {
              customCenters = [];
              for (let j = 0; j < currentBatchSize; j++) {
                // Ciclar a través de los hitos reales para crear clusters alrededor de ellos
                const anchor = newAnchors[j % newAnchors.length];
                customCenters.push({
                  lat: anchor.lat + (Math.random() - 0.5) * 0.0008,
                  lng: anchor.lng + (Math.random() - 0.5) * 0.0008
                });
              }
            }

            const batch = await generateDatasetBatch(currentBatchSize, locStartIdx + i + 1, currentLoc, centerCoord, hasPaidKey, 3, customCenters || undefined, newAnchors);
          
          if (isSpendingCapExceeded) {
             setErrorNotification("Presupuesto agotado en AI Studio. Favor revise su 'Spending Cap' en ai.studio/spend.");
             setIsGenerating(false);
             return;
          }

          let uniqueBatch = batch.map((item, idx) => {
            let validation: DatasetEntry['validation'] = undefined;
            if (centerCoord && item.coordinates) {
              const dist = getDistanceInMeters(centerCoord.lat, centerCoord.lng, item.coordinates.lat, item.coordinates.lng);
              validation = {
                distanceFromCenter: dist,
                isOutlier: dist > 150
              };
            }

            const id = `REF-${(locStartIdx + i + idx + 1).toString().padStart(4, '0')}`;
            return {
              ...item,
              id,
              locationContext: currentLoc,
              validation
            };
          });

          // Validate corners globally with LLM
          const cornerMismatchValidation = await validateGeocoordinatesBatch(uniqueBatch, currentLoc, hasPaidKey);
          
          if (isSpendingCapExceeded) {
             setErrorNotification("Presupuesto agotado en AI Studio. Favor revise su 'Spending Cap' en ai.studio/spend.");
             setIsGenerating(false);
             return;
          }

          uniqueBatch = uniqueBatch.map(item => {
            const resultItem = { ...item };
            if (cornerMismatchValidation[item.id]) {
              resultItem.validation = {
                ...item.validation!,
                cornerMismatch: cornerMismatchValidation[item.id].isMismatch,
                suspiciousReason: cornerMismatchValidation[item.id].reason
              };
            }
            
            // Pre-calculate score and issues
            const score = calculateScore(resultItem);
            const issues = getValidationIssues(resultItem);
            const h3Idx = h3.latLngToCell(resultItem.coordinates.lat, resultItem.coordinates.lng, 9);
            
            resultItem.validation = {
              ...resultItem.validation!,
              computedScore: score,
              issues,
              h3Index: h3Idx
            };

            return resultItem;
          });

          allEntries = [...allEntries, ...uniqueBatch];
          locItemsToCache = [...locItemsToCache, ...uniqueBatch];
          setEntries(allEntries);
          setActiveLocationFilter(currentLoc); // Auto-focus the new search
          
          // Progress calculation based on total work
          const totalProcessed = (lIdx * samplesPerLocation) + i + currentBatchSize;
          setProgress(Math.min(100, Math.round((totalProcessed / totalNeeded) * 100)));

          // Add a pause between requests to respect API rate limits (15 RPM for free tier)
          if (i + currentBatchSize < locSamples || lIdx < locationList.length - 1) {
            const waitTime = hasPaidKey ? 800 : 4500;
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }

        // --- WRITE CACHE ---
        try {
          if (locItemsToCache.length === locSamples) {
            localStorage.setItem(cacheKey, JSON.stringify(locItemsToCache));
          }
        } catch (e) {
          console.error("Cache write error (could be quota exceeded)", e);
        }
      }

      // Automatically archive completed datasets
      if (allEntries.length > 0) {
        const newSaved: SavedDataset = {
          id: `ds_${Date.now()}`,
          location: location,
          sampleCount: allEntries.length,
          timestamp: new Date().toLocaleString('es-ES', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          entries: allEntries,
          anchors: anchors
        };
        setSavedDatasets(prev => {
          const updated = [newSaved, ...prev.filter(d => d.location.toLowerCase().trim() !== location.toLowerCase().trim())].slice(0, 50);
          try {
            localStorage.setItem('saved_datasets', JSON.stringify(updated));
          } catch (e) {
            console.error("Could not write saved_datasets on autoguard", e);
          }
          return updated;
        });
      }
    } catch (error: any) {
      console.error("Critical failure during dataset generation:", error);
      const errorStr = typeof error === 'object' ? JSON.stringify(error) + " " + String(error.message) : String(error);
      
      if (errorStr.includes("EXCEEDED_SPENDING_CAP")) {
        setErrorNotification("Presupuesto agotado en AI Studio. Favor revise su 'Spending Cap' en ai.studio/spend.");
      } else if (error?.status === 429 || errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("Max retries reached") || errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("Quota")) {
        setErrorNotification("Cuota de la API agotada o límite de tasa excedido. Favor reduzca la muestra o espere 1 minuto.");
      } else {
        setErrorNotification("Error en la generación. Revise conexión o API Key.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const clearDataset = () => {
    setEntries([]);
  };

  const calculateScore = useCallback((entry: DatasetEntry) => {
    let score = 0;
    
    // OCR Logic (Puntos si hay texto detectado y confianza alta)
    if (entry.ocr.detectedText.length > 0) {
      score += (entry.ocr.rapidFuzzScore / 100 * WEIGHTS.OCR);
    }

    // Micro-physiognomy (Puntos por elementos urbanos detectados)
    if (entry.microPhysiognomy.urbanElements.furniture) {
      score += WEIGHTS.MICRO_PHYSIOGNOMY;
    }

    // Vegetation (Basado en el vegetationScore generado por el experto)
    score += (entry.microPhysiognomy.urbanElements.vegetationScore * WEIGHTS.VEGETATION);

    // Architecture
    if (entry.microPhysiognomy.urbanElements.architectureStyle) {
      score += WEIGHTS.ARCHITECTURE;
    }

    // EXIF Consistency (Siempre presente en nuestro dataset sintético)
    score += WEIGHTS.EXIF;

    return Math.round(score);
  }, []);

  const downloadFileWithPicker = async (contentStr: string, defaultFileName: string, mimeType: string, extension: string) => {
    try {
      if ('showSaveFilePicker' in window) {
        const opts = {
          suggestedName: defaultFileName,
          types: [{
            description: 'Archivo de Datos',
            accept: { [mimeType]: [extension] },
          }],
        };
        // @ts-ignore
        const handle = await window.showSaveFilePicker(opts);
        const writable = await handle.createWritable();
        await writable.write(contentStr);
        await writable.close();
        return;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.warn('showSaveFilePicker falló, usando método alternativo', err);
    }
    
    // Fallback if API not available or failed
    const blob = new Blob([contentStr], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', url);
    linkElement.setAttribute('download', defaultFileName);
    document.body.appendChild(linkElement);
    linkElement.click();
    document.body.removeChild(linkElement);
    URL.revokeObjectURL(url);
  };

  const exportToJson = async () => {
    const dataWithAnalysis = entries.map(e => ({
      ...e,
      h3Index: h3.latLngToCell(e.coordinates.lat, e.coordinates.lng, 9),
      geocodingScore: calculateScore(e),
      isAnchor: calculateScore(e) >= 85
    }));

    const dataStr = JSON.stringify(dataWithAnalysis, null, 2);
    
    const slug = location.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_{2,}/g, '_')
      .slice(0, 30);
    const exportFileDefaultName = `dataset_${slug || 'reverse_geocoding'}.json`;

    await downloadFileWithPicker(dataStr, exportFileDefaultName, 'application/json', '.json');
  };

  const exportToCsv = async () => {
    if (entries.length === 0) return;

    // Helper to flatten nested object
    const flatten = (obj: any, prefix = ''): Record<string, any> => {
      let result: Record<string, any> = {};
      for (const key in obj) {
        const propName = prefix ? `${prefix}_${key}` : key;
        if (Array.isArray(obj[key])) {
          result[propName] = obj[key].join('; ');
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          Object.assign(result, flatten(obj[key], propName));
        } else {
          result[propName] = obj[key];
        }
      }
      return result;
    };

    const dataWithAnalysis = entries.map(e => ({
      ...e,
      h3Index: h3.latLngToCell(e.coordinates.lat, e.coordinates.lng, 9),
      geocodingScore: calculateScore(e),
      isAnchor: calculateScore(e) >= 85
    }));

    const rows = dataWithAnalysis.map(entry => flatten(entry));
    const headers = Object.keys(rows[0]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(header => {
        const val = row[header];
        const stringVal = val === undefined || val === null ? '' : String(val);
        if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
          return `"${stringVal.replace(/"/g, '""')}"`;
        }
        return stringVal;
      }).join(','))
    ].join('\n');

    const slug = location.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_{2,}/g, '_')
      .slice(0, 30);
    const exportFileDefaultName = `dataset_${slug || 'reverse_geocoding'}.csv`;

    await downloadFileWithPicker(csvContent, exportFileDefaultName, 'text/csv', '.csv');
  };

  const exportToGeoJson = async () => {
    if (entries.length === 0) return;

    const geoJson = {
      type: "FeatureCollection",
      features: entries.map(entry => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [entry.coordinates.lng, entry.coordinates.lat]
        },
        properties: {
          ...entry,
          h3Index: h3.latLngToCell(entry.coordinates.lat, entry.coordinates.lng, 9),
          geocodingScore: calculateScore(entry),
          isAnchor: calculateScore(entry) >= 85
        }
      }))
    };

    const dataStr = JSON.stringify(geoJson, null, 2);
    
    const slug = location.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_{2,}/g, '_')
      .slice(0, 30);
    const exportFileDefaultName = `dataset_${slug || 'reverse_geocoding'}.geojson`;

    await downloadFileWithPicker(dataStr, exportFileDefaultName, 'application/geo+json', '.geojson');
  };

  const checkCostAndGenerate = async () => {
    if (hasPaidKey) {
      // Fast check if everything is fully cached
      const locationList = location.split(';').map(l => l.trim()).filter(l => l);
      if (locationList.length === 0) {
        generateFullDataset();
        return;
      }
      const samplesPerLocation = Math.ceil(sampleCount / locationList.length);
      let allCached = true;
      for (let lIdx = 0; lIdx < locationList.length; lIdx++) {
        const currentLoc = locationList[lIdx];
        const locSamples = (lIdx === locationList.length - 1) 
          ? (sampleCount - (lIdx * samplesPerLocation)) 
          : samplesPerLocation;
        
        if (locSamples > 0) {
          const cacheKey = `dataset_cache_${currentLoc.toLowerCase().trim()}_${locSamples}`;
          const cachedString = localStorage.getItem(cacheKey);
          if (!cachedString) {
            allCached = false;
            break;
          } else {
            try {
              const cachedData = JSON.parse(cachedString);
              if (!Array.isArray(cachedData) || cachedData.length !== locSamples) {
                allCached = false;
                break;
              }
            } catch {
              allCached = false;
              break;
            }
          }
        }
      }

      if (allCached) {
        // Bypass warning since it will be instant and cost $0
        generateFullDataset();
      } else {
        setShowCostWarning(true);
      }
    } else {
      generateFullDataset();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showHistory && e.key === 'ArrowDown') {
      setShowHistory(true);
      return;
    }

    if (!showHistory) {
      if (e.key === 'Enter') {
        checkCostAndGenerate();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, dropdownOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < dropdownOptions.length) {
        const selectedOption = dropdownOptions[selectedIndex];
        if (selectedIndex < visibleHistory.length) {
          setLocation(selectedOption);
        } else {
          const parts = location.split(';');
          parts[parts.length - 1] = ' ' + selectedOption;
          setLocation(parts.join(';').trim());
        }
        setShowHistory(false);
        setSelectedIndex(-1);
      } else {
        checkCostAndGenerate();
        setShowHistory(false);
      }
    } else if (e.key === 'Escape') {
      setShowHistory(false);
      setSelectedIndex(-1);
    }
  };

  return (
    <div className="h-screen max-h-screen overflow-hidden flex flex-col font-mono text-brand-ink selection:bg-brand-ink selection:text-brand-bg min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden">
      {/* Header */}
      <header className="border-b border-brand-line p-6 flex flex-col 2xl:flex-row justify-between items-start 2xl:items-end bg-brand-bg sticky top-0 z-40 gap-4 flex-wrap">
        <div className="w-full 2xl:w-auto">
          <h1 
            onClick={() => window.location.reload()}
            className="text-3xl font-serif italic font-bold tracking-tight mb-2 cursor-pointer hover:opacity-80 transition-opacity inline-block"
            title="Volver al inicio"
          >
            REVERSE-GEOCODING <span className="not-italic font-sans text-xl opacity-50 ml-2 pointer-events-none">CORE ENGINE / V.02</span>
          </h1>
          <div className="flex flex-col gap-1">
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-60 max-w-md leading-relaxed">
              Analizador de Micro-fisionomía Urbana y Consenso de Atributos.
            </p>
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mt-2 mb-2 relative flex-wrap">
              <div className="flex items-center gap-2 border-l-2 border-brand-line pl-3">
                <span className="text-[10px] uppercase tracking-widest opacity-60 whitespace-nowrap">
                  Describe zona o ubicaciones múltiples:
                </span>
                <div className="relative group">
                  <input 
                    type="text" 
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      setSelectedIndex(-1);
                      setShowHistory(true);
                      setForcedMapCenter(undefined);
                    }}
                    onFocus={() => setShowHistory(true)}
                    onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ej: Barrio Piñeiro, Avellaneda o Rosario, CABA"
                    className="bg-transparent border-b border-brand-line/20 focus:border-brand-line outline-none text-xs py-0.5 font-bold italic w-40 md:w-56 transition-colors"
                  />
                  <button 
                    onClick={() => handleLocateOnMap()}
                    disabled={isSearching}
                    className="ml-2 p-1 hover:bg-brand-ink hover:text-brand-bg transition-colors rounded-full"
                    title="Localizar en mapa"
                  >
                    {isSearching && location.length > 0 ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                  </button>
                  <AnimatePresence>
                    {showHistory && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 w-full bg-brand-bg border border-brand-line z-50 shadow-2xl mt-1 overflow-hidden"
                      >
                        {/* History Section */}
                        {visibleHistory.length > 0 && (
                          <div className="bg-brand-ink/5 p-2 border-b border-brand-line/10">
                            <span className="text-[8px] uppercase tracking-widest opacity-40 px-2 flex items-center gap-1">
                              <Clock size={10} /> Historial
                            </span>
                            {visibleHistory.map((h, i) => (
                              <button
                                key={`hist-${i}`}
                                onClick={() => {
                                  setLocation(h);
                                  setShowHistory(false);
                                  setSelectedIndex(-1);
                                  handleLocateOnMap(h);
                                }}
                                className={`w-full text-left px-4 py-2 text-[10px] transition-colors ${selectedIndex === i ? 'bg-brand-ink text-brand-bg' : 'hover:bg-brand-ink/10'}`}
                              >
                                {h}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Suggestions Section */}
                        <div className="p-2">
                          <span className="text-[8px] uppercase tracking-widest opacity-40 px-2 flex items-center gap-1">
                            <Search size={10} /> {isSearching ? "Buscando geografía..." : "Sugerencias IA"}
                          </span>
                          {suggestions.map((s, i) => {
                            const globalIndex = visibleHistory.length + i;
                            return (
                              <button
                                key={`sug-${i}`}
                                onClick={() => {
                                  const parts = location.split(';');
                                  parts[parts.length - 1] = ' ' + s;
                                  const newLoc = parts.join(';').trim();
                                  setLocation(newLoc);
                                  setShowHistory(false);
                                  setSelectedIndex(-1);
                                  handleLocateOnMap(s);
                                }}
                                className={`w-full text-left px-4 py-2 text-[10px] font-bold transition-colors border-b border-brand-line/5 last:border-0 ${selectedIndex === globalIndex ? 'bg-brand-ink text-brand-bg' : 'hover:bg-brand-ink/10'}`}
                              >
                                {s}
                              </button>
                            );
                          })}
                          {location.length >= 3 && !isSearching && suggestions.length === 0 && (
                            <div className="px-4 py-3 text-[9px] italic opacity-40">
                              No se encontraron sugerencias adicionales para esta zona.
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="flex items-center gap-2 border-l-2 border-brand-line pl-3">
                <span className="text-[10px] uppercase tracking-widest opacity-60 whitespace-nowrap">
                  Muestras:
                </span>
                <select 
                  value={sampleCount} 
                  onChange={(e) => setSampleCount(Number(e.target.value))}
                  className="bg-transparent border-b border-brand-line/20 outline-none text-xs font-bold py-0.5 cursor-pointer hover:border-brand-line transition-colors"
                >
                  <option value={10}>10</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={80}>80</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-row flex-wrap gap-4 w-full 2xl:w-auto items-stretch 2xl:items-end justify-start 2xl:justify-end">
          <button 
            onClick={handleSelectApiKey}
            className={`flex items-center justify-center gap-2 border px-4 py-2 transition-colors text-[10px] uppercase rounded-sm ${
              hasPaidKey 
                ? 'bg-emerald-600/10 border-emerald-600/30 text-emerald-600' 
                : 'border-brand-line hover:bg-brand-ink hover:text-brand-bg opacity-70'
            }`}
            title={hasPaidKey ? "API Key de Pago Activa" : "Configurar API Key de Pago"}
          >
            <Zap size={14} className={hasPaidKey ? "fill-emerald-600" : ""} />
            {hasPaidKey ? "Clave Paga Detectada" : "Usar API Paga (Opcional)"}
          </button>

          {entries.length > 0 && !isGenerating && (
            <div className="flex border border-brand-line overflow-hidden rounded-sm mr-0 md:mr-2">
              <button 
                onClick={() => setViewMode('dataset')}
                className={`flex-1 md:flex-none px-4 py-2 text-[10px] uppercase tracking-wider transition-colors ${viewMode === 'dataset' ? 'bg-brand-ink text-brand-bg' : 'hover:bg-brand-ink/10'}`}
              >
                Dataset
              </button>
              <button 
                onClick={() => setViewMode('analysis')}
                className={`flex-1 md:flex-none px-4 py-2 text-[10px] uppercase tracking-wider transition-colors ${viewMode === 'analysis' ? 'bg-brand-ink text-brand-bg' : 'hover:bg-brand-ink/10'}`}
              >
                Logica
              </button>
              <button 
                onClick={() => setViewMode('stats')}
                className={`flex-1 md:flex-none px-4 py-2 text-[10px] uppercase tracking-wider transition-colors ${viewMode === 'stats' ? 'bg-brand-ink text-brand-bg' : 'hover:bg-brand-ink/10'}`}
              >
                Stats
              </button>
              <button 
                onClick={() => setViewMode('geojson')}
                className={`flex-1 md:flex-none px-4 py-2 text-[10px] uppercase tracking-wider transition-colors ${viewMode === 'geojson' ? 'bg-brand-ink text-brand-bg' : 'hover:bg-brand-ink/10'}`}
              >
                geojson.io
              </button>
            </div>
          )}
          
          <div className="flex gap-2">
            {entries.length > 0 && !isGenerating && (
              <button 
                onClick={() => { setSaveName(location || 'Colección Manual'); setShowSaveModal(true); }}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-ink text-brand-bg hover:bg-brand-ink/90 transition-colors text-xs uppercase font-bold shadow-sm rounded-sm"
              >
                <Save size={14} />
                Guardar / Exportar
              </button>
            )}
            <button 
              id="generate-btn"
              onClick={checkCostAndGenerate}
              disabled={isGenerating}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 border border-brand-line px-6 py-2 transition-colors text-xs uppercase ${
                isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-brand-ink hover:text-brand-bg'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {progress}%
                </>
              ) : (
                <>
                  <Play size={14} />
                  {entries.length > 0 ? 'Ampliar Dataset' : 'Entrenar'}
                </>
              )}
            </button>
            {entries.length > 0 && !isGenerating && (
              <div className="flex gap-2 shrink-0">
                <button 
                  onClick={clearDataset}
                  title="Limpiar dataset"
                  className="flex items-center justify-center border border-brand-line px-3 py-2 hover:bg-red-900/20 transition-colors text-xs text-red-550 rounded-sm"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Save / Export Modal */}
      <AnimatePresence>
        {showSaveModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-brand-ink/90 z-50 flex items-center justify-center p-4 md:p-6 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-brand-bg w-full max-w-lg p-6 border-l-[6px] border-emerald-600 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowSaveModal(false)}
                className="absolute top-4 right-4 p-2 hover:bg-brand-ink/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-emerald-500/10 rounded-full">
                  <Save className="text-emerald-600" size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight">Guardar Colección</h3>
                  <p className="text-[10px] opacity-60 uppercase tracking-widest">¿Dónde deseas guardar estos {entries.length} puntos?</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">
                    Nombre del Dataset
                  </label>
                  <input 
                    type="text" 
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    className="w-full bg-brand-ink/5 border border-brand-line px-4 py-3 rounded-sm text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="Ej. Mi Colección..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-brand-line p-4 rounded-sm flex flex-col justify-between hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors group cursor-pointer"
                       onClick={() => {
                         handleSaveCurrentDataset(saveName);
                         setShowSaveModal(false);
                         setErrorNotification(`Dataset guardado en la carpeta local de la app como "${saveName}"`);
                       }}
                  >
                    <div>
                      <h4 className="font-bold flex items-center gap-2 mb-1">
                        <Folder size={16} className="text-emerald-600" />
                        Carpeta de la App
                      </h4>
                      <p className="text-[10px] opacity-70 leading-relaxed">
                        Se guarda en el almacenamiento de tu navegador. Ideal para organizar colecciones sin descargar archivos.
                      </p>
                    </div>
                    <div className="mt-4 text-[10px] uppercase font-bold text-emerald-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Guardar Aquí <ChevronRight size={12}/>
                    </div>
                  </div>

                  <div className="border border-brand-line p-4 rounded-sm flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold flex items-center gap-2 mb-1">
                        <HardDrive size={16} className="text-blue-600" />
                        Descargar a tu PC
                      </h4>
                      <p className="text-[10px] opacity-70 leading-relaxed mb-3">
                        Exporta un archivo físico a tu computadora.
                      </p>
                    </div>
                    
                    <div className="flex gap-2 w-full mt-auto">
                      <button 
                        onClick={() => { exportToJson(); setShowSaveModal(false); }}
                        className="flex-1 bg-brand-ink/5 hover:bg-brand-ink hover:text-brand-bg transition-colors py-2 text-[10px] font-bold uppercase tracking-wider rounded-sm border border-brand-line/50"
                      >
                        JSON
                      </button>
                      <button 
                        onClick={() => { exportToGeoJson(); setShowSaveModal(false); }}
                        className="flex-1 bg-brand-ink/5 hover:bg-brand-ink hover:text-brand-bg transition-colors py-2 text-[10px] font-bold uppercase tracking-wider rounded-sm border border-brand-line/50"
                      >
                        GeoJSON
                      </button>
                      <button 
                        onClick={() => { exportToCsv(); setShowSaveModal(false); }}
                        className="flex-1 bg-brand-ink/5 hover:bg-brand-ink hover:text-brand-bg transition-colors py-2 text-[10px] font-bold uppercase tracking-wider rounded-sm border border-brand-line/50"
                      >
                        CSV
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cost Warning Modal */}
      <AnimatePresence>
        {showCostWarning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-brand-ink/90 z-50 flex items-center justify-center p-4 md:p-6 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-brand-bg w-full max-w-md p-6 border-l-[6px] border-brand-ink shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-brand-ink/5 rounded-full">
                  <Info className="text-brand-ink" size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight">Estimación de Costo (Flash)</h3>
                  <p className="text-[10px] opacity-60 uppercase tracking-widest">Modelo de Bajo Costo Seleccionado</p>
                </div>
              </div>
              <div className="mt-4 mb-8 text-sm leading-relaxed">
                <p className="mb-4 italic font-serif opacity-80">
                  Estás a punto de procesar <strong>{(() => {
                    const locs = location.split(';').map(l => l.trim()).filter(l => l);
                    return (locs.length === 0 ? 1 : locs.length) * sampleCount;
                  })()} muestras</strong> usando tu clave de API de Gemini. 
                </p>
                
                <div className="bg-brand-ink/5 p-4 border border-brand-line/30 font-mono text-xs">
                  <div className="flex justify-between border-b border-brand-line/30 pb-2 mb-2">
                    <span className="opacity-70">Modelo Activo:</span>
                    <span>Gemini 3 Flash</span>
                  </div>
                  <div className="flex justify-between border-b border-brand-line/30 pb-2 mb-2">
                    <span className="opacity-70">Costo máx. por muestra (Aprox.):</span>
                    <span>$0.0003 USD</span>
                  </div>
                  <div className="flex justify-between font-bold text-[13px] pt-1">
                    <span>Costo Total Estimado:</span>
                    <span>~${(() => {
                        const locs = location.split(';').map(l => l.trim()).filter(l => l);
                        if (locs.length === 0) return (sampleCount * 0.0003).toFixed(5);
                        
                        const samplesPerLocation = Math.ceil(sampleCount / locs.length);
                        let totalUncached = 0;
                        
                        for (let lIdx = 0; lIdx < locs.length; lIdx++) {
                          const currentLoc = locs[lIdx];
                          const locSamples = (lIdx === locs.length - 1) 
                            ? (sampleCount - (lIdx * samplesPerLocation)) 
                            : samplesPerLocation;

                          const cacheKey = `dataset_cache_${currentLoc.toLowerCase()}_${locSamples}`;
                          const cachedString = localStorage.getItem(cacheKey);
                          let isCached = false;
                          if (cachedString && geofence.length === 0) {
                            try {
                              const cachedData = JSON.parse(cachedString);
                              if (Array.isArray(cachedData) && cachedData.length === locSamples) {
                                isCached = true;
                              }
                            } catch {}
                          }
                          
                          if (!isCached) {
                            totalUncached += locSamples;
                          }
                        }
                        
                        if (totalUncached === 0) return "0.00000"; 
                        return (totalUncached * 0.0003).toFixed(5);
                    })()} USD</span>
                  </div>
                </div>
                
                <p className="text-[10px] opacity-60 uppercase tracking-widest text-center mt-4">
                  (El costo se calcula restando la data de zonas previamente procesadas)
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setShowCostWarning(false)}
                  className="px-6 py-2 text-xs uppercase font-bold border border-brand-line/50 hover:bg-brand-ink/10 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    setShowCostWarning(false);
                    generateFullDataset();
                  }}
                  className="px-6 py-2 text-xs uppercase font-bold bg-brand-ink text-brand-bg hover:bg-brand-ink/80 transition-colors flex items-center gap-2"
                >
                  <Play size={14} /> Proceder
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline Notifications */}
      <AnimatePresence>
        {errorNotification && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`text-white text-[10px] uppercase font-bold tracking-widest px-6 py-2.5 flex justify-between items-center z-30 transition-colors ${
              errorNotification.startsWith('Éxito:') || errorNotification.startsWith('Colección:') 
                ? 'bg-emerald-600' 
                : errorNotification.includes('Studio') 
                  ? 'bg-red-650' 
                  : 'bg-amber-500'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={12} />
              <span>{errorNotification}</span>
              {errorNotification.includes('ai.studio/spend') && (
                <a 
                  href="https://ai.studio/spend" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-2 underline hover:no-underline px-2 py-0.5 border border-white/30 rounded-sm"
                >
                  Ir a Billing
                </a>
              )}
            </div>
            <button onClick={() => setErrorNotification(null)} className="hover:opacity-70 ml-4 shrink-0">
              Cerrar [X]
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-0 flex flex-col lg:overflow-hidden">
        {savedDatasets.length > 0 && entries.length > 0 && (
          <div className="bg-emerald-50/70 border-b border-emerald-500/10 px-6 py-1.5 flex items-center gap-3 overflow-x-auto whitespace-nowrap scrollbar-hide">
            <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest shrink-0 flex items-center gap-1 font-mono">
              <Database size={11} className="text-emerald-600 hover:animate-pulse" /> Colecciones Locales (Costo $0):
            </span>
            {savedDatasets.map(ds => (
              <div key={ds.id} className="inline-flex items-center gap-1 shrink-0">
                <button 
                  onClick={() => loadSavedDataset(ds)}
                  className={`px-2 py-0.5 text-[9px] uppercase font-bold border transition-colors rounded-sm ${
                    location === ds.location 
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm font-bold' 
                      : 'bg-white border-emerald-250 text-emerald-850 hover:bg-emerald-50 hover:border-emerald-500'
                  }`}
                  title={`Cargar Colección: ${ds.location}`}
                >
                  {ds.location.split(';')[0]} ({ds.sampleCount})
                </button>
              </div>
            ))}
          </div>
        )}
        
        {sessions.length > 0 && (
          <div className="bg-brand-bg border-b border-brand-line px-6 py-2 flex items-center gap-4 overflow-x-auto whitespace-nowrap scrollbar-hide">
            <span className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">Sesiones:</span>
            <button 
              onClick={() => setActiveLocationFilter(null)}
              className={`px-3 py-1 text-[10px] uppercase font-bold border transition-colors ${activeLocationFilter === null ? 'bg-brand-ink text-brand-bg border-brand-ink' : 'border-brand-line/30 opacity-60 hover:opacity-100'}`}
            >
              Historial Global ({entries.length})
            </button>
            {sessions.map(loc => (
              <button 
                key={loc}
                onClick={() => setActiveLocationFilter(loc)}
                className={`px-3 py-1 text-[10px] uppercase font-bold border transition-colors ${activeLocationFilter === loc ? 'bg-brand-ink text-brand-bg border-brand-ink' : 'border-brand-line/30 opacity-60 hover:opacity-100'}`}
              >
                {loc}
              </button>
            ))}
          </div>
        )}
        
        {categories.length > 0 && (
          <div className="bg-brand-bg border-b border-brand-line/50 px-6 py-1.5 flex items-center gap-3 overflow-x-auto whitespace-nowrap scrollbar-hide">
            <span className="text-[9px] font-bold opacity-30 uppercase tracking-tighter shrink-0">Filtros:</span>
            <button 
              onClick={() => setActiveCategoryFilter(null)}
              className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded-full transition-colors ${activeCategoryFilter === null ? 'bg-brand-line text-brand-bg' : 'bg-transparent text-brand-line/60 hover:text-brand-ink hover:bg-brand-line/10'}`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setActiveCategoryFilter(cat)}
                className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded-full transition-colors ${activeCategoryFilter === cat ? 'bg-brand-line text-brand-bg' : 'bg-transparent text-brand-line/60 hover:text-brand-ink hover:bg-brand-line/10'}`}
              >
                {cat}
              </button>
            ))}

            <div className="ml-auto flex items-center gap-2 border-l border-brand-line/20 pl-4">
              <span className="text-[9px] font-bold opacity-30 uppercase tracking-tighter">Puntuación:</span>
              <button 
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'none' : 'desc')}
                className={`px-2 py-0.5 text-[9px] uppercase font-bold border transition-colors ${sortOrder === 'desc' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-brand-line/30 opacity-60 hover:opacity-100'}`}
              >
                Mayor
              </button>
              <button 
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'none' : 'asc')}
                className={`px-2 py-0.5 text-[9px] uppercase font-bold border transition-colors ${sortOrder === 'asc' ? 'bg-amber-600 text-white border-amber-600' : 'border-brand-line/30 opacity-60 hover:opacity-100'}`}
              >
                Menor
              </button>
            </div>
          </div>
        )}

        {!entries.length && !isGenerating ? (
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-4xl mx-auto w-full my-auto py-16">
            <Zap size={48} strokeWidth={1} className="mb-4 opacity-40 animate-pulse" />
            <p className="max-w-xs text-sm italic font-serif opacity-50 mb-8">
              Sistema Offline o Sin Datos. Ingrese una ubicación y haga clic en "Entrenar" para generar un dataset estructurado.
            </p>

            {savedDatasets.length > 0 && (
              <div className="w-full text-left bg-white border border-brand-line/30 p-6 rounded-sm shadow-sm md:mt-4">
                <h3 className="text-xs uppercase font-bold tracking-widest text-brand-ink/50 border-b border-brand-line/20 pb-3 mb-4 flex items-center gap-2">
                  <Folder size={14} className="text-emerald-600" />
                  <span>Carpeta de la App (Colecciones Guardadas)</span>
                  <span className="font-mono text-[9px] font-normal lowercase tracking-normal pl-2 border-l ml-auto opacity-70">(almacenamiento local del navegador)</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedDatasets.map((ds) => (
                    <div 
                      key={ds.id}
                      onClick={() => loadSavedDataset(ds)}
                      className="border border-brand-line/20 hover:border-brand-ink/45 hover:shadow-md cursor-pointer p-4 bg-brand-bg/10 rounded-sm flex flex-col justify-between transition-all group animate-fade-in"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs font-bold font-mono tracking-tight text-brand-ink/90 group-hover:text-brand-ink leading-snug line-clamp-1">
                            {ds.location}
                          </span>
                          <span className="text-[9px] shrink-0 font-mono bg-brand-ink/5 border px-1.5 py-0.5 opacity-60">
                            {ds.sampleCount} muestras
                          </span>
                        </div>
                        <span className="text-[9px] font-sans opacity-40 block mt-1 hover:opacity-100 italic">
                          Guardado: {ds.timestamp}
                        </span>
                      </div>
                      
                      <div className="mt-4 pt-2 border-t border-brand-line/5 flex justify-between items-center text-[10px]">
                        <span className="text-emerald-700 font-bold group-hover:underline flex items-center gap-1">
                          Cargar dataset &rarr;
                        </span>
                        <button 
                          onClick={(e) => deleteSavedDataset(ds.id, e)}
                          className="hover:text-red-650 opacity-40 hover:opacity-100 text-[9px] hover:font-bold border border-transparent hover:border-red-200 hover:bg-red-50 px-2 py-0.5 rounded-sm transition-all"
                          title="Eliminar de la historia local"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {viewMode === 'analysis' && entries.length > 0 && (
              <>
                <div className="h-[400px] w-full border-b border-brand-line shrink-0">
                  <MapComponent 
                    entries={filteredEntries} 
                    selectedEntry={selectedEntry} 
                    onSelect={handleSelectFromMap} 
                    h3Clusters={h3Clusters}
                    showH3Layer={showH3Layer}
                    h3Opacity={h3Opacity}
                    geofence={geofence}
                    isDrawingMode={isDrawingMode}
                    onUpdateGeofence={setGeofence}
                    anchors={anchors}
                    forcedCenter={forcedMapCenter}
                  />
                </div>
                <div className="bg-brand-bg border-b border-brand-line px-6 py-3 flex flex-wrap items-center gap-8 shrink-0">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 flex items-center gap-1">
                        <Layers size={12} /> Capas:
                      </span>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <div 
                          onClick={() => setShowH3Layer(!showH3Layer)}
                          className={`w-8 h-4 rounded-full transition-colors relative ${showH3Layer ? 'bg-emerald-600' : 'bg-brand-line/30'}`}
                        >
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${showH3Layer ? 'left-4.5' : 'left-0.5'}`} />
                        </div>
                        <span className={`text-[10px] font-bold uppercase transition-colors ${showH3Layer ? 'text-brand-ink' : 'opacity-40'}`}>
                          Clusters H3
                        </span>
                      </label>
                    </div>

                    <div className="flex items-center gap-2 border-l border-brand-line/20 pl-6">
                      <button 
                        onClick={() => setIsDrawingMode(!isDrawingMode)}
                        className={`flex items-center gap-2 px-3 py-1 text-[10px] uppercase font-bold border transition-all ${isDrawingMode ? 'bg-brand-ink text-brand-bg border-brand-ink' : 'border-brand-line/30 hover:border-brand-line'}`}
                      >
                        <Search size={12} className={isDrawingMode ? 'animate-pulse' : ''} />
                        {isDrawingMode ? 'Finalizar Dibujo' : 'Dibujar Geovalla'}
                      </button>
                      {geofence.length > 0 && (
                        <button 
                          onClick={() => setGeofence([])}
                          className="px-3 py-1 text-[10px] uppercase font-bold text-red-500 border border-brand-line/30 hover:border-red-500/50 transition-all flex items-center gap-1"
                        >
                          <X size={12} /> Limpiar ({geofence.length})
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={`flex items-center gap-3 transition-opacity ${showH3Layer ? 'opacity-100' : 'opacity-20 pointer-events-none'}`}>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Opacidad:</span>
                    <input 
                      type="range" 
                      min="0.1" 
                      max="0.9" 
                      step="0.1" 
                      value={h3Opacity}
                      onChange={(e) => setH3Opacity(parseFloat(e.target.value))}
                      className="w-32 accent-brand-ink cursor-pointer bg-brand-line/20 h-1 rounded-full appearance-none"
                    />
                    <span className="text-[10px] font-mono font-bold w-8">{Math.round(h3Opacity * 100)}%</span>
                  </div>

                  <div className="ml-auto text-[9px] italic opacity-40 flex items-center gap-2">
                    <Hexagon size={10} />
                    Densidad Geográfica basada en Resolución 9
                  </div>
                </div>
              </>
            )}
            {viewMode === 'geojson' ? (
              <div className="flex-1 p-2 md:p-4 bg-brand-bg overflow-hidden lg:h-[calc(100vh-230px)] lg:max-h-[calc(100vh-230px)] min-h-0 flex flex-col">
                <GeoJsonPlayground 
                  entries={filteredEntries} 
                  selectedId={selectedEntry?.id || null}
                  onSelectId={(id) => {
                    const found = filteredEntries.find(e => e.id === id);
                    if (found) setSelectedEntry(found);
                  }}
                />
              </div>
            ) : viewMode === 'stats' ? (
              <StatisticsView entries={filteredEntries} />
            ) : (
              <div className="overflow-y-auto flex-1 bg-brand-ink/5 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {filteredEntries.map((entry) => {
                  const score = entry.validation?.computedScore || 0;
                  const h3Idx = entry.validation?.h3Index || '';
                  const isAnchor = score >= 85;
                  const issues = entry.validation?.issues || [];
                  const isSelected = selectedEntry?.id === entry.id;

                  return (
                    <div 
                      key={entry.id} 
                      id={`card-${entry.id}`}
                      onClick={() => setSelectedEntry(entry)}
                      className={`relative flex flex-col p-4 border transition-all duration-200 cursor-pointer group ${
                        isSelected 
                          ? 'bg-brand-ink text-brand-bg border-brand-ink scale-[0.98]' 
                          : 'bg-white border-brand-line/30 hover:border-brand-ink/40 hover:-translate-y-1 hover:shadow-lg'
                      } ${issues.length > 0 ? 'border-l-[6px] border-l-amber-500' : 'border-l border-l-brand-line/30'}`}
                    >
                      {/* Card Header */}
                      <div className="flex justify-between items-start mb-3">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 border ${isSelected ? 'border-brand-bg/30 text-brand-bg' : 'border-brand-ink/20 text-brand-ink/50'}`}>
                          {entry.id}
                        </span>
                        <div className="flex items-center gap-2">
                          {isAnchor && (
                            <ShieldCheck size={14} className={isSelected ? 'text-brand-bg' : 'text-emerald-600'} />
                          )}
                          <div className={`text-sm font-bold ${isSelected ? 'text-brand-bg' : score > 80 ? 'text-emerald-600' : score > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            {score}<span className="text-[10px] opacity-50 ml-0.5">pts</span>
                          </div>
                        </div>
                      </div>

                      {/* Location Information */}
                      <div className="mb-4">
                        <div className={`text-[8px] uppercase font-bold mb-1 opacity-40 ${isSelected ? 'text-brand-bg' : ''}`}>
                          Contexto: {entry.locationContext}
                          {entry.category && ` • ${entry.category}`}
                        </div>
                        <div className={`text-xs font-bold leading-tight line-clamp-1 flex items-center gap-1 ${isSelected ? 'text-brand-bg' : 'text-brand-ink'}`}>
                          <MapPin size={10} className="opacity-50" />
                          {entry.coordinates.corner}
                        </div>
                        <div className={`text-[10px] mt-1 font-mono ${isSelected ? 'text-brand-bg/60' : 'opacity-50'}`}>
                          {entry.coordinates.lat.toFixed(6)}, {entry.coordinates.lng.toFixed(6)}
                        </div>
                      </div>

                      {/* Analysis Details (Contextual) */}
                      <div className={`grid ${viewMode === 'analysis' ? 'grid-cols-1' : 'grid-cols-2'} gap-2 text-[10px] pt-3 border-t ${isSelected ? 'border-brand-bg/10' : 'border-brand-line/20'}`}>
                        {viewMode === 'dataset' ? (
                          <>
                            <div className="flex flex-col gap-0.5">
                              <span className="uppercase opacity-40 text-[8px] font-bold">Evidencia OCR</span>
                              <span className="truncate">{entry.ocr.detectedText || "Sin texto"}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 text-right">
                              <span className="uppercase opacity-40 text-[8px] font-bold">Estilo Arq.</span>
                              <span className="truncate">{entry.microPhysiognomy.urbanElements.architectureStyle}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between">
                              <span className="uppercase opacity-40 text-[8px] font-bold">Evidencia OCR</span>
                              <span className="uppercase opacity-40 text-[8px] font-bold tracking-widest">{entry.ocr.rapidFuzzScore}% CONF</span>
                            </div>
                            <div className={`font-mono p-1 rounded ${isSelected ? 'bg-brand-bg/10' : 'bg-brand-ink/5 italic'}`}>
                              "{entry.ocr.detectedText[0] || 'SIN_TEXTO'}"
                            </div>
                            <div className="flex justify-between mt-1 pt-1 border-t border-brand-line/10">
                              <span className="opacity-60">{entry.microPhysiognomy.urbanElements.furniture}</span>
                              <span className="font-bold opacity-80">{entry.microPhysiognomy.urbanElements.vegetationScore.toFixed(2)} VEG</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer Labels */}
                      <div className="mt-4 flex items-center justify-between">
                        <div className={`text-[9px] uppercase tracking-wider ${isSelected ? 'text-brand-bg/70' : 'opacity-40'}`}>
                          {entry.timestamp.split(' ')[1]}
                        </div>
                        {issues.length > 0 && (
                          <div className="flex items-center gap-1 text-[9px] text-amber-500 font-bold px-1 py-0.5 bg-amber-500/10">
                            <AlertTriangle size={10} /> {issues.length} AVISO{issues.length > 1 ? 'S' : ''}
                          </div>
                        )}
                      </div>

                      {/* Selection Indicator */}
                      {isSelected && (
                        <div className="absolute inset-0 border-2 border-brand-ink pointer-events-none" />
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Detail Overlay */}
      <AnimatePresence>
        {selectedEntry && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-brand-ink/90 z-50 flex items-center justify-center p-4 md:p-6 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-brand-bg w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col border border-brand-line"
            >
              <div className="p-6 border-b border-brand-line flex justify-between items-center bg-brand-bg">
                <div className="flex items-center gap-6">
                  <span className="text-4xl font-serif italic font-bold">#{selectedEntry.id}</span>
                  <div>
                    <h2 className="text-xl font-bold uppercase">{selectedEntry.coordinates.corner}</h2>
                    <div className="flex gap-4 mt-1">
                      <p className="text-xs opacity-60">
                        {selectedEntry.coordinates.lat}, {selectedEntry.coordinates.lng}
                      </p>
                      <span className="text-xs font-mono font-bold text-yellow-700">
                        H3: {h3.latLngToCell(selectedEntry.coordinates.lat, selectedEntry.coordinates.lng, 9)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {calculateScore(selectedEntry) >= 85 && (
                    <div className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1 text-[10px] font-bold rounded-sm animate-pulse">
                      <ShieldCheck size={14} /> FOTO ANCLA VALIDADA
                    </div>
                  )}
                  <button 
                    onClick={() => setSelectedEntry(null)}
                    className="p-2 border border-brand-line hover:bg-brand-ink hover:text-brand-bg transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Column 1: Evidence Breakdown */}
                <div className="space-y-8">
                  <section>
                    <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-widest opacity-50">
                      <FileText size={14} />
                      Evidencia OCR (Detección de Texto)
                    </div>
                    <div className="bg-brand-ink/5 p-4 border-l-2 border-brand-line space-y-4">
                      {selectedEntry.ocr.detectedText.map((text, i) => (
                        <div key={i} className="flex flex-col">
                          <span className="text-[9px] uppercase opacity-40">Capa de Texto {i+1}</span>
                          <span className="text-lg font-bold font-serif italic select-all">"{text}"</span>
                        </div>
                      ))}
                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-[10px] opacity-60">Confianza OCR Eng.:</span>
                        <span className="text-xs font-bold text-emerald-600">{(selectedEntry.ocr.confidence * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-widest opacity-50">
                      <Database size={14} />
                      Metadatos EXIF (Inyectados)
                    </div>
                    <div className="bg-brand-ink/5 p-4 border-l-2 border-brand-line grid grid-cols-2 gap-y-3 gap-x-6">
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase opacity-40">Cámara</span>
                        <span className="text-[11px] font-bold">{selectedEntry.exif.make} {selectedEntry.exif.model}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase opacity-40">Lente</span>
                        <span className="text-[11px] font-bold">{selectedEntry.exif.lensModel}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase opacity-40">Fecha/Hora</span>
                        <span className="text-[11px] font-bold">{selectedEntry.exif.dateTimeOriginal}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase opacity-40">Parámetros</span>
                        <span className="text-[11px] font-bold">{selectedEntry.exif.fStop} | ISO {selectedEntry.exif.iso} | {selectedEntry.exif.shutterSpeed}</span>
                      </div>
                      {selectedEntry.groundedFromAnchor && (
                        <div className="flex flex-col col-span-2 mt-2 p-2 bg-emerald-50 border border-emerald-100 rounded-sm">
                          <span className="text-[9px] uppercase text-emerald-800 font-bold flex items-center gap-1">
                             Ground Truth (Referencia Real)
                          </span>
                          <span className="text-[11px] font-bold text-emerald-900">{selectedEntry.groundedFromAnchor}</span>
                        </div>
                      )}
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-widest opacity-50">
                      <LayoutGrid size={14} />
                      Atributos Urbanos (Guide 8.x)
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border border-brand-line/10 p-3 bg-white/50">
                        <span className="text-[9px] uppercase opacity-40 block mb-1">Mobiliario Urbano</span>
                        <p className="text-[11px] font-bold leading-tight">{selectedEntry.microPhysiognomy.urbanElements.furniture}</p>
                      </div>
                      <div className="border border-brand-line/10 p-3 bg-white/50">
                        <span className="text-[9px] uppercase opacity-40 block mb-1">Estilo Arq.</span>
                        <p className="text-[11px] font-bold leading-tight">{selectedEntry.microPhysiognomy.urbanElements.architectureStyle}</p>
                      </div>
                      <div className="border border-brand-line/10 p-3 bg-white/50">
                        <span className="text-[9px] uppercase opacity-40 block mb-1">Carga Visual</span>
                        <p className="text-[11px] font-bold leading-tight">{selectedEntry.microPhysiognomy.aerialCables}</p>
                      </div>
                      <div className="border border-brand-line/10 p-3 bg-white/50">
                        <span className="text-[9px] uppercase opacity-40 block mb-1">Entorno Social</span>
                        <p className="text-[11px] font-bold leading-tight">{selectedEntry.microPhysiognomy.graffiti}</p>
                      </div>
                    </div>
                  </section>
                </div>

                {/* Column 2: Environmental Mapping */}
                <div className="space-y-8 bg-white/30 p-6 border-x border-brand-line/10 flex flex-col">
                  {/* Contexto Geográfico Map */}
                  <section>
                    <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-widest opacity-50">
                      <LayoutGrid size={14} />
                      Contexto Geográfico (Radio 150m)
                    </div>
                    <div className="w-full h-48 border border-brand-line bg-brand-ink/5">
                      <MapComponent 
                        entries={[selectedEntry]} 
                        selectedEntry={selectedEntry} 
                        onSelect={() => {}} 
                        h3Clusters={{}}
                      />
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-widest opacity-50">
                      <Sun size={14} />
                      Vector Solar y Sombras
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 bg-brand-bg border border-brand-line/20 rounded-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] uppercase opacity-50">Dirección</span>
                          <span className="text-xs font-bold">{selectedEntry.lighting.shadowDirection}</span>
                        </div>
                        <div className="w-full bg-brand-ink/10 h-1 rounded-full overflow-hidden">
                           <div className="bg-brand-ink h-full" style={{ width: '65%' }} />
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed opacity-80 min-h-[100px] border border-brand-line/10 p-4 italic">
                        "{selectedEntry.lighting.description}"
                      </p>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-widest opacity-50">
                      <Layers size={14} />
                      Capa Vegetación
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 border-2 border-brand-ink flex items-center justify-center text-xl font-bold font-serif italic text-emerald-800">
                        {(selectedEntry.microPhysiognomy.urbanElements.vegetationScore * 100).toFixed(0)}%
                      </div>
                      <div>
                        <p className="text-xs font-bold">{selectedEntry.microPhysiognomy.treeType}</p>
                        <p className="text-[10px] opacity-60">Score de confianza en detección botánica local.</p>
                      </div>
                    </div>
                  </section>
                </div>

                {/* Column 3: Consensus Algorithm Analyzer */}
                <div className="space-y-8 bg-brand-ink text-brand-bg p-8">
                  <section>
                    <div className="flex items-center gap-2 mb-6 text-xs font-bold uppercase tracking-widest text-brand-bg/50">
                      <Zap size={14} />
                      Algoritmo de Consenso (Scoring)
                    </div>
                    
                    <div className="space-y-6">
                      <div className="flex justify-between items-end border-b border-brand-bg/20 pb-2">
                        <div>
                          <p className="text-[9px] uppercase opacity-40">Módulo OCR (RapidFuzz)</p>
                          <p className="text-xs font-bold">Detección de Street-Signs</p>
                        </div>
                        <p className="text-xs text-emerald-400">+{Math.round((selectedEntry.ocr.rapidFuzzScore / 100) * WEIGHTS.OCR)} <span className="text-[9px] opacity-40">/40</span></p>
                      </div>

                      <div className="flex justify-between items-end border-b border-brand-bg/20 pb-2">
                        <div>
                          <p className="text-[9px] uppercase opacity-40">Temporal Windows</p>
                          <p className="text-xs font-bold">Consistencia del Entorno ({selectedEntry.microPhysiognomy.temporalWindow})</p>
                        </div>
                        <p className="text-xs text-emerald-400">+10 <span className="text-[9px] opacity-40">BONUS</span></p>
                      </div>

                      <div className="flex justify-between items-end border-b border-brand-bg/20 pb-2">
                        <div>
                          <p className="text-[9px] uppercase opacity-40">Módulo Fisionomía</p>
                          <p className="text-xs font-bold">{selectedEntry.microPhysiognomy.urbanElements.architectureStyle}</p>
                        </div>
                        <p className="text-xs text-emerald-400">+{WEIGHTS.MICRO_PHYSIOGNOMY} <span className="text-[9px] opacity-40">/20</span></p>
                      </div>

                      <div className="flex justify-between items-end border-b border-brand-bg/20 pb-2">
                        <div>
                          <p className="text-[9px] uppercase opacity-40">Identificación Botánica</p>
                          <p className="text-xs font-bold">{selectedEntry.microPhysiognomy.treeType}</p>
                        </div>
                        <p className="text-xs text-emerald-400">+{Math.round(selectedEntry.microPhysiognomy.urbanElements.vegetationScore * WEIGHTS.VEGETATION)} <span className="text-[9px] opacity-40">/15</span></p>
                      </div>

                      <div className="flex justify-between items-end border-b border-brand-bg/20 pb-2">
                        <div>
                          <p className="text-[9px] uppercase opacity-40">Patrones Arquitectónicos</p>
                          <p className="text-xs font-bold">Detección de Persiana/Reja</p>
                        </div>
                        <p className="text-xs text-emerald-400">+{WEIGHTS.ARCHITECTURE} <span className="text-[9px] opacity-40">/15</span></p>
                      </div>

                      <div className="pt-8 flex justify-between items-center">
                        <div className="text-brand-bg/50 text-[10px] uppercase tracking-[0.3em]">Total Confidence</div>
                        <div className="text-5xl font-serif italic text-emerald-400">
                          {calculateScore(selectedEntry)}%
                        </div>
                      </div>
                    </div>
                  </section>

                  <div className="mt-12 p-4 border border-brand-bg/20 text-[9px] leading-relaxed opacity-60 font-sans italic space-y-4">
                    {getValidationIssues(selectedEntry).length > 0 && (
                      <div className="bg-amber-500/10 border border-amber-500/50 p-3 mb-4 text-amber-200 non-italic">
                        <p className="font-bold flex items-center gap-2 mb-2 text-[10px] uppercase tracking-wider">
                          <AlertTriangle size={14} /> Alertas de Integridad (Sección 9 Guía)
                        </p>
                        <ul className="list-disc pl-4 space-y-1">
                          {getValidationIssues(selectedEntry).map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Hexagon size={24} className="text-yellow-500 shrink-0" />
                      <div>
                        <p className="font-bold uppercase tracking-widest text-brand-bg opacity-100">Spatial Context (H3 Res 9)</p>
                        <p>Celda: {h3.latLngToCell(selectedEntry.coordinates.lat, selectedEntry.coordinates.lng, 9)}</p>
                      </div>
                    </div>
                    <p>* Proceso fundamentado en el Fallback de 3 niveles y Memoria Visual Colectiva segun "Guía de Programación: Ingeniería Inversa Geográfica".</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer / Status Bar */}
      <footer className="border-t border-brand-line p-4 flex justify-between items-center text-[10px] uppercase tracking-widest opacity-60 bg-brand-bg">
        <div className="flex gap-6">
          <span className="flex items-center gap-2"><Hexagon size={12}/> H3 Indexing: ACTIVE (GLOBAL)</span>
          <span>Algoritmo: CONCORDIA_V4_ALPHA</span>
        </div>
        <div className="flex gap-4">
          <span>{entries.length} Entradas Procesadas</span>
          <span className="animate-pulse flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-brand-ink rounded-full" />
            Live System
          </span>
        </div>
      </footer>
    </div>
  );
}
