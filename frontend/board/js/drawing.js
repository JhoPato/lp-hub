import { S } from './state.js';
import { DRAW_TOOLS, ERASER_RADIUS, TEXT_FONTS, MARKER_ICONS } from './constants.js';
import { getCanvasPos, loadImg } from './utils.js';
import { _buildMoveGroup, _updateMoveGroup, _rebuildAllMovePaths } from './movement.js';
import { _buildVisionCone, _updateVisionCone, _tryAttachVisionToAgent, _tryAttachNearbyVision, _addVisionHandle, _refreshVisionGroup, _placeMarkerIcon, _buildMapPaintGroup, _refreshMapPaint } from './vision.js';
import { _VISION_RADIUS } from './constants.js';
import { placeAgent, placeAbilityFinal, buildAoeGroup, _reorderAgentsToTop, _animateBubble, _iconBgFill, _iconBorderFill, _isLightColor, attachHandlers as _attachHandlers } from './agents.js';
import { _placeTextInput, _buildTextBox, _placeTextBoxEditor, _runsToHtml } from './text.js';
import { _renderToolOptions } from './tool-options.js';
import { applyAgentFilter, renderAbilityBar } from './board-ops.js';
import { getAbilityAoe } from './utils.js';
import { toast } from '/js/utils.js';

// ── History (undo/redo) ──────────────────────────────────────────────────────
let _draftEnabled = false;
let _draftTimer = null;
let _draftDirty = false; // true while changes are pending (timer queued but not yet flushed)
export function _enableDraft() { _draftEnabled = true; }
export function _clearDirty() { _draftDirty = false; }
export function _isDirty() { return _draftDirty; }

function _scheduleDraftSave() {
    if (!_draftEnabled || !S.currentStratId) return;
    _draftDirty = true;
    clearTimeout(_draftTimer);
    _draftTimer = setTimeout(() => {
        _draftDirty = false;
        const collect = window._boardOpsExports?.collectObjects;
        if (!collect || !S.currentStratId) return;
        try {
            localStorage.setItem('board_draft_' + S.currentStratId, JSON.stringify({
                ts: Date.now(),
                shapes: collect(),
                moments: S.boardMoments,
            }));
        } catch {}
    }, 1500);
}

function _glassRemove(node) { window._textExports?._removeGlassOverlay?.(node); }
function _glassAdd(node)    { if (node.getAttr('_hasBg')) window._textExports?._createGlassOverlay?.(node); }

function _cmdAdd(node, layer) {
    return {
        _cmdType: 'add',
        _node: node,
        undo() { _glassRemove(node); node.remove(); node.getLayer()?.batchDraw() || layer?.batchDraw(); },
        redo() { layer.add(node); _glassAdd(node); layer.batchDraw(); },
    };
}
function _cmdRemove(node, layer) {
    return {
        _cmdType: 'remove',
        _node: node,
        undo() { layer.add(node); _glassAdd(node); layer.batchDraw(); },
        redo() { _glassRemove(node); node.remove(); layer.batchDraw(); },
    };
}
export function _cmdRemoveBatch(pairs) {
    return {
        _cmdType: 'batch-remove',
        _pairs: pairs,
        undo() { pairs.forEach(({ node, layer }) => { layer.add(node); _glassAdd(node); layer.batchDraw(); }); },
        redo() { pairs.forEach(({ node }) => { _glassRemove(node); node.remove(); }); S.drawLayer?.batchDraw(); S.paintLayer?.batchDraw(); },
    };
}
function _cmdMove(node, fx, fy, tx, ty) {
    return {
        _cmdType: 'move',
        _node: node,
        undo() { node.x(fx); node.y(fy); node.getLayer()?.batchDraw(); },
        redo() { node.x(tx); node.y(ty); node.getLayer()?.batchDraw(); },
    };
}

export function _pushHistory(node) {
    const layer = node.getLayer ? node.getLayer() : null;
    _execCmd(_cmdAdd(node, layer || S.drawLayer));
}

export function _execCmd(cmd) {
    if (!S._restoring) {
        S._undoStack.push(cmd);
        S._redoStack = [];
    }
    cmd.redo();
    if (!S._restoring) _scheduleDraftSave();
}

export function _emitDelete(node) {
    window.dispatchEvent(new CustomEvent('_el:deleted', { detail: node }));
}

export function _emitRestore(node) {
    window.dispatchEvent(new CustomEvent('_el:restored', { detail: node }));
}

function _syncAfterUndoRedo(cmd, direction) {
    const t = cmd._cmdType;
    if (t === 'add') {
        // undo removes the node → tell server to delete it
        // redo re-adds the node → tell server to add it
        if (direction === 'undo') _emitDelete(cmd._node);
        else _emitRestore(cmd._node);
    } else if (t === 'remove') {
        // undo re-adds the node → tell server to add it
        // redo removes the node → tell server to delete it
        if (direction === 'undo') _emitRestore(cmd._node);
        else _emitDelete(cmd._node);
    } else if (t === 'batch-remove') {
        if (direction === 'undo') cmd._pairs.forEach(({ node }) => _emitRestore(node));
        else cmd._pairs.forEach(({ node }) => _emitDelete(node));
    } else if (t === 'move' && cmd._node) {
        window.dispatchEvent(new CustomEvent('_el:changed', { detail: cmd._node }));
    }
}

// ── Drawing helpers ──────────────────────────────────────────────────────────
function _computeOffsetPts(pts, offset) {
    const n = pts.length / 2;
    const out1 = [], out2 = [];
    for (let i = 0; i < n; i++) {
        const x = pts[i*2], y = pts[i*2+1];
        let nx = 0, ny = 0;
        if (i < n-1) {
            const dx = pts[(i+1)*2]-x, dy = pts[(i+1)*2+1]-y;
            const l = Math.sqrt(dx*dx+dy*dy) || 1;
            nx -= dy/l; ny += dx/l;
        }
        if (i > 0) {
            const dx = x-pts[(i-1)*2], dy = y-pts[(i-1)*2+1];
            const l = Math.sqrt(dx*dx+dy*dy) || 1;
            nx -= dy/l; ny += dx/l;
        }
        const nl = Math.sqrt(nx*nx+ny*ny) || 1;
        out1.push(x + (nx/nl)*offset, y + (ny/nl)*offset);
        out2.push(x - (nx/nl)*offset, y - (ny/nl)*offset);
    }
    return [out1, out2];
}

export function _hitStroke(sw) { return sw < 8 ? 10 : sw; }

function _makeDblGroup(pts, tension) {
    const gap = Math.max(5, S.currentWidth + 4);
    const [p1, p2] = _computeOffsetPts(pts, gap / 2);
    const cfg = { stroke: S.currentColor, strokeWidth: S.currentWidth, hitStrokeWidth: _hitStroke(S.currentWidth), lineCap: 'round', lineJoin: 'round', tension: tension || 0 };
    const ln1 = new Konva.Line({ ...cfg, points: p1 });
    const ln2 = new Konva.Line({ ...cfg, points: p2 });
    const grp = new Konva.Group();
    grp.setAttr('_dbl', true);
    grp.setAttr('_dblGap', gap);
    grp.add(ln1, ln2);
    return grp;
}

export function _applyLineStyle(shape, style, color) {
    const patterns = { dashed:[14,9], dotted:[2,10], dashdot:[14,6,2,6] };
    shape.dash(patterns[style] || []);
    shape.dashEnabled(!!(patterns[style]));
    if (style === 'neon') {
        shape.dash([]); shape.dashEnabled(false);
        shape.shadowColor(color); shape.shadowBlur(18);
        shape.shadowOpacity(0.85); shape.shadowEnabled(true);
    } else {
        shape.shadowEnabled(false);
    }
}

function _reorderAgentsToTopLocal() {
    S.drawLayer.getChildren(n => n.getAttr('_type') === 'agent').forEach(n => n.moveToTop());
    S.drawLayer.batchDraw();
}

function _distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function _nodeHitsEraser(node, pos, r) {
    const box = node.getClientRect({ relativeTo: S.drawLayer });
    if (pos.x < box.x - r || pos.x > box.x + box.width + r ||
        pos.y < box.y - r || pos.y > box.y + box.height + r) return false;
    const cls = node.getClassName();
    if (cls === 'Line' || cls === 'Arrow') {
        const pts = node.points();
        const ox = node.x(), oy = node.y();
        for (let i = 0; i < pts.length - 2; i += 2) {
            if (_distToSegment(pos.x, pos.y, ox + pts[i], oy + pts[i+1], ox + pts[i+2], oy + pts[i+3]) <= r) return true;
        }
        return false;
    }
    const nx = Math.max(box.x, Math.min(pos.x, box.x + box.width));
    const ny = Math.max(box.y, Math.min(pos.y, box.y + box.height));
    return (pos.x - nx) ** 2 + (pos.y - ny) ** 2 <= r * r;
}

function _brushErase(pos) {
    const toRemove = [];
    S.drawLayer.getChildren().forEach(node => {
        const t = node.getAttr('_type');
        if (t === 'agent' || t === 'ability') return;
        if (_nodeHitsEraser(node, pos, ERASER_RADIUS)) toRemove.push(node);
    });
    if (!toRemove.length) return;
    toRemove.forEach(n => {
        _glassRemove(n);
        const layer = n.getParent();
        n.remove();
        _emitDelete(n);
        if (S._eraseBuffer !== null) S._eraseBuffer.push({ node:n, layer });
    });
    S.drawLayer.batchDraw();
}

export function _buildPencilArrowGroup(pts, color, width, opacity, style) {
    const g = new Konva.Group();
    g.setAttr('_type', 'pencil-arrow');
    const line = new Konva.Line({
        name: '_stroke', points: pts, stroke: color, strokeWidth: width,
        hitStrokeWidth: _hitStroke(width), tension: 0.4, lineCap: 'round', lineJoin: 'round',
    });
    _applyLineStyle(line, style, color);
    g.add(line);
    const n = pts.length;
    if (n >= 4) {
        const lookback = Math.min(n - 2, 10);
        const si = n - 2 - lookback;
        const angle = Math.atan2(pts[n - 1] - pts[si + 1], pts[n - 2] - pts[si]);
        const pl = Math.max(12, width * 3.5), spread = Math.PI / 5;
        const ex = pts[n - 2], ey = pts[n - 1];
        g.add(new Konva.Line({
            name: '_arrowhead',
            points: [
                ex - pl * Math.cos(angle - spread), ey - pl * Math.sin(angle - spread),
                ex, ey,
                ex - pl * Math.cos(angle + spread), ey - pl * Math.sin(angle + spread),
            ],
            stroke: color, strokeWidth: width, lineCap: 'round', lineJoin: 'round',
        }));
    }
    g.opacity(opacity);
    return g;
}

function _isOverTrash() {
    const trash = document.getElementById('trashZone');
    const tr = trash.getBoundingClientRect();
    const wr = document.getElementById('konva-wrap').getBoundingClientRect();
    const p = S.stage.getPointerPosition();
    if (!p) return false;
    const cx = wr.left + p.x, cy = wr.top + p.y;
    const tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;
    return Math.sqrt((cx - tx) ** 2 + (cy - ty) ** 2) < tr.width / 2;
}

function _updateTrashHighlight() {
    document.getElementById('trashZone').classList.toggle('drag-over', _isOverTrash());
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

function _toggleAoeCircle(g) {
    if (g.getAttr('_abilityName') === 'Annihilation') { _toggleAnnihilationBounce(g); return; }
    const c = g.findOne('.aoe-circle');
    if (!c) return;
    const hidden = !g.getAttr('_aoeHidden');
    g.setAttr('_aoeHidden', hidden);
    c.visible(!hidden);
    S._aoeHiddenMap[(g.getAttr('_agentUuid') || '') + '_' + (g.getAttr('_slot') || '')] = hidden;
    g.getLayer()?.batchDraw();
    window.dispatchEvent(new CustomEvent('_el:changed', { detail: g }));
}

// ── Text selection & inline-edit helpers ─────────────────────────────────────
let _selTr = null;

const _RH_NAMES_TB = ['tb-rh-nw','tb-rh-n','tb-rh-ne','tb-rh-e','tb-rh-se','tb-rh-s','tb-rh-sw','tb-rh-w'];
function _setTextBoxHandlesVisible(shape, visible) {
    if (!shape) return;
    const t = shape.getAttr('_type');
    if (t !== 'textbox') return;
    _RH_NAMES_TB.forEach(n => {
        const rh = shape.findOne('.' + n);
        if (rh) rh.opacity(visible ? 0.8 : 0);
    });
}

function _setSelection(shape) {
    // Hide handles on previously selected shape
    _setTextBoxHandlesVisible(S._selectedShape, false);
    if (_selTr) { _selTr.destroy(); _selTr = null; }
    S._selectedShape = null;
    if (!shape) { S.drawLayer?.batchDraw(); return; }
    S._selectedShape = shape;
    // Show handles on newly selected textbox
    _setTextBoxHandlesVisible(shape, true);
    _selTr = new Konva.Transformer({
        nodes: [shape],
        rotateEnabled: false,
        enabledAnchors: [],
        borderStroke: '#4f94f5',
        borderStrokeWidth: 2,
        borderDash: [6, 3],
        padding: 5,
        name: '_selection-tr',
        listening: false,
    });
    S.drawLayer.add(_selTr);
    S.drawLayer.batchDraw();
}

// Removes shape from canvas/history and opens its editor (text tool click OR dblclick in select mode)
function _editTextGroup(group, stagePtr) {
    _setSelection(null);
    const type = group.getAttr('_type');
    const pos  = { x: group.x(), y: group.y() };
    S._undoStack = S._undoStack.filter(c => c._node !== group);
    S._redoStack = S._redoStack.filter(c => c._node !== group);
    window._textExports?._removeGlassOverlay?.(group);
    group.remove();
    S.drawLayer.batchDraw();
    if (type === 'textbox') {
        S.currentTextFont    = group.getAttr('_textFont')    || S.currentTextFont;
        S.currentTextSize    = group.getAttr('_textSize')    || S.currentTextSize;
        S.currentTextOpacity = group.getAttr('_textOpacity') ?? S.currentTextOpacity;
        S.currentColor       = group.getAttr('_textColor')   || S.currentColor;
        S.currentTextBold    = group.getAttr('_textBold')    || false;
        S.currentTextItalic  = group.getAttr('_textItalic')  || false;
        S.currentTextAlign   = group.getAttr('_textAlign')   || 'left';
        S.currentTextShadow  = group.getAttr('_textShadow')  || false;
        S.currentTextRadius  = group.getAttr('_radius')       ?? S.currentTextRadius;
        const runsJson    = group.getAttr('_runs');
        const editContent = runsJson ? JSON.parse(runsJson) : (group.getAttr('_text') || '');
        const boxWidth    = group.getAttr('_boxWidth')  || 240;
        const bgColor     = group.getAttr('_hasBg')     ? group.getAttr('_bgColor')     : null;
        const borderColor = group.getAttr('_hasBorder') ? group.getAttr('_borderColor') : null;
        const strokeColor = group.getAttr('_hasStroke') ? group.getAttr('_strokeColor') : null;
        _placeTextBoxEditor(pos, boxWidth, bgColor, editContent, borderColor, strokeColor, stagePtr, group);
    } else if (type === 'text') {
        S.currentTextFont    = group.getAttr('_textFont')    || S.currentTextFont;
        S.currentTextSize    = group.getAttr('_textSize')    || S.currentTextSize;
        S.currentTextOpacity = group.getAttr('_textOpacity') ?? S.currentTextOpacity;
        S.currentColor       = group.getAttr('_textColor')   || S.currentColor;
        const savedRuns = group.getAttr('_runs');
        const runs = savedRuns ? JSON.parse(savedRuns) : [];
        _placeTextInput(pos, _runsToHtml(runs), stagePtr, group);
    }
}

export function _refreshSelectionTr() {
    if (_selTr) { _selTr.forceUpdate(); S.drawLayer?.batchDraw(); }
}

export function _syncCursor(overShape) {
    if (S.eraseMode) { S.stage.container().style.cursor = 'none'; return; }
    if (overShape) { S.stage.container().style.cursor = 'grab'; return; }
    S.stage.container().style.cursor = DRAW_TOOLS.has(S.currentTool) ? 'crosshair' : 'default';
}

export function attachHandlers(shape) {
    const interactive = !DRAW_TOOLS.has(S.currentTool) || S.currentTool === 'multi';
    shape.draggable(interactive);
    shape.listening(interactive);
    shape.on('click tap', (e) => {
        if (S.eraseMode) { e.cancelBubble = true; return; }
        // Single click (no drag) in non-draw mode → show selection outline
        if (!S._isDragMove && !DRAW_TOOLS.has(S.currentTool)) {
            _setSelection(shape);
        }
    });
    shape.on('dblclick dbltap', () => {
        if (shape.getAttr('_type') === 'ability') { _toggleAoeCircle(shape); return; }
        if (shape.getAttr('_type') === 'textbox' || shape.getAttr('_type') === 'text') {
            // Switch to text tool so the editor's commit adds back to the right tool state
            setTool('text');
            _editTextGroup(shape, S.stage.getPointerPosition());
            return;
        }
    });
    shape.on('mouseenter', () => { _syncCursor(true); });
    shape.on('mouseleave', () => { _syncCursor(false); });
    shape.on('dragstart', () => {
        S.stage.container().style.cursor = 'grabbing';
        shape.setAttr('_dragFromX', shape.x()); shape.setAttr('_dragFromY', shape.y());
        const ig = shape.getAttr('_iconGrp');
        const dot = shape.getAttr('_centerDot');
        if (ig) ig.opacity(0);
        if (dot) { dot.setAttr('_savedRadius', dot.radius()); dot.radius(5); dot.strokeWidth(0); }
        if (!ig && !dot) shape.opacity(0.45);
        S.drawLayer.batchDraw();
    });
    shape.on('dragmove',  () => {
        _updateTrashHighlight();
        if (shape.getAttr('_aoeType') === 'cone') _refreshConeFov(shape);
        if (shape._glassDom) window._textExports?._syncGlassOverlay?.(shape);
    });
    shape.on('dragend',   () => {
        _syncCursor(false);
        document.getElementById('trashZone').classList.remove('drag-over');
        if (_isOverTrash()) {
            const _dl = shape.getParent();
            _glassRemove(shape);
            shape.remove();
            _emitDelete(shape);
            _execCmd(_cmdRemove(shape, _dl));
            applyAgentFilter();
            if (shape.getAttr('_abilityName') === 'Stim Beacon') setTimeout(_rebuildAllMovePaths, 0);
        } else {
            const ig = shape.getAttr('_iconGrp');
            const dot = shape.getAttr('_centerDot');
            if (ig) ig.opacity(1);
            if (dot) { dot.radius(dot.getAttr('_savedRadius') || 15); dot.strokeWidth(2); }
            if (!ig && !dot) shape.opacity(1);
            const _fx = shape.getAttr('_dragFromX'), _fy = shape.getAttr('_dragFromY');
            if (_fx != null && (_fx !== shape.x() || _fy !== shape.y())) _execCmd(_cmdMove(shape, _fx, _fy, shape.x(), shape.y()));
            if (shape.getAttr('_type') === 'vision') { _refreshVisionGroup(shape); _tryAttachVisionToAgent(shape); }
            if (shape.getAttr('_type') === 'agent') { _tryAttachNearbyVision(shape); }
            if (shape.getAttr('_abilityName') === 'Stim Beacon') setTimeout(_rebuildAllMovePaths, 0);
            if (shape.getAttr('_type') === 'ability') {
                const _raw = shape.getAttr('_aoeInfo');
                if (_raw) {
                    const _aoi = JSON.parse(_raw);
                    const _body = shape.findOne('.aoe-body');
                    if (_body && _aoi.length > 0) {
                        if (_aoi.type === 'line') _body.points([_aoi.castOffset||0, 0, (_aoi.castOffset||0) + _aoi.length, 0]);
                        else if (_aoi.type === 'cylinder' || _aoi.type === 'rect') _body.width(_aoi.length);
                        else if ((_aoi.type === 'blaze' || _aoi.type === 'high-tide') && _aoi.straight) _body.points([0, 0, _aoi.length, 0]);
                    }
                    const _rh = shape.findOne('.rot-handle');
                    if (_rh && (_aoi.type === 'cylinder' || _aoi.type === 'rect' || _aoi.type === 'line') && _aoi.length > 0) {
                        _rh.x((_aoi.castOffset||0) + _aoi.length);
                    } else if (_rh && (_aoi.type === 'blaze' || _aoi.type === 'high-tide') && _aoi.straight && _aoi.length > 0) {
                        _rh.x(_aoi.length); _rh.y(0);
                    }
                }
            }
            if (shape.getAttr('_aoeType') === 'cone') _refreshConeFov(shape);
        }
        S.drawLayer.batchDraw();
    });
    // Glass overlay for textboxes with background
    if (shape.getAttr('_type') === 'textbox') {
        window._textExports?._createGlassOverlay?.(shape);
        shape.on('add.glass',     () => window._textExports?._syncGlassOverlay?.(shape));
        shape.on('remove.glass',  () => { if (shape._glassDom) shape._glassDom.style.display = 'none'; });
        shape.on('destroy.glass', () => window._textExports?._removeGlassOverlay?.(shape));
    }
}

export function showTextInput(pos) {
    const wrap = document.getElementById('textInput');
    const inp  = document.getElementById('textInputEl');
    const rect = document.getElementById('konva-wrap').getBoundingClientRect();
    wrap.style.display = 'block';
    wrap.style.left = (rect.left + pos.x) + 'px';
    wrap.style.top  = (rect.top  + pos.y - 16) + 'px';
    inp.value = '';
    inp.style.color = S.currentColor;
    inp.focus();
    const commit = () => {
        wrap.style.display = 'none';
        const txt = inp.value.trim();
        if (!txt) return;
        const t = new Konva.Text({ x:pos.x, y:pos.y, text:txt, fontSize:16, fill:S.currentColor, fontFamily:'monospace', fontStyle:'bold' });
        S.drawLayer.add(t);
        attachHandlers(t);
        _pushHistory(t);
        S.drawLayer.batchDraw();
    };
    inp.onblur = commit;
    inp.onkeydown = e => { if (e.key==='Enter') inp.blur(); if (e.key==='Escape') { wrap.style.display='none'; } };
}

export function onDown(e) {
    if (e.evt && e.evt.button === 1) return;
    S._mouseDownTime = Date.now();
    const pos = getCanvasPos();
    if (S.eraseMode) {
        S._isEraserDown = true;
        S._eraseBuffer = [];
        if (S.eraserShape._circle) { S.eraserShape._circle.fill('rgba(224,80,112,0.85)'); S.cursorLayer.batchDraw(); }
        _brushErase(pos);
        return;
    }
    const _stagePos = S.stage.getPointerPosition();
    const _hitNode = _stagePos ? S.stage.getIntersection(_stagePos) : null;
    const hitDrawLayer = (_hitNode && _hitNode.getLayer?.() === S.drawLayer)
        || (e && e.target && e.target !== S.stage && e.target.getLayer && e.target.getLayer() === S.drawLayer);
    if (hitDrawLayer) return;
    if (S.currentTool === 'agent' && S.selectedAbility && S.placeMode === 'click') {
        S.isAbilityDrag = true;
        S.startPos = pos;
        S.lastMousePos = pos;
        const _aoe = getAbilityAoe(S.selectedAbility);
        S.abilityDragPreview = buildAoeGroup(pos, _aoe, 0, S.currentColor, false);
        S.abilityDragPreview.opacity(0.45);
        S.drawLayer.add(S.abilityDragPreview);
        S.drawLayer.batchDraw();
        return;
    }
    if (!DRAW_TOOLS.has(S.currentTool)) return;
    S.isDrawing = true;
    S.startPos = pos;

    if (S.currentTool === 'text') { S.isDrawing = false; return; }
    else if (S.currentTool === 'multi') {
        if (S.currentMultiSubTool === 'vision') {
            S.currentShape = _buildVisionCone(pos.x, pos.y, 5, 0, S.visionConeAngle);
        } else if (S.currentMultiSubTool === 'icon') {
            const g = _placeMarkerIcon(pos, S.currentIconKey);
            if (g) { S.drawLayer.add(g); attachHandlers(g); _pushHistory(g); S.drawLayer.batchDraw(); }
            S.isDrawing = false;
            return;
        }
    } else if (S.currentTool === 'move') {
        S.movePts = [pos.x, pos.y];
        S.currentShape = _buildMoveGroup(S.movePts, S.currentMoveSpeed, S.currentColor, S.currentMoveDash);
    } else if (S.currentTool === 'pencil') {
        S.pencilPts = [pos.x, pos.y];
        if (S.currentLineStyle === 'double') {
            S.currentShape = _makeDblGroup(S.pencilPts, 0.4);
        } else if (S.currentArrowTip) {
            S.currentShape = new Konva.Line({ points:S.pencilPts, stroke:S.currentColor, strokeWidth:S.currentWidth, hitStrokeWidth:_hitStroke(S.currentWidth), tension:0.4, lineCap:'round', lineJoin:'round' });
            S.currentShape.setAttr('_arrowMode', true);
        } else {
            S.currentShape = new Konva.Line({ points:S.pencilPts, stroke:S.currentColor, strokeWidth:S.currentWidth, hitStrokeWidth:_hitStroke(S.currentWidth), tension:0.4, lineCap:'round', lineJoin:'round' });
        }
    } else if (S.currentTool === 'line') {
        if (S.currentLineStyle === 'double') {
            S.currentShape = _makeDblGroup([pos.x,pos.y,pos.x,pos.y], 0);
        } else if (S.currentArrowTip) {
            const pl = Math.max(10, S.currentWidth * 3), pw = Math.max(7, S.currentWidth * 2);
            S.currentShape = new Konva.Arrow({ points:[pos.x,pos.y,pos.x,pos.y], stroke:S.currentColor, strokeWidth:S.currentWidth, hitStrokeWidth:_hitStroke(S.currentWidth), fill:S.currentColor, lineCap:'round', pointerLength:pl, pointerWidth:pw });
        } else {
            S.currentShape = new Konva.Line({ points:[pos.x,pos.y,pos.x,pos.y], stroke:S.currentColor, strokeWidth:S.currentWidth, hitStrokeWidth:_hitStroke(S.currentWidth), lineCap:'round' });
        }
    } else if (S.currentTool === 'circle') {
        const fill = S.currentFill ? S.currentColor + '22' : 'transparent';
        S.currentShape = new Konva.Circle({ x:pos.x, y:pos.y, radius:1, stroke:S.currentColor, strokeWidth:S.currentWidth, fill });
    } else if (S.currentTool === 'rect') {
        const fill = S.currentFill ? S.currentColor + '33' : 'transparent';
        S.currentShape = new Konva.Rect({ x:pos.x, y:pos.y, width:1, height:1, stroke:S.currentColor, strokeWidth:S.currentWidth, fill });
    }
    if (S.currentShape) {
        if (['pencil','line','circle','rect'].includes(S.currentTool)) {
            if (!(S.currentShape instanceof Konva.Group)) _applyLineStyle(S.currentShape, S.currentLineStyle, S.currentColor);
        }
        S.currentShape.opacity(S.currentOpacity);
        S.drawLayer.add(S.currentShape); S.drawLayer.batchDraw();
    }
}

export function onMove(e) {
    const pos = getCanvasPos();
    if (pos) S.lastMousePos = pos;
    if (S.eraseMode) {
        if (pos) { S.eraserShape.x(pos.x); S.eraserShape.y(pos.y); S.cursorLayer.batchDraw(); }
        if (S._isEraserDown) _brushErase(pos);
        return;
    }
    if (S.isAbilityDrag && S.startPos) {
        const _aoe = getAbilityAoe(S.selectedAbility);
        if (_aoe.type === 'circle' || _aoe.type === 'none') {
            if (S.abilityDragPreview) { S.abilityDragPreview.x(pos.x); S.abilityDragPreview.y(pos.y); S.drawLayer.batchDraw(); }
            return;
        }
        const dx = pos.x - S.startPos.x, dy = pos.y - S.startPos.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 8) return;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (S.abilityDragPreview) S.abilityDragPreview.destroy();
        S.abilityDragPreview = buildAoeGroup(S.startPos, _aoe, angle, S.currentColor, false);
        S.abilityDragPreview.opacity(0.45);
        S.drawLayer.add(S.abilityDragPreview);
        S.drawLayer.batchDraw();
        return;
    }
    if (S.isDrawing && S.currentShape) {
        if (S.currentTool === 'multi' && S.currentMultiSubTool === 'vision') {
            const dx = pos.x - S.startPos.x, dy = pos.y - S.startPos.y;
            const direction = Math.atan2(dy, dx);
            _updateVisionCone(S.currentShape, S.startPos.x, S.startPos.y, _VISION_RADIUS, direction, S.visionConeAngle);
            S.drawLayer.batchDraw();
            return;
        } else if (S.currentTool === 'move') {
            S.movePts = S.movePts.concat([pos.x, pos.y]);
            _updateMoveGroup(S.currentShape, S.movePts);
        } else if (S.currentTool === 'pencil') {
            S.pencilPts = S.pencilPts.concat([pos.x, pos.y]);
            if (S.currentShape.getAttr?.('_dbl')) {
                const [p1, p2] = _computeOffsetPts(S.pencilPts, S.currentShape.getAttr('_dblGap') / 2);
                S.currentShape.getChildren()[0].points(p1);
                S.currentShape.getChildren()[1].points(p2);
            } else {
                S.currentShape.points(S.pencilPts);
                if (S.currentArrowTip && S.currentShape.getAttr('_arrowMode') && S.pencilPts.length >= 4) {
                    const n = S.pencilPts.length;
                    const lb = Math.min(n - 2, 10), si = n - 2 - lb;
                    const ang = Math.atan2(S.pencilPts[n-1] - S.pencilPts[si+1], S.pencilPts[n-2] - S.pencilPts[si]);
                    const pl = Math.max(12, S.currentWidth * 3.5), sp = Math.PI / 5;
                    const ex = S.pencilPts[n-2], ey = S.pencilPts[n-1];
                    let ph = S.currentShape.getAttr('_previewHead');
                    if (!ph) {
                        ph = new Konva.Line({ stroke: S.currentColor, strokeWidth: S.currentWidth, lineCap:'round', lineJoin:'round', opacity: S.currentOpacity });
                        S.drawLayer.add(ph); S.currentShape.setAttr('_previewHead', ph);
                    }
                    ph.points([ex - pl*Math.cos(ang-sp), ey - pl*Math.sin(ang-sp), ex, ey, ex - pl*Math.cos(ang+sp), ey - pl*Math.sin(ang+sp)]);
                }
            }
        } else if (S.currentTool === 'line') {
            if (S.currentShape.getAttr?.('_dbl')) {
                const pts = [S.startPos.x, S.startPos.y, pos.x, pos.y];
                const [p1, p2] = _computeOffsetPts(pts, S.currentShape.getAttr('_dblGap') / 2);
                S.currentShape.getChildren()[0].points(p1);
                S.currentShape.getChildren()[1].points(p2);
            } else {
                S.currentShape.points([S.startPos.x, S.startPos.y, pos.x, pos.y]);
            }
        } else if (S.currentTool === 'circle') {
            S.currentShape.radius(Math.sqrt((pos.x-S.startPos.x)**2 + (pos.y-S.startPos.y)**2));
        } else if (S.currentTool === 'rect') {
            S.currentShape.width(pos.x - S.startPos.x);
            S.currentShape.height(pos.y - S.startPos.y);
        }
        S.drawLayer.batchDraw();
        return;
    }
    let node = e?.target;
    while (node && node !== S.stage) {
        const t = node.getAttr?.('_type');
        if (t === 'agent' || t === 'ability') { _syncCursor(true); return; }
        node = node.getParent?.();
    }
    _syncCursor(false);
}

export function onUp() {
    if (S.eraseMode) {
        S._isEraserDown = false;
        if (S.eraserShape._circle) { S.eraserShape._circle.fill('rgba(224,80,112,0.18)'); S.cursorLayer.batchDraw(); }
        if (S._eraseBuffer?.length) _execCmd(_cmdRemoveBatch([...S._eraseBuffer]));
        S._eraseBuffer = null;
        return;
    }
    if (S.isAbilityDrag) {
        S.isAbilityDrag = false;
        if (S.abilityDragPreview) { S.abilityDragPreview.destroy(); S.abilityDragPreview = null; }
        const pos = S.lastMousePos;
        const dx = pos.x - S.startPos.x, dy = pos.y - S.startPos.y;
        const dragDist = Math.sqrt(dx*dx + dy*dy);
        const autoAoe = getAbilityAoe(S.selectedAbility);
        const angle   = dragDist > 8 ? Math.atan2(dy, dx) * 180 / Math.PI : 0;
        placeAbilityFinal(S.startPos, S.selectedAbility, autoAoe, angle);
        return;
    }
    if (!S.isDrawing || !S.currentShape) return;
    S.isDrawing = false;
    const _cls = S.currentShape.getClassName();
    if (S.currentBelowMap && (_cls === 'Circle' || _cls === 'Rect')) {
        const _absPos = S.currentShape.getAbsolutePosition();
        const _sc = S.stage.scaleX();
        const bx = _absPos.x, by = _absPos.y;
        const bw = _cls === 'Rect' ? S.currentShape.width() * _sc : 0;
        const bh = _cls === 'Rect' ? S.currentShape.height() * _sc : 0;
        const br = _cls === 'Circle' ? S.currentShape.radius() * _sc : 0;
        S.currentShape.remove();
        S.currentShape.destroy();
        S.currentShape = null;
        S.drawLayer.batchDraw();
        const grp = _buildMapPaintGroup(_cls.toLowerCase(), bx, by, bw, bh, br, S.currentColor, S.currentOpacity * 0.6);
        S.paintLayer.add(grp);
        _pushHistory(grp);
        S.paintLayer.batchDraw();
        return;
    }
    if (S.currentTool === 'pencil' && S.currentArrowTip && S.currentShape.getAttr?.('_arrowMode')) {
        const pts = S.currentShape.points();
        const ph = S.currentShape.getAttr('_previewHead');
        if (ph) ph.destroy();
        S.currentShape.remove();
        const g = _buildPencilArrowGroup(pts, S.currentColor, S.currentWidth, S.currentOpacity, S.currentLineStyle);
        S.drawLayer.add(g); attachHandlers(g); _pushHistory(g);
        S.currentShape = null;
        S.drawLayer.batchDraw();
        return;
    }
    attachHandlers(S.currentShape);
    if (S.currentShape.getAttr?.('_type') === 'vision') { _addVisionHandle(S.currentShape); _tryAttachVisionToAgent(S.currentShape); }
    _pushHistory(S.currentShape);
    S.currentShape = null;
    S.drawLayer.batchDraw();
}

export async function onClick(e) {
    if (e.evt && e.evt.button === 1) return;
    if (S.currentTool === 'select' || S.currentTool === 'move') {
        if (e.target === S.stage) { _setSelection(null); S.drawLayer.batchDraw(); }
        return;
    }
    if (S.currentTool === 'text') {
        // If a text editor is already open (e.g. user clicked to blur-commit),
        // block opening a new editor on the same click — the blur-commit setTimeout
        // hasn't fired yet, so S._activeTextInput is still set.
        if (S._activeTextInput) return;
        const pos = getCanvasPos();
        if (!pos) return;
        const ptr = S.stage.getPointerPosition();
        // Geometric bbox hit test — shapes are non-listening in text mode, so
        // getIntersection() won't find them. Use world coords from getCanvasPos().
        let hitGroup = null;
        const nodes = [...S.drawLayer.getChildren()];
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            const t = n.getAttr('_type');
            if (t !== 'textbox' && t !== 'text') continue;
            const bb = n.getClientRect({ relativeTo: S.drawLayer });
            if (pos.x >= bb.x && pos.x <= bb.x + bb.width &&
                pos.y >= bb.y && pos.y <= bb.y + bb.height) {
                hitGroup = n; break;
            }
        }
        if (hitGroup) { _editTextGroup(hitGroup, ptr); return; }
        _placeTextBoxEditor(pos, 240, null);
        return;
    }
    if (DRAW_TOOLS.has(S.currentTool)) return;

    const pos = getCanvasPos();

    if (S.currentTool === 'agent') {
        if (S.placeMode === 'drag') return;
        if (e.target.getAttr('name') === 'rot-handle') return;
        if (!S.selectedAgent) { toast('Select an agent', 'warn'); return; }
        if (S.selectedAbility) return;
        if (S._isDragMove) return;
        S._lastPlaceTime = Date.now();
        await placeAgent(pos, S.selectedAgent);
    }
}

export function setTool(t) {
    if (S._activeTextInput) return;
    _setSelection(null);
    S.eraseMode = false;
    document.getElementById('tool-erase').classList.remove('erase-active');
    S.eraserShape.visible(false); S.cursorLayer.batchDraw();
    S.stage.container().style.cursor = '';
    S.currentTool = t;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('tool-' + t);
    if (btn) btn.classList.add('active');
    _setShapesInteractive(!DRAW_TOOLS.has(t) || t === 'multi');
    S.stage.container().style.cursor = t === 'select' ? 'default' : 'crosshair';
    if (t === 'agent') { renderAbilityBar(); } else { document.getElementById('agentAbilityFloat').classList.remove('visible'); }
    _renderToolOptions(t);
}

export function toggleErase() {
    S.eraseMode = !S.eraseMode;
    const btn = document.getElementById('tool-erase');
    if (S.eraseMode) {
        S.currentTool = 'erase';
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('erase-active');
        S.drawLayer.batchDraw();
        S.stage.container().style.cursor = 'none';
        S.eraserShape.visible(true); S.cursorLayer.batchDraw();
        document.getElementById('agentAbilityFloat').classList.remove('visible');
    } else {
        btn.classList.remove('erase-active');
        S.eraserShape.visible(false); S.cursorLayer.batchDraw();
        setTool('select');
    }
}

export function setColor(c) {
    S.currentColor = c;
    document.querySelectorAll('.color-dot').forEach(d => d.classList.toggle('active', d.dataset.color === c));
    const { _updatePanelLinePreview, _syncPanelColors } = window._toolOptionsExports || {};
    if (_updatePanelLinePreview) _updatePanelLinePreview();
    if (_syncPanelColors) _syncPanelColors();
    // refresh active text
    const { _refreshActiveText } = window._textExports || {};
    if (_refreshActiveText) _refreshActiveText();
}

export function undo() {
    const cmd = S._undoStack.pop();
    if (!cmd) return;
    S._redoStack.push(cmd);
    cmd.undo();
    _syncAfterUndoRedo(cmd, 'undo');
    _scheduleDraftSave();
}

export function redo() {
    const cmd = S._redoStack.pop();
    if (!cmd) return;
    S._undoStack.push(cmd);
    cmd.redo();
    _syncAfterUndoRedo(cmd, 'redo');
    _scheduleDraftSave();
}

export function clearBoard() {
    document.getElementById('clearBoardModal').style.display = 'flex';
}

export function deleteUnderMouse() {
    if (!S.lastMousePos) return;
    const pos = S.lastMousePos;
    const nodes = S.drawLayer.getChildren().slice();
    for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const box = node.getClientRect({ relativeTo: S.drawLayer });
        if (pos.x >= box.x && pos.x <= box.x + box.width &&
            pos.y >= box.y && pos.y <= box.y + box.height) {
            node.remove();
            _emitDelete(node);
            _execCmd(_cmdRemove(node, S.drawLayer));
            S.drawLayer.batchDraw();
            return;
        }
    }
    const paintNodes = S.paintLayer.getChildren().slice();
    for (let i = paintNodes.length - 1; i >= 0; i--) {
        const node = paintNodes[i];
        const sx = node.getAttr('_shapeX'), sy = node.getAttr('_shapeY');
        const st = node.getAttr('_shapeType');
        let hit = false;
        if (st === 'rect') {
            const sw = node.getAttr('_shapeW') || 0, sh = node.getAttr('_shapeH') || 0;
            const x1 = Math.min(sx, sx + sw), y1 = Math.min(sy, sy + sh);
            const x2 = Math.max(sx, sx + sw), y2 = Math.max(sy, sy + sh);
            hit = pos.x >= x1 && pos.x <= x2 && pos.y >= y1 && pos.y <= y2;
        } else {
            const r = node.getAttr('_shapeR') || 0;
            hit = (pos.x - sx) ** 2 + (pos.y - sy) ** 2 <= r * r;
        }
        if (hit) {
            node.remove();
            _emitDelete(node);
            _execCmd(_cmdRemove(node, S.paintLayer));
            S.paintLayer.batchDraw();
            return;
        }
    }
}

export function _setShapesInteractive(interactive) {
    S.drawLayer.getChildren().forEach(node => {
        if (node.getClassName() === 'Transformer') return;
        node.listening(interactive);
        node.draggable(interactive);
    });
    S.drawLayer.batchDraw();
}

export function setAgentFilter(f) {
    S.agentFilter = f;
    document.getElementById('agentFilterAll').classList.toggle('active', f === 'all');
    document.getElementById('agentFilterMap').classList.toggle('active', f === 'map');
    document.getElementById('agentFilterIndicator').classList.toggle('right', f === 'map');
    applyAgentFilter();
}

export function _detectLineStyle(node) {
    if (node.shadowEnabled?.()) return 'neon';
    if (!node.dashEnabled?.()) return 'solid';
    const d = node.dash?.() || [];
    if (d.length === 2 && d[0] === 14 && d[1] === 9)  return 'dashed';
    if (d.length === 2 && d[0] === 2  && d[1] === 10) return 'dotted';
    if (d.length === 4 && d[0] === 14) return 'dashdot';
    return 'solid';
}
