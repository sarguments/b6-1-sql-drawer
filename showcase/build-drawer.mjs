import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const evidence = readFileSync(join(here,'evidence.json'),'utf8').replace(/</g,'\\u003c');
const client = readFileSync(join(here,'showcase-client.js'),'utf8').replace(/<\/(script)/gi,'<\\/$1');
const elkSource = readFileSync(join(here,'vendor/elkjs/lib/elk.bundled.js'),'utf8').replace(/<\/(script)/gi,'<\\/$1');
const elkLicense = readFileSync(join(here,'vendor/elkjs/LICENSE.md'),'utf8').replace(/<\/(script)/gi,'<\\/$1');
const prismSource = ['prism-core.min.js','prism-sql.min.js'].map(name=>readFileSync(join(here,'vendor/prismjs/components',name),'utf8')).join('\n').replace(/<\/(script)/gi,'<\\/$1');
const prismLicense = readFileSync(join(here,'vendor/prismjs/LICENSE'),'utf8').replace(/<\/(script)/gi,'<\\/$1');
const dark = process.argv.includes('--dark');
const css = `
*{box-sizing:border-box}
html,body{overflow-x:hidden}
body{margin:0;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;background:var(--bg);color:var(--fg);
 --fg:#1e2227;--muted:#5c636b;--border:#d2d7dd;--surface:#fff;--bg:#fafbfc;--accent:#b12a34;--wash:#f1f3f5;--fk:#1a539f;--on:#fff3d6;--sel:#dcecff}
body[data-theme=dark]{--fg:#eef1f5;--muted:#aab2bb;--border:#525b66;--surface:#171b21;--bg:#0f1217;--accent:#ff9aa3;--wash:#212730;--fk:#8ab4ff;--on:#463a1c;--sel:#213c5c}
body{--R1:#2563a6;--R2:#087568;--R3:#8750b4;--R4:#a15c00}
body[data-theme=dark]{--R1:#8bbcff;--R2:#6bd9c1;--R3:#cfadff;--R4:#f4c06b}
[hidden]{display:none!important}
button,select{font:inherit;color:var(--fg);border:1px solid var(--border);background:var(--surface);padding:8px 12px;min-height:40px;cursor:pointer;border-radius:2px}
button:hover{border-color:var(--accent)}
button[aria-pressed=true]{border-color:var(--accent);box-shadow:inset 0 -3px var(--accent)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
main{max-width:1720px;margin:0 auto;padding:22px}
h1{font-size:26px;margin:0 0 6px;letter-spacing:-.02em}
h2{font-size:18px;margin:0 0 10px}
h3{font-size:15px;margin:14px 0 8px}
p{margin:6px 0 12px}a{color:var(--accent)}
code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:14px;border:1px solid var(--border);background:var(--surface);margin-bottom:18px}
.bar .grow{flex:0 0 100%;min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px}
.bar button,.bar select{height:40px;min-height:40px;line-height:20px;margin:0}
.bar button{white-space:nowrap}
#zoom-back:disabled{opacity:.5;cursor:default}
#before-after{display:flex;flex-wrap:wrap;gap:10px}
.zoombadge{font:600 12.5px ui-monospace,monospace;color:var(--muted);min-width:44px;text-align:center}
.bar label{font-size:14px;color:var(--muted);white-space:nowrap}
#query-picker{display:block;width:100%;max-width:560px;min-width:0;font-size:14px}
#query-explanation{flex:0 0 100%;min-width:0;margin:0;color:var(--muted);font-size:13px;line-height:1.6;overflow-wrap:anywhere}
.body{display:grid;grid-template-columns:minmax(0,1fr) 340px;min-width:0;gap:22px;align-items:start}
.scene{position:relative;height:min(80vh,940px);max-width:100%;overflow:auto;overscroll-behavior:contain;border:1px solid var(--border);background:var(--surface);background-image:radial-gradient(var(--border) .7px,transparent .7px);background-size:22px 22px;cursor:grab}
.scene.panning{cursor:grabbing}
.er-grid,.board{position:relative;transform-origin:0 0;will-change:transform}
.tbl{position:absolute;left:0;top:0;margin:0;background:var(--surface);border:1px solid var(--border);border-radius:3px;width:max-content;box-shadow:0 1px 2px rgba(0,0,0,.08);transition:none}
.tbl figcaption{min-height:80px;padding:9px 12px;border-bottom:1px solid var(--border);background:var(--wash);cursor:zoom-in;user-select:none}
.tbl .table-focus{display:block;width:100%;min-height:0;padding:0;border:0;background:none;text-align:left;font:inherit;cursor:zoom-in}
.tbl figcaption b{font-family:ui-monospace,monospace;font-size:14px}
.tbl figcaption span{display:block;color:var(--muted);font-size:12px}
.tbl .rows{overflow:visible}
.tbl table{border-collapse:collapse;font-size:11.5px;font-variant-numeric:tabular-nums;line-height:1.35}
.tbl th,.tbl td{border-bottom:1px solid var(--border);border-right:1px solid var(--border);padding:3px 8px;text-align:left;white-space:nowrap}
.tbl th:last-child,.tbl td:last-child{border-right:0}
.tbl th{background:var(--wash);vertical-align:top;font-weight:600}
.tbl th .cname{display:block;font-family:ui-monospace,monospace}
.tbl th .ctype{display:block;color:var(--muted);font-weight:400;font-size:10.5px}
.badge{font-style:normal;font-family:ui-monospace,monospace;font-size:9.5px;padding:0 4px;border:1px solid currentColor;border-radius:2px;margin-top:3px;display:inline-block}
.badge.pk{color:var(--muted)}.badge.fk{color:var(--fk)}
.tbl td.fk{background:color-mix(in srgb,var(--fk) 8%,transparent)}
.cell{display:inline-block;padding:1px 2px}
.cell.id,.cell.ref{min-height:0;padding:1px 4px;border:0;background:none;font:inherit;border-radius:2px}
.cell.id{color:var(--fg);cursor:pointer}          /* 기본 본문색을 써서 모든 상태 배경에서 대비를 확보한다 */
.rowmark{display:inline-block;min-width:9px;font-style:normal;line-height:1;color:var(--fg)}
.cell.ref{color:var(--fk);text-decoration:underline;text-underline-offset:2px;cursor:pointer}
tr.hit td{background:color-mix(in srgb,var(--fk) 15%,transparent);box-shadow:inset 3px 0 0 var(--fk)}
tr.grp td{background:color-mix(in srgb,var(--fk) 12%,transparent)}
tr.del td{background:color-mix(in srgb,var(--accent) 11%,transparent);text-decoration:line-through}
tr.on td{background:var(--on)}
tr.sel td{background:var(--sel);font-weight:600}
#links{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}
.link{fill:none;stroke-linejoin:round}
.link.rel{stroke-width:1.8;stroke-dasharray:6 5}
.link.row{stroke-width:2.5}
.port-label{font:600 12px ui-monospace,monospace;paint-order:stroke;stroke:var(--surface);stroke-width:4px}
.relation-key{display:flex;flex-wrap:wrap;gap:8px 24px;margin:0 0 10px;font-size:12px}
.relation-key span{display:inline-flex;align-items:center;gap:6px}
.relation-key i{width:24px;border-top:2px dashed currentColor}
.relation-key b{font-family:ui-monospace,monospace}
.line-key{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--muted);margin:0 0 6px}
.delete-key{color:var(--accent);font-weight:700}
.side{align-self:start;position:sticky;top:16px;z-index:20;border:1px solid var(--border);background:var(--surface);padding:16px;max-height:calc(100vh - 40px);overflow:auto}
.side dl{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;margin:0 0 6px;font-size:12.5px}
.side dt{font-family:ui-monospace,monospace;color:var(--muted)}
.side dd{margin:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.side pre{white-space:pre-wrap;background:var(--wash);border:1px solid var(--border);padding:10px;font-size:12px;border-radius:2px}
.go,.link-go{min-height:0;padding:1px 6px;border:0;background:none;color:var(--accent);text-decoration:underline;font-size:12.5px}
.hintline{background:var(--wash);border-left:3px solid var(--accent);padding:8px 10px;font-size:13px;margin:0 0 12px}
.muted{color:var(--muted)}
.count{font-family:ui-monospace,monospace}
#sql-wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px;margin:22px 0}
#sql-wrap article{border:1px solid var(--border);background:var(--surface);padding:16px;min-width:0}
#sql pre{overflow:auto;max-width:100%;padding:14px;background:var(--wash);border:1px solid var(--border);font-size:13px;line-height:1.65;tab-size:4}
#sql code{font:inherit;white-space:pre}
#sql .token.keyword{color:#6f329c;font-weight:600}
#sql .token.string{color:#176b35}
#sql .token.number{color:#9c4313}
#sql .token.function{color:#2059a0}
#sql .token.comment{color:var(--muted);font-style:italic}
#sql .token.operator,#sql .token.punctuation{color:var(--muted)}
body[data-theme=dark] #sql .token.keyword{color:#d6a7ff}
body[data-theme=dark] #sql .token.string{color:#9cda9b}
body[data-theme=dark] #sql .token.number{color:#ffbc88}
body[data-theme=dark] #sql .token.function{color:#8bbcff}
.scroll{overflow:auto;max-height:320px;border:1px solid var(--border);border-radius:2px}
.scroll table{border-collapse:collapse;width:100%;font-size:12px;font-variant-numeric:tabular-nums}
.scroll th,.scroll td{padding:6px 10px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap}
.scroll th{background:var(--wash);font-family:ui-monospace,monospace;position:sticky;top:0}
#diagram-status{color:var(--accent);font-size:12.5px;margin:6px 0}
footer{color:var(--muted);font-size:12.5px;margin:22px 0 0;border-top:1px solid var(--border);padding-top:14px}
@media(max-width:1080px){.body,#sql-wrap{grid-template-columns:minmax(0,1fr)}.side{position:static;max-height:none}}
@media(max-width:640px){main{padding:10px}.body{grid-template-columns:minmax(0,1fr)}.scene{height:min(70vh,600px)}.tbl table{font-size:10.5px}.tbl th,.tbl td{padding:3px 6px}.bar{gap:6px}.bar button{padding:6px 8px;font-size:12.5px}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>B6-1 · 설비·정비 데이터 한눈에 보기</title><style>${css}</style></head><body data-theme="${dark?'dark':'light'}"><main>
<h1>설비·정비 데이터 한눈에 보기</h1>
<div class="bar">
 <div class="grow"><label for="query-picker">쿼리</label><select id="query-picker"></select></div>
 <p id="query-explanation" aria-label="선택한 쿼리 설명"></p>
 <div id="before-after" hidden><button id="before" aria-pressed="true">변경 전</button><button id="after" aria-pressed="false">변경 후</button></div>
 <button id="expand-all">모두 보기</button>
 <button id="zoom-out">축소 −</button>
 <span id="zoom-value" class="zoombadge">100%</span>
 <button id="zoom-in">확대 +</button>
 <button id="zoom-reset">100%</button>
 <button id="zoom-back" aria-keyshortcuts="Escape" disabled>확대 전으로 (Esc)</button>
 <button id="reset">처음 상태로</button>
 <button id="fk-check" aria-pressed="false">없는 설비 번호 넣기</button>
 <button id="theme">${dark?'밝은 화면':'어두운 화면'}</button>
</div>
<div class="relation-key" id="relation-key" aria-label="표 관계"></div>
<div aria-label="행과 연결선 범례">
 <p class="line-key"><b>행</b><strong class="delete-key">✕ 빨간 취소선: 삭제 대상</strong><span>◉ 선택한 행</span><span>↑ 부모 행</span><span>● 조회 결과</span><span>Σ 집계 기준 행</span></p>
 <p class="line-key"><b>선</b><span>점선: 부모 → 자식(1:N)</span><span>실선: 선택한 자식 행 → 부모 행</span></p>
</div>
<p id="diagram-status" role="status" hidden></p>
<div class="body">
 <section class="scene" id="scene" role="region" aria-label="테이블과 관계선" tabindex="0"><div class="er-grid" id="board"></div><svg id="links" aria-hidden="true"></svg></section>
 <aside class="side">
  <h2 id="table-heading"></h2>
  <div id="detail"></div>
 </aside>
</div>
<section id="sql-wrap" aria-label="SQL과 실행 결과"><article><h2>SQL</h2><div id="sql"></div></article><article><h2>실행 결과</h2><p id="query-note" class="muted"></p><div id="results"></div></article></section>
<footer><details><summary>자료 출처·라이선스</summary><p>SQL 결과: 메모리 SQLite ${JSON.parse(evidence).sqlite} 실행 기록. 브라우저는 저장된 결과를 표시하며 원본 DB를 변경하지 않습니다.</p><p>배치 엔진: <a href="https://github.com/kieler/elkjs/tree/ff5771d7165445c42c408bb8a090c8035272218c">ELK.js 0.12.0</a> · EPL-2.0. 라이선스 전문은 이 HTML의 elk-license 항목에 포함되어 있습니다.</p><p>SQL 구문 강조: <a href="https://github.com/PrismJS/prism/tree/v1.30.0">Prism.js 1.30.0</a> · MIT. 라이선스 전문은 prism-license 항목에 포함되어 있습니다.</p><p>수정 모델: <code>openai-codex/gpt-6.1-sol</code> · 직접 수정·브라우저 확인.</p></details></footer>
</main><script id="elk-license" type="text/plain">${elkLicense}</script><script id="prism-license" type="text/plain">${prismLicense}</script><script>${elkSource}</script><script>window.Prism={manual:true};${prismSource}</script><script id="evidence" type="application/json">${evidence}</script><script>${client}</script></body></html>`;
const filename=dark?'drawer.html':'drawer-light.html';
writeFileSync(join(here,filename),html);
console.log('생성:',filename,'·',Buffer.byteLength(html),'바이트');
