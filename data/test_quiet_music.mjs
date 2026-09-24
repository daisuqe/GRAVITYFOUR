import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const audioSource=fs.readFileSync(new URL('../audio.js',import.meta.url),'utf8');
const gameSource=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');
const help=fs.readFileSync(new URL('../help.html',import.meta.url),'utf8');
assert.match(gameSource,/audio\.stop\(\);audio\.setMusic\('bracket'\)/,
  'the menu and its quiet subviews use bracket music');
assert.match(help,/src="audio\.js"[\s\S]*setMusic\('bracket'\)/,
  'the separate help page starts the same music');

const listeners=new Map(),timers=new Map(),oscillators=[];
let nextTimer=0;
const parameter=()=>({value:0,setValueAtTime(value){this.value=value},
  exponentialRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}});
class AudioContext {
  constructor(){this.state='suspended';this.currentTime=0;this.destination={}}
  resume(){return Promise.reject(new Error('Waiting for user gesture'))}
  createGain(){return {gain:parameter(),connect(){},disconnect(){}}}
  createOscillator(){const oscillator={frequency:parameter(),connect(){},start(){},stop(){}};
    oscillators.push(oscillator);return oscillator}
}
const window={AudioContext,addEventListener(name,callback){listeners.set(name,callback)}};
vm.runInNewContext(audioSource,{window,setInterval(callback){const id=++nextTimer;timers.set(id,callback);return id},
  clearInterval(id){timers.delete(id)}},{filename:'audio.js'});
const audio=window.GravityFourAudio;
audio.setMusic('bracket');
await Promise.resolve();
assert.equal(timers.size,0,'suspended audio must not queue a sequencer');
assert.equal(oscillators.length,0,'suspended audio must not queue notes');
AudioContext.prototype.resume=function(){this.state='running';return Promise.resolve()};
listeners.get('pointerdown')();
await Promise.resolve();
assert.equal(timers.size,1,'first user gesture starts the waiting track');
assert.equal(oscillators[0].frequency.value,220,'the waiting track is bracket music');
audio.setMusic('off');
assert.equal(timers.size,0,'music stops when a match intro begins');
console.log('Quiet-screen music and gesture unlock passed');
