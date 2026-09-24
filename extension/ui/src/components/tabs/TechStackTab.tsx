import React, { useState, useMemo } from 'react';
import {
  Search,
  Cpu,
  Layout,
  ShoppingBag,
  BarChart2,
  ExternalLink,
  Download,
  FileSpreadsheet,
  Code2,
  CheckCircle2,
} from 'lucide-react';
import { FullDossier, TechItem } from '../../types';
import { getTechStackSummary } from '../../services/techstack/mapper';
import { exportTechStackCSV, exportTechStackJSON, exportCompleteReport } from '../../services/api';

interface TechStackTabProps {
  dossier: FullDossier;
}

export const TechStackTab: React.FC<TechStackTabProps> = ({ dossier }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTech, setSelectedTech] = useState<TechItem | null>(null);

  const techData = dossier.tech_stack || {
    total_detected: 0,
    categories: {},
    technologies: [],
  };

  const technologies = techData.technologies || [];
  const summary = useMemo(() => getTechStackSummary(technologies), [technologies]);

  // Grouped Categories with Counts
  const categoriesWithCounts = useMemo(() => {
    const counts: Record<string, number> = { All: technologies.length };
    for (const t of technologies) {
      counts[t.category] = (counts[t.category] || 0) + 1;
    }
    return counts;
  }, [technologies]);

  const filteredTechs = useMemo(() => {
    return technologies.filter((t) => {
      const matchCat = selectedCategory === 'All' || t.category === selectedCategory;
      const matchSearch =
        !search.trim() ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [technologies, selectedCategory, search]);

  return (
    <div className="space-y-3 pb-8">
      {/* 1. Summary Cards (4 Cards: Total, Frontend, CMS, Analytics) */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1.5">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white leading-tight">
            {summary.total}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
            Total Tech
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-1.5">
            <Layout className="w-3.5 h-3.5" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white leading-tight">
            {summary.frontendCount}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
            Frontend
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1.5">
            <ShoppingBag className="w-3.5 h-3.5" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white leading-tight">
            {summary.cmsCount}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
            CMS & E-Com
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-soft">
          <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1.5">
            <BarChart2 className="w-3.5 h-3.5" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white leading-tight">
            {summary.analyticsCount}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
            Analytics
          </div>
        </div>
      </div>

      {/* 2. Export Actions Toolbar */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-800 shadow-soft">
        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5 text-blue-600" />
          Export Tech Stack
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => exportTechStackCSV(dossier)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            title="Export Tech Stack CSV"
          >
            <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
            <span>CSV</span>
          </button>
          <button
            onClick={() => exportTechStackJSON(dossier)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            title="Export Tech Stack JSON"
          >
            <Code2 className="w-3 h-3 text-purple-600" />
            <span>JSON</span>
          </button>
          <button
            onClick={() => exportCompleteReport(dossier)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 transition-colors"
            title="Export Complete Intelligence Report"
          >
            <span>Complete Report</span>
          </button>
        </div>
      </div>

      {/* 3. Search Bar & Category Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search technologies, frameworks, CMS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2">
          {Object.entries(categoriesWithCounts).map(([cat, count]) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 transition-colors flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[9px] px-1 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-blue-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Technologies Cards List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white px-1">
          <span>Detected Technologies ({filteredTechs.length})</span>
          <span className="text-[10px] text-slate-400 font-normal">Confidence breakdown</span>
        </div>

        {filteredTechs.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl p-8 text-center text-xs text-slate-400 border border-slate-200 dark:border-slate-800">
            No technologies found matching "{search}".
          </div>
        ) : (
          filteredTechs.map((tech, i) => (
            <div
              key={tech.name + i}
              className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft hover:border-blue-500/40 transition-all space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center font-bold text-xs text-blue-600 shrink-0">
                    {tech.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {tech.name}
                      </h3>
                      {tech.version && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-blue-100/80 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          v{tech.version}
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {tech.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${tech.confidence}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {tech.confidence}% confidence
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedTech(tech)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline shrink-0"
                >
                  View details
                </button>
              </div>

              {/* Detection method badges */}
              {tech.detectedBy && tech.detectedBy.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
                  <span className="text-[9px] text-slate-400 font-medium shrink-0">Detected via:</span>
                  {tech.detectedBy.slice(0, 2).map((method, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800 truncate max-w-[200px]"
                      title={method}
                    >
                      {method}
                    </span>
                  ))}
                  {tech.detectedBy.length > 2 && (
                    <span className="text-[9px] text-slate-400 font-mono">
                      +{tech.detectedBy.length - 2} more
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 5. Detail Popover / Modal */}
      {selectedTech && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-4 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Technology Details</span>
              <button
                onClick={() => setSelectedTech(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 flex items-center justify-center font-bold text-blue-600 text-lg shrink-0">
                {selectedTech.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                    {selectedTech.name}
                  </h3>
                  {selectedTech.version && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      v{selectedTech.version}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">{selectedTech.category}</span>
              </div>
            </div>

            {selectedTech.description && (
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                {selectedTech.description}
              </p>
            )}

            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Category:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedTech.category}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Confidence:</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${selectedTech.confidence}%` }}
                    />
                  </div>
                  <span className="font-bold text-blue-600">{selectedTech.confidence}%</span>
                </div>
              </div>
              {selectedTech.version && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Detected Version:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedTech.version}</span>
                </div>
              )}
              {selectedTech.website && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Official Website:</span>
                  <a
                    href={selectedTech.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 font-medium truncate max-w-[180px]"
                  >
                    <span>Visit website</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Detection Methods Evidence List */}
            {selectedTech.detectedBy && selectedTech.detectedBy.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Detection Evidence ({selectedTech.detectedBy.length})
                </span>
                <div className="space-y-1 max-h-32 overflow-y-auto no-scrollbar">
                  {selectedTech.detectedBy.map((method, idx) => (
                    <div
                      key={idx}
                      className="text-[11px] font-mono px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="truncate">{method}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedTech(null)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
