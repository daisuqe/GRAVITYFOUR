import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const window={};
vm.runInNewContext(fs.readFileSync(new URL('../voice.js',import.meta.url),'utf8'),{window});
const synth=window.VoiceSynth;
const context={sampleRate:16000,createBuffer(_channels,length,sampleRate){
  const samples=new Float32Array(length);
  return {duration:length/sampleRate,getChannelData(){return samples}};
}};
const phrase=synth.moraList('ファーストラウンド');
const natural=synth.params('man');natural.mora=170;natural.speed=1;
const fast={...natural,speed:1.62};
const normalDuration=synth.render(context,phrase,natural).duration;
const fastBuffer=synth.render(context,phrase,fast);
assert.ok(Math.abs(normalDuration/fastBuffer.duration-1.62)<.01,'full speech timeline is 1.62 times faster');
assert.ok(fastBuffer.duration<1.4,'first-round announcement is under 1.4 seconds');
assert.ok(fastBuffer.getChannelData(0).some(sample=>Math.abs(sample)>.01),'fast speech has an audible waveform');
console.log('Formant speech timing passed');
