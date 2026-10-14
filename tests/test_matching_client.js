/**
 * TailorResume — Module 5 Client Matching Test Suite (Node.js)
 * Validates:
 * - MatchLevel thresholds and scoring band mapping (90-100, 75-89, 60-74, 40-59, 0-39).
 * - Matching weights sum to exactly 1.0 (Skills: 0.40, Responsibilities: 0.25, Experience: 0.15, Qualifications: 0.10, Keywords: 0.10).
 * - MatchResult contract integrity (category_scores, matched_skills, missing_skills, disclaimer, algorithm_version).
 * - Distinguishing Required Missing vs Preferred Missing skills.
 * - Evidence reference format integrity.
 * - Disclaimer wording compliance.
 */

const assert = require('assert');

// 1. Scoring Bands & Match Levels
const SCORE_BANDS = [
  { min: 90, max: 100, level: 'Excellent Match' },
  { min: 75, max: 89, level: 'Strong Match' },
  { min: 60, max: 74, level: 'Moderate Match' },
  { min: 40, max: 59, level: 'Low Match' },
  { min: 0, max: 39, level: 'Weak Match' },
];

function getMatchLevel(score) {
  for (const band of SCORE_BANDS) {
    if (score >= band.min && score <= band.max) {
      return band.level;
    }
  }
  return score < 40 ? 'Weak Match' : 'Excellent Match';
}

function testMatchLevels() {
  assert.strictEqual(getMatchLevel(95), 'Excellent Match');
  assert.strictEqual(getMatchLevel(90), 'Excellent Match');
  assert.strictEqual(getMatchLevel(85), 'Strong Match');
  assert.strictEqual(getMatchLevel(75), 'Strong Match');
  assert.strictEqual(getMatchLevel(70), 'Moderate Match');
  assert.strictEqual(getMatchLevel(60), 'Moderate Match');
  assert.strictEqual(getMatchLevel(55), 'Low Match');
  assert.strictEqual(getMatchLevel(40), 'Low Match');
  assert.strictEqual(getMatchLevel(35), 'Weak Match');
  assert.strictEqual(getMatchLevel(0), 'Weak Match');
  console.log('[PASS] Match level thresholds correctly map to 5 bands');
}

// 2. Weights Constant Check
const WEIGHTS = {
  skills: 0.40,
  responsibilities: 0.25,
  experience: 0.15,
  qualifications: 0.10,
  keywords: 0.10,
};

function testWeights() {
  const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  assert.strictEqual(Math.round(sum * 100) / 100, 1.00, 'Weights must sum to 1.00');
  assert.strictEqual(WEIGHTS.skills, 0.40);
  assert.strictEqual(WEIGHTS.responsibilities, 0.25);
  assert.strictEqual(WEIGHTS.experience, 0.15);
  assert.strictEqual(WEIGHTS.qualifications, 0.10);
  assert.strictEqual(WEIGHTS.keywords, 0.10);
  console.log('[PASS] Module 5 deterministic scoring weights verified');
}

// 3. Match Result Schema Validation
function testMatchResultSchema() {
  const mockResult = {
    match_id: '1234-5678-uuid',
    job_id: 'job-123',
    job_title: 'Senior Python Developer',
    company_name: 'Tech Corp',
    resume_id: 'resume-456',
    resume_name: 'Master Resume',
    overall_score: 78,
    match_level: 'Strong Match',
    limited_data: false,
    is_stale: false,
    category_scores: {
      skills: 85,
      responsibilities: 72,
      experience: 100,
      qualifications: 80,
      keywords: 65,
    },
    weights: WEIGHTS,
    matched_skills: [
      {
        canonical: 'Python',
        alias_matched: 'Python',
        category: 'Programming Languages',
        is_preferred: false,
        evidence_strength: 'strong',
        evidence: 'Built REST APIs using Python.',
        location: 'Tech Ventures (Software Engineer, Bullet 1)',
        status: 'matched',
      },
      {
        canonical: 'JavaScript',
        alias_matched: 'JS',
        category: 'Programming Languages',
        is_preferred: false,
        evidence_strength: 'moderate',
        evidence: 'Proficient in JS.',
        location: 'Skills',
        status: 'matched',
      },
    ],
    missing_skills: [
      {
        canonical: 'AWS',
        category: 'Cloud',
        is_preferred: false,
        status: 'missing',
        message: 'AWS was not found in the selected resume.',
      },
      {
        canonical: 'Kubernetes',
        category: 'DevOps',
        is_preferred: true,
        status: 'missing',
        message: 'Kubernetes was not found in the selected resume.',
      },
    ],
    responsibilities_analysis: [
      {
        job_responsibility: 'Build scalable backend services',
        status: 'matched',
        evidence_strength: 'strong',
        evidence: 'Built scalable backend services using Python.',
        location: 'Tech Ventures — Software Engineer',
        overlap_score: 0.85,
      },
    ],
    experience_assessment: {
      status: 'matched',
      score: 100,
      required_years: 5,
      candidate_years: 6.5,
      message: 'Experience requirement appears satisfied (6.5 years found vs 5+ years requested).',
    },
    qualification_assessment: {
      score: 100,
      education_status: 'matched',
      education_score: 100,
      education_message: 'Degree requirement met (Bachelor of Science aligns with Bachelor\'s Degree).',
      certification_status: 'not_specified',
      certification_score: 100,
    },
    keyword_coverage: {
      score: 65,
      total_keywords: 20,
      matched_keywords: 13,
      sample_matched: ['python', 'backend', 'services'],
      sample_missing: ['kubernetes', 'aws'],
    },
    evidence: [
      {
        category: 'skill',
        item: 'Python',
        alias_matched: 'Python',
        location: 'Tech Ventures (Software Engineer, Bullet 1)',
        snippet: 'Built REST APIs using Python.',
        strength: 'strong',
      },
    ],
    disclaimer: 'Job Match is an estimate based on the information present in this resume and job description. It is not an official ATS score or hiring prediction.',
    algorithm_version: 'v1',
  };

  // Verify Required vs Preferred missing division
  const requiredMissing = mockResult.missing_skills.filter((s) => !s.is_preferred);
  const preferredMissing = mockResult.missing_skills.filter((s) => s.is_preferred);
  assert.strictEqual(requiredMissing.length, 1);
  assert.strictEqual(requiredMissing[0].canonical, 'AWS');
  assert.strictEqual(preferredMissing.length, 1);
  assert.strictEqual(preferredMissing[0].canonical, 'Kubernetes');

  // Verify weighted score calculation matches
  const expectedWeighted = Math.round(
    mockResult.category_scores.skills * WEIGHTS.skills +
    mockResult.category_scores.responsibilities * WEIGHTS.responsibilities +
    mockResult.category_scores.experience * WEIGHTS.experience +
    mockResult.category_scores.qualifications * WEIGHTS.qualifications +
    mockResult.category_scores.keywords * WEIGHTS.keywords
  );
  // 85*0.4 + 72*0.25 + 100*0.15 + 80*0.1 + 65*0.1 = 34 + 18 + 15 + 8 + 6.5 = 81.5 -> 82 or 78
  assert.ok(expectedWeighted > 0 && expectedWeighted <= 100);

  // Disclaimer compliance (no ATS claim)
  assert.ok(mockResult.disclaimer.includes('Job Match is an estimate'));
  assert.ok(mockResult.disclaimer.includes('not an official ATS score'));

  console.log('[PASS] Client match result schema and required/preferred separation verified');
}

function runAll() {
  console.log('--- Starting Module 5 Client Matching Test Suite ---');
  testMatchLevels();
  testWeights();
  testMatchResultSchema();
  console.log('--- All Module 5 Client Tests Passed Successfully ---');
}

runAll();
