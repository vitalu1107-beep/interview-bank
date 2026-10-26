import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { draftState } from '../assets/core.mjs';

const source = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');
// Execute the production renderer without booting the browser application.
const renderSource = source.slice(source.indexOf('function renderSync() {'), source.indexOf('\nfunction cardHTML('));
function renderSyncStatus(legacyItems = []) {
  const details = { open: false };
  const summary = { textContent: '' };
  const status = { className: '', innerHTML: '', closest: selector => selector === 'details' ? details : null };
  const context = vm.createContext({
    $: selector => ({ '#syncSummary': summary, '#syncStatus': status })[selector],
    drafts: {}, LOOKUP: new Map(), draftState, legacyItems,
    canPersist: true, storageMessage: '', loadedAt: '2026-10-27',
    BASE: { version: 10, items: [] }, escapeHTML: value => String(value),
  });
  vm.runInContext(renderSource + '\nrenderSync();', context);
  return { details, summary, status };
}

test('legacy edits reveal the real migration action even when no modern drafts exist', () => {
  const { details, summary, status } = renderSyncStatus([{ id: 'A01' }]);
  assert.equal(details.open, true);
  assert.match(summary.textContent, /旧版.*1\s*题/);
  assert.match(status.innerHTML, /<button[^>]*id="legacyImport"[^>]*>预览迁移 1 题旧草稿<\/button>/);
});

test('a clean browser keeps sync details collapsed without suggesting legacy edits', () => {
  const { details, summary, status } = renderSyncStatus();
  assert.equal(details.open, false);
  assert.doesNotMatch(summary.textContent, /旧版/);
  assert.doesNotMatch(status.innerHTML, /id="legacyImport"/);
});
