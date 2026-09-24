  (() => {
    'use strict';
    const N=10, HUMAN=1, COM=2, EMPTY=0;
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
    let comFlashAnimation=null;
    const requiresPlace=typeof window.matchMedia==='function'&&window.matchMedia('(hover: none), (pointer: coarse)').matches;
    const cells=[];const directions=[[0,1],[1,0],[1,1],[1,-1]];
    const windows=[];
    for(let r=0;r<N;r++)for(let c=0;c<N;c++)for(const [dr,dc] of directions){
      for(const length of [4,5]){
        const endR=r+dr*(length-1),endC=c+dc*(length-1);
        if(endR<0||endR>=N||endC<0||endC>=N)continue;
        const indices=Array.from({length},(_,k)=>(r+dr*k)*N+c+dc*k);
        windows.push({indices,length,dr,dc,r,c});
      }
    }
    let board=new Uint8Array(N*N),turn=HUMAN,ended=false,winningCells=new Set(),thinking=false,hoverIndex=-1,selectedIndex=-1,lastComMove=-1;
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
    const utcDate=()=>new Date().toISOString().slice(0,10);
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
      {key:'beginner',label:'BEGINNER',size:8,beginner:7,regular:0,champion:0},
      {key:'regular',label:'REGULAR',size:16,beginner:7,regular:8,champion:0},
      {key:'champion',label:'CHAMPION',size:32,beginner:7,regular:8,champion:16}
    ];
    const settings={depth:2,mistake:10,trick:30,attack:50,defense:50,edgeExplore:50,ride:50,unusual:50,center:50,consistency:80};
    let tournament=null,opponent=null,outcome=null,matchToken=0,pendingWinners=null,introActive=false;
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
        tint.data[offset+3]=49;
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
    function selectRank(rank,count,seed){
      const pool=roster.filter(character=>character.profile.rank===rank);
      if(pool.length<count)throw new Error('Character roster is incomplete: '+rank);
      return shuffle(pool,seed+'|'+rank).slice(0,count);
    }
    function renderDailyHeader(){
      const day=utcDate(),details=dayDetails(day);
      byId('daily-cup-title').textContent=details[0];
      byId('daily-cup-date').textContent=day+' UTC · '+details[1];
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
      const day=utcDate(),details=dayDetails(day);
      byId('history-cup').textContent=details[0];
      byId('history-date').textContent=day+' UTC · '+details[1];
      const list=byId('history-list');list.replaceChildren();
      for(const type of tournamentTypes){
        const card=document.createElement('article');card.className='record-card';
        const title=document.createElement('h3');title.textContent=type.label+' TOURNAMENT';card.append(title);
        for(const [label,value] of [
          ['TODAY',rankText(records.days[day]?.[type.size])],
          ['CAREER',rankText(records.best[type.size])],
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
    function startTournament(size){
      audio.unlock();
      const type=tournamentTypes.find(item=>item.size===size);
      if(!type)throw new Error('Unknown tournament size: '+size);
      const day=utcDate(),details=dayDetails(day),seed=day+'|'+size;
      const bracket=[...selectRank('beginner',type.beginner,seed),...selectRank('regular',type.regular,seed),...selectRank('champion',type.champion,seed)];
      bracket.splice(hash32(seed+'|player')%size,0,null);
      tournament={type,day,cup:details[0],round:0,bracket,history:[bracket],battles:[]};
      byId('menu').hidden=true;byId('stage').hidden=false;
      startMatch();
    }
    function startRandomMatch(){
      audio.unlock();
      const challenger=roster[Math.floor(Math.random()*roster.length)];
      const bracket=[null,challenger];
      tournament={type:{key:'random',label:'RANDOM MATCH',size:2},random:true,
        day:utcDate(),cup:'RANDOM MATCH',round:0,bracket,history:[bracket],battles:[]};
      byId('menu').hidden=true;byId('stage').hidden=false;
      startMatch();
    }
    function startMatch(){
      matchToken++;introActive=true;
      board=new Uint8Array(N*N);turn=tournament.bracket.indexOf(null)%2===0?HUMAN:COM;ended=false;thinking=false;
      setPlayerExpression('normal');
      winningCells=new Set();hoverIndex=-1;selectedIndex=-1;lastComMove=-1;outcome=null;pendingWinners=null;tournament.revealRounds=null;
      comFlashAnimation?.cancel();comFlashAnimation=null;
      byId('victory-effect').hidden=true;
      byId('board-frame').className='board-frame';
      byId('tournament-recap').hidden=true;
      byId('thinking').hidden=true;
      opponent=tournament.bracket[tournament.bracket.indexOf(null)^1];
      Object.assign(settings,opponent.profile);
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
      byId('match-progress').textContent=tournament.random?'RANDOM MATCH':tournament.cup+' · '+tournament.type.label+' · ROUND '+(tournament.round+1)+' / '+Math.log2(tournament.type.size);
      byId('speech').hidden=true;
      const round=tournament.round,token=matchToken;
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
        showTurnBanner(turn);
        render();
        if(turn===COM)scheduleCom();
      },Math.max(1700,duration+350));
    }
    function simulatedWinner(first,second,index,round=tournament.round){
      const chance=1/(1+Math.exp((second.profile.strength-first.profile.strength)/12));
      return seededRandom(tournament.day+'|'+tournament.type.size+'|'+round+'|'+index+'|'+first.id+'|'+second.id)()<chance?first:second;
    }
    function settleRound(){
      if(outcome==='draw'||tournament.random)return;
      const previous=tournament.bracket;
      const playerPair=tournament.bracket.indexOf(null)&~1;
      pendingWinners=[];
      for(let i=0;i<previous.length;i+=2)
        pendingWinners.push(i===playerPair?(outcome==='win'?null:opponent):simulatedWinner(previous[i],previous[i+1],i));
      tournament.revealRounds=[pendingWinners];
      if(outcome==='loss'){
        let entrants=pendingWinners;
        for(let round=tournament.round+1;entrants.length>1;round++){
          const winners=[];
          for(let i=0;i<entrants.length;i+=2)
            winners.push(simulatedWinner(entrants[i],entrants[i+1],i,round));
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
      startMatch();
    }
    function showMenu(){
      matchToken++;tournament=null;opponent=null;outcome=null;pendingWinners=null;thinking=false;introActive=false;
      audio.stop();byId('round-intro').hidden=true;
      byId('stage').hidden=true;byId('menu').hidden=false;byId('place').hidden=true;
      byId('tournament-recap').hidden=true;byId('thinking').hidden=true;byId('victory-effect').hidden=true;
      byId('leave-confirm').hidden=true;
      byId('history-view').hidden=true;byId('history-log-view').hidden=true;byId('editor-view').hidden=true;renderDailyHeader();
    }
    function requestMenu(){
      if(tournament&&!tournament.random&&!ended)byId('leave-confirm').hidden=false;
      else showMenu();
    }
    function showTurnBanner(playerToMove){
      const banner=byId('turn-banner');
      banner.textContent=playerToMove===HUMAN?playerName():opponent.name;
      banner.className='turn-banner';
      void banner.offsetWidth;
      banner.className='turn-banner showing';
    }
    function maybeSay(message,frequency,force=false){
      const bubble=byId('speech');
      if(!force&&Math.random()*100>=settings.talkativeness*frequency){
        bubble.hidden=true;bubble.textContent='';return;
      }
      bubble.hidden=false;
      const line=settings.voice==='quirky'&&message.endsWith('。')
        &&!/(ダヨ|ッス|デスゾ|……)\。$/.test(message)
        ?message.slice(0,-1)+(opponent.id%2?'ッス。':'ダヨ。')
        :message;
      bubble.textContent=line.replace(/[。、]/g,' ').replace(/\s+/g,' ').trim();
      bubble.className='speech';
      void bubble.offsetWidth;
      bubble.className='speech flash';
      audio.speak(bubble.textContent,'character',opponent.id);
    }
    const chooseLine=lines=>lines[Math.floor(Math.random()*lines.length)];
    function openingLine(){
      if(settings.voice==='quirky')return chooseLine(['ヨロシクデスゾ。','オテヤワラカニダヨ。','ヨロシクッス！']);
      if(settings.voice==='polite')return chooseLine(['ヨロシクオネガイシマス。','オテヤワラカニ。','イイショウブヲ。']);
      if(settings.personality==='teasing')return chooseLine(['コンチワ。マケナイデネ？','ヨロシク。タノシマセテヨ。','ウィッス。ココカラダヨ。']);
      if(settings.personality==='friendly')return chooseLine(['コンチワ！ヨロシクネ。','ヨロシク！タノシモウ。','オテヤワラカニネ。']);
      if(settings.personality==='reserved')return chooseLine(['ヨロシク。','……ヨロシク。']);
      return chooseLine(['ヨロシク。','コンチワ。','ウィッス。','オテヤワラカニ。']);
    }
    function thinkingLine(){
      const lines=['ウーン……','エット……','フム……','ンー、ドウシヨウ。','♪ フフン、フーン ♪','ナルホド……'];
      if(settings.depth===3)lines.push('モウスコシヨム……','ソウキタカ……');
      if(settings.trick>70)lines.push('アノテデイクカ……','フフ、ミエタ。');
      if(settings.personality==='teasing')lines.push('ドコニオコウカナ？');
      if(settings.personality==='reserved')lines.push('……。');
      return chooseLine(lines);
    }
    function moveLine(){
      const lines=['ココダ。','フム。','ヨシッ。','アッ、コッチカ。','♪ フフフーン ♪','ナルホド……'];
      if(settings.personality==='teasing')lines.push('オヤ？ソコデイイノ？','フフッ、ドウスル？','マダマダダネ。');
      if(settings.personality==='friendly')lines.push('イイテダネ！','イッショニタノシモウ。','オオ、ヤルネ！');
      if(settings.personality==='thoughtful')lines.push('コノサキハ……','ヨミドオリ。');
      if(settings.ride>75)lines.push('ソノコマ、カリルヨ。');
      if(settings.unusual>75)lines.push('コレハドウ？','ヘンナテモイイヨネ。');
      if(settings.expressiveness>65)lines.push('オッ！','ウッ……','アハハ！');
      return chooseLine(lines);
    }
    function resultLine(result){
      if(result==='win')return chooseLine(settings.personality==='teasing'
        ?['ウッ、ヤラレタ……','ヤルネ……ツギハマケナイヨ。']
        :settings.personality==='friendly'
          ?['オメデトウ！ツヨイネ。','マケチャッタ。イイショウブ！']
          :['ウッ……ツヨイ。','ナルホド……ヤラレタ。']);
      if(result==='loss')return chooseLine(settings.personality==='teasing'
        ?['フフ、コノショウブハモラッタヨ。','ドウ？オドロイタ？']
        :settings.personality==='friendly'
          ?['アリガトウ！タノシカッタ。','イイショウブダッタネ！']
          :['ヨシッ、カッタ。','フウ……ヤッタ。']);
      return chooseLine(['ヒキワケカ。','アララ、オアイコ。','ウーン……モウイッカイ。']);
    }
    function bracketPosition(size,level,index){
      const cardWidth=116,step=145,slot=38,margin=14,top=32,gap=45;
      const roundCount=Math.log2(size);
      if(size<16)return {x:margin+level*step,y:top+(index+.5)*2**level*slot};
      const depth=roundCount-1;
      const width=2*(margin+depth*step+cardWidth+gap)+cardWidth;
      if(level===roundCount)return {x:(width-cardWidth)/2,y:top+(size/2)*slot/2};
      const sideCount=size/2**(level+1),right=index>=sideCount;
      return {x:right?width-margin-cardWidth-level*step:margin+level*step,
        y:top+((index%sideCount)+.5)*2**level*slot};
    }
    function appendBracketFace(entry,character){
      if(character&&character!=='TBD'){
        const portrait=document.createElement('span');portrait.className='bracket-portrait';
        for(const file of ['characters/'+character.file,
          'characters/player-parts/'+character.eyes+'.png',
          'characters/player-parts/'+character.mouth+'.png']){
          const image=document.createElement('img');image.src=file;image.alt='';portrait.append(image);
        }
        entry.append(portrait);
      }
      const label=document.createElement('span');label.textContent=character===null?playerName():character==='TBD'?'—':character.name;
      entry.append(label);
    }
    function renderBattleHistory(){
      const list=byId('recap-battles');list.replaceChildren();
      list.hidden=tournament.random||!tournament.battles.length;
      if(list.hidden)return;
      const heading=document.createElement('strong');heading.className='recap-battles-heading';heading.textContent='YOUR MATCHES';
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
    function renderBracket(revealedCount=tournament.revealRounds?.length||0){
      const container=byId('bracket-rounds');
      byId('bracket-crowning').hidden=true;
      renderBattleHistory();
      if(tournament.random){
        container.replaceChildren();
        byId('recap-title').textContent=outcome==='win'?'VICTORY':outcome==='loss'?'ELIMINATED':'DRAW';
        byId('recap-subtitle').textContent=outcome==='draw'?'REPLAY THE MATCH':'RANDOM MATCH COMPLETE';
        return;
      }
      const size=tournament.type.size,roundCount=Math.log2(size),twoSided=size>=16;
      const rounds=tournament.history.concat((tournament.revealRounds||[]).slice(0,revealedCount));
      const filledRounds=rounds.length;
      while(rounds.length<=roundCount)rounds.push(Array(rounds[rounds.length-1].length/2).fill('TBD'));
      const cardWidth=116,cardHeight=30,step=145,slot=38,margin=14,top=32,gap=45;
      const depth=roundCount-1,sideHeight=(size/2)*slot;
      const width=twoSided?2*(margin+depth*step+cardWidth+gap)+cardWidth:margin*2+roundCount*step+cardWidth;
      const height=top+(twoSided?sideHeight:size*slot)+18;
      const canvas=document.createElement('div');
      canvas.className='bracket-canvas '+(twoSided?'two-sided':'single-sided');
      canvas.setAttribute('style',`width:${width}px;height:${height}px`);
      function line(x1,y1,x2,y2,active,delay){
        const segment=document.createElement('div');
        segment.className='bracket-line'+(active?' active':'')+(active&&Math.floor(delay/170)===filledRounds-2?' fresh':'');
        segment.setAttribute('style',`left:${Math.min(x1,x2)}px;top:${Math.min(y1,y2)}px;width:${Math.max(2,Math.abs(x2-x1))}px;height:${Math.max(2,Math.abs(y2-y1))}px;--delay:${delay}ms`);
        canvas.append(segment);
      }
      function heading(label,x){
        const title=document.createElement('div');title.className='bracket-heading';title.textContent=label;
        title.setAttribute('style',`left:${x}px;top:2px;width:${cardWidth}px`);canvas.append(title);
      }
      function card(character,x,y,roundIndex,index){
        const entry=document.createElement('div');
        entry.className='bracket-entry'+(character===null?' you':'')+(character==='TBD'?' pending':'')
          +(revealedCount>0&&roundIndex===filledRounds-1?' winner promoted':'')
          +(roundIndex===roundCount&&character!=='TBD'?' champion':'')
          +(outcome==='loss'&&roundIndex===tournament.round&&index===tournament.bracket.indexOf(null)?' out':'');
        entry.setAttribute('style',`left:${x}px;top:${y-cardHeight/2}px;width:${cardWidth}px;height:${cardHeight}px;--delay:${roundIndex*170+Math.min(index,16)*16}ms`);
        appendBracketFace(entry,character);canvas.append(entry);
      }
      function connectPair(childX,parentX,y1,y2,parentY,fromRight,active,delay){
        const childEdge=fromRight?childX:childX+cardWidth;
        const parentEdge=fromRight?parentX+cardWidth:parentX;
        const middle=(childEdge+parentEdge)/2;
        line(childEdge,y1,middle,y1,active,delay);
        line(childEdge,y2,middle,y2,active,delay);
        line(middle,y1,middle,y2,active,delay+45);
        line(middle,parentY,parentEdge,parentY,active,delay+90);
      }
      if(twoSided){
        for(let level=0;level<=depth;level++){
          const count=size/(2**(level+1));
          const leftX=margin+level*step,rightX=width-margin-cardWidth-level*step;
          heading('ROUND '+(level+1),leftX);heading('ROUND '+(level+1),rightX);
          for(let index=0;index<count;index++){
            const y=top+(index+.5)*2**level*slot;
            card(rounds[level][index],leftX,y,level,index);
            card(rounds[level][count+index],rightX,y,level,count+index);
          }
          if(level<depth){
            const nextLeft=margin+(level+1)*step,nextRight=width-margin-cardWidth-(level+1)*step;
            for(let pair=0;pair<count/2;pair++){
              const y1=top+(pair*2+.5)*2**level*slot,y2=top+(pair*2+1.5)*2**level*slot;
              const parentY=top+(pair+.5)*2**(level+1)*slot;
              const active=level<filledRounds-1;
              connectPair(leftX,nextLeft,y1,y2,parentY,false,active,level*170);
              connectPair(rightX,nextRight,y1,y2,parentY,true,active,level*170);
            }
          }
        }
        const centerX=(width-cardWidth)/2,centerY=top+sideHeight/2;
        heading('CHAMPION',centerX);
        card(rounds[roundCount][0],centerX,centerY,roundCount,0);
        const leftX=margin+depth*step,rightX=width-margin-cardWidth-depth*step;
        const active=depth<filledRounds-1;
        line(leftX+cardWidth,centerY,centerX,centerY,active,depth*170);
        line(rightX,centerY,centerX+cardWidth,centerY,active,depth*170);
      }else{
        for(let level=0;level<=roundCount;level++){
          const x=margin+level*step,count=size/2**level;
          heading(level===roundCount?'CHAMPION':'ROUND '+(level+1),x);
          for(let index=0;index<count;index++)card(rounds[level][index],x,top+(index+.5)*2**level*slot,level,index);
          if(level===roundCount)continue;
          for(let pair=0;pair<count/2;pair++){
            const y1=top+(pair*2+.5)*2**level*slot,y2=top+(pair*2+1.5)*2**level*slot;
            const parentY=top+(pair+.5)*2**(level+1)*slot;
            connectPair(x,x+step,y1,y2,parentY,false,level<filledRounds-1,level*170);
          }
        }
      }
      container.replaceChildren(canvas);
      if(twoSided)container.scrollLeft=Math.max(0,(width-(container.clientWidth||width))/2);
      byId('recap-title').textContent=outcome==='win'
        ?(tournament.bracket.length===2?'CHAMPION':'ROUND CLEARED')
        :outcome==='loss'?'ELIMINATED':'DRAW';
      byId('recap-subtitle').textContent=outcome==='draw'
        ?'THE MATCH WILL BE REPLAYED'
        :outcome==='win'&&tournament.bracket.length===2?playerName()+' WON THE TOURNAMENT'
        :outcome==='win'?'ADVANCING TO ROUND '+(tournament.round+2)
        :filledRounds===roundCount+1?rounds[roundCount][0].name+' WINS THE CUP'
        :'THE BRACKET CONTINUES WITHOUT YOU';
      if(outcome==='loss'&&filledRounds===roundCount+1){
        const champion=rounds[roundCount][0];
        byId('bracket-crowning-name').textContent=champion.name+' CHAMPION';
        byId('bracket-champion-face').src='characters/'+champion.file;
        byId('bracket-champion-expression').src='characters/'+champion.winFile;
        drawScanlines(champion.winMask,'bracket-champion-scanlines');
        const confetti=byId('bracket-confetti');confetti.replaceChildren();
        for(let n=0;n<48;n++){
          const piece=document.createElement('i');piece.className='bracket-confetti-piece';
          const left=n%2===0,flight=Math.round(15+Math.random()*78);
          piece.setAttribute('style',`--x:${left?0:100}%;--y:${Math.round(20+Math.random()*55)}%;--flight-x:${left?flight:-flight}vw;--flight-y:${Math.round(-70+Math.random()*130)}px;--spin:${Math.round(360+Math.random()*700)}deg;--delay:${Math.round(Math.random()*900)}ms;--hue:${n%3===0?48:n%3===1?145:355}`);
          confetti.append(piece);
        }
        byId('bracket-crowning').hidden=false;
      }
    }
    function animateBracketReveal(step,token){
      if(token!==matchToken||!tournament||byId('tournament-recap').hidden)return;
      renderBracket(step-1);
      const canvas=byId('bracket-rounds').children[0];
      const size=tournament.type.size,level=tournament.history.length+step-1;
      const previous=tournament.history.concat(tournament.revealRounds.slice(0,step-1))[level-1];
      const winners=tournament.revealRounds[step-1];
      const stagger=110,duration=1900,cardWidth=116,cardHeight=30;
      for(let index=0;index<winners.length;index++){
        const winner=winners[index];
        let sourceIndex;
        if(size>=16&&level===Math.log2(size))sourceIndex=previous[0]===winner?0:1;
        else if(size>=16){
          const half=winners.length/2,sourceHalf=half*2;
          const side=index>=half?1:0,base=side*sourceHalf+(index-side*half)*2;
          sourceIndex=previous[base]===winner?base:base+1;
        }else{
          const base=index*2;sourceIndex=previous[base]===winner?base:base+1;
        }
        const from=bracketPosition(size,level-1,sourceIndex),to=bracketPosition(size,level,index);
        const fromRight=size>=16&&level<Math.log2(size)&&index>=winners.length/2;
        const childEdge=fromRight?from.x:from.x+cardWidth;
        const parentEdge=fromRight?to.x+cardWidth:to.x;
        const cornerX=level===Math.log2(size)&&size>=16?to.x-from.x:(childEdge+parentEdge)/2-from.x-cardWidth/2;
        const ghost=document.createElement('div');ghost.className='bracket-entry bracket-traveler';
        ghost.setAttribute('style',`left:${from.x}px;top:${from.y-cardHeight/2}px;width:${cardWidth}px;height:${cardHeight}px;--corner-x:${cornerX}px;--travel-x:${to.x-from.x}px;--travel-y:${to.y-from.y}px;--travel-duration:${duration}ms;--delay:${index*stagger}ms`);
        appendBracketFace(ghost,winner);canvas.append(ghost);
      }
      setTimeout(()=>{
        if(token!==matchToken||!tournament||byId('tournament-recap').hidden)return;
        renderBracket(step);
        if(step<tournament.revealRounds.length)
          setTimeout(()=>animateBracketReveal(step+1,token),550);
        else byId('match-actions').hidden=false;
      },duration+(winners.length-1)*stagger+150);
    }
    function showVictoryEffect(){
      const champion=!tournament.random&&tournament.bracket.length===2;
      const effect=byId('victory-effect');
      effect.className='victory-effect '+(champion?'champion':'round-clear');
      byId('victory-opponent-face').src='characters/'+opponent.file;
      byId('victory-opponent-expression').src='characters/'+opponent.loseFile;
      byId('victory-opponent-tear').hidden=!opponent.profile.tearful;
      drawScanlines(opponent.loseMask,'victory-opponent-scanlines');
      byId('victory-opponent-line').textContent=byId('speech').textContent;
      byId('victory-kicker').textContent=champion?'TOURNAMENT COMPLETE':'MATCH WON';
      byId('victory-title').textContent=champion?'CHAMPION':'VICTORY';
      byId('victory-subtitle').textContent=champion?'THE CIRCUIT IS YOURS':'ADVANCING TO THE NEXT ROUND';
      const particles=byId('victory-particles');particles.replaceChildren();
      const count=champion?96:18;
      for(let n=0;n<count;n++){
        const spark=document.createElement('i');spark.className='victory-particle'+(champion?' side-confetti':'');
        const delay=Math.round(Math.random()*(champion?1250:950));
        const duration=Math.round((champion?2400:1200)+Math.random()*(champion?1700:1100));
        const hue=champion?(n%4===0?355:n%3===0?48:145):145;
        if(champion){
          const left=n%2===0,flight=Math.round(18+Math.random()*72);
          const y=Math.round(35+Math.random()*28),fall=Math.round(-30+Math.random()*82);
          spark.setAttribute('style',`--x:${left?0:100}%;--y:${y}%;--flight-x:${left?flight:-flight}vw;--flight-y:${fall}vh;--spin:${Math.round(360+Math.random()*850)}deg;--delay:${delay}ms;--duration:${duration}ms;--hue:${hue}`);
        }else{
          const x=Math.round(8+Math.random()*84),y=Math.round(40+Math.random()*55);
          const drift=Math.round((Math.random()-.5)*80),rise=Math.round(40+Math.random()*125);
          spark.setAttribute('style',`--x:${x}%;--y:${y}%;--drift:${drift}px;--rise:${rise}px;--delay:${delay}ms;--duration:${duration}ms;--hue:${hue}`);
        }
        particles.append(spark);
      }
      effect.hidden=false;
      byId('board-frame').className='board-frame win-flash';
    }
    function scheduleRecap(){
      const token=matchToken;
      const pause=outcome==='win'?(!tournament.random&&tournament.bracket.length===2?5200:2400):2400;
      setTimeout(()=>{
        if(token!==matchToken||!ended||!tournament)return;
        byId('victory-effect').hidden=true;
        byId('board-frame').className='board-frame';
        renderBracket(0);
        byId('tournament-recap').hidden=false;
        audio.setMusic('bracket');
        byId('match-actions').hidden=outcome==='loss'&&!!tournament.revealRounds;
        if(tournament.revealRounds)animateBracketReveal(1,token);
      },pause);
    }
    function styleBonus(i){
      const r=Math.floor(i/N),c=i%N;
      const edges=[r===0,r===N-1,c===0,c===N-1];
      const used=[false,false,false,false];
      for(let j=0;j<N*N;j++)if(board[j]===COM){
        const row=Math.floor(j/N),col=j%N;
        if(row===0)used[0]=true;if(row===N-1)used[1]=true;
        if(col===0)used[2]=true;if(col===N-1)used[3]=true;
      }
      const freshEdge=edges.some((edge,j)=>edge&&!used[j]);
      const neighbours=[[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
      const supportedByRival=neighbours.some(([row,col])=>row>=0&&row<N&&col>=0&&col<N&&board[row*N+col]===HUMAN);
      const turnCount=board.reduce((count,stone)=>count+(stone!==EMPTY),0);
      const variation=Math.sin((i+1)*12.9898+(turnCount+1)*78.233)*43758.5453;
      const noise=(variation-Math.floor(variation))-.5;
      return (freshEdge?settings.edgeExplore*.12:0)+(supportedByRival?settings.ride*.1:0)
        +(settings.unusual*.12)*(1-Math.min(1,positionValue(i)/9))
        +noise*(100-settings.consistency)*.22;
    }
    const byId=id=>document.getElementById(id);
    function legalMoves(b){
      const result=[];
      for(let r=0;r<N;r++)for(let c=0;c<N;c++){
        const i=r*N+c;if(b[i])continue;
        let ok=true;
        for(let x=c-1;x>=0;x--)if(!b[r*N+x]){ok=false;break;}
        if(!ok){ok=true;for(let x=c+1;x<N;x++)if(!b[r*N+x]){ok=false;break;}}
        if(!ok){ok=true;for(let y=r-1;y>=0;y--)if(!b[y*N+c]){ok=false;break;}}
        if(!ok){ok=true;for(let y=r+1;y<N;y++)if(!b[y*N+c]){ok=false;break;}}
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
        const before=beforeR>=0&&beforeR<N&&beforeC>=0&&beforeC<N&&b[beforeR*N+beforeC]===player;
        const after=afterR>=0&&afterR<N&&afterC>=0&&afterC<N&&b[afterR*N+afterC]===player;
        if(!before&&!after)four.push(w.indices);
      }
      return {four,five,won:five.length>0||four.length>=3};
    }
    function positionValue(i){const r=Math.floor(i/N),c=i%N;return (4.5-Math.abs(r-4.5))+(4.5-Math.abs(c-4.5));}
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
      for(let i=0;i<N*N;i++)if(b[i])score+=positionValue(i)*(b[i]===COM?1:-1)*settings.center*.009;
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
    const crystal=[
      '..ooooooo..','.ossssssso.','osmmmmmmhso','osmxxxxxhso',
      'osmxxxxxhso','osmxxxxxhso','osmxxxxxhso','osmxxxxxhso',
      'osmmmmmmhso','.ossssssso.','..ooooooo..'
    ];
    function flashComMove(i){
      flashCtx.clearRect(0,0,16,16);
      flashCtx.fillStyle='#f7ffff';
      for(let y=0;y<11;y++)for(let x=0;x<11;x++)
        if(crystal[y][x]!=='.')flashCtx.fillRect(x+3,y+3,1,1);
      comFlash.setAttribute('style',`position:absolute;z-index:3;width:10%;height:10%;left:${5+(i%N)*10}%;top:${5+Math.floor(i/N)*10}%;transform:translate(-50%,-50%);opacity:0;image-rendering:pixelated;pointer-events:none;filter:drop-shadow(0 0 7px #f7ffff)`);
      comFlashAnimation?.cancel();
      if(typeof comFlash.animate==='function')comFlashAnimation=comFlash.animate([
        {opacity:0},{opacity:.95,offset:.45},{opacity:.95,offset:.55},{opacity:0}
      ],{duration:900,iterations:2,easing:'ease-in-out'});
    }
    function drawStone(cx,cy,player,four,won,recent){
      const colors=player===HUMAN
        ?{o:'#0a5032',s:'#078457',m:'#18bf78',x:'#39ef9b',h:'#afffda'}
        :recent?{o:'#a83950',s:'#e55270',m:'#ff7891',x:'#ffabc0',h:'#fff0f3'}
          :{o:'#651729',s:'#a5253e',m:'#d93859',x:'#ff5a76',h:'#ffc0cb'};
      for(let y=0;y<11;y++)for(let x=0;x<11;x++){
        const pixel=crystal[y][x];if(pixel==='.')continue;
        ctx.fillStyle=colors[pixel];ctx.fillRect(cx+x-5,cy+y-5,1,1);
      }
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
    function drawBoard(legal,hs,cs){
      const greenFours=new Set(hs.four.flat()),redFours=new Set(cs.four.flat());
      ctx.clearRect(0,0,160,160);
      for(let n=0;n<N;n++){
        const p=8+n*16;
        ctx.fillStyle='#10432f';ctx.fillRect(8,p-.75,144,1.5);ctx.fillRect(p-.75,8,1.5,144);
        ctx.fillStyle='#218653';ctx.fillRect(8,p-.25,144,.5);ctx.fillRect(p-.25,8,.5,144);
      }
      const cursor=selectedIndex>=0?selectedIndex:hoverIndex;
      if(legal.has(cursor)){
        const x=8+(cursor%N)*16,y=8+Math.floor(cursor/N)*16;
        ctx.fillStyle='#9affcd';
        for(const [dx,dy,sx,sy] of [[-7,-7,1,4],[-7,-7,4,1],[6,-7,1,4],[3,-7,4,1],[-7,3,1,4],[-7,6,4,1],[6,3,1,4],[3,6,4,1]])ctx.fillRect(x+dx,y+dy,sx,sy);
      }
      for(let i=0;i<N*N;i++)if(board[i])drawStone(8+(i%N)*16,8+Math.floor(i/N)*16,board[i],
        (board[i]===HUMAN?greenFours:redFours).has(i),winningCells.has(i),i===lastComMove);
    }
    function play(i,player){
      if(introActive||ended||board[i]||!legalMoves(board).includes(i))return false;
      board[i]=player;if(player===COM){lastComMove=i;flashComMove(i);}selectedIndex=-1;hoverIndex=-1;
      const result=wins(board,player);
      if(result.won){ended=true;outcome=player===HUMAN?'win':'loss';winningCells=new Set((result.five[0]||result.four[0]).concat(result.four.flat()));}
      else if(!legalMoves(board).length){ended=true;outcome='draw';}
      else {turn=player===HUMAN?COM:HUMAN;showTurnBanner(turn);}
      if(ended){
        if(outcome!=='draw')tournament.battles.push({round:tournament.round,opponent,result:outcome});
        settleRound();
        recordResult();
        const expressionFile=outcome==='win'?opponent.loseFile:outcome==='loss'?opponent.winFile:null;
        const mask=outcome==='win'?opponent.loseMask:outcome==='loss'?opponent.winMask:opponent.normalMask;
        byId('opponent-eyes').hidden=!!expressionFile;
        byId('opponent-mouth').hidden=!!expressionFile;
        byId('opponent-expression').hidden=!expressionFile;
        if(expressionFile)byId('opponent-expression').src='characters/'+expressionFile;
        byId('opponent-tear').hidden=!(outcome==='win'&&opponent.profile.tearful);
        drawScanlines(mask,'opponent-scanlines');
        setPlayerExpression(outcome==='win'?'win':outcome==='loss'?'lose':'normal');
        maybeSay(resultLine(outcome),1,true);
      }
      render();
      if(ended){
        if(outcome==='win')showVictoryEffect();
        scheduleRecap();
      }
      return true;
    }
    function render(){
      const legal=!introActive&&!ended&&turn===HUMAN&&!thinking?new Set(legalMoves(board)):new Set();
      for(let i=0;i<cells.length;i++){
        const cell=cells[i],owner=board[i];cell.className='cell'+(legal.has(i)?' legal':'');
        cell.disabled=!legal.has(i);
        cell.setAttribute('aria-label',`Row ${Math.floor(i/N)+1}, column ${i%N+1}: ${owner===HUMAN?'green crystal':owner===COM?'red crystal':legal.has(i)?'open':'unavailable'}`);
      }
      const hs=wins(board,HUMAN),cs=wins(board,COM);
      drawBoard(legal,hs,cs);
      byId('human-score').textContent=hs.four.length;byId('com-score').textContent=cs.four.length;
      byId('human-card').classList.toggle('active',!ended&&turn===HUMAN);
      byId('place').hidden=!tournament||ended;
      byId('place').disabled=!requiresPlace||!legal.has(selectedIndex);
      const result=byId('result');
      result.hidden=!ended;
      byId('match-actions').hidden=!ended;
      if(ended){
        result.textContent=outcome==='win'?playerName()+' WIN':outcome==='loss'?playerName()+' LOSE':'DRAW';
        byId('next-match').textContent=tournament.random?(outcome==='draw'?'REPLAY MATCH':'NEW MATCH'):outcome==='win'?'NEXT MATCH':outcome==='loss'?'TRY AGAIN':'REPLAY MATCH';
        if(outcome==='win'&&!tournament.random&&tournament.bracket.length===2){result.textContent='TOURNAMENT CHAMPION';byId('next-match').textContent='PLAY AGAIN';}
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
        if(!byId('leave-confirm').hidden){setTimeout(respond,200);return;}
        const i=chooseComMove();thinking=false;byId('thinking').hidden=true;
        if(i>=0){play(i,COM);if(!ended)maybeSay(moveLine(),.35);}
        else{ended=true;outcome='draw';maybeSay(resultLine('draw'),1,true);render();scheduleRecap();}
      };
      setTimeout(respond,wait);
    }
    for(let i=0;i<N*N;i++){
      const button=document.createElement('button');button.type='button';button.className='cell';button.setAttribute('role','gridcell');
      button.addEventListener('click',()=>{
        if(introActive||turn!==HUMAN||thinking||ended||!legalMoves(board).includes(i))return;
        if(requiresPlace){selectedIndex=i;render();}
        else if(play(i,HUMAN)&&!ended)scheduleCom();
      });
      button.addEventListener('mouseenter',()=>{hoverIndex=i;render();});
      button.addEventListener('mouseleave',()=>{hoverIndex=-1;render();});
      button.addEventListener('focus',()=>{hoverIndex=i;render();});
      button.addEventListener('blur',()=>{hoverIndex=-1;render();});
      boardEl.append(button);cells.push(button);
    }
    boardEl.append(comFlash);
    byId('place').addEventListener('click',()=>{
      if(introActive||!requiresPlace||selectedIndex<0||turn!==HUMAN||thinking||ended)return;
      const i=selectedIndex;
      if(play(i,HUMAN)&&!ended)scheduleCom();
    });
    for(const type of tournamentTypes){
      const button=document.createElement('button');button.type='button';button.className='tournament-choice';
      const title=document.createElement('strong');title.textContent=type.label+' TOURNAMENT';
      button.append(title);
      button.addEventListener('click',()=>startTournament(type.size));
      byId('tournament-list').append(button);
    }
    byId('random-match').addEventListener('click',startRandomMatch);
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
    renderPlayer();
    showMenu();
    if(typeof window.setInterval==='function'){
      let visibleDay=utcDate();
      window.setInterval(()=>{
        const day=utcDate();
        if(day===visibleDay)return;
        visibleDay=day;renderDailyHeader();
        if(!byId('history-view').hidden)renderHistory();
      },30000);
    }
    window.GravityFour={legalMoves,wins,evaluate,settings,presets,startTournament,
      getTournament:()=>tournament&&{size:tournament.type.size,round:tournament.round,day:tournament.day,cup:tournament.cup,opponent:opponent.name,
        playerIndex:tournament.bracket.indexOf(null),firstPlayer:tournament.bracket.indexOf(null)%2===0?'player':'opponent',
        entrants:tournament.bracket.filter(Boolean).map(character=>character.name),
        ranks:tournament.bracket.filter(Boolean).map(character=>character.profile.rank)},
      getBoard:()=>board.slice()};
  })();
