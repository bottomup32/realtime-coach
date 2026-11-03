import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnalysisQueue, parseAnalysis, newMeeting, applyAnalysis, reportFor } from '../src/lib/coach/model.ts';
import { loadMeetings, saveMeeting, deleteMeeting } from '../src/lib/coach/storage.ts';

test('new utterances during analysis trigger another pass, without concurrent calls', async () => {
  let calls = 0, active = 0, peak = 0;
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const queue = new AnalysisQueue(async () => { calls++; active++; peak = Math.max(peak, active); if (calls === 1) await blocked; active--; });
  const first = queue.request();
  await Promise.resolve();
  queue.request(); queue.request(); release();
  await first; await queue.flush();
  assert.equal(calls, 2); assert.equal(peak, 1);
});
test('failed analysis can be retried and does not deadlock shutdown', async () => {
  let calls = 0;
  const queue = new AnalysisQueue(async () => { if (++calls === 1) throw new Error('offline'); });
  await assert.rejects(queue.request(), /offline/);
  await queue.request(); await queue.flush(); assert.equal(calls, 2);
});
test('unverifiable model evidence and malformed output are rejected', () => {
  const value = { summary: '논의 중', decisions: [], actions: [], openQuestions: [], cards: [{ type: 'QUESTION', content: '담당자는?', evidenceIds: ['invented'] }] };
  assert.throws(() => parseAnalysis(value, new Set(['real'])));
  assert.throws(() => parseAnalysis({ ...value, cards: [], decisions: [42] }, new Set()));
  assert.equal(parseAnalysis({ ...value, cards: [] }, new Set()).summary, '논의 중');
});
test('analysis preserves concurrent notes/transcript and suppresses duplicate cards', () => {
  const m = newMeeting(); m.notes = '직접 적은 메모'; m.transcript = [{ id: 't1', text: '다음 주에 하죠', at: new Date().toISOString() }];
  const analysis = parseAnalysis({ summary: '일정 논의', decisions: [], actions: ['담당자 미정'], openQuestions: [], cards: [{ type: 'QUESTION', content: '담당자는 누구인가요?', evidenceIds: ['t1'] }] }, new Set(['t1']));
  const next = applyAnalysis(applyAnalysis(m, analysis), analysis);
  assert.equal(next.notes, m.notes); assert.deepEqual(next.transcript, m.transcript); assert.equal(next.cards.length, 1);
  assert.match(reportFor(next), /직접 적은 메모/); assert.match(reportFor(next), /담당자 미정/);
});

test('notes and transcript survive reload; other meetings survive updates and deletion', () => {
  const data = new Map();
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const first = newMeeting(), second = newMeeting();
  first.notes = '보존할 메모'; first.transcript = [{ id: 'x', text: '종료 직전 발언', at: 'now' }];
  saveMeeting(first); saveMeeting(second); saveMeeting({ ...first, title: '수정' });
  assert.equal(loadMeetings().length, 2);
  assert.equal(loadMeetings()[0].notes, '보존할 메모');
  assert.equal(loadMeetings()[0].transcript[0].text, '종료 직전 발언');
  deleteMeeting(first.id); assert.equal(loadMeetings()[0].id, second.id);
});
test('corrupt storage and quota errors are surfaced without overwriting old data', () => {
  let raw = '{broken';
  globalThis.localStorage = { getItem: () => raw, setItem: () => { throw new Error('quota'); } };
  assert.throws(() => saveMeeting(newMeeting())); assert.equal(raw, '{broken');
  raw = '[]'; assert.throws(() => saveMeeting(newMeeting()), /quota/);
});
