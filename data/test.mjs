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
assert.match(styles,/grid-template-rows: clamp\(72px, 18svh, 162px\) 52px/,'scoreboard reserves stable height');
const rosterScript=fs.readFileSync(new URL('../characters.js',import.meta.url),'utf8');
const manifest=JSON.parse(fs.readFileSync(new URL('./characters.json',import.meta.url),'utf8'));
assert.equal(manifest.characters.length,99);
assert.ok(manifest.characters.filter(character=>character.profile.talkativeness<=8).length>=10,'several characters are nearly silent');
for(const character of manifest.characters){
  assert.ok(character.profile,'profile for '+character.name);
  assert.equal(character.profile.strength>=20&&character.profile.strength<=95,true);
  assert.equal(fs.existsSync(new URL('../characters/'+character.file,import.meta.url)),true);
}

function boot(coarse=false,random=null){
  const elements=new Map(),timers=[],drawn=[];
  function element(){
    return {children:[],className:'',hidden:false,classList:{toggle(){},remove(){}},
      append(...children){this.children.push(...children)},replaceChildren(...children){this.children=children},
      addEventListener(name,callback){this['on'+name]=callback},setAttribute(){},
      getContext(){return {fillRect(...rect){drawn.push([this.color,...rect])},clearRect(){},setTransform(){},set fillStyle(value){this.color=value},set imageSmoothingEnabled(value){}}}};
  }
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},
    createElement:element,querySelectorAll(){return []}};
  const context={document,window:{matchMedia(){return {matches:coarse}}},
    setTimeout(callback,delay){callback.delay=delay;timers.push(callback)},console};
  if(random!==null)context.Math=Object.assign(Object.create(Math),{random:()=>random});
  vm.runInNewContext(rosterScript,context,{filename:'characters.js'});
  vm.runInNewContext(gameScript.replace('    window.GravityFour={legalMoves', '    window.__testPlay=play; window.GravityFour={legalMoves'),context,{filename:'game.js'});
  return {game:context.window.GravityFour,play:context.window.__testPlay,elements,timers,drawn,buttons:elements.get('board').children};
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
  const state=game.getTournament();
  assert.equal(state.size,size);
  assert.equal(state.ranks.length,size-1);
  for(const rank of Object.keys(expected))assert.equal(state.ranks.filter(value=>value===rank).length,expected[rank]);
  assert.equal(desktop.elements.get('score-opponent-name').textContent,state.opponent,'large score names the opponent');
  assert.equal(desktop.elements.get('opponent-face').src,'characters/'+state.opponent+'.png','face appears above score name');
}
game.startTournament(8);
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
assert.equal(desktop.elements.get('thinking').hidden,true,'thinking indicator clears');
desktop.elements.get('back').onclick();
assert.equal(desktop.elements.get('menu').hidden,false,'menu opens');

const mobile=boot(true);
mobile.game.startTournament(8);
mobile.buttons[0].onclick();
assert.equal([...mobile.game.getBoard()].filter(Boolean).length,0,'tap selects without placing');
assert.equal(mobile.elements.get('place').disabled,false,'PLACE becomes available');
mobile.elements.get('place').onclick();
assert.equal(mobile.game.getBoard()[0],1,'PLACE confirms selected point');
mobile.timers.shift()();
assert.equal([...mobile.game.getBoard()].filter(Boolean).length,2,'COM replies after mobile placement');
const deliberate=boot(false,0);
deliberate.game.startTournament(8);
deliberate.buttons[0].onclick();
assert.ok(deliberate.timers[0].delay>=1400,'some opponents pause to think');
deliberate.game.settings.talkativeness=0;
deliberate.timers.shift()();
assert.equal(deliberate.elements.get('speech').hidden,true,'quiet character can stay silent');
const run=boot();
run.game.startTournament(8);
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
  assert.equal(run.elements.get('victory-effect').className.includes(round===2?'champion':'round-clear'),true);
  assert.equal(run.elements.get('victory-particles').children.length,round===2?72:36);
  assert.equal(run.timers[0].delay,round===2?3200:2100,'champion effect lasts longer');
  run.timers.shift()();
  assert.equal(run.elements.get('tournament-recap').hidden,false,'recap appears after match');
  const canvas=run.elements.get('bracket-rounds').children[0];
  assert.ok(canvas.className.includes('single-sided'),'8 player bracket progresses left to right');
  assert.ok(canvas.children.some(child=>child.className.includes('bracket-line')),'bracket has connector lines');
  run.elements.get('next-match').onclick();
  assert.equal(run.game.getTournament().round,round===2?0:round+1);
}
for(const size of [16,32]){
  const fixture=boot();fixture.game.startTournament(size);
  for(let col=0;col<5;col++)fixture.play(col,1);
  fixture.timers.shift()();
  const canvas=fixture.elements.get('bracket-rounds').children[0];
  assert.ok(canvas.className.includes('two-sided'),size+' player bracket joins from both sides');
  assert.ok(canvas.children.filter(child=>child.className.includes('bracket-line')).length>20,'connector lines are visible');
}
const redFour=boot();redFour.game.startTournament(8);
for(let col=0;col<4;col++)redFour.play(col,2);
assert.equal(redFour.elements.get('com-score').textContent,1);
assert.ok(redFour.drawn.some(([color,, ,width,height])=>color==='#ff5a76'&&width===15&&height===1),'opponent four uses red outline');
console.log('Gravity Four tournament checks passed');
