(() => {
  'use strict';
  let context=null, musicBus=null, musicTimer=null,voiceSource=null,voiceBus=null,pendingMusicStart=null;
  let musicLevel=0;
  const voiceCache=new Map();
  const voiceStyles=['man','boy','woman','girl'];
  const voicePitch={man:155,boy:245,woman:290,girl:355};
  function unlock(){
    if(context){if(context.state==='suspended')context.resume().then(()=>pendingMusicStart?.()).catch(()=>{});return context;}
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)return null;
    try{context=new AudioContext();if(context.state==='suspended')context.resume().then(()=>pendingMusicStart?.()).catch(()=>{});return context;}
    catch{return null;}
  }
  function stopVoice(){if(voiceSource){try{voiceSource.stop();}catch{}voiceSource=null;}}
  function stopMusic(){
    pendingMusicStart=null;
    if(musicTimer!==null){clearInterval(musicTimer);musicTimer=null;}
    if(musicBus){musicBus.disconnect();musicBus=null;}
  }
  function pulse(frequency,duration,type,volume){
    if(!context||!musicBus)return;
    const now=context.currentTime,osc=context.createOscillator(),gain=context.createGain();
    osc.type=type;osc.frequency.setValueAtTime(frequency,now);
    gain.gain.setValueAtTime(.001,now);
    gain.gain.exponentialRampToValueAtTime(volume,now+.025);
    gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    osc.connect(gain);gain.connect(musicBus);osc.start(now);osc.stop(now+duration+.01);
  }
  const musicTracks={
    'battle-champion':{
      notes:[110,110,130.8,98,110,146.8,110,98,110,123.5,130.8,98,146.8,130.8,110,98],
      interval:480,duration:.35,level:.54,volume:.24,wave:'triangle',harmony:1.5
    },
    'battle-regular':{
      notes:[146.8,164.8,196,174.6,164.8,220,196,174.6,146.8,196,220,174.6,164.8,196,146.8,130.8],
      interval:420,duration:.30,level:.52,volume:.23,wave:'triangle',harmony:1.5
    },
    'battle-beginner':{
      notes:[196,246.9,261.6,293.7,261.6,329.6,293.7,246.9,220,261.6,293.7,329.6,349.2,329.6,293.7,261.6],
      interval:360,duration:.26,level:.50,volume:.22,wave:'sine',harmony:1.25
    },
    bracket:{
      notes:[220,277.2,329.6,440,329.6,277.2,246.9,329.6],
      interval:245,duration:.22,level:.40,volume:.16,wave:'sine',harmony:1.5
    },
    victory:{
      notes:[392,523.25,659.25,783.99,659.25,783.99,1046.5,783.99,
        440,587.33,698.46,880,698.46,880,1174.66,880],
      interval:210,duration:.19,level:.48,volume:.17,wave:'triangle',harmony:1.5,
      festive:true
    }
  };
  function setMusic(mode){
    stopMusic();
    const track=musicTracks[mode];
    if(!track||!unlock())return;
    musicLevel=track.level*3;
    musicBus=context.createGain();musicBus.gain.value=musicLevel;musicBus.connect(context.destination);
    let step=0;
    const play=()=>{
      const note=track.notes[step%track.notes.length];
      pulse(note,track.duration,track.wave,track.volume);
      if(step%4===2)pulse(note*track.harmony,track.duration*.55,'sine',track.volume*.38);
      if(track.festive&&step%4===0)pulse(note/2,track.duration*1.6,'sine',track.volume*.42);
      step++;
    };
    const bus=musicBus;
    const start=()=>{
      if(musicBus!==bus||musicTimer!==null||context.state!=='running')return;
      pendingMusicStart=null;
      play();musicTimer=setInterval(play,track.interval);
    };
    if(context.state==='running')start();
    else pendingMusicStart=start;
  }
  function speak(text,kind='character',voiceId=0,hair=''){
    const synth=window.VoiceSynth;
    if(!synth||!unlock())return 0;
    const spokenText=text.replace(/HELLO[～~]?/gi,'ハロー').replace(/…+/g,'、');
    const mora=synth.moraList(spokenText);
    if(!mora.length)return 0;
    stopVoice();
    const id=Math.abs(Number(voiceId)||0);
    const hairName=String(hair).toLowerCase();
    const highHair=/^hair(?:1|2|10|11)w?$/.test(hairName);
    const preset=kind==='announcer'?'girl':highHair?'girl':hairName.endsWith('w')?'woman':hairName.endsWith('m')?'man':voiceStyles[id%voiceStyles.length];
    const params=synth.params(preset);
    params.f0=kind==='announcer'?355:voicePitch[preset]+(id%5-2)*8;
    if(highHair)params.f0=410+(id%5)*12;
    if(highHair)params.fs=1.3;
    params.mora=kind==='announcer'?170:150+(id*7%5-2)*3;
    params.speed=1.62;
    const key=[spokenText,kind,preset,params.f0,params.fs,params.mora,params.speed].join('|');
    let buffer=voiceCache.get(key);
    if(!buffer){
      buffer=synth.render(context,mora,params);
      if(!buffer)return 0;
      voiceCache.set(key,buffer);
      if(voiceCache.size>64)voiceCache.delete(voiceCache.keys().next().value);
    }
    const start=context.currentTime+.025;
    if(!voiceBus){voiceBus=context.createGain();voiceBus.connect(context.destination);}
    voiceBus.gain.value=kind==='announcer'?.504:.392;
    voiceSource=context.createBufferSource();voiceSource.buffer=buffer;
    voiceSource.connect(voiceBus);voiceSource.start(start);
    if(musicBus){
      musicBus.gain.cancelScheduledValues(start);
      musicBus.gain.setTargetAtTime(musicLevel*.55,start,.035);
      musicBus.gain.setTargetAtTime(musicLevel,start+buffer.duration,.18);
    }
    return Math.round(buffer.duration*1000);
  }
  function stop(){stopVoice();stopMusic();}
  window.GravityFourAudio={unlock,speak,setMusic,stop};
  if(typeof window.addEventListener==='function'){
    window.addEventListener('pointerdown',unlock,{once:true});
    window.addEventListener('keydown',unlock,{once:true});
  }
})();
