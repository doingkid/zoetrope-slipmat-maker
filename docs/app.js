'use strict';

const SOURCE_COUNT = 54;
const DIAMETER_MM = 304.8;
const THEMES = {
  reggae: ['#2ab553', '#dd3736', '#f7ca43'],
  neon: ['#00ebdc', '#f52bb7', '#f7ed37'],
  ocean: ['#2dd3cd', '#1f6bd7', '#b5f2f6'],
  sunset: ['#f5692f', '#b93790', '#ffcf55'],
  monochrome: ['#e1e1e1', '#808080', '#ffffff'],
};
const $ = id => document.getElementById(id);
const state = { frames: null, footFraction: 1, previewDisc: null, generation: 0,
                started: performance.now(), lastFrame: -1, exporting: false };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const countFor = rpm => rpm === '45' ? 40 : 54;
const sourceIndex = (i, count) => Math.round(i * SOURCE_COUNT / count) % SOURCE_COUNT;
const rad = degrees => degrees * Math.PI / 180;

function status(id, message, error = false) {
  $(id).textContent = message;
  $(id).classList.toggle('error', error);
}
function resetFrames() {
  state.generation++;
  state.frames = null;
  state.previewDisc = null;
  $('make-frames').disabled = !($('image-file').files.length || $('zip-file').files.length);
  for (const id of ['download-zip', 'download-png', 'download-proof']) $(id).disabled = true;
  $('frames-preview').hidden = true;
  const small=$('size-canvas').getContext('2d');
  small.clearRect(0,0,320,320);
  small.fillStyle='#555';small.textAlign='center';small.font='15px sans-serif';
  small.fillText('コマを作ると表示されます',160,160);
  status('output-status', 'コマを作ると、ここで回転を確認できます。');
}
function imageFromBlob(blob) {
  return createImageBitmap(blob);
}
function alphaBounds(img) {
  const c = canvas(img.width, img.height);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
  let left = c.width, top = c.height, right = -1, bottom = -1, hasTransparency = false;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const alpha = pixels[(y * c.width + x) * 4 + 3];
    if (alpha < 255) hasTransparency = true;
    if (alpha > 8) {
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) throw new Error('画像が透明で、キャラが見つかりません。');
  return { left, top, width: right - left + 1, height: bottom - top + 1,
           bottom: bottom + 1, hasTransparency };
}
function scaledImage(img, maxSide = 850) {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const out = canvas(Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));
  out.getContext('2d').drawImage(img, 0, 0, out.width, out.height);
  return out;
}
async function framesFromImage(file, motion, token) {
  const original = await imageFromBlob(file);
  if (original.width * original.height > 16000000) { original.close(); throw new Error('画像が大きすぎます。1600万画素以下を選んでください。'); }
  const img = scaledImage(original, 650); original.close();
  const box = alphaBounds(img);
  const w = Math.ceil(box.width * 1.35), h = Math.ceil(box.height * 1.32);
  const foot = h * .88;
  const frames = [];
  for (let i = 0; i < SOURCE_COUNT; i++) {
    if (token !== state.generation) return null;
    const phase = 2 * Math.PI * i / SOURCE_COUNT;
    const c = canvas(w, h), ctx = c.getContext('2d');
    const sway = motion !== 'bounce';
    const jump = motion !== 'sway';
    const lean = sway ? rad(6.5 * Math.sin(phase)) : 0;
    const shift = sway ? box.width * .025 * Math.sin(phase) : 0;
    const lift = jump ? box.height * .07 * (1 - Math.cos(2 * phase)) / 2 : 0;
    ctx.translate(w / 2 + shift, foot - lift);
    ctx.rotate(lean);
    ctx.drawImage(img, -box.left - box.width / 2, -box.bottom, img.width, img.height);
    frames.push(c);
  }
  return { frames, footFraction: foot / h };
}
async function framesFromZip(file, token) {
  const entries = await ZipFiles.read(file);
  const names = Object.keys(entries).filter(name => !name.endsWith('/') &&
    !name.startsWith('__MACOSX/') && !name.split('/').pop().startsWith('.'));
  const numbered = new Map();
  for (const name of names) {
    const match = /^(\d{1,3})\.png$/i.exec(name.split('/').pop());
    if (!match) throw new Error(`ZIP内に連番PNG以外のファイルがあります: ${name}`);
    const num = Number(match[1]);
    if (num < 1 || num > SOURCE_COUNT || numbered.has(num)) throw new Error(`コマ番号が不正か重複しています: ${name}`);
    if (entries[name].length > 20_000_000) throw new Error(`${name}が20MBを超えています。`);
    numbered.set(num, entries[name]);
  }
  if (numbered.size !== SOURCE_COUNT) throw new Error('ZIPには001.png〜054.pngを各1枚入れてください。');
  const frames = [];
  let dimensions = null, foot = 0;
  for (let i = 1; i <= SOURCE_COUNT; i++) {
    if (token !== state.generation) return null;
    const img = await imageFromBlob(new Blob([numbered.get(i)], { type: 'image/png' }));
    if (!dimensions) dimensions = [img.width, img.height];
    if (img.width !== dimensions[0] || img.height !== dimensions[1]) { img.close(); throw new Error('全コマのキャンバスの大きさを揃えてください。'); }
    if (img.width * img.height > 16_000_000) { img.close(); throw new Error('各コマは1600万画素以下にしてください。'); }
    const frame = scaledImage(img); img.close();
    const box = alphaBounds(frame);
    if (!box.hasTransparency) throw new Error(`${String(i).padStart(3,'0')}.png に透過部分がありません。`);
    foot = Math.max(foot, box.bottom / frame.height);
    frames.push(frame);
    if (i % 9 === 0) { status('source-status', `ZIPを読み込み中… ${i}/54枚`); await new Promise(resolve => setTimeout(resolve, 0)); }
  }
  return { frames, footFraction: foot };
}

function outerGeometry(sw, sh, size, count) {
  const cap = size / 2 - 3 / DIAMETER_MM * size;
  const maxHeight = 42 / DIAMETER_MM * size;
  let lo = 0, hi = Math.min(maxHeight / sh, (cap - 1) / sh);
  const sector = 2 * Math.PI / count * .90;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const halfAngle = Math.atan2(sw * mid / 2, cap - sh * mid);
    if (2 * halfAngle <= sector) lo = mid; else hi = mid;
  }
  const w = Math.max(1, Math.floor(sw * lo)), h = Math.max(1, Math.floor(sh * lo));
  return { w, h, radius: cap - h / 2, cap };
}
function innerGeometry(sw, sh, size, count, footFraction) {
  const edge = size * 7 / 24, unit = size / 3600;
  const sectorWidth = 2 * edge * Math.tan(Math.PI / count) * .82;
  const scale = Math.min(260 * unit / sh, sectorWidth / sw);
  const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
  return { w, h, radius: edge + 12 * unit + h * footFraction - h / 2, edge };
}
function centerGeometry(sw, sh, size, count) {
  const unit = size / 3600;
  const cap = size * 7 / 24 - 36 * unit;
  const sectorWidth = 2 * cap * Math.tan(Math.PI / count) * .82;
  const scale = Math.min(190 * unit / sh, sectorWidth / sw);
  const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
  return { w, h, radius: cap - h / 2, cap };
}
function circle(ctx, x, y, r, color, width) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function fillPoly(ctx, points, color) {
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function drawPattern(ctx, size, limit, count, theme, density = 1, stroke = 1, motif = 1) {
  const u = size / 3600, mid = size / 2, outer = limit - 45 * u;
  if (outer < 650 * u) return;
  const [green, red, gold] = THEMES[theme];
  const widthFor = width => Math.max(2, width * u * stroke);
  const point = (f, a) => [mid + outer * f * Math.sin(rad(a)), mid - outer * f * Math.cos(rad(a))];
  for (const [f, width, color] of [[1,13,green],[.955,6,red],[.805,12,gold],[.785,6,green],[.625,14,red],[.60,5,gold],[.44,13,green],[.42,5,red],[.255,11,gold],[.14,9,red]])
    circle(ctx, mid, mid, outer * f, color, widthFor(width));
  const repeats = Math.max(1, Math.round(count * density));
  for (let i = 0; i < repeats; i++) {
    const a = i * 360 / repeats;
    const poly = (pairs, color) => fillPoly(ctx, pairs.map(([f, delta]) => point(f, a + delta * motif)), color);
    poly([[.925,-2.35],[.99,0],[.925,2.35],[.955,0]], green);
    poly([[.83,0],[.865,2],[.83,4],[.795,2]], red);
    poly([[.715,-2.1],[.76,0],[.715,2.1],[.67,0]], green);
    poly([[.545,0],[.585,2],[.545,4],[.505,2]], gold);
    for (const [f,r,color] of [[.355,12,green],[.185,9,gold]]) {
      const [x,y] = point(f,a); ctx.beginPath(); ctx.arc(x,y,Math.max(2,r*u*motif),0,2*Math.PI); ctx.fillStyle=color; ctx.fill();
    }
    if (theme !== 'reggae') {
      poly([[.34,-1.6],[.39,0],[.34,1.6],[.29,0]], red);
      ctx.beginPath(); ctx.moveTo(...point(.12,a-1.2*motif));ctx.lineTo(...point(.22,a+1.2*motif));
      ctx.strokeStyle=green;ctx.lineWidth=widthFor(3);ctx.stroke();
    }
  }
}
function drawRing(ctx, frames, size, geometry, count, sign, positions) {
  const center = size / 2;
  for (let i = 0; i < count; i++) {
    const bearing = sign * i * 2 * Math.PI / count;
    const x = center + geometry.radius * Math.sin(bearing);
    const y = center - geometry.radius * Math.cos(bearing);
    ctx.save(); ctx.translate(x,y); ctx.rotate(bearing);
    ctx.drawImage(frames[sourceIndex(i,count)], -geometry.w/2,-geometry.h/2,geometry.w,geometry.h);
    ctx.restore();
    if (positions) positions.push({ x, y, number: i+1 });
  }
}
function drawArtwork(size, proof = false) {
  if (!state.frames) throw new Error('コマがありません。');
  const c = canvas(size,size), ctx = c.getContext('2d');
  const mid = size / 2, u = size / 3600;
  const background = $('background').value;
  if (background === 'white') { ctx.fillStyle='#fff'; ctx.fillRect(0,0,size,size); }
  ctx.save(); ctx.beginPath();ctx.arc(mid,mid,mid-.5,0,2*Math.PI);ctx.clip();
  ctx.fillStyle = background === 'white' ? '#fff' : '#000';ctx.fillRect(0,0,size,size);
  const [sw,sh] = [state.frames[0].width,state.frames[0].height];
  const outerCount = countFor($('outer-rpm').value), innerCount = countFor($('inner-rpm').value);
  const centerCount = countFor($('center-rpm').value);
  const outerBase = outerGeometry(sw,sh,size,outerCount);
  const outerScale = Number($('outer-size').value) / 100;
  const outer = { ...outerBase, w:outerBase.w*outerScale, h:outerBase.h*outerScale,
                  radius:outerBase.cap-outerBase.h*outerScale/2 };
  const innerBase = $('inner-ring').checked ? innerGeometry(sw,sh,size,innerCount,state.footFraction) : null;
  const innerScale = Number($('inner-size').value) / 100;
  const inner = innerBase && { ...innerBase, w:innerBase.w*innerScale, h:innerBase.h*innerScale,
                  radius:innerBase.edge+12*u+innerBase.h*innerScale*(state.footFraction-.5) };
  const centerBase = $('center-ring').checked ? centerGeometry(sw,sh,size,centerCount) : null;
  const centerScale = Number($('center-size').value) / 100;
  const center = centerBase && { ...centerBase, w:centerBase.w*centerScale, h:centerBase.h*centerScale,
                   radius:centerBase.cap-centerBase.h*centerScale/2 };
  if ($('pattern').checked) {
    const density=Number($('pattern-density').value)/100, stroke=Number($('pattern-width').value)/100;
    const motif=Number($('pattern-motif').value)/100;
    drawPattern(ctx,size,center ? center.radius-center.h/2-12*u : inner ? inner.edge-8*u : outer.cap-outer.h,
                center ? centerCount : inner ? innerCount : outerCount,$('theme').value,density,stroke,motif);
    if (center) {
      const start=center.radius+center.h/2+12*u;
      const end=inner ? inner.edge-20*u : outer.cap-outer.h-15*u;
      if (end>start) {
        const [green,red,gold]=THEMES[$('theme').value],span=end-start;
        for (const [f,w,color] of [[.25,9,green],[.55,7,red],[.82,10,gold]])
          circle(ctx,mid,mid,start+f*span,color,Math.max(2,w*u*stroke));
      }
    }
    if (inner) {
      const start=inner.radius+inner.h/2+15*u, end=outer.cap-outer.h-15*u;
      if (end > start) {
        const [green,red,gold]=THEMES[$('theme').value],span=end-start;
        for (const [f,w,color] of [[.16,11,green],[.36,8,gold],[.56,13,red],[.78,7,gold]])
          circle(ctx,mid,mid,start+f*span,color,Math.max(2,w*u*stroke));
      }
    }
  }
  const positions=[];
  drawRing(ctx,state.frames,size,outer,outerCount,-1,proof ? positions : null);
  if (inner) drawRing(ctx,state.frames,size,inner,innerCount,-1,null);
  if (center) drawRing(ctx,state.frames,size,center,centerCount,-1,null);
  ctx.restore();
  if (background==='white') circle(ctx,mid,mid,mid-.5,'#000',Math.max(2,size/900));
  ctx.beginPath();ctx.arc(mid,mid,Math.max(1,size/DIAMETER_MM/2),0,2*Math.PI);
  ctx.fillStyle=background==='white'?'#000':'#fff';ctx.fill();
  if (proof) {
    ctx.fillStyle=background==='white'?'#000':'#ffeb59';ctx.font=`bold ${Math.max(12,size/105)}px sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    const labelR=outer.cap-outer.h-Math.max(25,size/80);
    for (let i=0;i<outerCount;i++) {
      const bearing=-i*2*Math.PI/outerCount;
      ctx.fillText(String(i+1),mid+labelR*Math.sin(bearing),mid-labelR*Math.cos(bearing));
    }
    if (inner) circle(ctx,mid,mid,inner.edge,ctx.fillStyle,Math.max(2,size/900));
  }
  return c;
}
function updatePreview() {
  if (!state.frames) return;
  try {
    state.previewDisc = drawArtwork(1200);
    const small=$('size-canvas').getContext('2d');
    small.clearRect(0,0,320,320);small.drawImage(state.previewDisc,0,0,320,320);
    status('output-status','30fpsの回転プレビューを表示しています。');
  }
  catch (error) { status('output-status',error.message,true); }
}
function previewLoop(now) {
  const frame = Math.floor((now-state.started)*30/1000);
  if (frame !== state.lastFrame) {
    state.lastFrame=frame;
    if (state.frames) {
      const character=$('character-canvas').getContext('2d');
      character.clearRect(0,0,280,280);
      character.drawImage(state.frames[frame%SOURCE_COUNT],0,0,280,280);
    }
    const ctx=$('disc-canvas').getContext('2d');
    ctx.clearRect(0,0,1200,1200);
    if (state.previewDisc) {
      const rpm=$('preview-rpm').value==='45'?45:100/3;
      ctx.save();ctx.translate(600,600);ctx.rotate(2*Math.PI*(rpm/60)*(frame/30));
      ctx.drawImage(state.previewDisc,-600,-600);ctx.restore();
      const recordInches=Number($('record-overlay').value);
      if (recordInches===7 || recordInches===10) {
        const edge=1200*recordInches/24;
        ctx.beginPath();ctx.arc(600,600,edge,0,2*Math.PI);
        ctx.fillStyle='#80847e';ctx.fill();
        circle(ctx,600,600,edge-10,'#bec5bf',4);
        circle(ctx,600,600,edge*.37,'#2b473f',edge*.09);
        circle(ctx,600,600,4,'#eee',3);
      }
    } else {
      ctx.fillStyle='#dce1d4';ctx.textAlign='center';ctx.font='32px sans-serif';
      ctx.fillText('ここに回転プレビューが表示されます',600,600);
    }
  }
  requestAnimationFrame(previewLoop);
}
function blobFromCanvas(c) {
  return new Promise((resolve,reject) => c.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNGの生成に失敗しました。')),'image/png'));
}
function saveBlob(blob,name) {
  const url=URL.createObjectURL(blob), link=document.createElement('a');
  link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60_000);
}
async function exportPng(proof) {
  if (state.exporting || !state.frames) return;
  state.exporting=true;
  const button=$(proof?'download-proof':'download-png');button.disabled=true;
  status('output-status','3600pxのPNGを書き出しています…');
  try { await new Promise(resolve=>setTimeout(resolve,40));
    const output=drawArtwork(3600,proof);
    saveBlob(await blobFromCanvas(output),proof?'slipmat_proof.png':'slipmat.png');
    output.width=output.height=0;
    status('output-status','PNGを保存しました。iPhoneでは「ファイル」アプリのダウンロードも確認してください。');
  } catch(error) { status('output-status',`書き出せませんでした: ${error.message}`,true); }
  finally { state.exporting=false;button.disabled=false; }
}
async function exportZip() {
  if (state.exporting || !state.frames) return;
  state.exporting=true;$('download-zip').disabled=true;
  try {
    const files={};
    for (let i=0;i<SOURCE_COUNT;i++) {
      const blob=await blobFromCanvas(state.frames[i]);
      files[`${String(i+1).padStart(3,'0')}.png`]=new Uint8Array(await blob.arrayBuffer());
      if (i%9===8) { status('source-status',`ZIPを作成中… ${i+1}/54枚`);await new Promise(resolve=>setTimeout(resolve,0)); }
    }
    saveBlob(ZipFiles.write(files),'dance_54_frames.zip');
    status('source-status','54枚入りZIPを保存しました。');
  } catch(error) { status('source-status',`ZIPを保存できませんでした: ${error.message}`,true); }
  finally { state.exporting=false;$('download-zip').disabled=false; }
}

for (const input of document.querySelectorAll('input[name="source-mode"]')) input.addEventListener('change',()=>{
  const isImage=document.querySelector('input[name="source-mode"]:checked').value==='image';
  $('image-input-area').hidden=!isImage;$('zip-input-area').hidden=isImage;
  resetFrames();status('source-status',isImage?'画像を選んでください。':'ZIPを選んでください。');
  $('make-frames').disabled=!(isImage?$('image-file').files.length:$('zip-file').files.length);
});
for (const id of ['image-file','zip-file','motion']) $(id).addEventListener('change',()=>{
  resetFrames();
  const isImage=document.querySelector('input[name="source-mode"]:checked').value==='image';
  const file=$(isImage?'image-file':'zip-file').files[0];
  status('source-status',file?`${file.name} を選択しました。`: '素材を選んでください。');
  $('make-frames').disabled=!file;
});
$('make-frames').addEventListener('click',async()=>{
  const isImage=document.querySelector('input[name="source-mode"]:checked').value==='image';
  const file=$(isImage?'image-file':'zip-file').files[0];if(!file)return;
  const token=++state.generation;$('make-frames').disabled=true;
  status('source-status','54コマを準備しています…');
  try {
    const result=isImage?await framesFromImage(file,$('motion').value,token):await framesFromZip(file,token);
    if(!result || token!==state.generation)return;
    state.frames=result.frames;state.footFraction=result.footFraction;
    $('frames-preview').hidden=false;
    for(const id of ['download-zip','download-png','download-proof'])$(id).disabled=false;
    status('source-status','54コマの準備ができました。');
    updatePreview();
  } catch(error){ if(token===state.generation)status('source-status',`読み込めませんでした: ${error.message}`,true); }
  finally { if(token===state.generation)$('make-frames').disabled=false; }
});
for(const id of ['outer-rpm','inner-rpm','center-rpm','theme','background','inner-ring','center-ring','pattern'])$(id).addEventListener('change',updatePreview);
let pendingPreview=false;
function schedulePreview(){if(pendingPreview)return;pendingPreview=true;requestAnimationFrame(()=>{pendingPreview=false;updatePreview();});}
for(const ring of ['outer','inner','center']) $(''+ring+'-size').addEventListener('input',()=>{
  $(''+ring+'-size-value').textContent=$(''+ring+'-size').value+'%';
  schedulePreview();
});
for(const id of ['pattern-density','pattern-width','pattern-motif']) $(id).addEventListener('input',()=>{
  $(id+'-value').textContent=$(id).value+'%';schedulePreview();
});
$('preview-rpm').addEventListener('change',()=>{state.started=performance.now();state.lastFrame=-1;});
$('download-png').addEventListener('click',()=>exportPng(false));
$('download-proof').addEventListener('click',()=>exportPng(true));
$('download-zip').addEventListener('click',exportZip);
const motionExample=$('prompt-motion').value;
const zipPromptTemplate=$('zip-prompt').value.replace(motionExample,'{{motion}}');
$('prompt-motion').addEventListener('input',()=>{
  const motion=$('prompt-motion').value.trim();
  $('zip-prompt').value=zipPromptTemplate.replace('{{motion}}',motion || '［ここに好きな動きを入力してください］');
  $('copy-zip-prompt').disabled=!motion;
  $('copy-prompt-status').textContent='';
});
$('copy-zip-prompt').addEventListener('click',async()=>{
  const prompt=$('zip-prompt'), message=$('copy-prompt-status');
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(prompt.value);
    else { prompt.select(); if (!document.execCommand('copy')) throw new Error('copy failed'); }
    message.textContent='コピーしました。ChatGPTに画像と一緒に貼り付けてください。';
  } catch(error) {
    prompt.focus();prompt.select();
    message.textContent='自動コピーできませんでした。選択中の文章を手動でコピーしてください。';
  }
});
resetFrames();
requestAnimationFrame(previewLoop);
window.SlipmatMaker={countFor,sourceIndex,outerGeometry,innerGeometry,centerGeometry,drawArtwork};
