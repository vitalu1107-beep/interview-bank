import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../assets/app.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
const start = source.indexOf('\napplyBranding();\nboot().catch(');
const end = source.indexOf('\nfunction renderNav', start);
const functions = source.slice(0, start) + source.slice(end);

function harness() {
  const nodes = new Map();
  let scrollY = 4200;
  const document = { activeElement: null, querySelectorAll: () => [] };
  function node(id) {
    if (!nodes.has(id)) {
      const classes = new Set();
      nodes.set(id, {
        id, hidden: false, inert: false, style: {}, attributes: {}, controls: [],
        classList: { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) },
        setAttribute(name, value) { this.attributes[name] = String(value); },
        getAttribute(name) { return this.attributes[name] ?? null; },
        removeAttribute(name) { delete this.attributes[name]; },
        focus() { document.activeElement = this; },
        contains: target => target === node('search'),
        getBoundingClientRect: () => ({ height: 180 }),
        querySelectorAll() { return this.controls; },
        getClientRects: () => [{}],
      });
    }
    return nodes.get(id);
  }
  document.body = node('body');
  document.body.style.overflow = 'auto';
  document.querySelector = selector => node(selector.replace(/^#/, ''));
  document.getElementById = node;
  document.activeElement = node('quickNavOpen');
  node('navBody').hidden = true;
  node('quickNavBackdrop').hidden = true;
  node('quickNavPlaceholder').hidden = true;
  node('welcomePanel').inert = true; // Preserve pre-existing inert state too.
  const window = { get scrollY() { return scrollY; }, scrollTo({ top }) { scrollY = top; } };
  const context = vm.createContext({ document, window, URL, location: { href: 'https://example.test/interview-bank/' }, matchMedia: () => ({ matches: true }), requestAnimationFrame: callback => callback() });
  const run = code => vm.runInContext(code, context);
  run(functions);
  return { run, node, document, get scrollY() { return scrollY; }, set scrollY(value) { scrollY = value; } };
}

test('mobile directory opens over the current reading position and closing restores focus and background state', () => {
  const h = harness();
  h.run('openQuickNavigation()');
  assert.equal(h.node('practiceSidebar').getAttribute('aria-modal'), 'true');
  assert.equal(h.node('practiceSidebar').getAttribute('role'), 'dialog');
  assert.equal(h.node('quickNavBackdrop').hidden, false);
  assert.equal(h.node('navBody').hidden, false);
  assert.equal(h.node('body').style.overflow, 'hidden');
  assert.equal(h.node('.site-header').inert, true);
  assert.equal(h.document.activeElement, h.node('search'));
  h.scrollY = 4500;
  h.run('closeQuickNavigation()');
  assert.equal(h.scrollY, 4200);
  assert.equal(h.document.activeElement, h.node('quickNavOpen'));
  assert.equal(h.node('quickNavBackdrop').hidden, true);
  assert.equal(h.node('practiceSidebar').getAttribute('role'), null);
  assert.equal(h.node('navBody').hidden, true);
  assert.equal(h.node('body').style.overflow, 'auto');
  assert.equal(h.node('.site-header').inert, false);
  assert.equal(h.node('welcomePanel').inert, true);
});

test('closing for a selected destination does not restore the previous reading scroll or focus', () => {
  const h = harness();
  h.run('openQuickNavigation()');
  h.scrollY = 800;
  h.run('closeQuickNavigation(false)');
  assert.equal(h.scrollY, 800);
  assert.notEqual(h.document.activeElement, h.node('quickNavOpen'));
  assert.equal(h.node('quickNavBackdrop').hidden, true);
});

test('repeated open and close are safe and preserve an already expanded inline directory', () => {
  const h = harness();
  h.node('navBody').hidden = false;
  h.run('openQuickNavigation();openQuickNavigation();closeQuickNavigation();closeQuickNavigation()');
  assert.equal(h.node('navBody').hidden, false);
  assert.equal(h.node('body').style.overflow, 'auto');
  assert.equal(h.scrollY, 4200);
});
