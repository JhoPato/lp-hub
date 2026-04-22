import { S } from './state.js';
import { _refreshMapPaint, _refreshVisionGroup } from './vision.js';
import { _updateMoveGroup } from './movement.js';

// These are assigned after their modules load (circular-safe forward refs)
let _onDown, _onMove, _onUp, _onClick, _resetOptsTimer, _redrawMap;
export function _setKonvaHandlers(handlers) {
    _onDown        = handlers.onDown;
    _onMove        = handlers.onMove;
    _onUp          = handlers.onUp;
    _onClick       = handlers.onClick;
    _resetOptsTimer = handlers.resetOptsTimer;
    _redrawMap     = handlers.redrawMap;
}

export function initKonva() {
    const wrap = document.getElementById('konva-wrap');
    S.W = wrap.clientWidth || 800;
    S.H = wrap.clientHeight || 600;
    S.stage = new Konva.Stage({ container: 'konva-wrap', width: S.W, height: S.H, pixelRatio: 1 });
    S.mapLayer    = new Konva.Layer({ listening: false });
    S.paintLayer  = new Konva.Layer({ listening: false });
    S.drawLayer   = new Konva.Layer();
    S.cursorLayer = new Konva.Layer({ listening: false });
    S.stage.add(S.mapLayer, S.paintLayer, S.drawLayer, S.cursorLayer);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) S.stage.getLayers().forEach(l => l.batchDraw());
    });
    window.addEventListener('focus', () => {
        S.stage.getLayers().forEach(l => l.batchDraw());
    });

    S.eraserShape = new Konva.Group({ visible: false, listening: false });
    const _eraserCircle = new Konva.Circle({ x: 0, y: 0, radius: 11, stroke: '#fff', strokeWidth: 1.5, fill: 'rgba(224,80,112,0.18)' });
    S.eraserShape.add(_eraserCircle);
    S.eraserShape.add(new Konva.Line({ points: [-5, 0, 5, 0], stroke: '#fff', strokeWidth: 1, opacity: 0.7 }));
    S.eraserShape.add(new Konva.Line({ points: [0, -5, 0, 5], stroke: '#fff', strokeWidth: 1, opacity: 0.7 }));
    S.eraserShape._circle = _eraserCircle;
    S.cursorLayer.add(S.eraserShape);

    S.transformer = { nodes: () => [], nodes: (_) => {} };

    S.stage.on('mousedown touchstart', (e) => { _resetOptsTimer(); _onDown(e); });
    S.stage.on('mousemove touchmove',  (e) => _onMove(e));
    S.stage.on('mouseup touchend',     _onUp);
    S.stage.on('click tap',            _onClick);

    // ── Brave canvas-fingerprinting workaround ─────────────────────────────
    // Brave randomises getImageData(), breaking Konva's pixel-based hit test.
    // We patch getIntersection() to fall back to pure-math geometry for agent /
    // ability tokens AND their rot-handle diamonds whenever the native pixel
    // lookup returns nothing.
    (function() {
        const _origGI = S.stage.getIntersection.bind(S.stage);
        S.stage.getIntersection = function(pos) {
            const native = _origGI(pos);
            if (native) return native;
            // Convert stage-space → world coordinates (accounts for pan/zoom)
            const wx = (pos.x - S.stage.x()) / S.stage.scaleX();
            const wy = (pos.y - S.stage.y()) / S.stage.scaleY();
            // Walk drawLayer children top-to-bottom (last = topmost visually)
            const nodes = S.drawLayer.getChildren();
            for (let i = nodes.length - 1; i >= 0; i--) {
                const n = nodes[i];
                if (!n.listening() || !n.isVisible()) continue;
                const t = n.getAttr('_type');

                if (t === 'agent' || t === 'ability') {
                    // ── rot-handle diamond (checked first — sits on top visually)
                    const handle = n.findOne('.rot-handle');
                    if (handle && handle.listening() && handle.isVisible()) {
                        const rot = n.rotation() * Math.PI / 180;
                        const hx = n.x() + handle.x() * Math.cos(rot) - handle.y() * Math.sin(rot);
                        const hy = n.y() + handle.x() * Math.sin(rot) + handle.y() * Math.cos(rot);
                        const hdx = wx - hx, hdy = wy - hy;
                        if (hdx * hdx + hdy * hdy <= 12 * 12) return handle;
                    }
                    // ── center circle (main body of token)
                    const r = t === 'agent' ? 26 : 22;
                    const dx = wx - n.x(), dy = wy - n.y();
                    if (dx * dx + dy * dy <= r * r) {
                        return n.findOne('Circle') || n;
                    }
                } else if (t === 'vision') {
                    // ── v-handle diamond (rotate/angle handle)
                    const vHandle = n.findOne('.v-handle');
                    if (vHandle && vHandle.listening() && vHandle.isVisible()) {
                        const dir = n.getAttr('_direction') || 0;
                        const vhx = n.x() + Math.cos(dir) * 60;
                        const vhy = n.y() + Math.sin(dir) * 60;
                        const hdx = wx - vhx, hdy = wy - vhy;
                        if (hdx * hdx + hdy * hdy <= 12 * 12) return vHandle;
                    }
                    // ── center dot (move handle)
                    const dx = wx - n.x(), dy = wy - n.y();
                    if (dx * dx + dy * dy <= 14 * 14) {
                        return n.findOne('Circle') || n;
                    }
                }
            }
            return null;
        };
    })();

    // Drag detection via native events (works even when Konva nodes intercept mousemove)
    document.addEventListener('mousedown', e => {
        S._mouseDownPos = { x: e.clientX, y: e.clientY };
        S._isDragMove = false;
    }, { capture: true, passive: true });
    document.addEventListener('mousemove', e => {
        if (S._isDragMove || !S._mouseDownPos) return;
        const dx = e.clientX - S._mouseDownPos.x, dy = e.clientY - S._mouseDownPos.y;
        if (dx * dx + dy * dy > 25) S._isDragMove = true;
    }, { passive: true });

    // Middle-mouse button pan
    S.stage.container().addEventListener('mousedown', (e) => {
        if (e.button !== 1) return;
        e.preventDefault();
        S._isPanning = true;
        S._panStart = { x: e.clientX, y: e.clientY };
        S._panOrigin = { x: S.stage.x(), y: S.stage.y() };
        S.stage.container().style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', (e) => {
        if (!S._isPanning) return;
        S.stage.position({
            x: S._panOrigin.x + (e.clientX - S._panStart.x),
            y: S._panOrigin.y + (e.clientY - S._panStart.y),
        });
        S.stage.batchDraw();
        window._textExports?._syncAllGlassOverlays?.();
    });
    window.addEventListener('mouseup', (e) => {
        if (!S._isPanning) return;
        if (e.button !== 1) return;
        S._isPanning = false;
        S.stage.container().style.cursor = '';
    });

    S.stage.container().addEventListener('wheel', (e) => {
        e.preventDefault();
        if (S._isPanning) return;
        const scaleBy = 1.08;
        const oldScale = S.stage.scaleX();
        const pointer = S.stage.getPointerPosition();
        const mousePointTo = {
            x: (pointer.x - S.stage.x()) / oldScale,
            y: (pointer.y - S.stage.y()) / oldScale,
        };
        let newScale = e.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
        newScale = Math.max(0.5, Math.min(3, newScale));
        S.stage.scale({ x: newScale, y: newScale });
        S.stage.position({
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        });
        S.stage.batchDraw();
        window._textExports?._syncAllGlassOverlays?.();
    }, { passive: false });

    window.addEventListener('resize', () => {
        const w = wrap.clientWidth; const h = wrap.clientHeight;
        if (w === S.W && h === S.H) return;
        const oldMox = S.W / 2 - S.mapDisplayW / 2, oldMoy = S.H / 2 - S.mapDisplayH / 2;
        const oldMW = S.mapDisplayW, oldMH = S.mapDisplayH;
        S.W = w; S.H = h; S.stage.width(S.W); S.stage.height(S.H);
        _redrawMap().then(() => {
            if (!oldMW || !oldMH) return;
            const newMox = S.W / 2 - S.mapDisplayW / 2, newMoy = S.H / 2 - S.mapDisplayH / 2;
            const rx = v => (v - oldMox) / oldMW * S.mapDisplayW + newMox;
            const ry = v => (v - oldMoy) / oldMH * S.mapDisplayH + newMoy;
            S.paintLayer.getChildren().forEach(node => {
                node.setAttr('_shapeX', rx(node.getAttr('_shapeX') || 0));
                node.setAttr('_shapeY', ry(node.getAttr('_shapeY') || 0));
                if (node.getAttr('_shapeType') === 'rect') { node.setAttr('_shapeW', (node.getAttr('_shapeW')||0) * S.mapDisplayW / (oldMW||1)); node.setAttr('_shapeH', (node.getAttr('_shapeH')||0) * S.mapDisplayH / (oldMH||1)); }
                else { node.setAttr('_shapeR', (node.getAttr('_shapeR')||0) * S.mapDisplayW / (oldMW||1)); }
                _refreshMapPaint(node);
            });
            S.paintLayer.batchDraw();
            S.drawLayer.getChildren().forEach(node => {
                const cls = node.getClassName();
                if (cls === 'Transformer') return;
                const t = node.getAttr('_type');
                if (cls === 'Arrow' || cls === 'Line') {
                    const ox = node.x(), oy = node.y();
                    node.x(0); node.y(0);
                    node.points(node.points().map((v, i) => i % 2 === 0 ? rx(v + ox) : ry(v + oy)));
                } else if (t === 'pencil-arrow') {
                    const ox = node.x(), oy = node.y(); node.x(0); node.y(0);
                    node.getChildren().forEach(c => {
                        if (c instanceof Konva.Line) c.points(c.points().map((v, i) => i % 2 === 0 ? rx(v + ox) : ry(v + oy)));
                    });
                } else if (t === 'move-path') {
                    const ln = node.getChildren().find(c => c instanceof Konva.Line);
                    if (ln) { const ox = node.x(), oy = node.y(); node.x(0); node.y(0); _updateMoveGroup(node, ln.points().map((v, i) => i % 2 === 0 ? rx(v + ox) : ry(v + oy))); }
                } else if (t === 'vision') {
                    node.x(rx(node.x())); node.y(ry(node.y())); _refreshVisionGroup(node);
                } else {
                    node.x(rx(node.x())); node.y(ry(node.y()));
                }
            });
            S.drawLayer.batchDraw();
        });
    });
}
