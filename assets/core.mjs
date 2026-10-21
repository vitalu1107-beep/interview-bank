// The formal bank stays independent of browser state. These helpers have no I/O.
const CATEGORIES = ['A', 'B', 'C', 'D'];
const QUESTION_ID = /^(?:[ABC]\d{2,}|D\d{2,}-\d{2,})$/;
const GROUP_ID = /^[A-Z][A-Z0-9_]*$/;
const SKILL_ID = /^[A-Z]\d+$/;
const EDITABLE_STRINGS = ['title', 'logic', 'note', 'data', 'state'];
const IMPORT_EDITABLE_FIELDS = [...EDITABLE_STRINGS, 'parts', 'skills', 'primarySkill'];
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => structuredClone(value);
const validQuestionId = value => typeof value === 'string' && QUESTION_ID.test(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const validTimestamp = value => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value));

function taxonomyContext(bank, errors) {
  const groups = new Map();
  const categories = new Set();
  if (!Array.isArray(bank.taxonomy)) {
    errors.push('taxonomy must be an array containing A, B, C and D');
  } else {
    for (const category of bank.taxonomy) {
      if (!record(category)) {
        errors.push('taxonomy category must be an object');
        continue;
      }
      if (!CATEGORIES.includes(category.id)) errors.push(`Invalid taxonomy category id: ${String(category.id)}`);
      if (categories.has(category.id)) errors.push(`Duplicate taxonomy category id: ${String(category.id)}`);
      categories.add(category.id);
      if (!nonempty(category.title)) errors.push(`taxonomy ${String(category.id)} title must be a nonempty string`);
      if (typeof category.desc !== 'string') errors.push(`taxonomy ${String(category.id)} desc must be a string`);
      if (!Array.isArray(category.groups)) {
        errors.push(`taxonomy ${String(category.id)} groups must be an array`);
        continue;
      }
      for (const group of category.groups) {
        if (!record(group)) {
          errors.push(`taxonomy ${String(category.id)} group must be an object`);
          continue;
        }
        if (typeof group.id !== 'string' || !GROUP_ID.test(group.id)) errors.push(`Invalid taxonomy group id: ${String(group.id)}`);
        if (groups.has(group.id)) errors.push(`Duplicate taxonomy group id: ${String(group.id)}`);
        groups.set(group.id, category.id);
        if (!nonempty(group.title)) errors.push(`taxonomy group ${String(group.id)} title must be a nonempty string`);
        if (own(group, 'desc') && typeof group.desc !== 'string') errors.push(`taxonomy group ${String(group.id)} desc must be a string`);
        // group.ids is a derived navigation cache, never an authority on items.
      }
    }
  }
  for (const category of CATEGORIES) {
    if (!categories.has(category)) errors.push(`Missing taxonomy category: ${category}`);
  }

  const skillIds = new Set();
  if (!record(bank.skillCategories)) {
    errors.push('skillCategories must be an object');
  } else {
    for (const [id, skill] of Object.entries(bank.skillCategories)) {
      if (!SKILL_ID.test(id)) errors.push(`Invalid skill category id: ${id}`);
      skillIds.add(id);
      if (!record(skill) || !nonempty(skill.name) || !nonempty(skill.short)) {
        errors.push(`skillCategories ${id} name and short must be nonempty strings`);
      } else if (own(skill, 'desc') && typeof skill.desc !== 'string') {
        errors.push(`skillCategories ${id} desc must be a string`);
      }
    }
  }
  return { groups, skillIds };
}

function validateEditableContent(item, errors) {
  if (!record(item)) {
    errors.push('Each item must be an object');
    return;
  }
  const label = validQuestionId(item.id) ? item.id : `item ${String(item.id)}`;
  if (!validQuestionId(item.id)) errors.push(`${label}: invalid id`);
  for (const field of EDITABLE_STRINGS) {
    if (typeof item[field] !== 'string' || (field === 'title' && !item[field].trim())) {
      errors.push(`${label}: ${field} must be ${field === 'title' ? 'a nonempty' : 'a'} string`);
    }
  }
  if (!Array.isArray(item.parts) || item.parts.length === 0) {
    errors.push(`${label}: parts must contain at least one answer`);
  } else {
    item.parts.forEach((part, index) => {
      if (!record(part) || !nonempty(part.tag) || !nonempty(part.text)) {
        errors.push(`${label}: parts[${index}] requires nonempty tag and text strings`);
      }
    });
  }
  if (!Array.isArray(item.skills) || item.skills.some(id => typeof id !== 'string')) {
    errors.push(`${label}: skills must be an array of strings`);
  }
  if (!nonempty(item.primarySkill) || !Array.isArray(item.skills) || !item.skills.includes(item.primarySkill)) {
    errors.push(`${label}: primarySkill must be a string member of skills`);
  }
}

function validateItem(item, context, errors) {
  validateEditableContent(item, errors);
  if (!record(item)) return;
  const label = validQuestionId(item.id) ? item.id : `item ${String(item.id)}`;
  if (!context.groups.has(item.navGroup)) {
    errors.push(`${label}: navGroup does not exist`);
  } else if (typeof item.id === 'string' && context.groups.get(item.navGroup) !== item.id[0]) {
    errors.push(`${label}: navGroup category must match the question id prefix`);
  }
  if (item.kind !== 'main' && item.kind !== 'deep') errors.push(`${label}: kind must be main or deep`);
  if (!Array.isArray(item.skills) || item.skills.some(id => typeof id !== 'string' || !context.skillIds.has(id))) {
    errors.push(`${label}: skills must contain valid skill category IDs`);
  }
  if (typeof item.primarySkill !== 'string' || !context.skillIds.has(item.primarySkill)
    || !Array.isArray(item.skills) || !item.skills.includes(item.primarySkill)) {
    errors.push(`${label}: primarySkill must be a valid member of skills`);
  }
  if (!Array.isArray(item.deepRefs) || item.deepRefs.some(id => !validQuestionId(id) || !context.itemIds.has(id))) {
    errors.push(`${label}: deepRefs must point to existing question IDs`);
  }
  for (const field of ['mother', 'story', 'related', 'group']) {
    if (own(item, field) && typeof item[field] !== 'string') errors.push(`${label}: ${field} must be a string`);
  }
  if (own(item, 'updatedAt') && !validTimestamp(item.updatedAt)) errors.push(`${label}: updatedAt must be an ISO timestamp`);
  if (own(item, 'order') && (typeof item.order !== 'number' || !Number.isFinite(item.order))) {
    errors.push(`${label}: order must be a finite number`);
  }
}

export function validateBank(bank, { requiredIds = [] } = {}) {
  const errors = [];
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  if (!record(bank)) return { errors: ['Bank must be an object'], counts, total: 0 };
  const context = taxonomyContext(bank, errors);
  const items = Array.isArray(bank.items) ? bank.items : [];
  if (!Array.isArray(bank.items)) errors.push('items must be an array');
  const itemIds = new Set();
  for (const item of items) {
    if (!record(item) || !validQuestionId(item.id)) continue;
    if (itemIds.has(item.id)) errors.push(`Duplicate item id: ${item.id}`);
    itemIds.add(item.id);
    counts[item.id[0]] += 1;
  }
  context.itemIds = itemIds;
  for (const item of items) validateItem(item, context, errors);
  if (!Array.isArray(requiredIds)) {
    errors.push('requiredIds must be an array');
  } else {
    for (const id of requiredIds) {
      if (!itemIds.has(id)) errors.push(`Missing required item id: ${String(id)}`);
    }
  }
  return { errors, counts, total: items.length };
}

export function normalizeBank(bank) {
  const result = clone(bank);
  const navigation = new Map();
  result.items.forEach((item, index) => {
    if (!navigation.has(item.navGroup)) navigation.set(item.navGroup, []);
    navigation.get(item.navGroup).push({ item, index });
  });
  for (const category of result.taxonomy) {
    for (const group of category.groups) {
      const entries = navigation.get(group.id) || [];
      entries.sort((a, b) => (a.item.order ?? a.index) - (b.item.order ?? b.index) || a.index - b.index);
      group.ids = entries.map(({ item }) => item.id);
    }
  }
  return result;
}

export function fingerprint(item) {
  function sorted(value) {
    if (Array.isArray(value)) return value.map(sorted);
    if (!record(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]));
  }
  return JSON.stringify(sorted(item));
}

export function createDraft(item, publishedItem, source = 'browser') {
  return {
    item: clone(item),
    baseFingerprint: publishedItem == null ? null : fingerprint(publishedItem),
    updatedAt: new Date().toISOString(),
    source,
  };
}

export function draftState(draft, publishedItem) {
  if (!draft) return 'none';
  if (!publishedItem) return 'orphan';
  return typeof draft.baseFingerprint === 'string' && draft.baseFingerprint === fingerprint(publishedItem)
    ? 'current' : 'conflict';
}

function requireImportId(item, seen) {
  if (!record(item) || !validQuestionId(item.id)) throw new Error('Import contains an invalid item id');
  if (seen.has(item.id)) throw new Error(`Import contains duplicate id: ${item.id}`);
  seen.add(item.id);
}

export function prepareImport(value, publishedBank, existingDrafts = {}) {
  const root = Array.isArray(value) ? { items: value } : value;
  if (!record(root) || !Array.isArray(root.items)) throw new Error('Import must contain an items array');
  if (!record(existingDrafts)) throw new Error('Existing drafts must be an object');
  const contextErrors = [];
  const context = taxonomyContext(publishedBank, contextErrors);
  if (!Array.isArray(publishedBank.items) || contextErrors.length) throw new Error('Published bank is invalid');
  const published = new Map(publishedBank.items.map(item => [item.id, item]));
  context.itemIds = new Set(published.keys());
  const seen = new Set();
  for (const item of root.items) requireImportId(item, seen);

  let backupDrafts;
  if (own(root, 'localState')) {
    if (!record(root.localState)) throw new Error('localState must be an object');
    if (own(root.localState, 'drafts')) {
      if (!record(root.localState.drafts)) throw new Error('localState.drafts must be an object');
      backupDrafts = root.localState.drafts;
    }
  }
  const proposals = [];
  const ignored = new Set();
  const candidates = backupDrafts === undefined
    ? root.items.map(item => ({ id: item.id, item, draft: null }))
    : Object.entries(backupDrafts).map(([id, draft]) => {
      if (!validQuestionId(id) || !record(draft) || !record(draft.item) || draft.item.id !== id) {
        throw new Error(`Invalid backup draft id: ${id}`);
      }
      if (!(draft.baseFingerprint === null || typeof draft.baseFingerprint === 'string')
        || !validTimestamp(draft.updatedAt) || !nonempty(draft.source)) {
        throw new Error(`Invalid backup draft metadata: ${id}`);
      }
      return { id, item: draft.item, draft };
    });
  if (backupDrafts !== undefined) {
    for (const item of root.items) if (!own(backupDrafts, item.id)) ignored.add(item.id);
  }

  for (const candidate of candidates) {
    const formal = published.get(candidate.id);
    if (!formal) {
      if (!candidate.draft) {
        ignored.add(candidate.id);
        continue;
      }
      // Backups must remain recoverable across formal revisions that removed a
      // question. Its future catalog and references cannot be checked here.
      const errors = [];
      validateEditableContent(candidate.item, errors);
      if (errors.length) throw new Error(`Invalid orphan backup draft: ${errors.join('; ')}`);
      proposals.push([candidate.id, clone(candidate.draft)]);
      continue;
    }
    // Content import cannot move questions out of the formal navigation or
    // overwrite structural and unknown fields introduced by newer revisions.
    const item = clone(formal);
    for (const field of IMPORT_EDITABLE_FIELDS) {
      if (own(candidate.item, field)) item[field] = clone(candidate.item[field]);
    }
    const errors = [];
    validateItem(item, context, errors);
    if (errors.length) throw new Error(`Invalid import: ${errors.join('; ')}`);
    if (fingerprint(item) === fingerprint(formal)) {
      ignored.add(candidate.id);
      continue;
    }
    const draft = candidate.draft
      ? { ...clone(candidate.draft), item }
      : createDraft(item, undefined, 'import');
    proposals.push([candidate.id, draft]);
  }

  // Nothing touches caller state until every candidate has been validated.
  const drafts = clone(existingDrafts);
  const conflicts = [];
  for (const [id, proposal] of proposals) {
    if (own(drafts, id)) {
      const existing = drafts[id];
      const sameContent = record(existing) && fingerprint(existing.item) === fingerprint(proposal.item)
        && existing.baseFingerprint === proposal.baseFingerprint;
      if (sameContent) continue;
      conflicts.push(id);
    }
    drafts[id] = proposal;
  }
  return { drafts, conflicts, ignored: [...ignored] };
}
