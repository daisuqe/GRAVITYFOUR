import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../audio.js',import.meta.url),'utf8');
const oscillators=[],gains=[],timers=new Map();
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
}
const window={AudioContext};
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
audio.setMusic('off');
assert.equal(timers.size,0,'music stops cleanly');
console.log('Distinct finite-note music tracks passed');

const pitchFrom=id=>{const before=oscillators.length;audio.speak('ア','character',id);return oscillators[before].frequency.value};
assert.notEqual(pitchFrom(1),pitchFrom(2),'characters have distinct speaking pitches');
assert.equal(pitchFrom(1),pitchFrom(1),'each character keeps a stable pitch');
