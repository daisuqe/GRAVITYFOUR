  (() => {
    'use strict';
    const N=10, HUMAN=1, COM=2, EMPTY=0;
    const boardEl=document.getElementById('board');
    const art=document.getElementById('board-art');
    const ctx=art.getContext('2d');
    ctx.imageSmoothingEnabled=false;
    ctx.setTransform(2,0,0,2,0,0);
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
    const tournamentTypes=[
      {key:'beginner',label:'BEGINNER',size:8,beginner:7,regular:0,champion:0,description:'FIRST STEPS'},
      {key:'regular',label:'REGULAR',size:16,beginner:7,regular:8,champion:0,description:'A BIGGER CHALLENGE'},
      {key:'champion',label:'CHAMPION',size:32,beginner:7,regular:8,champion:16,description:'THE TOP HALF ARE EXPERTS'}
    ];
    const settings={depth:2,mistake:10,trick:30,attack:50,defense:50,edgeExplore:50,ride:50,unusual:50,center:50,consistency:80};
    let tournament=null,opponent=null,outcome=null,matchToken=0,pendingWinners=null;
    const shuffle=items=>{
      const result=items.slice();
      for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
      return result;
    };
    function selectRank(rank,count){
      const pool=roster.filter(character=>character.profile.rank===rank);
      if(pool.length<count)throw new Error('Character roster is incomplete: '+rank);
      return shuffle(pool).slice(0,count);
    }
    function startTournament(size){
      const type=tournamentTypes.find(item=>item.size===size);
      if(!type)throw new Error('Unknown tournament size: '+size);
      const bracket=[null,...selectRank('beginner',type.beginner),...selectRank('regular',type.regular),...selectRank('champion',type.champion)];
      tournament={type,round:0,bracket,history:[bracket]};
      byId('menu').hidden=true;byId('stage').hidden=false;
      startMatch();
    }
    function startMatch(){
      matchToken++;
      board=new Uint8Array(N*N);turn=HUMAN;ended=false;thinking=false;
      winningCells=new Set();hoverIndex=-1;selectedIndex=-1;lastComMove=-1;outcome=null;pendingWinners=null;
      byId('victory-effect').hidden=true;
      byId('board-frame').className='board-frame';
      byId('tournament-recap').hidden=true;
      byId('thinking').hidden=true;
      opponent=tournament.bracket[1];
      Object.assign(settings,opponent.profile);
      byId('score-opponent-name').textContent=opponent.name;
      byId('opponent-face').src='characters/'+opponent.file;
      byId('opponent-face').alt=opponent.name+' portrait';
      byId('match-progress').textContent=tournament.type.label+' · ROUND '+(tournament.round+1)+' / '+Math.log2(tournament.type.size);
      maybeSay(openingLine(),.7);
      render();
    }
    function simulatedWinner(first,second){
      const chance=1/(1+Math.exp((second.profile.strength-first.profile.strength)/12));
      return Math.random()<chance?first:second;
    }
    function settleRound(){
      if(outcome==='draw')return;
      const previous=tournament.bracket;
      pendingWinners=[outcome==='win'?null:opponent];
      for(let i=2;i<previous.length;i+=2)pendingWinners.push(simulatedWinner(previous[i],previous[i+1]));
    }
    function advanceTournament(){
      if(!pendingWinners)return;
      tournament.bracket=pendingWinners;
      tournament.history.push(pendingWinners);
      tournament.round++;
      startMatch();
    }
    function showMenu(){
      matchToken++;tournament=null;opponent=null;outcome=null;pendingWinners=null;thinking=false;
      byId('stage').hidden=true;byId('menu').hidden=false;byId('place').hidden=true;
      byId('tournament-recap').hidden=true;byId('thinking').hidden=true;byId('victory-effect').hidden=true;
    }
    function maybeSay(message,frequency){
      const bubble=byId('speech');
      if(Math.random()*100>=settings.talkativeness*frequency){
        bubble.hidden=true;bubble.textContent='';return;
      }
      bubble.hidden=false;
      bubble.textContent=message;
      bubble.className='speech';
      void bubble.offsetWidth;
      bubble.className='speech flash';
    }
    function openingLine(){
      if(settings.attack>75)return '先に仕掛けるよ。';
      if(settings.defense>75)return '一手ずつ、見ているよ。';
      if(settings.edgeExplore>75)return '別の辺も使ってみよう。';
      if(settings.unusual>75)return '普通の手は飽きたな。';
      return ['よろしく。','いい勝負にしよう。','さて、始めようか。'][opponent.id%3];
    }
    function thinkingLine(){
      if(settings.depth===3)return '……もう少し先まで読む。';
      if(settings.trick>70)return '仕掛けを探している。';
      return ['うーん……','この線はどうかな。','少し待って。'][Math.floor(Math.random()*3)];
    }
    function moveLine(){
      const lines=['ここにする。','道が見えた。','次はどうする？','その手は読んでいたよ。'];
      if(settings.ride>75)lines.push('その石、使わせてもらうね。');
      if(settings.unusual>75)lines.push('意外な場所だろう？');
      return lines[(opponent.id+board.reduce((n,stone)=>n+(stone!==EMPTY),0))%lines.length];
    }
    function renderBracket(){
      const container=byId('bracket-rounds');
      const size=tournament.type.size,roundCount=Math.log2(size),twoSided=size>=16;
      const rounds=tournament.history.slice();
      if(pendingWinners)rounds.push(pendingWinners);
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
        segment.className='bracket-line'+(active?' active':'');
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
          +(pendingWinners&&roundIndex===tournament.round+1?' winner':'')
          +(outcome==='loss'&&roundIndex===tournament.round&&index===0?' out':'');
        entry.setAttribute('style',`left:${x}px;top:${y-cardHeight/2}px;width:${cardWidth}px;height:${cardHeight}px;--delay:${roundIndex*170+Math.min(index,16)*16}ms`);
        if(character&&character!=='TBD'){
          const image=document.createElement('img');image.src='characters/'+character.file;image.alt='';entry.append(image);
        }
        const label=document.createElement('span');label.textContent=character===null?'YOU':character==='TBD'?'—':character.name;
        entry.append(label);canvas.append(entry);
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
              const active=level<tournament.round+(pendingWinners?1:0);
              connectPair(leftX,nextLeft,y1,y2,parentY,false,active,level*170);
              connectPair(rightX,nextRight,y1,y2,parentY,true,active,level*170);
            }
          }
        }
        const centerX=(width-cardWidth)/2,centerY=top+sideHeight/2;
        heading('CHAMPION',centerX);
        card(rounds[roundCount][0],centerX,centerY,roundCount,0);
        const leftX=margin+depth*step,rightX=width-margin-cardWidth-depth*step;
        const active=depth<tournament.round+(pendingWinners?1:0);
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
            connectPair(x,x+step,y1,y2,parentY,false,level<tournament.round+(pendingWinners?1:0),level*170);
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
        :outcome==='win'&&tournament.bracket.length===2?'YOU WON THE TOURNAMENT'
        :outcome==='win'?'ADVANCING TO ROUND '+(tournament.round+2)
        :'THE BRACKET CONTINUES WITHOUT YOU';
    }
    function showVictoryEffect(){
      const champion=tournament.bracket.length===2;
      const effect=byId('victory-effect');
      effect.className='victory-effect '+(champion?'champion':'round-clear');
      byId('victory-kicker').textContent=champion?'TOURNAMENT COMPLETE':'MATCH WON';
      byId('victory-title').textContent=champion?'CHAMPION':'VICTORY';
      byId('victory-subtitle').textContent=champion?'THE CIRCUIT IS YOURS':'ADVANCING TO THE NEXT ROUND';
      const particles=byId('victory-particles');particles.replaceChildren();
      const count=champion?72:36;
      for(let n=0;n<count;n++){
        const spark=document.createElement('i');spark.className='victory-particle';
        const angle=n/count*Math.PI*2+(Math.random()-.5)*.16;
        const radius=(champion?250:190)*(0.55+Math.random()*.55);
        const dx=Math.round(Math.cos(angle)*radius),dy=Math.round(Math.sin(angle)*radius);
        const delay=Math.round((n%8)*48+Math.random()*180);
        const duration=Math.round(900+Math.random()*700);
        const hue=champion?(n%3===0?48:145):145;
        spark.setAttribute('style',`--dx:${dx}px;--dy:${dy}px;--delay:${delay}ms;--duration:${duration}ms;--hue:${hue}`);
        particles.append(spark);
      }
      effect.hidden=false;
      byId('board-frame').className='board-frame win-flash';
    }
    function scheduleRecap(){
      const token=matchToken;
      const pause=outcome==='win'?(tournament.bracket.length===2?3200:2100):700;
      setTimeout(()=>{
        if(token!==matchToken||!ended||!tournament)return;
        byId('victory-effect').hidden=true;
        byId('board-frame').className='board-frame';
        renderBracket();
        byId('tournament-recap').hidden=false;
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
    function drawStone(cx,cy,player,four,won,recent){
      const colors=player===HUMAN
        ?{o:'#0a5032',s:'#078457',m:'#18bf78',x:'#39ef9b',h:'#afffda'}
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
      if(recent){
        ctx.fillStyle='#f1ffff';ctx.shadowColor='#f1ffff';ctx.shadowBlur=15;
        for(const [x,y,w,h] of [[-8,-8,4,1],[-8,-8,1,4],[5,-8,4,1],[8,-8,1,4],[-8,8,4,1],[-8,5,1,4],[5,8,4,1],[8,5,1,4]])
          ctx.fillRect(cx+x,cy+y,w,h);
        ctx.shadowBlur=0;
      }
    }
    function drawBoard(legal,hs,cs){
      const greenFours=new Set(hs.four.flat()),redFours=new Set(cs.four.flat());
      ctx.clearRect(0,0,160,160);
      for(let n=0;n<N;n++){
        const p=8+n*16;
        ctx.fillStyle='#15583d';ctx.fillRect(8,p-.75,144,1.5);ctx.fillRect(p-.75,8,1.5,144);
        ctx.fillStyle='#31b978';ctx.fillRect(8,p-.25,144,.5);ctx.fillRect(p-.25,8,.5,144);
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
      if(ended||board[i]||!legalMoves(board).includes(i))return false;
      board[i]=player;if(player===COM)lastComMove=i;selectedIndex=-1;hoverIndex=-1;
      const result=wins(board,player);
      if(result.won){ended=true;outcome=player===HUMAN?'win':'loss';winningCells=new Set((result.five[0]||result.four[0]).concat(result.four.flat()));}
      else if(!legalMoves(board).length){ended=true;outcome='draw';}
      else turn=player===HUMAN?COM:HUMAN;
      if(ended){
        settleRound();
        maybeSay(outcome==='win'?'やられた……強いね。':outcome==='loss'?'この勝負はもらった。':'引き分けか。また勝負だ。',.6);
      }
      render();
      if(ended){
        if(outcome==='win')showVictoryEffect();
        scheduleRecap();
      }
      return true;
    }
    function render(){
      const legal=!ended&&turn===HUMAN&&!thinking?new Set(legalMoves(board)):new Set();
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
        result.textContent=outcome==='win'?'YOU WIN':outcome==='loss'?'YOU LOSE':'DRAW';
        byId('next-match').textContent=outcome==='win'?'NEXT MATCH':outcome==='loss'?'TRY AGAIN':'REPLAY MATCH';
        if(outcome==='win'&&tournament.bracket.length===2){result.textContent='TOURNAMENT CHAMPION';byId('next-match').textContent='PLAY AGAIN';}
      }
    }
    function scheduleCom(){
      thinking=true;
      const deliberate=Math.random()<.28;
      const wait=deliberate?1100+settings.depth*300+Math.floor(Math.random()*600):260+Math.floor(Math.random()*320);
      maybeSay(deliberate?thinkingLine():'次の手を考える……',.3);
      byId('thinking').hidden=false;
      render();
      const token=matchToken;
      setTimeout(()=>{
        if(token!==matchToken||ended||turn!==COM)return;
        const i=chooseComMove();thinking=false;byId('thinking').hidden=true;
        if(i>=0){play(i,COM);if(!ended)maybeSay(moveLine(),.35);}
        else{ended=true;outcome='draw';maybeSay('引き分けか。また勝負だ。',.6);render();scheduleRecap();}
      },wait);
    }
    for(let i=0;i<N*N;i++){
      const button=document.createElement('button');button.type='button';button.className='cell';button.setAttribute('role','gridcell');
      button.addEventListener('click',()=>{
        if(turn!==HUMAN||thinking||ended||!legalMoves(board).includes(i))return;
        if(requiresPlace){selectedIndex=i;render();}
        else if(play(i,HUMAN)&&!ended)scheduleCom();
      });
      button.addEventListener('mouseenter',()=>{hoverIndex=i;render();});
      button.addEventListener('mouseleave',()=>{hoverIndex=-1;render();});
      button.addEventListener('focus',()=>{hoverIndex=i;render();});
      button.addEventListener('blur',()=>{hoverIndex=-1;render();});
      boardEl.append(button);cells.push(button);
    }
    byId('place').addEventListener('click',()=>{
      if(!requiresPlace||selectedIndex<0||turn!==HUMAN||thinking||ended)return;
      const i=selectedIndex;
      if(play(i,HUMAN)&&!ended)scheduleCom();
    });
    for(const type of tournamentTypes){
      const button=document.createElement('button');button.type='button';button.className='tournament-choice';
      const title=document.createElement('strong');title.textContent=type.label;
      const count=document.createElement('span');count.textContent=type.size+' PLAYERS';
      const description=document.createElement('small');description.textContent=type.description;
      button.append(title,count,description);
      button.addEventListener('click',()=>startTournament(type.size));
      byId('tournament-list').append(button);
    }
    byId('back').addEventListener('click',showMenu);
    byId('menu-after').addEventListener('click',showMenu);
    byId('next-match').addEventListener('click',()=>{
      if(!tournament||!ended)return;
      if(outcome==='win'){
        if(tournament.bracket.length===2)startTournament(tournament.type.size);
        else advanceTournament();
      }else if(outcome==='loss')startTournament(tournament.type.size);
      else startMatch();
    });
    const presets={rookie:{depth:1,mistake:35,trick:10},balanced:{depth:2,mistake:10,trick:30},expert:{depth:3,mistake:0,trick:75}};
    showMenu();
    window.GravityFour={legalMoves,wins,evaluate,settings,presets,startTournament,
      getTournament:()=>tournament&&{size:tournament.type.size,round:tournament.round,opponent:opponent.name,
        ranks:tournament.bracket.slice(1).map(character=>character.profile.rank)},
      getBoard:()=>board.slice()};
  })();
