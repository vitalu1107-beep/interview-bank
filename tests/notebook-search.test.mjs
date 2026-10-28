import test from 'node:test';
import assert from 'node:assert/strict';
import * as notebook from '../assets/notebook.mjs';

const items = Object.freeze([
  Object.freeze({id: 'A10', title: '与 A14 相关的问题', parts: [{text: '请参考 D01-19'}]}),
  Object.freeze({id: 'A14', title: '小程序裂变链路具体是怎么优化的？'}),
  Object.freeze({id: 'D01-19', title: '项目追问'}),
]);

test('a complete question ID matches its own record instead of answer references', () => {
  assert.equal(notebook.getExactQuestionId?.(items, 'A14'), 'A14');
  assert.equal(notebook.getExactQuestionId?.(items, 'D01-19'), 'D01-19');
});

test('question ID lookup trims whitespace and returns the canonical ID regardless of query case', () => {
  assert.equal(notebook.getExactQuestionId?.(items, '  a14\n'), 'A14');
  assert.equal(notebook.getExactQuestionId?.(items, '\td01-19 '), 'D01-19');
});

test('partial IDs, reference phrases, and ordinary keywords do not enable exact-ID mode', () => {
  for (const term of ['A1', 'D01', 'D01-1', 'A14 相关', '请参考 D01-19', '裂变', 'A99']) {
    assert.equal(notebook.getExactQuestionId?.(items, term), null, term);
  }
});

test('empty queries and an empty bank have no exact match', () => {
  assert.equal(notebook.getExactQuestionId?.(items, ''), null);
  assert.equal(notebook.getExactQuestionId?.(items, ' \n\t '), null);
  assert.equal(notebook.getExactQuestionId?.([], 'A14'), null);
});
