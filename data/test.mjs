import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const gameScript=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const help=fs.readFileSync(new URL('../help.html',import.meta.url),'utf8');
const styles=fs.readFileSync(new URL('../style.css',import.meta.url),'utf8');
assert.match(page,/href="help.html"/,'title links to help');
assert.match(help,/基本ルール/,'help covers rules');
assert.match(help,/トーナメント/,'help covers tournaments');
assert.doesNotMatch(page,/CHALLENGER|portrait-frame/,'portrait has no enclosing panel');
assert.match(styles,/\.menu > \.help-button \{[^}]*min-height: 66px/,'help button is prominent');
assert.match(styles,/grid-template-rows: clamp\(134px, 22svh, 190px\) 58px/,'scoreboard reserves stable height');
const rosterScript=fs.readFileSync(new URL('../characters.js',import.meta.url),'utf8');
const cupsScript=fs.readFileSync(new URL('../daily-cups.js',import.meta.url),'utf8');
assert.match(page,/src="daily-cups.js"/,'fixed-date cup calendar loads');
assert.match(page,/id="history-view"/,'trophy room exists');
const manifest=JSON.parse(fs.readFileSync(new URL('./characters.json',import.meta.url),'utf8'));
assert.equal(manifest.characters.length,99);
assert.equal(manifest.characters.filter(character=>character.profile.tearful).length,20,'one fifth of opponents keep the tear pixel');
assert.ok(manifest.characters.every(character=>Number.isInteger(character.profile.friendliness)&&Number.isInteger(character.profile.taunt)&&character.profile.personality&&character.profile.voice),'every character has a stable personality');
assert.match(styles,/\.scoreboard \.speech \{[^}]*yodaka/,'dialogue uses YODAKA');
assert.match(styles,/\.scoreboard \{ font: clamp\(26px, 5svh, 43px\) yodaka/,'names and scores use large YODAKA letters');
assert.match(styles,/\.portrait-scanlines \{[^}]*image-rendering: pixelated/,'canvas scanlines render sharply');
assert.match(page,/<canvas class="portrait-scanlines" id="opponent-scanlines"/,'portrait scanlines use Canvas');
assert.match(page,/src="audio.js"/,'synthesis script loads');
assert.doesNotMatch(styles,/mask-image:|remote-beam|remote-lines/,'scanlines have no animated mask');
assert.match(styles,/font: clamp\(32px, 4\.4svh, 42px\)\/1\.1 yodaka/,'dialogue text is doubled');
assert.match(styles,/\.menu, \.stage, \.back-button, \.help-button \{ font-family: yodaka/,'menu controls use YODAKA');
assert.doesNotMatch(styles,/remote-beam|remote-lines/,'scanlines remain still');
assert.ok(manifest.characters.filter(character=>character.profile.talkativeness<=8).length>=10,'several characters are nearly silent');
for(const character of manifest.characters){
  assert.ok(character.profile,'profile for '+character.name);
  assert.equal(character.profile.strength>=20&&character.profile.strength<=95,true);
  for(const file of [character.file,character.winFile,character.loseFile]) assert.equal(fs.existsSync(new URL('../characters/'+file,import.meta.url)),true);
  for(const part of [character.eyes,character.mouth]) assert.equal(fs.existsSync(new URL('../characters/player-parts/'+part+'.png',import.meta.url)),true);
  for(const key of ['normalMask','winMask','loseMask'])assert.match(character[key],/^[0-9a-f]{64}$/);
  for(const suffix of ['face-scan','win-scan','lose-scan'])assert.equal(fs.existsSync(new URL('../characters/'+character.name+'-'+suffix+'.png',import.meta.url)),false);
}

function boot(coarse=false,random=null,day='2026-09-23',storage=new Map()){
  const elements=new Map(),timers=[],drawn=[];
  function element(){
    return {children:[],className:'',hidden:false,classList:{toggle(){},remove(){}},animate(keyframes,options){this.animation={keyframes,options};return {cancel(){}}},
      append(...children){this.children.push(...children)},replaceChildren(...children){this.children=children},
      addEventListener(name,callback){this['on'+name]=callback},setAttribute(name,value){this[name]=value},
      getContext(){return {fillRect(...rect){drawn.push([this.color,...rect])},clearRect(){},setTransform(){},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)}},putImageData(image){drawn.push(['scan',...image.data])},set fillStyle(value){this.color=value},set imageSmoothingEnabled(value){}}}};
  }
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},
    createElement:element,querySelectorAll(){return []}};
  const Clock=class extends Date {constructor(...args){super(...(args.length?args:[day+'T12:00:00Z']))}};
  const context={document,Date:Clock,window:{matchMedia(){return {matches:coarse}},localStorage:{getItem(key){return storage.get(key)||null},setItem(key,value){storage.set(key,value)}}},
    setTimeout(callback,delay){callback.delay=delay;timers.push(callback)},console};
  if(random!==null)context.Math=Object.assign(Object.create(Math),{random:()=>random});
  vm.runInNewContext(rosterScript,context,{filename:'characters.js'});
  vm.runInNewContext(cupsScript,context,{filename:'daily-cups.js'});
  vm.runInNewContext(gameScript.replace('    window.GravityFour={legalMoves', '    window.__testPlay=play; window.GravityFour={legalMoves'),context,{filename:'game.js'});
  return {game:context.window.GravityFour,play:context.window.__testPlay,elements,timers,drawn,buttons:elements.get('board').children};
}

function finishBracket(fixture){
  while(fixture.elements.get('match-actions').hidden||fixture.elements.get('bracket-rounds').children[0]?.children.some(child=>child.className.includes('bracket-traveler'))){
    assert.ok(fixture.timers.length,'bracket reveal is scheduled');
    fixture.timers.shift()();
  }
}

const desktop=boot();
const {game,buttons,timers}=desktop;
assert.equal(desktop.elements.get('tournament-list').children.length,3);
assert.equal(desktop.elements.has('menu-gallery'),false,'title screen has no portraits');
assert.equal(desktop.elements.get('menu').hidden,false);
const empty=new Uint8Array(100);
assert.equal(game.legalMoves(empty).length,36,'opening has 36 legal cells');
assert.equal(game.legalMoves(empty).includes(11),false,'interior initially unavailable');
empty[1]=1;
assert.equal(game.legalMoves(empty).includes(11),true,'stone at top supports cell below');
const four=new Uint8Array(100);
for(const row of [0,2,4])for(let col=0;col<4;col++)four[row*10+col]=1;
assert.equal(game.wins(four,1).won,true,'three fours win');
const five=new Uint8Array(100);
for(let col=0;col<5;col++)five[col]=2;
assert.equal(game.wins(five,2).five.length,1,'five wins');
for(const [size,expected] of [[8,{beginner:7,regular:0,champion:0}],[16,{beginner:7,regular:8,champion:0}],[32,{beginner:7,regular:8,champion:16}]]){
  game.startTournament(size);
  assert.equal(desktop.elements.get('round-intro').hidden,false);
  timers.shift()();
  const state=game.getTournament();
  assert.equal(state.size,size);
  assert.equal(state.ranks.length,size-1);
  for(const rank of Object.keys(expected))assert.equal(state.ranks.filter(value=>value===rank).length,expected[rank]);
  assert.equal(desktop.elements.get('score-opponent-name').textContent,state.opponent,'large score names the opponent');
  assert.equal(desktop.elements.get('opponent-face').src,'characters/'+state.opponent+'.png','faceless portrait base appears above score name');
  const opponent=manifest.characters.find(character=>character.name===state.opponent);
  assert.equal(desktop.elements.get('opponent-eyes').src,'characters/player-parts/'+opponent.eyes+'.png','shared eyes overlay the base');
  assert.equal(desktop.elements.get('opponent-mouth').src,'characters/player-parts/'+opponent.mouth+'.png','shared mouth overlays the base');
  assert.equal(desktop.elements.get('opponent-expression').hidden,true);
  assert.ok(desktop.drawn.some(([kind,...bytes])=>kind==='scan'&&bytes.some(value=>value>0)),'runtime scanlines are visible');
  assert.ok(desktop.drawn.some(([kind,...bytes])=>kind==='scan'&&bytes.some((value,index)=>index%4===3&&value===79)&&bytes.some((value,index)=>index%4===3&&value===86)),'scanline contrast uses the reduced alpha values');
}
game.startTournament(8);timers.shift()();
assert.equal(desktop.drawn.some(([,x,y,w,h])=>w===160&&h===160),false,'board has no solid fill');
assert.ok(desktop.drawn.some(([color])=>color==='#31b978'),'board draws green lines');
buttons[0].onclick();
assert.equal(desktop.elements.get('thinking').hidden,false,'thinking indicator appears');
assert.equal(game.getBoard()[0],1,'desktop click places a stone');
timers.pop()();
assert.equal([...game.getBoard()].filter(Boolean).length,2,'COM replies');
assert.ok(desktop.drawn.some(([color])=>color==='#39ef9b'),'green crystal drawn');
assert.ok(desktop.drawn.some(([color])=>color==='#ff5a76'),'red crystal drawn');
assert.ok(desktop.drawn.some(([color])=>color==='#f1ffff'),'latest COM move glows white');
const flash=desktop.elements.get('board').children.find(child=>child.className==='com-move-flash');
assert.equal(flash.animation.options.iterations,2,'COM stone flashes twice');
assert.equal(flash.animation.options.duration,900,'COM stone flashes slowly');
assert.match(flash.style,/left:\d+%;top:\d+%/,'flash is centered on the COM move');
assert.equal(desktop.elements.get('thinking').hidden,true,'thinking indicator clears');
desktop.elements.get('back').onclick();
assert.equal(desktop.elements.get('leave-confirm').hidden,false,'an active tournament asks before returning to menu');
assert.match(page,/トーナメントハ サイショカラニナリマス ヨロシイデスカ/);
desktop.elements.get('leave-no').onclick();
assert.equal(desktop.elements.get('menu').hidden,true,'NO continues the current match');
desktop.elements.get('back').onclick();desktop.elements.get('leave-yes').onclick();
assert.equal(desktop.elements.get('menu').hidden,false,'YES returns to menu');

const paused=boot();paused.game.startTournament(8);paused.timers.shift()();
paused.buttons[0].onclick();paused.elements.get('back').onclick();
paused.timers.shift()();
assert.equal([...paused.game.getBoard()].filter(Boolean).length,1,'COM waits while MENU confirmation is open');
paused.elements.get('leave-no').onclick();paused.timers.shift()();
assert.equal([...paused.game.getBoard()].filter(Boolean).length,2,'NO resumes the match');

const mobile=boot(true);
mobile.game.startTournament(8);mobile.timers.shift()();
mobile.buttons[0].onclick();
assert.equal([...mobile.game.getBoard()].filter(Boolean).length,0,'tap selects without placing');
assert.equal(mobile.elements.get('place').disabled,false,'PLACE becomes available');
mobile.elements.get('place').onclick();
assert.equal(mobile.game.getBoard()[0],1,'PLACE confirms selected point');
mobile.timers.shift()();
assert.equal([...mobile.game.getBoard()].filter(Boolean).length,2,'COM replies after mobile placement');
const deliberate=boot(false,0);
deliberate.game.startTournament(8);deliberate.timers.shift()();
assert.equal(deliberate.elements.get('speech').hidden,false,'each opponent greets at match start');
assert.match(deliberate.elements.get('speech').textContent,/ヨロシク|コンチワ|ウィッス|オテヤワラカニ|ショウブ/,'greeting is katakana');
deliberate.buttons[0].onclick();
assert.ok(deliberate.timers[0].delay>=1400,'some opponents pause to think');
deliberate.game.settings.talkativeness=0;
deliberate.timers.shift()();
assert.equal(deliberate.elements.get('speech').hidden,true,'quiet character can stay silent');
const run=boot();
run.game.startTournament(8);run.timers.shift()();
for(let round=0;round<3;round++){
  for(let col=0;col<5;col++){
    assert.equal(run.play(col,1),true);
    if(col===3){
      assert.equal(run.elements.get('human-score').textContent,1,'four scores immediately');
      assert.ok(run.drawn.some(([color,, ,width,height])=>color==='#39ef9b'&&width===15&&height===1),'four stays outlined in its own color');
    }
  }
  assert.equal(run.elements.get('result').textContent,round===2?'TOURNAMENT CHAMPION':'YOU WIN');
  assert.equal(run.elements.get('tournament-recap').hidden,true,'recap waits for result');
  assert.equal(run.elements.get('victory-effect').hidden,false,'victory effect appears');
  assert.equal(run.elements.get('opponent-expression').src,'characters/lose.png','opponent reacts to defeat');
  assert.equal(run.elements.get('victory-opponent-face').src,run.elements.get('opponent-face').src,'body stays visible during victory effect');
  assert.equal(run.elements.get('victory-opponent-expression').src,run.elements.get('opponent-expression').src,'expression stays visible during victory effect');
  assert.ok(run.drawn.some(([kind])=>kind==='scan'),'defeat scanlines redraw');
  assert.equal(run.elements.get('speech').hidden,false,'opponent always speaks after the result');
  assert.equal(run.elements.get('victory-effect').className.includes(round===2?'champion':'round-clear'),true);
  assert.equal(run.elements.get('victory-particles').children.length,round===2?96:18);
  if(round===2){
    assert.match(page,/class="victory-trophy"[^>]*src="trophy.svg"/,'champion sees the large trophy');
    assert.equal(run.elements.get('victory-particles').children.filter(p=>p.className.includes('side-confetti')).length,96,'champion confetti launches from both sides');
  }
  assert.equal(run.timers[0].delay,round===2?5200:2400,'champion effect lasts longer');
  run.timers.shift()();
  assert.equal(run.elements.get('tournament-recap').hidden,false,'recap appears after match');
  const battles=run.elements.get('recap-battles').children;
  assert.equal(battles.length,round+2,'recap shows every match in this tournament');
  assert.equal(battles.at(-1).children[3].textContent,'WIN','the latest result is shown');
  assert.equal(battles.at(-1).children[1].children.length,2,'opponent icon includes body and reaction');
  const moving=run.elements.get('bracket-rounds').children[0];
  assert.ok(moving.children.some(child=>child.className.includes('bracket-traveler')&&child.style?.includes('--corner-x:')&&child.style?.includes('--travel-y:')),'winner cards follow the crank path');
  finishBracket(run);
  const canvas=run.elements.get('bracket-rounds').children[0];
  assert.ok(canvas.className.includes('single-sided'),'8 player bracket progresses left to right');
  assert.ok(canvas.children.some(child=>child.className.includes('bracket-line')),'bracket has connector lines');
  assert.ok(canvas.children.some(child=>child.className.includes('promoted')),'round winners animate into the next column');
  if(round===2)assert.ok(canvas.children.some(child=>child.className.includes('bracket-entry')&&child.className.includes('champion')&&child.children.at(-1).textContent==='YOU'),'player champion is highlighted');
  run.elements.get('next-match').onclick();
  run.timers.shift()();
  assert.equal(run.game.getTournament().round,round===2?0:round+1);
}
for(const size of [16,32]){
  const fixture=boot();fixture.game.startTournament(size);fixture.timers.shift()();
  for(let col=0;col<5;col++)fixture.play(col,1);
  fixture.timers.shift()();
  const canvas=fixture.elements.get('bracket-rounds').children[0];
  assert.ok(canvas.children.some(child=>child.className.includes('bracket-traveler')),'both sides send winning cards toward the center');
  assert.ok(canvas.className.includes('two-sided'),size+' player bracket joins from both sides');
  assert.ok(canvas.children.filter(child=>child.className.includes('bracket-line')).length>20,'connector lines are visible');
}
const championAdvance=boot();
championAdvance.game.startTournament(32);championAdvance.timers.shift()();
for(let col=0;col<5;col++)championAdvance.play(col,1);
championAdvance.timers.shift()();
assert.equal(championAdvance.elements.get('match-actions').hidden,false,'NEXT MATCH is available while the champion bracket animates');
championAdvance.elements.get('next-match').onclick();
championAdvance.timers.shift()(); // Stale bracket animation is cancelled by the new match token.
championAdvance.timers.shift()(); // The next round introduction completes.
assert.equal(championAdvance.game.getTournament().round,1,'champion tournament advances after one win');
for(const size of [8,32]){
  const loss=boot(false,null,'2026-09-23');
  loss.game.startTournament(size);loss.timers.shift()();
  for(let col=0;col<5;col++)loss.play(col,2);
  loss.timers.shift()();
  let canvas=loss.elements.get('bracket-rounds').children[0];
  assert.ok(canvas.children.some(child=>child.className.includes('bracket-traveler')),'eliminating opponent advances along the bracket line');
  finishBracket(loss);
  canvas=loss.elements.get('bracket-rounds').children[0];
  assert.equal(canvas.children.filter(child=>child.className.includes('bracket-entry pending')).length,0,'no round stays unresolved after a loss');
  const champion=canvas.children.find(child=>child.className.includes('bracket-entry')&&child.className.includes('champion'));
  assert.ok(champion&&champion.children.at(-1).textContent!=='YOU','another entrant wins the cup after elimination');
  assert.equal(loss.elements.get('recap-subtitle').textContent,champion.children.at(-1).textContent+' WINS THE CUP');
  assert.equal(loss.elements.get('bracket-crowning').hidden,false,'simulated champion receives a trophy banner');
  assert.equal(loss.elements.get('bracket-confetti').children.length,48,'simulated champion gets confetti');
  const winner=manifest.characters.find(character=>character.name===champion.children.at(-1).textContent);
  assert.equal(loss.elements.get('bracket-champion-face').src,'characters/'+winner.file,'the winning character appears large');
  assert.equal(loss.elements.get('bracket-champion-expression').src,'characters/win.png','the champion has a winning expression');
  assert.ok(loss.elements.get('bracket-champion-scanlines'),'the large champion portrait receives the remote effect');
}
const redFour=boot();redFour.game.startTournament(8);redFour.timers.shift()();
for(let col=0;col<4;col++)redFour.play(col,2);
assert.equal(redFour.elements.get('com-score').textContent,1);
for(let col=4;col<5;col++)redFour.play(col,2);
assert.equal(redFour.elements.get('opponent-expression').src,'characters/win.png','opponent shows winning expression');
assert.ok(redFour.drawn.some(([kind])=>kind==='scan'),'winning scanlines redraw');
assert.equal(redFour.elements.get('speech').hidden,false,'opponent speaks after a win');
assert.ok(redFour.drawn.some(([color,, ,width,height])=>color==='#ff5a76'&&width===15&&height===1),'opponent four uses red outline');


const cupContext={window:{}};
vm.runInNewContext(cupsScript,cupContext);
const cupDates=cupContext.window.GravityFourCups;
assert.equal(Object.keys(cupDates).length,366,'all dates including leap day have a cup');
for(let day=0;day<366;day++){
  const date=new Date(Date.UTC(2024,0,1+day)).toISOString().slice(5,10);
  assert.match(cupDates[date][0],/ CUP$/,'every date has a named cup');
}
assert.equal(cupDates['03-21'][0],'FLOWER CUP');
assert.equal(cupDates['09-23'][0],'CHECKERS CUP');
assert.ok(cupDates['02-29'],'leap day has its own fixed date');

const first=boot(false,null,'2026-03-21');
const second=boot(false,null,'2026-03-21');
first.game.startTournament(32);second.game.startTournament(32);
assert.equal(JSON.stringify(first.game.getTournament().entrants),JSON.stringify(second.game.getTournament().entrants),'the same UTC day has the same opponents worldwide');
assert.equal(first.game.getTournament().cup,'FLOWER CUP');
const originalEntrants=first.game.getTournament().entrants;
first.game.startTournament(32);
assert.equal(JSON.stringify(first.game.getTournament().entrants),JSON.stringify(originalEntrants),'retrying does not reroll opponents');
const nextDay=boot(false,null,'2026-03-22');nextDay.game.startTournament(32);
assert.notEqual(JSON.stringify(nextDay.game.getTournament().entrants),JSON.stringify(originalEntrants),'another UTC day has a different bracket');

const sharedStorage=new Map(),career=boot(false,null,'2026-03-21',sharedStorage);
career.game.startTournament(8);career.timers.shift()();
for(let round=0;round<3;round++){
  for(let col=0;col<5;col++)career.play(col,1);
  if(round<2){career.timers.shift()();finishBracket(career);career.elements.get('next-match').onclick();career.timers.shift()();}
}
career.elements.get('back').onclick();
career.elements.get('history-button').onclick();
assert.equal(career.elements.get('history-view').hidden,false);
assert.equal(career.elements.get('history-cup').textContent,'FLOWER CUP');
assert.equal(career.elements.has('history-total-wins'),false,'global title counter is removed');
const beginnerRecord=career.elements.get('history-list').children[0];
assert.equal(beginnerRecord.children[1].children[1].textContent,'1ST','today shows the best rank');
assert.equal(beginnerRecord.children[2].children[1].textContent,'1ST','lifetime best rank is saved');
assert.equal(beginnerRecord.children[3].children[0].textContent,'TOTAL 1ST');
assert.equal(beginnerRecord.children[3].children[1].textContent,'1','title count is saved per tournament');
career.elements.get('history-open').onclick();
assert.equal(career.elements.get('history-log-view').hidden,false);
assert.equal(career.elements.get('history-score-total').textContent,7,'three wins score seven points');
assert.equal(career.elements.get('history-rows').children[0].children[5].textContent,'7');
career.elements.get('history-log-back').onclick();
assert.equal(career.elements.get('history-view').hidden,false);
const reloaded=boot(false,null,'2026-03-21',sharedStorage);
reloaded.elements.get('history-button').onclick();
assert.equal(reloaded.elements.get('history-list').children[0].children[3].children[1].textContent,'1','titles persist across reloads');
const tomorrow=boot(false,null,'2026-03-22',sharedStorage);
tomorrow.elements.get('history-button').onclick();
assert.equal(tomorrow.elements.get('history-list').children[0].children[1].children[1].textContent,'—','daily rankings reset at UTC midnight');
assert.equal(tomorrow.elements.get('history-list').children[0].children[2].children[1].textContent,'1ST','lifetime best survives the date change');


const scoredStorage=new Map([['gravityfour-history-v1',JSON.stringify({
  days:{'2026-03-21':{8:4,16:4,32:4},'2026-03-22':{8:1,16:2}},
  best:{},wins:{}
})]]);
const ledger=boot(false,null,'2026-03-22',scoredStorage);
ledger.elements.get('history-button').onclick();ledger.elements.get('history-open').onclick();
assert.equal(ledger.elements.get('history-score-total').textContent,25,'total adds each daily score once');
const historyRows=ledger.elements.get('history-rows').children;
assert.equal(historyRows.length,2);
assert.equal(historyRows[0].children[0].children[0].textContent,'03/22','newest month/day appears first');
assert.equal(historyRows[0].children[5].textContent,'14');
assert.equal(historyRows[1].children[0].children[0].textContent,'03/21');
assert.equal(historyRows[1].children[1].textContent,'FLOWER CUP');
assert.equal(historyRows[1].children[5].textContent,'11','one, two and three wins contribute 1 + 3 + 7');
assert.equal(historyRows[1].children[2].textContent,'BEST 4');
assert.equal(historyRows[1].children[4].textContent,'BEST 4');

const defeated=boot(false,null,'2026-09-23',new Map());
defeated.game.startTournament(8);defeated.timers.shift()();
for(let col=0;col<5;col++)defeated.play(col,2);
defeated.elements.get('back').onclick();defeated.elements.get('history-button').onclick();
assert.equal(defeated.elements.get('history-list').children[0].children[1].children[1].textContent,'BEST 8','first-round elimination stays in the top eight bracket');

const routes=[boot(false,null,'2026-09-23'),boot(false,null,'2026-09-23')];
for(const fixture of routes){
  fixture.game.startTournament(8);fixture.timers.shift()();
  for(let col=0;col<5;col++)fixture.play(col,1);
  fixture.timers.shift()();finishBracket(fixture);fixture.elements.get('next-match').onclick();fixture.timers.shift()();
}
assert.equal(routes[0].game.getTournament().opponent,routes[1].game.getTournament().opponent,'later opponents are also deterministic');

console.log('Gravity Four tournament checks passed');
