  (() => {
    'use strict';
    const N=9, ROWS=9, HUMAN=1, COM=2, EMPTY=0;
    const boardEl=document.getElementById('board');
    const art=document.getElementById('board-art');
    const ctx=art.getContext('2d');
    ctx.imageSmoothingEnabled=false;
    ctx.setTransform(2,0,0,2,0,0);
    const comFlash=document.createElement('canvas');
    comFlash.width=32;comFlash.height=32;comFlash.className='com-move-flash';
    comFlash.setAttribute('aria-hidden','true');
    const flashCtx=comFlash.getContext('2d');
    flashCtx.imageSmoothingEnabled=false;
    flashCtx.setTransform(2,0,0,2,0,0);
    let comFlashAnimation=null,flightAnimation=null,flightElement=null,flightIndex=-1;
    const requiresPlace=typeof window.matchMedia==='function'&&window.matchMedia('(hover: none), (pointer: coarse)').matches;
    const cells=[];const directions=[[0,1],[1,0],[1,1],[1,-1]];
    const windows=[];
    for(let r=0;r<ROWS;r++)for(let c=0;c<N;c++)for(const [dr,dc] of directions){
      for(const length of [4,5]){
        const endR=r+dr*(length-1),endC=c+dc*(length-1);
        if(endR<0||endR>=ROWS||endC<0||endC>=N)continue;
        const indices=Array.from({length},(_,k)=>(r+dr*k)*N+c+dc*k);
        windows.push({indices,length,dr,dc,r,c});
      }
    }
    let board=new Uint8Array(N*ROWS),turn=HUMAN,ended=false,winningCells=new Set(),thinking=false,hoverIndex=-1,selectedIndex=-1,lastComMove=-1,endedByScore=false;
    const roster=window.GravityFourRoster||[];
    const player=window.GravityFourPlayer;
    const playerStorageKey='gravityfour-player-v1';
    function readPlayerSelection(){
      if(!player)return null;
      let saved={};
      try{saved=JSON.parse(window.localStorage.getItem(playerStorageKey))||{};}catch{}
      const selected={...player.defaults,...saved};
      for(const key of ['hair','eyes','mouth'])
        if(!player.options[key].includes(selected[key]))selected[key]=player.defaults[key];
      for(const key of ['hair','cloth','skin'])
        if(!player.palettes[key].includes(selected[key+'Color']))selected[key+'Color']=player.defaults[key+'Color'];
      selected.name=/^[A-Z]{1,4}$/.test(saved.name)?saved.name:'YOU';
      return selected;
    }
    const playerSelection=readPlayerSelection();
    const playerName=()=>playerSelection?.name||'YOU';
    const editorButtons=[];
    let playerExpression='normal';
    const cups=window.GravityFourCups||{};
    const localDate=()=>{
      const now=new Date();
      return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
    };
    const dayDetails=day=>cups[day.slice(5)]||['CIRCUIT CUP','Daily circuit'];
    function hash32(value){
      let hash=2166136261;
      for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}
      return hash>>>0;
    }
    function seededRandom(value){
      let seed=hash32(value);
      return ()=>{
        seed+=0x6D2B79F5;
        let t=seed;
        t=Math.imul(t^(t>>>15),t|1);
        t^=t+Math.imul(t^(t>>>7),t|61);
        return ((t^(t>>>14))>>>0)/4294967296;
      };
    }
    const storageKey='gravityfour-history-v1';
    function readHistory(){
      try{
        const saved=JSON.parse(window.localStorage.getItem(storageKey));
        if(saved&&typeof saved==='object')return {days:saved.days||{},best:saved.best||{},wins:saved.wins||{}};
      }catch{}
      return {days:{},best:{},wins:{}};
    }
    const records=readHistory();
    function saveHistory(){try{window.localStorage.setItem(storageKey,JSON.stringify(records));}catch{}}
    const tournamentTypes=[
      {key:'beginner',label:'BEGINNER',size:8,levels:[4,3,0,0,0]},
      {key:'regular',label:'REGULAR',size:16,levels:[4,4,4,3,0]},
      {key:'champion',label:'CHAMPION',size:32,levels:[0,8,8,8,7]}
    ];
    const settings={depth:2,mistake:10,trick:30,attack:50,defense:50,edgeExplore:50,ride:50,unusual:50,center:50,consistency:80};
    const watchSettings={...settings,depth:2,mistake:12,trick:35};
    let tournament=null,opponent=null,watchLeft=null,outcome=null,matchToken=0,pendingWinners=null,introActive=false,watchMode=false,watchLeftHasSpoken=false;
    const audio=window.GravityFourAudio||{unlock(){},speak(){return 0},setMusic(){},stop(){}};
    function drawScanlines(mask,id){
      const canvas=byId(id),context=canvas.getContext('2d');
      const tintContext=byId(id.replace('scanlines','tint')).getContext('2d');
      const pixels=context.createImageData(64,64),bytes=Uint8Array.from({length:32},(_,i)=>parseInt(mask.slice(i*2,i*2+2),16));
      const tint=tintContext.createImageData(64,64);
      for(let y=0;y<64;y++)for(let x=0;x<64;x++){
        const bit=Math.floor(y/4)*16+Math.floor(x/4);
        if(!(bytes[bit>>3]&(128>>(bit&7))))continue;
        const offset=(y*64+x)*4,bright=y%2===0;
        tint.data[offset]=46;
        tint.data[offset+1]=225;
        tint.data[offset+2]=125;
        tint.data[offset+3]=39;
        pixels.data[offset]=bright?170:0;
        pixels.data[offset+1]=bright?255:8;
        pixels.data[offset+2]=bright?208:9;
        pixels.data[offset+3]=bright?79:86;
      }
      tintContext.putImageData(tint,0,0);
      context.putImageData(pixels,0,0);
    }
    function drawTintedPart(canvas,mask,color){
      const context=canvas.getContext('2d'),image=context.createImageData(16,16);
      const bytes=Uint8Array.from({length:32},(_,i)=>parseInt(mask.slice(i*2,i*2+2),16));
      const rgb=[1,3,5].map(start=>parseInt(color.slice(start,start+2),16));
      for(let pixel=0;pixel<256;pixel++){
        if(!(bytes[pixel>>3]&(128>>(pixel&7))))continue;
        const offset=pixel*4;
        image.data[offset]=rgb[0];image.data[offset+1]=rgb[1];
        image.data[offset+2]=rgb[2];image.data[offset+3]=255;
      }
      context.putImageData(image,0,0);
    }
    function paintPlayer(prefix,expression){
      for(const key of ['skin','hair','cloth']){
        const mask=key==='hair'?player.layerMasks.hair[playerSelection.hair]:player.layerMasks[key];
        drawTintedPart(byId(prefix+'-'+key),mask,playerSelection[key+'Color']);
      }
      for(const key of ['eyes','mouth']){
        const image=byId(prefix+'-'+key);
        image.src=player.files[key][playerSelection[key]];
        image.hidden=expression!=='normal';
      }
      const reaction=byId(prefix+'-expression');
      reaction.hidden=expression==='normal';
      if(expression!=='normal')reaction.src=player.expressions[expression];
      byId(prefix+'-tear').hidden=expression!=='lose';
      const mask=expression==='normal'
        ?player.masks[playerSelection.hair].normal[playerSelection.mouth]
        :player.masks[playerSelection.hair][expression];
      if(prefix!=='editor')drawScanlines(mask,prefix+'-scanlines');
    }
    function renderPlayer(){
      if(!player)return;
      byId('score-player-name').textContent=playerSelection.name;
      byId('editor-name').value=playerSelection.name;
      paintPlayer('player',playerExpression);
      paintPlayer('victory-player',playerExpression);
      paintPlayer('editor','normal');
      for(const {button,id,key,value,preview} of editorButtons){
        button.setAttribute('aria-pressed',String(playerSelection[key]===value));
        button.className='editor-option'+(id.includes('color')?' color-option':'')+(playerSelection[key]===value?' selected':'');
        if(id==='hair')drawTintedPart(preview,player.layerMasks.hair[value],playerSelection.hairColor);
      }
    }
    function setPlayerExpression(expression){
      if(!player)return;
      playerExpression=expression;
      renderPlayer();
    }
    function initPlayerEditor(){
      if(!player)return;
      const nameInput=byId('editor-name');
      nameInput.addEventListener('input',()=>{
        const name=String(nameInput.value).toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);
        nameInput.value=name;
        if(!name)return;
        playerSelection.name=name;
        try{window.localStorage.setItem(playerStorageKey,JSON.stringify(playerSelection));}catch{}
        byId('score-player-name').textContent=name;
      });
      nameInput.addEventListener('blur',()=>{if(!nameInput.value)nameInput.value=playerSelection.name;});
      for(const [id,key,values] of [
        ['hair','hair',player.options.hair],['eyes','eyes',player.options.eyes],
        ['mouth','mouth',player.options.mouth],
        ['hair-color','hairColor',player.palettes.hair],
        ['cloth-color','clothColor',player.palettes.cloth],
        ['skin-color','skinColor',player.palettes.skin]]){
        const choices=byId('editor-'+id+'-options');
        values.forEach((value,index)=>{
          const button=document.createElement('button');button.type='button';button.value=value;
          button.setAttribute('aria-label',id.includes('color')?id.toUpperCase()+' '+(index+1)+' '+value:value.toUpperCase());
          let preview=null;
          if(id.includes('color')){
            button.className='editor-option color-option';
            button.setAttribute('style','background:'+value);
          }else if(id==='hair'){
            preview=document.createElement('canvas');preview.width=16;preview.height=16;
            button.append(preview);
          }else{
            preview=document.createElement('img');preview.src=player.files[id][value];preview.alt='';
            button.append(preview);
          }
          button.addEventListener('click',()=>{
            playerSelection[key]=value;
            try{window.localStorage.setItem(playerStorageKey,JSON.stringify(playerSelection));}catch{}
            renderPlayer();
          });
          choices.append(button);
          editorButtons.push({button,id,key,value,preview});
        });
      }
    }
    const shuffle=(items,seed)=>{
      const result=items.slice();
      const random=seededRandom(seed);
      for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
      return result;
    };
    function selectLevel(level,count,seed){
      const pool=roster.filter(character=>character.profile.level===level);
      if(pool.length<count)throw new Error('Character roster is incomplete: '+level);
      return shuffle(pool,seed+'|'+level).slice(0,count);
    }
    function renderDailyHeader(){
      const day=localDate(),details=dayDetails(day);
      byId('daily-cup-title').textContent=details[0];
      byId('daily-cup-date').textContent=day;
    }
    function rankText(rank){
      if(!Number.isInteger(rank)||rank<1)return '—';
      if(rank===1)return '1ST';
      if(rank===2)return '2ND';
      return 'BEST '+2**Math.ceil(Math.log2(rank));
    }
    function scoreForRank(size,rank){
      if(!Number.isInteger(rank)||rank<1||rank>size)return 0;
      const wins=Math.max(0,Math.log2(size)-Math.ceil(Math.log2(rank)));
      return 2**wins-1;
    }
    function renderHistory(){
      const day=localDate(),details=dayDetails(day);
      byId('history-cup').textContent=details[0];
      byId('history-date').textContent=day;
      const list=byId('history-list');list.replaceChildren();
      for(const type of tournamentTypes){
        const card=document.createElement('article');card.className='record-card';
        const title=document.createElement('h3');title.textContent=type.label+' TOURNAMENT';card.append(title);
        for(const [label,value] of [
          ['TODAY',rankText(records.days[day]?.[type.size])],
          ['BSET',rankText(records.best[type.size])],
          ['TOTAL 1ST',String(records.wins[type.size]||0)]
        ]){
          const row=document.createElement('div');row.className='record-row';
          const name=document.createElement('span');name.textContent=label;
          const number=document.createElement('strong');number.textContent=value;
          row.append(name,number);card.append(row);
        }
        list.append(card);
      }
    }
    function renderHistoryLog(){
      const rows=byId('history-rows');rows.replaceChildren();
      const days=Object.keys(records.days).filter(day=>/^\d{4}-\d{2}-\d{2}$/.test(day)).sort().reverse();
      let total=0;
      for(const day of days){
        const ranks=records.days[day]||{},row=document.createElement('tr');
        const score=tournamentTypes.reduce((sum,type)=>sum+scoreForRank(type.size,ranks[type.size]),0);
        total+=score;
        const date=document.createElement('td');date.className='history-day';
        const monthDay=document.createElement('strong');monthDay.textContent=day.slice(5).replace('-','/');
        const year=document.createElement('small');year.textContent=day.slice(0,4);
        date.append(monthDay,year);row.append(date);
        for(const value of [dayDetails(day)[0],...tournamentTypes.map(type=>rankText(ranks[type.size])),String(score)]){
          const cell=document.createElement('td');cell.textContent=value;row.append(cell);
        }
        rows.append(row);
      }
      byId('history-score-total').textContent=total;
      byId('history-empty').hidden=days.length>0;
    }
    function recordResult(){
      if(outcome==='draw'||tournament.random)return;
      const size=tournament.type.size,day=tournament.day;
      const rank=outcome==='win'?tournament.bracket.length/2:tournament.bracket.length/2+1;
      if(!records.days[day]||typeof records.days[day]!=='object')records.days[day]={};
      records.days[day][size]=Math.min(records.days[day][size]||Infinity,rank);
      records.best[size]=Math.min(records.best[size]||Infinity,rank);
      if(outcome==='win'&&rank===1)records.wins[size]=(Number(records.wins[size])||0)+1;
      saveHistory();
    }
    function startTournament(size,watching=false){
      watchMode=watching;watchLeft=null;pendingWinners=null;
      audio.unlock();
      const type=tournamentTypes.find(item=>item.size===size);
      if(!type)throw new Error('Unknown tournament size: '+size);
      const day=localDate(),details=dayDetails(day),seed=day+'|'+size;
      const counts=watching?[0,8,8,8,8]:type.levels;
      const bracket=counts.flatMap((count,index)=>selectLevel(index+1,count,seed));
      for(let i=bracket.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bracket[i],bracket[j]]=[bracket[j],bracket[i]];}
      if(!watching)bracket.splice(Math.floor(Math.random()*size),0,null);
      tournament={type,day,cup:details[0],round:0,matchIndex:0,bracket,history:[bracket],battles:[]};
      byId('menu').hidden=true;byId('stage').hidden=false;
      startMatch();
    }
    function startRandomMatch(){
      audio.unlock();
      const candidates=watchMode&&opponent?roster.filter(character=>character!==opponent):roster;
      const challenger=candidates[Math.floor(Math.random()*candidates.length)];
      watchLeft=watchMode?roster.filter(character=>character!==challenger)[Math.floor(Math.random()*(roster.length-1))]:null;
      const bracket=Math.random()<.5?[null,challenger]:[challenger,null];
      tournament={type:{key:'random',label:'RANDOM MATCH',size:2},random:true,
        day:localDate(),cup:'RANDOM MATCH',round:0,bracket,history:[bracket],battles:[]};
      byId('menu').hidden=true;byId('stage').hidden=false;
      startMatch();
    }
    function startWatchMode(){startTournament(32,true);}
    function startMatch(){
      matchToken++;introActive=true;
      byId('stage').className=watchMode?'stage watching':'stage';
      board=new Uint8Array(N*ROWS);turn=watchMode||tournament.bracket.indexOf(null)%2===0?HUMAN:COM;ended=false;thinking=false;
      setPlayerExpression('normal');
      winningCells=new Set();hoverIndex=-1;selectedIndex=-1;lastComMove=-1;endedByScore=false;outcome=null;
      if(!watchMode)pendingWinners=null;
      tournament.revealRounds=null;
      byId('win-orbit').hidden=true;
      byId('enemy-win-orbit').hidden=true;
      byId('match-confetti').hidden=true;
      comFlashAnimation?.cancel();comFlashAnimation=null;clearStoneFlight();
      byId('victory-effect').hidden=true;
      byId('board-frame').className='board-frame';
      byId('tournament-recap').hidden=true;byId('continue-overlay').hidden=true;byId('back').hidden=false;
      byId('thinking').hidden=true;byId('watch-thinking').hidden=true;
      if(watchMode){
        watchLeft=tournament.bracket[tournament.matchIndex*2];
        opponent=tournament.bracket[tournament.matchIndex*2+1];
      }else opponent=tournament.bracket[tournament.bracket.indexOf(null)^1];
      Object.assign(settings,opponent.profile);
      byId('score-player-name').textContent=watchMode?watchLeft.name:playerName();
      if(watchMode){
        byId('watch-left-face').src='characters/'+watchLeft.file;
        byId('watch-left-face').alt=watchLeft.name+' portrait';
        byId('watch-left-eyes').src='characters/player-parts/'+watchLeft.eyes+'.png';
        byId('watch-left-mouth').src='characters/player-parts/'+watchLeft.mouth+'.png';
        byId('watch-left-eyes').hidden=false;byId('watch-left-mouth').hidden=false;
        byId('watch-left-expression').hidden=true;byId('watch-left-tear').hidden=true;
        drawScanlines(watchLeft.normalMask,'watch-left-scanlines');
      }
      byId('score-opponent-name').textContent=opponent.name;
      byId('opponent-face').src='characters/'+opponent.file;
      byId('opponent-face').alt=opponent.name+' portrait';
      byId('opponent-eyes').src='characters/player-parts/'+opponent.eyes+'.png';
      byId('opponent-mouth').src='characters/player-parts/'+opponent.mouth+'.png';
      byId('opponent-eyes').hidden=false;
      byId('opponent-mouth').hidden=false;
      byId('opponent-expression').hidden=true;
      byId('opponent-tear').hidden=true;
      drawScanlines(opponent.normalMask,'opponent-scanlines');
      const progress=byId('match-progress');
      if(tournament.random){
        progress.textContent='RANDOM MATCH';
        progress.setAttribute('aria-label',progress.textContent);
      }else{
        const current=document.createElement('span');current.textContent=tournament.type.label+' '+tournament.bracket.length;
        const arrow=document.createElement('span');arrow.className='ui-arrow right';arrow.setAttribute('aria-hidden','true');
        const next=document.createElement('span');next.textContent=String(tournament.bracket.length/2);
        progress.replaceChildren(current,arrow,next);
        progress.setAttribute('aria-label',tournament.type.label+' '+tournament.bracket.length+' to '+(tournament.bracket.length/2));
      }
      byId('speech').hidden=true;byId('watch-speech').hidden=true;watchLeftHasSpoken=false;
      const round=tournament.round,token=matchToken;
      byId('round-intro-tournament').textContent=tournament.type.label+'\nTOURNAMENT';
      byId('round-intro-tournament').hidden=tournament.random;
      byId('round-intro-title').textContent=tournament.random?'RANDOM MATCH':['1ST','2ND','3RD','4TH','5TH'][round]+' ROUND';
      byId('round-intro-count').textContent=tournament.random?'':'('+(round+1)+'/'+Math.log2(tournament.type.size)+')';
      byId('round-intro').hidden=false;
      audio.setMusic('off');
      const duration=audio.speak(tournament.random?'ランダムマッチ':['ファーストラウンド','セカンドラウンド','サードラウンド','フォースラウンド','フィフスラウンド'][round],'announcer');
      render();
      setTimeout(()=>{
        if(token!==matchToken||!tournament)return;
        introActive=false;byId('round-intro').hidden=true;
        audio.setMusic('battle-'+(tournament.random?'regular':tournament.type.key));
        maybeSay(openingLine(),1,true);
        render();
        if(turn===COM)setTimeout(()=>{if(token===matchToken&&!ended&&turn===COM)scheduleCom();},1800*(watchMode?3:1));
        else if(watchMode)scheduleWatchMove();
      },Math.max(1700,duration+350)*(watchMode?1.5:1));
    }
    function simulatedWinner(first,second,index,round=tournament.round){
      const chance=1/(1+Math.exp((second.profile.strength-first.profile.strength)/12));
      return Math.random()<chance?first:second;
    }
    function settleRound(){
      if(outcome==='draw'||tournament.random)return;
      const previous=tournament.bracket;
      if(watchMode){
        if(!pendingWinners)pendingWinners=Array(previous.length/2).fill('TBD');
        pendingWinners[tournament.matchIndex]=outcome==='win'?watchLeft:opponent;
        tournament.revealRounds=[pendingWinners.slice()];
        return;
      }
      const playerPair=tournament.bracket.indexOf(null)&~1;
      pendingWinners=[];
      for(let i=0;i<previous.length;i+=2){
        const first=previous[i],second=previous[i+1];
        const winner=i===playerPair?(outcome==='win'?null:opponent):simulatedWinner(first,second,i);
        pendingWinners.push(winner);
      }
      tournament.revealRounds=[pendingWinners];
      if(outcome==='loss'){
        let entrants=pendingWinners;
        for(let round=tournament.round+1;entrants.length>1;round++){
          const winners=[];
          for(let i=0;i<entrants.length;i+=2){
            const first=entrants[i],second=entrants[i+1],winner=simulatedWinner(first,second,i,round);
            winners.push(winner);
          }
          tournament.revealRounds.push(winners);
          entrants=winners;
        }
      }
    }
    function advanceTournament(){
      if(!pendingWinners)return;
      tournament.bracket=pendingWinners;
      tournament.history.push(pendingWinners);
      tournament.round++;
      tournament.matchIndex=0;
      pendingWinners=null;
      startMatch();
    }
    function showMenu(){
      matchToken++;tournament=null;opponent=null;watchLeft=null;outcome=null;pendingWinners=null;thinking=false;introActive=false;watchMode=false;
      byId('stage').className='stage';clearStoneFlight();
      audio.stop();audio.setMusic('bracket');byId('round-intro').hidden=true;
      byId('stage').hidden=true;byId('menu').hidden=false;byId('place').hidden=true;
      byId('tournament-recap').hidden=true;byId('continue-overlay').hidden=true;byId('back').hidden=false;byId('thinking').hidden=true;byId('victory-effect').hidden=true;byId('win-orbit').hidden=true;byId('enemy-win-orbit').hidden=true;byId('match-confetti').hidden=true;
      byId('leave-confirm').hidden=true;
      byId('history-view').hidden=true;byId('history-log-view').hidden=true;byId('editor-view').hidden=true;renderDailyHeader();
    }
    function requestMenu(){
      if(tournament&&!tournament.random&&!ended&&!watchMode)byId('leave-confirm').hidden=false;
      else showMenu();
    }
    function lineFor(character,create){
      const saved={...settings};
      Object.assign(settings,character.profile);
      try{return create();}finally{Object.assign(settings,saved);}
    }
    function maybeSay(message,frequency,force=false,speaker=opponent){
      const left=watchMode&&speaker===watchLeft;
      const bubble=byId(left?'watch-speech':'speech'),other=byId(left?'speech':'watch-speech');
      const profile=left?speaker.profile:settings;
      if(!force&&Math.random()*100>=profile.talkativeness*frequency){
        bubble.hidden=true;bubble.textContent='';return;
      }
      other.hidden=true;other.textContent='';
      bubble.hidden=false;
      const line=profile.voice==='quirky'&&message.endsWith('。')
        &&!/(ダヨ|ッス|デスゾ|……)\。$/.test(message)
        ?message.slice(0,-1)+(speaker.id%2?'ッス。':'ダヨ。')
        :message;
      bubble.textContent=line.replace(/[。、]/g,' ').replace(/\s+/g,' ').trim();
      bubble.className=left?'speech watch-speech':'speech';
      void bubble.offsetWidth;
      bubble.className+=' flash';
      audio.speak(bubble.textContent,'character',speaker.id,speaker.hair);
    }
    const chooseLine=lines=>lines[Math.floor(Math.random()*lines.length)];
    function battleSituation(player=COM){
      const rival=player===COM?HUMAN:COM;
      const own=wins(board,player),other=wins(board,rival);
      return {ownFours:own.four.length,otherFours:other.four.length,
        ownThreats:potential(board,player).threats,otherThreats:potential(board,rival).threats,
        stones:board.reduce((count,stone)=>count+(stone!==EMPTY),0),
        ownFive:own.five.length,otherFive:other.five.length};
    }
    function openingLine(){
      if(turn===COM&&Math.random()<.33)return chooseLine(['サキニイクヨ。','サッソクハジメヨウ。','センテワモラッタ。']);
      if(settings.voice==='quirky')return chooseLine(['ヨロシクデスゾ。','オテヤワラカニダヨ。','ヨロシクッス！','イザショウブッス。','キョウモガンバルダヨ。','ドウゾヨロシクデスゾ。','オモシロクナリソウッス。','マケナイダヨ。','ハジメルデスゾ。']);
      if(settings.voice==='polite')return chooseLine(['ヨロシクオネガイシマス。','オテヤワラカニ。','イイショウブオ。','サア ハジメマショウ。','ゴタイセンオネガイシマス。','タノシミニシテイマシタ。','ドウゾオテヤワラカニ。','ヨイショウブニシマショウ。','セイイッパイイキマス。']);
      if(settings.personality==='teasing')return chooseLine(['コンチワ。マケナイデネ？','ヨロシク。タノシマセテヨ。','ウィッス。ココカラダヨ。','キミノテオミセテヨ。','スグニオワラセナイヨ。','サア ドコマデヤレル？','ワタシオオドロカセテ。','ヨロシクネ オテヤワラカニ。','フフッ ハジメヨウカ。']);
      if(settings.personality==='friendly')return chooseLine(['コンチワ！ヨロシクネ。','ヨロシク！タノシモウ。','オテヤワラカニネ。','キョウワイイショウブニシヨウ。','アエテウレシイヨ。','イッショニタノシモウネ。','オタガイガンバロウ。','ヨロシクオネガイシマス。','サア ハジメヨッカ。']);
      if(settings.personality==='reserved')return chooseLine(['ヨロシク。','……ヨロシク。','ハジメヨウ。','ドウゾ。','ウン。ヨロシク。','……ショウブ。']);
      return chooseLine(['ヨロシク。','コンチワ。','ウィッス。','オテヤワラカニ。','サア ハジメヨウ。','イイショウブオ。','カカッテキテ。','キョウワマケナイ。','ヨロシクネ。','サキワナガイヨ。','ショウブダ。','イザ タイセン。']);
    }
    function thinkingLine(player=COM){
      const state=battleSituation(player);
      if(state.otherFours>=2)return chooseLine(['ツギオトメナイト。','ココデマケラレナイ。','ウッ キビシイ。','マズイ テオヨモウ。','イッポンデギャクテンカ。','アキラメナイ。']);
      if(state.otherThreats>=2)return chooseLine(['アブナイナ……','フセグテオサガソウ。','ソコワミエテイル。','ウーン ケイカイシヨウ。','ツギオヨンデオコウ。','イマワマモリダ。']);
      if(state.ownFours>=2)return chooseLine(['アトイッポンダ。','ココデキメタイ。','ショウブドコロダ。','カチスジオサガソウ。','モウスコシデトドク。','アセルナ ヨクミロ。']);
      if(state.ownThreats>=2)return chooseLine(['ツナガリソウダ。','イイカタチカモ。','ツギガミエタ。','ココオノバソウ。','スキマオネラオウ。','センオツクレルカナ。']);
      if(state.stones>=40)return chooseLine(['バンガセマクナッタ。','ノコリオカゾエヨウ。','オワリガチカイ。','ココカラガムズカシイ。','イッテオタイセツニ。','サイゴマデヨモウ。']);
      const lines=['ウーン……','エット……','フム……','ンー ドウシヨウ。','♪ フフン フーン ♪','ナルホド……','コッチカナ……','チョットマッテ……','ドコガイイカナ。','マダキメラレナイ。','フフーン……','ムムム……','ソウダナ……','スコシカンガエル。','コレカ コレカ……','ヨシ ヨンデミヨウ。','ウーン ナヤムナ。','ナニカアルハズ。'];
      if(settings.depth===3)lines.push('モウスコシヨム……','ソウキタカ……','サンテサキマデ……','ココワジックリ。','ウラノテモアルナ。','ミオトシワナイカ。');
      if(settings.trick>70)lines.push('アノテデイクカ……','フフ ミエタ。','チョットヒネロウ。','ウラオカコウ。','マヨワセタイナ。','ココデフイオツク。');
      if(settings.personality==='teasing')lines.push('ドコニオコウカナ？','マヨッテルフリ。','キミワキヅクカナ。');
      if(settings.personality==='reserved')lines.push('……。','フム……','……カンガエチュウ。');
      return chooseLine(lines);
    }
    function moveLine(player=COM){
      const state=battleSituation(player);
      if(state.ownFours>=2)return chooseLine(['アトイッポン！','コレデキマルカナ。','ショウブワココカラ。','イイカタチダ。','ツギデネラエル。','サア ドウスル？']);
      if(state.ownFours>state.otherFours)return chooseLine(['イッポンモラッタ。','コッチガリード。','ヨシッ ツナガッタ。','コノママイクヨ。','イイナガレダ。','マダノバセル。']);
      if(state.otherFours>state.ownFours)return chooseLine(['マダマダコレカラ。','トリカエサナイト。','サガヒライタナ。','ウッ マズイカモ。','ココカラタテナオス。','オイツクヨ。']);
      if(state.otherThreats>=2)return chooseLine(['ココワフセグ。','ソノセンワトメル。','アブナカッタ。','マモリオカタメル。','ソコワワタサナイ。','イッタンシノゴウ。']);
      if(state.stones>=40)return chooseLine(['ノコリワスクナイ。','コノイッテニカケル。','サイゴマデイクヨ。','ココデツナグ。','オワリオヨモウ。','アトワタイミング。']);
      const lines=['ココダ。','フム。','ヨシッ。','アッ コッチカ。','♪ フフフーン ♪','ナルホド……','ココニシヨウ。','イイカンジ。','オイテミタ。','マア コレデ。','コッチオエラブ。','ウマクイクカナ。','ホイッ。','サテ ツギワ。','コレデドウダ。','ウン ワルクナイ。','チョットボウケン。','ココオツカオウ。'];
      if(settings.personality==='teasing')lines.push('オヤ？ソコデイイノ？','フフッ ドウスル？','マダマダダネ。','コノテワヨメタ？','チョットコマッタ？','キミノバンダヨ。','ホラ ミテミテ。','フフ コレワドウ？','ツギガタノシミ。');
      if(settings.personality==='friendly')lines.push('イイテダネ！','イッショニタノシモウ。','オオ ヤルネ！','ココガスキ。','ナカナカイイネ。','キミノテモミタイ。','ワクワクスルネ。','オタガイガンバロウ。','イイショウブダネ。');
      if(settings.personality==='thoughtful')lines.push('コノサキワ……','ヨミドオリ。','スジワミエテイル。','ココオオサエル。','ツギノカタチオミル。','コレガイチバン。');
      if(settings.ride>75)lines.push('ソノコマ カリルヨ。','ソコオアシバニ。','キミノコマモツカウヨ。');
      if(settings.unusual>75)lines.push('コレワドウ？','ヘンナテモイイヨネ。','チョットカワッタテ。','ヨソウガイデショ。','ココカライケル。','ナナメノハッソウ。');
      if(settings.expressiveness>65)lines.push('オッ！','ウッ……','アハハ！','ヤッタ。','エエッ？','フフフ。','ムムッ。','オオー。','ヨーシ。');
      return chooseLine(lines);
    }
    function resultLine(result,player=COM){
      const state=battleSituation(player);
      if(result==='win'){
        const tone=settings.personality==='teasing'
          ?['ウッ ヤラレタ……','ヤルネ ツギワマケナイヨ。','コレワクヤシイ。','チョットユダンダカナ。','ウマクヤッタネ。','フフ ツギワチガウヨ。']
          :settings.personality==='friendly'
            ?['オメデトウ！ツヨイネ。','マケチャッタ イイショウブ！','カッタネ オメデトウ。','タノシカッタヨ。','マタショウブシヨウ。','ステキナテダッタ。']
            :['ウッ……ツヨイ。','ナルホド……ヤラレタ。','マケタカ……','ミゴトダヨ。','アノテガヨカッタ。','ツギワガンバル。'];
        const situation=state.otherFive
          ?['ゴレンデキマッタ！','ソコマデヨンデタノ？','アッ ゴメン マケタ。','ゴレンワツヨイ。','ミゴトナイッテ。','ソレワトメラレナイ。']
          :state.otherFours>=3
            ?['サンボンソロッタカ。','センオミオトシタ。','キレイニツナイダネ。','ウッ ヨマレタ。','ソノカタチワミゴト。','マイッタ ヤルネ。']
            :[];
        return chooseLine([...situation,...tone]);
      }
      if(result==='loss'){
        const tone=settings.personality==='teasing'
          ?['フフ コノショウブワモラッタヨ。','ドウ？オドロイタ？','ツギワマケナイデネ。','ココマデヨンデタ。','フフッ ウマクイッタ。','マタカカッテキテ。']
          :settings.personality==='friendly'
            ?['アリガトウ！タノシカッタ。','イイショウブダッタネ！','マタアソボウネ。','ギリギリダッタヨ。','キミモツヨカッタ。','タノシイショウブダッタ。']
            :['ヨシッ カッタ。','フウ……ヤッタ。','ナントカトドイタ。','アブナカッタ。','コレデイッポン。','ツギモガンバル。'];
        const situation=state.ownFive
          ?['ゴレンデキマッタ！','コレデキマリ。','ヨシ ゴレンダ。','キレイニソロッタ。','コノセンガミエテタ。','イイキマリテダ。']
          :state.ownFours>=3
            ?['サンボンソロッタ。','コレデカチダ。','センガツナガッタ。','ヨシッ キマッタ。','イッポンメカラネラッテタ。','キレイナカタチダ。']
            :[];
        return chooseLine([...situation,...tone]);
      }
      return chooseLine(['ヒキワケカ。','アララ オアイコ。','ウーン……モウイッカイ。','ドッチモユズラナイネ。','モウイチドショウブ。','キレイニナランダネ。','コレワサイセンカ。','マダオワラナイヨ。','ツギデキメヨウ。']);
    }
    const bracketLayout={cardWidth:38,cardHeight:36,step:53,slot:37,margin:4,top:32,gap:19,championY:16};
    function bracketWidth(size){
      const {cardWidth,step,margin,gap}=bracketLayout,depth=Math.log2(size)-1;
      return 2*(margin+depth*step+cardWidth)+gap;
    }
    function bracketPosition(size,level,index,character){
      const {cardWidth,cardHeight,step,slot,margin,top,championY,gap}=bracketLayout;
      const roundCount=Math.log2(size),width=bracketWidth(size);
      const name=character===null?(watchMode?watchLeft.name:playerName()):character==='TBD'?'—':character?.name||'';
      const ownWidth=character===null||character==='TBD'?cardHeight:Math.max(19,Math.min(cardWidth,Math.ceil(name.length*8.3+4)));
      if(level===roundCount)return {x:(width-ownWidth)/2,y:championY,width:ownWidth};
      const sideCount=size/2**(level+1),right=index>=sideCount;
      if(level===roundCount-1)return {x:right?width/2+gap/2:width/2-gap/2-ownWidth,
        y:top+((index%sideCount)+.5)*2**level*slot,width:ownWidth};
      const column=right?width-margin-cardWidth-level*step:margin+level*step;
      return {x:column+(cardWidth-ownWidth)/2,
        y:top+((index%sideCount)+.5)*2**level*slot,width:ownWidth};
    }
    function appendBracketFace(entry,character){
      if(character===null&&!watchMode&&player){
        const portrait=document.createElement('span');portrait.className='bracket-portrait bracket-player-portrait';
        for(const key of ['skin','hair','cloth']){
          const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;canvas.className='portrait-layer';
          const mask=key==='hair'?player.layerMasks.hair[playerSelection.hair]:player.layerMasks[key];
          drawTintedPart(canvas,mask,playerSelection[key+'Color']);
          portrait.append(canvas);
        }
        for(const key of ['eyes','mouth']){
          const image=document.createElement('img');image.src=player.files[key][playerSelection[key]];image.alt='';portrait.append(image);
        }
        entry.append(portrait);
      }else if((character||watchLeft)&&character!=='TBD'){
        if(character===null)character=watchLeft;
        const portrait=document.createElement('span');portrait.className='bracket-portrait';
        for(const file of ['characters/'+character.file,
          'characters/player-parts/'+character.eyes+'.png',
          'characters/player-parts/'+character.mouth+'.png']){
          const image=document.createElement('img');image.src=file;image.alt='';portrait.append(image);
        }
        entry.append(portrait);
      }
      const label=document.createElement('span');label.textContent=character===null?(watchMode?watchLeft.name:playerName()):character==='TBD'?'—':character.name;
      entry.append(label);
    }
    function renderBattleHistory(){
      const list=byId('recap-battles');list.replaceChildren();
      list.hidden=watchMode||tournament.random||!tournament.battles.length;
      if(list.hidden)return;
      const heading=document.createElement('strong');heading.className='recap-battles-heading';heading.textContent=(watchMode?watchLeft.name:playerName())+' MATCHES';
      list.append(heading);
      for(const battle of tournament.battles){
        const card=document.createElement('div');card.className='recap-battle '+battle.result;
        const round=document.createElement('span');round.className='recap-battle-round';
        round.textContent=['1ST','2ND','3RD','4TH','5TH'][battle.round]+' ROUND';
        const face=document.createElement('span');face.className='recap-battle-face';
        const body=document.createElement('img');body.src='characters/'+battle.opponent.file;body.alt='';face.append(body);
        const expression=document.createElement('img');expression.src='characters/'+(battle.result==='win'?battle.opponent.loseFile:battle.opponent.winFile);
        expression.alt='';face.append(expression);
        const name=document.createElement('span');name.className='recap-battle-name';name.textContent=battle.opponent.name;
        const result=document.createElement('b');result.textContent=battle.result==='win'?'WIN':'LOSE';
        card.append(round,face,name,result);list.append(card);
      }
    }
    function centerBracket(){
      const container=byId('bracket-rounds'),canvas=container.children[0];
      if(!canvas)return;
      const width=canvas.bracketWidth||canvas.offsetWidth||1,height=canvas.bracketHeight||canvas.offsetHeight||1;
      const availableWidth=container.clientWidth||width;
      const availableHeight=Math.min(620,(window.innerHeight||height)*.7,container.clientHeight||height);
      const scale=Math.min(1.35,availableWidth/width,availableHeight/height);
      canvas.setAttribute('style',`width:${width}px;height:${height}px;zoom:${scale}`);
      container.scrollLeft=0;container.scrollTop=0;
    }
    function renderBracket(revealedCount=tournament.revealRounds?.length||0){
      const container=byId('bracket-rounds');
      byId('bracket-crowning').hidden=true;
      renderBattleHistory();
      if(tournament.random){
        container.replaceChildren();
        container.hidden=true;
        byId('recap-title').textContent=outcome==='win'?'VICTORY':outcome==='loss'?'LOSE':'DRAW';
        byId('recap-subtitle').textContent=outcome==='draw'?'REPLAY THE MATCH':'RANDOM MATCH COMPLETE';
        return;
      }
      const size=tournament.type.size,roundCount=Math.log2(size),depth=roundCount-1;
      container.hidden=false;
      const rounds=tournament.history.concat((tournament.revealRounds||[]).slice(0,revealedCount));
      const filledRounds=rounds.length;
      while(rounds.length<=roundCount)rounds.push(Array(rounds[rounds.length-1].length/2).fill('TBD'));
      const {cardWidth,cardHeight,slot,top}=bracketLayout;
      const width=bracketWidth(size),height=top+(size/2)*slot+slot/2;
      const canvas=document.createElement('div');canvas.className='bracket-canvas two-sided';
      canvas.bracketWidth=width;canvas.bracketHeight=height;
      function line(x1,y1,x2,y2,active,delay){
        const segment=document.createElement('div');
        segment.className='bracket-line'+(active?' active':'')+(active&&Math.floor(delay/170)===filledRounds-2?' fresh':'');
        segment.setAttribute('style',`left:${Math.min(x1,x2)}px;top:${Math.min(y1,y2)}px;width:${Math.max(2,Math.abs(x2-x1))}px;height:${Math.max(2,Math.abs(y2-y1))}px;--delay:${delay}ms`);
        canvas.append(segment);
      }
      function heading(label,x,headingWidth=cardWidth,y=top-21){
        const title=document.createElement('div');title.className='bracket-heading';title.textContent=label;
        title.setAttribute('style',`left:${x}px;top:${y}px;width:${headingWidth}px`);canvas.append(title);
      }
      function card(character,level,index){
        const position=bracketPosition(size,level,index,character);
        const entry=document.createElement('div');
        entry.bracketCharacter=character;entry.bracketRound=level;
        entry.bracketX=position.x;entry.bracketY=position.y;
        entry.className='bracket-entry'+(character===null?' you':'')+(character==='TBD'?' pending':'')
          +(revealedCount>0&&level===filledRounds-1&&character!=='TBD'?' winner promoted':'')
          +(level===roundCount&&character!=='TBD'?' champion':'')
          +(outcome==='loss'&&level===tournament.round&&index===tournament.bracket.indexOf(null)?' out':'');
        entry.setAttribute('style',`left:${position.x}px;top:${position.y-cardHeight/2}px;width:${position.width}px;height:${cardHeight}px;--delay:${level*170+Math.min(index,16)*16}ms`);
        appendBracketFace(entry,character);canvas.append(entry);
      }
      function connectPair(first,second,parent,fromRight,active,winnerIsFirst,delay){
        const edge1=fromRight?first.x:first.x+first.width;
        const edge2=fromRight?second.x:second.x+second.width;
        const parentEdge=fromRight?parent.x+parent.width:parent.x;
        const middle=(parentEdge+(edge1+edge2)/2)/2;
        line(edge1,first.y,middle,first.y,active&&winnerIsFirst,delay);
        line(edge2,second.y,middle,second.y,active&&!winnerIsFirst,delay);
        line(middle,first.y,middle,parent.y,active&&winnerIsFirst,delay+45);
        line(middle,parent.y,middle,second.y,active&&!winnerIsFirst,delay+45);
        line(middle,parent.y,parentEdge,parent.y,active,delay+90);
      }
      for(let level=0;level<=depth;level++){
        const count=size/2**(level+1);
        for(let index=0;index<count;index++){
          card(rounds[level][index],level,index);
          card(rounds[level][count+index],level,count+index);
        }
        if(level===depth)continue;
        for(let pair=0;pair<count/2;pair++){
          const leftFirst=bracketPosition(size,level,pair*2,rounds[level][pair*2]);
          const leftSecond=bracketPosition(size,level,pair*2+1,rounds[level][pair*2+1]);
          const leftParent=bracketPosition(size,level+1,pair,rounds[level+1][pair]);
          const rightFirst=bracketPosition(size,level,count+pair*2,rounds[level][count+pair*2]);
          const rightSecond=bracketPosition(size,level,count+pair*2+1,rounds[level][count+pair*2+1]);
          const rightParentIndex=count/2+pair;
          const rightParent=bracketPosition(size,level+1,rightParentIndex,rounds[level+1][rightParentIndex]);
          const active=level<filledRounds-1;
          connectPair(leftFirst,leftSecond,leftParent,false,active&&rounds[level+1][pair]!=='TBD',
            rounds[level][pair*2]===rounds[level+1][pair],level*170);
          connectPair(rightFirst,rightSecond,rightParent,true,active&&rounds[level+1][rightParentIndex]!=='TBD',
            rounds[level][count+pair*2]===rounds[level+1][rightParentIndex],level*170);
        }
      }
      const champion=rounds[roundCount][0];

      const leftFinal=bracketPosition(size,depth,0,rounds[depth][0]);
      const rightFinal=bracketPosition(size,depth,1,rounds[depth][1]);
      const axis=width/2,finalY=leftFinal.y,championKnown=filledRounds>roundCount;
      line(leftFinal.x+leftFinal.width,finalY,axis,finalY,
        championKnown&&rounds[depth][0]===champion,depth*170);
      line(axis,finalY,rightFinal.x,finalY,
        championKnown&&rounds[depth][1]===champion,depth*170);
      if(championKnown)line(axis-1,0,axis-1,finalY,true,depth*170+45);
      container.replaceChildren(canvas);
      container.className='bracket-rounds full-bracket';
      centerBracket();
      byId('recap-title').textContent=outcome==='win'
        ?(tournament.bracket.length===2?'CHAMPION':'ROUND CLEARED')
        :outcome==='loss'?'LOSE':'DRAW';
      byId('recap-subtitle').textContent=outcome==='draw'
        ?'THE MATCH WILL BE REPLAYED'
        :outcome==='win'&&tournament.bracket.length===2?(watchMode?watchLeft.name:playerName())+' WON THE TOURNAMENT'
        :outcome==='win'?'ADVANCING TO ROUND '+(tournament.round+2)
        :filledRounds===roundCount+1?rounds[roundCount][0].name+' WINS THE CUP'
        :'THE BRACKET CONTINUES WITHOUT '+(watchMode?watchLeft.name:playerName());
      if(watchMode){
        const winner=outcome==='win'?watchLeft:opponent;
        byId('recap-title').textContent=tournament.bracket.length===2?'CHAMPION':'MATCH '+(tournament.matchIndex+1)+' / '+(tournament.bracket.length/2);
        byId('recap-subtitle').textContent=tournament.bracket.length===2?winner.name+' WINS THE CUP':winner.name+' WIN';
      }
      if(filledRounds===roundCount+1){
        const champion=rounds[roundCount][0],own=champion===null;
        byId('bracket-crowning-name').textContent=(own?(watchMode?watchLeft.name:playerName()):champion.name)+' CHAMPION';
        byId('bracket-champion-player').hidden=!own||watchMode;
        for(const id of ['bracket-champion-face','bracket-champion-expression','bracket-champion-tint','bracket-champion-scanlines'])
          byId(id).hidden=own&&!watchMode;
        if(own&&!watchMode){if(player)paintPlayer('bracket-champion-player','win');}
        else{
          const winner=own?watchLeft:champion;
          byId('bracket-champion-face').src='characters/'+winner.file;
          byId('bracket-champion-expression').src='characters/'+winner.winFile;
          drawScanlines(winner.winMask,'bracket-champion-scanlines');
        }
        const confetti=byId('bracket-confetti');confetti.replaceChildren();
        for(let n=0;n<48;n++){
          const piece=document.createElement('i');piece.className='bracket-confetti-piece';
          const left=n%2===0,flight=Math.round(15+Math.random()*78);
          piece.setAttribute('style',`--x:${left?0:100}%;--y:${Math.round(20+Math.random()*55)}%;--flight-x:${left?flight:-flight}vw;--flight-y:${Math.round(-70+Math.random()*130)}px;--spin:${Math.round(360+Math.random()*700)}deg;--delay:${Math.round(Math.random()*900)}ms;--hue:${n%3===0?48:n%3===1?145:355}`);
          confetti.append(piece);
        }
        byId('bracket-crowning').hidden=false;
        centerBracket();
      }
    }
    function animateBracketReveal(step,token){
      if(token!==matchToken||!tournament||byId('tournament-recap').hidden)return;
      renderBracket(step-1);
      const canvas=byId('bracket-rounds').children[0];
      const size=tournament.type.size,level=tournament.history.length+step-1;
      const previous=tournament.history.concat(tournament.revealRounds.slice(0,step-1))[level-1];
      const winners=tournament.revealRounds[step-1];
      const stagger=110,duration=1900,cardHeight=bracketLayout.cardHeight,roundCount=Math.log2(size);
      for(let index=0;index<winners.length;index++){
        const winner=winners[index];
        let sourceIndex;
        if(level===roundCount)sourceIndex=previous[0]===winner?0:1;
        else{
          const half=winners.length/2,sourceHalf=half*2;
          const side=index>=half?1:0,base=side*sourceHalf+(index-side*half)*2;
          sourceIndex=previous[base]===winner?base:base+1;
        }
        const from=bracketPosition(size,level-1,sourceIndex,previous[sourceIndex]);
        const to=bracketPosition(size,level,index,winner);
        const fromRight=level<roundCount&&index>=winners.length/2;
        const childEdge=fromRight?from.x:from.x+from.width;
        const parentEdge=fromRight?to.x+to.width:to.x;
        const middle=level===roundCount?canvas.bracketWidth/2:(childEdge+parentEdge)/2;
        const cornerX=middle-from.x-from.width/2;
        const ghost=document.createElement('div');ghost.className='bracket-entry bracket-traveler'+(winner===null?' you':'');
        ghost.setAttribute('style',`left:${from.x}px;top:${from.y-cardHeight/2}px;width:${from.width}px;height:${cardHeight}px;--corner-x:${cornerX}px;--travel-x:${to.x-from.x}px;--travel-y:${to.y-from.y}px;--travel-duration:${duration}ms;--delay:${index*stagger}ms`);
        appendBracketFace(ghost,winner);canvas.append(ghost);
      }
      setTimeout(()=>{
        if(token!==matchToken||!tournament||byId('tournament-recap').hidden)return;
        renderBracket(step);
        if(step<tournament.revealRounds.length)
          setTimeout(()=>animateBracketReveal(step+1,token),550);
        else{
          if(winners.length===1&&outcome==='loss')audio.setMusic('victory');
          byId('match-actions').hidden=false;
        }
      },duration+(winners.length-1)*stagger+150);
    }
    function animateWatchMatch(token){
      const size=tournament.type.size,level=tournament.round+1,roundCount=Math.log2(size);
      const pair=tournament.matchIndex,winner=outcome==='win'?watchLeft:opponent;
      const sourceIndex=pair*2+(winner===watchLeft?0:1);
      const from=bracketPosition(size,level-1,sourceIndex,winner);
      const to=bracketPosition(size,level,pair,winner);
      const canvas=byId('bracket-rounds').children[0];
      const fromRight=level<roundCount&&pair>=pendingWinners.length/2;
      const childEdge=fromRight?from.x:from.x+from.width;
      const parentEdge=fromRight?to.x+to.width:to.x;
      const middle=level===roundCount?canvas.bracketWidth/2:(childEdge+parentEdge)/2;
      const ghost=document.createElement('div'),duration=1900;
      ghost.className='bracket-entry bracket-traveler';
      ghost.setAttribute('style',`left:${from.x}px;top:${from.y-bracketLayout.cardHeight/2}px;width:${from.width}px;height:${bracketLayout.cardHeight}px;--corner-x:${middle-from.x-from.width/2}px;--travel-x:${to.x-from.x}px;--travel-y:${to.y-from.y}px;--travel-duration:${duration}ms;--delay:0ms`);
      appendBracketFace(ghost,winner);canvas.append(ghost);
      setTimeout(()=>{
        if(token!==matchToken||!tournament||byId('tournament-recap').hidden)return;
        renderBracket(1);
        if(tournament.bracket.length===2)audio.setMusic('victory');
        setTimeout(()=>{
          if(token!==matchToken||!tournament||byId('tournament-recap').hidden)return;
          if(pair+1<tournament.bracket.length/2){tournament.matchIndex++;startMatch();}
          else if(tournament.bracket.length===2)startTournament(32,true);
          else advanceTournament();
        },1800);
      },duration+150);
    }
    function showVictoryEffect(){
      const orbit=byId(outcome==='loss'?'enemy-win-orbit':'win-orbit');
      if(!orbit.children.length)for(let n=0;n<11;n++){
        const block=document.createElement('i');
        block.setAttribute('style',`--angle:${n*360/11}deg`);
        orbit.append(block);
      }
      orbit.hidden=false;
      if(outcome==='loss')return;
      if(!watchMode){
        const confetti=byId('match-confetti'),pieces=[];
        for(let n=0;n<56;n++){
          const piece=document.createElement('i'),fromLeft=n%2===0;
          piece.className='match-confetti-piece';
          const spin=(fromLeft?1:-1)*(280+(n*41)%520);
          piece.setAttribute('style',`--origin:${fromLeft?0:100}%;--apex-x:${fromLeft?'':'-'}${14+(n*17)%45}vw;--land-x:${fromLeft?'':'-'}${24+(n*23)%54}vw;--apex-y:-${28+(n*13)%43}vh;--mid-spin:${spin*.55}deg;--spin:${spin}deg;--duration:${2.2+(n%8)*.16}s;--delay:${(n%12)*.045}s;--hue:${n%4===0?47:n%4===1?153:n%4===2?345:190}`);
          pieces.push(piece);
        }
        confetti.replaceChildren(...pieces);confetti.hidden=false;
      }
      const champion=!watchMode&&!tournament.random&&tournament.bracket.length===2;
      byId('board-frame').className='board-frame win-flash'+(champion?' champion-result':'');
      if(champion){
        const particles=[];
        for(let n=0;n<70;n++){
          const piece=document.createElement('i'),side=n%2===0;
          piece.className='victory-particle'+(n<46?' side-confetti':'');
          piece.setAttribute('style',`--x:${side?'-2':'102'}%;--y:${18+(n*29)%70}%;--hue:${n%5===0?151:42+(n*13)%14};--duration:${1.4+(n%9)*.16}s;--delay:${1.15+(n%11)*.11}s;--flight-x:${side?'':'-'}${22+(n*37)%101}vw;--flight-y:${-25+(n*17)%95}vh;--spin:${(n%2?1:-1)*(120+(n*31)%360)}deg;--drift:${(n*17)%70-35}vw;--rise:${30+(n*23)%50}vh`);
          particles.push(piece);
        }
        byId('victory-particles').replaceChildren(...particles);
        byId('victory-kicker').textContent=tournament.type.label+' TOURNAMENT';
        byId('victory-title').textContent='CHAMPION';
        byId('victory-subtitle').textContent=playerName()+' · '+tournament.cup;
        const effect=byId('victory-effect');
        effect.className='victory-effect champion';effect.hidden=false;
      }
    }
    function showRecap(){
      if(!ended||!tournament||flightIndex>=0||!byId('tournament-recap').hidden)return;
      byId('continue-overlay').hidden=true;byId('back').hidden=false;
      byId('victory-effect').hidden=true;byId('win-orbit').hidden=true;byId('enemy-win-orbit').hidden=true;byId('match-confetti').hidden=true;
      byId('board-frame').className='board-frame';
      byId('tournament-recap').hidden=false;
      renderBracket(0);
      audio.setMusic(outcome==='win'&&!watchMode&&!tournament.random&&tournament.bracket.length===2?'victory':'bracket');
      byId('match-actions').hidden=watchMode||(outcome==='loss'&&!!tournament.revealRounds);
      byId('next-match').hidden=!watchMode&&outcome==='win'&&tournament.bracket.length===2;
      if(watchMode&&tournament.revealRounds)animateWatchMatch(matchToken);
      else if(tournament.revealRounds)animateBracketReveal(1,matchToken);
      else if(watchMode)setTimeout(()=>{if(tournament&&byId('tournament-recap').hidden===false)startMatch();},1800);
    }
    function scheduleRecap(){
      const token=matchToken;
      const pause=(outcome==='win'?5200:3800)*(watchMode?1.5:1);
      const advance=()=>{
        if(token!==matchToken||!ended||!tournament)return;
        if(flightIndex>=0){setTimeout(advance,80);return;}
        showRecap();
      };
      setTimeout(advance,pause);
    }
    function styleBonus(i){
      const r=Math.floor(i/N),c=i%N;
      const edges=[r===0,r===ROWS-1,c===0,c===N-1];
      const used=[false,false,false,false];
      for(let j=0;j<N*ROWS;j++)if(board[j]===COM){
        const row=Math.floor(j/N),col=j%N;
        if(row===0)used[0]=true;if(row===ROWS-1)used[1]=true;
        if(col===0)used[2]=true;if(col===N-1)used[3]=true;
      }
      const freshEdge=edges.some((edge,j)=>edge&&!used[j]);
      const neighbours=[[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
      const supportedByRival=neighbours.some(([row,col])=>row>=0&&row<ROWS&&col>=0&&col<N&&board[row*N+col]===HUMAN);
      const turnCount=board.reduce((count,stone)=>count+(stone!==EMPTY),0);
      const variation=Math.sin((i+1)*12.9898+(turnCount+1)*78.233)*43758.5453;
      const noise=(variation-Math.floor(variation))-.5;
      return (freshEdge?settings.edgeExplore*.12:0)+(supportedByRival?settings.ride*.1:0)
        +(settings.unusual*.12)*(1-Math.min(1,positionValue(i)/8))
        +noise*(100-settings.consistency)*.22;
    }
    const byId=id=>document.getElementById(id);
    function legalMoves(b){
      const result=[];
      for(let r=0;r<ROWS;r++)for(let c=0;c<N;c++){
        const i=r*N+c;if(b[i])continue;
        let ok=true;
        for(let x=c-1;x>=0;x--)if(!b[r*N+x]){ok=false;break;}
        if(!ok){ok=true;for(let x=c+1;x<N;x++)if(!b[r*N+x]){ok=false;break;}}
        if(!ok){ok=true;for(let y=r-1;y>=0;y--)if(!b[y*N+c]){ok=false;break;}}
        if(!ok){ok=true;for(let y=r+1;y<ROWS;y++)if(!b[y*N+c]){ok=false;break;}}
        if(ok)result.push(i);
      }
      return result;
    }
    function wins(b,player){
      const four=[],five=[];
      for(const w of windows){
        if(!w.indices.every(i=>b[i]===player))continue;
        // Only count complete runs of exactly four; a run of five wins separately.
        if(w.length===5){five.push(w.indices);continue;}
        const beforeR=w.r-w.dr,beforeC=w.c-w.dc,afterR=w.r+w.dr*4,afterC=w.c+w.dc*4;
        const before=beforeR>=0&&beforeR<ROWS&&beforeC>=0&&beforeC<N&&b[beforeR*N+beforeC]===player;
        const after=afterR>=0&&afterR<ROWS&&afterC>=0&&afterC<N&&b[afterR*N+afterC]===player;
        if(!before&&!after)four.push(w.indices);
      }
      return {four,five,won:five.length>0||four.length>=3};
    }
    function positionValue(i){const r=Math.floor(i/N),c=i%N;return (4-Math.abs(r-4))+(4-Math.abs(c-4));}
    function potential(b,player){
      let value=0,threats=0;
      for(const w of windows){
        if(w.length!==4)continue;
        let own=0,enemy=0;
        for(const i of w.indices){if(b[i]===player)own++;else if(b[i]!==EMPTY)enemy++;}
        if(enemy)continue;
        if(own===4)value+=1900;
        else if(own===3){value+=105;threats++;}
        else if(own===2)value+=13;
        else if(own===1)value+=1.5;
      }
      return {value,threats};
    }
    function evaluate(b){
      const cw=wins(b,COM),hw=wins(b,HUMAN);
      if(cw.won)return 1000000;
      if(hw.won)return -1000000;
      const cp=potential(b,COM),hp=potential(b,HUMAN);
      let score=cp.value*(.7+settings.attack*.006)-hp.value*(.7+settings.defense*.007)+(cp.threats**2-hp.threats**2)*settings.trick*.035;
      for(let i=0;i<N*ROWS;i++)if(b[i])score+=positionValue(i)*(b[i]===COM?1:-1)*settings.center*.009;
      return score;
    }
    function rankedMoves(b,player,limit){
      const moves=legalMoves(b).map(i=>{
        b[i]=player;const w=wins(b,player);const value=w.won?1000000:evaluate(b)*(player===COM?1:-1);b[i]=EMPTY;
        return {i,value};
      });
      moves.sort((a,z)=>z.value-a.value);
      return limit?moves.slice(0,limit):moves;
    }
    function search(b,player,depth,alpha,beta){
      const cw=wins(b,COM),hw=wins(b,HUMAN);
      if(cw.won)return 1000000+depth;
      if(hw.won)return -1000000-depth;
      if(depth===0)return evaluate(b);
      const moves=rankedMoves(b,player,depth>=2?7:10);
      if(!moves.length)return evaluate(b);
      if(player===COM){
        let best=-Infinity;
        for(const {i} of moves){b[i]=COM;best=Math.max(best,search(b,HUMAN,depth-1,alpha,beta));b[i]=EMPTY;alpha=Math.max(alpha,best);if(beta<=alpha)break;}
        return best;
      }
      let best=Infinity;
      for(const {i} of moves){b[i]=HUMAN;best=Math.min(best,search(b,COM,depth-1,alpha,beta));b[i]=EMPTY;beta=Math.min(beta,best);if(beta<=alpha)break;}
      return best;
    }
    function chooseComMove(){
      const moves=legalMoves(board);if(!moves.length)return -1;
      const blunder=Math.random()*100<settings.mistake;
      // Check immediate finishes and threats before deeper search.
      const immediate=[];for(const i of moves){board[i]=COM;if(wins(board,COM).won)immediate.push(i);board[i]=EMPTY;}
      if(immediate.length&&!blunder)return immediate[Math.floor(Math.random()*immediate.length)];
      const threats=[];for(const i of moves){board[i]=HUMAN;if(wins(board,HUMAN).won)threats.push(i);board[i]=EMPTY;}
      const candidates=(threats.length===1&&!blunder?threats:moves);
      const scored=[];
      for(const i of candidates){
        board[i]=COM;
        const score=search(board,HUMAN,settings.depth-1,-Infinity,Infinity);
        const lead=potential(board,COM).threats-potential(board,HUMAN).threats;
        board[i]=EMPTY;
        scored.push({i,score:score+lead*settings.trick*.16+styleBonus(i)});
      }
      scored.sort((a,z)=>z.score-a.score);
      if(blunder&&scored.length>1){
        const pool=scored.slice(1,Math.min(scored.length,Math.max(3,Math.ceil(scored.length*.3))));
        return pool[Math.floor(Math.random()*pool.length)].i;
      }
      return scored[0].i;
    }
    function chooseWatchMove(){
      const originalBoard=board,originalSettings={...settings};
      board=Uint8Array.from(originalBoard,stone=>stone===HUMAN?COM:stone===COM?HUMAN:EMPTY);
      Object.assign(settings,watchLeft?.profile||watchSettings);
      try{return chooseComMove();}
      finally{board=originalBoard;Object.assign(settings,originalSettings);}
    }
    const crystal=[
      '..ooooooo..','.ossssssso.','osmmmmmmhso','osmxxxxxhso',
      'osmxxxxxhso','osmxxxxxhso','osmxxxxxhso','osmxxxxxhso',
      'osmmmmmmhso','.ossssssso.','..ooooooo..'
    ];
    const crystalColors={
      green:{o:'#0a5032',s:'#078457',m:'#18bf78',x:'#39ef9b',h:'#afffda'},
      red:{o:'#651729',s:'#a5253e',m:'#d93859',x:'#ff5a76',h:'#ffc0cb'},
      recent:{o:'#a83950',s:'#e55270',m:'#ff7891',x:'#ffabc0',h:'#fff0f3'}
    };
    function drawTitleCrystals(){
      for(const [id,colors] of [['title-green-crystal',crystalColors.green],['title-red-crystal',crystalColors.red]]){
        const canvas=byId(id),context=canvas.getContext('2d');
        context.imageSmoothingEnabled=false;
        for(let y=0;y<11;y++)for(let x=0;x<11;x++){
          const pixel=crystal[y][x];
          if(pixel!=='.'){context.fillStyle=colors[pixel];context.fillRect(x,y,1,1);}
        }
        context.fillStyle=colors.h;
        for(const [x,y] of [[3,2],[4,2],[3,3],[7,6],[8,6]])context.fillRect(x,y,1,1);
      }
    }
    function flashComMove(i){
      flashCtx.clearRect(0,0,16,16);
      flashCtx.fillStyle='#f7ffff';
      for(let y=0;y<11;y++)for(let x=0;x<11;x++)
        if(crystal[y][x]!=='.')flashCtx.fillRect(x+3,y+3,1,1);
      comFlash.setAttribute('style',`position:absolute;z-index:3;width:${100/N}%;height:${100/ROWS}%;left:${(i%N+.5)*100/N}%;top:${(Math.floor(i/N)+.5)*100/ROWS}%;transform:translate(-50%,-50%);opacity:0;image-rendering:pixelated;pointer-events:none;filter:drop-shadow(0 0 7px #f7ffff)`);
      comFlashAnimation?.cancel();
      if(typeof comFlash.animate==='function')comFlashAnimation=comFlash.animate([
        {opacity:0},{opacity:.95,offset:.45},{opacity:.95,offset:.55},{opacity:0}
      ],{duration:900,iterations:2,easing:'ease-in-out'});
    }
    function drawStone(cx,cy,player,four,won,recent){
      const colors=player===HUMAN?crystalColors.green:recent?crystalColors.recent:crystalColors.red;
      if(recent){ctx.shadowColor='#ffd5df';ctx.shadowBlur=13;}
      for(let y=0;y<11;y++)for(let x=0;x<11;x++){
        const pixel=crystal[y][x];if(pixel==='.')continue;
        ctx.fillStyle=colors[pixel];ctx.fillRect(cx+x-5,cy+y-5,1,1);
      }
      ctx.shadowBlur=0;
      ctx.fillStyle=colors.h;
      for(const [x,y] of [[-2,-3],[-1,-3],[-2,-2],[2,1],[3,1]])ctx.fillRect(cx+x,cy+y,1,1);
      if(four||won){
        ctx.fillStyle=player===HUMAN?'#39ef9b':'#ff5a76';
        ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=10;
        ctx.fillRect(cx-7,cy-7,15,1);ctx.fillRect(cx-7,cy+7,15,1);
        ctx.fillRect(cx-7,cy-7,1,15);ctx.fillRect(cx+7,cy-7,1,15);
        ctx.shadowBlur=0;
      }
    }
    function clearStoneFlight(){
      flightAnimation?.cancel();flightElement?.remove?.();
      flightAnimation=null;flightElement=null;flightIndex=-1;
    }
    function launchStoneFlight(i,player){
      const name=byId(player===HUMAN?'score-player-name':'score-opponent-name');
      if(!name.getBoundingClientRect||!boardEl.getBoundingClientRect)return false;
      const from=name.getBoundingClientRect(),target=boardEl.getBoundingClientRect();
      if(!target.width||!target.height)return false;
      const flight=document.createElement('canvas');
      if(!flight.animate)return false;
      clearStoneFlight();
      flight.width=11;flight.height=11;flight.className='stone-flight '+(player===HUMAN?'human':'com');
      flight.setAttribute('aria-hidden','true');
      const brush=flight.getContext('2d'),colors=player===HUMAN?crystalColors.green:crystalColors.red;
      brush.imageSmoothingEnabled=false;
      for(let y=0;y<11;y++)for(let x=0;x<11;x++){const pixel=crystal[y][x];if(pixel!=='.'){brush.fillStyle=colors[pixel];brush.fillRect(x,y,1,1);}}
      const size=Math.max(15,Math.min(42,target.width/N*.72));
      const sx=from.left+from.width/2-size/2,sy=from.bottom+5;
      const ex=target.left+(i%N+.5)*target.width/N-size/2;
      const ey=target.top+(Math.floor(i/N)+.5)*target.height/ROWS-size/2;
      flight.setAttribute('style',`width:${size}px;height:${size}px;left:0;top:0`);
      byId('stage').append(flight);flightElement=flight;flightIndex=i;
      flightAnimation=flight.animate([
        {transform:`translate(${sx}px,${sy}px)`,opacity:1},
        {transform:`translate(${ex}px,${ey}px)`,opacity:1}
      ],{duration:620,easing:'linear',fill:'forwards'});
      flightAnimation.onfinish=()=>{
        if(flightElement!==flight)return;
        flightElement.remove?.();flightElement=null;flightAnimation=null;flightIndex=-1;
        if(player===COM)flashComMove(i);
        render();
      };
      return true;
    }
    function drawBoard(legal,hs,cs){
      const greenFours=new Set(hs.four.flat()),redFours=new Set(cs.four.flat());
      ctx.clearRect(0,0,144,144);
      for(let row=0;row<ROWS;row++){
        const y=8+row*16;
        ctx.fillStyle='#124d36';ctx.fillRect(8,y-.75,128,1.5);
        ctx.fillStyle='#2a9e68';ctx.fillRect(8,y-.25,128,.5);
      }
      for(let col=0;col<N;col++){
        const x=8+col*16;
        ctx.fillStyle='#124d36';ctx.fillRect(x-.75,8,1.5,128);
        ctx.fillStyle='#2a9e68';ctx.fillRect(x-.25,8,.5,128);
      }
      const cursor=selectedIndex>=0?selectedIndex:hoverIndex;
      if(legal.has(cursor)){
        const x=8+(cursor%N)*16,y=8+Math.floor(cursor/N)*16;
        ctx.fillStyle='#9affcd';
        for(const [dx,dy,sx,sy] of [[-7,-7,1,4],[-7,-7,4,1],[6,-7,1,4],[3,-7,4,1],[-7,3,1,4],[-7,6,4,1],[6,3,1,4],[3,6,4,1]])ctx.fillRect(x+dx,y+dy,sx,sy);
      }
      for(let i=0;i<N*ROWS;i++)if(board[i]&&i!==flightIndex)drawStone(8+(i%N)*16,8+Math.floor(i/N)*16,board[i],
        (board[i]===HUMAN?greenFours:redFours).has(i),winningCells.has(i),i===lastComMove);
    }
    function noMoveOutcome(b=board){
      const humanPoints=wins(b,HUMAN).four.length,comPoints=wins(b,COM).four.length;
      return humanPoints>comPoints?'win':comPoints>humanPoints?'loss':'draw';
    }
    function finishMatch(){
      ended=true;
      if(outcome!=='draw')tournament.battles.push({round:tournament.round,opponent,result:outcome});
      settleRound();
      if(!watchMode)recordResult();
      const expressionFile=outcome==='win'?opponent.loseFile:outcome==='loss'?opponent.winFile:null;
      const mask=outcome==='win'?opponent.loseMask:outcome==='loss'?opponent.winMask:opponent.normalMask;
      byId('opponent-eyes').hidden=!!expressionFile;
      byId('opponent-mouth').hidden=!!expressionFile;
      byId('opponent-expression').hidden=!expressionFile;
      if(expressionFile)byId('opponent-expression').src='characters/'+expressionFile;
      byId('opponent-tear').hidden=!(outcome==='win'&&opponent.profile.tearful);
      drawScanlines(mask,'opponent-scanlines');
      if(watchMode){
        const expression=outcome==='win'?watchLeft.winFile:outcome==='loss'?watchLeft.loseFile:null;
        const leftMask=outcome==='win'?watchLeft.winMask:outcome==='loss'?watchLeft.loseMask:watchLeft.normalMask;
        byId('watch-left-eyes').hidden=!!expression;byId('watch-left-mouth').hidden=!!expression;
        byId('watch-left-expression').hidden=!expression;
        if(expression)byId('watch-left-expression').src='characters/'+expression;
        byId('watch-left-tear').hidden=!(outcome==='loss'&&watchLeft.profile.tearful);
        drawScanlines(leftMask,'watch-left-scanlines');
      }
      setPlayerExpression(outcome==='win'?'win':outcome==='loss'?'lose':'normal');
      if(outcome==='win'&&!watchMode&&!tournament.random&&tournament.bracket.length===2)audio.setMusic('victory');
      maybeSay(resultLine(outcome),1,true);
      if(watchMode){ const token=matchToken, leftResult=outcome==='win'?'loss':outcome==='loss'?'win':'draw'; setTimeout(()=>{if(token===matchToken&&ended&&watchMode) maybeSay(lineFor(watchLeft,()=>resultLine(leftResult,HUMAN)),1,true,watchLeft);},1400); }
      render();
      if(outcome==='win'||outcome==='loss')showVictoryEffect();
      if(watchMode)scheduleRecap();else{byId('continue-overlay').hidden=false;byId('back').hidden=true;}
    }
    function play(i,player){
      if(introActive||ended||flightIndex>=0||board[i]||!legalMoves(board).includes(i))return false;
      board[i]=player;const flying=launchStoneFlight(i,player);if(player===COM){lastComMove=i;if(!flying)flashComMove(i);}selectedIndex=-1;hoverIndex=-1;
      const result=wins(board,player);
      if(result.won){outcome=player===HUMAN?'win':'loss';winningCells=new Set((result.five[0]||result.four[0]).concat(result.four.flat()));}
      else if(!legalMoves(board).length){endedByScore=true;outcome=noMoveOutcome();}
      else turn=player===HUMAN?COM:HUMAN;
      if(outcome)finishMatch();else render();
      return true;
    }
    function render(){
      const legal=!watchMode&&!introActive&&!ended&&flightIndex<0&&turn===HUMAN&&!thinking?new Set(legalMoves(board)):new Set();
      for(let i=0;i<cells.length;i++){
        const cell=cells[i],owner=board[i];cell.className='cell'+(legal.has(i)?' legal':'');
        cell.disabled=!legal.has(i);
        cell.setAttribute('aria-label',`Row ${Math.floor(i/N)+1}, column ${i%N+1}: ${owner===HUMAN?'green crystal':owner===COM?'red crystal':legal.has(i)?'open':'unavailable'}`);
      }
      const hs=wins(board,HUMAN),cs=wins(board,COM);
      drawBoard(legal,hs,cs);
      byId('human-score').textContent=hs.four.length;byId('com-score').textContent=cs.four.length;
      byId('human-card').classList.toggle('active',!ended&&turn===HUMAN);
      byId('score-player-name').className='score-you'+(!ended&&turn===HUMAN?' name-turn':'');
      byId('score-opponent-name').className=!ended&&turn===COM?'name-turn':'';
      byId('place').hidden=!tournament||ended||watchMode;
      byId('place').disabled=!requiresPlace||!legal.has(selectedIndex);
      const result=byId('result');
      result.hidden=!ended;
      result.disabled=watchMode||flightIndex>=0;
      byId('match-actions').hidden=!ended;
      if(ended){
        const decisive=outcome==='win'?hs:cs;
        const reason=endedByScore?(outcome==='draw'?'EQUAL POINTS':'MORE POINTS'):decisive.five.length?'FIVE IN A ROW':'THREE LINES OF FOUR';
        const leftName=watchMode?watchLeft.name:playerName();
        const champion=outcome==='win'&&!tournament.random&&tournament.bracket.length===2;
        const status=champion?'CHAMPION':outcome==='win'?leftName+' WIN':outcome==='loss'?leftName+' LOSE':'DRAW';
        result.textContent=status+(watchMode?'':' · TAP TO CONTINUE');
        result.setAttribute('aria-label',status+' · '+reason+(watchMode?'':' · tap to continue'));
        byId('next-match').textContent=tournament.random?(outcome==='draw'?'REPLAY MATCH':'NEW MATCH'):outcome==='win'?'NEXT MATCH':outcome==='loss'?'TRY AGAIN':'REPLAY MATCH';
        if(champion||outcome==='loss'&&!tournament.random)byId('next-match').textContent='PLAY AGAIN';
        byId('next-match').hidden=champion&&!watchMode;
      }
    }
    function scheduleCom(){
      thinking=true;
      const deliberate=Math.random()<.28;
      const wait=deliberate?1100+settings.depth*300+Math.floor(Math.random()*600):260+Math.floor(Math.random()*320);
      maybeSay(thinkingLine(),deliberate?.5:.2);
      byId('thinking').hidden=false;
      render();
      const token=matchToken;
      const respond=()=>{
        if(token!==matchToken||ended||turn!==COM)return;
        if(flightIndex>=0){setTimeout(respond,80);return;} if(!byId('leave-confirm').hidden){setTimeout(respond,200);return;}
        const i=chooseComMove();thinking=false;byId('thinking').hidden=true;
        if(i>=0){play(i,COM);if(!ended)maybeSay(moveLine(),.35);if(watchMode&&!ended&&turn===HUMAN)scheduleWatchMove();}
        else{thinking=false;byId('thinking').hidden=true;endedByScore=true;outcome=noMoveOutcome();finishMatch();}
      };
      setTimeout(respond,wait*(watchMode?3:1));
    }
    function scheduleWatchMove(){
      const token=matchToken;
      byId('watch-thinking').hidden=false;
      if(watchLeftHasSpoken)maybeSay(lineFor(watchLeft,()=>thinkingLine(HUMAN)),.25,false,watchLeft);
      setTimeout(()=>{
        if(token!==matchToken||!watchMode||ended||turn!==HUMAN)return;
        const move=chooseWatchMove();
        byId('watch-thinking').hidden=true;
        if(move>=0){
          play(move,HUMAN);
          if(!ended){
            maybeSay(lineFor(watchLeft,()=>moveLine(HUMAN)),.65,!watchLeftHasSpoken,watchLeft);
            watchLeftHasSpoken=true;
            if(turn===COM)setTimeout(()=>{if(token===matchToken&&!ended&&turn===COM)scheduleCom();},1400);
          }
        }else{endedByScore=true;outcome=noMoveOutcome();finishMatch();}
      },(650+Math.floor(Math.random()*500))*3);
    }
    function boardIndexFromPointer(event,fallback){
      if(!event||typeof event.clientX!=='number'||typeof event.clientY!=='number'||!boardEl.getBoundingClientRect)return fallback;
      const bounds=boardEl.getBoundingClientRect();
      if(!bounds.width||!bounds.height)return fallback;
      const col=Math.floor((event.clientX-bounds.left)*N/bounds.width);
      const row=Math.floor((event.clientY-bounds.top)*ROWS/bounds.height);
      return row>=0&&row<ROWS&&col>=0&&col<N?row*N+col:-1;
    }
    for(let i=0;i<N*ROWS;i++){
      const button=document.createElement('button');button.type='button';button.className='cell';button.setAttribute('role','gridcell');
      button.addEventListener('click',event=>{
        const index=boardIndexFromPointer(event,i);
        if(watchMode||introActive||turn!==HUMAN||thinking||ended||!legalMoves(board).includes(index))return;
        if(requiresPlace){selectedIndex=index;render();}
        else if(play(index,HUMAN)&&!ended)scheduleCom();
      });
      button.addEventListener('mouseenter',event=>{hoverIndex=boardIndexFromPointer(event,i);render();});
      button.addEventListener('mousemove',event=>{
        const index=boardIndexFromPointer(event,i);
        if(index!==hoverIndex){hoverIndex=index;render();}
      });
      button.addEventListener('mouseleave',()=>{hoverIndex=-1;render();});
      button.addEventListener('focus',()=>{hoverIndex=i;render();});
      button.addEventListener('blur',()=>{hoverIndex=-1;render();});
      boardEl.append(button);cells.push(button);
    }
    boardEl.append(comFlash);
    byId('place').addEventListener('click',()=>{
      if(watchMode||introActive||!requiresPlace||selectedIndex<0||turn!==HUMAN||thinking||ended)return;
      const i=selectedIndex;
      if(play(i,HUMAN)&&!ended)scheduleCom();
    });
    for(const type of tournamentTypes){
      const button=document.createElement('button');button.type='button';button.className='tournament-choice '+type.key;
      const leftTrophy=document.createElement('img');leftTrophy.className='choice-trophy';leftTrophy.src='trophy.svg';leftTrophy.alt='';
      const title=document.createElement('strong');title.textContent=type.label+' TOURNAMENT';
      const rightTrophy=document.createElement('img');rightTrophy.className='choice-trophy';rightTrophy.src='trophy.svg';rightTrophy.alt='';
      button.append(leftTrophy,title,rightTrophy);
      button.addEventListener('click',()=>startTournament(type.size));
      byId('tournament-list').append(button);
    }
    byId('random-match').addEventListener('click',()=>{watchMode=false;startRandomMatch();});
    byId('watch-button').addEventListener('click',startWatchMode);
    byId('editor-button').addEventListener('click',()=>{
      byId('menu').hidden=true;byId('editor-view').hidden=false;renderPlayer();
    });
    byId('editor-back').addEventListener('click',()=>{
      byId('editor-view').hidden=true;byId('menu').hidden=false;
    });
    byId('back').addEventListener('click',requestMenu);
    byId('leave-no').addEventListener('click',()=>{byId('leave-confirm').hidden=true;});
    byId('leave-yes').addEventListener('click',showMenu);
    byId('menu-after').addEventListener('click',showMenu);
    byId('history-button').addEventListener('click',()=>{
      renderHistory();byId('menu').hidden=true;byId('history-view').hidden=false;
    });
    byId('history-open').addEventListener('click',()=>{
      renderHistoryLog();byId('history-view').hidden=true;byId('history-log-view').hidden=false;
    });
    byId('history-log-back').addEventListener('click',()=>{
      byId('history-log-view').hidden=true;byId('history-view').hidden=false;renderHistory();
    });
    byId('history-back').addEventListener('click',()=>{
      byId('history-view').hidden=true;byId('menu').hidden=false;renderDailyHeader();
    });
    function continueMatchResult(){
      if(!ended||watchMode||!tournament)return;
      if(flightIndex>=0){clearStoneFlight();render();}
      showRecap();
    }
    byId('result').addEventListener('click',continueMatchResult);
    byId('continue-overlay').addEventListener('click',continueMatchResult);
    byId('next-match').addEventListener('click',()=>{
      if(!tournament||!ended)return;
      if(tournament.random){if(outcome==='draw')startMatch();else startRandomMatch();return;}
      if(outcome==='win'){
        if(tournament.bracket.length===2)startTournament(tournament.type.size);
        else advanceTournament();
      }else if(outcome==='loss')startTournament(tournament.type.size);
      else startMatch();
    });
    const presets={rookie:{depth:1,mistake:35,trick:10},balanced:{depth:2,mistake:10,trick:30},expert:{depth:3,mistake:0,trick:75}};
    initPlayerEditor();
    drawTitleCrystals();
    renderPlayer();
    showMenu();
    if(typeof window.addEventListener==='function')window.addEventListener('resize',()=>{
      if(!byId('tournament-recap').hidden)centerBracket();
    });
    if(typeof window.setInterval==='function'){
      let visibleDay=localDate();
      window.setInterval(()=>{
        const day=localDate();
        if(day===visibleDay)return;
        visibleDay=day;renderDailyHeader();
        if(!byId('history-view').hidden)renderHistory();
      },30000);
    }
    window.GravityFour={legalMoves,wins,evaluate,settings,presets,startTournament,
      getTournament:()=>tournament&&{size:tournament.type.size,round:tournament.round,day:tournament.day,cup:tournament.cup,opponent:opponent.name,
        playerIndex:tournament.bracket.indexOf(null),firstPlayer:tournament.bracket.indexOf(null)%2===0?'player':'opponent',
        entrants:tournament.bracket.filter(Boolean).map(character=>character.name),
        ranks:tournament.bracket.filter(Boolean).map(character=>character.profile.rank),
        levels:tournament.bracket.filter(Boolean).map(character=>character.profile.level)},
      getBoard:()=>board.slice()};
  })();
