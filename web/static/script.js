const COLORS = [
  '#4f9cf7','#2ecc71','#f39c12','#e74c3c','#9b59b6','#1abc9c','#e67e22','#3498db',
  '#e91e63','#00bcd4','#ff5722','#8bc34a','#ff9800','#795548','#607d8b','#3f51b5'
];

const STATE = {
  numGenomes: 2, genomes: [], links: [],
  genomeData: {}, canvasGenomes: [],
  chrWidth: 20, chrSpacing: 10,
  themeMain: '', themeMainRatioFontSize: 1, themeMainColor: '', themeShiftMainX: 0, themeShiftMainY: 0,
  canvasBody: 1200, canvasUp: 55, canvasDown: 25, canvasLeft: 100, canvasRight: 120,
  canvasHeightRitao: 1, canvasWidthRitao: 1,
  panX: 0, panY: 0, zoom: 1,
  isDragging: false, dragTarget: null, dragOffX: 0, dragOffY: 0,
  selectedIdx: -1, contextIdx: -1,
  resultSvg: null, running: false, resultZoom: 1,
  _moved: false, _downGenomeIdx: -1, _downX: 0, _downY: 0,
  _hitPart: '', _hitChrIdx: -1
};

function init() {
  for (let i = 0; i < 2; i++) addGenome(i);
  addLink();
  renderGenomes(); renderLinks();
  setupCanvas();
  $('apply-count-btn').addEventListener('click', applyGenomeCount);
  $('genome-count').addEventListener('keydown', e => { if (e.key === 'Enter') applyGenomeCount(); });
  document.addEventListener('click', e => { hideCtxMenu(); deselectGenome(e); if (!e.target.closest('.dev-badge') && !e.target.closest('#contact-panel')) $('contact-panel').style.display = 'none'; });
  document.addEventListener('contextmenu', e => e.preventDefault());
  setupSplitResizer();

  /* Global theme/canvas event listeners */
  document.querySelectorAll('.gl-more-btn').forEach(el => el.addEventListener('click', glMoreToggle));
  ['gl-mrfs','gl-chr','gl-cwr'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', () => { updateGlobalParam(); });
  });
  ['gl-main','gl-maincor','gl-smx','gl-smy','gl-body','gl-up','gl-down','gl-left','gl-right'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('change', () => { updateGlobalParam(); });
  });
}

function $(id) { return document.getElementById(id); }
function toggleContact(e) { e.stopPropagation(); const p = $('contact-panel'); p.style.display = p.style.display === 'none' ? 'flex' : 'none'; }
function setupSplitResizer() {
  const r = $('resizer'), cs = $('canvas-section'), rs = $('run-section');
  let dragging = false, startY, startCFlex, startRFlex;
  r.addEventListener('mousedown', e => { dragging = true; startY = e.clientY; startCFlex = cs.flex || 4.5; startRFlex = rs.flex || 5.5; r.classList.add('active'); e.preventDefault(); });
  document.addEventListener('mousemove', e => { if (!dragging) return; const total = startCFlex + startRFlex; const dy = e.clientY - startY; const pct = (dy / (cs.parentElement.clientHeight - 12)) * total; cs.style.flex = Math.max(2, startCFlex + pct); rs.style.flex = Math.max(2, startRFlex - pct); });
  document.addEventListener('mouseup', () => { if (dragging) { dragging = false; r.classList.remove('active'); } });
}
async function api(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  const res = await fetch(url, { headers, ...opts });
  if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error || res.statusText); }
  return res.json();
}
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ==================== Genome Count ==================== */
function applyGenomeCount() {
  let n = parseInt($('genome-count').value) || 2;
  if (n < 2) n = 2;
  STATE.numGenomes = n;
  while (STATE.genomes.length < n) addGenome(STATE.genomes.length);
  while (STATE.genomes.length > n) { STATE.genomes.pop(); }
  STATE.selectedIdx = -1;
  renderGenomes(); renderLinks();
  updateGenomeData().then(() => renderCanvas());
}

function addGenome(i) {
  STATE.genomes.push({
    file: null, fileName: '', name: '',
    color: COLORS[i % COLORS.length], rotation: 0,
    moveX: 0, moveY: 0, shiftX: 0, shiftY: 0,
    chrWidth: STATE.chrWidth, opacity: 1,
    moreMove: false, moreLabels: false, moreScales: false, moreRegion: false, moreOthers: false,
    genomeNameSizeRatio: 1, genomeNameColor: '',
    genomeNameShiftX: 0, genomeNameShiftY: 0,
    chrNameShow: 0, chrNameShiftX: 0, chrNameShiftY: 0,
    chrNameSizeRatio: 1, chrNameColor: '', chrNameRotate: 0,
    showCoordinates: 0, scaleNum: 10, scaleUpDown: '',
    scaleUnit: '', labelUnit: '',     lablePrecision: 1,
    zoomChr: 1, linkWidth: 180, normalizedScale: 0,
    speRegionFile: '', speRegionFileName: '', zoomRegion: ''
  });
}

/* ==================== Render Genomes ==================== */
function renderGenomes() {
  const c = $('genomes-container');
  $('genome-count-badge').textContent = STATE.genomes.length;
  c.innerHTML = STATE.genomes.map((g, i) => `
    <div class="genome-slot${i===STATE.selectedIdx?' selected':''}" data-idx="${i}">
      <div class="gs-header">Genome ${i+1}</div>
      <div class="gs-row">
        <span class="gs-label">File (.len)</span>
        <input type="file" accept=".len,.txt,.info" class="gs-file" data-idx="${i}">
        <span class="gs-fname" title="${escHtml(g.file||'')}">${escHtml(g.fileName||'')}</span>
      </div>
      <div class="gs-row">
        <span class="gs-label">Name</span>
        <input type="text" class="gs-name" value="${escHtml(g.name)}" data-idx="${i}" placeholder="Genome${i+1}">
      </div>
      <div class="gs-row">
        <span class="gs-label">Size</span>
        <input type="range" min="4" max="60" value="${g.chrWidth}" class="gs-width" data-idx="${i}">
        <span class="gs-wval" data-idx="${i}">${g.chrWidth}</span>
      </div>
      <div class="gs-row">
        <span class="gs-label">Opacity</span>
        <input type="range" min="0.1" max="1" step="0.05" value="${g.opacity}" class="gs-opacity" data-idx="${i}">
        <span class="gs-oval" data-idx="${i}">${g.opacity}</span>
      </div>
      <div class="gs-row">
        <span class="gs-label">Rotate</span>
        <input type="range" min="-180" max="180" value="${g.rotation}" class="gs-rotate" data-idx="${i}">
        <span class="gs-rval" data-idx="${i}">${g.rotation}°</span>
      </div>
      <div class="gs-row">
        <span class="gs-label">Color</span>
        <div class="color-picker" data-idx="${i}">
          ${COLORS.map(c => `<span class="cp-swatch${c===g.color?' active':''}" style="background:${c}" data-color="${c}" data-idx="${i}"></span>`).join('')}
          <input type="color" class="cp-input" value="${g.color}" data-idx="${i}">
        </div>
      </div>
      <div class="gs-more-btns">
        <button class="btn btn-xs gs-more-btn" data-more="move" data-idx="${i}">${g.moreMove?'▲':'▼'} Move</button>
        <button class="btn btn-xs gs-more-btn" data-more="labels" data-idx="${i}">${g.moreLabels?'▲':'▼'} Labels</button>
        <button class="btn btn-xs gs-more-btn" data-more="scales" data-idx="${i}">${g.moreScales?'▲':'▼'} Scales</button>
        <button class="btn btn-xs gs-more-btn" data-more="region" data-idx="${i}">${g.moreRegion?'▲':'▼'} Region</button>
        <button class="btn btn-xs gs-more-btn" data-more="others" data-idx="${i}">${g.moreOthers?'▲':'▼'} Others</button>
      </div>
      <div class="gs-more" style="${g.moreMove?'':'display:none'}">
        <div class="gs-row"><span class="gs-label">ShiftX</span><input type="number" class="gs-shiftx" value="${g.shiftX}" data-idx="${i}"></div>
        <div class="gs-row"><span class="gs-label">ShiftY</span><input type="number" class="gs-shifty" value="${g.shiftY}" data-idx="${i}"></div>
        <div class="gs-row"><span class="gs-label">MoveToX</span><input type="number" class="gs-movetox" value="${g.moveX}" data-idx="${i}"></div>
        <div class="gs-row"><span class="gs-label">MoveToY</span><input type="number" class="gs-movetoy" value="${g.moveY}" data-idx="${i}"></div>
      </div>
      <div class="gs-more" style="${g.moreLabels?'':'display:none'}">
        <div class="gs-more-sub">Genome Name</div>
        <div class="gs-row"><span class="gs-label">NameRatio</span><input type="range" min="0.5" max="3" step="0.1" value="${g.genomeNameSizeRatio}" class="gs-gnsratio" data-idx="${i}"><span class="gs-gnsrval" data-idx="${i}">${g.genomeNameSizeRatio}</span></div>
        <div class="gs-row"><span class="gs-label">NameColor</span><input type="color" class="gs-gnscolor" value="${g.genomeNameColor||'#ffffff'}" data-idx="${i}"></div>
        <div class="gs-row"><span class="gs-label">NameShiftX</span><input type="number" class="gs-gnsx" value="${g.genomeNameShiftX}" data-idx="${i}"></div>
        <div class="gs-row"><span class="gs-label">NameShiftY</span><input type="number" class="gs-gnsy" value="${g.genomeNameShiftY}" data-idx="${i}"></div>
        <div class="gs-more-sub">Chromosome Name</div>
        <div class="gs-row"><span class="gs-label">ChrNameShow</span><input type="checkbox" class="gs-cnshow" data-idx="${i}" ${g.chrNameShow?'checked':''}></div>
        <div class="gs-row"><span class="gs-label">ChrNameSX</span><input type="number" class="gs-cnsx" value="${g.chrNameShiftX}" data-idx="${i}"></div>
        <div class="gs-row"><span class="gs-label">ChrNameSY</span><input type="number" class="gs-cnsy" value="${g.chrNameShiftY}" data-idx="${i}"></div>
        <div class="gs-row"><span class="gs-label">ChrNameRatio</span><input type="range" min="0.5" max="3" step="0.1" value="${g.chrNameSizeRatio}" class="gs-cnsratio" data-idx="${i}"><span class="gs-cnsrval" data-idx="${i}">${g.chrNameSizeRatio}</span></div>
        <div class="gs-row"><span class="gs-label">ChrNameColor</span><input type="color" class="gs-cnscolor" value="${g.chrNameColor||'#ffffff'}" data-idx="${i}"></div>
        <div class="gs-row"><span class="gs-label">ChrNameRot</span><input type="range" min="-180" max="180" value="${g.chrNameRotate}" class="gs-cnsrot" data-idx="${i}"><span class="gs-cnsrval" data-idx="${i}">${g.chrNameRotate}°</span></div>
      </div>
      <div class="gs-more" style="${g.moreScales?'':'display:none'}">
        <div class="gs-row"><span class="gs-label">ShowCoord</span><input type="checkbox" class="gs-showcoord" data-idx="${i}" ${g.showCoordinates?'checked':''}></div>
        <div class="gs-row"><span class="gs-label">ScaleNum</span><input type="number" min="1" max="100" value="${g.scaleNum}" class="gs-scalenum" data-idx="${i}"></div>
        <div class="gs-row"><span class="gs-label">ScaleUnit</span><input type="number" min="0" value="${g.scaleUnit||0}" class="gs-scaleunit" data-idx="${i}"></div>
        <div class="gs-row"><span class="gs-label">ScaleUpDown</span><select class="gs-scaleud" data-idx="${i}"><option value="">—</option><option value="Up"${g.scaleUpDown==='Up'?' selected':''}>Up</option><option value="Down"${g.scaleUpDown==='Down'?' selected':''}>Down</option></select></div>
        <div class="gs-row"><span class="gs-label">LabelUnit</span><input type="text" class="gs-labelunit" value="${escHtml(g.labelUnit)}" data-idx="${i}" placeholder="bp"></div>
        <div class="gs-row"><span class="gs-label">Precision</span><input type="number" min="0" max="10" value="${g.lablePrecision}" class="gs-lprecision" data-idx="${i}"></div>
      </div>
      <div class="gs-more" style="${g.moreRegion?'':'display:none'}">
        <div class="gs-row"><span class="gs-label">RegionFile</span><input type="file" accept=".bed,.txt,.region" class="gs-speregion" data-idx="${i}"><span class="gs-srfname" title="${escHtml(g.speRegionFile||'')}">${escHtml(g.speRegionFileName||'')}</span></div>
        <div class="gs-row"><span class="gs-label">ZoomRegion</span><input type="text" class="gs-zoomregion" value="${escHtml(g.zoomRegion)}" data-idx="${i}" placeholder="chr2:1000:5000"></div>
      </div>
      <div class="gs-more" style="${g.moreOthers?'':'display:none'}">
        <div class="gs-row"><span class="gs-label">ZoomChr</span><input type="range" min="0.1" max="5" step="0.1" value="${g.zoomChr}" class="gs-zoomchr" data-idx="${i}"><span class="gs-zcval" data-idx="${i}">${g.zoomChr}</span></div>
        <div class="gs-row"><span class="gs-label">LinkWidth</span><input type="number" min="10" max="500" value="${g.linkWidth}" class="gs-linkwidth" data-idx="${i}"></div>
        <div class="gs-row"><span class="gs-label">NormScale</span><input type="checkbox" class="gs-normscale" data-idx="${i}" ${g.normalizedScale?'checked':''}></div>
      </div>
    </div>
  `).join('');

  c.querySelectorAll('.genome-slot').forEach(el => el.addEventListener('click', e => {
    if (e.target.closest('input, select, button, .cp-swatch, .gs-file')) return;
    const idx = parseInt(el.dataset.idx);
    if (!isNaN(idx)) { STATE.selectedIdx = idx; renderGenomes(); renderCanvas(); }
  }));
  c.querySelectorAll('.gs-file').forEach(el => el.addEventListener('change', onGenomeFileChange));
  c.querySelectorAll('.gs-name').forEach(el => el.addEventListener('input', onGenomeNameChange));
  c.querySelectorAll('.gs-width').forEach(el => el.addEventListener('input', onGenomeWidth));
  c.querySelectorAll('.gs-opacity').forEach(el => el.addEventListener('input', onGenomeOpacity));
  c.querySelectorAll('.gs-rotate').forEach(el => el.addEventListener('input', onGenomeRotate));
  c.querySelectorAll('.cp-swatch').forEach(el => el.addEventListener('click', onColorPick));
  c.querySelectorAll('.cp-input').forEach(el => el.addEventListener('input', onColorPickInput));
  c.querySelectorAll('.gs-more-btn').forEach(el => el.addEventListener('click', onGenomeMoreToggle));
  c.querySelectorAll('.gs-shiftx, .gs-shifty').forEach(el => el.addEventListener('change', onGenomeShiftRaw));
  c.querySelectorAll('.gs-movetox, .gs-movetoy').forEach(el => el.addEventListener('change', onGenomeShift));
  c.querySelectorAll('.gs-gnsratio').forEach(el => el.addEventListener('input', onGenomeMoreRange));
  c.querySelectorAll('.gs-gnscolor').forEach(el => el.addEventListener('input', onGenomeMoreColor));
  c.querySelectorAll('.gs-gnsx, .gs-gnsy').forEach(el => el.addEventListener('change', onGenomeMoreNum));
  c.querySelectorAll('.gs-cnshow, .gs-showcoord').forEach(el => el.addEventListener('change', onGenomeMoreCheck));
  c.querySelectorAll('.gs-cnsx, .gs-cnsy').forEach(el => el.addEventListener('change', onGenomeMoreNum));
  c.querySelectorAll('.gs-cnsratio').forEach(el => el.addEventListener('input', onGenomeMoreRange));
  c.querySelectorAll('.gs-cnscolor').forEach(el => el.addEventListener('input', onGenomeMoreColor));
  c.querySelectorAll('.gs-cnsrot').forEach(el => el.addEventListener('input', onGenomeMoreRange));
  c.querySelectorAll('.gs-scalenum, .gs-scaleunit, .gs-lprecision').forEach(el => el.addEventListener('change', onGenomeMoreNum));
  c.querySelectorAll('.gs-scaleud').forEach(el => el.addEventListener('change', onGenomeMoreSelect));
  c.querySelectorAll('.gs-labelunit').forEach(el => el.addEventListener('change', onGenomeMoreStr));
  c.querySelectorAll('.gs-speregion').forEach(el => el.addEventListener('change', onGenomeSpeRegionFile));
  c.querySelectorAll('.gs-zoomregion').forEach(el => el.addEventListener('change', onGenomeMoreStr));
  c.querySelectorAll('.gs-zoomchr').forEach(el => el.addEventListener('input', onGenomeMoreRange));
  c.querySelectorAll('.gs-linkwidth').forEach(el => el.addEventListener('change', onGenomeMoreNum));
  c.querySelectorAll('.gs-normscale').forEach(el => el.addEventListener('change', onGenomeMoreCheck));
}

async function onGenomeFileChange(e) {
  const idx = parseInt(e.target.dataset.idx);
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = await uploadFile(file);
    const fn = data.files[0].name;
    STATE.genomes[idx].file = fn;
    STATE.genomes[idx].fileName = fn;
    renderGenomes();
    await updateGenomeData();
    renderCanvas();
  } catch (err) { console.error('Upload:', err); }
}

function onGenomeNameChange(e) {
  const idx = parseInt(e.target.dataset.idx);
  STATE.genomes[idx].name = e.target.value;
  if (STATE.canvasGenomes[idx]) STATE.canvasGenomes[idx].name = e.target.value;
  renderCanvas();
}

function onGenomeWidth(e) {
  const idx = parseInt(e.target.dataset.idx);
  const v = parseInt(e.target.value);
  STATE.genomes[idx].chrWidth = v;
  if (STATE.canvasGenomes[idx]) STATE.canvasGenomes[idx].chrWidth = v;
  const el = document.querySelector(`.gs-wval[data-idx="${idx}"]`);
  if (el) el.textContent = e.target.value;
  renderCanvas();
}

function onGenomeOpacity(e) {
  const idx = parseInt(e.target.dataset.idx);
  const v = parseFloat(e.target.value);
  STATE.genomes[idx].opacity = v;
  if (STATE.canvasGenomes[idx]) STATE.canvasGenomes[idx].opacity = v;
  const el = document.querySelector(`.gs-oval[data-idx="${idx}"]`);
  if (el) el.textContent = e.target.value;
  renderCanvas();
}

function onGenomeRotate(e) {
  const idx = parseInt(e.target.dataset.idx);
  const v = parseInt(e.target.value);
  STATE.genomes[idx].rotation = v;
  if (STATE.canvasGenomes[idx]) STATE.canvasGenomes[idx].rotation = v;
  const el = document.querySelector(`.gs-rval[data-idx="${idx}"]`);
  if (el) el.textContent = e.target.value + '°';
  renderCanvas();
}

/* ==================== Genome More ==================== */
function onGenomeMoreToggle(e) {
  const idx = parseInt(e.target.dataset.idx);
  const key = 'more' + e.target.dataset.more.charAt(0).toUpperCase() + e.target.dataset.more.slice(1);
  STATE.genomes[idx][key] = !STATE.genomes[idx][key];
  renderGenomes();
}
function onGenomeShift(e) {
  const idx = parseInt(e.target.dataset.idx);
  const v = parseFloat(e.target.value) || 0;
  if (e.target.classList.contains('gs-movetox')) STATE.genomes[idx].moveX = v;
  else STATE.genomes[idx].moveY = v;
  if (STATE.canvasGenomes[idx]) {
    if (e.target.classList.contains('gs-movetox')) STATE.canvasGenomes[idx].moveX = v;
    else STATE.canvasGenomes[idx].moveY = v;
  }
  renderCanvas();
}
function onGenomeShiftRaw(e) {
  const idx = parseInt(e.target.dataset.idx);
  const v = parseFloat(e.target.value) || 0;
  if (e.target.classList.contains('gs-shiftx')) STATE.genomes[idx].shiftX = v;
  else STATE.genomes[idx].shiftY = v;
}
function onGenomeMoreRange(e) {
  const idx = parseInt(e.target.dataset.idx);
  const g = STATE.genomes[idx];
  const cls = e.target.className;
  const v = parseFloat(e.target.value);
  const label = e.target.nextElementSibling;
  if (label) label.textContent = e.target.value + (e.target.classList.contains('gs-cnsrot')?'°':'');
  if (cls.includes('gs-gnsratio')) g.genomeNameSizeRatio = v;
  else if (cls.includes('gs-cnsratio')) g.chrNameSizeRatio = v;
  else if (cls.includes('gs-cnsrot')) g.chrNameRotate = v;
  else if (cls.includes('gs-zoomchr')) g.zoomChr = v;
}
function onGenomeMoreColor(e) {
  const idx = parseInt(e.target.dataset.idx);
  const g = STATE.genomes[idx];
  const v = e.target.value;
  if (e.target.classList.contains('gs-gnscolor')) g.genomeNameColor = v;
  else if (e.target.classList.contains('gs-cnscolor')) g.chrNameColor = v;
}
function onGenomeMoreNum(e) {
  const idx = parseInt(e.target.dataset.idx);
  const g = STATE.genomes[idx];
  const v = parseFloat(e.target.value) || 0;
  const cls = e.target.className;
  if (cls.includes('gs-gnsx')) g.genomeNameShiftX = v;
  else if (cls.includes('gs-gnsy')) g.genomeNameShiftY = v;
  else if (cls.includes('gs-cnsx')) g.chrNameShiftX = v;
  else if (cls.includes('gs-cnsy')) g.chrNameShiftY = v;
  else if (cls.includes('gs-scalenum')) g.scaleNum = parseInt(v) || 10;
  else if (cls.includes('gs-scaleunit')) g.scaleUnit = v;
  else if (cls.includes('gs-lprecision')) g.lablePrecision = parseInt(v) || 1;
  else if (cls.includes('gs-linkwidth')) g.linkWidth = parseInt(v) || 180;
}
function onGenomeMoreCheck(e) {
  const idx = parseInt(e.target.dataset.idx);
  const g = STATE.genomes[idx];
  const v = e.target.checked ? 1 : 0;
  if (e.target.classList.contains('gs-cnshow')) g.chrNameShow = v;
  else if (e.target.classList.contains('gs-showcoord')) g.showCoordinates = v;
  else if (e.target.classList.contains('gs-normscale')) g.normalizedScale = v;
}
function onGenomeMoreSelect(e) {
  const idx = parseInt(e.target.dataset.idx);
  STATE.genomes[idx].scaleUpDown = e.target.value;
}
function onGenomeMoreStr(e) {
  const idx = parseInt(e.target.dataset.idx);
  const g = STATE.genomes[idx];
  if (e.target.classList.contains('gs-labelunit')) g.labelUnit = e.target.value;
  else if (e.target.classList.contains('gs-zoomregion')) g.zoomRegion = e.target.value;
}
function onGenomeSpeRegionFile(e) {
  const idx = parseInt(e.target.dataset.idx);
  const file = e.target.files[0];
  if (!file) return;
  uploadFile(file).then(data => {
    const fn = data.files[0].name;
    STATE.genomes[idx].speRegionFile = fn;
    STATE.genomes[idx].speRegionFileName = fn;
    renderGenomes();
  }).catch(err => console.error('Upload region file:', err));
}

/* ==================== Link More ==================== */
function onLinkMoreToggle(e) {
  const idx = parseInt(e.target.dataset.idx);
  STATE.links[idx].moreOpen = !STATE.links[idx].moreOpen;
  renderLinks();
}
function onLinkMoreSelect(e) {
  const idx = parseInt(e.target.dataset.idx);
  STATE.links[idx].styleUpDown = e.target.value;
}
function onLinkMoreCheck(e) {
  const idx = parseInt(e.target.dataset.idx);
  STATE.links[idx].reverse = e.target.checked ? 1 : 0;
}
function onLinkMoreRange(e) {
  const idx = parseInt(e.target.dataset.idx);
  const l = STATE.links[idx];
  const v = parseFloat(e.target.value);
  const label = e.target.nextElementSibling;
  if (label) label.textContent = v;
  if (e.target.classList.contains('ls-ratio')) l.heightRatio = v;
  else if (e.target.classList.contains('ls-fopacity')) l.linkFillOpacity = v;
  else if (e.target.classList.contains('ls-sopacity')) l.linkStrokeOpacity = v;
}
function onLinkMoreColor(e) {
  const idx = parseInt(e.target.dataset.idx);
  const l = STATE.links[idx];
  if (e.target.classList.contains('ls-fcolor')) l.linkFill = e.target.value;
  else if (e.target.classList.contains('ls-scolor')) l.linkStroke = e.target.value;
}
function onLinkMoreNum(e) {
  const idx = parseInt(e.target.dataset.idx);
  STATE.links[idx].linkStrokeWidth = parseFloat(e.target.value) || 1;
}

function updateColorUI(idx) {
  const picker = document.querySelector(`.color-picker[data-idx="${idx}"]`);
  if (!picker) return;
  const color = STATE.genomes[idx].color;
  picker.querySelectorAll('.cp-swatch').forEach(el => {
    el.classList.toggle('active', el.dataset.color === color);
  });
  const input = picker.querySelector('.cp-input');
  if (input) input.value = color;
  if (STATE.canvasGenomes[idx]) STATE.canvasGenomes[idx].color = color;
  renderCanvas();
}

function onColorPick(e) {
  const idx = parseInt(e.target.dataset.idx);
  STATE.genomes[idx].color = e.target.dataset.color;
  updateColorUI(idx);
}

function onColorPickInput(e) {
  const idx = parseInt(e.target.dataset.idx);
  STATE.genomes[idx].color = e.target.value;
  updateColorUI(idx);
}

/* ==================== Links ==================== */
function renderLinks() {
  const c = $('links-container');
  $('link-count-badge').textContent = STATE.links.length;
  const n = STATE.genomes.length;
  const opts = Array.from({length: n}, (_, i) => i);
  c.innerHTML = STATE.links.map((l, i) => `
    <div class="link-slot" data-idx="${i}">
      <div class="ls-header">Link ${i+1} <button class="btn-link-del" onclick="removeLink(${i})">✕</button></div>
      <div class="ls-row">
        <span class="ls-label">A</span>
        <select class="ls-ga" data-idx="${i}">${opts.map(o => `<option value="${o}"${o===l.genomeA?' selected':''}>Genome ${o+1}</option>`).join('')}</select>
        <span class="ls-label">B</span>
        <select class="ls-gb" data-idx="${i}">${opts.map(o => `<option value="${o}"${o===l.genomeB?' selected':''}>Genome ${o+1}</option>`).join('')}</select>
      </div>
      <div class="ls-row">
        <span class="ls-label">File (.link)</span>
        <input type="file" accept=".link" class="ls-file" data-idx="${i}">
        <span class="ls-fname" title="${escHtml(l.file||'')}">${escHtml(l.fileName||'')}</span>
        <button class="btn btn-xs ls-more-btn" data-idx="${i}">${l.moreOpen?'▲':'▼'} More</button>
      </div>
      <div class="ls-more" data-idx="${i}" style="${l.moreOpen?'':'display:none'}">
        <div class="gs-row"><span class="gs-label" style="min-width:80px">StyleUpDown</span><select class="ls-styleud" data-idx="${i}"><option value="">—</option><option value="UpDown"${l.styleUpDown==='UpDown'?' selected':''}>UpDown</option><option value="DownUp"${l.styleUpDown==='DownUp'?' selected':''}>DownUp</option><option value="UpUP"${l.styleUpDown==='UpUP'?' selected':''}>UpUP</option><option value="DownDown"${l.styleUpDown==='DownDown'?' selected':''}>DownDown</option><option value="line"${l.styleUpDown==='line'?' selected':''}>line</option></select></div>
        <div class="gs-row"><span class="gs-label" style="min-width:80px">Reverse</span><input type="checkbox" class="ls-reverse" data-idx="${i}" ${l.reverse?'checked':''}></div>
        <div class="gs-row"><span class="gs-label" style="min-width:80px">HeightRatio</span><input type="range" min="0.1" max="5" step="0.1" value="${l.heightRatio}" class="ls-ratio" data-idx="${i}"><span class="ls-rval" data-idx="${i}">${l.heightRatio}</span></div>
        <div class="gs-row"><span class="gs-label" style="min-width:80px">fill</span><input type="color" class="ls-fcolor" value="${l.linkFill||'#ffffff'}" data-idx="${i}"></div>
        <div class="gs-row"><span class="gs-label" style="min-width:80px">stroke</span><input type="color" class="ls-scolor" value="${l.linkStroke||'#ffffff'}" data-idx="${i}"></div>
        <div class="gs-row"><span class="gs-label" style="min-width:80px">stroke-width</span><input type="number" min="0" max="10" step="0.5" value="${l.linkStrokeWidth}" class="ls-sw" data-idx="${i}"></div>
        <div class="gs-row"><span class="gs-label" style="min-width:80px">fill-opacity</span><input type="range" min="0" max="1" step="0.05" value="${l.linkFillOpacity}" class="ls-fopacity" data-idx="${i}"><span class="ls-foval" data-idx="${i}">${l.linkFillOpacity}</span></div>
        <div class="gs-row"><span class="gs-label" style="min-width:80px">stroke-opacity</span><input type="range" min="0" max="1" step="0.05" value="${l.linkStrokeOpacity}" class="ls-sopacity" data-idx="${i}"><span class="ls-soval" data-idx="${i}">${l.linkStrokeOpacity}</span></div>
      </div>
    </div>
  `).join('');
  c.querySelectorAll('.ls-file').forEach(el => el.addEventListener('change', onLinkFileChange));
  c.querySelectorAll('.ls-ga, .ls-gb').forEach(el => el.addEventListener('change', onLinkChange));
  c.querySelectorAll('.ls-more-btn').forEach(el => el.addEventListener('click', onLinkMoreToggle));
  c.querySelectorAll('.ls-styleud').forEach(el => el.addEventListener('change', onLinkMoreSelect));
  c.querySelectorAll('.ls-reverse').forEach(el => el.addEventListener('change', onLinkMoreCheck));
  c.querySelectorAll('.ls-ratio').forEach(el => el.addEventListener('input', onLinkMoreRange));
  c.querySelectorAll('.ls-fcolor, .ls-scolor').forEach(el => el.addEventListener('input', onLinkMoreColor));
  c.querySelectorAll('.ls-sw').forEach(el => el.addEventListener('change', onLinkMoreNum));
  c.querySelectorAll('.ls-fopacity, .ls-sopacity').forEach(el => el.addEventListener('input', onLinkMoreRange));
}

function addLink() {
  STATE.links.push({ genomeA: 0, genomeB: 1, file: null, fileName: '',
    moreOpen: false, styleUpDown: '', reverse: 0, heightRatio: 1,
    linkFill: '', linkStroke: '', linkStrokeWidth: 1,
    linkFillOpacity: 1, linkStrokeOpacity: 1
  });
  renderLinks();
}

function removeLink(i) {
  STATE.links.splice(i, 1);
  renderLinks();
}

async function onLinkFileChange(e) {
  const idx = parseInt(e.target.dataset.idx);
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = await uploadFile(file);
    const fn = data.files[0].name;
    STATE.links[idx].file = fn;
    STATE.links[idx].fileName = fn;
    renderLinks();
  } catch (err) { console.error('Upload:', err); }
}

function onLinkChange(e) {
  const idx = parseInt(e.target.dataset.idx);
  const a = parseInt(document.querySelector(`.ls-ga[data-idx="${idx}"]`).value);
  const b = parseInt(document.querySelector(`.ls-gb[data-idx="${idx}"]`).value);
  STATE.links[idx].genomeA = a;
  STATE.links[idx].genomeB = b;
}

async function uploadFile(file) {
  const fd = new FormData();
  fd.append(file.name, file);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

/* ==================== Global Params ==================== */
function updateGlobalParam() {
  STATE.chrWidth = parseInt($('gl-chr-width').value);
  STATE.chrSpacing = parseInt($('gl-chr-spacing').value);
  STATE.genomes.forEach(g => { g.chrWidth = STATE.chrWidth; g.chrSpacing = STATE.chrSpacing; });
  STATE.canvasGenomes.forEach(g => { g.chrWidth = STATE.chrWidth; g.chrSpacing = STATE.chrSpacing; });
  $('gl-chr-width-val').textContent = STATE.chrWidth;
  $('gl-chr-spacing-val').textContent = STATE.chrSpacing;
  STATE.themeMain = $('gl-main').value;
  STATE.themeMainRatioFontSize = parseFloat($('gl-mrfs').value) || 1;
  STATE.themeMainColor = $('gl-maincor').value;
  STATE.themeShiftMainX = parseFloat($('gl-smx').value) || 0;
  STATE.themeShiftMainY = parseFloat($('gl-smy').value) || 0;
  STATE.canvasBody = parseInt($('gl-body').value) || 1200;
  STATE.canvasUp = parseInt($('gl-up').value) || 55;
  STATE.canvasDown = parseInt($('gl-down').value) || 25;
  STATE.canvasLeft = parseInt($('gl-left').value) || 100;
  STATE.canvasRight = parseInt($('gl-right').value) || 120;
  STATE.canvasHeightRitao = parseFloat($('gl-chr').value) || 1;
  STATE.canvasWidthRitao = parseFloat($('gl-cwr').value) || 1;
  $('gl-chr-val').textContent = STATE.canvasHeightRitao;
  $('gl-cwr-val').textContent = STATE.canvasWidthRitao;
  $('gl-mrfs-val').textContent = STATE.themeMainRatioFontSize;
  renderCanvas();
}
function glMoreToggle(e) {
  const key = e.target.dataset.gl;
  const el = $(`gl-${key}`);
  if (!el) return;
  const vis = el.style.display !== 'none';
  el.style.display = vis ? 'none' : '';
  e.target.textContent = vis ? '▼' : '▲';
  e.target.textContent += ` ${key.charAt(0).toUpperCase() + key.slice(1)}`;
}

/* ==================== Genome Data ==================== */
async function updateGenomeData() {
  STATE.genomeData = {};
  for (const g of STATE.genomes) {
    if (!g.file) continue;
    try {
      const data = await api(`/api/len/${encodeURIComponent(g.file)}`);
      STATE.genomeData[g.file] = data.chromosomes || [];
    } catch (e) {
      const fname = g.file.split('/').pop();
      try {
        const data = await api(`/api/len/${encodeURIComponent(fname)}`);
        STATE.genomeData[g.file] = data.chromosomes || [];
      } catch (e2) { STATE.genomeData[g.file] = []; }
    }
  }
  buildCanvasGenomes();
}

function buildCanvasGenomes() {
  STATE.canvasGenomes = [];
  STATE.genomes.forEach((g, i) => {
    const chrs = STATE.genomeData[g.file] || [];
    if (!chrs.length) return;
    const totalLen = chrs.reduce((s, c) => s + c.length, 0);
    STATE.canvasGenomes.push({
      idx: i,
      name: g.name || g.fileName.replace(/\.(len|txt|info)$/, '') || `Genome${i+1}`,
      chromosomes: chrs, totalLen,
      color: g.color, rotation: g.rotation,
      moveX: g.moveX || 0, moveY: g.moveY || 0,
      chrWidth: g.chrWidth || STATE.chrWidth,
      chrSpacing: g.chrSpacing || STATE.chrSpacing,
      opacity: g.opacity != null ? g.opacity : 1,
      _rx: 0, _ry: 0, _rw: 0, _rh: 0
    });
  });
}

/* ==================== Canvas ==================== */
const CANV = { ctx: null, w: 0, h: 0, dpr: 1 };

function setupCanvas() {
  const canvas = $('genomeCanvas');
  CANV.ctx = canvas.getContext('2d');
  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    CANV.dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * CANV.dpr;
    canvas.height = 400 * CANV.dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = '400px';
    CANV.w = canvas.width / CANV.dpr;
    CANV.h = 400;
    renderCanvas();
  }
  window.addEventListener('resize', resize);
  setTimeout(resize, 50);
  canvas.addEventListener('mousedown', cmDown);
  canvas.addEventListener('mousemove', cmMove);
  canvas.addEventListener('mouseup', cmUp);
  canvas.addEventListener('mouseleave', cmUp);
  canvas.addEventListener('wheel', cmWheel, { passive: false });
  canvas.addEventListener('contextmenu', cmContext);
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0], rect = canvas.getBoundingClientRect();
    cmDown({ offsetX: t.clientX-rect.left, offsetY: t.clientY-rect.top, button: 0 });
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (STATE.isDragging) {
      const t = e.touches[0], rect = canvas.getBoundingClientRect();
      cmMove({ offsetX: t.clientX-rect.left, offsetY: t.clientY-rect.top });
    }
  }, { passive: false });
  canvas.addEventListener('touchend', e => { e.preventDefault(); cmUp({isTouch:true}); }, { passive: false });
}

function renderCanvas() {
  const ctx = CANV.ctx;
  if (!ctx) return;
  const canvas = $('genomeCanvas');
  const w = CANV.w, h = CANV.h;
  /* Clear entire physical buffer */
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  if (!STATE.canvasGenomes.length) { $('canvas-status').style.display = 'block'; return; }
  $('canvas-status').style.display = 'none';

  ctx.save();
  ctx.scale(CANV.dpr, CANV.dpr);
  ctx.translate(STATE.panX, STATE.panY);
  ctx.scale(STATE.zoom, STATE.zoom);

  const genomes = STATE.canvasGenomes;
  const startX = 40, startY = 30;
  const gH = idx => Math.max((genomes[idx]?.chrWidth||STATE.chrWidth) + 24, 40);
  let totalH = 20;
  genomes.forEach((_, i) => totalH += gH(i));

  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 0.5;
  let yy = 10;
  for (let y = 10; y < totalH; y += 40) {
    ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(w/STATE.zoom, y); ctx.stroke();
  }

  let yOff = 0;
  for (let gi = 0; gi < genomes.length; gi++) {
    const g = genomes[gi];
    const cwVal = g.chrWidth || STATE.chrWidth;
    const spacing = g.chrSpacing || STATE.chrSpacing;
    const totalLen = g.totalLen || 1;
    const scale = 200 / totalLen;
    const moveX = g.moveX || 0;
    const moveY = g.moveY || 0;
    const trackX = startX + moveX;
    const trackY = startY + moveY + yOff;
    const rotate = (g.rotation || 0) * Math.PI / 180;
    const isSelected = STATE.selectedIdx === gi;
    const alpha = g.opacity != null ? g.opacity : 1;

    /* highlight for selected */
    ctx.save();
    ctx.globalAlpha = isSelected ? 0.12 : 0.05;
    ctx.fillStyle = isSelected ? '#fff' : '#4f9cf7';
    ctx.strokeStyle = isSelected ? 'rgba(255,255,255,0.3)' : 'rgba(79,156,247,0.12)';
    ctx.lineWidth = isSelected ? 1.5 : 0.5;
    let xOff = 0;
    for (const chr of g.chromosomes) xOff += Math.max(4, chr.length * scale) + spacing;
    const boxH = cwVal + 8;
    ctx.roundRect ? ctx.roundRect(trackX-4, trackY-2, xOff+8, boxH+4, 4) : ctx.rect(trackX-4, trackY-2, xOff+8, boxH+4);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    /* label */
    ctx.save();
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = isSelected ? '#fff' : '#8b95a8';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(g.name, trackX - 8, trackY + cwVal/2 + 2);
    ctx.restore();

    /* chromosomes */
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(trackX + xOff/2, trackY + cwVal/2 + 2);
    ctx.rotate(rotate);
    ctx.translate(-(trackX + xOff/2), -(trackY + cwVal/2 + 2));

    xOff = 0;
    for (const chr of g.chromosomes) {
      const chrW = Math.max(4, chr.length * scale);
      const cx = trackX + xOff;
      const cy = trackY + 2;
      const cr = Math.min(4, cwVal / 4);
      ctx.fillStyle = g.color || '#4f9cf7';
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 0.5;
      roundRect(ctx, cx, cy, Math.max(chrW, 6), cwVal, cr);
      ctx.fill(); ctx.stroke();

      if (g.chromosomes.length < 30) {
        ctx.save();
        ctx.font = `${Math.min(7, cwVal*0.35)}px sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(chr.name.length > 8 ? chr.name.slice(0,7)+'…' : chr.name, cx + chrW/2, cy + cwVal/2);
        ctx.restore();
      }
      xOff += chrW + spacing;
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    g._rx = trackX; g._ry = trackY + 2; g._rw = xOff; g._rh = cwVal;
    g._nameX = trackX - 100; g._nameY = trackY - 4; g._nameW = 96; g._nameH = cwVal + 8;
    g._chrBounds = [];
    {
      let cxOff = 0;
      for (const chr of g.chromosomes) {
        const chrW = Math.max(4, chr.length * scale);
        g._chrBounds.push({x: trackX + cxOff, y: trackY + 2, w: Math.max(chrW, 6), h: cwVal});
        cxOff += chrW + spacing;
      }
    }
    yOff += gH(gi);
  }

  /* links */
  if (genomes.length >= 2) {
    ctx.globalAlpha = 0.06;
    for (const l of STATE.links) {
      const gA = genomes.find(gg => gg.idx === l.genomeA);
      const gB = genomes.find(gg => gg.idx === l.genomeB);
      if (!gA || !gB || !gA._rx || !gB._rx) continue;
      ctx.strokeStyle = gB.color || '#4f9cf7'; ctx.lineWidth = 0.8;
      for (let k = 0; k < 20; k++) {
        const t = k / 20;
        const x1 = gA._rx + t * gA._rw, y1 = gA._ry + gA._rh;
        const x2 = gB._rx + t * gB._rw, y2 = gB._ry;
        ctx.beginPath(); ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo((x1+x2)/2, (y1+y2)/2 + 12, x2, y2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

/* ==================== Canvas Interaction ==================== */
function hitTest(mx, my, x, y, w, h) {
  const bx = x * STATE.zoom + STATE.panX;
  const by = y * STATE.zoom + STATE.panY;
  const bw = w * STATE.zoom;
  const bh = h * STATE.zoom;
  return mx >= bx && mx <= bx + bw && my >= by && my <= by + bh;
}

function getGenomeAt(mx, my) {
  for (const g of STATE.canvasGenomes) {
    if (!g._rx) continue;
    if (hitTest(mx, my, g._nameX, g._nameY, g._nameW, g._nameH))
      return {genome: g, part: 'name'};
    if (g._chrBounds) {
      for (let ci = 0; ci < g._chrBounds.length; ci++) {
        const b = g._chrBounds[ci];
        if (hitTest(mx, my, b.x - 4, b.y - 6, b.w + 8, b.h + 12))
          return {genome: g, part: 'chromosome', chrIdx: ci};
      }
    }
    if (hitTest(mx, my, g._rx - 8, g._ry - 12, g._rw + 16, g._rh + 24))
      return {genome: g, part: 'track'};
  }
  return null;
}

function deselectGenome(e) {
  if (e.target.closest('.genome-slot, canvas, .ctx-menu')) return;
  STATE.selectedIdx = -1;
  renderGenomes(); renderCanvas();
}

function cmDown(e) {
  const mx = e.offsetX, my = e.offsetY;
  STATE._moved = false; STATE._downX = mx; STATE._downY = my;
  const hit = getGenomeAt(mx, my);
  if (hit) {
    const g = hit.genome;
    STATE.isDragging = true; STATE.dragTarget = g;
    STATE._hitPart = hit.part;
    STATE._hitChrIdx = hit.chrIdx != null ? hit.chrIdx : -1;
    const gx = g._rx * STATE.zoom + STATE.panX;
    const gy = g._ry * STATE.zoom + STATE.panY;
    STATE.dragOffX = mx - gx; STATE.dragOffY = my - gy;
    STATE._downGenomeIdx = g.idx;
    $('genomeCanvas').style.cursor = 'grabbing';
  } else if (e.button === 0) {
    STATE.isDragging = true; STATE.dragTarget = null;
    STATE._hitPart = '';
    STATE._hitChrIdx = -1;
    STATE.dragOffX = mx - STATE.panX; STATE.dragOffY = my - STATE.panY;
    STATE._downGenomeIdx = -1;
    $('genomeCanvas').style.cursor = 'grabbing';
  }
}

function cmMove(e) {
  if (!STATE.isDragging) {
    const hit = getGenomeAt(e.offsetX, e.offsetY);
    $('genomeCanvas').style.cursor = hit ? 'pointer' : 'grab';
    return;
  }
  const dx = e.offsetX - STATE._downX, dy = e.offsetY - STATE._downY;
  if (dx*dx + dy*dy > 16) STATE._moved = true;
  if (STATE.dragTarget) {
    const g = STATE.dragTarget;
    const nx = (e.offsetX - STATE.dragOffX) / STATE.zoom;
    const ny = (e.offsetY - STATE.dragOffY) / STATE.zoom;
    const gi = STATE.genomes[g.idx];
    if (gi) {
      gi.moveX = Math.round(nx - 40);
      gi.moveY = Math.round(ny - 32 - (() => {
        let h = 0;
        for (let i = 0; i < g.idx; i++) h += Math.max((STATE.canvasGenomes[i]?.chrWidth||STATE.chrWidth)+24, 40);
        return h;
      })());
      g.moveX = gi.moveX; g.moveY = gi.moveY;
      console.log('DRAG', {idx: g.idx, ny, yOff: 32+(()=>{let h=0;for(let i=0;i<g.idx;i++)h+=Math.max((STATE.canvasGenomes[i]?.chrWidth||STATE.chrWidth)+24,40);return h;})(), moveY: gi.moveY});
    }
    renderCanvas();
  } else {
    STATE.panX = e.offsetX - STATE.dragOffX;
    STATE.panY = e.offsetY - STATE.dragOffY;
    renderCanvas();
  }
}

function cmUp(e) {
  STATE.isDragging = false;
  const isClick = !STATE._moved;
  if (isClick && STATE._downGenomeIdx >= 0) {
    if (STATE.selectedIdx !== STATE._downGenomeIdx) {
      STATE.selectedIdx = STATE._downGenomeIdx;
      renderGenomes();
    }
  } else if (isClick && STATE._downGenomeIdx === -1 && STATE.selectedIdx !== -1) {
    STATE.selectedIdx = -1;
    renderGenomes();
  }
  STATE.dragTarget = null; STATE._downGenomeIdx = -1;
  STATE._hitPart = ''; STATE._hitChrIdx = -1;
  STATE._moved = false;
  $('genomeCanvas').style.cursor = 'grab';
  renderCanvas();
}

function cmWheel(e) {
  e.preventDefault();
  STATE.zoom = clamp(STATE.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.1, 5);
  renderCanvas();
}

function cmContext(e) {
  e.preventDefault();
  const hit = getGenomeAt(e.offsetX, e.offsetY);
  if (!hit) return;
  const g = hit.genome;
  STATE.selectedIdx = g.idx;
  STATE.contextIdx = g.idx;
  renderCanvas();
  const menu = $('context-menu');
  const ul = menu.querySelector('ul');
  const part = hit.part;
  if (part === 'name') {
    ul.innerHTML = '<li onclick="ctxEditName()">✏️ Rename</li><li onclick="ctxEditColor()">🎨 Color</li>';
  } else if (part === 'chromosome') {
    const ci = hit.chrIdx;
    const chr = g.chromosomes[ci];
    const info = chr ? `${chr.name} (${chr.start}-${chr.end})` : `Chr ${ci}`;
    ul.innerHTML = `<li class="ctx-info">${escHtml(info)}</li><li class="ctx-sep"></li><li onclick="ctxEditColor()">🎨 Color</li><li onclick="ctxEditSize()">📏 Size</li><li onclick="ctxEditRotation()">🔄 Rotation</li>`;
  } else {
    ul.innerHTML = '<li onclick="ctxEditName()">✏️ Name</li><li onclick="ctxEditColor()">🎨 Color</li><li onclick="ctxEditSize()">📏 Size</li><li onclick="ctxEditOpacity()">🔆 Opacity</li><li onclick="ctxEditRotation()">🔄 Rotation</li><li class="ctx-sep"></li><li onclick="ctxResetPos()">↩️ Reset Position</li>';
  }
  menu.style.display = 'block';
  menu.style.left = Math.min(e.clientX, window.innerWidth-200) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight-260) + 'px';
}

function hideCtxMenu() { $('context-menu').style.display = 'none'; }

/* ==================== Context Menu ==================== */
function ctxEditName() { hideCtxMenu();
  const g = STATE.genomes[STATE.contextIdx]; if (!g) return;
  const v = prompt('Genome name:', g.name||''); if (v==null) return;
  g.name = v;
  if (STATE.canvasGenomes[STATE.contextIdx]) STATE.canvasGenomes[STATE.contextIdx].name = v;
  renderGenomes(); renderCanvas();
}
function ctxEditRotation() { hideCtxMenu();
  const g = STATE.genomes[STATE.contextIdx]; if (!g) return;
  const v = prompt('Rotation (-180~180°):', String(g.rotation||0)); if (v==null) return;
  g.rotation = clamp(parseFloat(v)||0, -180, 180);
  if (STATE.canvasGenomes[STATE.contextIdx]) STATE.canvasGenomes[STATE.contextIdx].rotation = g.rotation;
  renderGenomes(); renderCanvas();
}
function ctxEditColor() { hideCtxMenu();
  const g = STATE.genomes[STATE.contextIdx]; if (!g) return;
  const v = prompt('Color (hex):', g.color||'#4f9cf7'); if (v==null) return;
  g.color = v;
  if (STATE.canvasGenomes[STATE.contextIdx]) STATE.canvasGenomes[STATE.contextIdx].color = v;
  renderGenomes(); renderCanvas();
}
function ctxEditSize() { hideCtxMenu();
  const g = STATE.genomes[STATE.contextIdx]; if (!g) return;
  const v = prompt('Chromosome width (4~60):', String(g.chrWidth||STATE.chrWidth)); if (v==null) return;
  g.chrWidth = clamp(parseInt(v)||20, 4, 60);
  if (STATE.canvasGenomes[STATE.contextIdx]) STATE.canvasGenomes[STATE.contextIdx].chrWidth = g.chrWidth;
  renderGenomes(); renderCanvas();
}
function ctxEditOpacity() { hideCtxMenu();
  const g = STATE.genomes[STATE.contextIdx]; if (!g) return;
  const v = prompt('Opacity (0.1~1.0):', String(g.opacity!=null?g.opacity:1)); if (v==null) return;
  g.opacity = clamp(parseFloat(v)||1, 0.1, 1);
  if (STATE.canvasGenomes[STATE.contextIdx]) STATE.canvasGenomes[STATE.contextIdx].opacity = g.opacity;
  renderGenomes(); renderCanvas();
}
function ctxResetPos() { hideCtxMenu();
  const g = STATE.genomes[STATE.contextIdx]; if (!g) return;
  g.moveX = 0; g.moveY = 0;
  if (STATE.canvasGenomes[STATE.contextIdx]) { STATE.canvasGenomes[STATE.contextIdx].moveX = 0; STATE.canvasGenomes[STATE.contextIdx].moveY = 0; }
  renderCanvas();
}

function fitCanvas() { STATE.panX=0; STATE.panY=0; STATE.zoom=1; renderCanvas(); }

function resetView() {
  STATE.panX=0; STATE.panY=0; STATE.zoom=1;
  STATE.genomes.forEach(g => { g.moveX=0; g.moveY=0; });
  STATE.canvasGenomes.forEach(g => { g.moveX=0; g.moveY=0; });
  renderCanvas();
}

/* ==================== Demo ==================== */
async function loadDemo() {
  try {
    const data = await api('/api/example/example1/in1.conf');
    if (data.error) { alert(data.error); return; }
    const gp = data.parsed.global;

    const gfiles = [];
    for (let i = 1; i <= 10; i++) {
      const k = `GenomeInfoFile${i}`;
      if (gp[k]) {
        const v = gp[k];
        gfiles.push(typeof v === 'object' ? v.path : v);
      } else break;
    }
    const n = gfiles.length;
    if (n < 2) { alert('Demo needs >=2 genomes'); return; }

    $('genome-count').value = n;
    STATE.genomes = [];
    for (let i = 0; i < n; i++) {
      const fpath = gfiles[i] || '';
      STATE.genomes.push({
        file: fpath, fileName: fpath.split('/').pop(),
        name: fpath.split('/').pop().replace(/\.(len|txt|info)$/, ''),
        color: COLORS[i % COLORS.length],
        rotation: 0, moveX: 0, moveY: 0, shiftX: 0, shiftY: 0,
        chrWidth: STATE.chrWidth, opacity: 1,
    moreMove: false, moreLabels: false, moreScales: false, moreRegion: false, moreOthers: false,
        genomeNameSizeRatio: 1, genomeNameColor: '',
        genomeNameShiftX: 0, genomeNameShiftY: 0,
        chrNameShow: 0, chrNameShiftX: 0, chrNameShiftY: 0,
        chrNameSizeRatio: 1, chrNameColor: '', chrNameRotate: 0,
        showCoordinates: 0, scaleNum: 10, scaleUpDown: '',
        scaleUnit: '', labelUnit: '', lablePrecision: 1,
    speRegionFile: '', speRegionFileName: '', zoomRegion: '',
    zoomChr: 1, linkWidth: 180, normalizedScale: 0
      });
    }
    STATE.numGenomes = n;

    STATE.links = [];
    for (let i = 1; i <= 10; i++) {
      for (let j = i+1; j <= 10; j++) {
        const k = `LinkFileRef${i}VsRef${j}`;
        if (gp[k]) {
          const v = gp[k];
          const fpath = typeof v === 'object' ? v.path : v;
          STATE.links.push({
            genomeA: i-1, genomeB: j-1,
            file: fpath, fileName: fpath.split('/').pop(),
            moreOpen: false, styleUpDown: '', reverse: 0, heightRatio: 1,
            linkFill: '', linkStroke: '', linkStrokeWidth: 1,
            linkFillOpacity: 1, linkStrokeOpacity: 1
          });
        }
      }
    }
    if (!STATE.links.length) addLink();

    STATE.selectedIdx = -1;
    renderGenomes(); renderLinks();
    await updateGenomeData();
    renderCanvas();
    $('run-status').textContent = 'Demo loaded';
  } catch (e) { console.error('Demo:', e); alert('Failed to load demo'); }
}

/* ==================== Run ==================== */
async function runNGenomeSyn() {
  if (STATE.running) return;
  if (STATE.genomes.some(g => !g.file)) {
    $('run-status').textContent = 'Upload all genome files first'; return;
  }
  STATE.running = true;
  const btn = $('run-btn');
  btn.disabled = true; btn.textContent = 'Running…';
  $('run-status').textContent = 'Running…';
  $('result-area').style.display = 'none'; $('error-area').style.display = 'none';

  const params = {
    genomes: STATE.genomes.map(g => ({
      file: g.file, name: g.name, color: g.color,
      rotation: g.rotation||0, moveX: g.moveX||0, moveY: g.moveY||0,
      shiftX: g.shiftX||0, shiftY: g.shiftY||0,
      chrWidth: g.chrWidth, chrSpacing: g.chrSpacing, opacity: g.opacity,
      genomeNameSizeRatio: g.genomeNameSizeRatio,
      genomeNameColor: g.genomeNameColor,
      genomeNameShiftX: g.genomeNameShiftX,
      genomeNameShiftY: g.genomeNameShiftY,
      chrNameShow: g.chrNameShow, chrNameShiftX: g.chrNameShiftX,
      chrNameShiftY: g.chrNameShiftY, chrNameSizeRatio: g.chrNameSizeRatio,
      chrNameColor: g.chrNameColor, chrNameRotate: g.chrNameRotate,
      showCoordinates: g.showCoordinates, scaleNum: g.scaleNum,
      scaleUpDown: g.scaleUpDown, scaleUnit: g.scaleUnit,
      labelUnit: g.labelUnit, lablePrecision: g.lablePrecision,
      speRegionFile: g.speRegionFile, zoomRegion: g.zoomRegion,
      zoomChr: g.zoomChr, linkWidth: g.linkWidth,
      normalizedScale: g.normalizedScale
    })),
    links: STATE.links.filter(l => l.file).map(l => ({
      genomeA: l.genomeA, genomeB: l.genomeB, file: l.file,
      styleUpDown: l.styleUpDown, reverse: l.reverse,
      heightRatio: l.heightRatio,
      linkFill: l.linkFill, linkStroke: l.linkStroke,
      linkStrokeWidth: l.linkStrokeWidth,
      linkFillOpacity: l.linkFillOpacity,
      linkStrokeOpacity: l.linkStrokeOpacity
    })),
    global: {
      ChrWidth: String(STATE.chrWidth), ChrSpacing: String(STATE.chrSpacing),
      Main: STATE.themeMain, MainRatioFontSize: STATE.themeMainRatioFontSize,
      MainColor: STATE.themeMainColor, ShiftMainX: STATE.themeShiftMainX,
      ShiftMainY: STATE.themeShiftMainY,
      body: STATE.canvasBody, up: STATE.canvasUp, down: STATE.canvasDown,
      left: STATE.canvasLeft, right: STATE.canvasRight,
      CanvasHeightRitao: STATE.canvasHeightRitao,
      CanvasWidthRitao: STATE.canvasWidthRitao
    }
  };

  try {
    const data = await api('/api/run', {
      method: 'POST',
      body: JSON.stringify({ params, output: 'web_result' })
    });
    if (data.success) {
      STATE.resultSvg = data.svg; STATE.resultZoom = 1;
      const rs = $('result-svg'); rs.innerHTML = data.svg;
      $('result-area').style.display = 'block';
      $('run-status').textContent = '✓ Success';
      setupResultZoom();
    } else {
      $('error-text').textContent = data.stderr || data.error || 'Unknown error';
      $('error-area').style.display = 'block';
      $('run-status').textContent = '✗ Failed';
    }
  } catch (e) {
    $('error-text').textContent = e.message;
    $('error-area').style.display = 'block';
    $('run-status').textContent = '✗ ' + e.message;
  } finally {
    STATE.running = false; btn.disabled = false; btn.textContent = '▶ Run NGenomeSyn';
  }
}

function setupResultZoom() {
  const rs = $('result-svg'); const svg = rs.querySelector('svg');
  if (!svg) return;
  const zoomLvl = $('result-zoom-lvl');
  function applyZoom() {
    svg.style.transform = `scale(${STATE.resultZoom})`;
    zoomLvl.textContent = STATE.resultZoom === 1 ? '' : `🔍 ${Math.round(STATE.resultZoom * 100)}%`;
  }
  rs.onwheel = e => {
    if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); const rect = rs.getBoundingClientRect(); const mx = e.clientX - rect.left + rs.scrollLeft; const my = e.clientY - rect.top + rs.scrollTop; const old = STATE.resultZoom; const d = -e.deltaY * 0.001; STATE.resultZoom = Math.max(0.1, Math.min(10, STATE.resultZoom * (1 + d))); const ratio = STATE.resultZoom / old; rs.scrollLeft = mx * ratio - (e.clientX - rect.left); rs.scrollTop = my * ratio - (e.clientY - rect.top); applyZoom(); }
  };
  rs.ondblclick = () => { STATE.resultZoom = 1; rs.scrollLeft = 0; rs.scrollTop = 0; applyZoom(); };
  applyZoom();
}

function downloadSVG() {
  if (!STATE.resultSvg) return;
  const blob = new Blob([STATE.resultSvg], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'NGenomeSyn_result.svg';
  a.click(); URL.revokeObjectURL(a.href);
}

function downloadConf() {
  const g = STATE.genomes; const l = STATE.links;
  let txt = 'SetParaFor = global\n';
  g.forEach((gen, i) => { if (gen.file) txt += `GenomeInfoFile${i+1}=${gen.file}\n`; });
  l.forEach((lk, i) => { if (lk.file) txt += `LinkFileRef${lk.genomeA+1}VsRef${lk.genomeB+1}=${lk.file}\n`; });
  txt += '\n';
  txt += `ChrWidth=${STATE.chrWidth}\nChrSpacing=${STATE.chrSpacing}\n`;
  if (STATE.themeMain) txt += `Main=${STATE.themeMain}\n`;
  if (STATE.themeMainRatioFontSize && STATE.themeMainRatioFontSize !== 1) txt += `MainRatioFontSize=${STATE.themeMainRatioFontSize}\n`;
  if (STATE.themeMainColor) txt += `MainColor="${STATE.themeMainColor}"\n`;
  if (STATE.themeShiftMainX) txt += `ShiftMainX=${STATE.themeShiftMainX}\n`;
  if (STATE.themeShiftMainY) txt += `ShiftMainY=${STATE.themeShiftMainY}\n`;
  if (STATE.canvasBody && STATE.canvasBody !== 1200) txt += `body=${STATE.canvasBody}\n`;
  if (STATE.canvasUp && STATE.canvasUp !== 55) txt += `up=${STATE.canvasUp}\n`;
  if (STATE.canvasDown && STATE.canvasDown !== 25) txt += `down=${STATE.canvasDown}\n`;
  if (STATE.canvasLeft && STATE.canvasLeft !== 100) txt += `left=${STATE.canvasLeft}\n`;
  if (STATE.canvasRight && STATE.canvasRight !== 120) txt += `right=${STATE.canvasRight}\n`;
  if (STATE.canvasHeightRitao && STATE.canvasHeightRitao !== 1) txt += `CanvasHeightRitao=${STATE.canvasHeightRitao}\n`;
  if (STATE.canvasWidthRitao && STATE.canvasWidthRitao !== 1) txt += `CanvasWidthRitao=${STATE.canvasWidthRitao}\n`;
  txt += '\n';
  g.forEach((gen, i) => {
    txt += `SetParaFor = Genome${i+1}\n`;
    if (gen.rotation) txt += `RotateChr=${gen.rotation}\n`;
    {
      const sx = (gen.shiftX||0) + (gen.moveX||0);
      const sy = (gen.shiftY||0) + (gen.moveY||0);
      if (sx) txt += `ShiftX=${sx}\n`;
      if (sy) txt += `ShiftY=${sy}\n`;
    }
    if (gen.color) {
      if (gen.color.startsWith('#')) {
        txt += `fill="${gen.color}"\nstroke="${gen.color}"\n`;
      } else {
        txt += `fill=${gen.color}\nstroke=${gen.color}\n`;
      }
    }
    if (gen.genomeNameSizeRatio && gen.genomeNameSizeRatio !== 1) txt += `GenomeNameSizeRatio=${gen.genomeNameSizeRatio}\n`;
    if (gen.genomeNameColor) txt += `GenomeNameColor=${gen.genomeNameColor}\n`;
    if (gen.genomeNameShiftX) txt += `GenomeNameShiftX=${gen.genomeNameShiftX}\n`;
    if (gen.genomeNameShiftY) txt += `GenomeNameShiftY=${gen.genomeNameShiftY}\n`;
    if (gen.chrNameShow) txt += `ChrNameShow=1\n`;
    if (gen.chrNameShiftX) txt += `ChrNameShiftX=${gen.chrNameShiftX}\n`;
    if (gen.chrNameShiftY) txt += `ChrNameShiftY=${gen.chrNameShiftY}\n`;
    if (gen.chrNameSizeRatio && gen.chrNameSizeRatio !== 1) txt += `ChrNameSizeRatio=${gen.chrNameSizeRatio}\n`;
    if (gen.chrNameColor) txt += `ChrNameColor=${gen.chrNameColor}\n`;
    if (gen.chrNameRotate) txt += `ChrNameRotate=${gen.chrNameRotate}\n`;
    if (gen.showCoordinates) txt += `ShowCoordinates=1\n`;
    if (gen.scaleNum && gen.scaleNum !== 10) txt += `ScaleNum=${gen.scaleNum}\n`;
    if (gen.scaleUpDown) txt += `ScaleUpDown=${gen.scaleUpDown}\n`;
    if (gen.scaleUnit) txt += `ScaleUnit=${gen.scaleUnit}\n`;
    if (gen.labelUnit) txt += `LabelUnit=${gen.labelUnit}\n`;
    if (gen.lablePrecision && gen.lablePrecision !== 1) txt += `LablePrecision=${gen.lablePrecision}\n`;
    if (gen.speRegionFile) txt += `SpeRegionFile=${gen.speRegionFile}\n`;
    if (gen.zoomRegion) txt += `ZoomRegion=${gen.zoomRegion}\n`;
    if (gen.zoomChr && gen.zoomChr !== 1) txt += `ZoomChr=${gen.zoomChr}\n`;
    if (gen.linkWidth && gen.linkWidth !== 180) txt += `LinkWidth=${gen.linkWidth}\n`;
    if (gen.normalizedScale) txt += `NormalizedScale=1\n`;
    txt += '\n';
  });
  l.forEach((lk, i) => {
    txt += `SetParaFor = Link${i+1}\n`;
    if (lk.styleUpDown) txt += `StyleUpDown=${lk.styleUpDown}\n`;
    if (lk.reverse) txt += `Reverse=1\n`;
    if (lk.heightRatio && lk.heightRatio !== 1) txt += `HeightRatio=${lk.heightRatio}\n`;
    if (lk.linkFill) {
      if (lk.linkFill.startsWith('#')) txt += `fill="${lk.linkFill}"\n`;
      else txt += `fill=${lk.linkFill}\n`;
    }
    if (lk.linkStroke) {
      if (lk.linkStroke.startsWith('#')) txt += `stroke="${lk.linkStroke}"\n`;
      else txt += `stroke=${lk.linkStroke}\n`;
    }
    if (lk.linkStrokeWidth && lk.linkStrokeWidth !== 1) txt += `stroke-width=${lk.linkStrokeWidth}\n`;
    if (lk.linkFillOpacity && lk.linkFillOpacity !== 1) txt += `fill-opacity=${lk.linkFillOpacity}\n`;
    if (lk.linkStrokeOpacity && lk.linkStrokeOpacity !== 1) txt += `stroke-opacity=${lk.linkStrokeOpacity}\n`;
    txt += '\n';
  });
  const blob = new Blob([txt], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'in.conf';
  a.click(); URL.revokeObjectURL(a.href);
}

/* ==================== Clear ==================== */
async function clearAll() {
  if (!confirm('Clear all session data?')) return;
  try {
    await api('/api/session/clear', { method: 'POST' });
    STATE.genomes = []; STATE.links = []; STATE.genomeData = {};
    STATE.canvasGenomes = []; STATE.resultSvg = null; STATE.selectedIdx = -1;
    STATE.chrWidth = 20; STATE.chrSpacing = 10;
    $('genome-count').value = 2;
    $('gl-chr-width').value = 20; $('gl-chr-width-val').textContent = '20';
    $('gl-chr-spacing').value = 10; $('gl-chr-spacing-val').textContent = '10';
    for (let i = 0; i < 2; i++) addGenome(i);
    STATE.links = []; addLink();
    renderGenomes(); renderLinks();
    $('result-area').style.display = 'none'; $('error-area').style.display = 'none';
    $('run-status').textContent = '';
    $('canvas-status').style.display = 'block'; renderCanvas();
  } catch (e) { console.error('Clear:', e); }
}

document.addEventListener('DOMContentLoaded', init);
