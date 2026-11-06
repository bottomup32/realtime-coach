import {test} from 'node:test';
import assert from 'node:assert/strict';
import {speakerName} from '../src/lib/coach/speakers.ts';
import {newMeeting,personalCards,applyAnalysis} from '../src/lib/coach/model.ts';
test('unassigned speech stays unknown; manual labels are preserved',()=>{
 assert.equal(speakerName({id:'x',text:'대화',at:'now'}),'화자 미확인');
 assert.equal(speakerName({id:'x',text:'대화',at:'now',speakerId:'manual-b',speakerLabel:'Speaker B'}),'Speaker B');
});
test('personal coaching must cite only the selected speaker; meeting questions remain',()=>{
 const transcript=[{id:'a',text:'A',at:'now',speakerId:'A'},{id:'b',text:'B',at:'now',speakerId:'B'}];
 const analysis={summary:'요약',decisions:[],actions:[],openQuestions:[],cards:[{id:'1',type:'COACH',content:'A 코칭',evidenceIds:['a']},{id:'2',type:'COACH',content:'B 코칭',evidenceIds:['b']},{id:'3',type:'QUESTION',content:'회의 질문',evidenceIds:['a','b']}]};
 assert.deepEqual(personalCards(analysis,transcript,'B').cards.map(c=>c.id),['2','3']);assert.equal(personalCards(analysis,transcript,'B').cards[0].targetSpeakerId,'B');assert.deepEqual(personalCards(analysis,transcript).cards.map(c=>c.id),['3']);
});
test('intermediate summaries retain earlier decisions rather than overwriting history',()=>{
 let m=newMeeting();m=applyAnalysis(m,{summary:'첫 논의',decisions:[],actions:[],openQuestions:[],cards:[]});m=applyAnalysis(m,{summary:'합의',decisions:['금요일 출시'],actions:[],openQuestions:[],cards:[]});
 assert.equal(m.summaryHistory.length,2);assert.equal(m.summaryHistory[0].summary,'첫 논의');assert.equal(m.summary,'합의');
});
