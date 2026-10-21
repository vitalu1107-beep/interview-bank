import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateBank, normalizeBank, fingerprint, createDraft, draftState, prepareImport } from '../assets/core.mjs';

const copy = value => structuredClone(value);
const live = JSON.parse(await readFile(new URL('../questions.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('../docs/original-manifest.json', import.meta.url), 'utf8'));

// A small fixed scenario isolates core behavior from future edits and additions
// to the formal bank. This is test data, not another copy of the answer bank.
function question(id, navGroup, fields = {}) {
  return {
    id, navGroup, title: `${id} 示例问题`,
    parts: [{ tag: '直接回答', text: '示例回答内容。' }],
    logic: '回答思路', note: '', data: '', state: '可练',
    skills: ['K01', 'K11'], primarySkill: 'K11',
    kind: 'main', related: '', deepRefs: ['D01-01'], mother: 'M01', story: 'S01',
    ...fields,
  };
}
const original = {
  version: 10,
  sourceNote: 'core unit-test fixture',
  meta: { M01: '示例主题' },
  deepGroups: { D01: { title: '示例项目', count: 1 } },
  taxonomy: [
    { id: 'A', title: '个人经历', desc: '示例', groups: [
      { id: 'A_INTRO', title: '自我介绍', ids: ['A01'] },
      { id: 'A_SALE', title: '活动营销', ids: ['A02'] },
      { id: 'A_C', title: '用户增长', ids: ['A10'] },
      { id: 'A_B', title: '商家增长', ids: [] },
    ] },
    { id: 'B', title: '行业认知', desc: '示例', groups: [{ id: 'B_C', title: '增长策略', ids: ['B01'] }] },
    { id: 'C', title: '个人动机', desc: '示例', groups: [{ id: 'C_SELF', title: '个人优势', ids: ['C01'] }] },
    { id: 'D', title: '简历深挖', desc: '示例', groups: [{ id: 'D01', title: '示例项目', ids: ['D01-01'] }] },
  ],
  skillCategories: {
    K01: { name: '用户增长', short: '增长', desc: '示例能力' },
    K11: { name: '职业表达', short: '表达', desc: '示例能力' },
  },
  items: [
    question('A01', 'A_INTRO'),
    question('A02', 'A_SALE'),
    question('A10', 'A_C'),
    question('B01', 'B_C'),
    question('C01', 'C_SELF'),
    question('D01-01', 'D01', { group: 'D01', kind: 'deep', deepRefs: [] }),
  ],
};
const requiredIds = ['A01', 'A02', 'A10', 'B01', 'C01', 'D01-01'];
const published = original.items[0];
const changed = (item = published) => ({ ...copy(item), title: `${item.title}（修订）` });

test('validates the live bank with original ID coverage while permitting future additions', () => {
  const result = validateBank(live, { requiredIds: manifest.requiredIds });
  assert.deepEqual(result.errors, []);
  assert.equal(result.total, live.items.length);
  for (const category of ['A', 'B', 'C', 'D']) {
    assert.equal(result.counts[category], live.items.filter(item => item.id.startsWith(category)).length);
  }
});

test('reports the exact category counts of a fixed four-category scenario', () => {
  assert.deepEqual(validateBank(original, { requiredIds }), {
    errors: [], counts: { A: 3, B: 1, C: 1, D: 1 }, total: 6,
  });
});

test('reports deleted required IDs and duplicate IDs instead of trusting category counts', () => {
  const missing = copy(original);
  missing.items = missing.items.filter(item => item.id !== 'A01');
  assert.match(validateBank(missing, { requiredIds }).errors.join('\n'), /A01/);
  const duplicate = copy(original);
  duplicate.items.push(copy(duplicate.items[0]));
  assert.match(validateBank(duplicate).errors.join('\n'), /duplicate.*A01|A01.*duplicate/i);
});

test('requires valid answer parts, editable strings, groups, skill IDs and deep references', () => {
  const cases = [
    [item => { item.parts = []; }, /parts/],
    [item => { item.parts[0].text = ' '; }, /parts/],
    [item => { item.parts[0].tag = 123; }, /parts/],
    [item => { item.logic = {}; }, /logic/],
    [item => { item.title = ' '; }, /title/],
    [item => { item.navGroup = 'NO_GROUP'; }, /navGroup/],
    [item => { item.navGroup = 'B_C'; }, /category|navGroup/i],
    [item => { item.skills = ['K999']; }, /skill/i],
    [item => { item.primarySkill = 'K999'; }, /skill/i],
    [item => { item.deepRefs = ['D99-99']; }, /deepRefs/],
    [item => { item.kind = '<script>'; }, /kind/],
    [item => { item.id = '__proto__'; }, /id/i],
  ];
  for (const [mutate, expected] of cases) {
    const bank = copy(original);
    mutate(bank.items[0]);
    assert.match(validateBank(bank).errors.join('\n'), expected);
  }
});

test('validates display taxonomy and skill category identifiers before the UI can consume them', () => {
  const cases = [
    bank => { bank.taxonomy[0].id = 'Z'; },
    bank => { bank.taxonomy.push(copy(bank.taxonomy[0])); },
    bank => { bank.taxonomy[0].groups[0].id = 'bad"onclick'; },
    bank => { bank.taxonomy[0].groups.push(copy(bank.taxonomy[0].groups[0])); },
    bank => { bank.taxonomy[0].title = {}; },
    bank => { bank.taxonomy[0].desc = []; },
    bank => { bank.taxonomy[0].groups[0].title = null; },
    bank => { bank.skillCategories['bad"'] = { name: 'x', short: 'x' }; },
    bank => { bank.skillCategories.K01.short = {}; },
  ];
  for (const mutate of cases) {
    const bank = copy(original);
    mutate(bank);
    assert.ok(validateBank(bank).errors.length > 0);
  }
});

test('accepts new questions despite stale taxonomy IDs and validates optional metadata', () => {
  const bank = copy(original);
  bank.items.push({ ...copy(published), id: 'A99', updatedAt: '2026-10-20T00:00:00.000Z', order: 0 });
  assert.deepEqual(validateBank(bank, { requiredIds }).errors, []);
  assert.equal(validateBank(bank).counts.A, 4);
  bank.items.at(-1).updatedAt = 'not-a-date';
  bank.items.at(-1).order = 'first';
  const errors = validateBank(bank).errors.join('\n');
  assert.match(errors, /updatedAt/);
  assert.match(errors, /order/);
});

test('handles malformed root values as diagnostics without throwing', () => {
  for (const value of [null, [], {}, { items: null }, { items: [null], taxonomy: [] }]) {
    assert.ok(validateBank(value).errors.length > 0);
  }
});

test('rebuilds navigation from item order while preserving every other source field', () => {
  const bank = copy(original);
  bank.items.push({ ...copy(published), id: 'A99', extra: { keep: true } });
  bank.taxonomy[0].groups[0].ids = ['STALE'];
  const before = copy(bank);
  const result = normalizeBank(bank);
  assert.deepEqual(result.taxonomy[0].groups[0].ids, ['A01', 'A99']);
  assert.deepEqual(result.items, bank.items);
  assert.deepEqual(bank, before);
  result.items[0].parts[0].text = 'local edit';
  assert.equal(bank.items[0].parts[0].text, published.parts[0].text);
  assert.equal(Object.hasOwn(result.items[0], 'updatedAt'), false);
});

test('uses explicit numeric order for navigation without reordering records', () => {
  const bank = copy(original);
  bank.items.push({ ...copy(published), id: 'A99', order: -1 });
  const result = normalizeBank(bank);
  assert.deepEqual(result.taxonomy[0].groups[0].ids, ['A99', 'A01']);
  assert.equal(result.items.at(-1).id, 'A99');
});

test('fingerprints nested object contents independent of object key insertion order', () => {
  assert.equal(fingerprint({ z: { b: 2, a: 1 }, a: ['x', { d: 4, c: 3 }] }), '{"a":["x",{"c":3,"d":4}],"z":{"a":1,"b":2}}');
  assert.notEqual(fingerprint({ a: [1, 2] }), fingerprint({ a: [2, 1] }));
  assert.notEqual(fingerprint({ text: 'old' }), fingerprint({ text: 'new' }));
});

test('creates independent local drafts with their published base and provenance', () => {
  const input = changed();
  const before = Date.now();
  const draft = createDraft(input, published);
  assert.deepEqual(draft.item, input);
  assert.equal(draft.baseFingerprint, fingerprint(published));
  assert.equal(draft.source, 'browser');
  assert.ok(Date.parse(draft.updatedAt) >= before);
  assert.ok(Date.parse(draft.updatedAt) <= Date.now());
  draft.item.parts[0].text = 'edited';
  assert.equal(input.parts[0].text, published.parts[0].text);
  assert.equal(createDraft(input, undefined, 'import').baseFingerprint, null);
});

test('distinguishes current drafts, changed published versions, unverified imports and orphans', () => {
  const draft = createDraft(changed(), published);
  assert.equal(draftState(undefined, published), 'none');
  assert.equal(draftState(draft, published), 'current');
  assert.equal(draftState(draft, changed()), 'conflict');
  assert.equal(draftState({ ...draft, baseFingerprint: null }, published), 'conflict');
  assert.equal(draftState(draft, undefined), 'orphan');
  assert.equal(draftState(draft, { ...published, updatedAt: '2026-10-20T01:00:00.000Z' }), 'conflict');
});

test('imports a plain edited V10 record as an unverified draft and preserves unknown formal fields', () => {
  const record = changed();
  record.customImported = { note: 'outside editable content' };
  const input = { items: [record] };
  const bank = copy(original);
  bank.items[0].customPublished = { retained: true };
  const before = copy({ input, bank });
  const result = prepareImport(input, bank);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.drafts.A01.baseFingerprint, null);
  assert.equal(result.drafts.A01.item.title, record.title);
  assert.deepEqual(result.drafts.A01.item.customPublished, { retained: true });
  assert.equal(Object.hasOwn(result.drafts.A01.item, 'customImported'), false);
  assert.deepEqual({ input, bank }, before);
});

test('ignores unchanged records and unknown IDs without creating published-bank drafts', () => {
  const unknown = { ...copy(published), id: 'A999' };
  const result = prepareImport([...copy(original.items), unknown], original);
  assert.deepEqual(result.drafts, {});
  assert.ok(result.ignored.includes('A01'));
  assert.ok(result.ignored.includes('A999'));
});

test('restores explicit backup drafts and provenance without turning formal backup items into drafts', () => {
  const draft = createDraft(changed(), published, 'browser');
  draft.updatedAt = '2026-10-19T08:00:00.000Z';
  const backup = { items: copy(original.items), localState: { drafts: { A01: draft }, practice: { A01: 3 } } };
  const result = prepareImport(backup, original);
  assert.deepEqual(Object.keys(result.drafts), ['A01']);
  assert.deepEqual(result.drafts.A01, draft);
});

test('restores explicit orphan backup drafts intact when importing into an older formal bank', () => {
  const future = {
    ...copy(published), id: 'A999', title: '未来正式题的本地草稿', navGroup: 'A_FUTURE',
    skills: ['K99'], primarySkill: 'K99', deepRefs: ['D99-99'], custom: { preserve: true },
  };
  const draft = createDraft(future, { ...future, title: '未来正式题' });
  draft.updatedAt = '2026-10-19T08:00:00.000Z';
  draft.customMetadata = { untouched: true };
  const backup = { items: [future], localState: { drafts: { A999: draft } } };
  const before = copy(backup);
  const result = prepareImport(backup, original);
  assert.deepEqual(result.drafts.A999, draft);
  assert.equal(draftState(result.drafts.A999, undefined), 'orphan');
  assert.equal(result.ignored.includes('A999'), false);
  assert.deepEqual(backup, before);
  result.drafts.A999.item.custom.preserve = false;
  assert.deepEqual(backup, before);
  assert.deepEqual(prepareImport([future], original).drafts, {});
});

test('reports orphan backup drafts that would overwrite different existing orphan work', () => {
  const future = { ...changed(), id: 'A999' };
  const restored = createDraft(future, undefined);
  const existing = { A999: createDraft({ ...future, title: '本机孤立草稿' }, undefined) };
  const before = copy(existing);
  const result = prepareImport({ items: [], localState: { drafts: { A999: restored } } }, original, existing);
  assert.deepEqual(result.conflicts, ['A999']);
  assert.deepEqual(result.drafts.A999, restored);
  assert.deepEqual(existing, before);
});

test('imports editable content without changing formal navigation or structural fields', () => {
  const bank = copy(original);
  const main = bank.items.find(item => item.id === 'A10');
  main.customPublished = { keep: true };
  const deep = bank.items.find(item => item.id === 'D01-01');
  const incomingMain = {
    ...changed(main), navGroup: 'A_B', kind: 'deep', group: 'D99', deepRefs: [],
    story: '替换故事', mother: 'M99', related: 'C99', order: -999, updatedAt: '2026-10-20T00:00:00.000Z',
    customPublished: { keep: false },
  };
  const incomingDeep = { ...changed(deep), navGroup: 'D08', group: 'D08', kind: 'main' };
  const result = prepareImport([incomingMain, incomingDeep], bank);
  assert.deepEqual(result.drafts.A10.item, { ...main, title: incomingMain.title });
  assert.deepEqual(result.drafts['D01-01'].item, { ...deep, title: incomingDeep.title });
  const structuralOnly = prepareImport([{ ...copy(main), navGroup: 'A_B', kind: 'deep', group: 'D99' }], bank);
  assert.deepEqual(structuralOnly.drafts, {});
  assert.ok(structuralOnly.ignored.includes('A10'));
});

test('rejects malformed orphan content atomically without requiring future catalog entries', () => {
  const future = { ...changed(), id: 'A999', navGroup: 'A_FUTURE', skills: ['K99'], primarySkill: 'K99' };
  const existing = { A01: createDraft(changed(), published) };
  const before = copy(existing);
  const mutations = [
    item => { item.title = ' '; },
    item => { item.parts = []; },
    item => { item.parts[0].text = ''; },
    item => { item.logic = {}; },
    item => { item.skills = [42]; },
    item => { item.primarySkill = {}; },
  ];
  for (const mutate of mutations) {
    const item = copy(future);
    mutate(item);
    const draft = createDraft(item, undefined);
    assert.throws(() => prepareImport({ items: [], localState: { drafts: { A999: draft } } }, original, existing), Error);
    assert.deepEqual(existing, before);
  }
});

test('returns differing existing drafts as explicit conflicts and keeps unrelated work', () => {
  const existing = {
    A01: createDraft({ ...copy(published), title: '本机还没备份的版本' }, published),
    A02: createDraft(changed(original.items[1]), original.items[1]),
  };
  const before = copy(existing);
  const result = prepareImport([changed()], original, existing);
  assert.deepEqual(result.conflicts, ['A01']);
  assert.equal(result.drafts.A01.item.title, changed().title);
  assert.deepEqual(result.drafts.A02, existing.A02);
  assert.deepEqual(existing, before);
  result.drafts.A02.item.parts[0].text = 'mutated';
  assert.deepEqual(existing, before);
});

test('does not report an identical existing draft as a destructive conflict', () => {
  const draft = createDraft(changed(), published);
  const result = prepareImport({ items: [], localState: { drafts: { A01: draft } } }, original, { A01: draft });
  assert.deepEqual(result.conflicts, []);
});

test('rejects duplicate and unsafe IDs atomically while preserving existing drafts', () => {
  const existing = { A01: createDraft(changed(), published) };
  const before = copy(existing);
  for (const input of [
    [changed(), changed()],
    [{ ...changed(), id: '__proto__' }],
    [{ ...changed(), id: 'constructor' }],
    [{ ...changed(), id: '' }],
    [{ ...changed(), id: 12 }],
  ]) {
    assert.throws(() => prepareImport(input, original, existing), /id|duplicate/i);
    assert.deepEqual(existing, before);
  }
});

test('rejects malformed edits or backup envelopes without losing any preexisting draft', () => {
  const existing = { A01: createDraft(changed(), published) };
  const before = copy(existing);
  const malformed = [
    null,
    {},
    { items: 'oops' },
    [{ ...changed(), parts: [] }],
    [{ ...changed(), title: {} }],
    [{ ...changed(), skills: ['K999'] }],
    { items: [], localState: { drafts: [] } },
    { items: [], localState: { drafts: { A01: { item: changed(), baseFingerprint: 42 } } } },
    { items: [], localState: { drafts: { A02: createDraft(changed(), published) } } },
    JSON.parse('{"items":[],"localState":{"drafts":{"__proto__":{"item":{"id":"__proto__"}}}}}'),
  ];
  for (const input of malformed) {
    assert.throws(() => prepareImport(input, original, existing), Error);
    assert.deepEqual(existing, before);
  }
});
