(() => {
  'use strict';
  let context=null, musicBus=null, musicTimer=null,voiceNodes=[],voiceBus=null,pendingMusicStart=null;
  let musicLevel=0,noiseBuffer=null;
  const formants={
    a:[760,1180,2850],i:[320,2250,3000],u:[360,1350,2650],
    e:[500,1850,2750],o:[520,900,2600],n:[270,1080,2150]
  };
  const kanaRows=[
    ['アイウエオ',''],['カキクケコ','k'],['サシスセソ','s'],
    ['タチツテト','t'],['ナニヌネノ','n'],['ハヒフヘホ','h'],
    ['マミムメモ','m'],['ヤ ユ ヨ','y'],['ラリルレロ','r'],
    ['ワ  ヲ ','w'],['ガギグゲゴ','g'],['ザジズゼゾ','z'],
    ['ダヂヅデド','d'],['バビブベボ','b'],['パピプペポ','p']
  ];
  const kana=new Map();
  for(const [row,consonant] of kanaRows)
    [...row].forEach((char,index)=>{if(char!==' ')kana.set(char,{vowel:'aiueo'[index],consonant});});
  for(const [char,vowel] of Object.entries({ァ:'a',ィ:'i',ゥ:'u',ェ:'e',ォ:'o',ャ:'a',ュ:'u',ョ:'o'}))
    kana.set(char,{vowel,small:true});
  kana.set('ン',{vowel:'n',consonant:'n'});
  kana.set('ヲ',{vowel:'o',consonant:'w'});
  function phonemes(text){
    const result=[];
    for(const char of text){
      if(char==='ー'&&result.length){result[result.length-1].duration+=.09;continue;}
      if(char==='ッ'){result.push({pause:true,duration:.055});continue;}
      if('。、！？… '.includes(char)){result.push({pause:true,duration:char==='…'?.12:.065});continue;}
      const sound=kana.get(char);
      if(!sound)continue;
      if(sound.small&&result.length&&!result[result.length-1].pause){
        result[result.length-1].vowel=sound.vowel;
      }else result.push({vowel:sound.vowel,consonant:sound.consonant||'',duration:.125});
    }
    return result;
  }
  function unlock(){
    if(context){if(context.state==='suspended')context.resume().then(()=>pendingMusicStart?.()).catch(()=>{});return context;}
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)return null;
    try{context=new AudioContext();if(context.state==='suspended')context.resume().then(()=>pendingMusicStart?.()).catch(()=>{});return context;}
    catch{return null;}
  }
  function stopNodes(nodes){for(const node of nodes){try{node.stop();}catch{}}nodes.length=0;}
  function stopVoice(){stopNodes(voiceNodes);}
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
      interval:480,duration:.35,level:.44,volume:.22,wave:'triangle',harmony:1.5
    },
    'battle-regular':{
      notes:[146.8,164.8,196,174.6,164.8,220,196,174.6,146.8,196,220,174.6,164.8,196,146.8,130.8],
      interval:420,duration:.30,level:.42,volume:.21,wave:'triangle',harmony:1.5
    },
    'battle-beginner':{
      notes:[196,246.9,261.6,293.7,261.6,329.6,293.7,246.9,220,261.6,293.7,329.6,349.2,329.6,293.7,261.6],
      interval:360,duration:.26,level:.40,volume:.20,wave:'sine',harmony:1.25
    },
    bracket:{
      notes:[220,277.2,329.6,440,329.6,277.2,246.9,329.6],
      interval:245,duration:.22,level:.30,volume:.13,wave:'sine',harmony:1.5
    }
  };
  function setMusic(mode){
    stopMusic();
    const track=musicTracks[mode];
    if(!track||!unlock())return;
    musicLevel=track.level;
    musicBus=context.createGain();musicBus.gain.value=musicLevel;musicBus.connect(context.destination);
    let step=0;
    const play=()=>{
      const note=track.notes[step%track.notes.length];
      pulse(note,track.duration,track.wave,track.volume);
      if(step%4===2)pulse(note*track.harmony,track.duration*.55,'sine',track.volume*.38);
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
  function noise(){
    if(noiseBuffer)return noiseBuffer;
    noiseBuffer=context.createBuffer(1,Math.round(context.sampleRate*.06),context.sampleRate);
    const samples=noiseBuffer.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
    return noiseBuffer;
  }
  function speak(text,kind='character',voiceId=0){
    const sounds=phonemes(text);
    const duration=sounds.reduce((total,sound)=>total+sound.duration,0);
    if(!unlock()||!sounds.length)return Math.round(duration*1000);
    stopVoice();
    const start=context.currentTime+.025;
    if(!voiceBus){voiceBus=context.createGain();voiceBus.connect(context.destination);}
    voiceBus.gain.value=kind==='announcer'?.43:.32;
    let cursor=start;
    const pitch=kind==='announcer'?104:125+(voiceId%7)*7;
    for(const sound of sounds){
      if(sound.pause){cursor+=sound.duration;continue;}
      const end=cursor+sound.duration,osc=context.createOscillator(),env=context.createGain();
      osc.type='sawtooth';osc.frequency.setValueAtTime(pitch,cursor);
      osc.frequency.linearRampToValueAtTime(pitch*(kind==='announcer'?.94:1.04),end);
      env.gain.setValueAtTime(.001,cursor);
      env.gain.linearRampToValueAtTime(.2,cursor+.025);
      env.gain.setValueAtTime(.18,Math.max(cursor+.026,end-.035));
      env.gain.linearRampToValueAtTime(.001,end);
      env.connect(voiceBus);
      formants[sound.vowel].forEach((frequency,index)=>{
        const filter=context.createBiquadFilter(),weight=context.createGain();
        filter.type='bandpass';filter.frequency.value=frequency;
        filter.Q.value=[3,5,7][index];weight.gain.value=[.95,.6,.38][index];
        osc.connect(filter);filter.connect(weight);weight.connect(env);
      });
      osc.start(cursor);osc.stop(end+.01);voiceNodes.push(osc);
      if(/[skthfz]/.test(sound.consonant)){
        const hiss=context.createBufferSource(),high=context.createBiquadFilter(),volume=context.createGain();
        hiss.buffer=noise();high.type='highpass';high.frequency.value=1500;
        volume.gain.value=sound.consonant==='s'||sound.consonant==='z'?.045:.018;
        hiss.connect(high);high.connect(volume);volume.connect(voiceBus);
        hiss.start(cursor);hiss.stop(cursor+.045);voiceNodes.push(hiss);
      }
      cursor=end;
    }
    if(musicBus){
      musicBus.gain.cancelScheduledValues(start);
      musicBus.gain.setTargetAtTime(musicLevel*.55,start,.035);
      musicBus.gain.setTargetAtTime(musicLevel,start+duration,.18);
    }
    return Math.round(duration*1000);
  }
  function stop(){stopVoice();stopMusic();}
  window.GravityFourAudio={unlock,speak,setMusic,stop};
  if(typeof window.addEventListener==='function'){
    window.addEventListener('pointerdown',unlock,{once:true});
    window.addEventListener('keydown',unlock,{once:true});
  }
})();
