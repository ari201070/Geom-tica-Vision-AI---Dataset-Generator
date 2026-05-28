import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { DatasetEntry } from '../services/geminiService';

interface StatisticsViewProps {
  entries: DatasetEntry[];
}

const COLORS = ['#141414', '#059669', '#d97706', '#2563eb', '#db2777', '#7c3aed', '#0d9488', '#4338ca'];

export default function StatisticsView({ entries }: StatisticsViewProps) {
  // 1. KPI Stats Summary
  const statsSummary = React.useMemo(() => {
    if (entries.length === 0) return null;
    
    const avgScore = Math.round(
      entries.reduce((acc, curr) => acc + (curr.validation?.computedScore || 0), 0) / entries.length
    );
    
    // Find top category
    const categories = entries.map(e => e.category || 'Otros');
    const topCategory = categories.reduce((a, b, i, arr) => 
      (arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b)
    , categories[0]);

    // Find top architectural style
    const styles = entries.map(e => e.microPhysiognomy?.urbanElements?.architectureStyle || 'N/A');
    const topStyle = styles.reduce((a, b, i, arr) => 
      (arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b)
    , styles[0]);

    return {
      count: entries.length,
      avgScore,
      topCategory,
      topStyle
    };
  }, [entries]);

  // 2. Confidence Score Distribution
  const scoreData = React.useMemo(() => {
    const bins = [0, 20, 40, 60, 80, 100];
    const data = bins.slice(0, -1).map((bin, i) => ({
      range: `${bin}-${bins[i+1]}`,
      count: entries.filter(e => {
        const score = e.validation?.computedScore || 0;
        return score >= bin && score < bins[i+1];
      }).length
    }));
    return data;
  }, [entries]);

  // 3. Category Distribution with custom percentage calculation
  const categoryData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach(e => {
      const cat = e.category || 'Otros';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const total = entries.length;
    return Object.entries(counts).map(([name, value], index) => ({
      name,
      value,
      percentage: ((value / total) * 100).toFixed(1),
      color: COLORS[index % COLORS.length]
    })).sort((a, b) => b.value - a.value);
  }, [entries]);

  // 4. Architecture Styles count
  const techData = React.useMemo(() => {
    const styles: Record<string, number> = {};
    entries.forEach(e => {
      const style = e.microPhysiognomy?.urbanElements?.architectureStyle || 'N/A';
      styles[style] = (styles[style] || 0) + 1;
    });
    return Object.entries(styles)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center opacity-40">
        <div className="w-16 h-16 border-2 border-brand-ink/20 rounded-full flex items-center justify-center mb-4 font-bold text-lg">
          %
        </div>
        <p className="font-mono text-xs uppercase tracking-widest">No hay datos suficientes para generar estadísticas.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-brand-bg overflow-y-auto flex-1 max-h-full scrollbar-hidden">
      
      {/* KPI Stats Widgets Header */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-brand-line/30 p-4 rounded-sm flex flex-col justify-between shadow-sm">
          <span className="text-[9px] uppercase font-bold tracking-wider text-brand-ink/40">Total Muestras</span>
          <span className="text-2xl font-bold font-mono tracking-tight text-brand-ink mt-2">
            {statsSummary?.count}
          </span>
        </div>
        
        <div className="bg-white border border-brand-line/30 p-4 rounded-sm flex flex-col justify-between shadow-sm">
          <span className="text-[9px] uppercase font-bold tracking-wider text-brand-ink/40">Confianza Promedio</span>
          <span className="text-2xl font-bold font-mono tracking-tight text-emerald-600 mt-2">
            {statsSummary?.avgScore}%
          </span>
        </div>
        
        <div className="bg-white border border-brand-line/30 p-4 rounded-sm flex flex-col justify-between shadow-sm">
          <span className="text-[9px] uppercase font-bold tracking-wider text-brand-ink/40 font-mono">Categoría Líder</span>
          <span className="text-sm font-bold uppercase tracking-wider text-brand-ink mt-2 truncate w-full" title={statsSummary?.topCategory}>
            {statsSummary?.topCategory}
          </span>
        </div>
        
        <div className="bg-white border border-brand-line/30 p-4 rounded-sm flex flex-col justify-between shadow-sm">
          <span className="text-[9px] uppercase font-bold tracking-wider text-brand-ink/40">Arq. Predominante</span>
          <span className="text-sm font-bold uppercase tracking-wider text-brand-ink mt-2 truncate w-full" title={statsSummary?.topStyle}>
            {statsSummary?.topStyle}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Confidence Chart */}
        <div className="bg-white border border-brand-line/30 p-4 rounded-sm shadow-sm">
          <h4 className="text-[10px] uppercase font-bold tracking-widest mb-4 text-brand-ink/50 flex justify-between">
            <span>Distribución de Confianza</span>
            <span className="font-mono font-medium">(Puntajes de Geocodificación)</span>
          </h4>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E3E0" />
                <XAxis dataKey="range" fontSize={10} tick={{fill: '#141414'}} />
                <YAxis fontSize={10} tick={{fill: '#141414'}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#141414', border: 'none', color: '#fff', fontSize: '10px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="count" fill="#141414" name="Cantidad" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categories Chart with Beautiful Responsive Inline Legend */}
        <div className="bg-white border border-brand-line/30 p-4 rounded-sm shadow-sm">
          <h4 className="text-[10px] uppercase font-bold tracking-widest mb-4 text-brand-ink/50">
            Categorías de Ubicación
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center h-[200px] overflow-hidden">
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                     contentStyle={{ backgroundColor: '#141414', border: 'none', color: '#fff', fontSize: '10px' }}
                     formatter={(value, name) => [`${value} muestras`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Elegant Custom Side Legend List */}
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-2 scrollbar-hidden">
              {categoryData.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 truncate pr-1">
                    <span className="w-2.5 h-2.5 shrink-0 rounded-sm" style={{ backgroundColor: cat.color }} />
                    <span className="text-brand-ink/80 truncate text-[10px] uppercase font-bold tracking-wider">{cat.name}</span>
                  </div>
                  <span className="text-brand-ink/50 text-[10px] shrink-0 font-bold">
                    {cat.value} ({cat.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Architecture Styles Vertical BarChart */}
        <div className="bg-white border border-brand-line/30 p-4 rounded-sm shadow-sm md:col-span-2">
          <h4 className="text-[10px] uppercase font-bold tracking-widest mb-4 text-brand-ink/50">
            Predominancia de Estilos Arquitectónicos (Top 5)
          </h4>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={techData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E4E3E0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={130} fontSize={9} tick={{fill: '#141414'}} />
                <Tooltip 
                   contentStyle={{ backgroundColor: '#141414', border: 'none', color: '#fff', fontSize: '10px' }}
                   formatter={(value) => [`${value} muestras`, 'Cantidad']}
                />
                <Bar dataKey="value" fill="#059669" name="Cantidad" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      <div className="pt-4 border-t border-brand-line/10">
        <p className="text-[10px] opacity-40 font-mono text-center uppercase tracking-[0.2em]">
          Análisis de Dataset v1.1 • Motor Gemini Pro
        </p>
      </div>
    </div>
  );
}
