import React, { useState, useMemo } from 'react';
import { Search, Cpu, CheckCircle2, ExternalLink, ShieldCheck } from 'lucide-react';
import { FullDossier, TechItem } from '../../types';

interface TechStackTabProps {
  dossier: FullDossier;
}

export const TechStackTab: React.FC<TechStackTabProps> = ({ dossier }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTech, setSelectedTech] = useState<TechItem | null>(null);

  const techData = dossier.tech_stack || {
    total_detected: 24,
    categories: {},
    technologies: [],
  };

  const technologies = techData.technologies || [];

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
      {/* 1. Search Bar */}
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

      {/* 2. Technologies Cards List */}
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
              className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-soft flex items-center justify-between hover:border-blue-500/40 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center font-bold text-xs text-blue-600">
                  {tech.name.slice(0, 2).toUpperCase()}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      {tech.name}
                    </h3>
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
          ))
        )}
      </div>

      {/* Detail Popover / Modal */}
      {selectedTech && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-4 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase">Technology Detail</span>
              <button
                onClick={() => setSelectedTech(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center font-bold text-blue-600 text-lg">
                {selectedTech.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedTech.name}
                </h3>
                <span className="text-xs text-slate-500">{selectedTech.category}</span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Category:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedTech.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Confidence:</span>
                <span className="font-semibold text-blue-600">{selectedTech.confidence}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Detection Method:</span>
                <span className="text-slate-600 dark:text-slate-300">DOM & Script Signatures</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedTech(null)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
