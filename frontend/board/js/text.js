import { S } from './state.js';
import { TEXT_FONTS } from './constants.js';
import { getCanvasPos } from './utils.js';

// ── Glass DOM overlay (backdrop-filter blur for textbox backgrounds) ───────
// The Konva canvas cannot apply backdrop-filter natively.
// We insert a DOM div BEFORE the drawLayer canvas in the DOM, so it sits
// above the map canvas (applying blur to it) but below the text/handles canvas.
export function _createGlassOverlay(g) {
    if (!g.getAttr('_hasBg')) return;
    if (g._glassDom) { _syncGlassOverlay(g); return; }
    const drawCanvas = S.drawLayer?.getCanvas()?._canvas;
    if (!drawCanvas?.parentNode) return;
    const div = document.createElement('div');
    // Insert between paintLayer and drawLayer so backdrop-filter blurs the map canvas below
    // while drawLayer/cursorLayer canvases remain visually above this overlay.
    div.style.cssText = 'position:absolute;pointer-events:none;backdrop-filter:blur(28px) saturate(1.7);-webkit-backdrop-filter:blur(28px) saturate(1.7);box-shadow:0 8px 32px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.09);';
    drawCanvas.parentNode.insertBefore(div, drawCanvas);
    g._glassDom = div;
    _syncGlassOverlay(g);
}

export function _removeGlassOverlay(g) {
    if (g._glassDom) { g._glassDom.remove(); g._glassDom = null; }
}

export function _syncGlassOverlay(g) {
    const div = g._glassDom;
    if (!div) return;
    if (!g.getAttr('_hasBg')) { div.style.display = 'none'; return; }
    div.style.display = g.isVisible() !== false ? '' : 'none';
    const sc = S.stage.scaleX();
    const x = g.x() * sc + S.stage.x();
    const y = g.y() * sc + S.stage.y();
    const bW = g.getAttr('_boxWidth') || 240;
    const bgNode = g.findOne('.tb-bg');
    const bH = bgNode ? bgNode.height() : 60;
    const hasBorder = g.getAttr('_hasBorder');
    Object.assign(div.style, {
        left: x + 'px',
        top: y + 'px',
        width: (bW * sc) + 'px',
        height: (bH * sc) + 'px',
        borderRadius: Math.round((g.getAttr('_radius') ?? 14) * sc) + 'px',
        background: g.getAttr('_bgColor') || '#0c0e14',
        opacity: String(g.getAttr('_bgOpacity') ?? 0.72),
        border: hasBorder
            ? `2px solid ${g.getAttr('_borderColor') || '#fff'}`
            : '1px solid rgba(255,255,255,0.11)',
    });
}

export function _syncAllGlassOverlays() {
    S.drawLayer?.getChildren().forEach(n => {
        if (n.getAttr('_type') === 'textbox') _syncGlassOverlay(n);
    });
}

// ── Resize-handle constants (shared by build / refresh / attach) ─────────
const _RH_NAMES   = ['tb-rh-nw','tb-rh-n','tb-rh-ne','tb-rh-e','tb-rh-se','tb-rh-s','tb-rh-sw','tb-rh-w'];
const _RH_CURSORS = { 'tb-rh-nw':'nw-resize','tb-rh-n':'n-resize','tb-rh-ne':'ne-resize','tb-rh-e':'e-resize','tb-rh-se':'se-resize','tb-rh-s':'s-resize','tb-rh-sw':'sw-resize','tb-rh-w':'w-resize' };
// type: 'e' = drag right edge (change width), 'w' = drag left edge (shift x + change width), 'n'/'s' = top/bottom (no-op for auto-height text)
const _RH_TYPES   = { 'tb-rh-nw':'w','tb-rh-n':'n','tb-rh-ne':'e','tb-rh-e':'e','tb-rh-se':'e','tb-rh-s':'s','tb-rh-sw':'w','tb-rh-w':'w' };
const _RH_HS      = 7; // handle square side length in px

function _rhPositions(bW, bH) {
    const h = _RH_HS;
    return {
        'tb-rh-nw': [0 - h/2,    0 - h/2],
        'tb-rh-n':  [bW/2 - h/2, 0 - h/2],
        'tb-rh-ne': [bW - h/2,   0 - h/2],
        'tb-rh-e':  [bW - h/2,   bH/2 - h/2],
        'tb-rh-se': [bW - h/2,   bH - h/2],
        'tb-rh-s':  [bW/2 - h/2, bH - h/2],
        'tb-rh-sw': [0 - h/2,    bH - h/2],
        'tb-rh-w':  [0 - h/2,    bH/2 - h/2],
    };
}
function _makeResizeHandles(bW, bH, color) {
    const pos = _rhPositions(bW, bH);
    return _RH_NAMES.map(name => new Konva.Rect({
        name, x: pos[name][0], y: pos[name][1],
        width: _RH_HS, height: _RH_HS,
        fill: '#ffffff', stroke: color, strokeWidth: 1.5,
        cornerRadius: 1, opacity: 0, listening: true,
    }));
}

export function _refreshActiveText() {
    if (!S._activeTextInput) return;
    const inp = S._activeTextInput;
    const sc  = S.stage.scaleX();
    const fCss = TEXT_FONTS.find(f => f.name === S.currentTextFont)?.css || 'Inter, sans-serif';
    inp.style.fontFamily  = fCss;
    inp.style.fontSize    = (S.currentTextSize * sc) + 'px';
    inp.style.fontWeight  = S.currentTextBold   ? '700' : '400';
    inp.style.fontStyle   = S.currentTextItalic ? 'italic' : 'normal';
    inp.style.color       = S.currentColor;
    inp.style.opacity     = String(S.currentTextOpacity);
    if (inp.dataset?.editorType === 'textbox') {
        // contentEditable textbox editor — update full border + align
        inp.style.borderColor = S.currentColor + 'cc';
        inp.style.textAlign   = S.currentTextAlign;
        // also sync the drag handle border if present
        const handle = inp._dragHandle;
        if (handle) handle.style.borderColor = S.currentColor + 'cc';
    } else if (inp.tagName === 'TEXTAREA') {
        inp.style.borderColor = S.currentColor + 'cc';
        inp.style.textAlign   = S.currentTextAlign;
    } else {
        inp.style.borderBottomColor = S.currentColor + 'cc';
    }
}

export function _buildTextBox(pos, text, opts = {}) {
    const font       = opts.font       ?? S.currentTextFont;
    const size       = opts.size       ?? S.currentTextSize;
    const color      = opts.color      ?? S.currentColor;
    const bold       = opts.bold       ?? S.currentTextBold;
    const italic     = opts.italic     ?? S.currentTextItalic;
    const align      = opts.align      ?? S.currentTextAlign;
    const shadow     = opts.shadow     ?? S.currentTextShadow;
    const hasBg      = opts.hasBg      ?? S.currentTextBg;
    const bgColor    = opts.bgColor    ?? S.currentTextBgColor;
    const bgOpacity  = opts.bgOpacity  ?? S.currentTextBgOpacity;
    const opacity    = opts.opacity    ?? S.currentTextOpacity;
    const boxWidth   = opts.boxWidth   ?? 240;
    const radius     = opts.radius     ?? S.currentTextRadius;
    const PAD = 10;
    const fCss = TEXT_FONTS.find(f => f.name === font)?.css || 'Inter, sans-serif';
    const fs   = bold && italic ? 'bold italic' : bold ? 'bold' : italic ? 'italic' : 'normal';

    const g = new Konva.Group({ x: pos.x, y: pos.y });
    g.setAttr('_type',        'textbox');
    g.setAttr('_text',        text);
    g.setAttr('_textFont',    font);
    g.setAttr('_textSize',    size);
    g.setAttr('_textColor',   color);
    g.setAttr('_textBold',    bold);
    g.setAttr('_textItalic',  italic);
    g.setAttr('_textAlign',   align);
    g.setAttr('_textShadow',  shadow);
    g.setAttr('_hasBg',       hasBg);
    g.setAttr('_bgColor',     bgColor);
    g.setAttr('_bgOpacity',   bgOpacity);
    g.setAttr('_textOpacity', opacity);
    g.setAttr('_boxWidth',    boxWidth);
    g.setAttr('_radius',      radius);

    const hasBorder    = opts.hasBorder    ?? S.currentTextBorder;
    const borderColor  = opts.borderColor  ?? S.currentTextBorderColor;
    const hasStroke    = opts.hasStroke    ?? S.currentTextStroke;
    const strokeColor  = opts.strokeColor  ?? S.currentTextStrokeColor;

    const tn = new Konva.Text({
        name: 'tb-text', x: PAD, y: PAD,
        text, width: boxWidth - PAD * 2,
        fontFamily: fCss, fontSize: size, fontStyle: fs,
        fill: color, align, lineHeight: 1.3, wrap: 'word',
    });
    if (hasStroke) { tn.stroke(strokeColor); tn.strokeWidth(Math.max(1, size * 0.06)); tn.strokeEnabled(true); tn.fillAfterStrokeEnabled(true); }
    if (shadow) { tn.shadowEnabled(true); tn.shadowColor('rgba(0,0,0,0.85)'); tn.shadowBlur(4); tn.shadowOffset({ x:1, y:1 }); tn.shadowOpacity(1); }
    g.setAttr('_hasStroke',   hasStroke);
    g.setAttr('_strokeColor', strokeColor);

    const boxH = tn.height() + PAD * 2;
    if (hasBg || hasBorder) {
        // Invisible Konva rect kept for bounds/hit detection; DOM glass overlay provides visuals.
        g.add(new Konva.Rect({
            name:'tb-bg', x:0, y:0, width:boxWidth, height:boxH, cornerRadius:radius,
            fill:'rgba(0,0,0,0.001)', strokeWidth:0, listening:false, opacity:0,
        }));
    }
    g.setAttr('_hasBorder',    hasBorder);
    g.setAttr('_borderColor',  borderColor);
    g.add(tn);
    _makeResizeHandles(boxWidth, boxH, color).forEach(h => g.add(h));
    g.opacity(opacity);
    return g;
}

// Builds a textbox-type group with per-run formatting (mixed bold/italic).
// Used when the user applies bold/italic to a text selection in the editor.
export function _buildTextBoxFromRuns(pos, runs, opts = {}) {
    const PAD     = 10;
    const font    = opts.font    ?? S.currentTextFont;
    const size    = opts.size    ?? S.currentTextSize;
    const color   = opts.color   ?? S.currentColor;
    const shadow  = opts.shadow  ?? S.currentTextShadow;
    const hasBg   = opts.hasBg   ?? S.currentTextBg;
    const bgColor = opts.bgColor ?? S.currentTextBgColor;
    const bgOp    = opts.bgOpacity ?? S.currentTextBgOpacity;
    const hasBd   = opts.hasBorder  ?? S.currentTextBorder;
    const bdColor = opts.borderColor ?? S.currentTextBorderColor;
    const hasSt   = opts.hasStroke  ?? S.currentTextStroke;
    const stColor = opts.strokeColor ?? S.currentTextStrokeColor;
    const opacity = opts.opacity ?? S.currentTextOpacity;
    const radius  = opts.radius  ?? S.currentTextRadius;
    const lh      = size * 1.3;
    const fCss    = TEXT_FONTS.find(f => f.name === font)?.css || 'Inter, sans-serif';

    const g = new Konva.Group({ x: pos.x, y: pos.y });
    g.setAttr('_type',        'textbox');
    g.setAttr('_text',        runs.filter(r => r.text !== '\n').map(r => r.text).join(''));
    g.setAttr('_runs',        JSON.stringify(runs));
    g.setAttr('_textFont',    font);
    g.setAttr('_textSize',    size);
    g.setAttr('_textColor',   color);
    g.setAttr('_textBold',    false);
    g.setAttr('_textItalic',  false);
    g.setAttr('_textAlign',   opts.align ?? S.currentTextAlign);
    g.setAttr('_textShadow',  shadow);
    g.setAttr('_hasBg',       hasBg);
    g.setAttr('_bgColor',     bgColor);
    g.setAttr('_bgOpacity',   bgOp);
    g.setAttr('_textOpacity', opacity);
    g.setAttr('_hasBorder',   hasBd);
    g.setAttr('_borderColor', bdColor);
    g.setAttr('_hasStroke',   hasSt);
    g.setAttr('_strokeColor', stColor);
    g.setAttr('_radius',      radius);

    const lines = [[]];
    runs.forEach(r => r.text === '\n' ? lines.push([]) : lines[lines.length - 1].push(r));

    let maxW = PAD;
    lines.forEach((line, li) => {
        let xOff = PAD;
        line.forEach(run => {
            if (!run.text) return;
            const fs = (run.bold && run.italic) ? 'bold italic' : run.bold ? 'bold' : run.italic ? 'italic' : 'normal';
            const t = new Konva.Text({
                x: xOff, y: PAD + li * lh,
                text: run.text, fill: color,
                fontFamily: fCss, fontSize: size, fontStyle: fs, lineHeight: 1.3,
            });
            if (hasSt) { t.stroke(stColor); t.strokeWidth(Math.max(1, size * 0.06)); t.strokeEnabled(true); t.fillAfterStrokeEnabled(true); }
            if (shadow) { t.shadowEnabled(true); t.shadowColor('rgba(0,0,0,0.85)'); t.shadowBlur(4); t.shadowOffset({ x:1, y:1 }); t.shadowOpacity(1); }
            xOff += t.width();
            g.add(t);
        });
        maxW = Math.max(maxW, xOff);
    });

    const boxW = Math.max(maxW + PAD, opts.boxWidth ?? 0, 60);
    const boxH = lines.length * lh + PAD * 2;
    g.setAttr('_boxWidth', boxW);

    if (hasBg || hasBd) {
        const rect = new Konva.Rect({
            name: 'tb-bg', x: 0, y: 0, width: boxW, height: boxH, cornerRadius: radius,
            fill:'rgba(0,0,0,0.001)', strokeWidth:0, listening:false, opacity:0,
        });
        g.add(rect);
        rect.moveToBottom();
    }
    _makeResizeHandles(boxW, boxH, color).forEach(h => g.add(h));
    g.opacity(opacity);
    return g;
}

export function _refreshTextBox(g) {
    const text      = g.getAttr('_text')       || '';
    const font      = g.getAttr('_textFont')   || S.currentTextFont;
    const size      = g.getAttr('_textSize')   || 20;
    const color     = g.getAttr('_textColor')  || '#ffffff';
    const bold      = g.getAttr('_textBold')   || false;
    const italic    = g.getAttr('_textItalic') || false;
    const align     = g.getAttr('_textAlign')  || 'left';
    const shadow    = g.getAttr('_textShadow') || false;
    const hasBg     = g.getAttr('_hasBg')      || false;
    const bgColor   = g.getAttr('_bgColor')    || '#1e293b';
    const bgOpacity = g.getAttr('_bgOpacity')  ?? 0.88;
    const boxWidth  = g.getAttr('_boxWidth')   || 240;
    const PAD = 10;
    const fCss = TEXT_FONTS.find(f => f.name === font)?.css || 'Inter, sans-serif';
    const fs   = bold && italic ? 'bold italic' : bold ? 'bold' : italic ? 'italic' : 'normal';

    const hasBorder   = g.getAttr('_hasBorder')   || false;
    const borderColor = g.getAttr('_borderColor')  || '#ffffff';
    const hasStroke   = g.getAttr('_hasStroke')    || false;
    const strokeColor = g.getAttr('_strokeColor')  || '#000000';

    const tn = g.findOne('.tb-text');
    if (tn) {
        tn.width(boxWidth - PAD * 2); tn.fontFamily(fCss); tn.fontSize(size);
        tn.fontStyle(fs); tn.fill(color); tn.align(align); tn.text(text);
        if (hasStroke) { tn.stroke(strokeColor); tn.strokeWidth(Math.max(1, size * 0.06)); tn.strokeEnabled(true); tn.fillAfterStrokeEnabled(true); }
        else { tn.strokeEnabled(false); }
        if (shadow) { tn.shadowEnabled(true); tn.shadowColor('rgba(0,0,0,0.85)'); tn.shadowBlur(4); tn.shadowOffset({ x:1, y:1 }); tn.shadowOpacity(1); }
        else tn.shadowEnabled(false);
    }
    const boxH = (tn?.height() ?? size * 1.3) + PAD * 2;
    let bgNode = g.findOne('.tb-bg');
    if (hasBg || hasBorder) {
        if (!bgNode) {
            const r = g.getAttr('_radius') ?? 14;
            bgNode = new Konva.Rect({ name:'tb-bg', x:0, y:0, cornerRadius:r, fill:'rgba(0,0,0,0.001)', strokeWidth:0, listening:false, opacity:0 });
            g.add(bgNode); bgNode.moveToBottom();
        }
        // Keep dimensions in sync (used by _syncGlassOverlay to read height)
        bgNode.width(boxWidth); bgNode.height(boxH);
    } else if (bgNode) { bgNode.visible(false); }
    _syncGlassOverlay(g);
    const pos = _rhPositions(boxWidth, boxH);
    _RH_NAMES.forEach(name => {
        const rh = g.findOne('.' + name);
        if (!rh) return;
        rh.x(pos[name][0]); rh.y(pos[name][1]); rh.stroke(color);
    });
    g.getLayer()?.batchDraw();
}

export function _addTextBoxResizeHandle(g) {
    _RH_NAMES.forEach(name => {
        const rh = g.findOne('.' + name);
        if (!rh) return;
        const rhType = _RH_TYPES[name];
        const cursor = _RH_CURSORS[name];

        rh.on('mouseenter', () => { S.stage.container().style.cursor = cursor; });
        rh.on('mouseleave', () => { const { _syncCursor } = window._drawingExports || {}; if (_syncCursor) _syncCursor(true); });

        if (rhType === 'n' || rhType === 's') return; // height is auto for text

        rh.on('mousedown', e => {
            e.cancelBubble = true;
            g.draggable(false);
            const startX  = e.evt.clientX;
            const startW  = g.getAttr('_boxWidth') || 240;
            const startGX = g.x();
            const sc = S.stage.scaleX();
            const onMove = ev => {
                const delta = (ev.clientX - startX) / sc;
                if (rhType === 'e') {
                    g.setAttr('_boxWidth', Math.max(60, startW + delta));
                } else { // 'w'
                    const newW = Math.max(60, startW - delta);
                    g.x(startGX + (startW - newW));
                    g.setAttr('_boxWidth', newW);
                }
                _refreshTextBox(g);
                window._drawingExports?._refreshSelectionTr?.();
            };
            const onUp = () => {
                g.draggable(true);
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    });

}

// existingContent: string (plain text from old textbox) or runs[] (rich textbox)
export function _placeTextBoxEditor(pos, boxWidth, bgColor, existingContent = '', borderColor = null, strokeColor = null, stagePtr = null, originalGroup = null) {
    const stageRect = S.stage.container().getBoundingClientRect();
    const sc  = S.stage.scaleX();
    const clientX = stageRect.left + pos.x * sc + S.stage.x();
    const clientY = stageRect.top  + pos.y * sc + S.stage.y();
    const fCss = TEXT_FONTS.find(f => f.name === S.currentTextFont)?.css || 'Inter, sans-serif';
    const edW  = Math.max(80, Math.round(boxWidth * sc));
    const bg   = bgColor || 'rgba(20,22,30,0.88)';

    // ── Drag handle bar (Issue 1) ──────────────────────────────────────
    const handle = document.createElement('div');
    handle.title = 'Drag to move';
    handle.style.cssText = [
        'position:fixed', `width:${edW}px`, 'height:12px', 'cursor:grab', 'z-index:201',
        `border:2px solid ${S.currentColor}cc`, 'border-bottom:1px solid rgba(255,255,255,0.1)',
        'border-radius:4px 4px 0 0',
        `background:${bg}`,
        'display:flex', 'align-items:center', 'justify-content:center',
        'user-select:none',
    ].join(';');
    handle.innerHTML = `<svg width="20" height="4" viewBox="0 0 20 4" fill="none"><rect width="20" height="1.5" rx="1" fill="rgba(255,255,255,0.28)"/><rect y="2.5" width="20" height="1.5" rx="1" fill="rgba(255,255,255,0.28)"/></svg>`;
    document.body.appendChild(handle);

    // ── contentEditable editor (Issues 4, 2) ─────────────────────────
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.dataset.editorType = 'textbox';
    editor._dragHandle = handle;
    editor.spellcheck = false;
    editor.style.cssText = [
        'position:fixed', 'box-sizing:border-box',
        `left:${clientX}px`, `top:${clientY}px`, `width:${edW}px`,
        `min-height:${Math.round((S.currentTextSize * 1.3 + 20) * sc)}px`,
        'outline:none', 'z-index:200',
        `border:2px solid ${S.currentColor}cc`, 'border-top:none', 'border-radius:0 0 4px 4px',
        `box-shadow:0 0 0 3px ${S.currentColor}33, 0 0 10px rgba(79,148,245,0.2)`,
        `color:${S.currentColor}`,
        `font-family:${fCss}`, `font-size:${S.currentTextSize * sc}px`,
        `font-weight:${S.currentTextBold ? '700' : '400'}`,
        `font-style:${S.currentTextItalic ? 'italic' : 'normal'}`,
        `text-align:${S.currentTextAlign}`,
        `opacity:${S.currentTextOpacity}`,
        'line-height:1.3', 'padding:10px',
        'word-break:break-word', 'caret-color:white', 'white-space:pre-wrap',
        `background:${bg}`,
    ].join(';');
    document.body.appendChild(editor);

    // Keep handle positioned just above the editor
    const syncHandle = () => {
        const r = editor.getBoundingClientRect();
        handle.style.left  = r.left + 'px';
        handle.style.top   = (r.top - 12) + 'px';
        handle.style.width = r.width + 'px';
    };
    requestAnimationFrame(syncHandle);
    const _resObs = new ResizeObserver(syncHandle);
    _resObs.observe(editor);

    // Drag logic on the handle bar
    handle.addEventListener('mousedown', e => {
        e.preventDefault();
        const startMX = e.clientX, startMY = e.clientY;
        const startL = parseFloat(editor.style.left), startT = parseFloat(editor.style.top);
        handle.style.cursor = 'grabbing';
        const onMove = ev => {
            const newL = startL + ev.clientX - startMX;
            const newT = startT + ev.clientY - startMY;
            editor.style.left = newL + 'px';
            editor.style.top  = newT + 'px';
            syncHandle();
            pos.x = (newL - stageRect.left - S.stage.x()) / sc;
            pos.y = (newT - stageRect.top  - S.stage.y()) / sc;
        };
        const onUp = () => { handle.style.cursor = 'grab'; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    // Initialize HTML content
    let initialHtml = '';
    if (Array.isArray(existingContent) && existingContent.length) {
        initialHtml = _runsToHtml(existingContent);
    } else if (typeof existingContent === 'string' && existingContent) {
        initialHtml = existingContent
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/\n/g,'<br>');
    }
    if (initialHtml) editor.innerHTML = initialHtml;

    S._activeTextInput = editor;
    editor.focus();

    // Cursor at click point (Issue from previous session)
    if (stagePtr && initialHtml) {
        const cx = stageRect.left + stagePtr.x;
        const cy = stageRect.top  + stagePtr.y;
        requestAnimationFrame(() => {
            try {
                if (document.caretPositionFromPoint) {
                    const cp = document.caretPositionFromPoint(cx, cy);
                    if (cp?.offsetNode) { const r = document.createRange(); r.setStart(cp.offsetNode, cp.offset); r.collapse(true); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); return; }
                } else if (document.caretRangeFromPoint) {
                    const cr = document.caretRangeFromPoint(cx, cy);
                    if (cr) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(cr); return; }
                }
            } catch {}
            const sel = window.getSelection(); const rng = document.createRange();
            rng.selectNodeContents(editor); rng.collapse(false); sel.removeAllRanges(); sel.addRange(rng);
        });
    } else if (initialHtml) {
        requestAnimationFrame(() => {
            const sel = window.getSelection(); const rng = document.createRange();
            rng.selectNodeContents(editor); rng.collapse(false); sel.removeAllRanges(); sel.addRange(rng);
        });
    }

    // ── Issue 5: suppress blur-commit when clicking tool options panel ─
    let _blurSuppressed = false;
    const _suppressBlur = (e) => {
        const tp = document.getElementById('toolOptionsPanel');
        const cp = document.getElementById('cpPicker');
        if (tp?.contains(e.target) || cp?.contains(e.target)) {
            _blurSuppressed = true;
            setTimeout(() => { _blurSuppressed = false; if (!committed) editor.focus(); }, 200);
        }
    };
    document.addEventListener('mousedown', _suppressBlur, true);

    const cleanup = () => {
        _resObs.disconnect();
        document.removeEventListener('mousedown', _suppressBlur, true);
        if (document.body.contains(handle)) document.body.removeChild(handle);
    };

    let committed = false;
    const commit = () => {
        if (committed) return; committed = true;
        cleanup();
        if (S._activeTextInput === editor) S._activeTextInput = null;
        if (!document.body.contains(editor)) return;
        document.body.removeChild(editor);

        const runs = _parseContentEditable(editor);
        if (!runs.length || runs.every(r => !r.text.trim())) return;

        const font = S.currentTextFont;
        const size = S.currentTextSize;
        const opts = {
            font, size, color: S.currentColor,
            bold: S.currentTextBold, italic: S.currentTextItalic, align: S.currentTextAlign,
            shadow: S.currentTextShadow,
            hasBg: bgColor != null || S.currentTextBg, bgColor: bgColor || S.currentTextBgColor, bgOpacity: S.currentTextBgOpacity,
            hasBorder: borderColor != null || S.currentTextBorder, borderColor: borderColor || S.currentTextBorderColor,
            hasStroke: strokeColor != null || S.currentTextStroke, strokeColor: strokeColor || S.currentTextStrokeColor,
            opacity: S.currentTextOpacity, boxWidth, radius: S.currentTextRadius,
        };

        // ── Issue 4: uniform formatting → textbox; mixed → textbox with runs ─
        const textRuns = runs.filter(r => r.text !== '\n');
        const firstBold   = textRuns[0]?.bold   ?? S.currentTextBold;
        const firstItalic = textRuns[0]?.italic ?? S.currentTextItalic;
        const isUniform   = textRuns.every(r => r.bold === firstBold && r.italic === firstItalic);

        let g;
        if (isUniform) {
            const text = runs.map(r => r.text).join('');
            g = _buildTextBox(pos, text, { ...opts, bold: firstBold, italic: firstItalic });
        } else {
            g = _buildTextBoxFromRuns(pos, runs, opts);
        }

        const { attachHandlers, _pushHistory } = window._drawingExports || {};
        S.drawLayer.add(g);
        if (attachHandlers) attachHandlers(g);
        _addTextBoxResizeHandle(g);
        if (_pushHistory) _pushHistory(g);
        S.drawLayer.batchDraw();
    };

    editor.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            committed = true; // prevent post-Escape blur from triggering commit
            cleanup();
            if (S._activeTextInput === editor) S._activeTextInput = null;
            if (document.body.contains(editor)) document.body.removeChild(editor);
            if (originalGroup) {
                S.drawLayer.add(originalGroup);
                const { attachHandlers, _pushHistory } = window._drawingExports || {};
                if (attachHandlers) attachHandlers(originalGroup);
                _addTextBoxResizeHandle(originalGroup);
                if (_pushHistory) _pushHistory(originalGroup);
                S.drawLayer.batchDraw();
            }
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
    });
    editor.addEventListener('blur', () => setTimeout(() => {
        if (!committed && !_blurSuppressed && document.activeElement !== editor) commit();
    }, 200));
}

function _parseContentEditable(el) {
    const runs = [];
    function walk(node, bold, italic) {
        if (node.nodeType === 3) {
            if (node.textContent) runs.push({ text: node.textContent, bold, italic });
            return;
        }
        if (node.nodeType !== 1) return;
        const tag = node.tagName.toLowerCase();
        let b = bold, it = italic;
        if (tag === 'b' || tag === 'strong') b = true;
        if (tag === 'i' || tag === 'em')     it = true;
        const st = node.style;
        if (st.fontWeight === 'bold' || (parseInt(st.fontWeight) || 0) >= 600) b = true;
        if (st.fontStyle === 'italic') it = true;
        if (tag === 'br') { runs.push({ text:'\n', bold:false, italic:false }); return; }
        if ((tag === 'div' || tag === 'p') && node !== el && runs.length > 0)
            runs.push({ text:'\n', bold:false, italic:false });
        node.childNodes.forEach(c => walk(c, b, it));
    }
    walk(el, S.currentTextBold, S.currentTextItalic);
    while (runs.length && runs[runs.length-1].text === '\n') runs.pop();
    return runs;
}

export function _runsToHtml(runs) {
    let html = '';
    for (const r of runs) {
        if (r.text === '\n') { html += '<br>'; continue; }
        const esc = r.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        if (r.bold && r.italic) html += `<b><i>${esc}</i></b>`;
        else if (r.bold)        html += `<b>${esc}</b>`;
        else if (r.italic)      html += `<i>${esc}</i>`;
        else                    html += esc;
    }
    return html;
}

export function _buildRichTextKonva(pos, runs) {
    const fCss = TEXT_FONTS.find(f => f.name === S.currentTextFont)?.css || 'Inter, sans-serif';
    const lh   = S.currentTextSize * 1.3;
    const group = new Konva.Group({ x: pos.x, y: pos.y });
    group.setAttr('_type', 'text');
    group.setAttr('_runs', JSON.stringify(runs));
    group.setAttr('_textFont', S.currentTextFont);
    group.setAttr('_textSize', S.currentTextSize);
    group.setAttr('_textOpacity', S.currentTextOpacity);
    group.setAttr('_textColor', S.currentColor);
    const lines = [[]];
    runs.forEach(r => r.text === '\n' ? lines.push([]) : lines[lines.length-1].push(r));
    lines.forEach((line, li) => {
        let xOff = 0;
        line.forEach(run => {
            if (!run.text) return;
            const fs = (run.bold && run.italic) ? 'bold italic'
                     : run.bold ? 'bold' : run.italic ? 'italic' : 'normal';
            const t = new Konva.Text({
                x: xOff, y: li * lh, text: run.text, fill: S.currentColor,
                fontFamily: fCss, fontSize: S.currentTextSize, fontStyle: fs, lineHeight: 1.3,
            });
            xOff += t.width();
            group.add(t);
        });
    });
    return group;
}

export function _placeTextInput(pos, initialHtml = '', stagePtr = null, originalGroup = null) {
    const stageRect = S.stage.container().getBoundingClientRect();
    const sc = S.stage.scaleX();
    const clientX = stageRect.left + pos.x * sc + S.stage.x();
    const clientY = stageRect.top  + pos.y * sc + S.stage.y();
    const fCss = TEXT_FONTS.find(f => f.name === S.currentTextFont)?.css || 'Inter, sans-serif';

    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.spellcheck = false;
    editor.style.cssText = [
        'position:fixed',
        `left:${clientX}px`, `top:${clientY}px`,
        'min-width:60px', 'max-width:560px',
        'background:transparent', 'outline:none',
        `border-bottom:2px solid ${S.currentColor}cc`,
        `box-shadow:0 2px 0 0 ${S.currentColor}55`,
        `color:${S.currentColor}`,
        `font-family:${fCss}`,
        `font-size:${S.currentTextSize * sc}px`,
        `font-weight:${S.currentTextBold ? '700' : '400'}`,
        `font-style:${S.currentTextItalic ? 'italic' : 'normal'}`,
        `opacity:${S.currentTextOpacity}`,
        'line-height:1.3', 'z-index:200', 'padding:2px 6px',
        'white-space:pre-wrap', 'word-break:break-word', 'caret-color:white',
    ].join(';');

    if (initialHtml) editor.innerHTML = initialHtml;

    document.body.appendChild(editor);
    S._activeTextInput = editor;
    editor.focus();

    if (initialHtml) {
        if (stagePtr) {
            // Try to place cursor at the click point
            const cx = stageRect.left + stagePtr.x;
            const cy = stageRect.top  + stagePtr.y;
            requestAnimationFrame(() => {
                try {
                    if (document.caretPositionFromPoint) {
                        const cp = document.caretPositionFromPoint(cx, cy);
                        if (cp?.offsetNode) {
                            const r = document.createRange();
                            r.setStart(cp.offsetNode, cp.offset);
                            r.collapse(true);
                            const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
                            return;
                        }
                    } else if (document.caretRangeFromPoint) {
                        const cr = document.caretRangeFromPoint(cx, cy);
                        if (cr) {
                            const s = window.getSelection(); s.removeAllRanges(); s.addRange(cr);
                            return;
                        }
                    }
                } catch {}
                // Fallback: cursor at end
                const sel = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(editor); range.collapse(false);
                sel.removeAllRanges(); sel.addRange(range);
            });
        } else {
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    const diamond = document.createElement('div');
    diamond.title = 'Drag to move';
    diamond.style.cssText = `position:fixed;width:10px;height:10px;background:${S.currentColor};opacity:0.75;transform:rotate(45deg);cursor:grab;z-index:201;border-radius:1px;`;
    document.body.appendChild(diamond);

    const syncDiamond = () => {
        const r = editor.getBoundingClientRect();
        diamond.style.left = (r.left + r.width / 2 - 5) + 'px';
        diamond.style.top  = (r.bottom + 7) + 'px';
    };
    requestAnimationFrame(syncDiamond);
    editor.addEventListener('input', syncDiamond);
    const _resizeObs = new ResizeObserver(syncDiamond);
    _resizeObs.observe(editor);

    diamond.addEventListener('mousedown', e => {
        e.preventDefault(); e.stopPropagation();
        const startMX = e.clientX, startMY = e.clientY;
        const startL = parseFloat(editor.style.left), startT = parseFloat(editor.style.top);
        diamond.style.cursor = 'grabbing';
        const onDmove = ev => {
            const newL = startL + ev.clientX - startMX;
            const newT = startT + ev.clientY - startMY;
            editor.style.left = newL + 'px';
            editor.style.top  = newT + 'px';
            syncDiamond();
            pos.x = (newL - stageRect.left - S.stage.x()) / sc;
            pos.y = (newT - stageRect.top  - S.stage.y()) / sc;
        };
        const onDup = () => { diamond.style.cursor = 'grab'; document.removeEventListener('mousemove', onDmove); document.removeEventListener('mouseup', onDup); };
        document.addEventListener('mousemove', onDmove);
        document.addEventListener('mouseup', onDup);
    });

    // Suppress blur-commit when clicking tool options panel (Issue 5)
    let _blurSuppressedRT = false;
    const _suppressBlurRT = (e) => {
        const tp = document.getElementById('toolOptionsPanel');
        const cp = document.getElementById('cpPicker');
        if (tp?.contains(e.target) || cp?.contains(e.target)) {
            _blurSuppressedRT = true;
            setTimeout(() => { _blurSuppressedRT = false; if (!committed) editor.focus(); }, 200);
        }
    };
    document.addEventListener('mousedown', _suppressBlurRT, true);

    const cleanup = () => {
        _resizeObs.disconnect();
        document.removeEventListener('mousedown', _suppressBlurRT, true);
        if (document.body.contains(diamond)) document.body.removeChild(diamond);
    };

    let committed = false;
    const commit = () => {
        if (committed) return; committed = true;
        cleanup();
        if (S._activeTextInput === editor) S._activeTextInput = null;
        if (!document.body.contains(editor)) return;
        document.body.removeChild(editor);
        const runs = _parseContentEditable(editor);
        if (!runs.length || runs.every(r => !r.text.trim())) return;
        const group = _buildRichTextKonva(pos, runs);
        group.opacity(S.currentTextOpacity);
        S.drawLayer.add(group);
        const { attachHandlers, _pushHistory } = window._drawingExports || {};
        if (attachHandlers) attachHandlers(group);
        if (_pushHistory) _pushHistory(group);
        S.drawLayer.batchDraw();
    };

    editor.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            committed = true; // prevent post-Escape blur from triggering commit
            cleanup();
            if (S._activeTextInput === editor) S._activeTextInput = null;
            if (document.body.contains(editor)) document.body.removeChild(editor);
            if (originalGroup) {
                S.drawLayer.add(originalGroup);
                const { attachHandlers, _pushHistory } = window._drawingExports || {};
                if (attachHandlers) attachHandlers(originalGroup);
                if (_pushHistory) _pushHistory(originalGroup);
                S.drawLayer.batchDraw();
            }
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) { e.preventDefault(); commit(); }
    });
    editor.addEventListener('blur', () => setTimeout(() => {
        if (!committed && !_blurSuppressedRT && document.activeElement !== editor) commit();
    }, 200));
}
