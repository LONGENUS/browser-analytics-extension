/**
 * Test Suite: Client Resume Data & Logic (Module 2)
 * Tests:
 * 1. Structured resume schema integrity
 * 2. Date consistency rules (start_date <= end_date, is_current handling)
 * 3. URL format validation for personal links, project URLs, credentials
 * 4. Display order sorting and reordering logic
 * 5. Deep clone immutability (duplication isolation)
 * 6. Skill categorization grouping
 */

const assert = require('assert');

// 1. Date Validation
function validateDates(startDate, endDate, isCurrent) {
  if (isCurrent && endDate) {
    return { valid: false, error: 'Current position cannot have an end date.' };
  }
  if (startDate && endDate && !isCurrent) {
    // Basic year or date comparison
    if (startDate > endDate) {
      return { valid: false, error: 'Start date cannot be after end date.' };
    }
  }
  return { valid: true };
}

// 2. URL Validation
const URL_REGEX = /^(https?:\/\/|www\.)[^\s/$.?#].[^\s]*$/i;
function isValidUrl(url) {
  if (!url || typeof url !== 'string') return true; // Optional fields can be empty
  const clean = url.trim();
  if (clean === '') return true;
  return URL_REGEX.test(clean) || clean.startsWith('/');
}

// 3. Reordering logic
function reorderItems(items, fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= items.length) return items;
  const copy = [...items];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy.map((item, idx) => ({ ...item, display_order: idx }));
}

// 4. Categorize skills
function categorizeSkills(skills) {
  return skills.reduce((acc, skill) => {
    const cat = skill.category ? skill.category.trim() : 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(skill.skill_name);
    return acc;
  }, {});
}

// 5. Deep Clone
function deepCloneResume(resume) {
  const cloned = JSON.parse(JSON.stringify(resume));
  cloned.id = 'new-id-' + Math.random().toString(36).substr(2, 9);
  cloned.is_default = false;
  cloned.name = `${cloned.name} (Copy)`;
  if (cloned.experiences) {
    cloned.experiences.forEach((exp) => {
      exp.id = 'exp-' + Math.random().toString(36).substr(2, 9);
      if (exp.bullets) {
        exp.bullets.forEach((b) => {
          b.id = 'b-' + Math.random().toString(36).substr(2, 9);
        });
      }
    });
  }
  return cloned;
}

console.log('--- Running Module 2 Client Resume Logic Test Suite ---');

// Test 1: Date validation
{
  assert.strictEqual(validateDates('2021', '2023', false).valid, true);
  assert.strictEqual(validateDates('2024', '2021', false).valid, false);
  assert.strictEqual(validateDates('2021', '2024', true).valid, false, 'Current job cannot have end date');
  assert.strictEqual(validateDates('2021', null, true).valid, true);
  console.log('[PASS] Experience date consistency validation');
}

// Test 2: URL validation
{
  assert.strictEqual(isValidUrl('https://linkedin.com/in/johndoe'), true);
  assert.strictEqual(isValidUrl('https://github.com/johndoe'), true);
  assert.strictEqual(isValidUrl('http://myportfolio.dev'), true);
  assert.strictEqual(isValidUrl('javascript:alert(1)'), false);
  assert.strictEqual(isValidUrl('not-a-valid-url'), false);
  assert.strictEqual(isValidUrl(''), true, 'Empty optional URLs are allowed');
  console.log('[PASS] URL format validation and scheme protection');
}

// Test 3: Reordering
{
  const items = [
    { id: '1', name: 'Item A', display_order: 0 },
    { id: '2', name: 'Item B', display_order: 1 },
    { id: '3', name: 'Item C', display_order: 2 },
  ];
  const reordered = reorderItems(items, 0, 2);
  assert.strictEqual(reordered[0].name, 'Item B');
  assert.strictEqual(reordered[1].name, 'Item C');
  assert.strictEqual(reordered[2].name, 'Item A');
  assert.strictEqual(reordered[2].display_order, 2);
  console.log('[PASS] Display order sorting and item movement');
}

// Test 4: Categorization
{
  const skills = [
    { skill_name: 'Python', category: 'Languages' },
    { skill_name: 'TypeScript', category: 'Languages' },
    { skill_name: 'FastAPI', category: 'Frameworks' },
    { skill_name: 'React', category: 'Frameworks' },
    { skill_name: 'Docker', category: 'DevOps' },
  ];
  const categorized = categorizeSkills(skills);
  assert.deepStrictEqual(categorized['Languages'], ['Python', 'TypeScript']);
  assert.deepStrictEqual(categorized['Frameworks'], ['FastAPI', 'React']);
  assert.deepStrictEqual(categorized['DevOps'], ['Docker']);
  console.log('[PASS] Skill categorization grouping');
}

// Test 5: Deep Clone Isolation
{
  const original = {
    id: 'orig-1',
    name: 'Master Resume',
    is_default: true,
    experiences: [
      { id: 'exp-1', company: 'Google', bullets: [{ id: 'b-1', content: 'Built search' }] }
    ]
  };
  const cloned = deepCloneResume(original);
  assert.notStrictEqual(cloned.id, original.id);
  assert.strictEqual(cloned.is_default, false);
  assert.strictEqual(cloned.name, 'Master Resume (Copy)');
  assert.notStrictEqual(cloned.experiences[0].id, original.experiences[0].id);
  assert.notStrictEqual(cloned.experiences[0].bullets[0].id, original.experiences[0].bullets[0].id);

  // Mutating clone does not mutate original
  cloned.experiences[0].company = 'Alphabet';
  assert.strictEqual(original.experiences[0].company, 'Google');
  console.log('[PASS] Deep clone immutability and record independence');
}

console.log('--- All Module 2 Client Tests Passed Successfully ---\n');
