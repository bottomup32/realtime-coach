import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupSpeakerWords} from '../src/lib/coach/speakers.ts';
import {newMeeting,personalCards,applyAnalysis} from '../src/lib/coach/model.ts';
test('provider word speakers produce ordered A/B/A utterances, unknown stays unknown',()=>{
 const items=groupSpeakerWords([{word:'출시',speaker:0,start:1},{word:'일정',speaker:0},{word:'확인',speaker:1},{word:'동의',speaker:0},{word:'겹침'}],'session1',0);
 assert.equal(items.length,4);assert.equal(items[0].text,'출시 일정');assert.equal(items[1].speakerLabel,'Speaker B');assert.equal(items[2].speakerLabel,'Speaker A');assert.equal(items[3].speakerId,undefined);assert.equal(items[0].at,'1970-01-01T00:00:01.000Z');
});
test('speaker IDs are scoped to the provider session, not guessed across reconnects',()=>{
 assert.notEqual(groupSpeakerWords([{word:'안녕',speaker:0}],'one',0)[0].speakerId,groupSpeakerWords([{word:'안녕',speaker:0}],'two',0)[0].speakerId);
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
