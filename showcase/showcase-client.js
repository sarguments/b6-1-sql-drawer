// 표는 자동 배치하고, 보드 전체를 이동·확대·축소한다.
const EVIDENCE = JSON.parse(document.getElementById('evidence').textContent);
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const names = ['equipment','technician','component','maintenance','alarm_log'];
const labels = {equipment:'설비',technician:'담당자',component:'부품',maintenance:'정비 기록',alarm_log:'알람'};
const order = ['equipment','technician','maintenance','component','alarm_log'];
const state = {selected:null, q:'Q05', after:false, fk:false};
const pos = {};              // 표 이름 → {x, y}
const expanded = {};         // 표 이름 → 전체 행 펼침 여부
const PREVIEW = 6;           // 접힌 상태에서 보여줄 행 수
let pan = null;              // 빈 곳 잡고 이동
let zoom = 1;
let fitMode = false;         // 화면에 맞추기 상태(표 크기가 바뀌어도 유지)
let booted = false;
let viewportReturn=null, pendingViewportRestore=null;
const elk = new ELK();
const relations = order.flatMap(child=>EVIDENCE.schema[child].foreignKeys.map(f=>({child,parent:f.table,column:f.from,key:f.to})))
 .map((r,i)=>({...r,id:'R'+(i+1)}));
let layoutRequest=0, routedGraph=null, layoutError=null;
const ZOOM_MIN = 0.35, ZOOM_MAX = 2;
let zoomMin = ZOOM_MIN;      // 수동 축소 하한. 화면 맞추기 배율이 더 작으면 그만큼 낮춘다.
let pendingFocus = null;     // 다시 그린 뒤 되돌려 줄 포커스 대상
const NS='http://www.w3.org/2000/svg';
function node(tag,attrs,parent){const el=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs||{}))el.setAttribute(k,v);if(parent)parent.appendChild(el);return el;}
const esc=v=>String(v??'NULL').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colMeta=(t,c)=>EVIDENCE.schema[t].columns.find(x=>x.name===c);
const fkOf=(t,c)=>EVIDENCE.schema[t].foreignKeys.find(f=>f.from===c);
function data(){                              // 변경 전·후에 따라 실제 값이 달라진다
 if(['Q13','Q14'].includes(state.q)&&state.after){const q=EVIDENCE.queries.find(v=>v.id===state.q);
  return{...EVIDENCE.tables,equipment:q.after.equipment,alarm_log:q.after.alarm_log};}
 return EVIDENCE.tables;
}
const qOf=id=>EVIDENCE.queries.find(v=>v.id===id);
const QUERY_TITLES={
 Q01:'가동 중인 설비를 라인·자산 코드순으로 조회',
 Q02:'가장 최근에 시작한 정비 기록 5건 조회',
 Q03:'고장 정비 기록을 시작 시각순으로 조회',
 Q04:'2026년 9월 1일부터 설치한 설비 조회',
 Q05:'고장 정비 기록에 설비명·담당자명 연결',
 Q06:'설비별 부품과 수량 조회',
 Q07:'정비 기록이 없는 설비도 포함해 정비 건수 집계',
 Q08:'알람이 없는 설비도 포함해 알람 기록 조회',
 Q09:'정비 기록이 있는 담당자별 건수·총 시간 집계',
 Q10:'정비 2건 이상인 설비의 평균·최대 시간 집계',
 Q11:'알람이 있는 라인별 전체·오류 알람 건수 집계',
 Q12:'정비 기록이 없는 설비 조회',
 Q13:'미완료 정비 기록이 없는 정비 중 설비를 가동 상태로 변경',
 Q14:'2026년 8월 1일 전에 처리 완료된 경고 알람 삭제',
 Q15:'설비·기간 조회의 인덱스 적용 전후 실행 계획 비교'
};
const titleOf=q=>QUERY_TITLES[q.id];
const QUERY_EXPLANATIONS={
 Q01:'가동 중(RUNNING)인 설비만 조회합니다. 라인 이름순으로 정렬하고, 같은 라인에서는 자산 코드순으로 보여줍니다.',
 Q02:'정비 시작 시각이 가장 최근인 기록 5건을 조회합니다. 시작 시각을 내림차순으로 정렬한 뒤 앞의 5건만 남깁니다.',
 Q03:'정비 종류가 고장 정비(BREAKDOWN)인 기록만 조회합니다. 정비 시작 시각이 이른 순서로 보여줍니다.',
 Q04:'2026년 9월 1일에 설치했거나 그 이후에 설치한 설비를 조회합니다. 설치일이 가장 최근인 설비부터 보여줍니다.',
 Q05:'고장 정비(BREAKDOWN) 기록에 설비 이름과 담당자 이름을 붙여 조회합니다. 설비·담당자 번호로 세 표를 연결하고, 양쪽에 연결되는 행이 있는 기록만 정비 시작 시각순으로 보여줍니다.',
 Q06:'부품이 어느 설비에 속하는지 설비 이름과 함께 조회합니다. 부품의 설비 번호로 두 표를 연결하고, 자산 코드와 부품 번호순으로 보여줍니다.',
 Q07:'설비별 정비 건수를 셉니다. 설비를 기준으로 정비 기록을 연결해 묶으며, 정비 기록이 없는 설비도 0건으로 남깁니다. 건수가 많은 순서로, 건수가 같으면 자산 코드순으로 보여줍니다.',
 Q08:'설비별 알람 기록을 조회합니다. 설비를 기준으로 연결하므로 알람이 없는 설비도 남고, 그 행의 알람 정보는 NULL로 표시됩니다. 자산 코드와 알람 발생 시각순으로 보여줍니다.',
 Q09:'담당자별 정비 건수와 총 정비 시간을 구합니다. 담당자와 정비 기록을 연결해 담당자별로 묶고, 정비 시간의 합이 큰 순서로 보여줍니다. 정비 기록이 없는 담당자는 제외됩니다.',
 Q10:'정비 기록이 2건 이상인 설비의 정비 건수와 평균·최대 정비 시간을 구합니다. 설비별로 묶어 계산한 뒤, HAVING 조건으로 정비 2건 이상인 설비만 남깁니다. 평균은 소수 첫째 자리까지 반올림하고, 평균 시간이 긴 순서로 보여줍니다.',
 Q11:'라인별 전체 알람 건수와 오류(ERROR) 알람 건수를 셉니다. 설비와 알람을 연결해 라인별로 묶고, 전체 알람이 많은 순서로 보여줍니다. 알람이 없는 라인은 제외됩니다.',
 Q12:'정비 기록이 한 번도 없는 설비를 찾습니다. NOT EXISTS로 해당 설비를 참조하는 정비 기록이 없는지 확인하고, 자산 코드순으로 보여줍니다.',
 Q13:'정비 중(MAINTENANCE)인 설비 가운데 완료(DONE)가 아닌 정비 기록이 하나도 없는 설비를 가동 중(RUNNING)으로 바꿉니다. 정비 기록이 모두 완료됐거나 아예 0건인 설비가 조건에 포함됩니다. 뒤의 SELECT는 지정된 설비 2대의 상태를 확인하는 조회이며, 변경 건수가 아닙니다.',
 Q14:'처리 완료 시각(cleared_at)이 기록되어 있고 그 시각이 2026년 8월 1일 이전인 경고(WARN) 알람을 삭제합니다. 날짜 조건은 발생 시각이 아니라 처리 완료 시각에 적용됩니다. 처리하지 않은 알람이나 다른 등급은 남기며, 뒤의 SELECT는 삭제 후 남은 알람을 등급별로 셉니다.',
 Q15:'설비 5번에서 2026년 7월 1일에 시작했거나 그 이후에 시작한 정비 기록을 찾는 조회입니다. 설비 번호·시작 시각 순서의 복합 인덱스를 추가하고, 전후 실행 계획이 전체 훑기(SCAN)에서 인덱스 탐색(SEARCH)으로 바뀌는지 비교합니다. 실행 시간이나 속도 배수를 측정한 결과는 아닙니다.'
};
const resultOut=(q,i)=>{const outs=q.outputs.filter(o=>o.columns.length);return outs[i||0]||null;};
const colIdx=(o,n)=>o?o.columns.indexOf(n):-1;
const equipByAsset=a=>(data().equipment||[]).find(r=>r.asset_code===a);
// 쿼리 결과(evidence.json)에서 대상 행을 계산한다. 화면의 수동 선택과는 완전히 별개다.
// kind: 'result' 결과 행 · 'group' 집계 기준 행 · 'del' 삭제 대상 행
function targetRows(){
 if(state.fk)return[];
 const q=qOf(state.q); const out=[]; const add=(t,id,kind)=>{if(id!=null)out.push({table:t,id,kind:kind||'result'});};
 const o=i=>resultOut(q,i);
 switch(q.id){
  case 'Q01': case 'Q04': case 'Q12': {
   const r0=o(0); if(!r0)break; const ai=colIdx(r0,'asset_code');
   for(const r of r0.rows){const e=equipByAsset(r[ai]); if(e)add('equipment',e.id,'result');}
   break;}
  case 'Q02': case 'Q03': case 'Q05': {
   const r0=o(0); if(!r0)break; const ii=colIdx(r0,'id');
   for(const r of r0.rows)add('maintenance',r[ii],'result');
   break;}
  case 'Q06': {
   const r0=o(0); if(!r0)break; const ai=colIdx(r0,'asset_code'),pi=colIdx(r0,'part_no');
   for(const r of r0.rows){const e=equipByAsset(r[ai]); if(!e)continue;
    const c=(data().component||[]).find(x=>x.equipment_id===e.id&&x.part_no===r[pi]); if(c)add('component',c.id,'result');}
   break;}
  case 'Q07': case 'Q10': {
   const r0=o(0); if(!r0)break; const ai=colIdx(r0,'asset_code');
   for(const r of r0.rows){const e=equipByAsset(r[ai]); if(e)add('equipment',e.id,'group');}
   break;}
  case 'Q08': {
   const r0=o(0); if(!r0)break; const ai=colIdx(r0,'asset_code'),ci=colIdx(r0,'alarm_code'),ti=colIdx(r0,'occurred_at');
   for(const r of r0.rows){const e=equipByAsset(r[ai]); if(!e)continue;
    if(r[ci]==null){add('equipment',e.id,'result');continue;}
    const a=(data().alarm_log||[]).find(x=>x.equipment_id===e.id&&x.alarm_code===r[ci]&&x.occurred_at===r[ti]);
    if(a)add('alarm_log',a.id,'result');}
   break;}
  case 'Q09': {
   const r0=o(0); if(!r0)break; const ei=colIdx(r0,'employee_no');
   for(const r of r0.rows){const x=(data().technician||[]).find(v=>v.employee_no===r[ei]); if(x)add('technician',x.id,'group');}
   break;}
  case 'Q11': {
   const r0=o(0); if(!r0)break; const li=colIdx(r0,'line_name'); const seen=new Set();
   for(const r of r0.rows)for(const e of (data().equipment||[]))
    if(e.line_name===r[li]&&!seen.has(e.id)){seen.add(e.id);add('equipment',e.id,'group');}
   break;}
  case 'Q13': {  // UPDATE 뒤 상태를 확인하는 조회 결과 행
   const r0=o(0); if(!r0)break; const ai=colIdx(r0,'asset_code');
   for(const r of r0.rows){const e=equipByAsset(r[ai]); if(e)add('equipment',e.id,'result');}
   break;}
  case 'Q14': {  // 삭제 대상은 언제나 변경 전 원본에서 계산한다(변경 후에는 표에서 사라진다)
   for(const a of EVIDENCE.tables.alarm_log)
    if(a.level==='WARN'&&a.cleared_at!=null&&a.cleared_at<'2026-08-01')add('alarm_log',a.id,'del');
   break;}
  case 'Q15': {
   const m=EVIDENCE.indexMatches,ii=colIdx(m,'id');
   for(const r of m.rows)add('maintenance',r[ii],'result');
   break;}
 }
 return out;
}
const TARGET_LABEL={result:'쿼리 결과에 포함된 행',group:'집계 기준 행',del:'이번 DELETE로 삭제되는 행'};
// 행 상태는 색만으로 구분하지 않는다. id 옆에 기호를 붙이고 같은 뜻을 접근 가능한 이름으로도 준다.
const STATE_MARK={sel:'◉',on:'↑',del:'✕',grp:'Σ',hit:'●'};
const STATE_LABEL={sel:'직접 고른 행',on:'고른 행이 가리키는 부모 행',del:'이번 DELETE로 삭제되는 행',grp:'집계 기준 행',hit:'쿼리 결과에 포함된 행'};
function buildCards(){
 const grid=$('#board'); grid.replaceChildren();
 for(const t of order){
  const cols=EVIDENCE.schema[t].columns.map(c=>c.name);
  const rows=data()[t]||[];
  const fig=document.createElement('figure');
  fig.className='tbl'; fig.dataset.table=t;
  fig.innerHTML='<figcaption><button class="table-focus" aria-label="'+t+' 표로 확대"><b>'+t+'</b><span>'+labels[t]+' · '+rows.length+'행 · 컬럼 '+cols.length+'</span></button></figcaption>'
   +'<div class="rows"><table><thead><tr>'+cols.map(c=>{const m=colMeta(t,c),f=fkOf(t,c);
     return '<th scope="col"><span class="cname">'+esc(c)+'</span><span class="ctype">'+esc(m?m.type:'')+'</span>'
      +(m&&m.pk?'<i class="badge pk">PK</i>':'')+(f?'<i class="badge fk" title="'+esc(f.table+'.'+f.to)+'">FK</i>':'')+'</th>';}).join('')+'</tr></thead>'
   +'<tbody>'+rows.slice(0,expanded[t]?rows.length:PREVIEW).map(r=>'<tr data-key="'+t+':'+r.id+'">'+cols.map((c,i)=>{const v=r[c],f=fkOf(t,c);
     const cell=i===0?'<span class="rowmark" aria-hidden="true"></span><button class="cell id" data-row="'+t+':'+r.id+'">'+esc(v)+'</button>'
      :f&&v!=null?'<button class="cell ref" data-ref="'+t+':'+c+':'+v+'">'+esc(v)+'</button>'
      :'<span class="cell">'+esc(v)+'</span>';
     return '<td'+(f?' class="fk"':'')+'>'+cell+'</td>';}).join('')+'</tr>').join('')
   +'</tbody></table></div>';
  grid.appendChild(fig);
 }
}
function layoutCards(){
 markRows(); // 선택·기호에 따른 실제 표 크기까지 측정한다.
 const request=++layoutRequest;
 const scene=$('#scene');
 scene.setAttribute('aria-busy','true');
 routedGraph=null;
 applyPositions();
 const selected=activeChain().find(c=>c.kind==='self');
 const row=selected?(data()[selected.table]||[]).find(r=>r.id===selected.id):null;
 const cards=new Map($$('.tbl').map(c=>[c.dataset.table,c]));
 const children=order.map(t=>{
  const card=cards.get(t);
  return {id:t,width:card.offsetWidth,height:card.offsetHeight,
   layoutOptions:{'elk.portConstraints':'FIXED_POS'},ports:[]};
 });
 const byId=new Map(children.map(c=>[c.id,c]));
 const edges=relations.map(r=>{
  const active=!!(row&&selected.table===r.child&&row[r.column]!=null);
  const parent=byId.get(r.parent),child=byId.get(r.child);
  const port=(n,side,key)=>{
   const siblings=relations.filter(x=>side==='EAST'?x.parent===n.id:x.child===n.id)
    .sort((a,b)=>active?order.indexOf(a.parent)-order.indexOf(b.parent):0);
   const index=siblings.findIndex(x=>x.id===r.id);
   let y=20+index*22;
   if(active){
    const id=side==='EAST'?row[r.column]:selected.id;
    const tr=cards.get(n.id).querySelector('tr[data-key="'+n.id+':'+id+'"]');
    if(tr){const cr=cards.get(n.id).getBoundingClientRect(),rr=tr.getBoundingClientRect();
     y=(rr.top-cr.top+rr.height/2)/zoom;}
    // 같은 행으로 들어가는 참조도 연결 지점을 나눈다.
    if(side==='WEST')y+=(index-(siblings.length-1)/2)*8;
   }
   const p={id:r.id+':'+key,x:side==='EAST'?n.width:0,y,width:0,height:0,
    layoutOptions:{'elk.port.side':side}};
   n.ports.push(p);return p.id;
  };
  return {id:r.id,sources:[port(parent,'EAST','parent')],targets:[port(child,'WEST','child')],
   active,value:active?row[r.column]:null};
 });
 // 현재 자동 배치의 위아래 순서를 다음 계산에도 전달한다.
 children.sort((a,b)=>(pos[a.id]?.y??order.indexOf(a.id))-(pos[b.id]?.y??order.indexOf(b.id)));
 elk.layout({id:'root',layoutOptions:{
  'elk.algorithm':'layered','elk.direction':'RIGHT','elk.edgeRouting':'ORTHOGONAL',
  'elk.padding':'[top=36,left=36,bottom=36,right=36]',
  'elk.spacing.nodeNode':'72','elk.layered.spacing.nodeNodeBetweenLayers':'180',
  'elk.layered.spacing.edgeEdgeBetweenLayers':'28','elk.layered.spacing.edgeNodeBetweenLayers':'32',
  'elk.spacing.edgeNode':'28',
  'elk.spacing.edgeEdge':'28','elk.layered.considerModelOrder.strategy':'NODES_AND_EDGES'
 },children,edges}).then(graph=>{
  if(request!==layoutRequest)return;
  for(const c of graph.children)pos[c.id]={x:c.x,y:c.y};
  routedGraph=graph;layoutError=null;
  applyPositions();keepZoom();restoreFocus();
  scene.setAttribute('aria-busy','false');
  if(pendingViewportRestore)applyViewportRestore();
  else if(state.selected)bringRowIntoView(document.querySelector('tr[data-key="'+state.selected.table+':'+state.selected.id+'"]'));
 }).catch(error=>{
  if(request!==layoutRequest)return;
  layoutError=String(error);scene.setAttribute('aria-busy','false');
  $('#diagram-status').hidden=false;$('#diagram-status').textContent='관계도 배치에 실패했습니다.';console.error(error);
 });
}
function applyPositions(){
 for(const c of $$('.tbl')){const p=pos[c.dataset.table]||{x:0,y:0};c.style.transform='translate('+p.x+'px,'+p.y+'px)';}
 sizeBoard();
}
function sizeBoard(){
 const cards=$$('.tbl'); let w=0,h=0;
 for(const c of cards){const p=pos[c.dataset.table]||{x:0,y:0};w=Math.max(w,p.x+c.offsetWidth);h=Math.max(h,p.y+c.offsetHeight);}
 w=Math.max(1,w+36); h=Math.max(1,h+36);
 // 보드 자체도 스크롤 영역만큼은 차지해야 빈 곳 클릭·스크롤 좌표가 어긋나지 않는다.
 const b=$('#board'), scene=$('#scene');
 b.style.width=Math.max(w,scene.clientWidth)+'px';
 b.style.height=Math.max(h,scene.clientHeight)+'px';
 return {w,h};
}
function setZoom(z,{fit=false,fitWidth=false}={}){
 const scene=$('#scene'), b=$('#board');
 const {w,h}=sizeBoard();
 const availW=Math.max(40,scene.clientWidth-24), availH=Math.max(40,scene.clientHeight-24);
 if(fit||fitWidth){
  fitMode=true;
  z=fit?Math.min(availW/w,availH/h):Math.min(1,availW/w);
  z=Math.max(0.05,Math.min(ZOOM_MAX,z));
  zoomMin=Math.min(ZOOM_MIN,z);   // 화면 맞추기 배율이 더 작으면 그 배율까지 내려갈 수 있게 한다(축소가 오히려 커지지 않도록).
  scene.scrollTo(0,0);
 }else{
  fitMode=false;
  z=Math.max(zoomMin,Math.min(ZOOM_MAX,z));   // 축소는 하한에서 멈춘다. 하한 자체를 낮추지 않는다.
 }
 zoom=z;
 b.style.transform='scale('+zoom+')';
 b.style.transformOrigin='0 0';
 const svg=$('#links');                       // 선을 담은 SVG도 보드와 같은 배율로 키워 좌표계를 맞춘다
 svg.style.transform='scale('+zoom+')';
 svg.style.transformOrigin='0 0';
 $('#zoom-value').textContent=Math.round(zoom*100)+'%';
 updateZoomButtons();
 drawLinks();
}
function updateZoomButtons(){
 const out=$('#zoom-out'), inn=$('#zoom-in');
 out.disabled=zoom<=zoomMin+1e-9;
 inn.disabled=zoom>=ZOOM_MAX-1e-9;
 // 방금 잠긴 버튼에 포커스가 있었다면 반대쪽으로 옮겨 포커스가 body로 떨어지지 않게 한다.
 if(document.activeElement===out&&out.disabled)inn.focus({preventScroll:true});
 else if(document.activeElement===inn&&inn.disabled)out.focus({preventScroll:true});
}
function keepZoom(){ if(fitMode)setZoom(1,{fit:true}); else setZoom(zoom); }
function activeChain(){
 const sel=state.selected;
 if(state.fk)return[];                 // 실패 시연 중에는 기존 강조·선을 모두 걷어낸다
 if(!sel)return[];
 const row=(data()[sel.table]||[]).find(r=>r.id===sel.id);
 if(!row)return[{table:sel.table,id:sel.id,kind:'gone'}];
 const out=[{table:sel.table,id:sel.id,kind:'self'}];
 for(const f of EVIDENCE.schema[sel.table].foreignKeys){
  if(row[f.from]==null)continue;
  const parent=(data()[f.table]||[]).find(r=>r.id===row[f.from]);
  if(parent)out.push({table:f.table,id:parent.id,kind:'parent',fk:f.from,value:row[f.from],sql:f.table+'.'+f.to});
 }
 return out;
}
function markRows(){
 const on=new Set(), sel=new Set(), hit=new Set(), grp=new Set(), del=new Set();
 for(const c of activeChain()){if(c.kind==='self')sel.add(c.table+':'+c.id);else on.add(c.table+':'+c.id);}
 for(const c of targetRows()){const k=c.table+':'+c.id;
  if(c.kind==='group')grp.add(k); else if(c.kind==='del')del.add(k); else hit.add(k);}
 for(const tr of $$('.tbl tbody tr')){
  const k=tr.dataset.key;
  const st=sel.has(k)?'sel':on.has(k)?'on':del.has(k)?'del':grp.has(k)?'grp':hit.has(k)?'hit':null;
  tr.classList.toggle('hit',hit.has(k));
  tr.classList.toggle('grp',grp.has(k));
  tr.classList.toggle('del',del.has(k));
  tr.classList.toggle('sel',sel.has(k));
  tr.classList.toggle('on',on.has(k));
  const mark=tr.querySelector('.rowmark');
  if(mark)mark.textContent=st?STATE_MARK[st]:'';
  const btn=tr.querySelector('.cell.id');
  if(btn){ if(st)btn.setAttribute('aria-label',btn.textContent+' · '+STATE_LABEL[st]);
   else btn.removeAttribute('aria-label'); }
 }
}
function polyPath(pts){return pts.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join('');}
function drawLinks(){
 const svg=$('#links'),b=$('#board');
 const bw=parseFloat(b.style.width)||1,bh=parseFloat(b.style.height)||1;
 svg.setAttribute('width',bw);svg.setAttribute('height',bh);
 svg.setAttribute('viewBox','0 0 '+bw+' '+bh);svg.replaceChildren();markRows();
 const status=$('#diagram-status');
 status.hidden=!state.fk&&!layoutError;
 status.textContent=layoutError?'관계도 배치에 실패했습니다.':state.fk?'없는 설비 번호: 저장 거절':'';
 if(!routedGraph)return;
 const defs=node('defs',{},svg);
 const style=getComputedStyle(document.body);
 for(const edge of routedGraph.edges){
  const relation=relations.find(r=>r.id===edge.id);
  const color=style.getPropertyValue('--'+edge.id).trim();
  const marker=node('marker',{id:'arrow-'+edge.id,viewBox:'0 0 8 8',refX:7,refY:4,
   markerWidth:7,markerHeight:7,markerUnits:'userSpaceOnUse',orient:'auto'},defs);
  node('path',{d:'M0 0L8 4L0 8Z',fill:color},marker);
  for(const section of edge.sections||[]){
   let pts=[section.startPoint,...(section.bendPoints||[]),section.endPoint];
   if(edge.active)pts=pts.slice().reverse();
   const path=node('path',{d:polyPath(pts),class:'link '+(edge.active?'row':'rel'),
    stroke:color,'data-relation':edge.id,'marker-end':'url(#arrow-'+edge.id+')'},svg);
   node('title',{},path).textContent=edge.active
    ?relation.child+'.'+relation.column+'='+edge.value+' → '+relation.parent+'.'+relation.key
    :relation.parent+'.'+relation.key+' → '+relation.child+'.'+relation.column+' (1:N)';
   const start=pts[0];
   node('circle',{cx:start.x,cy:start.y,r:3.5,fill:color},svg);
   // 시작은 점, 도착은 작은 화살표. 같은 관계 번호를 양 끝에 표시한다.
   for(const [p,dx,dy,anchor] of [[section.startPoint,9,-9,'start'],
    [section.endPoint,-9,edge.active&&relations.filter(r=>r.child===relation.child)
     .sort((a,b)=>order.indexOf(a.parent)-order.indexOf(b.parent)).indexOf(relation)%2?18:-9,'end']]){
    const label=node('text',{x:p.x+dx,y:p.y+dy,fill:color,class:'port-label','text-anchor':anchor},svg);
    label.textContent=edge.id;
   }
  }
 }
}
function detailHTML(){
 if(state.fk){
  const f=EVIDENCE.fkFailure;
  const cols=(f.sql.match(/\(([^)]*)\)/)||[,''])[1].split(',').map(s=>s.trim()).filter(Boolean);
  return '<h3>없는 부모 번호로 INSERT → 저장 거절</h3>'
   +'<p>정비 기록에 없는 설비 번호 <b>'+esc(f.equipment_id)+'</b>를 넣으면 외래 키 검사에서 저장이 거절됩니다.</p>'
   +'<h3>저장되지 않은 입력</h3>'
   +'<div class="scroll" role="region" tabindex="0" aria-label="저장되지 않은 입력"><table><thead><tr>'
   +cols.map(c=>'<th scope="col">'+esc(c)+'</th>').join('')+'</tr></thead><tbody><tr>'
   +f.values.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr></tbody></table></div>'
   +'<h3>저장해 둔 오류 재생</h3><pre>'+esc(f.error)+'</pre>'
   +'<p class="muted">지금 실행 중인 DB에 다시 INSERT한 것이 아니라, 준비 단계에서 실행해 저장해 둔 거절 결과를 그대로 보여줍니다. 이 입력은 저장되지 않았고 미션 데이터는 바뀌지 않습니다.</p>';
 }
 const sel=state.selected; if(!sel)return '<p class="muted">표의 id나 파란 외래 키 값을 누르면 그 행의 값이 나옵니다.</p>';
 const row=(data()[sel.table]||[]).find(r=>r.id===sel.id);
 if(!row)return '<p class="muted">조건에 따라 삭제된 행입니다. 변경 전으로 되돌려 확인하세요.</p>';
 const meta=EVIDENCE.schema[sel.table];
 const tk=targetRows().find(c=>c.table===sel.table&&c.id===sel.id);
 return '<h3>'+sel.table+' #'+row.id+' <span class="muted">'+labels[sel.table]+'</span></h3>'
  +(tk?'<p class="hintline">'+state.q+' · '+TARGET_LABEL[tk.kind]+'</p>':'')
  +'<dl>'
  +Object.entries(row).map(([k,v])=>{const f=fkOf(sel.table,k),p=f?(data()[f.table]||[]).find(r=>r.id===v):null;
    return '<dt>'+esc(k)+(f?' <i class="badge fk">FK</i>':'')+'</dt><dd>'+esc(v)
     +(p?'<button class="go" data-row="'+f.table+':'+p.id+'">→ '+esc(f.table+' #'+p.id+' · '+(p.name??p.asset_code))+'</button>':'')+'</dd>';}).join('')
  +'</dl><h3>이 테이블의 키</h3><pre>'+esc(meta.columns.map(c=>c.name+' '+c.type+(c.pk?' PK':'')+(c.notnull?' NOT NULL':'')).join('\n'))
  +(meta.foreignKeys.length?'\n\n'+meta.foreignKeys.map(f=>f.from+' → '+f.table+'.'+f.to).join('\n'):'')+'</pre>';
}
function sqlHTML(){
 const q=qOf(state.q);
 return '<pre role="region" tabindex="0" aria-label="SQL"><code class="language-sql">'+Prism.highlight(q.sql,Prism.languages.sql,'sql')+'</code></pre>';
}
function resultHTML(){
 const q=qOf(state.q);
 const outs=q.id==='Q15'?[q.outputs[state.after?2:0],EVIDENCE.indexMatches]:q.outputs;
 return outs.map(o=>o.columns.length
  ?'<div class="scroll" role="region" tabindex="0" aria-label="실행 결과">'+'<table><thead><tr>'+o.columns.map(c=>'<th scope="col">'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+o.rows.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'
  :o.affected>=0?'<p class="count">변경 '+o.affected+'행</p>':'<p class="count">인덱스 생성</p>').join('');
}
function note(){
 const q=qOf(state.q);
 if(q.id==='Q13')return '조건에 맞는 설비가 없어 바뀐 행은 0행입니다. 아래 두 행은 UPDATE 뒤 상태 확인 결과입니다(협동로봇 셀 2호는 MAINTENANCE, 용접 로봇 2호는 RETIRED). 이 SQL은 정비 이력이 0건인 MAINTENANCE 설비도 대상으로 삼습니다.';
 if(q.id==='Q14'){
  if(state.after)return '처리 완료된 오래된 WARN 2행(alarm_log #1·#17)을 삭제했습니다. 알람은 18행에서 16행이 됩니다. 두 행은 표에서 사라집니다.';
  return '조건에 맞는 알람 2행(alarm_log #1·#17)이 줄 그은 삭제 대상으로 켜졌습니다. 변경 후를 누르면 두 행이 표에서 사라집니다.';
 }
 if(q.id==='Q15')return '인덱스를 만들어도 조회 결과는 정비 id 11·12·30 3행으로 같습니다. 실행 계획만 SCAN에서 SEARCH로 바뀝니다.';
 if(q.id==='Q12')return '정비 이력이 한 번도 없는 설비는 EQ-AG-001(이동 로봇 1호, id 12) 한 대입니다. NOT EXISTS 조건에 걸리는 설비 1행만 켜집니다.';
 if(q.id==='Q05')return '고장 정비(BREAKDOWN)만 남긴 JOIN 결과 13행입니다. 전체 정비 30행과 다릅니다.';
 const counts=q.outputs.filter(o=>o.columns.length).map(o=>o.rows.length);
 return q.id+' 결과 '+(counts.length?counts[0]+'행':'')+'입니다.';
}
function syncExpandLabel(){
 const any=names.some(t=>!expanded[t]);
 $('#expand-all').textContent=any?'모두 보기':'모두 접기';   // 접힌 표가 있으면 펼치기, 다 펼쳐져 있으면 접기
}
function rebuild(){ buildCards(); layoutCards(); syncExpandLabel(); keepZoom(); }
function setIfChanged(sel,html){
 const el=$(sel);
 if(el.dataset.cache===html)return;    // 내용이 같으면 그대로 둔다(포커스·스크롤 초기화 방지)
 el.dataset.cache=html; el.innerHTML=html;
}
function update(){
 const targets=targetRows();
 // 대상 행이 접힌 앞 6행 밖에 있으면 그 표를 펼쳐서 보이게 한다. 수동 선택 행과 그 부모 행도 같은 기준으로 펼친다.
 const byTable={};
 const want=(t,id)=>{if(id==null)return;(byTable[t]=byTable[t]||new Set()).add(id);};
 for(const c of targets)want(c.table,c.id);
 for(const c of activeChain())want(c.table,c.id);
 for(const t of Object.keys(byTable)){
  if(expanded[t])continue;
  const rows=data()[t]||[]; let last=-1;
  rows.forEach((r,i)=>{if(byTable[t].has(r.id))last=Math.max(last,i);});
  if(last>=PREVIEW)expanded[t]=true;
 }
 buildCards();
 layoutCards();
 restoreFocus();                     // 다시 그리기 직전에 잡아 둔 컨트롤이 있으면 같은 임자에게 포커스를 돌려준다
 $('#detail').innerHTML=detailHTML();
 if(state.q==='Q14'&&state.after)  // 사라진 행은 표에 없으므로 근거를 옆 패널에 따로 남긴다
  $('#detail').insertAdjacentHTML('afterbegin','<p class="hintline">이번 DELETE로 표에서 사라진 행: '
   +targets.map(c=>c.table+' #'+c.id).join(' · ')+'</p>');
 setIfChanged('#sql',sqlHTML());
 setIfChanged('#results',resultHTML());
 $('#query-note').textContent=note();
 $('#table-heading').textContent='queries.sql · '+state.q+' · '+titleOf(qOf(state.q));
 $('#query-picker').value=state.q;
 $('#query-explanation').textContent=QUERY_EXPLANATIONS[state.q];
 $('#before-after').hidden=!['Q13','Q14','Q15'].includes(state.q);
 $('#before').setAttribute('aria-pressed',String(!state.after));
 $('#after').setAttribute('aria-pressed',String(state.after));
 $('#fk-check').setAttribute('aria-pressed',String(state.fk));
 syncExpandLabel();
 if(fitMode||!booted)setZoom(1,{fit:true}); else setZoom(zoom);
 booted=true;
}
// 다시 그리기 전에 잡아 두면, 새 DOM에서 같은 컨트롤(또는 그에 합당한 대체)에게 포커스를 돌려준다.
// 표 바깥(#scene 밖)에 포커스가 있으면 건드리지 않는다. 마우스로 옆 패널을 눌렀을 때 화면이 흔들리지 않게 하려는 것.
function captureFocus(){
 if(pendingFocus)return;              // 호출부가 정해 둔 목적지가 있으면 그대로 쓴다
 const a=document.activeElement;
 if(!a||a===document.body||!a.closest)return;
 if(!a.closest('#board')&&!a.closest('.tbl')&&a.id!=='scene')return;
 if(a.dataset&&a.dataset.row)pendingFocus={kind:'row',key:a.dataset.row};
 else if(a.dataset&&a.dataset.ref)pendingFocus={kind:'ref',key:a.dataset.ref};
 else{const tr=a.closest&&a.closest('tr[data-key]');if(tr)pendingFocus={kind:'row',key:tr.dataset.key};}
}
function restoreFocus(){
 const it=pendingFocus; pendingFocus=null;
 if(!it)return;
 const table=String(it.key).split(':')[0];
 let el=null;
 if(it.kind==='row')el=document.querySelector('.cell.id[data-row="'+it.key+'"]');
 else if(it.kind==='ref')el=document.querySelector('.cell.ref[data-ref="'+it.key+'"]');
 if(!el&&state.selected&&state.selected.table===table)          // 그 행이 사라졌으면 지금 고른 행으로
  el=document.querySelector('.cell.id[data-row="'+table+':'+state.selected.id+'"]');
 if(!el)el=document.querySelector('.tbl[data-table="'+table+'"] .cell.id');   // 그것도 없으면 그 표의 첫 행 버튼
 if(el){try{el.focus({preventScroll:true});}catch(_){el.focus();}}
}
// 표를 화면 안으로 옮긴다. fullSize가 참이면 100%로 키우고(표를 눌렀을 때), 아니면 지금 배율을 유지한다.
function focusTable(t,fullSize,rowKey){
 const scene=$('#scene'), f=document.querySelector('.tbl[data-table="'+t+'"]');
 if(!f)return;
 if(fullSize){
  pendingViewportRestore=null;
  if(!viewportReturn)viewportReturn={zoom,min:zoomMin,fit:fitMode,left:scene.scrollLeft,top:scene.scrollTop,table:t};
  $('#zoom-back').disabled=false;
  setZoom(1);
 }else sizeBoard();
 const p=pos[t]||{x:0,y:0};
 scene.scrollTo({left:Math.max(0,p.x*zoom-24),top:Math.max(0,p.y*zoom-24)});
 if(!fullSize&&rowKey)bringRowIntoView(document.querySelector('tr[data-key="'+rowKey+'"]'));
 drawLinks();
}
function returnFromTable(){
 if(!viewportReturn)return;
 pendingViewportRestore=viewportReturn;viewportReturn=null;
 $('#zoom-back').disabled=true;
 if($('#scene').getAttribute('aria-busy')!=='true')applyViewportRestore();
}
function applyViewportRestore(){
 const view=pendingViewportRestore;if(!view)return;
 pendingViewportRestore=null;zoomMin=view.min;
 setZoom(view.zoom);fitMode=view.fit;
 $('#scene').scrollTo(view.left,view.top);
 document.querySelector('.tbl[data-table="'+view.table+'"] .table-focus')?.focus({preventScroll:true});
}
// 고른 행을 화면에 보이게 한다. 세로로는 행 위치까지, 가로로는 표 위치까지 스크롤한다.
function bringRowIntoView(tr){
 const scene=$('#scene'); if(!tr)return;
 const sr=scene.getBoundingClientRect(), rr=tr.getBoundingClientRect();
 if(rr.top<sr.top+4||rr.bottom>sr.bottom-4)
  scene.scrollTop+=Math.round(rr.top-sr.top)-40;
 if(rr.left<sr.left+4||rr.right>sr.right-4)
  scene.scrollLeft+=Math.round(rr.left-sr.left)-40;
}
function selectRow(t,id){ captureFocus(); state.fk=false; state.selected={table:t,id:Number(id)}; update(); }
$('#board').addEventListener('click',e=>{
 const ref=e.target.closest('.cell.ref');
 if(ref){const[t,c,v]=ref.dataset.ref.split(':');const f=fkOf(t,c);
  const p=f?(data()[f.table]||[]).find(r=>r.id===Number(v)):null;
  const id=Number(ref.closest('tr').dataset.key.split(':')[1]);
  if(f&&p){                       // 외래 키 값 → 그 값이 가리키는 부모 행으로 이동
   pendingFocus={kind:'row',key:f.table+':'+p.id};
   selectRow(f.table,p.id);
   $('#detail').insertAdjacentHTML('afterbegin','<p class="hintline">'+esc(t+'의 '+c+'='+v)+'는 '+esc(f.table+' #'+p.id+' · '+(p.name??p.asset_code))+'를 가리킵니다. 그 부모 행으로 옮겼습니다.</p>');
   focusTable(f.table,false,f.table+':'+p.id);
  } else { selectRow(t,id); }
  return;}
 const rowBtn=e.target.closest('.cell.id');
 if(rowBtn&&rowBtn.dataset.row){
  const[t,id]=rowBtn.dataset.row.split(':');
  pendingFocus={kind:'row',key:t+':'+id};   // 다시 그려도 같은 행 버튼으로 돌아오게 한다
  selectRow(t,id);
  focusTable(t,false,rowBtn.dataset.row);
  return;}
 const cap=e.target.closest('figcaption');
 if(cap)focusTable(cap.closest('.tbl').dataset.table,true);
});
// 옆 패널의 '부모 행' 버튼도 같은 동작을 하도록 따로 연결한다(#detail은 #board 밖에 있다).
$('#detail').addEventListener('click',e=>{
 const go=e.target.closest('.go');
 if(!go||!go.dataset.row)return;
 const[t,id]=go.dataset.row.split(':');
 const key=go.dataset.row;
 pendingFocus={kind:'row',key};     // 버튼은 다시 그리며 사라지므로 새로 선택된 행으로 포커스를 옮긴다
 selectRow(t,id);
 focusTable(t,false,key);
});
// 빈 곳을 끌면 표 위치를 바꾸지 않고 보드만 이동한다.
$('#scene').addEventListener('pointerdown',e=>{
 if(e.target.closest('.tbl'))return;
 pan={x:e.clientX,y:e.clientY,l:$('#scene').scrollLeft,t:$('#scene').scrollTop};
 $('#scene').classList.add('panning');
 try{$('#scene').setPointerCapture(e.pointerId);}catch(_){}
});
addEventListener('pointermove',e=>{
 if(pan){$('#scene').scrollLeft=pan.l-(e.clientX-pan.x);$('#scene').scrollTop=pan.t-(e.clientY-pan.y);}
});
function finishPan(){pan=null;$('#scene').classList.remove('panning');}
addEventListener('pointerup',finishPan);
addEventListener('pointercancel',finishPan);
$('#query-picker').addEventListener('change',e=>{        // 쿼리를 바꾸면 이전 쿼리의 선택·실패 상태를 비운다
 state.q=e.target.value;state.after=false;state.fk=false;state.selected=null;update();});
$('#before').addEventListener('click',()=>{state.after=false;update();});
$('#after').addEventListener('click',()=>{state.after=true;update();});
$('#expand-all').addEventListener('click',()=>{
 const any=names.some(t=>!expanded[t]);
 for(const t of names)expanded[t]=any;
 if(!any){    // 모두 접기: 접힌 앞 6행 밖으로 사라지는 수동 선택은 그 표만 펼쳐 강조가 남지 않게 한다
  for(const c of activeChain()){const rows=data()[c.table]||[];const i=rows.findIndex(r=>r.id===c.id);
   if(i>=PREVIEW)expanded[c.table]=true;}
 }
 rebuild();});
$('#fk-check').addEventListener('click',()=>{captureFocus();state.fk=!state.fk;update();});
$('#zoom-in').addEventListener('click',()=>setZoom(zoom+0.12));
$('#zoom-out').addEventListener('click',()=>setZoom(zoom-0.12));
$('#zoom-reset').addEventListener('click',()=>setZoom(1));
$('#zoom-back').addEventListener('click',returnFromTable);
addEventListener('keydown',e=>{
 if(e.key!=='Escape'||e.defaultPrevented||e.isComposing||!viewportReturn)return;
 if(e.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))return;
 e.preventDefault();returnFromTable();
});
 $('#reset').addEventListener('click',()=>{
 zoomMin=ZOOM_MIN; pendingFocus=null;
 viewportReturn=null;pendingViewportRestore=null;$('#zoom-back').disabled=true;
 for(const k of Object.keys(pos))delete pos[k];
 for(const k of Object.keys(expanded))delete expanded[k];
 state.selected=null;state.fk=false;state.after=false;state.q='Q05';fitMode=true;update();});
$('#theme').addEventListener('click',()=>{const dark=document.body.dataset.theme==='dark';document.body.dataset.theme=dark?'light':'dark';$('#theme').textContent=dark?'어두운 화면':'밝은 화면';drawLinks();});
$('#query-picker').innerHTML=EVIDENCE.queries.map(q=>'<option value="'+q.id+'">'+q.id+' · '+esc(titleOf(q))+'</option>').join('');
addEventListener('resize',()=>layoutCards());
$('#scene').addEventListener('scroll',drawLinks,true);
$('#relation-key').innerHTML=relations.map(r=>'<span style="color:var(--'+r.id+')"><i aria-hidden="true"></i><b>'+r.id+'</b> '+esc(r.parent+'.'+r.key+' → '+r.child+'.'+r.column)+'</span>').join('');
document.fonts&&document.fonts.ready.then(()=>layoutCards());
update();
window.__b6={state:()=>state,pos:()=>pos,zoom:()=>zoom,fit:()=>fitMode,graph:()=>routedGraph,error:()=>layoutError,rows:()=>Object.fromEntries(names.map(t=>[t,(data()[t]||[]).length])),targets:()=>targetRows(),lines:()=>document.querySelectorAll('#links path.link').length};
