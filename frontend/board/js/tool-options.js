import { S } from './state.js';
import { TEXT_FONTS, VISION_PRESETS, MARKER_ICONS, _TOOL_ORDER } from './constants.js';

let _dragInputEl = null, _dragStartX = 0, _dragStartVal = 0, _dragActive = false, _dragCb = null;
let _optsPanelTimer = null;
let _prevPanelTool = null;

function _closeOptsPanel() {
    document.getElementById('toolOptionsPanel')?.classList.remove('open');
    document.getElementById('fillPill')?.classList.remove('open');
    document.getElementById('belowPill')?.classList.remove('open');
    document.getElementById('arrowPill')?.classList.remove('open');
}
export function _resetOptsTimer() {
    clearTimeout(_optsPanelTimer);
    if (S.currentTool === 'text') return;
    _optsPanelTimer = setTimeout(_closeOptsPanel, 10000);
}
function _touchOptsPanel() {
    clearTimeout(_optsPanelTimer);
    if (S.currentTool === 'text') return;
    _optsPanelTimer = setTimeout(_closeOptsPanel, 10000);
}
document.addEventListener('mousemove', e => {
    if (!_dragActive || !_dragInputEl) return;
    const step = parseFloat(_dragInputEl.dataset.step) || 0.5;
    const min  = parseFloat(_dragInputEl.dataset.min)  || 0.5;
    const max  = parseFloat(_dragInputEl.dataset.max)  || 100;
    const dx   = e.clientX - _dragStartX;
    const val  = Math.max(min, Math.min(max, parseFloat((_dragStartVal + dx * step * 0.18).toFixed(1))));
    _dragInputEl.dataset.value = val;
    _dragInputEl.textContent = val.toFixed(1) + ' px';
    if (_dragCb) _dragCb(val);
});
document.addEventListener('mouseup', () => {
    if (_dragActive) { _dragActive = false; document.body.style.cursor = ''; }
});

function _makeDragInput(id, label, value, min, max, step, onChange) {
    const wrap = document.createElement('div'); wrap.className = 'opts-row';
    const lbl  = document.createElement('span'); lbl.className = 'opts-label'; lbl.textContent = label;
    const inp  = document.createElement('span');
    inp.className = 'drag-input'; inp.id = id;
    inp.dataset.value = value; inp.dataset.min = min; inp.dataset.max = max; inp.dataset.step = step;
    inp.textContent = parseFloat(value).toFixed(1) + ' px';
    inp.addEventListener('mousedown', e => {
        if (e.detail === 2) return;
        _dragInputEl = inp; _dragStartX = e.clientX; _dragStartVal = parseFloat(inp.dataset.value);
        _dragActive = true; _dragCb = onChange;
        document.body.style.cursor = 'ew-resize'; e.preventDefault();
    });
    inp.addEventListener('dblclick', () => {
        const native = document.createElement('input');
        native.type = 'number'; native.min = min; native.max = max; native.step = step;
        native.value = inp.dataset.value;
        native.style.cssText = 'width:70px;background:rgba(255,255,255,0.1);border:1px solid var(--accent);color:#fff;padding:3px 6px;border-radius:6px;font-size:0.76rem;font-weight:700;outline:none;';
        inp.replaceWith(native); native.focus(); native.select();
        const commit = () => {
            const v = Math.max(min, Math.min(max, parseFloat(native.value) || parseFloat(inp.dataset.value)));
            inp.dataset.value = v; inp.textContent = v.toFixed(1) + ' px';
            native.replaceWith(inp); onChange(v);
        };
        native.addEventListener('blur', commit);
        native.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
    });
    wrap.append(lbl, inp); return wrap;
}

function _makeVertSlider(label, initVal, min, max, step, fmtFn, onChange) {
    const TRACK_H = 100;
    let val = initVal;
    const isOpacity = label === 'OPACITY';
    const wrap = document.createElement('div'); wrap.className = 'vert-slider-wrap';
    const valEl = document.createElement('div'); valEl.className = 'vert-slider-val'; valEl.textContent = fmtFn(val);
    const trackArea = document.createElement('div'); trackArea.className = 'vert-slider-track-area';
    const track = document.createElement('div'); track.className = 'vert-slider-track' + (isOpacity ? ' dashed-track' : '');
    const fill = document.createElement('div'); fill.className = 'vert-slider-fill';
    fill.style.background = S.currentColor;
    if (isOpacity) fill.style.display = 'none';
    const knob = document.createElement('div'); knob.className = 'vert-slider-knob';

    function updateVisual(v) {
        const ratio = Math.max(0, Math.min(1, (v - min) / (max - min)));
        knob.style.top = ((1 - ratio) * TRACK_H - 7) + 'px';
        if (!isOpacity) fill.style.height = (ratio * TRACK_H) + 'px';
        valEl.textContent = fmtFn(v);
    }
    updateVisual(val);

    let dragging = false;
    const onMove = (e) => {
        if (!dragging) return;
        const rect = track.getBoundingClientRect();
        const y = Math.max(0, Math.min(TRACK_H, e.clientY - rect.top));
        let v = min + (1 - y / TRACK_H) * (max - min);
        v = parseFloat((Math.round(v / step) * step).toFixed(4));
        v = Math.max(min, Math.min(max, v));
        if (v !== val) { val = v; updateVisual(v); onChange(v); }
    };
    const onUp = () => { dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    trackArea.addEventListener('mousedown', e => { e.preventDefault(); dragging = true; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); onMove(e); });

    valEl.addEventListener('dblclick', () => {
        const ni = document.createElement('input'); ni.type = 'number';
        ni.step = step; ni.min = min; ni.max = max;
        ni.value = isOpacity ? Math.round(val * 100) : parseFloat(val.toFixed(2));
        ni.style.cssText = 'width:100%;font-size:0.58rem;font-weight:700;background:rgba(255,255,255,0.1);border:1px solid var(--accent);border-radius:4px;color:#fff;padding:2px 0;text-align:center;outline:none;box-sizing:border-box;';
        valEl.replaceWith(ni); ni.focus(); ni.select();
        const commit = () => {
            let v = parseFloat(ni.value);
            if (isOpacity) v = v / 100;
            v = isNaN(v) ? val : Math.max(min, Math.min(max, v));
            val = v; onChange(v); updateVisual(v); ni.replaceWith(valEl);
        };
        ni.addEventListener('blur', commit);
        ni.addEventListener('keydown', e => { if (e.key === 'Enter') ni.blur(); if (e.key === 'Escape') ni.replaceWith(valEl); });
    });

    const lbl = document.createElement('div'); lbl.className = 'vert-slider-lbl'; lbl.textContent = label;
    track.append(fill, knob); trackArea.appendChild(track);
    wrap.append(valEl, trackArea, lbl);
    return wrap;
}

export function _updatePanelLinePreview(wrap) {
    if (!wrap) wrap = document.getElementById('panelLinePreview');
    if (!wrap) return;
    wrap.innerHTML = '';
    const patterns = { dashed:[14,9], dotted:[2,10], dashdot:[14,6,2,6] };
    const dashArr = (patterns[S.currentLineStyle] || []).join(',');
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns,'svg');
    svg.setAttribute('width','100%'); svg.setAttribute('height','16'); svg.setAttribute('viewBox','0 0 88 16');
    const mkLine = () => {
        const ln = document.createElementNS(ns,'line');
        ln.setAttribute('x1','4'); ln.setAttribute('y1','8'); ln.setAttribute('x2','84'); ln.setAttribute('y2','8');
        ln.setAttribute('stroke', S.currentColor); ln.setAttribute('stroke-linecap','round');
        ln.setAttribute('stroke-width', String(Math.min(S.currentWidth, 12)));
        if (dashArr) ln.setAttribute('stroke-dasharray', dashArr);
        return ln;
    };
    if (S.currentLineStyle === 'neon') {
        const fid = 'pvNeonF';
        const filter = document.createElementNS(ns,'filter');
        filter.id = fid; filter.setAttribute('x','-20%'); filter.setAttribute('y','-200%'); filter.setAttribute('width','140%'); filter.setAttribute('height','500%');
        const fb = document.createElementNS(ns,'feGaussianBlur'); fb.setAttribute('in','SourceGraphic'); fb.setAttribute('stdDeviation','3.5');
        filter.appendChild(fb); svg.appendChild(filter);
        const glow = mkLine(); glow.setAttribute('filter','url(#'+fid+')'); glow.setAttribute('opacity','0.75');
        const solid = mkLine();
        svg.append(glow, solid);
    } else if (S.currentLineStyle === 'double') {
        const mkDblLine = (y) => {
            const ln = document.createElementNS(ns,'line');
            ln.setAttribute('x1','4'); ln.setAttribute('y1', y); ln.setAttribute('x2','84'); ln.setAttribute('y2', y);
            ln.setAttribute('stroke', S.currentColor); ln.setAttribute('stroke-linecap','round');
            ln.setAttribute('stroke-width', String(Math.min(S.currentWidth, 4)));
            return ln;
        };
        svg.append(mkDblLine('4'), mkDblLine('12'));
    } else {
        svg.appendChild(mkLine());
    }
    wrap.appendChild(svg);
}
function _makePanelLinePreview() {
    const wrap = document.createElement('div'); wrap.className = 'panel-line-preview'; wrap.id = 'panelLinePreview';
    _updatePanelLinePreview(wrap);
    return wrap;
}

function _styleGridSvg(dash, c) {
    const da = dash ? ` stroke-dasharray="${dash}"` : '';
    return `<svg width="100%" height="14" viewBox="0 0 80 14"><line x1="4" y1="7" x2="76" y2="7" stroke="${c}" stroke-width="2.5" stroke-linecap="round"${da}/></svg>`;
}
function _neonDivHtml(c) {
    return `<div style="width:72px;height:2px;border-radius:1px;background:${c};box-shadow:0 0 5px 2px ${c},0 0 12px 5px ${c}55"></div>`;
}
function _dblSvgHtml(c) {
    return `<svg width="100%" height="14" viewBox="0 0 80 14"><line x1="4" y1="4" x2="76" y2="4" stroke="${c}" stroke-width="2" stroke-linecap="round"/><line x1="4" y1="10" x2="76" y2="10" stroke="${c}" stroke-width="2" stroke-linecap="round"/></svg>`;
}

function _makeStyleGrid(activeStyle, onChange) {
    const sec  = document.createElement('div');
    const grid = document.createElement('div'); grid.className = 'style-grid'; grid.id = 'styleGrid';
    const defs = [
        { id:'solid',   dash:null,           dotted:false },
        { id:'dashed',  dash:'9 6',          dotted:false },
        { id:'dotted',  dash:'0.1 9',        dotted:true  },
        { id:'dashdot', dash:'11 5 2 5',     dotted:false },
        { id:'neon',    dash:null,       neon:true   },
    ];
    defs.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'style-btn' + (s.id === activeStyle ? ' active' : '');
        btn.dataset.styleId = s.id;
        btn.title = s.id;
        if (s.neon) {
            btn.innerHTML = _neonDivHtml(S.currentColor);
        } else if (s.dbl) {
            btn.innerHTML = _dblSvgHtml(S.currentColor);
        } else {
            btn.innerHTML = _styleGridSvg(s.dash, S.currentColor);
            if (s.dotted) btn.querySelector('line')?.setAttribute('stroke-width','2.5');
        }
        btn.onclick = () => {
            grid.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active'); onChange(s.id);
        };
        grid.appendChild(btn);
    });
    sec.appendChild(grid); return sec;
}

export function _syncBelowPill() {
    const pill = document.getElementById('belowPill');
    if (!pill) return;
    const knob = pill.querySelector('.below-pill-knob');
    if (!knob) return;
    if (S.currentBelowMap && pill.classList.contains('on')) {
        knob.style.background  = S.currentColor;
        knob.style.borderColor = S.currentColor;
        knob.style.boxShadow   = `0 0 6px ${S.currentColor}88`;
    } else {
        knob.style.background  = 'rgba(255,255,255,0.18)';
        knob.style.borderColor = 'rgba(255,255,255,0.35)';
        knob.style.boxShadow   = '';
    }
}
export function _syncArrowPill() {
    const pill = document.getElementById('arrowPill');
    if (!pill) return;
    const knob = pill.querySelector('.arrow-pill-knob');
    if (!knob) return;
    if (S.currentArrowTip && pill.classList.contains('on')) {
        knob.style.background = S.currentColor;
        knob.style.boxShadow  = `0 0 6px ${S.currentColor}88`;
    } else {
        knob.style.background = 'rgba(255,255,255,0.35)';
        knob.style.boxShadow  = '';
    }
}
export function _syncFillPill() {
    const pill  = document.getElementById('fillPill');
    if (!pill) return;
    const knob = pill.querySelector('.fill-pill-knob');
    if (!knob) return;
    if (S.currentFill && pill.classList.contains('on')) {
        knob.style.background   = S.currentColor;
        knob.style.borderColor  = S.currentColor;
        knob.style.boxShadow    = `0 0 6px ${S.currentColor}88`;
    } else {
        knob.style.background   = 'rgba(255,255,255,0.18)';
        knob.style.borderColor  = 'rgba(255,255,255,0.35)';
        knob.style.boxShadow    = '';
    }
}

export function _syncPanelColors() {
    const panel = document.getElementById('toolOptionsPanel');
    if (!panel) return;
    panel.querySelectorAll('.style-btn[data-style-id]').forEach(btn => {
        const sid = btn.dataset.styleId;
        if (sid === 'neon') {
            btn.innerHTML = _neonDivHtml(S.currentColor);
        } else if (sid === 'double') {
            btn.innerHTML = _dblSvgHtml(S.currentColor);
        } else {
            const ln = btn.querySelector('svg line');
            if (ln) ln.setAttribute('stroke', S.currentColor);
        }
    });
    panel.querySelectorAll('.vert-slider-fill').forEach(fill => {
        if (fill.style.display !== 'none') fill.style.background = S.currentColor;
    });
    panel.querySelectorAll('[data-color-btn]').forEach(btn => {
        if (btn.classList.contains('active')) {
            btn.style.background = S.currentColor + '33';
            btn.style.borderColor = S.currentColor;
        } else {
            btn.style.background = '';
            btn.style.borderColor = '';
        }
    });
    _syncFillPill();
    _syncBelowPill();
    _syncArrowPill();
}

function _makeWidthPreview() {
    const wrap = document.createElement('div'); wrap.className = 'width-preview'; wrap.id = 'widthPreview';
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('width','120'); svg.setAttribute('height','24');
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1','8'); line.setAttribute('y1','12'); line.setAttribute('x2','112'); line.setAttribute('y2','12');
    line.setAttribute('stroke','white'); line.setAttribute('stroke-linecap','round');
    line.setAttribute('stroke-width', String(S.currentWidth));
    svg.appendChild(line); wrap.appendChild(svg); return wrap;
}

export function _renderToolOptions(t) {
    const panel = document.getElementById('toolOptionsPanel');
    const TOOLS_WITH_PANEL = new Set(_TOOL_ORDER);
    if (!TOOLS_WITH_PANEL.has(t)) { panel.classList.remove('open'); document.getElementById('fillPill')?.classList.remove('open'); document.getElementById('belowPill')?.classList.remove('open'); document.getElementById('arrowPill')?.classList.remove('open'); _prevPanelTool = null; return; }

    const prevIdx = _TOOL_ORDER.indexOf(_prevPanelTool);
    const nextIdx = _TOOL_ORDER.indexOf(t);
    const animClass = (prevIdx === -1 || !panel.classList.contains('open')) ? '' :
                      (nextIdx > prevIdx ? 'anim-up' : 'anim-down');
    _prevPanelTool = t;

    panel.innerHTML = '';

    const inner = document.createElement('div');
    inner.className = 'panel-inner' + (animClass ? ' ' + animClass : '');

    const title = document.createElement('div'); title.className = 'opts-title';
    title.textContent = { line:'Line', pencil:'Pencil', circle:'Circle', rect:'Rectangle', text:'Text', move:'Movement', multi:'Markers' }[t];
    inner.appendChild(title);

    if (t === 'text') {
        inner.appendChild(_makeVertSlider('SIZE', S.currentTextSize, 6, 120, 1,
            v => Math.round(v) + 'px',
            v => { S.currentTextSize = v; window._textExports?.refreshActiveText(); }));
        inner.appendChild(_makeVertSlider('OPACITY', S.currentTextOpacity, 0, 1, 0.01,
            v => Math.round(v * 100) + '%',
            v => { S.currentTextOpacity = v; window._textExports?.refreshActiveText(); }));

        const sep2 = document.createElement('div'); sep2.className = 'opts-sep'; inner.appendChild(sep2);
        const fmtLbl = document.createElement('div'); fmtLbl.className = 'opts-label'; fmtLbl.style.marginBottom = '4px'; fmtLbl.textContent = 'FORMAT';
        inner.appendChild(fmtLbl);
        const fmtRow = document.createElement('div'); fmtRow.className = 'format-row';
        const boldBtn = document.createElement('button'); boldBtn.className = 'fmt-btn' + (S.currentTextBold ? ' active' : ''); boldBtn.style.fontWeight = '900'; boldBtn.textContent = 'B';
        boldBtn.addEventListener('mousedown', e => e.preventDefault());
        boldBtn.onclick = () => {
            S.currentTextBold = !S.currentTextBold;
            if (S._activeTextInput?.tagName === 'TEXTAREA') { window._textExports?.refreshActiveText(); S._activeTextInput.focus(); }
            else if (S._activeTextInput) { document.execCommand('bold', false, null); S._activeTextInput.focus(); }
            boldBtn.classList.toggle('active', S.currentTextBold);
        };
        const italicBtn = document.createElement('button'); italicBtn.className = 'fmt-btn' + (S.currentTextItalic ? ' active' : ''); italicBtn.style.fontStyle = 'italic'; italicBtn.textContent = 'I';
        italicBtn.addEventListener('mousedown', e => e.preventDefault());
        italicBtn.onclick = () => {
            S.currentTextItalic = !S.currentTextItalic;
            if (S._activeTextInput?.tagName === 'TEXTAREA') { window._textExports?.refreshActiveText(); S._activeTextInput.focus(); }
            else if (S._activeTextInput) { document.execCommand('italic', false, null); S._activeTextInput.focus(); }
            italicBtn.classList.toggle('active', S.currentTextItalic);
        };
        const shadowBtn = document.createElement('button'); shadowBtn.className = 'fmt-btn' + (S.currentTextShadow ? ' active' : ''); shadowBtn.title = 'Shadow'; shadowBtn.style.fontSize = '10px'; shadowBtn.textContent = 'S';
        shadowBtn.addEventListener('mousedown', e => e.preventDefault());
        shadowBtn.onclick = () => { S.currentTextShadow = !S.currentTextShadow; shadowBtn.classList.toggle('active', S.currentTextShadow); };
        fmtRow.append(boldBtn, italicBtn, shadowBtn); inner.appendChild(fmtRow);

        const alignRow = document.createElement('div'); alignRow.className = 'align-row'; alignRow.style.marginBottom = '2px';
        const ALIGN_SVG = {
            left:   `<svg width="14" height="11" viewBox="0 0 14 11"><line x1="1" y1="1.5" x2="13" y2="1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="5.5" x2="8"  y2="5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="9.5" x2="10" y2="9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
            center: `<svg width="14" height="11" viewBox="0 0 14 11"><line x1="1" y1="1.5" x2="13" y2="1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="3" y1="5.5" x2="11" y2="5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="2" y1="9.5" x2="12" y2="9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
            right:  `<svg width="14" height="11" viewBox="0 0 14 11"><line x1="1" y1="1.5" x2="13" y2="1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="6" y1="5.5" x2="13" y2="5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="4" y1="9.5" x2="13" y2="9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
        };
        ['left','center','right'].forEach(val => {
            const btn = document.createElement('button'); btn.className = 'align-btn' + (S.currentTextAlign === val ? ' active' : '');
            btn.innerHTML = ALIGN_SVG[val]; btn.title = val;
            btn.addEventListener('mousedown', e => e.preventDefault());
            btn.onclick = () => {
                S.currentTextAlign = val;
                alignRow.querySelectorAll('.align-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
                if (S._activeTextInput?.tagName === 'TEXTAREA') { S._activeTextInput.style.textAlign = val; S._activeTextInput.focus(); }
            };
            alignRow.appendChild(btn);
        });
        inner.appendChild(alignRow);

        const sepBg = document.createElement('div'); sepBg.className = 'opts-sep'; inner.appendChild(sepBg);
        const bgLbl = document.createElement('div'); bgLbl.className = 'opts-label'; bgLbl.style.marginBottom = '6px'; bgLbl.textContent = 'BACKGROUND';
        inner.appendChild(bgLbl);
        const bgRow = document.createElement('div'); bgRow.className = 'tb-bg-row';
        const bgToggle = document.createElement('button'); bgToggle.className = 'fmt-btn' + (S.currentTextBg ? ' active' : ''); bgToggle.style.flex = '1'; bgToggle.textContent = 'BG';
        bgToggle.addEventListener('mousedown', e => e.preventDefault());
        bgToggle.onclick = () => { S.currentTextBg = !S.currentTextBg; bgToggle.classList.toggle('active', S.currentTextBg); };
        const bgSwatchWrap = document.createElement('label'); bgSwatchWrap.className = 'color-circle-wrap';
        const bgSwatchInner = document.createElement('span'); bgSwatchInner.className = 'color-circle'; bgSwatchInner.style.background = S.currentTextBgColor;
        const bgSwatch = document.createElement('input'); bgSwatch.type = 'color'; bgSwatch.value = S.currentTextBgColor; bgSwatch.className = 'color-circle-input';
        bgSwatch.addEventListener('input', () => { S.currentTextBgColor = bgSwatch.value; bgSwatchInner.style.background = bgSwatch.value; });
        bgSwatchWrap.append(bgSwatchInner, bgSwatch);
        bgRow.append(bgToggle, bgSwatchWrap); inner.appendChild(bgRow);

        // Roundness toggle
        const rnRow = document.createElement('div'); rnRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:8px;';
        const rnLbl = document.createElement('span'); rnLbl.className = 'opts-label'; rnLbl.style.cssText = 'font-size:10px;opacity:0.55;'; rnLbl.textContent = 'ROUND';
        const rnToggle = document.createElement('div'); rnToggle.className = 'fill-toggle' + (S.currentTextRadius > 0 ? ' on' : '');
        const rnKnob = document.createElement('div'); rnKnob.className = 'fill-knob';
        rnToggle.append(rnKnob);
        rnToggle.addEventListener('mousedown', e => e.preventDefault());
        rnToggle.onclick = () => { S.currentTextRadius = S.currentTextRadius > 0 ? 0 : 14; rnToggle.classList.toggle('on', S.currentTextRadius > 0); };
        rnRow.append(rnLbl, rnToggle); inner.appendChild(rnRow);

        const sepBd = document.createElement('div'); sepBd.className = 'opts-sep'; inner.appendChild(sepBd);
        const bdLbl = document.createElement('div'); bdLbl.className = 'opts-label'; bdLbl.style.marginBottom = '6px'; bdLbl.textContent = 'BORDER';
        inner.appendChild(bdLbl);
        const bdRow = document.createElement('div'); bdRow.className = 'tb-bg-row';
        const bdToggle = document.createElement('button'); bdToggle.className = 'fmt-btn' + (S.currentTextBorder ? ' active' : ''); bdToggle.style.flex = '1'; bdToggle.textContent = 'Border';
        bdToggle.addEventListener('mousedown', e => e.preventDefault());
        bdToggle.onclick = () => { S.currentTextBorder = !S.currentTextBorder; bdToggle.classList.toggle('active', S.currentTextBorder); };
        const bdSwatchWrap = document.createElement('label'); bdSwatchWrap.className = 'color-pill-wrap';
        const bdSwatchInner = document.createElement('span'); bdSwatchInner.className = 'color-pill'; bdSwatchInner.style.background = S.currentTextBorderColor;
        const bdSwatch = document.createElement('input'); bdSwatch.type = 'color'; bdSwatch.value = S.currentTextBorderColor; bdSwatch.className = 'color-circle-input';
        bdSwatch.addEventListener('input', () => { S.currentTextBorderColor = bdSwatch.value; bdSwatchInner.style.background = bdSwatch.value; });
        bdSwatchWrap.append(bdSwatchInner, bdSwatch);
        bdRow.append(bdToggle, bdSwatchWrap); inner.appendChild(bdRow);

        const sepSt = document.createElement('div'); sepSt.className = 'opts-sep'; inner.appendChild(sepSt);
        const stLbl = document.createElement('div'); stLbl.className = 'opts-label'; stLbl.style.marginBottom = '6px'; stLbl.textContent = 'TEXT STROKE';
        inner.appendChild(stLbl);
        const stRow = document.createElement('div'); stRow.className = 'tb-bg-row';
        const stToggle = document.createElement('button'); stToggle.className = 'fmt-btn' + (S.currentTextStroke ? ' active' : ''); stToggle.style.flex = '1'; stToggle.textContent = 'Stroke';
        stToggle.addEventListener('mousedown', e => e.preventDefault());
        stToggle.onclick = () => { S.currentTextStroke = !S.currentTextStroke; stToggle.classList.toggle('active', S.currentTextStroke); };
        const stSwatchWrap = document.createElement('label'); stSwatchWrap.className = 'color-pill-wrap';
        const stSwatchInner = document.createElement('span'); stSwatchInner.className = 'color-pill'; stSwatchInner.style.background = S.currentTextStrokeColor;
        const stSwatch = document.createElement('input'); stSwatch.type = 'color'; stSwatch.value = S.currentTextStrokeColor; stSwatch.className = 'color-circle-input';
        stSwatch.addEventListener('input', () => { S.currentTextStrokeColor = stSwatch.value; stSwatchInner.style.background = stSwatch.value; });
        stSwatchWrap.append(stSwatchInner, stSwatch);
        stRow.append(stToggle, stSwatchWrap); inner.appendChild(stRow);

        const sep3 = document.createElement('div'); sep3.className = 'opts-sep'; inner.appendChild(sep3);
        const fontLbl = document.createElement('div'); fontLbl.className = 'opts-label'; fontLbl.style.marginBottom = '4px'; fontLbl.textContent = 'FONT';
        inner.appendChild(fontLbl);
        const fontGrid = document.createElement('div'); fontGrid.className = 'font-grid';
        TEXT_FONTS.forEach(f => {
            const btn = document.createElement('button'); btn.className = 'font-btn' + (f.name === S.currentTextFont ? ' active' : '');
            btn.style.fontFamily = f.css; btn.textContent = f.label;
            btn.addEventListener('mousedown', e => e.preventDefault());
            btn.onclick = () => { fontGrid.querySelectorAll('.font-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); S.currentTextFont = f.name; window._textExports?.refreshActiveText(); };
            fontGrid.appendChild(btn);
        });
        inner.appendChild(fontGrid);
    } else if (t !== 'move' && t !== 'multi') {
        inner.appendChild(_makePanelLinePreview());

        inner.appendChild(_makeVertSlider('WIDTH', S.currentWidth, 0.5, 30, 0.5,
            v => parseFloat(v.toFixed(1)) + 'px',
            v => { S.currentWidth = v; _updatePanelLinePreview(); }));
        inner.appendChild(_makeVertSlider('OPACITY', S.currentOpacity, 0, 1, 0.01,
            v => Math.round(v * 100) + '%',
            v => { S.currentOpacity = v; }));

        const sep1 = document.createElement('div'); sep1.className = 'opts-sep'; inner.appendChild(sep1);
        inner.appendChild(_makeStyleGrid(S.currentLineStyle, v => { S.currentLineStyle = v; _updatePanelLinePreview(); }));
    }

    if (t === 'move') {
        const speedLbl = document.createElement('div'); speedLbl.className = 'opts-label'; speedLbl.style.marginBottom = '6px'; speedLbl.textContent = 'SPEED';
        inner.appendChild(speedLbl);
        const speedCol = document.createElement('div'); speedCol.style.cssText = 'display:flex;flex-direction:column;gap:4px;width:100%;';
        const MOVE_ICONS = { 'rifle-run':'RifleRun-icon..svg', 'rifle-walk':'RifleWalk-icon..svg', 'knife-run':'KnifeRun-icon..svg', 'knife-walk':'KnifeWalk-icon..svg', 'neon-run':'NeonRun-1.svg' };
        [['rifle-run','Rifle Run','5.4 m/s'],['rifle-walk','Rifle Walk','3.24 m/s'],['knife-run','Faca Run','6.75 m/s'],['knife-walk','Faca Walk','4.05 m/s'],['neon-run','Neon Sprint','9.2 m/s']].forEach(([key, label, spd]) => {
            const btn = document.createElement('button');
            btn.className = 'style-btn' + (S.currentMoveSpeed === key ? ' active' : '');
            btn.dataset.colorBtn = 'true';
            btn.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:10px;width:100%;height:52px;color:white;';
            btn.title = `${label} (${spd})`;
            btn.innerHTML = `<img src="/assets/svg/${MOVE_ICONS[key]}" height="32" style="object-fit:contain;filter:brightness(0) invert(1);opacity:0.85;">`;
            btn.onclick = () => { S.currentMoveSpeed = key; speedCol.querySelectorAll('button').forEach(b => { b.classList.remove('active'); b.style.background=''; b.style.borderColor=''; }); btn.classList.add('active'); _syncPanelColors(); };
            speedCol.appendChild(btn);
        });
        inner.appendChild(speedCol);

        const sep = document.createElement('div'); sep.className = 'opts-sep'; inner.appendChild(sep);
        const styleLbl = document.createElement('div'); styleLbl.className = 'opts-label'; styleLbl.style.marginBottom = '6px'; styleLbl.textContent = 'STYLE';
        inner.appendChild(styleLbl);
        const styleRow = document.createElement('div'); styleRow.style.cssText = 'display:flex;flex-direction:column;gap:4px;width:100%;';
        [['solid', false], ['dash', true]].forEach(([sid, isDash]) => {
            const btn = document.createElement('button');
            btn.className = 'style-btn' + (!isDash === !S.currentMoveDash ? ' active' : '');
            btn.dataset.styleId = sid;
            btn.style.width = '100%';
            const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
            svg.setAttribute('width','44'); svg.setAttribute('height','14'); svg.setAttribute('viewBox','0 0 44 14');
            const ln = document.createElementNS('http://www.w3.org/2000/svg','line');
            ln.setAttribute('x1','4'); ln.setAttribute('y1','7'); ln.setAttribute('x2','40'); ln.setAttribute('y2','7');
            ln.setAttribute('stroke', S.currentColor); ln.setAttribute('stroke-width','2.5'); ln.setAttribute('stroke-linecap','round');
            if (isDash) ln.setAttribute('stroke-dasharray','8 5');
            svg.appendChild(ln); btn.appendChild(svg);
            btn.onclick = () => { S.currentMoveDash = isDash; styleRow.querySelectorAll('button').forEach(b => b.classList.remove('active')); btn.classList.add('active'); };
            styleRow.appendChild(btn);
        });
        inner.appendChild(styleRow);
    }

    if (t === 'multi') {
        const subLbl = document.createElement('div'); subLbl.className = 'opts-label'; subLbl.style.marginBottom = '6px'; subLbl.textContent = 'TOOLS';
        inner.appendChild(subLbl);
        const subGrid = document.createElement('div'); subGrid.style.cssText = 'display:flex;flex-direction:column;gap:4px;width:100%;';

        const subTools = [
            ['vision', 'Vision Field', `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`],
            ['icon',   'Icons',        `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>`],
        ];

        const visionSection = document.createElement('div');
        visionSection.style.display = S.currentMultiSubTool === 'vision' ? 'contents' : 'none';
        const iconSection = document.createElement('div');
        iconSection.style.cssText = 'display:' + (S.currentMultiSubTool === 'icon' ? 'flex' : 'none') + ';flex-direction:column;gap:0;width:100%;';

        subTools.forEach(([key, label, icon]) => {
            const btn = document.createElement('button');
            btn.className = 'style-btn' + (S.currentMultiSubTool === key ? ' active' : '');
            btn.dataset.colorBtn = 'true';
            btn.style.cssText = 'display:flex;align-items:center;gap:8px;justify-content:center;padding:8px 10px;width:100%;color:white;';
            btn.innerHTML = icon + `<span style="font-size:0.65rem;font-weight:700;">${label}</span>`;
            btn.onclick = () => {
                S.currentMultiSubTool = key;
                subGrid.querySelectorAll('button').forEach(b => { b.classList.remove('active'); b.style.background=''; b.style.borderColor=''; });
                btn.classList.add('active');
                visionSection.style.display = key === 'vision' ? 'contents' : 'none';
                iconSection.style.display   = key === 'icon'   ? 'flex'     : 'none';
                _syncPanelColors();
            };
            if (key === 'vision') btn.addEventListener('mousedown', e => window.onVisionMouseDown(e));
            subGrid.appendChild(btn);
        });
        inner.appendChild(subGrid);

        const sep2 = document.createElement('div'); sep2.className = 'opts-sep'; visionSection.appendChild(sep2);
        const presLbl = document.createElement('div'); presLbl.className = 'opts-label'; presLbl.style.marginBottom = '6px'; presLbl.textContent = 'PRESET';
        visionSection.appendChild(presLbl);
        const presCol = document.createElement('div'); presCol.style.cssText = 'display:flex;flex-direction:column;gap:4px;width:100%;';
        VISION_PRESETS.forEach(p => {
            const btn = document.createElement('button');
            btn.className = 'style-btn' + (S.currentVisionPreset === p.key ? ' active' : '');
            btn.dataset.colorBtn = 'true';
            btn.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:10px;width:100%;height:52px;color:white;';
            btn.title = p.label + ' (' + p.deg + '°)';
            const { _coneSvg } = window._visionExports || {};
            btn.innerHTML = _coneSvg ? _coneSvg(p.deg, 36) : '';
            btn.onclick = () => {
                S.currentVisionPreset = p.key;
                S.visionConeAngle = p.deg * Math.PI / 180;
                presCol.querySelectorAll('button').forEach(b => { b.classList.remove('active'); b.style.background=''; b.style.borderColor=''; });
                btn.classList.add('active');
                _syncPanelColors();
            };
            btn.addEventListener('mousedown', e => {
                S.currentVisionPreset = p.key;
                S.visionConeAngle = p.deg * Math.PI / 180;
                window.onVisionMouseDown(e);
            });
            presCol.appendChild(btn);
        });
        visionSection.appendChild(presCol);
        inner.appendChild(visionSection);

        const sep3 = document.createElement('div'); sep3.className = 'opts-sep'; iconSection.appendChild(sep3);
        const iconLbl = document.createElement('div'); iconLbl.className = 'opts-label'; iconLbl.style.marginBottom = '6px'; iconSection.appendChild(iconLbl); iconLbl.textContent = 'ICONS';
        const iconGrid = document.createElement('div'); iconGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:4px;width:100%;';
        MARKER_ICONS.forEach(def => {
            const btn = document.createElement('button');
            btn.className = 'style-btn' + (S.currentIconKey === def.key ? ' active' : '');
            btn.dataset.colorBtn = 'true';
            btn.title = def.label;
            btn.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:6px;aspect-ratio:1;color:white;';
            const img = document.createElement('img');
            const { _markerIconSvgUrl } = window._visionExports || {};
            img.src = _markerIconSvgUrl ? _markerIconSvgUrl(def, 'white') : '';
            img.width = 20; img.height = 20;
            btn.appendChild(img);
            btn.onclick = () => {
                S.currentIconKey = def.key;
                S.currentMultiSubTool = 'icon';
                iconGrid.querySelectorAll('button').forEach(b => { b.classList.remove('active'); b.style.background=''; b.style.borderColor=''; });
                btn.classList.add('active');
                _syncPanelColors();
            };
            btn.addEventListener('mousedown', e => window.onIconMouseDown(e, def.key));
            iconGrid.appendChild(btn);
        });
        iconSection.appendChild(iconGrid);
        inner.appendChild(iconSection);
    }

    panel.appendChild(inner);
    panel.classList.add('open');
    _syncPanelColors();

    const fillPill = document.getElementById('fillPill');
    if (t === 'circle' || t === 'rect') {
        fillPill.classList.toggle('on', S.currentFill);
        fillPill.classList.add('open');
        _syncFillPill();
        fillPill.onclick = () => {
            S.currentFill = !S.currentFill;
            fillPill.classList.toggle('on', S.currentFill);
            _syncFillPill();
        };
        requestAnimationFrame(() => {
            const panelRect  = panel.getBoundingClientRect();
            const parentRect = panel.parentElement.getBoundingClientRect();
            const pillH      = fillPill.offsetHeight;
            fillPill.style.top = (panelRect.bottom - parentRect.top - pillH) + 'px';
        });
    } else {
        fillPill.classList.remove('open');
        fillPill.onclick = null;
    }
    const belowPill = document.getElementById('belowPill');
    if (t === 'circle' || t === 'rect') {
        belowPill.classList.toggle('on', S.currentBelowMap);
        belowPill.classList.add('open');
        _syncBelowPill();
        belowPill.onclick = () => {
            S.currentBelowMap = !S.currentBelowMap;
            belowPill.classList.toggle('on', S.currentBelowMap);
            _syncBelowPill();
        };
        requestAnimationFrame(() => {
            const panelRect  = panel.getBoundingClientRect();
            const parentRect = panel.parentElement.getBoundingClientRect();
            const fillTop    = parseFloat(fillPill.style.top) || (panelRect.bottom - parentRect.top - fillPill.offsetHeight);
            belowPill.style.top = (fillTop - belowPill.offsetHeight - 6) + 'px';
        });
    } else {
        belowPill.classList.remove('open');
        belowPill.onclick = null;
    }
    const arrowPill = document.getElementById('arrowPill');
    if (t === 'line' || t === 'pencil') {
        arrowPill.classList.toggle('on', S.currentArrowTip);
        arrowPill.classList.add('open');
        _syncArrowPill();
        arrowPill.onclick = () => {
            S.currentArrowTip = !S.currentArrowTip;
            arrowPill.classList.toggle('on', S.currentArrowTip);
            _syncArrowPill();
        };
        requestAnimationFrame(() => {
            const panelRect  = panel.getBoundingClientRect();
            const parentRect = panel.parentElement.getBoundingClientRect();
            const pillH      = arrowPill.offsetHeight;
            arrowPill.style.top = (panelRect.bottom - parentRect.top - pillH) + 'px';
        });
    } else {
        arrowPill.classList.remove('open');
        arrowPill.onclick = null;
    }
    panel.addEventListener('mousedown', e => { if (S._activeTextInput) e.preventDefault(); }, { passive: false });
    panel.addEventListener('pointerdown', _touchOptsPanel, { passive: true });
    panel.addEventListener('input', _touchOptsPanel, { passive: true });
    _resetOptsTimer();
}
