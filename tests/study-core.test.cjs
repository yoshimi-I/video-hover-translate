const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const file=require('node:path').join(__dirname,'../study-core.js');
const core=fs.existsSync(file)?require(file):{};
const history=[
 {kind:'word',headword:'Hello',ja:'こんにちは',sentence:'Hello world',title:'First',at:1},
 {kind:'word',headword:'hello',ja:'やあ',sentence:'Hello again',title:'Second',at:3},
 {kind:'word',headword:'world',ja:'世界',at:2},
 {kind:'phrase',headword:'look up',ja:'調べる',at:4},
 {kind:'span',headword:'take a break',ja:'休憩する',at:5}
];
test('deduplicate saved history across titles while retaining frequency and latest meaning',()=>{
 assert.equal(typeof core.buildLibrary,'function');
 const cards=core.buildLibrary([...history,null,{}, {kind:'word',headword:'',ja:'bad'}, {kind:'bogus',headword:'a',ja:'b'}]);
 assert.equal(cards.length,4);
 const hello=cards.find(c=>c.key==='w:hello');
 assert.deepEqual({ja:hello.ja,count:hello.count,title:hello.title,firstAt:hello.firstAt,lastAt:hello.lastAt},{ja:'やあ',count:2,title:'Second',firstAt:1,lastAt:3});
 assert.equal(core.buildLibrary(null).length,0);
});
test('filters search English/Japanese/title and constrain kind',()=>{
 const cards=core.buildLibrary(history);
 assert.equal(core.filterLibrary(cards,{query:'HELLO'}).length,1);
 assert.equal(core.filterLibrary(cards,{query:'調べ'}).length,1);
 assert.equal(core.filterLibrary(cards,{query:'second'}).length,1);
 assert.equal(core.filterLibrary(cards,{kind:'word'}).length,2);
});
test('quiz questions do not repeat and options have one correct answer with distinct meanings',()=>{
 const cards=core.buildLibrary([...history,{kind:'word',headword:'earth',ja:'世界',at:6}]);
 const quiz=core.createQuiz(cards,{limit:20,random:()=>0.2});
 assert.equal(quiz.length,5);
 assert.equal(new Set(quiz.map(q=>q.card.key)).size,5);
 for(const q of quiz){assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,q.options.length);assert.equal(q.options.filter(v=>v===q.card.ja).length,1);}
 assert.equal(core.createQuiz(cards,{limit:2}).length,2);
});
test('empty histories produce no quiz; one meaning produces a flashcard',()=>{
 assert.deepEqual(core.createQuiz([]),[]);
 const quiz=core.createQuiz(core.buildLibrary(history.slice(0,1)));
 assert.equal(quiz[0].mode,'flashcard');
 assert.deepEqual(quiz[0].options,[]);
});
test('only last-wrong cards are selected for mistake review; progress updates without mutating history',()=>{
 const cards=core.buildLibrary(history);
 const first=core.recordAnswer({},'w:hello',false,10);
 const next=core.recordAnswer(first,'w:hello',true,20);
 assert.equal(first['w:hello'].correct,0);
 assert.deepEqual(next['w:hello'],{attempts:2,correct:1,lastCorrect:true,lastReviewedAt:20});
 assert.equal(core.createQuiz(cards,{mistakesOnly:true,progress:first}).length,1);
 assert.equal(core.createQuiz(cards,{mistakesOnly:true,progress:next}).length,0);
});
test('CSV preserves Japanese and escaped newlines, and neutralizes spreadsheet formulas',()=>{
 const cards=core.buildLibrary([{kind:'word',headword:'=1+1',ja:'"quote",日本語\n二行',sentence:' @SUM(1)',at:1}]);
 const csv=core.exportVocabulary(cards,{},'csv');
 assert.ok(csv.startsWith('\uFEFF'));
 assert.ok(csv.includes("'=1+1"));
 assert.ok(csv.includes('""quote""'));
 assert.ok(csv.includes("' @SUM(1)"));
 assert.ok(csv.includes('\r\n'));
});
test('JSON contains only schema vocabulary/progress fields, never API configuration',()=>{
 const cards=core.buildLibrary(history);
 cards[0].apiKey='secret';
 const json=core.exportVocabulary(cards,{},'json',100);
 const parsed=JSON.parse(json);
 assert.equal(parsed.version,1);
 assert.equal(parsed.words.length,4);
 assert.ok(!json.includes('apiKey'));assert.ok(!json.includes('secret'));
});
test('Anki output has exactly two plain text fields per line even for multiline text',()=>{
 const cards=core.buildLibrary([{kind:'word',headword:'Hello\tthere',ja:'やあ\nこんにちは',at:1}]);
 const tsv=core.exportVocabulary(cards,{},'anki');
 assert.equal(tsv.trim().split('\n').length,1);
 assert.equal(tsv.trim().split('\t').length,2);
 assert.throws(()=>core.exportVocabulary(cards,{},'bogus'));
});
