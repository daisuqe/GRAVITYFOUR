import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'game script exists');

function boot(coarse=false){
  const elements=new Map(),timers=[];
  function element(){
    return {children:[],className:'',classList:{toggle(){},remove(){}},
      append(child){this.children.push(child)},replaceChildren(){this.children=[]},
      addEventListener(name,callback){this['on'+name]=callback},setAttribute(){},
      getContext(){return {fillRect(){},setTransform(){},set fillStyle(value){},set imageSmoothingEnabled(value){}}}};
  }
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},
    createElement:element,querySelectorAll(){return []}};
  const context={document,window:{matchMedia(){return {matches:coarse}}},
    setTimeout(callback){timers.push(callback)},console};
  vm.runInNewContext(script,context,{filename:'index.html'});
  return {game:context.window.GravityFour,elements,timers,buttons:elements.get('board').children};
}

const desktop=boot();
const {game,buttons,timers}=desktop;
const empty=new Uint8Array(100);
assert.equal(game.legalMoves(empty).length,36,'opening has 36 legal cells');
assert.equal(game.legalMoves(empty).includes(11),false,'interior initially unavailable');
empty[1]=1;
assert.equal(game.legalMoves(empty).includes(11),true,'stone at top supports cell below');

const four=new Uint8Array(100);
for(const row of [0,2,4])for(let col=0;col<4;col++)four[row*10+col]=1;
assert.equal(game.wins(four,1).four.length,3,'three fours are counted');
assert.equal(game.wins(four,1).won,true,'three fours win');
const five=new Uint8Array(100);
for(let col=0;col<5;col++)five[col]=2;
assert.equal(game.wins(five,2).five.length,1,'five is detected');
assert.equal(game.wins(five,2).four.length,0,'five is not counted as a four');

buttons[0].onclick();
assert.equal(game.getBoard()[0],1,'desktop click places a stone');
timers.shift()();
assert.equal([...game.getBoard()].filter(Boolean).length,2,'COM replies');
game.settings.depth=3;
const next=buttons.find((button,index)=>!game.getBoard()[index]&&!button.disabled);
next.onclick();
const start=performance.now();
timers.shift()();
console.log(`Expert response: ${Math.round(performance.now()-start)} ms`);
assert.equal([...game.getBoard()].filter(Boolean).length,4,'expert COM replies');

const mobile=boot(true);
mobile.buttons[0].onclick();
assert.equal([...mobile.game.getBoard()].filter(Boolean).length,0,'tap selects without placing');
assert.equal(mobile.elements.get('place').disabled,false,'PLACE becomes available');
mobile.elements.get('place').onclick();
assert.equal(mobile.game.getBoard()[0],1,'PLACE confirms selected point');
mobile.timers.shift()();
assert.equal([...mobile.game.getBoard()].filter(Boolean).length,2,'COM replies after mobile placement');
console.log('Gravity Four checks passed');
