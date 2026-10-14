import React from 'react';
import { Skill } from '../../../types/resume';
import { ResumeTemplateConfig } from '../../../types/template';

interface ResumeSkillsProps {
  skills?: Skill[];
  config: ResumeTemplateConfig;
}

export const ResumeSkills: React.FC<ResumeSkillsProps> = ({ skills, config }) => {
  if (!skills || skills.length === 0) return null;

  const validSkills = skills.filter((s) => s.skill_name?.trim());
  if (validSkills.length === 0) return null;

  const { typography, colors, spacing, layout } = config;

  // Check if skills have categories
  const hasCategories = validSkills.some((s) => s.category?.trim());

  const categorizedSkills = validSkills.reduce<Record<string, string[]>>((acc, s) => {
    const cat = s.category?.trim() || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s.skill_name.trim());
    return acc;
  }, {});

  const renderContent = () => {
    // 1. Badges layout (Used by Professional)
    if (layout.skillsDisplay === 'badges') {
      if (hasCategories) {
        return (
          <div className="space-y-2">
            {Object.entries(categorizedSkills).map(([cat, list]) => (
              <div key={cat} className="flex flex-wrap items-center gap-1.5">
                <span className={`${typography.itemSubtitleSize} font-bold text-slate-800 mr-1`}>
                  {cat}:
                </span>
                {list.map((skillName, idx) => (
                  <span
                    key={`${cat}-${idx}`}
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${colors.accentBackground || 'bg-slate-100 text-slate-800 border-slate-200'}`}
                  >
                    {skillName}
                  </span>
                ))}
              </div>
            ))}
          </div>
        );
      }

      return (
        <div className="flex flex-wrap gap-1.5">
          {validSkills.map((s, idx) => (
            <span
              key={s.id || `sk-${idx}`}
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${colors.accentBackground || 'bg-slate-100 text-slate-800 border-slate-200'}`}
            >
              {s.skill_name}
            </span>
          ))}
        </div>
      );
    }

    // 2. Compact tags layout (Used by Compact)
    if (layout.skillsDisplay === 'compact-tags') {
      if (hasCategories) {
        return (
          <div className="space-y-1">
            {Object.entries(categorizedSkills).map(([cat, list]) => (
              <div key={cat} className={`${typography.bodySize} ${typography.lineHeight} break-words`}>
                <span className="font-semibold text-slate-900">{cat}: </span>
                <span className={colors.textSecondary}>{list.join(' • ')}</span>
              </div>
            ))}
          </div>
        );
      }

      return (
        <div className={`${typography.bodySize} ${typography.lineHeight} ${colors.textSecondary} break-words`}>
          {validSkills.map((s) => s.skill_name).join(' • ')}
        </div>
      );
    }

    // 3. Default ATS Classic: Inline semantic text
    if (hasCategories) {
      return (
        <div className="space-y-1.5">
          {Object.entries(categorizedSkills).map(([cat, list]) => (
            <div key={cat} className={`${typography.bodySize} ${typography.lineHeight} break-words`}>
              <strong className="font-semibold text-slate-900">{cat}: </strong>
              <span className={colors.textSecondary}>{list.join(', ')}</span>
            </div>
          ))}
        </div>
      );
    }

    return (
      <p className={`${typography.bodySize} ${typography.lineHeight} ${colors.textSecondary} break-words`}>
        {validSkills.map((s) => s.skill_name).join(', ')}
      </p>
    );
  };

  return (
    <section className="break-inside-avoid">
      <h2 className={`${typography.sectionHeadingSize} ${colors.accent} ${colors.sectionBorder} ${spacing.headingMarginBottom}`}>
        Skills
      </h2>
      {renderContent()}
    </section>
  );
};
