import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root),'utf8');
const page=read('index.html');
const styles=read('style.css');
assert.doesNotMatch(page,/SELECT TOURNAMENT|8 PLAYERS|16 PLAYERS|32 PLAYERS|FIRST STEPS/);
assert.match(page,/id="random-match"/);
assert.match(page,/id="editor-button"/);
const elements=new Map(),timers=[],storage=new Map();
function element(){
  return {children:[],hidden:false,className:'',classList:{toggle(){},remove(){}},
    append(...children){this.children.push(...children)},replaceChildren(...children){this.children=children},
    addEventListener(name,callback){this['on'+name]=callback},setAttribute(name,value){this[name]=value},
    getContext(){const canvas=this;return {clearRect(){},fillRect(){},setTransform(){},
      createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)}},putImageData(image){canvas.image=image},
      set fillStyle(value){},set imageSmoothingEnabled(value){}}}};
}
const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},
  createElement:element,querySelectorAll(){return []}};
const window={matchMedia(){return {matches:false}},localStorage:{
  getItem(key){return storage.get(key)||null},setItem(key,value){storage.set(key,value)}}};
const context={document,window,Math:Object.assign(Object.create(Math),{random:()=>0}),setTimeout(callback){timers.push(callback)},console};
for(const name of ['characters.js','player.js','daily-cups.js'])
  vm.runInNewContext(read(name),context,{filename:name});
vm.runInNewContext(read('game.js').replace('    window.GravityFour={legalMoves',
  '    window.__testPlay=play; window.__testAppendBracketFace=appendBracketFace; window.__testCenterBracket=centerBracket; window.GravityFour={legalMoves'),context,{filename:'game.js'});
const get=id=>elements.get(id);
const bracketViewport=document.getElementById('bracket-rounds');bracketViewport.clientWidth=900;
bracketViewport.children=[{offsetWidth:1336}];window.__testCenterBracket();
assert.equal(bracketViewport.scrollLeft,218,'wide bracket opens at its horizontal center');
bracketViewport.children=[{offsetWidth:579}];window.__testCenterBracket();
assert.equal(bracketViewport.scrollLeft,0,'narrow bracket needs no horizontal scroll');
assert.match(styles,/\.bracket-canvas \{ margin-inline: auto; \}/,'a narrow bracket is centered in its panel');
assert.match(styles,/\.recap-card \{ max-height: calc\(100svh - 20px\)/,'recap fits the viewport height');
assert.equal(get('player-hair').image.data.length,16*16*4);
function paintedColor(part){const pixels=get('player-'+part).image.data;
  for(let offset=0;offset<pixels.length;offset+=4)if(pixels[offset+3])
    return '#'+[...pixels.slice(offset,offset+3)].map(value=>value.toString(16).padStart(2,'0')).join('').toUpperCase();
  throw new Error('No painted pixels in '+part);
}
assert.equal(paintedColor('hair'),'#000000');
assert.equal(paintedColor('cloth'),'#009B0C');
assert.equal(get('player-expression').hidden,true);
assert.equal(get('editor-view').hidden,true);
get('editor-button').onclick();
assert.equal(get('editor-view').hidden,false);
assert.equal(get('menu').hidden,true);
assert.match(page,/id="editor-name"[^>]*maxlength="4"/,'editor offers a four-letter name');
get('editor-name').value='a9bcde';get('editor-name').oninput();
assert.equal(get('editor-name').value,'ABCD','name keeps only four uppercase letters');
assert.equal(get('score-player-name').textContent,'ABCD','score uses the chosen name');
assert.equal(JSON.parse(storage.get('gravityfour-player-v1')).name,'ABCD','name is saved');
get('editor-name').value='';get('editor-name').oninput();get('editor-name').onblur();
assert.equal(get('editor-name').value,'ABCD','an empty name restores the last valid name');
assert.doesNotMatch(page,/<select\b/,'the editor uses visual buttons instead of dropdowns');
assert.doesNotMatch(page,/id="editor-(?:tint|scanlines)"/,'the editor preview has no remote effect');
assert.equal(get('editor-hair-options').children.length,11);
assert.equal(get('editor-eyes-options').children.length,15);
assert.equal(get('editor-mouth-options').children.length,9);
assert.equal(get('editor-hair-options').children[0].children[0].image.data.length,16*16*4,'hair choices are painted as images');
assert.equal(get('editor-eyes-options').children[0].children[0].src,window.GravityFourPlayer.files.eyes.eye1);
for(const [id,value,part] of [
  ['hair','hair1','hair'],['eyes','eye1','eyes'],['mouth','mouth2','mouth'],
  ['hair-color',window.GravityFourPlayer.palettes.hair[0],'hair'],
  ['cloth-color',window.GravityFourPlayer.palettes.cloth[0],'cloth'],
  ['skin-color',window.GravityFourPlayer.palettes.skin[0],'skin']]){
  const button=get('editor-'+id+'-options').children.find(item=>item.value===value);
  assert.ok(button,'option button exists');button.onclick();
  assert.equal(button['aria-pressed'],'true');
  if(id.endsWith('-color'))assert.equal(button.style,'background:'+value);
  if(['skin','hair','cloth'].includes(part))
    assert.deepEqual(get('player-'+part).image.data,get('editor-'+part).image.data);
  else assert.equal(get('player-'+part).src,get('editor-'+part).src);
  if(id.endsWith('-color'))assert.equal(paintedColor(part),value);
}
assert.equal(JSON.parse(storage.get('gravityfour-player-v1')).hair,'hair1');
const playerCard=element();window.__testAppendBracketFace(playerCard,null);
assert.equal(playerCard.children[0].children.length,5,'bracket face combines the chosen body, eyes, and mouth');
assert.equal(playerCard.children[1].textContent,'ABCD','bracket uses the chosen player name');
assert.match(styles,/\.bracket-entry\.you \{[^}]*background:/,'player cards have a distinct bright background');
assert.match(styles,/\.bracket-entry:not\(\.you\):not\(\.pending\) \{[^}]*background: #091610/,'opponent cards are dark');
get('editor-back').onclick();
assert.equal(get('menu').hidden,false);
get('random-match').onclick();timers.shift()();
assert.equal(window.GravityFour.getTournament().size,2);
assert.equal(get('match-progress').textContent,'RANDOM MATCH');
for(let col=0;col<5;col++)window.__testPlay(col,1);
assert.equal(get('result').textContent,'ABCD WIN','match result uses the chosen name');
assert.equal(get('player-expression').src,window.GravityFourPlayer.expressions.win);
assert.equal(get('victory-player-expression').src,window.GravityFourPlayer.expressions.win);
assert.equal(get('player-eyes').hidden,true);
assert.equal(get('player-mouth').hidden,true);
assert.equal(get('next-match').textContent,'NEW MATCH');
assert.equal(storage.has('gravityfour-history-v1'),false,'random match does not alter records');
timers.shift()();
get('next-match').onclick();timers.shift()();
assert.equal(get('player-expression').hidden,true,'new match restores normal face');
for(let col=0;col<5;col++)window.__testPlay(col,2);
assert.equal(get('player-expression').src,window.GravityFourPlayer.expressions.lose);
assert.equal(get('player-tear').hidden,false);
assert.equal(get('next-match').textContent,'NEW MATCH');
console.log('Character editor, random match, and player reactions passed');
