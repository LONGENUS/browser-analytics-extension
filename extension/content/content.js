/* ==============================================================================
   TailorResume — Extension Content Script (Module 4)
   Deterministically extracts job title, company, location, and description
   from active browser tab when user opens extension or requests detection.
   - Zero LLM calls.
   - Zero background tracking or automatic page transmissions.
   - Robust JSON-LD, site adapters (LinkedIn, Naukri, Indeed, Greenhouse, Lever),
     and generic semantic extraction.
   ============================================================================== */

(() => {
  'use strict';

  const NOISE_TAGS = new Set([
    'script', 'style', 'noscript', 'nav', 'footer', 'header', 'svg', 'iframe',
    'button', 'form', 'select', 'input', 'textarea', 'canvas', 'video', 'audio'
  ]);

  const NOISE_SELECTORS = [
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '.cookie-banner', '.cookie-notice', '#cookie-banner',
    '.advertisement', '.ad-container', '.ads',
    '.social-share', '.share-buttons', '.sign-in-modal', '.login-modal'
  ];

  function removeNoise(container) {
    for (const sel of NOISE_SELECTORS) {
      try {
        container.querySelectorAll(sel).forEach(el => el.remove());
      } catch (_) {}
    }
    container.querySelectorAll('*').forEach(el => {
      if (NOISE_TAGS.has(el.tagName.toLowerCase())) {
        el.remove();
      }
    });
  }

  function domToText(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }
    const el = node;
    const tag = el.tagName.toLowerCase();
    if (NOISE_TAGS.has(tag)) return '';

    let text = '';
    for (const child of Array.from(el.childNodes)) {
      text += domToText(child);
    }

    if (tag === 'br') return '\n';
    if (tag === 'li') return `\n• ${text.trim()}\n`;
    if (/^h[1-6]$/.test(tag)) return `\n\n${text.trim()}\n`;
    if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article') {
      const trimmed = text.trim();
      return trimmed ? `\n\n${trimmed}\n` : '';
    }
    return text;
  }

  function cleanText(text, maxLen = 50000) {
    if (!text) return '';
    let cleaned = text
      .replace(/\u00a0/g, ' ')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    cleaned = cleaned
      .split('\n')
      .map(line => line.replace(/[ \t]+/g, ' ').trim())
      .join('\n');

    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
    if (cleaned.length > maxLen) {
      cleaned = cleaned.slice(0, maxLen) + '\n\n... [Content truncated at character limit]';
    }
    return cleaned;
  }

  function htmlToText(rawHtml) {
    if (!rawHtml) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, 'text/html');
      removeNoise(doc.body);
      return cleanText(domToText(doc.body));
    } catch (_) {
      return cleanText(rawHtml.replace(/<[^>]+>/g, ' '));
    }
  }

  function detectSource(url) {
    const u = (url || '').toLowerCase();
    if (u.includes('linkedin.com')) return 'linkedin';
    if (u.includes('naukri.com')) return 'naukri';
    if (u.includes('indeed.com')) return 'indeed';
    if (
      u.includes('greenhouse.io') || u.includes('lever.co') ||
      u.includes('ashbyhq.com') || u.includes('myworkdayjobs.com') ||
      u.includes('smartrecruiters.com') || u.includes('/careers') ||
      u.includes('/career') || u.includes('/jobs')
    ) {
      return 'company_site';
    }
    if (u.includes('ziprecruiter.com') || u.includes('monster.com') || u.includes('dice.com') || u.includes('glassdoor.com')) {
      return 'job_board';
    }
    return 'other';
  }

  function extractJsonLd(doc) {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const s of Array.from(scripts)) {
      const content = s.textContent?.trim();
      if (!content) continue;
      try {
        const parsed = JSON.parse(content);
        const obj = findJobPosting(parsed);
        if (obj) {
          const title = (obj.title || obj.name || '').trim();
          const desc = htmlToText(obj.description || '');
          if (title || desc) {
            let company = null;
            if (obj.hiringOrganization && typeof obj.hiringOrganization === 'object') {
              company = obj.hiringOrganization.name || obj.hiringOrganization.legalName || null;
            } else if (typeof obj.hiringOrganization === 'string') {
              company = obj.hiringOrganization;
            }

            let location = null;
            if (obj.jobLocation) {
              const loc = Array.isArray(obj.jobLocation) ? obj.jobLocation[0] : obj.jobLocation;
              if (loc && loc.address) {
                const a = loc.address;
                location = [a.addressLocality, a.addressRegion, a.addressCountry].filter(Boolean).join(', ');
              } else if (loc && loc.name) {
                location = loc.name;
              }
            } else if (obj.applicantLocationRequirements) {
              location = 'Remote (' + (obj.applicantLocationRequirements.name || 'Worldwide') + ')';
            }

            return {
              title: cleanText(title),
              company_name: company ? cleanText(company) : null,
              location: location ? cleanText(location) : null,
              employment_type: obj.employmentType ? cleanText(String(obj.employmentType).replace(/_/g, ' ')) : null,
              description: desc,
              salary_text: obj.baseSalary?.value?.value ? `${obj.baseSalary.currency || ''} ${obj.baseSalary.value.value}`.trim() : null,
              job_posted_at: obj.datePosted ? String(obj.datePosted).trim() : null,
            };
          }
        }
      } catch (_) {}
    }
    return null;
  }

  function findJobPosting(data) {
    if (!data || typeof data !== 'object') return null;
    const type = data['@type'];
    if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) {
      return data;
    }
    if (Array.isArray(data['@graph'])) {
      for (const item of data['@graph']) {
        const found = findJobPosting(item);
        if (found) return found;
      }
    }
    if (Array.isArray(data)) {
      for (const item of data) {
        const found = findJobPosting(item);
        if (found) return found;
      }
    }
    return null;
  }

  function getFirst(doc, selectors) {
    for (const sel of selectors) {
      try {
        const el = doc.querySelector(sel);
        if (el && el.textContent?.trim()) return el.textContent.trim();
      } catch (_) {}
    }
    return '';
  }

  function getElText(doc, selectors) {
    for (const sel of selectors) {
      try {
        const el = doc.querySelector(sel);
        if (el) {
          const clone = el.cloneNode(true);
          removeNoise(clone);
          const t = domToText(clone);
          if (t && t.trim().length > 30) return t;
        }
      } catch (_) {}
    }
    return '';
  }

  function extractSite(source, doc) {
    if (source === 'linkedin') {
      // Prioritize job details container on split-pane search view or full job page
      const detailsContainer = doc.querySelector(
        '.jobs-search__job-details--container, .jobs-search__job-details, .jobs-details__main-content, .job-view-layout, .jobs-details, main.jobs-search__job-details, div[class*="job-details"]'
      ) || doc;

      // Extract title specifically within detailsContainer or specific top card selectors
      let title = getFirst(detailsContainer, [
        'h1.job-details-jobs-unified-top-card__job-title',
        'h2.job-details-jobs-unified-top-card__job-title',
        '.job-details-jobs-unified-top-card__job-title',
        '.jobs-unified-top-card__job-title',
        '.jobs-details__main-content h1',
        '.jobs-search__job-details--container h1',
        '.jobs-search__job-details--container h2',
        'h1.t-24',
        'h2.t-24',
        'h1.top-card-layout__title',
        'h1.topcard__title',
        'a[href*="/jobs/view/"]'
      ]);

      if (!title && detailsContainer !== doc) {
        title = getFirst(detailsContainer, ['h1', 'h2']);
      }
      if (!title) {
        title = getFirst(doc, [
          'h1.job-details-jobs-unified-top-card__job-title',
          '.job-details-jobs-unified-top-card__job-title',
          '.jobs-unified-top-card__job-title',
          'h1.top-card-layout__title',
          'h1.topcard__title'
        ]);
      }

      const company = getFirst(detailsContainer, [
        'div.job-details-jobs-unified-top-card__company-name a',
        'div.job-details-jobs-unified-top-card__company-name',
        '.job-details-jobs-unified-top-card__company-name',
        '.job-details-jobs-unified-top-card__primary-description a[href*="/company/"]',
        '.job-details-jobs-unified-top-card__primary-description a',
        '.job-details-jobs-unified-top-card__primary-description',
        '.jobs-unified-top-card__company-name a',
        '.jobs-unified-top-card__company-name',
        'a.topcard__org-name-link',
        '.topcard__flavor--black-link',
        'a[href*="/company/"]'
      ]) || getFirst(doc, [
        'a.topcard__org-name-link',
        '.topcard__flavor--black-link',
        '.jobs-unified-top-card__company-name a',
        '.jobs-unified-top-card__company-name'
      ]);

      const location = getFirst(detailsContainer, [
        '.job-details-jobs-unified-top-card__bullet',
        '.job-details-jobs-unified-top-card__primary-description-container span',
        '.jobs-unified-top-card__bullet',
        '.topcard__flavor--bullet',
        '.job-details-jobs-unified-top-card__primary-description-container'
      ]) || getFirst(doc, [
        '.topcard__flavor--bullet',
        '.job-details-jobs-unified-top-card__bullet',
        '.jobs-unified-top-card__bullet'
      ]);

      const desc = getElText(detailsContainer, [
        '#job-details',
        '.jobs-description__content',
        '.jobs-box__html-content',
        'article.jobs-description__container',
        '.jobs-description-content__text',
        'div[class*="jobs-description"]',
        '.jobs-description',
        '.show-more-less-html__markup',
        '.description__text',
        'article'
      ]) || getElText(doc, [
        '#job-details',
        '.jobs-description__content',
        '.jobs-box__html-content',
        'article.jobs-description__container',
        '.jobs-description-content__text',
        'div[class*="jobs-description"]',
        '.jobs-description',
        '.show-more-less-html__markup',
        '.description__text'
      ]);

      if (title || desc) {
        return {
          title: cleanText(title || (doc.title ? doc.title.replace(/\s*[|\-–—].*$/, '') : 'Job Opportunity')),
          company_name: company ? cleanText(company) : null,
          location: location ? cleanText(location) : null,
          description: cleanText(desc),
        };
      }
    }

    if (source === 'naukri') {
      const title = getFirst(doc, ['h1[class*="jd-header-title"]', 'h1.jd-header-title', 'h1']);
      const company = getFirst(doc, ['a[class*="jd-header-comp-name"]', '.jd-header-comp-name']);
      const location = getFirst(doc, ['span[class*="jdn-header-loc"]', '.location']);
      const desc = getElText(doc, ['section[class*="job-desc-container"]', '.job-desc-section', '.dang-inner-html', '.job-description']);
      if (title && desc) {
        return {
          title: cleanText(title),
          company_name: company ? cleanText(company) : null,
          location: location ? cleanText(location) : null,
          description: cleanText(desc),
        };
      }
    }

    if (source === 'indeed') {
      const title = getFirst(doc, ['h1.jobsearch-JobInfoHeader-title', 'h1[data-testid="jobsearch-JobInfoHeader-title"]', 'h1']);
      const company = getFirst(doc, ['div[data-company-name="true"]', 'div.jobsearch-CompanyInfoContainer a', 'div[data-testid="inlineHeader-companyName"]']);
      const location = getFirst(doc, ['div[data-testid="inlineHeader-companyLocation"]', 'div[data-testid="job-location"]']);
      const desc = getElText(doc, ['#jobDescriptionText', '.jobsearch-jobDescriptionText', 'div[data-testid="jobDescriptionText"]']);
      if (title && desc) {
        return {
          title: cleanText(title),
          company_name: company ? cleanText(company) : null,
          location: location ? cleanText(location) : null,
          description: cleanText(desc),
        };
      }
    }

    if (source === 'company_site') {
      // Greenhouse
      const ghTitle = getFirst(doc, ['.app-title', '#header h1', 'h1.app-title']);
      const ghDesc = getElText(doc, ['#content', '#main', '.content']);
      if (ghTitle && ghDesc) {
        const ghCompany = getFirst(doc, ['.company-name', '#header .company-name']);
        const ghLoc = getFirst(doc, ['.location', '.app-location']);
        return {
          title: cleanText(ghTitle),
          company_name: ghCompany ? cleanText(ghCompany) : null,
          location: ghLoc ? cleanText(ghLoc) : null,
          description: cleanText(ghDesc),
        };
      }

      // Lever
      const leverTitle = getFirst(doc, ['.posting-headline h2', '.posting-headline h1']);
      const leverDesc = getElText(doc, ['.content-wrapper .section-wrapper', '.section.page-centered']);
      if (leverTitle && leverDesc) {
        const leverLoc = getFirst(doc, ['.posting-categories .location', '.sort-by-time.posting-category']);
        return {
          title: cleanText(leverTitle),
          company_name: null,
          location: leverLoc ? cleanText(leverLoc) : null,
          description: cleanText(leverDesc),
        };
      }

      // Workday
      const wdTitle = getFirst(doc, ['h2[data-automation-id="jobPostingHeader"]', 'h1']);
      const wdDesc = getElText(doc, ['[data-automation-id="jobPostingDescription"]']);
      if (wdTitle && wdDesc) {
        const wdLoc = getFirst(doc, ['[data-automation-id="locations"]', '[data-automation-id="jobPostingLocation"]']);
        return {
          title: cleanText(wdTitle),
          company_name: null,
          location: wdLoc ? cleanText(wdLoc) : null,
          description: cleanText(wdDesc),
        };
      }

      // Ashby
      const ashbyTitle = getFirst(doc, ['h1[class*="title"]', 'h1']);
      const ashbyDesc = getElText(doc, ['div[class*="description"]', 'div[id="_ashby_root"]', '.ashby-job-posting-description']);
      if (ashbyTitle && ashbyDesc) {
        const ashbyLoc = getFirst(doc, ['div[class*="location"]', '.ashby-job-posting-location']);
        return {
          title: cleanText(ashbyTitle),
          company_name: null,
          location: ashbyLoc ? cleanText(ashbyLoc) : null,
          description: cleanText(ashbyDesc),
        };
      }

      // SmartRecruiters
      const srTitle = getFirst(doc, ['h1.job-title', '.job-header h1']);
      const srDesc = getElText(doc, ['.job-sections', '.job-detail', '#job-description']);
      if (srTitle && srDesc) {
        const srCompany = getFirst(doc, ['.company-name', '.employer-name']);
        const srLoc = getFirst(doc, ['.job-location', '.job-detail-location']);
        return {
          title: cleanText(srTitle),
          company_name: srCompany ? cleanText(srCompany) : null,
          location: srLoc ? cleanText(srLoc) : null,
          description: cleanText(srDesc),
        };
      }
    }

    return null;
  }

  function extractGeneric(doc) {
    let title = '';
    const h1 = doc.querySelector('h1');
    if (h1 && h1.textContent?.trim() && h1.textContent.trim().length <= 120) {
      title = h1.textContent.trim();
    } else {
      title = (doc.title || '').replace(/\s*[|\-–—].*$/, '').trim();
    }

    const mainEl = doc.querySelector('main, article, [role="main"], .job-description, #content') || doc.body;
    if (!mainEl) return null;

    const clone = mainEl.cloneNode(true);
    removeNoise(clone);
    const desc = cleanText(domToText(clone));
    if (!desc || desc.length < 50) return null;

    return {
      title: cleanText(title || 'Job Opportunity'),
      company_name: doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || null,
      location: null,
      description: desc,
    };
  }

  function extractCurrentJob() {
    const url = window.location.href;
    const source = detectSource(url);

    // 1. JSON-LD
    const jsonLd = extractJsonLd(document);
    if (jsonLd && jsonLd.description && jsonLd.description.length >= 50) {
      return {
        is_job_page: true,
        confidence: 'high',
        extraction_method: 'json_ld',
        source,
        source_url: url,
        job_title: jsonLd.title || 'Job Opportunity',
        company_name: jsonLd.company_name,
        company_url: null,
        location: jsonLd.location,
        employment_type: jsonLd.employment_type,
        work_mode: (jsonLd.location || '').toLowerCase().includes('remote') ? 'Remote' : null,
        department: null,
        job_description: jsonLd.description,
        salary_text: jsonLd.salary_text,
        job_posted_at: jsonLd.job_posted_at,
      };
    }

    // 2. Site adapter
    const site = extractSite(source, document);
    if (site && site.description && site.description.length >= 50) {
      return {
        is_job_page: true,
        confidence: 'high',
        extraction_method: 'site_adapter',
        source,
        source_url: url,
        job_title: site.title,
        company_name: site.company_name,
        company_url: null,
        location: site.location,
        employment_type: null,
        work_mode: (site.location || '').toLowerCase().includes('remote') ? 'Remote' : null,
        department: null,
        job_description: site.description,
        salary_text: null,
        job_posted_at: null,
      };
    }

    // 3. Generic
    const generic = extractGeneric(document);
    if (generic && generic.description && generic.description.length >= 50) {
      return {
        is_job_page: true,
        confidence: generic.description.length > 250 ? 'medium' : 'low',
        extraction_method: 'generic_dom',
        source,
        source_url: url,
        job_title: generic.title,
        company_name: generic.company_name,
        company_url: null,
        location: generic.location,
        employment_type: null,
        work_mode: null,
        department: null,
        job_description: generic.description,
        salary_text: null,
        job_posted_at: null,
      };
    }

    // Fallback: Not a job page
    return {
      is_job_page: false,
      confidence: 'low',
      extraction_method: 'generic_dom',
      source,
      source_url: url,
      job_title: '',
      company_name: null,
      company_url: null,
      location: null,
      employment_type: null,
      work_mode: null,
      department: null,
      job_description: '',
      salary_text: null,
      job_posted_at: null,
      raw_warnings: ['Could not detect a job posting on this page.'],
    };
  }

  // Expose globally for script execution fallback
  if (typeof window !== 'undefined') {
    window.__tailorResumeExtract = extractCurrentJob;
  }

  // Listen for message from extension side panel
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'EXTRACT_JOB_DATA') {
        try {
          const data = extractCurrentJob();
          sendResponse({ success: true, data });
        } catch (err) {
          sendResponse({ success: false, error: err ? err.message : 'Extraction error' });
        }
        return false;
      }
      if (message.type === 'PING') {
        sendResponse({ success: true, status: 'active', url: window.location.href });
        return false;
      }
      return false;
    });
  }
})();
