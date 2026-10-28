import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');
const bank = JSON.parse(await readFile(new URL('../questions.json', import.meta.url), 'utf8'));
const withoutImports = source.replace(/^import .*;\n/gm, '');
const startupStart = withoutImports.indexOf('\napplyBranding();\nboot().catch(');
const startupEnd = withoutImports.indexOf('\nfunction renderNav', startupStart);
assert.ok(startupStart >= 0 && startupEnd > startupStart, 'the production startup boundary is present');
const productionFunctions = withoutImports.slice(0, startupStart) + withoutImports.slice(startupEnd);

function validate(item) {
  const context = vm.createContext({
    location: { href: 'https://example.test/interview-bank/' },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    URL,
    item,
  });
  vm.runInContext(productionFunctions, context);
  return JSON.parse(vm.runInContext('JSON.stringify(editorFieldErrors(item))', context));
}

const example = () => structuredClone(bank.items.find(item => item.parts.length >= 2));

function assertChineseMessages(errors) {
  for (const { message } of errors) {
    assert.equal(typeof message, 'string');
    assert.match(message, /[\u4e00-\u9fff]/, 'the error explains the correction in Chinese');
    assert.doesNotMatch(message, /nonempty|string|required|undefined|must be/i, 'raw schema errors are not shown');
  }
}

test('a complete existing answer has no editor field errors', () => {
  assert.deepEqual(validate(example()), []);
});

test('blank or whitespace-only question titles point to the title field with a Chinese message', () => {
  for (const title of ['', ' \t\n ']) {
    const item = example();
    item.title = title;
    const errors = validate(item);
    assert.deepEqual(errors.map(error => error.field), ['title']);
    assertChineseMessages(errors);
  }
});

test('empty answer labels and content identify their own numbered input fields', () => {
  const item = example();
  item.parts[0].tag = ' \n ';
  item.parts[1].text = '\t ';
  const errors = validate(item);
  assert.deepEqual(errors.map(error => error.field), ['tag0', 'part1']);
  assertChineseMessages(errors);
});

test('all missing required fields are reported together in reading order', () => {
  const item = example();
  item.title = '';
  item.parts[0].tag = '';
  item.parts[0].text = '';
  item.parts[1].tag = '';
  item.parts[1].text = '';
  const errors = validate(item);
  assert.deepEqual(errors.map(error => error.field), ['title', 'tag0', 'part0', 'tag1', 'part1']);
  assertChineseMessages(errors);
});

test('optional answer logic, reminders, data and status remain allowed to be empty', () => {
  const item = example();
  for (const field of ['logic', 'note', 'data', 'state']) item[field] = '';
  assert.deepEqual(validate(item), []);
});

test('editor validation leaves the answer and whitespace untouched', () => {
  const item = example();
  item.title = '  保留原样的问题  ';
  item.parts[0].tag = ' \n ';
  item.parts[0].text = '  保留原样的回答  ';
  const before = structuredClone(item);
  const errors = validate(item);
  assert.deepEqual(errors.map(error => error.field), ['tag0']);
  assert.deepEqual(item, before, 'validation must not rewrite user input');
});

test('an unsaved-edit warning preserves existing invalid field hints and shows its local summary', () => {
  const hints = new Map();
  const control = {
    id: 'edit-A14-title',
    attributes: new Map([['aria-describedby', 'title-help']]),
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    removeAttribute(name) { this.attributes.delete(name); },
    insertAdjacentElement(position, hint) {
      assert.equal(position, 'afterend');
      hints.set(hint.id, hint);
    },
    focus() { this.focused = true; },
    scrollIntoView() {},
  };
  const summary = { hidden: true, textContent: '', focus() {}, scrollIntoView() {} };
  const editor = {
    querySelector(selector) {
      if (selector === '.editor-feedback') return summary;
      if (selector === '[name="title"]') return control;
      if (selector === '[aria-invalid="true"]') return control.getAttribute('aria-invalid') === 'true' ? control : null;
      return null;
    },
    querySelectorAll(selector) {
      assert.equal(selector, '[aria-invalid="true"]');
      return control.getAttribute('aria-invalid') === 'true' ? [control] : [];
    },
  };
  const context = vm.createContext({
    location: { href: 'https://example.test/interview-bank/' },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    URL,
    document: {
      getElementById: id => hints.get(id) ?? null,
      createElement() { return { remove() { hints.delete(this.id); } }; },
    },
    testEditor: editor,
  });
  vm.runInContext(productionFunctions, context);
  vm.runInContext("showEditorFeedback(testEditor,'请补全必填内容。',[{field:'title',message:'请填写问题标题。'}])", context);
  const hint = hints.get('edit-A14-title-error');
  assert.equal(control.getAttribute('aria-invalid'), 'true', 'the invalid save marks the input first');
  assert.equal(hint.textContent, '请填写问题标题。');

  const warning = '当前编辑尚未保存，请先保存为本地草稿或取消编辑。';
  context.warning = warning;
  vm.runInContext('showEditorFeedback(testEditor,warning)', context);

  assert.equal(control.getAttribute('aria-invalid'), 'true', 'a navigation warning must not clear required-field errors');
  assert.equal(hints.get('edit-A14-title-error'), hint, 'the existing Chinese hint remains attached');
  assert.equal(control.getAttribute('aria-describedby'), 'title-help edit-A14-title-error');
  assert.equal(summary.textContent, warning);
  assert.equal(summary.hidden, false, 'the unsaved warning appears beside the form actions');
  assert.equal(control.focused, true, 'focus remains on the field that needs correction');
});
