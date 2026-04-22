import { S } from './state.js';
import { ABILITY_AOE_DB, SLOT_API, SLOT_KEY, getSlotKey } from './constants.js';
import { loadImg, _proxyUrl, m2px, getAbilityAoe } from './utils.js';
import { _buildVisionCone, _tryAttachVisionToAgent, _tryAttachNearbyVision, _castVisionCone, _castRay } from './vision.js';
import { toast } from '/js/utils.js';

export function _isLightColor(hex) {
    if (!hex || hex.length < 7) return false;
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.65;
}

export function _iconBgFill(hex, opacity) {
    if (opacity >= 1 || !hex || hex[0] !== '#') return hex;
    let h = hex.slice(1);
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    const r = parseInt(h.slice(0,2), 16), g = parseInt(h.slice(2,4), 16), b = parseInt(h.slice(4,6), 16);
    return `rgba(${r},${g},${b},${opacity.toFixed(2)})`;
}

export function _iconBorderFill(mainColor, opacity) {
    return _iconBgFill(mainColor === '#ffffff' ? '#111' : '#fff', opacity);
}

export function _animateBubble(g) {
    g.scale({ x: 1.38, y: 1.38 });
    g.getLayer()?.batchDraw();
    new Konva.Tween({
        node: g,
        duration: 0.52,
        scaleX: 1,
        scaleY: 1,
        easing: Konva.Easings.ElasticEaseOut,
    }).play();
}

export function _reorderAgentsToTop() {
    S.drawLayer.getChildren(n => n.getAttr('_type') === 'agent').forEach(n => n.moveToTop());
    S.drawLayer.batchDraw();
}

function _syncCursor(overShape) {
    const { _syncCursor: sc } = window._drawingExports || {};
    if (sc) sc(overShape);
    else {
        if (S.eraseMode) { S.stage.container().style.cursor = 'none'; return; }
        if (overShape) { S.stage.container().style.cursor = 'grab'; return; }
    }
}

function _refreshConeFov(g) {
    window._visionExports?._refreshConeFov?.(g);
}

function _refreshCrossClip(g) {
    window._visionExports?._refreshCrossClip?.(g);
}

function _refreshAnnihilationBounce(g) {
    window._visionExports?._refreshAnnihilationBounce?.(g);
}

function _toggleAnnihilationBounce(g) {
    window._visionExports?._toggleAnnihilationBounce?.(g);
}

function _rebuildAllMovePaths() {
    window._drawingExports?._rebuildAllMovePaths?.();
}

export function attachHandlers(shape) {
    const { attachHandlers: ah } = window._drawingExports || {};
    if (ah) { ah(shape); return; }
}

export function buildAoeGroup(pos, aoeInfo, angle, color, withIcon) {
    const { type, radius, length, coneAngle, castOffset, minLen, maxLen } = typeof aoeInfo === 'object' ? aoeInfo : { type: S.currentAoeType, radius: aoeInfo };
    const co = castOffset || 0;
    const isDir = type === 'line' || type === 'cylinder' || type === 'rect' || type === 'cone' || type === 'cross' || type === 'arrow' || type === 'annihilation';
    const g = new Konva.Group({ x: pos.x, y: pos.y, rotation: isDir ? (angle || 0) : 0 });
    if (type === 'circle') {
        g.add(new Konva.Circle({ radius, fill: color+'28', stroke: color, strokeWidth: 1.5, name: 'aoe-circle' }));
    } else if (type === 'cone') {
        const wa = coneAngle || 55;
        const waRad = wa * Math.PI / 180;
        const initAngleRad = (angle || 0) * Math.PI / 180;
        if (S._visionData) {
            const _spx = S.stage ? pos.x * S.stage.scaleX() + S.stage.x() : pos.x;
            const _spy = S.stage ? pos.y * S.stage.scaleY() + S.stage.y() : pos.y;
            const rawPts = _castVisionCone(_spx, _spy, radius, initAngleRad, waRad, 360);
            const cosA = Math.cos(-initAngleRad), sinA = Math.sin(-initAngleRad);
            const localPts = [];
            for (let i = 0; i < rawPts.length; i += 2) {
                const wx = rawPts[i], wy = rawPts[i + 1];
                localPts.push(wx * cosA - wy * sinA, wx * sinA + wy * cosA);
            }
            g.add(new Konva.Line({ points: localPts, closed: true, fill: color+'28', stroke: color+'aa', strokeWidth: 1.5, lineJoin: 'round', name: 'cone-fov' }));
        } else {
            g.add(new Konva.Wedge({ radius, angle: wa, fill: color+'28', stroke: color, strokeWidth: 1.5, rotation: -(wa/2), name: 'cone-fov' }));
        }
        if (withIcon) _addRotHandle(g, 36, color, 'cone');
    } else if (type === 'line') {
        const len = length || radius;
        g.add(new Konva.Line({ points: [co, 0, co + len, 0], stroke: color, strokeWidth: 6, lineCap: 'round', opacity: 0.9, name: 'aoe-body' }));
        if (withIcon) _addRotHandle(g, co + len, color, 'line', minLen, maxLen, co);
    } else if (type === 'cylinder') {
        const w = Math.max(8, radius);
        const len = length || radius * 4;
        g.add(new Konva.Rect({ x: co, y: -w/2, width: len, height: w, fill: color+'28', stroke: color, strokeWidth: 1.5, name: 'aoe-body' }));
        if (withIcon) _addRotHandle(g, co + len, color, 'cylinder', minLen, maxLen, co);
    } else if (type === 'rect') {
        const w = Math.max(8, radius);
        const len = length || radius * 2;
        g.add(new Konva.Rect({ x: co, y: -w/2, width: len, height: w, fill: color+'28', stroke: color, strokeWidth: 1.5, name: 'aoe-body' }));
        if (withIcon) _addRotHandle(g, co + len, color, 'rect', minLen, maxLen, co);
    } else if (type === 'cross') {
        const half = length || 60;
        if (aoeInfo.wallClip && S._visionData) {
            const gRotRad = ((angle || 0) * Math.PI) / 180;
            const LA = [Math.PI / 4, -3 * Math.PI / 4, 3 * Math.PI / 4, -Math.PI / 4];
            const d = LA.map(la => _castRay(pos.x, pos.y, gRotRad + la, half));
            g.add(new Konva.Line({ points: [d[1]*Math.cos(LA[1]), d[1]*Math.sin(LA[1]), d[0]*Math.cos(LA[0]), d[0]*Math.sin(LA[0])], stroke: color, strokeWidth: 6, lineCap: 'round', opacity: 0.9 }));
            g.add(new Konva.Line({ points: [d[2]*Math.cos(LA[2]), d[2]*Math.sin(LA[2]), d[3]*Math.cos(LA[3]), d[3]*Math.sin(LA[3])], stroke: color, strokeWidth: 6, lineCap: 'round', opacity: 0.9, name: 'aoe-body' }));
            g.on('dragmove', () => _refreshCrossClip(g));
        } else {
            g.add(new Konva.Line({ points: [-half, -half,  half,  half], stroke: color, strokeWidth: 6, lineCap: 'round', opacity: 0.9 }));
            g.add(new Konva.Line({ points: [-half,  half,  half, -half], stroke: color, strokeWidth: 6, lineCap: 'round', opacity: 0.9, name: 'aoe-body' }));
        }
        if (withIcon) _addRotHandle(g, half, color, 'cross');
    } else if (type === 'annihilation') {
        const w = Math.max(8, radius);
        const len = length || radius * 4;
        g.add(new Konva.Rect({ x: 0, y: -w/2, width: len, height: w, fill: color+'28', stroke: color, strokeWidth: 1.5, name: 'aoe-body' }));
        g.setAttr('_lenPx', len);
        g.setAttr('_halfWPx', w / 2);
        g.setAttr('_bounceEnabled', true);
        if (withIcon) _addRotHandle(g, len, color, 'annihilation');
    } else if (type === 'blaze') {
        const hasPts = typeof aoeInfo === 'object' && aoeInfo.pathPoints?.length >= 4;
        const isStraight = !hasPts && aoeInfo?.straight;
        const _bMax = maxLen||m2px(21);
        const existPts = hasPts ? aoeInfo.pathPoints : (isStraight ? [0, 0, _bMax, 0] : [0, 0]);
        g.add(new Konva.Line({ points: existPts, stroke: color, strokeWidth: 6, lineCap: 'round', lineJoin: 'round', tension: 0.3, opacity: 0.9, name: 'aoe-body' }));
        if (withIcon) _addBlazeHandle(g, color, _bMax, existPts, isStraight);
    } else if (type === 'high-tide') {
        const hasPts = typeof aoeInfo === 'object' && aoeInfo.pathPoints?.length >= 4;
        const isStraight = !hasPts && aoeInfo?.straight;
        const _htMax = maxLen||m2px(60);
        const existPts = hasPts ? aoeInfo.pathPoints : (isStraight ? [0, 0, _htMax, 0] : [0, 0]);
        g.add(new Konva.Line({ points:existPts, stroke:color, strokeWidth:6, lineCap:'round', lineJoin:'round', tension:0.4, opacity:0.9, name:'aoe-body' }));
        if (withIcon) _addHighTideHandle(g, color, _htMax, existPts, isStraight);
    } else if (type === 'arrow') {
        [
            { x: 26, h: 7,  o: 1.0  },
            { x: 40, h: 9,  o: 0.65 },
            { x: 56, h: 11, o: 0.35 },
        ].forEach(({ x, h, o }) => {
            g.add(new Konva.Line({
                points: [x - h * 1.1, -h, x, 0, x - h * 1.1, h],
                stroke: color, strokeWidth: 2.5, lineCap: 'round', lineJoin: 'round', opacity: o,
            }));
        });
        if (withIcon) _addRotHandle(g, 65, color, 'arrow');
    }
    if (withIcon) {
        if (type === 'circle') {
            const dot = new Konva.Circle({ radius: 15 * S.abilityIconScale, fill: _iconBgFill(color, S.iconBgOpacity), stroke: _iconBorderFill(color, S.iconBgOpacity), strokeWidth: 2 });
            g.add(dot);
            g.setAttr('_centerDot', dot);
        } else {
            g.add(new Konva.Circle({ radius: 18 * S.abilityIconScale, fill: _iconBgFill(color, S.iconBgOpacity), stroke: _iconBorderFill(color, S.iconBgOpacity), strokeWidth: 1.5 }));
        }
    }
    return g;
}

function _addRotHandle(g, tipX, color, type, minLen, maxLen, castOffset) {
    const resizable = (type === 'line' || type === 'cylinder' || type === 'rect') && maxLen !== undefined;
    const co = castOffset || 0;
    const diamond = new Konva.Rect({
        x: tipX, y: 0, width: 14, height: 14,
        offsetX: 7, offsetY: 7,
        fill: color, stroke: _isLightColor(color) ? '#111' : '#fff', strokeWidth: 1.5,
        rotation: 45, name: 'rot-handle',
    });
    diamond.on('mousedown touchstart', function(e) {
        e.cancelBubble = true;
        g.draggable(false);
        const stg = g.getStage();
        let _rhLastEmit = 0;
        const onMove = function() {
            const p = stg.getPointerPosition();
            if (!p) return;
            const abs = g.getAbsolutePosition();
            const sc = stg.scaleX();
            const dx = (p.x - abs.x) / sc;
            const dy = (p.y - abs.y) / sc;
            g.rotation(Math.atan2(dy, dx) * 180 / Math.PI);
            const _ig = g.findOne('.icon-grp'); if (_ig) _ig.rotation(-g.rotation());
            _refreshCrossClip(g);
            if (g.getAttr('_aoeType') === 'cone') _refreshConeFov(g);
            if (g.getAttr('_abilityName') === 'Annihilation') _refreshAnnihilationBounce(g);
            if (resizable) {
                const rawDist = Math.sqrt(dx * dx + dy * dy);
                const newTip = Math.min(co + maxLen, Math.max(co + minLen, rawDist));
                const newLen = newTip - co;
                const body = g.findOne('.aoe-body');
                if (body) {
                    if (type === 'line') body.points([co, 0, newTip, 0]);
                    else body.width(newLen);
                }
                diamond.x(newTip);
                const aoi = JSON.parse(g.getAttr('_aoeInfo') || '{}');
                aoi.length = newLen;
                g.setAttr('_aoeInfo', JSON.stringify(aoi));
            }
            g.getLayer().batchDraw();
            const now = Date.now();
            if (now - _rhLastEmit >= 33) {
                _rhLastEmit = now;
                window.dispatchEvent(new CustomEvent('_el:changing', { detail: g }));
            }
        };
        const onUp = function() {
            g.draggable(true);
            stg.off('mousemove.rh touchmove.rh', onMove);
            stg.off('mouseup.rh touchend.rh', onUp);
            window.removeEventListener('mouseup', onUp);
            window.dispatchEvent(new CustomEvent('_el:changed', { detail: g }));
        };
        stg.on('mousemove.rh touchmove.rh', onMove);
        stg.on('mouseup.rh touchend.rh', onUp);
        window.addEventListener('mouseup', onUp);
    });
    diamond.on('click tap', e => e.cancelBubble = true);
    diamond.on('mouseenter', () => { g.getStage().container().style.cursor = resizable ? 'ew-resize' : 'grab'; });
    diamond.on('mouseleave', () => { _syncCursor(true); });
    g.add(diamond);
}

function _addBlazeHandle(g, color, maxLen, initialPts, isStraight) {
    const initX = isStraight ? maxLen : (initialPts?.length >= 4 ? initialPts[initialPts.length - 2] : 0);
    const initY = isStraight ? 0 : (initialPts?.length >= 4 ? initialPts[initialPts.length - 1] : 0);
    const diamond = new Konva.Rect({
        x: initX, y: initY, width: 14, height: 14,
        offsetX: 7, offsetY: 7,
        fill: color, stroke: _isLightColor(color) ? '#111' : '#fff', strokeWidth: 1.5,
        rotation: 45, name: 'rot-handle',
    });
    const CURSOR_STEP_PX = 14;
    function rotateMode() {
        g.draggable(false);
        const stg = g.getStage();
        let _rhLastEmit = 0;
        const onMove = function() {
            const p = stg.getPointerPosition();
            if (!p) return;
            const abs = g.getAbsolutePosition();
            const sc = stg.scaleX();
            const dx = (p.x - abs.x) / sc;
            const dy = (p.y - abs.y) / sc;
            g.rotation(Math.atan2(dy, dx) * 180 / Math.PI);
            const _ig = g.findOne('.icon-grp'); if (_ig) _ig.rotation(-g.rotation());
            g.getLayer().batchDraw();
            const now = Date.now();
            if (now - _rhLastEmit >= 33) { _rhLastEmit = now; window.dispatchEvent(new CustomEvent('_el:changing', { detail: g })); }
        };
        const onUp = function() {
            g.draggable(true);
            stg.off('mousemove.rh touchmove.rh', onMove);
            stg.off('mouseup.rh touchend.rh', onUp);
            window.removeEventListener('mouseup', onUp);
            window.dispatchEvent(new CustomEvent('_el:changed', { detail: g }));
        };
        stg.on('mousemove.rh touchmove.rh', onMove);
        stg.on('mouseup.rh touchend.rh', onUp);
        window.addEventListener('mouseup', onUp);
    }
    function startDraw(seedPos) {
        const _aoi0 = JSON.parse(g.getAttr('_aoeInfo') || '{}');
        _aoi0.straight = false;
        g.setAttr('_aoeInfo', JSON.stringify(_aoi0));
        g.draggable(false);
        const stg = g.getStage();
        const body = g.findOne('.aoe-body');
        if (body) body.points([0, 0]);
        diamond.x(0); diamond.y(0);
        let pts = [0, 0];
        let totalLenPx = 0;
        let _rhLastEmit = 0;
        const p0 = seedPos || stg.getPointerPosition() || { x: 0, y: 0 };
        const _t0 = g.getAbsoluteTransform().copy().invert();
        const _lp0 = _t0.point(p0);
        let lastCursorX = _lp0.x;
        let lastCursorY = _lp0.y;
        const onMove = function() {
            const p = stg.getPointerPosition();
            if (!p) return;
            const _t = g.getAbsoluteTransform().copy().invert();
            const _lp = _t.point(p);
            const cx = _lp.x;
            const cy = _lp.y;
            const movedX = cx - lastCursorX, movedY = cy - lastCursorY;
            if (Math.sqrt(movedX * movedX + movedY * movedY) < CURSOR_STEP_PX) return;
            lastCursorX = cx; lastCursorY = cy;
            const segPx = Math.sqrt(movedX * movedX + movedY * movedY);
            if (totalLenPx + segPx > maxLen) return;
            const tipX = pts[pts.length - 2], tipY = pts[pts.length - 1];
            const ddx = cx - tipX, ddy = cy - tipY;
            const tipLen = Math.sqrt(ddx * ddx + ddy * ddy);
            if (tipLen < 0.001) return;
            const nx = tipX + (ddx / tipLen) * segPx;
            const ny = tipY + (ddy / tipLen) * segPx;
            pts.push(nx, ny);
            totalLenPx += segPx;
            if (body) body.points([...pts]);
            diamond.x(nx); diamond.y(ny);
            const aoi = JSON.parse(g.getAttr('_aoeInfo') || '{}');
            aoi.pathPoints = [...pts];
            aoi.length = totalLenPx;
            g.setAttr('_aoeInfo', JSON.stringify(aoi));
            g.getLayer().batchDraw();
            const now = Date.now();
            if (now - _rhLastEmit >= 33) {
                _rhLastEmit = now;
                window.dispatchEvent(new CustomEvent('_el:changing', { detail: g }));
            }
        };
        const onUp = function() {
            g.draggable(true);
            stg.off('mousemove.rh touchmove.rh', onMove);
            stg.off('mouseup.rh touchend.rh', onUp);
            window.removeEventListener('mouseup', onUp);
            window.dispatchEvent(new CustomEvent('_el:changed', { detail: g }));
        };
        stg.on('mousemove.rh touchmove.rh', onMove);
        stg.on('mouseup.rh touchend.rh', onUp);
        window.addEventListener('mouseup', onUp);
    }
    diamond.on('mousedown touchstart', function(e) {
        e.cancelBubble = true;
        const _aoi = JSON.parse(g.getAttr('_aoeInfo') || '{}');
        if (_aoi.straight) rotateMode(); else startDraw();
    });
    diamond.on('click tap', e => e.cancelBubble = true);
    diamond.on('mouseenter', () => {
        const _aoi = JSON.parse(g.getAttr('_aoeInfo') || '{}');
        g.getStage().container().style.cursor = _aoi.straight ? 'grab' : 'crosshair';
    });
    diamond.on('mouseleave', () => { _syncCursor(true); });
    g.add(diamond);
    g.setAttr('_startDraw', startDraw);
    return diamond;
}

function _addHighTideHandle(g, color, maxLen, initialPts, isStraight) {
    const initX = isStraight ? maxLen : (initialPts?.length >= 4 ? initialPts[initialPts.length - 2] : 0);
    const initY = isStraight ? 0 : (initialPts?.length >= 4 ? initialPts[initialPts.length - 1] : 0);
    const diamond = new Konva.Rect({
        x: initX, y: initY, width: 14, height: 14,
        offsetX: 7, offsetY: 7,
        fill: color, stroke: _isLightColor(color) ? '#111' : '#fff', strokeWidth: 1.5,
        rotation: 45, name: 'rot-handle',
    });
    const MAX_RAD_PER_M = 7.2 * Math.PI / 180;
    const CURSOR_STEP_PX = 14;
    function rotateMode() {
        g.draggable(false);
        const stg = g.getStage();
        let _rhLastEmit = 0;
        const onMove = function() {
            const p = stg.getPointerPosition();
            if (!p) return;
            const abs = g.getAbsolutePosition();
            const sc = stg.scaleX();
            const dx = (p.x - abs.x) / sc;
            const dy = (p.y - abs.y) / sc;
            g.rotation(Math.atan2(dy, dx) * 180 / Math.PI);
            const _ig = g.findOne('.icon-grp'); if (_ig) _ig.rotation(-g.rotation());
            g.getLayer().batchDraw();
            const now = Date.now();
            if (now - _rhLastEmit >= 33) { _rhLastEmit = now; window.dispatchEvent(new CustomEvent('_el:changing', { detail: g })); }
        };
        const onUp = function() {
            g.draggable(true);
            stg.off('mousemove.rh touchmove.rh', onMove);
            stg.off('mouseup.rh touchend.rh', onUp);
            window.removeEventListener('mouseup', onUp);
            window.dispatchEvent(new CustomEvent('_el:changed', { detail: g }));
        };
        stg.on('mousemove.rh touchmove.rh', onMove);
        stg.on('mouseup.rh touchend.rh', onUp);
        window.addEventListener('mouseup', onUp);
    }
    function startDraw(seedPos) {
        const _aoi0 = JSON.parse(g.getAttr('_aoeInfo') || '{}');
        _aoi0.straight = false;
        g.setAttr('_aoeInfo', JSON.stringify(_aoi0));
        g.draggable(false);
        const stg = g.getStage();
        const body = g.findOne('.aoe-body');
        if (body) body.points([0, 0]);
        diamond.x(0); diamond.y(0);
        let pts = [0, 0];
        let totalLenPx = 0;
        let prevAngle = null;
        let _rhLastEmit = 0;
        const p0 = seedPos || stg.getPointerPosition() || { x: 0, y: 0 };
        const _t0 = g.getAbsoluteTransform().copy().invert();
        const _lp0 = _t0.point(p0);
        let lastCursorX = _lp0.x;
        let lastCursorY = _lp0.y;
        const onMove = function() {
            const p = stg.getPointerPosition();
            if (!p) return;
            const _t = g.getAbsoluteTransform().copy().invert();
            const _lp = _t.point(p);
            const cx = _lp.x;
            const cy = _lp.y;
            const movedX = cx - lastCursorX, movedY = cy - lastCursorY;
            if (Math.sqrt(movedX * movedX + movedY * movedY) < CURSOR_STEP_PX) return;
            lastCursorX = cx; lastCursorY = cy;
            const tipX = pts[pts.length - 2], tipY = pts[pts.length - 1];
            const dx = cx - tipX, dy = cy - tipY;
            const segPx = Math.sqrt(movedX * movedX + movedY * movedY);
            if (totalLenPx + segPx > maxLen) return;
            const segM = segPx / m2px(1);
            let desiredAngle = Math.atan2(dy, dx);
            if (prevAngle !== null) {
                const maxDelta = MAX_RAD_PER_M * segM;
                let delta = desiredAngle - prevAngle;
                while (delta > Math.PI) delta -= 2 * Math.PI;
                while (delta < -Math.PI) delta += 2 * Math.PI;
                desiredAngle = prevAngle + Math.max(-maxDelta, Math.min(maxDelta, delta));
            }
            const nx = tipX + Math.cos(desiredAngle) * segPx;
            const ny = tipY + Math.sin(desiredAngle) * segPx;
            pts.push(nx, ny);
            totalLenPx += segPx;
            prevAngle = desiredAngle;
            if (body) body.points([...pts]);
            diamond.x(nx); diamond.y(ny);
            const aoi = JSON.parse(g.getAttr('_aoeInfo') || '{}');
            aoi.pathPoints = [...pts];
            aoi.length = totalLenPx;
            g.setAttr('_aoeInfo', JSON.stringify(aoi));
            g.getLayer().batchDraw();
            const now = Date.now();
            if (now - _rhLastEmit >= 33) {
                _rhLastEmit = now;
                window.dispatchEvent(new CustomEvent('_el:changing', { detail: g }));
            }
        };
        const onUp = function() {
            g.draggable(true);
            stg.off('mousemove.rh touchmove.rh', onMove);
            stg.off('mouseup.rh touchend.rh', onUp);
            window.removeEventListener('mouseup', onUp);
            window.dispatchEvent(new CustomEvent('_el:changed', { detail: g }));
        };
        stg.on('mousemove.rh touchmove.rh', onMove);
        stg.on('mouseup.rh touchend.rh', onUp);
        window.addEventListener('mouseup', onUp);
    }
    diamond.on('mousedown touchstart', function(e) {
        e.cancelBubble = true;
        const _aoi = JSON.parse(g.getAttr('_aoeInfo') || '{}');
        if (_aoi.straight) rotateMode(); else startDraw();
    });
    diamond.on('click tap', e => e.cancelBubble = true);
    diamond.on('mouseenter', () => {
        const _aoi = JSON.parse(g.getAttr('_aoeInfo') || '{}');
        g.getStage().container().style.cursor = _aoi.straight ? 'grab' : 'crosshair';
    });
    diamond.on('mouseleave', () => { _syncCursor(true); });
    g.add(diamond);
    g.setAttr('_startDraw', startDraw);
    return diamond;
}

export async function placeAgent(pos, agent, _id = null) {
    const img = await loadImg(agent.displayIconSmall || agent.displayIcon);
    const g = new Konva.Group({ x:pos.x, y:pos.y });
    const _ar = 22 * S.agentIconScale;
    g.add(new Konva.Circle({ radius:_ar, fill:_iconBgFill(S.currentColor, S.iconBgOpacity), stroke:_iconBorderFill(S.currentColor, S.iconBgOpacity), strokeWidth:2 }));
    if (img) {
        const size = 38 * S.agentIconScale; const r = size/2;
        const iconGrp = new Konva.Group({ clipFunc: ctx => { ctx.arc(0, 0, r, 0, Math.PI * 2); } });
        iconGrp.add(new Konva.Image({ image:img, x:-r, y:-r, width:size, height:size, listening:false }));
        g.add(iconGrp);
    }
    g.setAttr('_type', 'agent');
    g.setAttr('_agentUuid', agent.uuid);
    g.setAttr('_stroke', S.currentColor);
    if (_id) g.setAttr('_id', _id);
    S.drawLayer.add(g);
    const { attachHandlers, _pushHistory } = window._drawingExports || {};
    if (attachHandlers) attachHandlers(g);
    if (_pushHistory) _pushHistory(g);
    _reorderAgentsToTop();
    window.selectAgent(agent.uuid);
    const { applyAgentFilter } = window._boardOpsExports || {};
    if (applyAgentFilter) applyAgentFilter();
    _tryAttachNearbyVision(g);
}

export async function placeAbilityFinal(pos, ability, aoeInfo, angle, _id = null) {
    const color = S.currentColor;
    const hasAoe = aoeInfo && aoeInfo.type !== 'none' && (aoeInfo.radius > 0 || aoeInfo.length > 0 || aoeInfo.type === 'arrow' || aoeInfo.type === 'blaze' || aoeInfo.type === 'high-tide');
    const g = hasAoe
        ? buildAoeGroup(pos, aoeInfo, angle, color, true)
        : new Konva.Group({ x: pos.x, y: pos.y });
    if (!hasAoe) g.add(new Konva.Circle({ radius: 18 * S.abilityIconScale, fill: _iconBgFill(color, S.iconBgOpacity), stroke: _iconBorderFill(color, S.iconBgOpacity), strokeWidth: 1.5 }));
    g.setAttr('_type', 'ability');
    g.setAttr('_slot', ability.slot);
    g.setAttr('_abilityName', ability.displayName || '');
    g.setAttr('_agentUuid', S.selectedAgent?.uuid);
    g.setAttr('_stroke', color);
    g.setAttr('_aoeType', hasAoe ? aoeInfo.type : 'none');
    g.setAttr('_aoeInfo', JSON.stringify(aoeInfo));
    if (_id) g.setAttr('_id', _id);
    S.drawLayer.add(g);
    const { attachHandlers, _pushHistory } = window._drawingExports || {};
    if (attachHandlers) attachHandlers(g);
    if (_pushHistory) _pushHistory(g);
    S.drawLayer.batchDraw();
    const img = await loadImg(ability.displayIcon);
    if (aoeInfo?.type === 'circle') {
        if (img) {
            const _cr = 13 * S.abilityIconScale;
            const iconGrp = new Konva.Group({ name: 'icon-grp', clipFunc: ctx => { ctx.arc(0, 0, _cr, 0, Math.PI * 2); } });
            if (_isLightColor(color)) iconGrp.globalCompositeOperation('difference');
            iconGrp.add(new Konva.Image({ image: img, x: -_cr, y: -_cr, width: _cr * 2, height: _cr * 2 }));
            iconGrp.rotation(-g.rotation());
            g.add(iconGrp);
            g.setAttr('_iconGrp', iconGrp);
        }
    } else {
        if (img) {
            const _ir = 16 * S.abilityIconScale;
            const iconGrp = new Konva.Group({ name: 'icon-grp', clipFunc: ctx => { ctx.arc(0, 0, _ir, 0, Math.PI * 2); } });
            if (_isLightColor(color)) iconGrp.globalCompositeOperation('difference');
            iconGrp.add(new Konva.Image({ image: img, x: -_ir, y: -_ir, width: _ir * 2, height: _ir * 2 }));
            iconGrp.rotation(-g.rotation());
            g.add(iconGrp);
        } else {
            g.add(new Konva.Text({ text: SLOT_KEY[ability.slot]?ability.slot[0]:'?', fontSize: 14, fill: color, fontStyle: 'bold', x: -6, y: -8 }));
        }
    }
    _reorderAgentsToTop();
    if (ability.displayName === 'Stim Beacon') setTimeout(_rebuildAllMovePaths, 0);
    if (ability.displayName === 'Annihilation') {
        g.on('dragmove', () => _refreshAnnihilationBounce(g));
        setTimeout(() => _refreshAnnihilationBounce(g), 0);
    }
    if (aoeInfo?.type === 'blaze' || aoeInfo?.type === 'high-tide') {
        const rh = g.findOne('.rot-handle');
        if (rh) rh.moveToTop();
        g.on('dblclick dbltap', function(e) {
            if (e.target === g.findOne('.rot-handle')) return;
            e.cancelBubble = true;
            const _aoi = JSON.parse(g.getAttr('_aoeInfo') || '{}');
            const _rh = g.findOne('.rot-handle');
            const _body = g.findOne('.aoe-body');
            if (_aoi.straight) {
                _aoi.straight = false;
                delete _aoi.pathPoints;
                _aoi.length = 0;
                if (_body) _body.points([0, 0]);
                if (_rh) { _rh.x(0); _rh.y(0); }
                g.setAttr('_aoeInfo', JSON.stringify(_aoi));
                g.getLayer()?.batchDraw();
                window.dispatchEvent(new CustomEvent('_el:changed', { detail: g }));
            } else {
                const _maxLen = _aoi.maxLen || 0;
                if (_body) _body.points([0, 0, _maxLen, 0]);
                if (_rh) { _rh.x(_maxLen); _rh.y(0); }
                delete _aoi.pathPoints;
                _aoi.length = _maxLen;
                _aoi.straight = true;
                g.setAttr('_aoeInfo', JSON.stringify(_aoi));
                g.getLayer()?.batchDraw();
                window.dispatchEvent(new CustomEvent('_el:changed', { detail: g }));
            }
        });
        g.getLayer()?.batchDraw();
    }
    if (aoeInfo?.type === 'cone') {
        setTimeout(() => _refreshConeFov(g), 0);
        g.on('dblclick dbltap', function(e) {
            if (e.target === g.findOne('.rot-handle')) return;
            e.cancelBubble = true;
            const fov = g.findOne('.cone-fov');
            if (!fov) return;
            const nowVisible = !fov.visible();
            fov.visible(nowVisible);
            if (nowVisible) _refreshConeFov(g);
            const _aoi = JSON.parse(g.getAttr('_aoeInfo') || '{}');
            _aoi.fovVisible = nowVisible;
            g.setAttr('_aoeInfo', JSON.stringify(_aoi));
            g.getLayer()?.batchDraw();
            window.dispatchEvent(new CustomEvent('_el:changed', { detail: g }));
        });
    }
    return g;
}

export function selectAgent(uuid) {
    S.selectedAgent = S.agents.find(a => a.uuid === uuid);
    S.selectedAbility = null;
    document.querySelectorAll('.agent-thumb').forEach(el => el.classList.toggle('selected', el.dataset.uuid === uuid));
    const { renderAbilityBar } = window._boardOpsExports || {};
    if (renderAbilityBar) renderAbilityBar();
}

export function selectAbility(slot) {
    if (!slot) {
        S.selectedAbility = null;
        document.querySelectorAll('.ability-slot').forEach(el => el.classList.remove('selected'));
        return;
    }
    const ability = S.selectedAgent?.abilities.find(a => a.slot === slot);
    S.selectedAbility = (S.selectedAbility?.slot === slot) ? null : ability;
    document.querySelectorAll('.ability-slot').forEach(el =>
        el.classList.toggle('selected', el.dataset.slot === S.selectedAbility?.slot)
    );
}
