import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../audio.js',import.meta.url),'utf8');
const oscillators=[],gains=[],voices=[],timers=new Map(),spokenTexts=[];
let nextTimer=1;
const parameter=()=>({value:0,setValueAtTime(value){this.value=value},
  exponentialRampToValueAtTime(value){this.value=value},linearRampToValueAtTime(value){this.value=value},
  cancelScheduledValues(){},setTargetAtTime(){}});
class AudioContext {
  constructor(){this.currentTime=0;this.state='running';this.destination={}}
  createGain(){const node={gain:parameter(),connect(){},disconnect(){}};gains.push(node);return node}
  createBiquadFilter(){return {frequency:parameter(),Q:parameter(),connect(){}}}
  createOscillator(){const oscillator={frequency:parameter(),connect(){},start(time){this.started=time},
    stop(time){this.stopped=time}};oscillators.push(oscillator);return oscillator}
  createBufferSource(){const source={connect(){},start(time){this.started=time},stop(){this.stopped=true}};
    voices.push(source);return source}
}
const window={AudioContext,VoiceSynth:{
  moraList(text){spokenTexts.push(text);return [...text]},params(preset){return {preset,f0:0,fs:1,mora:150}},
  render(_context,_mora,params){return {duration:.5,pitch:params.f0,formantScale:params.fs,mora:params.mora,
    preset:params.preset,speed:params.speed}}
}};
vm.runInNewContext(source,{window,setInterval(callback,delay){const id=nextTimer++;timers.set(id,{callback,delay});return id},
  clearInterval(id){timers.delete(id)}},{filename:'audio.js'});
const audio=window.GravityFourAudio;
function firstNote(mode){
  const before=oscillators.length,beforeGains=gains.length;
  audio.setMusic(mode);
  assert.equal(timers.size,1,'each music mode has one sequencer');
  const created=oscillators.slice(before);
  assert.equal(created.length,1,'music starts with a short note, not a sustained drone');
  assert.ok(created[0].stopped-created[0].started<1,'every note ends promptly');
  return created[0].frequency.value;
}
assert.equal(firstNote('battle-champion'),110);
const championNotes=[110];
const championTimer=[...timers.values()][0];
for(let step=1;step<8;step++){
  const before=oscillators.length,beforeGains=gains.length;championTimer.callback();
  championNotes.push(oscillators[before].frequency.value);
}
assert.deepEqual(championNotes,[110,110,130.8,98,110,146.8,110,98],
  'champion retains the original battle phrase');
assert.ok(oscillators.every(node=>node.stopped>node.started&&node.stopped-node.started<1),
  'overlapping notes are all finite');
const regular=firstNote('battle-regular'),beginner=firstNote('battle-beginner');
assert.ok(beginner>regular&&regular>championNotes[0],'beginner is brightest and regular lies between');
assert.equal(firstNote('bracket'),220);
const beforeVictory=oscillators.length;
audio.setMusic('victory');
const victoryNotes=oscillators.slice(beforeVictory);
assert.equal(victoryNotes[0].frequency.value,392,'champion music begins with a bright fanfare');
assert.equal(victoryNotes[1].frequency.value,196,'the fanfare adds a lower harmony');
assert.ok(victoryNotes.every(node=>node.stopped>node.started&&node.stopped-node.started<1),
  'celebration notes end cleanly');
audio.setMusic('off');
assert.equal(timers.size,0,'music stops cleanly');
console.log('Distinct finite-note music tracks passed');

const pitchFrom=(id,hair='')=>{audio.speak('ア','character',id,hair);return voices.at(-1).buffer.pitch};
assert.notEqual(pitchFrom(1),pitchFrom(2),'characters have distinct speaking pitches');
assert.equal(pitchFrom(1),pitchFrom(1),'each character keeps a stable pitch');
assert.ok(voices.at(-2).stopped!==undefined,'a new line stops the previous voice');
const pitchRange=Array.from({length:19},(_,index)=>pitchFrom(index+1));
assert.ok(Math.max(...pitchRange)-Math.min(...pitchRange)>=150,'character voices span a clearly wider pitch range');
for(const hair of ['hair1','hair2','hair10','hair11'])assert.ok(pitchFrom(1,hair)>Math.max(...pitchRange),'selected hair always uses a high voice: '+hair);
assert.equal(pitchFrom(1,'hair11'),pitchFrom(1,'hair11'),'the high hair voice stays at its assigned pitch');
assert.ok(pitchFrom(1,'hair3w')>pitchFrom(1,'hair8m'),'gendered hair styles select female and male voice ranges');
audio.speak('ヨロシク','character',1);
const regularPace=voices.at(-1).buffer.mora;
assert.ok(regularPace>=144&&regularPace<=156,'ordinary lines use the source engine natural mora length');
assert.equal(voices.at(-1).buffer.speed,1.62,'dialogue is ten percent slower than before');
audio.speak('HELLO～','character',1);
assert.equal(spokenTexts.at(-1),'ハロー','the displayed HELLO greeting is pronounced in Japanese');
assert.equal(gains.at(-1).gain.value,.392,'character dialogue volume is reduced by another thirty percent');
audio.speak('ヨロシク','character',2);
assert.notEqual(voices.at(-1).buffer.mora,regularPace,'characters have distinct stable speaking rates');
for(const [id,preset] of [[4,'man'],[1,'boy'],[2,'woman'],[3,'girl']]){
  audio.speak('テスト','character',id);
  assert.equal(voices.at(-1).buffer.preset,preset,'character uses the '+preset+' voice');
}
audio.speak('ファーストラウンド','announcer');
assert.equal(voices.at(-1).buffer.speed,1.62,'round announcements use the same slower speed');
assert.equal(voices.at(-1).buffer.preset,'girl','MC uses the GIRL voice');
assert.equal(gains.at(-1).gain.value,.504,'MC speech volume is reduced by twenty percent');
