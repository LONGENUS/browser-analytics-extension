import React from 'react';
import { TemplateId } from '../../../types/template';
import { AVAILABLE_TEMPLATES } from './templateRegistry';
import { Check, ShieldCheck, Sparkles, LayoutGrid } from 'lucide-react';

interface TemplateSelectorProps {
  selectedTemplateId: TemplateId;
  onSelectTemplate: (templateId: TemplateId) => void;
  disabled?: boolean;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedTemplateId,
  onSelectTemplate,
  disabled = false,
}) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2.5">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <LayoutGrid className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Resume Template
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Presentation-only styling. Your underlying resume content is 100% preserved.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {AVAILABLE_TEMPLATES.map((tmpl) => {
          const isSelected = tmpl.id === selectedTemplateId;

          return (
            <button
              key={tmpl.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectTemplate(tmpl.id)}
              aria-pressed={isSelected}
              className={`relative flex flex-col text-left p-3.5 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-500 shadow-sm ring-1 ring-blue-600/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* Selected checkmark badge */}
              {isSelected && (
                <span className="absolute top-2.5 right-2.5 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-xs">
                  <Check className="w-3.5 h-3.5" />
                </span>
              )}

              {/* Title & ATS badge */}
              <div className="flex items-center gap-1.5 pr-6">
                <span className="font-semibold text-sm text-slate-900 dark:text-white">
                  {tmpl.name}
                </span>
                {tmpl.atsSafe && (
                  <span
                    title="Engineered for high ATS parseability"
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                  >
                    <ShieldCheck className="w-3 h-3" />
                    ATS
                  </span>
                )}
              </div>

              {/* Short Description */}
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed flex-1">
                {tmpl.description}
              </p>

              {/* Version & Tag */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>{tmpl.version}</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {isSelected ? 'Active' : 'Select'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
