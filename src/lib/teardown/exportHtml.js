// 작동 원리 3D 를 인터넷 없이 열리는 HTML 한 파일로 저장한다 (미팅룸 PC·USB·메일 첨부용).
// three.js 원본과 작동 원리 엔진(engine.js 원본 그대로)을 파일 안에 넣고, 열 때 blob 주소로 모듈을 이어 붙여 불러온다.
// 무거운 원본(약 0.8 MB)은 이 파일을 불러올 때만 내려받는다 (화면에서 동적 import).
import coreSrc from '../../../node_modules/three/build/three.core.min.js?raw';
import moduleSrc from '../../../node_modules/three/build/three.module.min.js?raw';
import orbitSrc from '../../../node_modules/three/examples/jsm/controls/OrbitControls.js?raw';
import roundedSrc from '../../../node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js?raw';
import engineSrc from './engine.js?raw';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// <script type="text/plain"> 안에 넣을 원본: 닫는 태그가 섞이면 HTML 이 깨지므로 확인한다
const plain = (id, src) => {
  if (/<\/script/i.test(src)) throw new Error(`${id}: 원본에 </script 가 있어 넣을 수 없습니다`);
  return `<script type="text/plain" id="${id}">${src}</script>`;
};
// JSON 데이터: '<' 를 < 로 바꿔 스크립트가 일찍 닫히지 않게
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

const CSS = `
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{font-family:system-ui,-apple-system,"Segoe UI","Apple SD Gothic Neo","Malgun Gothic",sans-serif;background:#f1f4f8;color:#0f172a}
.app{display:grid;grid-template-columns:1fr 300px;gap:16px;max-width:1400px;margin:0 auto;padding:16px;min-height:100%}
header{grid-column:1/-1;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
h1{font-size:20px;margin:0}.sub{color:#64748b;font-size:13px}
.stage{position:relative;height:min(68vh,640px);border-radius:16px;border:1px solid #dbe2ea;background:linear-gradient(#f4f6f9,#e3e8ef);overflow:hidden}
.chips{position:absolute;left:12px;top:12px;display:flex;gap:6px;flex-wrap:wrap;z-index:2}
.chip{border:1px solid #cbd5e1;background:rgba(255,255,255,.88);border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer;color:#0f172a}
.chip.on{background:#2563eb;border-color:#2563eb;color:#fff}
.ex{position:absolute;right:12px;top:12px;z-index:2;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.88);border:1px solid #cbd5e1;border-radius:999px;padding:6px 12px;font-size:13px}
.cap{margin-top:12px;background:#fff;border:1px solid #dbe2ea;border-radius:16px;padding:14px 16px}
.cap .t{font-weight:700;font-size:16px;display:flex;gap:8px;align-items:baseline}.cap .n{color:#64748b;font-size:12px;font-weight:500}
.cap p{margin:6px 0 0;font-size:14px;line-height:1.6;color:#334155;min-height:44px}
.bar{height:3px;background:#e2e8f0;border-radius:2px;margin-top:10px;overflow:hidden}.bar i{display:block;height:100%;width:0;background:#2563eb}
.ctl{display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap}
.btn{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:7px 12px;font-size:13px;cursor:pointer;color:#0f172a}
.btn.p{background:#2563eb;border-color:#2563eb;color:#fff}
.legend{display:flex;gap:10px;flex-wrap:wrap;margin-left:auto;font-size:12px;color:#475569}.legend b{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;vertical-align:-1px}
aside{display:flex;flex-direction:column;gap:12px}
.box{background:#fff;border:1px solid #dbe2ea;border-radius:16px;padding:10px}
.box h2{font-size:12px;color:#64748b;margin:4px 6px 6px;font-weight:600}
.step{display:flex;gap:8px;width:100%;text-align:left;border:0;background:none;padding:8px;border-radius:10px;cursor:pointer;font-size:13px;color:#0f172a}
.step:hover{background:#f1f5f9}.step.on{background:#eff6ff;color:#1d4ed8;font-weight:600}.step span{color:#94a3b8;min-width:18px}
.sys{display:flex;flex-wrap:wrap;gap:6px;padding:0 4px 4px}
.foot{grid-column:1/-1;color:#94a3b8;font-size:12px;text-align:center}
.err{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#b91c1c;font-size:14px;padding:24px;text-align:center}
@media (max-width:900px){.app{grid-template-columns:1fr}.stage{height:56vh}}
`;

const BOOT = `
const T=(id)=>document.getElementById(id).textContent;
const U=(s)=>URL.createObjectURL(new Blob([s],{type:'text/javascript'}));
const D=JSON.parse(T('td-data'));
const $=(id)=>document.getElementById(id);
try{
  const core=U(T('src-core'));
  const mod=U(T('src-module').split('"./three.core.min.js"').join(JSON.stringify(core)));
  const fix=(s)=>s.split("from 'three'").join('from '+JSON.stringify(mod));
  const [THREE,{OrbitControls},{RoundedBoxGeometry},{createTeardown}]=await Promise.all([import(mod),import(U(fix(T('src-orbit')))),import(U(fix(T('src-rounded')))),import(U(T('src-engine')))]);
  const FLOW={power:['전원','#f59e0b'],signal:['신호','#0ea5e9'],light:['빛','#facc15'],air:['바람','#22d3ee'],heat:['열','#ef4444'],sound:['소리','#a78bfa'],water:['물','#3b82f6']};
  const VIEW={solid:'실물',glass:'투명 외장',section:'단면'};
  const list=$('steps');
  D.tour.steps.forEach((s,i)=>{const b=document.createElement('button');b.className='step';b.innerHTML='<span>'+(i+1)+'</span>';b.appendChild(document.createTextNode(s.title));b.onclick=()=>api.goto(i,{play:false});list.appendChild(b);});
  const sys=$('sys');
  (D.systems||[]).forEach((s)=>{const b=document.createElement('button');b.className='chip';b.textContent=s.title;b.onclick=()=>api.show(s);sys.appendChild(b);});
  if(!(D.systems||[]).length) sys.parentElement.style.display='none';
  const views=$('views');
  Object.entries(VIEW).forEach(([k,l])=>{const b=document.createElement('button');b.className='chip';b.dataset.v=k;b.textContent=l;b.onclick=()=>api.setView(k);views.appendChild(b);});
  const render=(st)=>{
    const s=st.step||{};
    $('title').textContent=s.title||'';$('num').textContent=st.index>=0?(st.index+1)+' / '+st.count:'';
    $('caption').textContent=s.caption||'';
    $('play').textContent=st.playing?'일시정지':'재생';
    [...list.children].forEach((b,i)=>b.classList.toggle('on',i===st.index));
    [...views.children].forEach((b)=>b.classList.toggle('on',b.dataset.v===st.view));
    $('ex').value=Math.round(st.explode*100);
    const kinds=[...new Set((s.flows||[]).map((f)=>f.kind))];
    $('legend').innerHTML=kinds.map((k)=>'<span><b style="background:'+FLOW[k][1]+'"></b>'+FLOW[k][0]+'</span>').join('');
  };
  const api=createTeardown($('stage'),{THREE,OrbitControls,RoundedBoxGeometry},{parts:D.parts,tour:D.tour,title:D.title,onChange:render,onProgress:(p)=>{$('bar').style.width=(p*100)+'%';}});
  $('prev').onclick=()=>api.prev();$('next').onclick=()=>api.next();$('play').onclick=()=>api.toggle();
  $('ex').oninput=(e)=>api.setExplode(e.target.value/100);
  $('labels').onclick=(e)=>{const m={focus:'all',all:'off',off:'focus'}[api.getState().labels];api.setLabels(m);e.target.textContent={focus:'이름표: 강조 부품',all:'이름표: 전체',off:'이름표: 끔'}[m];};
  render(api.getState());
}catch(e){$('stage').innerHTML='<div class="err">3D 를 열지 못했습니다: '+String(e&&e.message||e).replace(/</g,'&lt;')+'<br>최신 Chrome·Edge·Safari 로 열어 주세요.</div>';}
`;

/**
 * @param {{ title, parts, tour, systems, overall, note }} data
 * @returns {string} HTML 한 파일
 */
export function teardownHtml({ title = '', parts = [], tour, systems = [], overall = null, note = '' }) {
  const size = overall?.x ? `약 ${Math.round(overall.x)} × ${Math.round(overall.z)} × ${Math.round(overall.y)} mm · ` : '';
  const data = { title, parts, tour, systems };
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title || '작동 원리')} — 작동 원리 3D</title><style>${CSS}</style></head>
<body><div class="app">
<header><h1>${esc(title || '작동 원리')}</h1><span class="sub">${esc(size)}부품 ${parts.length}개 · 끌어서 돌리고, 휠로 확대합니다</span></header>
<main>
  <div class="stage" id="stage"><div class="chips" id="views"></div><label class="ex">분해 <input id="ex" type="range" min="0" max="100" value="0"></label></div>
  <div class="cap"><div class="t"><span id="title"></span><span class="n" id="num"></span></div><p id="caption"></p><div class="bar"><i id="bar"></i></div>
    <div class="ctl"><button class="btn" id="prev">이전</button><button class="btn p" id="play">재생</button><button class="btn" id="next">다음</button><button class="btn" id="labels">이름표: 강조 부품</button><div class="legend" id="legend"></div></div></div>
</main>
<aside><div class="box"><h2>단계</h2><div id="steps"></div></div><div class="box"><h2>부분별로 보기</h2><div class="sys" id="sys"></div></div></aside>
<div class="foot">${esc(note || '컨셉 단계의 개념 시각화입니다. 실제 설계·치수와 다를 수 있습니다.')}</div>
</div>
<script type="application/json" id="td-data">${json(data)}</script>
${plain('src-core', coreSrc)}
${plain('src-module', moduleSrc)}
${plain('src-orbit', orbitSrc)}
${plain('src-rounded', roundedSrc)}
${plain('src-engine', engineSrc)}
<script type="module">${BOOT}</script>
</body></html>`;
}

/** 브라우저에서 파일로 내려받기 */
export function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export const safeFileName = (s) => String(s || '작동원리').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || '작동원리';
