import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { normalizeBank } from '../assets/core.mjs';
import { getExactQuestionId } from '../assets/notebook.mjs';

const source = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');
const bank = JSON.parse(await readFile(new URL('../questions.json', import.meta.url), 'utf8'));
const withoutImports = source.replace(/^import .*;\n/gm, '');
const startupStart = withoutImports.indexOf('\napplyBranding();\nboot().catch(');
const startupEnd = withoutImports.indexOf('\nfunction renderNav', startupStart);
assert.ok(startupStart >= 0 && startupEnd > startupStart, 'the production startup boundary is present');
const productionFunctions = withoutImports.slice(0, startupStart) + withoutImports.slice(startupEnd);

function harness({ mobile = false } = {}) {
  let scrollY = 5200;
  const nodes = new Map();
  const links = new Map();
  const classes = new Set();
  const documentListeners = [];
  const makeNode = id => ({
    id, tagName: 'DIV', hidden: false, value: '', textContent: '', dataset: {}, innerHTML: '', listeners: [],
    classList: { toggle(name, force) { const on = force ?? !classes.has(name); if (on) classes.add(name); else classes.delete(name); }, add(name) { classes.add(name); }, remove(name) { classes.delete(name); } },
    attributes: {}, setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] ?? null; },
    contains() { return false; }, focus() { this.focused = true; },
    addEventListener(type, handler, capture) { this.listeners.push({ type, handler, capture }); },
    closest(selector) {
      return selector.split(',').some(part => {
        const candidate = part.trim();
        if (candidate === 'button') return this.tagName === 'BUTTON';
        const attribute = candidate.match(/^a\[data-([a-z-]+)\]$/)?.[1];
        const key = attribute?.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
        return this.tagName === 'A' && key && Object.hasOwn(this.dataset, key);
      }) ? this : null;
    },
    getBoundingClientRect() { return { top: this.documentTop - scrollY, height: 60 }; },
    scrollIntoView() { scrollY = this.documentTop ?? 0; },
    querySelector(selector) {
      if (selector === 'h3') return this.heading ??= makeNode(`${id}-heading`);
      const target = selector.match(/^\[data-goto="([^"]+)"\]$/)?.[1];
      return target ? links.get(`${id}:${target}`) ?? null : null;
    },
    querySelectorAll() { return []; },
  });
  const node = id => { if (!nodes.has(id)) nodes.set(id, makeNode(id)); return nodes.get(id); };
  for (const [index, q] of bank.items.entries()) node(q.id).documentTop = 1000 + index * 600;
  const document = {
    body: node('body'), activeElement: null,
    querySelector(selector) { return selector.startsWith('#') ? node(selector.slice(1)) : null; },
    getElementById: node, querySelectorAll() { return []; },
    addEventListener(type, handler, capture) { documentListeners.push({ type, handler, capture }); },
  };
  const window = {
    get scrollY() { return scrollY; }, get scrollX() { return 0; },
    scrollTo(options, y) { scrollY = typeof options === 'number' ? y : options.top ?? scrollY; },
    scrollBy(options, y) { scrollY += typeof options === 'number' ? y : options.top ?? 0; },
    addEventListener() {},
  };
  const context = vm.createContext({
    document, window, bank, normalizeBank, getExactQuestionId, console, URL,
    location: { href: 'https://example.test/interview-bank/', hash: '' },
    history: { replaceState() {}, pushState() {} }, CSS: { escape: value => value },
    matchMedia: () => ({ matches: mobile, addEventListener() {} }),
    requestAnimationFrame: callback => callback(),
    setTimeout: callback => { callback(); return 1; }, clearTimeout() {},
  });
  const run = code => vm.runInContext(code, context);
  run(productionFunctions);
  run(`BASE=normalizeBank(bank); TAX=BASE.taxonomy; SKILLS=BASE.skillCategories;
    CATS=Object.fromEntries(TAX.map(c=>[c.id,c]));
    GROUPS=Object.fromEntries(TAX.flatMap(c=>c.groups.map(g=>[g.id,{...g,category:c.id}])));
    LOOKUP=new Map(BASE.items.map(q=>[q.id,q])); items=BASE.items;
    render=function() {};`);
  function link(from, to, top = 180) {
    const anchor = makeNode(`${from}-to-${to}`);
    anchor.dataset.goto = to;
    anchor.documentTop = scrollY + top;
    anchor.closest = selector => selector === '.card' ? node(from) : null;
    links.set(`${from}:${to}`, anchor);
    return anchor;
  }
  function state() {
    return JSON.parse(run(`JSON.stringify({selectedCat,selectedGroup,expandedCat,expandedGroup,
      search:$('#search').value,viewFilter,onlyQuestions,showTags,
      openSet:[...openSet],hiddenSet:[...hiddenSet],draftView:[...draftView]})`));
  }
  function click(target) {
    const event = {
      target, defaultPrevented: false, stopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopImmediatePropagation() { this.stopped = true; },
    };
    for (const listener of documentListeners.filter(listener => listener.type === 'click' && listener.capture)) {
      listener.handler(event);
      if (event.stopped) return event;
    }
    for (const listener of target.listeners.filter(listener => listener.type === 'click')) {
      listener.handler(event);
      if (event.stopped) return event;
    }
    for (const listener of documentListeners.filter(listener => listener.type === 'click' && !listener.capture)) {
      listener.handler(event);
      if (event.stopped) return event;
    }
    return event;
  }
  return { run, node, link, state, context, click, get scrollY() { return scrollY; } };
}

test('choosing a primary category enters practice and shows its real questions', () => {
  const h = harness();
  h.run("selectCat('B')");
  assert.equal(h.node('welcomePanel').hidden, true, 'the welcome and overview no longer occupy practice space');
  assert.equal(h.run('selection().length'), 16);
  assert.equal(h.run("selection().every(q=>q.id.startsWith('B'))"), true);
  h.run("selectCat('A')");
  assert.equal(h.run('selection().length'), 17);
  assert.equal(h.run("selection().every(q=>q.id.startsWith('A'))"), true);
  h.run("selectCat('A')");
  assert.equal(h.run('selectedCat'), 'A', 'collapsing a category keeps its selection');
  assert.equal(h.run('selection().length'), 17);
});

test('a complete question ID selects only that question, including lowercase deep IDs', () => {
  const h = harness();
  for (const [query, id] of [[' A14 ', 'A14'], ['a14', 'A14'], ['d01-19', 'D01-19']]) {
    h.node('search').value = query;
    assert.deepEqual(JSON.parse(h.run('JSON.stringify(selection().map(q=>q.id))')), [id]);
  }
  h.node('search').value = '裂变';
  assert.ok(h.run('selection().length') > 1, 'ordinary full-text search still finds related questions');
});

test('exact ID search keeps the active personal filter instead of silently leaving it', () => {
  const h = harness();
  h.node('search').value = 'A14';
  h.run("viewFilter='favorites'");
  assert.equal(h.run('selection().length'), 0);
  h.run('progress.favorites.A14=true');
  assert.equal(h.run('selection()[0].id'), 'A14');
});

test('mobile category selection closes the directory while entering practice', () => {
  const h = harness({ mobile: true });
  h.run("setNavigationOpen(true);selectCat('C')");
  assert.equal(h.node('welcomePanel').hidden, true);
  assert.equal(h.node('navBody').hidden, true);
  assert.equal(h.run('selection().length'), 10);
});

test('category selection brings the first question into the reading viewport', () => {
  const h = harness();
  h.node('content .card').documentTop = 2800;
  h.run("selectCat('B')");
  assert.equal(h.scrollY, 2800, 'category tools do not push the first question below the screen');
  assert.equal(h.node('content .card').heading.focused, true);
});

test('related-question return restores nested sources, filters, answer state and reading position', () => {
  const h = harness();
  h.run(`selectedCat='A';selectedGroup=LOOKUP.get('A14').navGroup;
    expandedCat='A';expandedGroup=selectedGroup;$('#search').value='裂变';viewFilter='favorites';
    onlyQuestions=true;showTags=false;openSet=new Set(['D01-02']);hiddenSet=new Set(['A14']);
    draftView=new Set(['A14']);progress.favorites.A14=true;`);
  const before = h.state(), originalScroll = h.scrollY;
  const firstLink = h.link('A14', 'D01-01');
  h.context.sourceLink = firstLink;
  h.run("jumpTo('D01-01',sourceLink)");
  assert.equal(h.run('questionTrail.length'), 1);
  assert.equal(h.run('viewFilter'), 'all');
  assert.equal(h.run("$('#search').value"), '');
  assert.equal(h.run('onlyQuestions'), false);
  assert.equal(h.run("openSet.has('D01-01')"), true);
  const middle = h.state();
  h.context.sourceLink = h.link('D01-01', 'A03', 240);
  h.run("jumpTo('A03',sourceLink)");
  assert.equal(h.run('questionTrail.length'), 2);
  h.run('returnToQuestion()');
  assert.deepEqual(h.state(), middle);
  assert.equal(h.run('questionTrail.length'), 1);
  h.run('returnToQuestion()');
  assert.deepEqual(h.state(), before);
  assert.equal(h.scrollY, originalScroll, 'the original related link returns to its prior screen position');
  assert.equal(firstLink.focused, true, 'keyboard focus returns to the source link');
  assert.equal(h.run('questionTrail.length'), 0);
});

test('explicit category, group and directory-question navigation clear an old related trail', () => {
  for (const navigate of ["selectCat('B')", "selectGroup(TAX[1].groups[0].id)", "jumpTo('A01')"]) {
    const h = harness();
    h.context.sourceLink = h.link('A14', 'D01-01');
    h.run("jumpTo('D01-01',sourceLink)");
    assert.equal(h.run('questionTrail.length'), 1);
    h.run(navigate);
    assert.equal(h.run('questionTrail.length'), 0, navigate);
    assert.equal(h.run('viewFilter'), 'all');
  }
});

test('an unavailable destination preserves current selection and the return trail', () => {
  const h = harness();
  h.context.sourceLink = h.link('A14', 'D01-01');
  h.run("jumpTo('D01-01',sourceLink)");
  const before = h.state();
  h.context.sourceLink = h.link('D01-01', 'D99-99');
  h.run("jumpTo('D99-99',sourceLink);selectCat('unknown');selectGroup('unknown')");
  assert.deepEqual(h.state(), before);
  assert.equal(h.run('questionTrail.length'), 1);
});

test('home restores the welcome panel and clears the related-question return chain', () => {
  const h = harness();
  h.context.sourceLink = h.link('A14', 'D01-01');
  h.run("jumpTo('D01-01',sourceLink);showHome()");
  assert.equal(h.node('welcomePanel').hidden, false);
  assert.equal(h.run('questionTrail.length'), 0);
  assert.equal(h.scrollY, 0);
});

test('unsaved edits block home, start-practice and source-return navigation before state changes', () => {
  for (const [id, tagName, dataset] of [
    ['homeLink', 'A', { home: '' }],
    ['practiceLink', 'A', { startPractice: '' }],
    ['returnQuestion', 'BUTTON', {}],
  ]) {
    const h = harness();
    h.run('bindEvents();editorDirty=true;');
    const before = h.state();
    const action = h.node(id);
    action.tagName = tagName;
    action.dataset = dataset;
    const event = h.click(action);
    assert.equal(event.defaultPrevented, true, `${id} must not navigate away from unsaved input`);
    assert.equal(event.stopped, true);
    assert.deepEqual(h.state(), before);
    assert.equal(h.run('editorDirty'), true);
    assert.match(h.node('notice').textContent, /尚未保存/);
  }
});
