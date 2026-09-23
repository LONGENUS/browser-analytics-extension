import React from 'react';
import { FileText, FileSpreadsheet, Code2, Sheet, SlidersHorizontal } from 'lucide-react';
import { triggerExport } from '../services/api';
import { FullDossier } from '../types';

interface ExportBarProps {
  dossier: FullDossier;
}

export const ExportBar: React.FC<ExportBarProps> = ({ dossier }) => {
  const handleExport = (fmt: 'csv' | 'xlsx' | 'json') => {
    const domain = dossier.domain || 'website';
    triggerExport(dossier, fmt, `webintel-${domain}`);
  };

  const handleGoogleSheets = () => {
    // Copy CSV data to clipboard for fast paste into Google Sheets
    const items = dossier.products || [];
    if (items.length > 0) {
      const headers = Object.keys(items[0]).filter((k) => typeof (items[0] as any)[k] !== 'object');
      const csvRows = [headers.join('\t')];
      for (const item of items) {
        const row = headers.map((h) => String((item as any)[h] ?? '').replace(/\t/g, ' '));
        csvRows.push(row.join('\t'));
      }
      navigator.clipboard.writeText(csvRows.join('\n'));
      alert('Tabular data copied to clipboard! Paste directly into Google Sheets (Ctrl+V).');
    } else {
      alert('No product rows available to copy.');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
          <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
          Export Data
        </span>
        <span className="text-[10px] text-slate-400">One-click multi-format</span>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        <button
          onClick={() => handleExport('csv')}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-slate-700 dark:text-slate-300 transition-all text-center group"
        >
          <FileText className="w-4 h-4 text-emerald-600 mb-1 group-hover:scale-110 transition-transform" />
          <span className="text-[11px] font-medium">CSV</span>
        </button>

        <button
          onClick={() => handleExport('xlsx')}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-slate-700 dark:text-slate-300 transition-all text-center group"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600 mb-1 group-hover:scale-110 transition-transform" />
          <span className="text-[11px] font-medium">Excel</span>
        </button>

        <button
          onClick={() => handleExport('json')}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 text-slate-700 dark:text-slate-300 transition-all text-center group"
        >
          <Code2 className="w-4 h-4 text-purple-600 mb-1 group-hover:scale-110 transition-transform" />
          <span className="text-[11px] font-medium">JSON</span>
        </button>

        <button
          onClick={handleGoogleSheets}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-rose-500/50 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 text-slate-700 dark:text-slate-300 transition-all text-center group"
        >
          <Sheet className="w-4 h-4 text-rose-600 mb-1 group-hover:scale-110 transition-transform" />
          <span className="text-[11px] font-medium">Sheets</span>
        </button>

        <button
          onClick={() => alert('Custom Export: All 5 intelligence modules included in full JSON export.')}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-slate-700 dark:text-slate-300 transition-all text-center group"
        >
          <SlidersHorizontal className="w-4 h-4 text-blue-600 mb-1 group-hover:scale-110 transition-transform" />
          <span className="text-[11px] font-medium">Custom</span>
        </button>
      </div>
    </div>
  );
};
