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
    return {children:[],className:'',hidden:false,classList:{toggle(){},remove(){}},animate(keyframes,options){this.animation={keyframes,options};this.activeAnimation={cancel(){}};return this.activeAnimation},
      append(...children){this.children.push(...children)},replaceChildren(...children){this.children=children},
      addEventListener(name,callback){this['on'+name]=callback},setAttribute(name,value){this[name]=value},
      getContext(){return {fillRect(...rect){drawn.push([this.color,...rect])},clearRect(){},setTransform(){},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)}},putImageData(image){drawn.push(['scan',...image.data])},set fillStyle(value){this.color=value},set imageSmoothingEnabled(value){}}}};
  }
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},
    createElement:element,querySelectorAll(){return []}};
  const Clock=class extends Date {constructor(...args){super(...(args.length?args:[day.includes('T')?day:day+'T12:00:00Z']))}};
  const context={document,Date:Clock,window:{matchMedia(){return {matches:coarse}},localStorage:{getItem(key){return storage.get(key)||null},setItem(key,value){storage.set(key,value)}}},
    setTimeout(callback,delay){callback.delay=delay;timers.push(callback)},console};
  if(random!==null)context.Math=Object.assign(Object.create(Math),{random:()=>random});
  vm.runInNewContext(rosterScript,context,{filename:'characters.js'});
  vm.runInNewContext(cupsScript,context,{filename:'daily-cups.js'});
  vm.runInNewContext(gameScript.replace('    window.GravityFour={legalMoves', '    window.__testPlay=play; window.__testBracketPosition=bracketPosition; window.GravityFour={legalMoves'),context,{filename:'game.js'});
  return {game:context.window.GravityFour,play:context.window.__testPlay,bracketPosition:context.window.__testBracketPosition,elements,timers,drawn,buttons:elements.get('board').children};
}

function finishBracket(fixture){
  while(fixture.elements.get('match-actions').hidden||fixture.elements.get('bracket-rounds').children[0]?.children.some(child=>child.className.includes('bracket-traveler'))){
    assert.ok(fixture.timers.length,'bracket reveal is scheduled');
    fixture.timers.shift()();
  }
}

const viewing=boot(false,0);
viewing.elements.get('watch-button').onclick();
assert.equal(viewing.elements.get('stage').hidden,false,'watch mode opens the match');
assert.equal(viewing.elements.get('match-progress').textContent,'WATCH MODE');
assert.notEqual(viewing.elements.get('score-player-name').textContent,'YOU','watch mode chooses a COM for the green side');
assert.notEqual(viewing.elements.get('score-player-name').textContent,viewing.elements.get('score-opponent-name').textContent,'the watching COMs differ');
assert.match(viewing.elements.get('watch-left-face').src,/^characters\//,'the left COM has its own portrait');
viewing.timers.shift()();
assert.equal(viewing.buttons[0].disabled,true,'watch mode has no playable cells');
viewing.timers.shift()();
assert.equal([...viewing.game.getBoard()].filter(Boolean).length,1,'AI makes the first green move');
assert.ok(viewing.timers[0].delay>=3300,'the watching opponent thinks three times longer');
viewing.timers.shift()();
assert.equal([...viewing.game.getBoard()].filter(Boolean).length,2,'opponent COM replies and watch mode continues');
viewing.elements.get('back').onclick();
assert.equal(viewing.elements.get('menu').hidden,false,'watch mode can return to the menu');

const watchStorage=new Map(),looping=boot(false,0,'2026-03-21',watchStorage);
looping.elements.get('watch-button').onclick();
looping.timers.shift()();
for(let col=0;col<5;col++)assert.equal(looping.play(col,1),true);
assert.equal(looping.elements.get('result').hidden,false,'watch mode shows the result');
assert.equal(looping.timers.at(-1).delay,15600,'watch mode pauses three times longer after a win');
looping.timers.pop()();
assert.equal([...looping.game.getBoard()].filter(Boolean).length,0,'watch mode starts another match automatically');
assert.equal(looping.elements.get('match-progress').textContent,'WATCH MODE');
assert.equal(watchStorage.has('gravityfour-history-v1'),false,'watch mode does not alter records');

const narrowCard=boot(false,0);
const shortName=narrowCard.bracketPosition(32,0,0,{name:'AB'});
const longName=narrowCard.bracketPosition(32,0,0,{name:'ABCD'});
assert.ok(shortName.width<longName.width,'the portrait card follows its name width');
const finalLeft=narrowCard.bracketPosition(32,4,0,{name:'AAAA'}),finalRight=narrowCard.bracketPosition(32,4,1,{name:'BBBB'});
assert.equal(finalRight.x-finalLeft.x-finalLeft.width,19,'finalists are separated by one third of the former gap');
const narrowFinalLeft=narrowCard.bracketPosition(32,4,0,{name:'A'}),narrowFinalRight=narrowCard.bracketPosition(32,4,1,{name:'B'});
assert.equal(narrowFinalRight.x-narrowFinalLeft.x-narrowFinalLeft.width,19,'short names keep the same final spacing');
assert.doesNotMatch(page,/id="turn-banner"/,'the board has no center turn-name overlay');

const desktop=boot(false,0);
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
timers.length=0;game.startTournament(8);timers.shift()();
assert.equal(desktop.drawn.some(([,x,y,w,h])=>w===160&&h===160),false,'board has no solid fill');
assert.ok(desktop.drawn.some(([color])=>color==='#2a9e68'),'board draws green lines');
buttons[0].onclick();
assert.equal(desktop.elements.get('thinking').hidden,false,'thinking indicator appears');
assert.equal(game.getBoard()[0],1,'desktop click places a stone');
timers.pop()();
assert.equal([...game.getBoard()].filter(Boolean).length,2,'COM replies');
assert.ok(desktop.drawn.some(([color])=>color==='#39ef9b'),'green crystal drawn');
assert.ok(desktop.drawn.some(([color])=>color==='#ff7891'),'red crystal drawn');
assert.ok(desktop.drawn.some(([color])=>color==='#ffabc0'),'latest COM stone stays bright');
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

const paused=boot(false,0);paused.game.startTournament(8);paused.timers.shift()();
paused.buttons[0].onclick();paused.elements.get('back').onclick();
paused.timers.shift()();
assert.equal([...paused.game.getBoard()].filter(Boolean).length,1,'COM waits while MENU confirmation is open');
paused.elements.get('leave-no').onclick();paused.timers.shift()();
assert.equal([...paused.game.getBoard()].filter(Boolean).length,2,'NO resumes the match');

const mobile=boot(true,0);
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
const run=boot(false,0);
run.game.startTournament(8);run.timers.shift()();
for(let round=0;round<3;round++){
  for(let col=0;col<5;col++){
    assert.equal(run.play(col,1),true);
    if(col===3){
      assert.equal(run.elements.get('human-score').textContent,1,'four scores immediately');
      assert.ok(run.drawn.some(([color,, ,width,height])=>color==='#39ef9b'&&width===15&&height===1),'four stays outlined in its own color');
    }
  }
  assert.equal(run.elements.get('result').textContent,(round===2?'CHAMPION':'YOU WIN')+' · TAP TO CONTINUE');
  assert.match(run.elements.get('result')['aria-label'],/FIVE IN A ROW/,'the winning reason remains accessible');
  assert.equal(run.elements.get('tournament-recap').hidden,true,'recap waits for result');
  assert.equal(run.elements.get('win-orbit').hidden,false,'victory orbit appears around the player');
  assert.equal(run.elements.get('win-orbit').children.length,11,'eleven larger crystal blocks celebrate the win');
  assert.equal(run.elements.get('opponent-expression').src,'characters/lose.png','opponent reacts to defeat');
  assert.ok(run.drawn.some(([kind])=>kind==='scan'),'defeat scanlines redraw');
  assert.equal(run.elements.get('speech').hidden,false,'opponent always speaks after the result');
  if(round===2){assert.ok(run.elements.get('board-frame').className.includes('champion-result'),'champion trophy is shown on the board');assert.equal(run.elements.get('victory-effect').hidden,false,'champion celebration returns');assert.equal(run.elements.get('victory-title').textContent,'CHAMPION');assert.equal(run.elements.get('victory-particles').children.length,70,'champion confetti returns');}
  assert.equal(run.timers[0].delay,5200,'the board remains visible long enough to read the result');
  run.timers.shift()();
  assert.equal(run.elements.get('tournament-recap').hidden,false,'recap appears after match');
  const battles=run.elements.get('recap-battles').children;
  assert.equal(battles.length,round+2,'recap shows every match in this tournament');
  assert.equal(battles.at(-1).children[3].textContent,'WIN','the latest result is shown');
  assert.equal(battles.at(-1).children[1].children.length,2,'opponent icon includes body and reaction');
  const moving=run.elements.get('bracket-rounds').children[0];
  assert.equal(moving.children.filter(child=>child.className==='bracket-heading').length,0,'no duplicate champion heading remains');
  assert.ok(moving.children.some(child=>child.className.includes('bracket-traveler')&&child.style?.includes('--corner-x:')&&child.style?.includes('--travel-y:')),'winner cards follow the crank path');
  assert.equal(run.elements.get('bracket-rounds').className,'bracket-rounds full-bracket','the full table stays visible during movement');
  assert.ok(moving.style.includes('zoom:'),'the whole table is fitted before animation');
  finishBracket(run);
  const canvas=run.elements.get('bracket-rounds').children[0];
  assert.ok(canvas.className.includes('two-sided'),'8 player bracket also joins beneath the champion');
  assert.ok(canvas.children.some(child=>child.className.includes('bracket-line')),'bracket has connector lines');
  if(round<2)assert.ok(canvas.children.some(child=>child.className.includes('promoted')),'round winners animate into the next column');
  if(round===2){assert.equal(run.elements.get('bracket-crowning').hidden,false,'the player champion appears above the bracket');assert.equal(run.elements.get('bracket-champion-player').hidden,false,'the player portrait is composed in the crown');}
  run.elements.get('next-match').onclick();
  run.timers.shift()();
  assert.equal(run.game.getTournament().round,round===2?0:round+1);
}
for(const size of [16,32]){
  const fixture=boot(false,0,'2026-09-24');fixture.game.startTournament(size);fixture.timers.shift()();
  for(let col=0;col<5;col++)fixture.play(col,1);
  fixture.timers.shift()();
  const canvas=fixture.elements.get('bracket-rounds').children[0];
  assert.ok(canvas.children.some(child=>child.className.includes('bracket-traveler')),'both sides send winning cards toward the center');
  assert.ok(canvas.className.includes('two-sided'),size+' player bracket joins from both sides');
  assert.ok(canvas.bracketWidth<600,'the complete bracket has a compact native width');
  assert.equal(canvas.children.filter(child=>child.bracketRound===Math.log2(size)).length,0,'there is no duplicate champion card');
  assert.ok(canvas.children.some(child=>child.bracketRound===Math.log2(size)-1),'finalists remain in the table');

  assert.ok(canvas.children.filter(child=>child.className.includes('bracket-line')).length>20,'connector lines are visible');
}
const championAdvance=boot(false,0,'2026-09-24');
championAdvance.game.startTournament(32);championAdvance.timers.shift()();
for(let col=0;col<5;col++)championAdvance.play(col,1);
championAdvance.timers.shift()();
assert.equal(championAdvance.elements.get('match-actions').hidden,false,'NEXT MATCH is available while the champion bracket animates');
championAdvance.elements.get('next-match').onclick();
championAdvance.timers.shift()(); // Stale bracket animation is cancelled by the new match token.
championAdvance.timers.shift()(); // The next round introduction completes.
assert.equal(championAdvance.game.getTournament().round,1,'champion tournament advances after one win');
for(const size of [8,32]){
  const loss=boot(false,0,size===32?'2026-09-24':'2026-09-23');
  loss.game.startTournament(size);loss.timers.shift()();
  for(let col=0;col<5;col++)loss.play(col,2);
  loss.timers.shift()();
  let canvas=loss.elements.get('bracket-rounds').children[0];
  assert.ok(canvas.children.some(child=>child.className.includes('bracket-traveler')),'eliminating opponent advances along the bracket line');
  finishBracket(loss);
  canvas=loss.elements.get('bracket-rounds').children[0];
  assert.equal(canvas.children.filter(child=>child.className.includes('bracket-entry pending')).length,0,'no round stays unresolved after a loss');
  assert.equal(canvas.children.filter(child=>child.className.includes('bracket-entry champion')).length,0,'the crown replaces the duplicate champion card');
  const winnerName=loss.elements.get('bracket-crowning-name').textContent.replace(' CHAMPION','');
  assert.notEqual(winnerName,'YOU','another entrant wins the cup after elimination');
  assert.equal(loss.elements.get('recap-subtitle').textContent,winnerName+' WINS THE CUP');
  assert.equal(loss.elements.get('bracket-crowning').hidden,false,'simulated champion receives a trophy banner');
  assert.ok(canvas.style.includes('zoom:'),'defeat fits the full bracket into the available area');
  assert.doesNotMatch(page,/id="match-log"/,'the bracket has no match log underneath');
  assert.ok(canvas.children.some(child=>child.className.includes('bracket-line active')),'winner paths stay bright');
  assert.ok(canvas.children.some(child=>child.className==='bracket-line'),'unused paths stay dark');
  assert.equal(loss.elements.get('bracket-confetti').children.length,48,'simulated champion gets confetti');
  const winner=manifest.characters.find(character=>character.name===winnerName);
  assert.equal(loss.elements.get('bracket-champion-face').src,'characters/'+winner.file,'the winning character appears large');
  assert.equal(loss.elements.get('bracket-champion-expression').src,'characters/win.png','the champion has a winning expression');
  assert.ok(loss.elements.get('bracket-champion-scanlines'),'the large champion portrait receives the remote effect');
}
const pointer=boot(false,0,'2026-09-24');pointer.game.startTournament(32);pointer.timers.shift()();
pointer.elements.get('board').getBoundingClientRect=()=>({left:100,top:200,width:320,height:320});
pointer.buttons[0].onmousemove({clientX:404,clientY:216});
pointer.buttons[0].onclick({clientX:404,clientY:216});
assert.equal(pointer.game.getBoard()[9],1,'pointer coordinates select the crystal position on the canvas');const flying=boot(false,0);
flying.game.startTournament(8);flying.timers.shift()();
flying.elements.get('board').getBoundingClientRect=()=>({left:100,top:200,width:320,height:320});
flying.elements.get('score-player-name').getBoundingClientRect=()=>({left:20,top:100,width:60,height:30,bottom:130});
flying.elements.get('score-opponent-name').getBoundingClientRect=()=>({left:330,top:100,width:60,height:30,bottom:130});
assert.equal(flying.play(0,1),true);
let stone=flying.elements.get('stage').children.at(-1);
assert.equal(stone.className,'stone-flight human');
assert.equal(stone.animation.keyframes.length,2,'the crystal travels in a straight line');
assert.equal(stone.animation.options.easing,'linear');
assert.match(stone.animation.keyframes[0].transform,/translate\(.*135px\)/,'green stone begins below the player name');
assert.match(stone.animation.keyframes[1].transform,/translate\(/,'green stone flies to the chosen cell');
assert.equal(flying.play(1,2),false,'another move waits until the crystal lands');
stone.activeAnimation.onfinish();
assert.equal(flying.play(1,2),true);
stone=flying.elements.get('stage').children.at(-1);
assert.equal(stone.className,'stone-flight com');
assert.match(stone.animation.keyframes[0].transform,/translate\(.*135px\)/,'red stone begins below the opponent name');
stone.activeAnimation.onfinish();
const secondSeat=boot(false,0.4,'2026-09-24');
secondSeat.game.startTournament(8);
assert.equal(secondSeat.game.getTournament().playerIndex,3,'player placement can change while roster stays fixed');
assert.equal(secondSeat.game.getTournament().firstPlayer,'opponent','the upper entrant moves first');
secondSeat.timers.shift()();
assert.equal(secondSeat.elements.get('score-opponent-name').className,'name-turn','the first-turn underline marks the opponent');
secondSeat.timers.shift()();secondSeat.timers.shift()();
assert.equal([...secondSeat.game.getBoard()].filter(value=>value===2).length,1,'opponent can place the opening stone');
assert.ok(secondSeat.elements.get('score-player-name').className.includes('name-turn'),'the next-turn underline marks the player');
const secondMove=secondSeat.game.legalMoves(secondSeat.game.getBoard())[0];
secondSeat.buttons[secondMove].onclick();
assert.equal(secondSeat.game.getBoard()[secondMove],1,'the player stays green when moving second');const redFour=boot(false,0);redFour.game.startTournament(8);redFour.timers.shift()();
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
assert.equal(cupDates['09-23'][0],'BOARD GAME CUP');
assert.equal(cupDates['09-24'][0],'HAPPINESS CUP');
assert.equal(cupDates['03-03'][0],'HINA DOLL CUP');
assert.equal(cupDates['05-05'][0],'CHILDREN CUP');
assert.equal(cupDates['07-07'][0],'STAR CUP');
assert.equal(cupDates['08-15'][0],'PEACE CUP');
assert.equal(cupDates['10-31'][0],'HALLOWEEN CUP');
assert.ok(cupDates['02-29'],'leap day has its own fixed date');

const previousTimeZone=process.env.TZ;
process.env.TZ='Asia/Tokyo';
const beforeLocalMidnight=boot(false,null,'2026-03-21T14:59:59Z');
const afterLocalMidnight=boot(false,null,'2026-03-21T15:00:00Z');
beforeLocalMidnight.game.startTournament(8);
afterLocalMidnight.game.startTournament(8);
assert.equal(beforeLocalMidnight.game.getTournament().day,'2026-03-21','local date stays on March 21 before Tokyo midnight');
assert.equal(afterLocalMidnight.game.getTournament().day,'2026-03-22','local date changes at Tokyo midnight');
assert.equal(afterLocalMidnight.elements.get('daily-cup-date').textContent,'2026-03-22');
if(previousTimeZone===undefined)delete process.env.TZ;
else process.env.TZ=previousTimeZone;

const first=boot(false,null,'2026-03-21');
const second=boot(false,null,'2026-03-21');
first.game.startTournament(32);second.game.startTournament(32);
assert.equal(JSON.stringify(first.game.getTournament().entrants.slice().sort()),JSON.stringify(second.game.getTournament().entrants.slice().sort()),'the same local calendar day has the same members');
assert.equal(first.game.getTournament().cup,'FLOWER CUP');
const originalEntrants=first.game.getTournament().entrants;
first.game.startTournament(32);
assert.equal(JSON.stringify(first.game.getTournament().entrants.slice().sort()),JSON.stringify(originalEntrants.slice().sort()),'retrying keeps the same members');
const nextDay=boot(false,null,'2026-03-22');nextDay.game.startTournament(32);
assert.notEqual(JSON.stringify(nextDay.game.getTournament().entrants),JSON.stringify(originalEntrants),'another local day has a different bracket');

const sharedStorage=new Map(),career=boot(false,0,'2026-03-21',sharedStorage);
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
assert.equal(tomorrow.elements.get('history-list').children[0].children[1].children[1].textContent,'—','daily rankings reset at local midnight');
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

const defeated=boot(false,0,'2026-09-23',new Map());
defeated.game.startTournament(8);defeated.timers.shift()();
for(let col=0;col<5;col++)defeated.play(col,2);
defeated.elements.get('back').onclick();defeated.elements.get('history-button').onclick();
assert.equal(defeated.elements.get('history-list').children[0].children[1].children[1].textContent,'BEST 8','first-round elimination stays in the top eight bracket');

const drawA=boot(false,0,'2026-09-23'),drawB=boot(false,.4,'2026-09-23');
drawA.game.startTournament(8);drawB.game.startTournament(8);
assert.equal(JSON.stringify(drawA.game.getTournament().entrants.slice().sort()),
  JSON.stringify(drawB.game.getTournament().entrants.slice().sort()),'daily tournament members stay fixed');
assert.notEqual(drawA.game.getTournament().playerIndex,drawB.game.getTournament().playerIndex,
  'player placement can change between attempts');

console.log('Gravity Four tournament checks passed');

const tapRecap=boot(false,0);tapRecap.game.startTournament(8);tapRecap.timers.shift()();
for(let col=0;col<5;col++)assert.equal(tapRecap.play(col,1),true);
assert.equal(tapRecap.elements.get('tournament-recap').hidden,true);
tapRecap.elements.get('result').onclick();
assert.equal(tapRecap.elements.get('tournament-recap').hidden,false,'tapping the line opens the tournament update');
