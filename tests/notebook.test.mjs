import test from 'node:test';
import assert from 'node:assert/strict';
import { getLearningSummary, getNextPracticeId } from '../assets/notebook.mjs';
const items = [{id:'A01'}, {id:'B01'}, {id:'D01-01'}, {id:'C01'}];
const dates = ['2026-10-20T00:00:00Z','2026-10-21T00:00:00Z'];
test('summary counts only existing questions with valid practice and active favorites', () => {
  const progress={practiced:{A01:dates[0],B01:'bad',A99:dates[1]},favorites:{A01:true,B01:false,C01:true,A99:true}};
  assert.deepEqual(getLearningSummary(items,progress),{total:4,practiced:1,favorites:2,completion:25});
  assert.deepEqual(getLearningSummary([],progress),{total:0,practiced:0,favorites:0,completion:0});
});
test('practice begins with first unpracticed question when history is absent or obsolete', () => {
  assert.equal(getNextPracticeId(items,{}),'A01');
  assert.equal(getNextPracticeId(items,{practiced:{A99:dates[1],A01:'bad'}}),'A01');
});
test('practice continues after latest valid record in supplied navigation order', () => {
  assert.equal(getNextPracticeId(items,{practiced:{A01:dates[1],B01:dates[0],C01:'bad',A99:'2099-01-01'}}),'D01-01');
});
test('practice wraps to first unpracticed question and returns null on completion', () => {
  assert.equal(getNextPracticeId(items,{practiced:{C01:dates[1]}}),'A01');
  assert.equal(getNextPracticeId(items,{practiced:{A01:dates[0],B01:dates[0],'D01-01':dates[0],C01:dates[1]}}),null);
  assert.equal(getNextPracticeId([],{}),null);
});
test('summary completion rounds to a whole percent without mutating inputs', () => {
  const progress={practiced:{A01:dates[0]},favorites:{}};
  assert.equal(getLearningSummary(items.slice(0,3),progress).completion,33);
  assert.deepEqual(progress,{practiced:{A01:dates[0]},favorites:{}});
});
