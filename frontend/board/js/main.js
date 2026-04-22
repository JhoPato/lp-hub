import { S } from './state.js';
import { MAP_ROTATION, DRAW_TOOLS, MARKER_ICONS, _VISION_RADIUS } from './constants.js';
import { loadImg, getAbilityAoe, _clientToWorld } from './utils.js';
import { api } from '/js/api.js';
import { toast } from '/js/utils.js';
import { initKonva, _setKonvaHandlers } from './konva-init.js';
import { _buildVisionGrid, _buildMapAlphaFull, _refreshMapPaint, _refreshVisionGroup, _coneSvg, _markerIconSvgUrl, _buildVisionCone, _addVisionHandle, _tryAttachVisionToAgent, _placeMarkerIcon, _refreshConeFov, _refreshCrossClip, _refreshAnnihilationBounce, _toggleAnnihilationBounce } from './vision.js';
import { _rebuildAllMovePaths } from './movement.js';
import {
    attachHandlers, setTool, toggleErase, setColor, undo, redo, clearBoard,
    onDown as _onDown, onMove as _onMove, onUp as _onUp, onClick as _onClick,
    deleteUnderMouse, _buildPencilArrowGroup, _applyLineStyle, _hitStroke,
    _setShapesInteractive, _pushHistory, _execCmd, _cmdRemoveBatch, _syncCursor, _enableDraft,
    _isDirty, _clearDirty, _refreshSelectionTr,
} from './drawing.js';
import { _resetOptsTimer } from './tool-options.js';
import { _placeTextInput, _buildRichTextKonva, _buildTextBox, _addTextBoxResizeHandle, _refreshActiveText, _removeGlassOverlay, _syncAllGlassOverlays, _createGlassOverlay, _syncGlassOverlay } from './text.js';
import {
    placeAgent, placeAbilityFinal, selectAgent, selectAbility,
    buildAoeGroup, _reorderAgentsToTop, _iconBgFill, _iconBorderFill,
} from './agents.js';
import { _renderToolOptions, _syncPanelColors, _updatePanelLinePreview, _syncFillPill, _syncBelowPill, _syncArrowPill } from './tool-options.js';
import {
    loadMaps, loadAgents, collectObjects, restoreObjects, clearBoardSilent,
    renderAbilityBar, selectAgentById, applyAgentFilter, getUuidsOnMap,
    updateAgentFog, syncMapPickerLabel, gameToCanvas, flipNode,
    renderBoardMoments, _applyBoardMoment, loadBoardRound, renderMomentDots,
    _gnx, _gny, _gdx, _gdy, _gnpts, _gdpts, _gnAoi, _gdAoi, _detectLineStyle,
} from './board-ops.js';
import {
    loadSettings, openSettings, closeSettings, startListening, saveKeybinds,
    resetKeybinds, renderKeybindRows, setPlaceMode, formatKey, initKeybindListeners,
} from './keybinds.js';
import { initSocket } from './socket.js';

// ── Expose window globals needed by inline HTML onclick handlers ──────────────
window.setTool        = setTool;
window.toggleErase    = toggleErase;
window.setColor       = setColor;
window.undo           = undo;
window.redo           = redo;
window.clearBoard     = clearBoard;
window.selectAgent    = (uuid) => { selectAgentById(uuid); setTool('agent'); };
window.selectAbility  = selectAbility;
window.openSettings   = openSettings;
window.closeSettings  = closeSettings;
window.startListening = startListening;
window.saveKeybinds   = saveKeybinds;
window.resetKeybinds  = resetKeybinds;
window.setPlaceMode   = setPlaceMode;
window.onScaleSlider  = (which, val) => {
    const { onScaleSlider } = window._keybindsExports || {};
    onScaleSlider?.(which, val);
};
window.collectObjects = collectObjects;
window.syncMapPickerLabel = syncMapPickerLabel;
window.setAgentFilter = (f) => {
    S.agentFilter = f;
    document.getElementById('agentFilterAll').classList.toggle('active', f === 'all');
    document.getElementById('agentFilterMap').classList.toggle('active', f === 'map');
    document.getElementById('agentFilterIndicator').classList.toggle('right', f === 'map');
    applyAgentFilter();
};
window.setSide = async (s) => {
    if (s === S.currentSide) return;
    S.drawLayer.getChildren().forEach(node => flipNode(node));
    S.paintLayer.getChildren().forEach(node => flipNode(node));
    S.drawLayer.batchDraw();
    S.currentSide = s;
    ['atk','def'].forEach(k => {
        document.getElementById('btn' + k.charAt(0).toUpperCase() + k.slice(1)).classList.toggle('active', k === s);
    });
    await redrawMap();
    S.drawLayer.getChildren().filter(n => n.getAttr('_type') === 'vision').forEach(g => _refreshVisionGroup(g));
    S.paintLayer.getChildren().forEach(g => _refreshMapPaint(g));
    S.drawLayer.batchDraw();
};
window.confirmMapChange = function() {
    const pending = document.getElementById('mapChangePending').value;
    document.getElementById('mapChangeModal').style.display = 'none';
    document.getElementById('mapPickerDropdown').style.display = 'none';
    document.getElementById('mapPickerBtn').classList.remove('open');
    const sel = document.getElementById('mapSelect');
    sel.value = pending;
    S._lastMapValue = pending;
    try { localStorage.setItem('boardLastMap', pending); } catch {}
    syncMapPickerLabel();
    clearBoardSilent();
    S.boardMoments = [];
    S.activeMomentId = null;
    renderBoardMoments();
    redrawMap();
};
window.toggleMapPicker = function(e) {
    if (e) e.stopPropagation();
    const dd = document.getElementById('mapPickerDropdown');
    const btn = document.getElementById('mapPickerBtn');
    const open = dd.style.display === 'grid';
    dd.style.display = open ? 'none' : 'grid';
    btn.classList.toggle('open', !open);
};
window.pickMap = function(uuid) {
    const sel = document.getElementById('mapSelect');
    if (S.drawLayer.getChildren().length > 0 || S.paintLayer.getChildren().length > 0) {
        document.getElementById('mapChangeModal').style.display = 'flex';
        document.getElementById('mapChangePending').value = uuid;
    } else {
        sel.value = uuid;
        S._lastMapValue = uuid;
        try { localStorage.setItem('boardLastMap', uuid); } catch {}
        syncMapPickerLabel();
        document.getElementById('mapPickerDropdown').style.display = 'none';
        document.getElementById('mapPickerBtn').classList.remove('open');
        redrawMap();
    }
};
window.confirmClearBoard = function() {
    document.getElementById('clearBoardModal').style.display = 'none';
    const pairs = [];
    S.drawLayer.getChildren().slice().forEach(n => { pairs.push({ node: n, layer: S.drawLayer }); n.remove(); });
    S.paintLayer.getChildren().slice().forEach(n => { pairs.push({ node: n, layer: S.paintLayer }); n.remove(); });
    S.drawLayer.batchDraw();
    S.paintLayer.batchDraw();
    if (pairs.length) _execCmd?.(_cmdRemoveBatch?.(pairs));
};
window.newBoard = function() {
    if (!confirm('Start a new board? All moments and drawings will be cleared.')) return;
    if (S.currentStratId) localStorage.removeItem('board_draft_' + S.currentStratId);
    clearBoardSilent();
    S.boardMoments = [];
    S.activeMomentId = null;
    S.currentStratId = null;
    document.getElementById('stratName').value = '';
    renderBoardMoments();
};
window.exportBoard = function() {
    const prevScale = S.stage.scaleX();
    const prevPos   = S.stage.position();
    S.stage.scale({ x: 1, y: 1 });
    S.stage.position({ x: 0, y: 0 });
    S.cursorLayer.visible(false);
    S.stage.batchDraw();
    const dataURL = S.stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
    S.cursorLayer.visible(true);
    S.stage.scale({ x: prevScale, y: prevScale });
    S.stage.position(prevPos);
    S.stage.batchDraw();
    const name = document.getElementById('stratName')?.value?.trim() || 'strategy';
    const a = document.createElement('a');
    a.download = name + '.png';
    a.href = dataURL;
    a.click();
};
window.saveStrategy = async function() {
    const name   = document.getElementById('stratName').value.trim();
    const mapVal = document.getElementById('mapSelect').value;
    if (!name)   { toast('Enter a strategy name', 'warn'); return; }
    if (!mapVal) { toast('Select a map', 'warn'); return; }
    if (S.activeMomentId) {
        const curr = S.boardMoments.find(m => m.id === S.activeMomentId);
        if (curr) curr.objects = collectObjects();
    }
    const body = { name, map: mapVal, side: S.currentSide, objects: JSON.stringify({ shapes: collectObjects(), moments: S.boardMoments, _mapDisplayW: S.mapDisplayW, _mapDisplayH: S.mapDisplayH }) };
    try {
        if (S.currentStratId) {
            await api(`/api/strategy/${S.currentStratId}`, { method:'PUT', body:JSON.stringify(body) });
        } else {
            const s = await api('/api/strategy', { method:'POST', body:JSON.stringify(body) });
            S.currentStratId = s._id;
        }
        toast('Strategy saved!', 'success');
        localStorage.removeItem('board_draft_' + S.currentStratId);
        _clearDirty();
    } catch(e) { toast('Save failed: ' + e.message, 'error'); }
};
window.createBoardMoment = function() {
    if (S.activeMomentId) {
        const curr = S.boardMoments.find(m => m.id === S.activeMomentId);
        if (curr) curr.objects = collectObjects();
    }
    const id    = Date.now().toString();
    const label = `Moment ${S.boardMoments.length + 1}`;
    S.boardMoments.push({ id, label, objects: collectObjects(), momentData: null });
    S.activeMomentId = id;
    renderBoardMoments();
};
window.loadBoardMoment = async function(id) {
    if (id === S.activeMomentId) return;
    await _applyBoardMoment(id);
};
window.deleteBoardMoment = function(id) {
    S.boardMoments = S.boardMoments.filter(m => m.id !== id);
    if (S.activeMomentId === id) {
        S.activeMomentId = S.boardMoments[0]?.id || null;
        if (S.activeMomentId) window.loadBoardMoment(S.activeMomentId);
        else clearBoardSilent();
    }
    renderBoardMoments();
};
window.pasteMoment = async function() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('momentInput').value = text;
    } catch { alert('Allow clipboard access and try again.'); }
};
window.applyMoment = async function() {
    const raw = document.getElementById('momentInput').value.trim();
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch { alert('Invalid JSON.'); return; }
    if (!Array.isArray(data)) return;
    const ATK = '#df5840';
    const DEF = '#22c55e';
    const hasTeamInfo = data.some(e => e.isAttacker !== undefined);
    for (let i = 0; i < data.length; i++) {
        const entry = data[i];
        if (!entry.location) continue;
        const pos   = gameToCanvas(entry.location);
        const color = hasTeamInfo ? (entry.isAttacker ? ATK : DEF) : ATK;
        const r     = 13;
        const g     = new Konva.Group({ x: pos.x, y: pos.y });
        g.add(new Konva.Circle({ radius: r, fill: color + '33', stroke: color, strokeWidth: 2 }));
        if (entry.characterId) {
            const img = await loadImg(`https://media.valorant-api.com/agents/${entry.characterId}/displayicon.png`);
            if (img) {
                const iconGrp = new Konva.Group({ clipFunc: ctx => { ctx.arc(0, 0, r - 2, 0, Math.PI * 2); } });
                iconGrp.add(new Konva.Image({ image: img, x: -(r - 2), y: -(r - 2), width: (r - 2) * 2, height: (r - 2) * 2 }));
                g.add(iconGrp);
            } else {
                g.add(new Konva.Text({ text: String(i + 1), fontSize: 9, fill: '#fff', fontStyle: 'bold', x: -3.5, y: -5 }));
            }
        } else {
            g.add(new Konva.Text({ text: String(i + 1), fontSize: 9, fill: '#fff', fontStyle: 'bold', x: -3.5, y: -5 }));
        }
        S.drawLayer.add(g);
        attachHandlers(g);
        window._drawingExports?._pushHistory?.(g);
        S.drawLayer.batchDraw();
    }
};
window.setWidth = function(w, id) {
    S.currentWidth = w;
    document.querySelectorAll('.width-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};

// ── DnD preview (agent/ability/vision/icon drag onto canvas) ────────────────
let _dndPreview = null;
let _mouseDrag = null;
let _dndStartX = 0, _dndStartY = 0, _dndHasMoved = false;

function _removeDndPreview() {
    if (_dndPreview) { _dndPreview.destroy(); _dndPreview = null; S.drawLayer.batchDraw(); }
    if (typeof window.__mpPreviewRemove === 'function') window.__mpPreviewRemove();
}

function _updateDndPreview(clientX, clientY, type, uuid, slot) {
    const { x, y } = _clientToWorld(clientX, clientY);
    if (_dndPreview) {
        _dndPreview.x(x); _dndPreview.y(y);
        if (type === 'vision') {
            const dir = Math.atan2(clientY - _dndStartY, clientX - _dndStartX) * 180 / Math.PI;
            const ca  = (_mouseDrag?.coneAngle || S.visionConeAngle) * 180 / Math.PI;
            _dndPreview.rotation(dir - ca / 2);
        }
        S.drawLayer.batchDraw(); return;
    }
    if (type === 'agent') {
        const agent = S.agents.find(a => a.uuid === uuid);
        if (!agent) return;
        _dndPreview = new Konva.Group({ x, y, opacity: 0.7 });
        _dndPreview.add(new Konva.Circle({ radius: 22 * S.agentIconScale, fill: _iconBgFill(S.currentColor, S.iconBgOpacity), stroke: _iconBorderFill(S.currentColor, S.iconBgOpacity), strokeWidth: 2 }));
        S.drawLayer.add(_dndPreview);
        loadImg(agent.displayIconSmall || agent.displayIcon).then(img => {
            if (!_dndPreview) return;
            if (img) {
                const r = 19 * S.agentIconScale;
                const ig = new Konva.Group({ clipFunc: ctx => ctx.arc(0,0,r,0,Math.PI*2) });
                ig.add(new Konva.Image({ image:img, x:-r, y:-r, width:r*2, height:r*2 }));
                _dndPreview.add(ig);
            }
            S.drawLayer.batchDraw();
        });
    } else if (type === 'vision') {
        const ca = (_mouseDrag?.coneAngle || S.visionConeAngle) * 180 / Math.PI;
        _dndPreview = new Konva.Group({ x, y, opacity: 0.5, rotation: -ca / 2 });
        _dndPreview.add(new Konva.Wedge({ radius: 90, angle: ca, fill: S.currentColor + '44', stroke: S.currentColor + 'cc', strokeWidth: 1.5 }));
        _dndPreview.add(new Konva.Circle({ radius: 5, fill: S.currentColor }));
        S.drawLayer.add(_dndPreview);
    } else if (type === 'marker-icon') {
        const { _markerIconSvgUrl: svgUrl } = window._visionExports || {};
        const def = (MARKER_ICONS || []).find(i => i.key === (_mouseDrag?.iconKey || S.currentIconKey));
        _dndPreview = new Konva.Group({ x, y, opacity: 0.6 });
        if (def && svgUrl) {
            const img = new window.Image();
            img.src = svgUrl(def, S.currentColor);
            const kImg = new Konva.Image({ image: img, width: 32, height: 32, offsetX: 16, offsetY: 16 });
            img.onload = () => { if (_dndPreview) S.drawLayer.batchDraw(); };
            _dndPreview.add(kImg);
        }
        S.drawLayer.add(_dndPreview);
    } else if (type === 'ability') {
        if (!S.selectedAgent) return;
        const ability = S.selectedAgent.abilities.find(a => a.slot === slot);
        if (!ability) return;
        const aoe = getAbilityAoe(ability);
        _dndPreview = buildAoeGroup({ x, y }, aoe, 0, S.currentColor, false);
        _dndPreview.opacity(0.5);
        const _dndHiddenKey = (S.selectedAgent?.uuid || '') + '_' + slot;
        if (S._aoeHiddenMap[_dndHiddenKey]) { const _ac = _dndPreview.findOne('.aoe-circle'); if (_ac) _ac.visible(false); }
        S.drawLayer.add(_dndPreview);
        const _borderCol = S.currentColor === '#ffffff' ? '#111' : '#fff';
        if (aoe.type === 'circle') {
            _dndPreview.add(new Konva.Circle({ radius: 5, fill: S.currentColor, stroke: _borderCol, strokeWidth: 1.5 }));
        } else {
            _dndPreview.add(new Konva.Circle({ radius: 18 * S.abilityIconScale, fill: _iconBgFill(S.currentColor, S.iconBgOpacity), stroke: _iconBorderFill(S.currentColor, S.iconBgOpacity), strokeWidth: 1.5 }));
            loadImg(ability.displayIcon).then(img => {
                if (!_dndPreview || !img) return;
                const r = 16 * S.abilityIconScale;
                const ig = new Konva.Group({ clipFunc: ctx => ctx.arc(0,0,r,0,Math.PI*2) });
                if (S.currentColor === '#ffffff') ig.globalCompositeOperation('difference');
                ig.add(new Konva.Image({ image:img, x:-r, y:-r, width:r*2, height:r*2 }));
                _dndPreview.add(ig);
                S.drawLayer.batchDraw();
            });
        }
    }
    S.drawLayer.batchDraw();
}

window.onAgentMouseDown = function(e, uuid) {
    if (S.placeMode !== 'drag' || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    _mouseDrag = { type:'agent', uuid };
    _dndStartX = e.clientX; _dndStartY = e.clientY; _dndHasMoved = false;
    document.body.style.userSelect = 'none';
};

window.onAbilityMouseDown = function(e, slot) {
    if (S.placeMode !== 'drag' || e.button !== 0) return;
    e.preventDefault();
    const _slotEl = e.target.closest('.ability-slot');
    if (_slotEl) {
        _slotEl.classList.add('poke');
        _slotEl.addEventListener('animationend', () => {
            _slotEl.classList.remove('poke');
            _slotEl.style.animation = 'none';
        }, { once: true });
    }
    _mouseDrag = { type:'ability', slot };
    _dndStartX = e.clientX; _dndStartY = e.clientY; _dndHasMoved = false;
    document.body.style.userSelect = 'none';
};

window.onVisionMouseDown = function(e) {
    if (S.placeMode !== 'drag' || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    _mouseDrag = { type:'vision', coneAngle: S.visionConeAngle, preset: S.currentVisionPreset };
    _dndStartX = e.clientX; _dndStartY = e.clientY; _dndHasMoved = false;
    document.body.style.userSelect = 'none';
};

window.onIconMouseDown = function(e, iconKey) {
    if (S.placeMode !== 'drag' || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    _mouseDrag = { type:'marker-icon', iconKey };
    _dndStartX = e.clientX; _dndStartY = e.clientY; _dndHasMoved = false;
    document.body.style.userSelect = 'none';
};

window.addEventListener('mousemove', e => {
    if (!_mouseDrag) return;
    if (!_dndHasMoved) {
        const dx = e.clientX - _dndStartX, dy = e.clientY - _dndStartY;
        if (Math.sqrt(dx*dx + dy*dy) > 8) _dndHasMoved = true;
    }
    if (!_dndHasMoved) return;
    const _mRect = document.getElementById('konva-wrap').getBoundingClientRect();
    const inCanvas = e.clientX >= _mRect.left && e.clientX <= _mRect.right && e.clientY >= _mRect.top && e.clientY <= _mRect.bottom;
    if (inCanvas) {
        _updateDndPreview(e.clientX, e.clientY, _mouseDrag.type, _mouseDrag.uuid, _mouseDrag.slot);
        if (typeof window.__mpPreviewUpdate === 'function')
            window.__mpPreviewUpdate(e.clientX, e.clientY, _mouseDrag.type, _mouseDrag.uuid, _mouseDrag.slot);
    } else {
        _removeDndPreview();
    }
});

window.addEventListener('mouseup', async e => {
    if (!_mouseDrag || e.button !== 0) return;
    const drag = { ..._mouseDrag };
    const moved = _dndHasMoved;
    _mouseDrag = null;
    _dndHasMoved = false;
    document.body.style.userSelect = '';
    _removeDndPreview();
    if (!moved) {
        if (drag.type === 'agent') window.selectAgent(drag.uuid);
        return;
    }
    const _cRect = document.getElementById('konva-wrap').getBoundingClientRect();
    const inCanvas = e.clientX >= _cRect.left && e.clientX <= _cRect.right && e.clientY >= _cRect.top && e.clientY <= _cRect.bottom;
    if (!inCanvas) return;
    const pos = _clientToWorld(e.clientX, e.clientY);
    if (drag.type === 'agent') {
        const agent = S.agents.find(a => a.uuid === drag.uuid);
        if (agent) await placeAgent(pos, agent);
    } else if (drag.type === 'ability') {
        const ability = S.selectedAgent?.abilities.find(a => a.slot === drag.slot);
        if (!ability) return;
        const aoe = getAbilityAoe(ability);
        await placeAbilityFinal(pos, ability, aoe, 0);
        S.selectedAbility = null;
        renderAbilityBar(true);
    } else if (drag.type === 'vision') {
        const { _buildVisionCone, _addVisionHandle, _tryAttachVisionToAgent } = window._visionExports || {};
        const dir = Math.atan2(e.clientY - _dndStartY, e.clientX - _dndStartX);
        const g = _buildVisionCone(pos.x, pos.y, _VISION_RADIUS, dir, drag.coneAngle || S.visionConeAngle);
        S.drawLayer.add(g); attachHandlers(g); _addVisionHandle(g); _tryAttachVisionToAgent(g);
        window._drawingExports?._pushHistory?.(g); S.drawLayer.batchDraw();
    } else if (drag.type === 'marker-icon') {
        const { _placeMarkerIcon } = window._visionExports || {};
        const g = _placeMarkerIcon?.(pos, drag.iconKey || S.currentIconKey);
        if (g) { S.drawLayer.add(g); attachHandlers(g); window._drawingExports?._pushHistory?.(g); S.drawLayer.batchDraw(); }
    }
});

// ── Map redraw ───────────────────────────────────────────────────────────────
async function redrawMap() {
    S.mapLayer.destroyChildren();
    const sel = document.getElementById('mapSelect');
    const m = S.maps.find(x => x.uuid === sel.value);
    const bgEl = document.getElementById('mapBlurBg');
    const bgSrc = m?.stylizedBackgroundImage || m?.splash || m?.displayIcon;
    if (bgEl) bgEl.style.backgroundImage = bgSrc ? `url('${bgSrc}')` : 'none';
    if (!m?.displayIcon) { S.mapLayer.batchDraw(); return; }
    const img = await loadImg(m.displayIcon);
    if (!img) { S.mapLayer.batchDraw(); return; }
    const rot = MAP_ROTATION[m.uuid] || 0;
    const swapped = rot === 90 || rot === -90;
    const iw = swapped ? img.height : img.width;
    const ih = swapped ? img.width  : img.height;
    const ratio = iw / ih;
    let dw = S.W, dh = S.W / ratio;
    if (dh > S.H) { dh = S.H; dw = S.H * ratio; }
    S.mapDisplayW = dw; S.mapDisplayH = dh;
    const kImg = new Konva.Image({
        image: img, width: dw, height: dh, opacity: 0.93,
        x: S.W/2, y: S.H/2,
        offsetX: dw/2, offsetY: dh/2,
        rotation: rot + (S.currentSide === 'def' ? 180 : 0),
    });
    S.mapLayer.add(kImg);

    const BOMB_OFFSET = {
        'Ascent':  { A:{dx:0,dy:-20},    B:{dx:-20,dy:0}               },
        'Split':   { A:{dx:115,dy:-20},   B:{dx:65,dy:-20}              },
        'Fracture':{ A:{dx:-85,dy:0},    B:{dx:0,dy:10}                },
        'Bind':    { A:{dx:-13,dy:0},    B:{dx:0,dy:-30}               },
        'Breeze':  { A:{dx:18,dy:-35},   B:{dx:102,dy:-115}            },
        'Abyss':   { A:{dx:10,dy:-20},   B:{dx:-40,dy:-35}             },
        'Lotus':   { A:{dx:7,dy:-45},    B:{dx:-35,dy:-20}, C:{dx:-15,dy:25} },
        'Sunset':  { A:{dx:74,dy:-85},   B:{dx:45,dy:-185}             },
        'Pearl':   { A:{dx:-65,dy:-65},  B:{dx:-95,dy:-70}             },
        'Icebox':  { A:{dx:125,dy:-20},  B:{dx:15,dy:90}               },
        'Corrode': { A:{dx:75,dy:0},     B:{dx:-100,dy:-50}            },
        'Haven':   { A:{dx:35,dy:0},     B:{dx:0,dy:0},  C:{dx:-25,dy:-60} },
    };
    const bombSites = (m.callouts || []).filter(c => c.regionName?.toLowerCase().includes('site'));
    const offMult = S.currentSide === 'def' ? -1 : 1;
    bombSites.forEach(site => {
        const letter = site.superRegionName?.trim();
        if (!letter || !['A','B','C'].includes(letter)) return;
        const pos = gameToCanvas(site.location);
        const off = BOMB_OFFSET[m.displayName]?.[letter] || {dx:0,dy:0};
        const offScale = S.mapDisplayW / 1400;
        S.mapLayer.add(new Konva.Text({
            x: pos.x + off.dx * offScale * offMult,
            y: pos.y + off.dy * offScale * offMult,
            text: letter, fontSize: Math.round(18 * offScale), fontStyle: 'bold', fontFamily: 'Inter, sans-serif',
            fill: '#ffffff', opacity: 0.85,
            offsetX: 6, offsetY: 9,
            listening: false,
        }));
    });

    S.mapLayer.batchDraw();
    S._mapDisplayRot = rot + (S.currentSide === 'def' ? 180 : 0);
    _buildVisionGrid(img, dw, dh, S._mapDisplayRot, m.uuid);
    _buildMapAlphaFull(img, dw, dh, S._mapDisplayRot);
    S.paintLayer.getChildren().forEach(g => _refreshMapPaint(g));
    S.paintLayer.batchDraw();
}

// Expose redrawMap so konva-init resize handler can call it
window._boardOpsExports = {
    redrawMap,
    clearBoardSilent,
    restoreObjects,
    collectObjects,
    _detectLineStyle,
    applyAgentFilter,
    renderAbilityBar,
    getUuidsOnMap,
};

// ── Color picker custom dots ──────────────────────────────────────────────────
(function _initCustomColors() {
    try {
        const saved = JSON.parse(localStorage.getItem('boardCustomColors') || '[]');
        document.querySelectorAll('.color-dot[data-index]').forEach(dot => {
            const c = saved[parseInt(dot.dataset.index)];
            if (c) { dot.dataset.color = c; dot.style.background = c; }
        });
    } catch {}
})();

(function _initColorPicker() {
    const _CP_DEFAULTS = {1:'#22c55e',2:'#f0a500',3:'#4a9eff',4:'#a855f7',5:'#ffffff'};
    function _hsvToRgb(h,s,v) {
        s/=100; v/=100;
        const c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c;
        let r=0,g=0,b=0;
        if(h<60){r=c;g=x;}else if(h<120){r=x;g=c;}else if(h<180){g=c;b=x;}
        else if(h<240){g=x;b=c;}else if(h<300){r=x;b=c;}else{r=c;b=x;}
        return {r:Math.round((r+m)*255),g:Math.round((g+m)*255),b:Math.round((b+m)*255)};
    }
    function _rgbToHsv(r,g,b) {
        r/=255;g/=255;b/=255;
        const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
        let h=0;
        if(d){
            if(max===r)h=((g-b)/d)%6;
            else if(max===g)h=(b-r)/d+2;
            else h=(r-g)/d+4;
            h=Math.round(h*60); if(h<0)h+=360;
        }
        return {h,s:max?Math.round(d/max*100):0,v:Math.round(max*100)};
    }
    function _hexToRgb(hex){return{r:parseInt(hex.slice(1,3),16),g:parseInt(hex.slice(3,5),16),b:parseInt(hex.slice(5,7),16)};}
    function _rgbToHex(r,g,b){return'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');}

    const picker=document.getElementById('cpPicker');
    const sv=document.getElementById('cpSV');
    const dot=document.getElementById('cpSVDot');
    const hue=document.getElementById('cpHue');
    const preview=document.getElementById('cpPreview');
    const hexInp=document.getElementById('cpHex');
    const resetBtn=document.getElementById('cpReset');
    const cancelBtn=document.getElementById('cpCancel');
    const applyBtn=document.getElementById('cpApply');

    let H=0,S_=100,V_=100,_activeDot=null,_svDrag=false;

    function _render() {
        const {r,g,b}=_hsvToRgb(H,S_,V_);
        const hex=_rgbToHex(r,g,b);
        sv.style.background=`hsl(${H},100%,50%)`;
        dot.style.left=S_+'%'; dot.style.top=(100-V_)+'%';
        dot.style.background=hex;
        preview.style.background=hex;
        hexInp.value=hex;
    }
    function _setHex(hex) {
        if(!/^#[0-9a-fA-F]{6}$/.test(hex))return;
        const {r,g,b}=_hexToRgb(hex);
        const hsv=_rgbToHsv(r,g,b);
        H=hsv.h; S_=hsv.s; V_=hsv.v;
        hue.value=H; _render();
    }
    function _svFromEvent(e) {
        const rect=sv.getBoundingClientRect();
        const cx=e.touches?e.touches[0].clientX:e.clientX;
        const cy=e.touches?e.touches[0].clientY:e.clientY;
        S_=Math.max(0,Math.min(100,Math.round((cx-rect.left)/rect.width*100)));
        V_=Math.max(0,Math.min(100,Math.round(100-(cy-rect.top)/rect.height*100)));
        _render();
    }
    sv.addEventListener('mousedown',e=>{_svDrag=true;_svFromEvent(e);});
    document.addEventListener('mousemove',e=>{if(_svDrag)_svFromEvent(e);});
    document.addEventListener('mouseup',()=>{_svDrag=false;});
    hue.addEventListener('input',()=>{H=parseInt(hue.value);_render();});
    hexInp.addEventListener('keydown',e=>{if(e.key==='Enter')_setHex(hexInp.value);});
    hexInp.addEventListener('blur',()=>_setHex(hexInp.value));

    function _open(colorDot) {
        _activeDot=colorDot;
        _setHex(colorDot.dataset.color);
        picker.style.display='block';
        const r=colorDot.getBoundingClientRect();
        const pw=picker.offsetWidth||216, ph=picker.offsetHeight||260;
        let left=r.right+10, top=r.top-ph/2+r.height/2;
        if(left+pw>window.innerWidth-8)left=r.left-pw-10;
        top=Math.max(8,Math.min(top,window.innerHeight-ph-8));
        picker.style.left=left+'px'; picker.style.top=top+'px';
    }
    function _close(){picker.style.display='none';_activeDot=null;}

    resetBtn.addEventListener('click',()=>{
        if(!_activeDot)return;
        _setHex(_CP_DEFAULTS[parseInt(_activeDot.dataset.index)]||'#ffffff');
    });
    cancelBtn.addEventListener('click',_close);
    applyBtn.addEventListener('click',()=>{
        if(!_activeDot)return;
        const c=hexInp.value;
        _activeDot.dataset.color=c; _activeDot.style.background=c;
        try{
            const saved=JSON.parse(localStorage.getItem('boardCustomColors')||'[]');
            saved[parseInt(_activeDot.dataset.index)]=c;
            localStorage.setItem('boardCustomColors',JSON.stringify(saved));
        }catch{}
        setColor(c); _close();
    });
    document.addEventListener('mousedown',e=>{
        if(picker.style.display!=='none'&&!picker.contains(e.target)&&!e.target.closest('.color-dot[data-index]'))_close();
    });
    document.addEventListener('dblclick',e=>{
        const d=e.target.closest('.color-dot[data-index]');
        if(!d)return;
        e.preventDefault(); _open(d);
    });
})();

// ── Map picker click-outside close ───────────────────────────────────────────
document.addEventListener('click', e => {
    const dd = document.getElementById('mapPickerDropdown');
    const btn = document.getElementById('mapPickerBtn');
    if (dd && dd.style.display === 'grid' && !dd.contains(e.target) && !btn.contains(e.target)) {
        dd.style.display = 'none';
        btn.classList.remove('open');
    }
});

// ── Sidebar scroll fog ────────────────────────────────────────────────────────
document.getElementById('agentSidebarScroll').addEventListener('scroll', updateAgentFog);

// ── Native DOM click fallback (Brave canvas fingerprinting) ──────────────────
document.getElementById('konva-wrap').addEventListener('click', async function(e) {
    if (S.currentTool !== 'agent' || S.placeMode === 'drag') return;
    if (!S.selectedAgent || S.selectedAbility) return;
    if (Date.now() - S._lastPlaceTime < 200) return;
    if (S._isDragMove) return;
    S._lastPlaceTime = Date.now();
    const pos = _clientToWorld(e.clientX, e.clientY);
    await placeAgent(pos, S.selectedAgent);
}, false);

// ── First-time settings prompt ────────────────────────────────────────────────
(function() {
    const SEEN_KEY = 'boardSeenSettings_v1';
    if (!localStorage.getItem(SEEN_KEY)) {
        localStorage.setItem(SEEN_KEY, '1');
        setTimeout(() => window.openSettings?.(), 400);
    }
})();

// ── Initialization ────────────────────────────────────────────────────────────
// Expose window globals for cross-module access at runtime
window._drawingExports = {
    attachHandlers,
    deleteUnderMouse,
    _pushHistory,
    _execCmd,
    _cmdRemoveBatch,
    _buildPencilArrowGroup,
    _applyLineStyle,
    _hitStroke,
    _clientToWorld,
    _setShapesInteractive,
    _syncCursor,
    _rebuildAllMovePaths,
    _refreshSelectionTr,
};
window._textExports = {
    refreshActiveText: _refreshActiveText,
    _refreshActiveText,
    _buildRichTextKonva,
    _buildTextBox,
    _addTextBoxResizeHandle,
    _placeTextInput,
    _removeGlassOverlay,
    _syncAllGlassOverlays,
    _createGlassOverlay,
    _syncGlassOverlay,
};
window._agentsExports = {
    placeAgent,
    placeAbilityFinal,
    selectAgent: (uuid) => { selectAgentById(uuid); setTool('agent'); },
    buildAoeGroup,
    _reorderAgentsToTop,
};
window._visionExports = {
    _coneSvg,
    _markerIconSvgUrl,
    _buildVisionCone,
    _addVisionHandle,
    _tryAttachVisionToAgent,
    _placeMarkerIcon,
    _refreshConeFov,
    _refreshCrossClip,
    _refreshAnnihilationBounce,
    _toggleAnnihilationBounce,
};
window._keybindsExports = {
    openSettings,
    onScaleSlider: (which, val) => {
        const v = parseFloat(val);
        if (which === 'agent') { S.agentIconScale = v; document.getElementById('sliderAgentVal').textContent = Math.round(v * 100) + '%'; }
        else if (which === 'ability') { S.abilityIconScale = v; document.getElementById('sliderAbilityVal').textContent = Math.round(v * 100) + '%'; }
        else { S.iconBgOpacity = v; document.getElementById('sliderBgOpacityVal').textContent = Math.round(v * 100) + '%'; }
        try { localStorage.setItem('boardIconScales', JSON.stringify({ agent: S.agentIconScale, ability: S.abilityIconScale, bgOpacity: S.iconBgOpacity })); } catch {}
    },
};

window._toolOptionsExports = {
    _updatePanelLinePreview,
    _syncPanelColors,
};

window.onScaleSlider = (which, val) => window._keybindsExports.onScaleSlider(which, val);

// Set konva-init handler references before initKonva()
_setKonvaHandlers({
    onDown: _onDown,
    onMove: _onMove,
    onUp: _onUp,
    onClick: _onClick,
    resetOptsTimer: _resetOptsTimer,
    redrawMap,
});

loadSettings();
initKonva();
initKeybindListeners();

// ── Load data and restore strategy from URL ───────────────────────────────────
// _AI_MAP_LANDMARKS must be declared here (before the top-level await that calls
// _loadMapLandmarks) to avoid a TDZ error when the async callbacks resume.
const _AI_MAP_LANDMARKS = {};
let _AI_COACH_CONTEXT = '';
await Promise.all([loadMaps(), loadAgents()]);
await _loadMapLandmarks();
await (async () => {
    try {
        const r = await fetch('/api/ai-chat/coach-context');
        if (r.ok) { _AI_COACH_CONTEXT = await r.text(); console.log('[coach] context loaded:', _AI_COACH_CONTEXT.length, 'chars'); }
        else console.warn('[coach] coach-context not found:', r.status);
    } catch(e) { console.warn('[coach] failed to load coach-context:', e.message); }
})();
await loadBoardRound();

const _urlStratId = new URLSearchParams(window.location.search).get('stratId');
if (_urlStratId) {
    try {
        const s = await api(`/api/strategy/${_urlStratId}`);
        S.currentStratId = s._id;
        document.getElementById('stratName').value = s.name;
        S.currentSide = s.side || 'atk';
        ['atk','def'].forEach(k => document.getElementById('btn' + k.charAt(0).toUpperCase() + k.slice(1)).classList.toggle('active', k === S.currentSide));
        document.getElementById('mapSelect').value = s.map;
        syncMapPickerLabel();
        await redrawMap();
        clearBoardSilent();
        const parsed = JSON.parse(s.objects || '[]');
        if (Array.isArray(parsed)) {
            await restoreObjects(parsed);
        } else {
            await restoreObjects(parsed.shapes || []);
            if (parsed.moments?.length) {
                S.boardMoments = parsed.moments;
                S.activeMomentId = S.boardMoments[0]?.id || null;
                renderBoardMoments();
            }
        }
        // ── Draft restore ────────────────────────────────────────────────────
        const _draftRaw = localStorage.getItem('board_draft_' + S.currentStratId);
        if (_draftRaw) {
            try {
                const _draft = JSON.parse(_draftRaw);
                clearBoardSilent();
                await restoreObjects(_draft.shapes || []);
                if (_draft.moments?.length) {
                    S.boardMoments = _draft.moments;
                    S.activeMomentId = S.boardMoments[0]?.id || null;
                    renderBoardMoments();
                }
                // Show dismissible toast with Discard option
                let _tc = document.getElementById('toast-container');
                if (!_tc) { _tc = document.createElement('div'); _tc.id = 'toast-container'; document.body.appendChild(_tc); }
                const _dt = document.createElement('div');
                _dt.className = 'toast';
                _dt.style.cssText = 'display:flex;gap:10px;align-items:center;';
                _dt.innerHTML = 'Draft restored — unsaved changes from previous session. <button style="background:none;border:1px solid rgba(255,255,255,0.35);border-radius:4px;color:inherit;cursor:pointer;padding:2px 8px;font-size:0.75rem;flex-shrink:0;" id="_draft-discard-btn">Discard</button>';
                _tc.appendChild(_dt);
                const _savedObjects = s.objects;
                document.getElementById('_draft-discard-btn')?.addEventListener('click', async () => {
                    localStorage.removeItem('board_draft_' + S.currentStratId);
                    _dt.remove();
                    clearBoardSilent();
                    const _rp = JSON.parse(_savedObjects || '[]');
                    if (Array.isArray(_rp)) { await restoreObjects(_rp); }
                    else {
                        await restoreObjects(_rp.shapes || []);
                        if (_rp.moments?.length) { S.boardMoments = _rp.moments; S.activeMomentId = S.boardMoments[0]?.id || null; renderBoardMoments(); }
                    }
                    applyAgentFilter(); S.paintLayer.batchDraw();
                });
                setTimeout(() => _dt.remove(), 12000);
            } catch { localStorage.removeItem('board_draft_' + S.currentStratId); }
        }
        // ────────────────────────────────────────────────────────────────────
        applyAgentFilter();
        S.paintLayer.batchDraw();
        _enableDraft();
    } catch(e) { toast('Could not load strategy: ' + e.message, 'error'); }
}

initSocket();

// ── Save draft synchronously on page unload (F5, tab close, navigation) ──────
window.addEventListener('beforeunload', () => {
    if (!S.currentStratId || !window._boardOpsExports?.collectObjects || !_isDirty()) return;
    try {
        localStorage.setItem('board_draft_' + S.currentStratId, JSON.stringify({
            ts: Date.now(),
            shapes: window._boardOpsExports.collectObjects(),
            moments: S.boardMoments,
        }));
    } catch {}
});

// ── Panel tab switcher ────────────────────────────────────────────────────────
window._activePanelTab = 'moments';
window.switchPanelTab = function(tab) {
    window._activePanelTab = tab;
    // Expanded width only applies while on the AI tab; restore on return
    const panel = document.getElementById('boardPanel');
    if (tab === 'ai') {
        panel.classList.toggle('ai-expanded', _aiExpanded);
    } else {
        panel.classList.remove('ai-expanded');
    }
    ['layers','moments','ai'].forEach(t => {
        document.getElementById('tab-' + t).classList.toggle('active', t === tab);
        const content = document.getElementById('tabcontent-' + t);
        if (t === tab) {
            content.style.display = 'flex';
            content.style.flexDirection = 'column';
            content.style.flex = '1';
            content.style.overflow = 'hidden';
            content.style.minHeight = '0';
        } else {
            content.style.display = 'none';
        }
    });
    if (tab === 'ai') _aiRenderMessages();
};

// ── AI Chat ───────────────────────────────────────────────────────────────────
const _AI_PROXY = '/api/ai-chat';
let _aiDoc = null; // { name, content }

// Unsaved boards get a temporary session key so they never share history
const _aiSessionKey = 'tmp_' + Date.now();
function _aiHistoryKey() {
    return 'ai_chat_' + (S.currentStratId || _aiSessionKey);
}
function _aiLoadHistory() {
    try { return JSON.parse(localStorage.getItem(_aiHistoryKey()) || '[]'); } catch { return []; }
}
function _aiSaveHistory(msgs) {
    try { localStorage.setItem(_aiHistoryKey(), JSON.stringify(msgs.slice(-60))); } catch {}
}

// ── Competitive win-rate cache (refreshed per map per aiSend) ─────────────────
let _aiWinrateCache = { mapName: null, data: null }; // { mapName, data: [] }

async function _aiRefreshWinrates(mapName) {
    if (!mapName || mapName === 'Unknown' || _aiWinrateCache.mapName === mapName) return;
    try {
        const res = await api(`/api/comps/winrates?map=${encodeURIComponent(mapName)}&minSamples=3&limit=10`);
        _aiWinrateCache = { mapName, data: res.winrates || [] };
    } catch (e) {
        console.warn('[AI winrates] failed to load:', e.message);
    }
}

// _AI_MAP_LANDMARKS is declared near the top-level await that triggers loading
// (see declaration above _loadMapLandmarks call) to avoid TDZ errors.

function _parseLandmarkEntries(entries) {
    const obj = {};
    entries.forEach(en => {
        if (!en.label) return;
        const key = en.label.toLowerCase().replace(/\s+/g, '_');
        if (en.kind === 'polygon' && Array.isArray(en.pts)) {
            const cx = +(en.pts.reduce((s, p) => s + p.x, 0) / en.pts.length).toFixed(4);
            const cy = +(en.pts.reduce((s, p) => s + p.y, 0) / en.pts.length).toFixed(4);
            obj[key] = { x: cx, y: cy, pts: en.pts.map(p => [p.x, p.y]), color: en.color, opacity: en.opacity ?? 0.25 };
        } else if (en.kind === 'point') {
            obj[key] = { x: en.x, y: en.y, color: en.color };
        }
    });
    return obj;
}

async function _loadMapLandmarks() {
    const maps = S.maps || [];

    // ── Fallback: landmark editor localStorage (key used by landmark-editor.html)
    let lsLandmarks = {};
    try {
        const raw = localStorage.getItem('landmark_editor_v3');
        if (raw) lsLandmarks = JSON.parse(raw);
    } catch {}

    await Promise.all(maps.map(async map => {
        const name = map.displayName;
        const file = `landmarks_${name.toLowerCase().replace(/\s+/g, '_')}.json`;
        try {
            const r = await fetch(`/board/maps_lm/${file}`);
            if (!r.ok) {
                // HTTP error — try localStorage fallback
                if (Array.isArray(lsLandmarks[name]) && lsLandmarks[name].length) {
                    _AI_MAP_LANDMARKS[name] = _parseLandmarkEntries(lsLandmarks[name]);
                    console.log(`[landmarks] ${name}: HTTP ${r.status}, loaded ${Object.keys(_AI_MAP_LANDMARKS[name]).length} entries from localStorage`);
                } else {
                    console.log(`[landmarks] ${name}: HTTP ${r.status}, no file or localStorage data`);
                }
                return;
            }
            const data = await r.json();
            const entries = data[name];
            if (!Array.isArray(entries)) {
                console.warn(`[landmarks] ${name}: JSON has no array for key "${name}"`);
                return;
            }
            _AI_MAP_LANDMARKS[name] = _parseLandmarkEntries(entries);
            console.log(`[landmarks] loaded ${name} from file: ${Object.keys(_AI_MAP_LANDMARKS[name]).length} entries`);
        } catch(err) {
            // Parse error or network failure — try localStorage fallback
            console.warn(`[landmarks] ${name}: fetch/parse error:`, err.message);
            if (Array.isArray(lsLandmarks[name]) && lsLandmarks[name].length) {
                _AI_MAP_LANDMARKS[name] = _parseLandmarkEntries(lsLandmarks[name]);
                console.log(`[landmarks] ${name}: loaded ${Object.keys(_AI_MAP_LANDMARKS[name]).length} entries from localStorage fallback`);
            }
        }
    }));

    // Also load from localStorage any maps that weren't covered by files
    Object.entries(lsLandmarks).forEach(([name, entries]) => {
        if (!_AI_MAP_LANDMARKS[name] && Array.isArray(entries) && entries.length) {
            _AI_MAP_LANDMARKS[name] = _parseLandmarkEntries(entries);
            console.log(`[landmarks] ${name}: loaded ${Object.keys(_AI_MAP_LANDMARKS[name]).length} entries from localStorage only`);
        }
    });
}

function _aiBoardContext() {
    const collect = window._boardOpsExports?.collectObjects;
    const rawObjs = collect ? collect() : [];

    // Build agent lookup: uuid → { name, abilities }
    const agentMap = {};
    (S.agents || []).forEach(a => {
        agentMap[a.uuid] = {
            name: a.displayName || a.name,
            abilities: (a.abilities || []).reduce((acc, ab) => { acc[ab.slot] = ab.displayName; return acc; }, {}),
        };
    });

    const objects = rawObjs.map(o => {
        if ((o.type === 'agent' || o.type === 'ability') && o.agentUuid) {
            const info = agentMap[o.agentUuid];
            const enriched = { ...o, agentName: info?.name || o.agentUuid };
            if (o.type === 'ability' && o.slot && info?.abilities[o.slot]) {
                enriched.abilityName = info.abilities[o.slot];
            }
            return enriched;
        }
        return o;
    });

    // Unique agents on the board
    const agentsOnBoard = [...new Set(
        objects.filter(o => o.type === 'agent').map(o => o.agentName)
    )];

    const mapName = S.maps?.find(m => m.uuid === document.getElementById('mapSelect')?.value)?.displayName
        || S.currentMap?.displayName || 'Unknown';

    const landmarks = _AI_MAP_LANDMARKS[mapName] || null;

    return { map: mapName, side: S.currentSide || 'atk', agentsOnBoard, landmarks, objects };
}

function _aiSystemPrompt() {
    const ctx = _aiBoardContext();
    const availableAgents = (S.agents || []).map(a => a.displayName || a.name).filter(Boolean).join(', ');

    let sys = `You are an experienced Valorant head coach with deep knowledge of competitive tactics, team dynamics, and strategic analysis. You think and communicate like a professional coach — direct, tactical, and always focused on what the team needs to improve or execute. You understand FPS fundamentals at a high level and apply them contextually, not just theoretically.

You are helping a team review and modify their strategy board layout.

## Board Context
Map: ${ctx.map}
Side: ${ctx.side.toUpperCase()}
Agents currently on board: ${ctx.agentsOnBoard.join(', ') || 'none placed yet'}
${(() => {
    const lm = ctx.landmarks;
    if (!lm) return '';
    const entries = Object.entries(lm);
    if (!entries.length) return '';
    // Build a legend: group entries by color so the AI knows what each color means
    const colorMap = {};
    entries.forEach(([name, pos]) => {
        const c = pos.color || '#ffdd57';
        if (!colorMap[c]) colorMap[c] = [];
        colorMap[c].push(name.replace(/_/g,' '));
    });
    const legend = Object.entries(colorMap).map(([c, names]) => `  ${c} → ${names.join(', ')}`).join('\n');
    const regionList = entries.map(([name, pos]) => {
        const label = name.replace(/_/g,' ');
        const coord = `centroid (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`;
        const kind = pos.pts ? 'region' : 'point';
        return `  • ${label} [${kind}] ${coord} color=${pos.color||'#ffdd57'}`;
    }).join('\n');
    return `\n## Map Landmarks & Regions\nThe screenshot shows colored overlays on the map. Each color corresponds to a named area:\n${legend}\n\nFull list:\n${regionList}\nWhen colors overlap in the screenshot, use this list to identify each area by its label — do NOT confuse overlapping colors.`;
})()}

## Coordinate System
Positions use normalised (x, y) values from 0.0 to 1.0.
- (0, 0) = TOP-LEFT corner of the map image
- (1, 0) = TOP-RIGHT
- (0, 1) = BOTTOM-LEFT
- (1, 1) = BOTTOM-RIGHT
x increases left→right. y increases top→bottom.

## How to determine coordinates — MANDATORY
Every message includes a screenshot of the map with a white grid overlay.
Grid lines are drawn at x = 0.25, 0.5, 0.75 and y = 0.25, 0.5, 0.75.
Intersections are labelled "x,y" (e.g. "0.25,0.5").
ALWAYS read coordinates from this grid. Do NOT guess or use memorized map knowledge.
Steps: (1) find the target location in the screenshot, (2) identify the surrounding grid labels, (3) interpolate to get the (x,y) fraction.

## Current Board Objects
The screenshot shows these elements placed on the map. Agent tokens and ability icons ARE visible as colored circles/icons in the screenshot — look for them carefully.
${(() => {
    if (!ctx.objects.length) return 'Nothing placed yet.';
    return ctx.objects.map(o => {
        if (o.type === 'agent')   return `• Agent: ${o.agentName||o.agentUuid} at (${(o.x||0).toFixed(2)}, ${(o.y||0).toFixed(2)})`;
        if (o.type === 'ability') return `• Ability: ${o.abilityName||o.slot} (${o.agentName||o.agentUuid}) at (${(o.x||0).toFixed(2)}, ${(o.y||0).toFixed(2)})`;
        if (o.type === 'arrow')   return `• Arrow from (${(o.x||0).toFixed(2)},${(o.y||0).toFixed(2)}) to (${(o.x2||o.x||0).toFixed(2)},${(o.y2||o.y||0).toFixed(2)})`;
        if (o.type === 'text')    return `• Text: "${o.text||''}" at (${(o.x||0).toFixed(2)}, ${(o.y||0).toFixed(2)})`;
        return `• ${o.type} at (${(o.x||0).toFixed(2)}, ${(o.y||0).toFixed(2)})`;
    }).join('\n');
})()}

## Agents Available for Placement
${availableAgents}

## Ability Slots for Agents Currently on Board
${(() => {
    const onBoard = ctx.agentsOnBoard;
    if (!onBoard.length) return 'None on board yet.';
    return onBoard.map(name => {
        const agent = (S.agents || []).find(a => (a.displayName || a.name) === name);
        if (!agent?.abilities) return `${name}: (no ability data)`;
        const SLOT_LABEL = { Ability1: 'hab1', Ability2: 'hab2', Grenade: 'hab3', Ultimate: 'ult' };
        const slots = agent.abilities.map(ab => `  ${SLOT_LABEL[ab.slot] || ab.slot} = "${ab.displayName}"`).join('\n');
        return `${name}:\n${slots}`;
    }).join('\n');
})()}

## Rules for board modifications
- Only use tools when explicitly asked to modify the board.
- When asked to "fix", "correct" or "redo" existing placements: call clear_board first, then re-place everything from scratch. Never stack new elements on top of old ones.
- For place_ability: use the slot label (hab1/hab2/hab3/ult) from the Ability Slots section above. The agent must already be placed on the board first.
- For draw_arrow: (x1,y1) = start, (x2,y2) = end. Read both points from the screenshot grid.
- For place_text: place callout labels near the relevant map area. Read position from grid.

## General
- Analyze strategy, identify weaknesses, suggest improvements. Be concise and direct.
- Use markdown formatting (headers, bold, bullet lists).
- Respond in the same language the user writes in.`;

    // Competitive win-rate data for the current map (fetched async before aiSend)
    if (_aiWinrateCache.mapName === ctx.map && _aiWinrateCache.data?.length) {
        const rows = _aiWinrateCache.data.map((r, i) =>
            `${i + 1}. [${r.agents.join(', ')}] — ${r.winRate}% WR (${r.wins}W/${r.total - r.wins}L | ${r.total} maps)`
        ).join('\n');
        sys += `\n\n## Composições com Maior Win Rate — ${ctx.map} (dados competitivos reais)\n${rows}\nUse esses dados para avaliar se a composição atual está alinhada com o meta competitivo do mapa.`;
    }

    if (_aiDoc) {
        sys += `\n\n## Reference Document: "${_aiDoc.name}"\n${_aiDoc.content}`;
    }
    return sys;
}

// Returns { systemStatic, systemDynamic } for prompt caching:
// static = coach-context.md (cached by Anthropic, 10x cheaper after 1st request)
// dynamic = board state, agents, landmarks (changes every request, not cached)
function _aiSystemParts() {
    return {
        systemStatic:  _AI_COACH_CONTEXT || undefined,
        systemDynamic: _aiSystemPrompt(),
    };
}

function _aiRenderMessages() {
    const container = document.getElementById('aiMessages');
    if (!container) return;
    const msgs = _aiLoadHistory();
    if (!msgs.length) {
        container.innerHTML = `<div class="ai-empty">
            <svg class="ai-sparkle-svg" width="72" height="72" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                <!-- Path from Illustrator (viewBox 1706.66×1706.66, center≈853.33,853.33) -->
                <!-- Outer <g> handles position/scale; inner <path> gets the CSS animation -->
                <!-- Large star: cx=11 cy=15, diameter=18 → scale=18/1706.66 -->
                <g transform="translate(11,15) scale(0.01054) translate(-853.33,-853.33)">
                    <path class="sp1" fill-rule="evenodd" fill="currentColor" stroke="currentColor" stroke-width="160" stroke-linejoin="round" d="M1659.62 861.09c15.13,-63.06 -13.92,-114.96 -50.59,-140.12 -41.63,-28.56 -102.36,-35.73 -155,-48.14 -389.11,-91.8 -338.59,-34.47 -421.64,-377.96 -26.8,-110.82 -31.87,-240.18 -137.57,-262.58 -149.32,-31.63 -164.3,99.56 -190.09,209.99 -14.38,61.54 -57.22,278.07 -87.06,312.49 -41.22,47.55 -61.61,51 -135.67,68.15l-239.78 57.92c-26.47,5.44 -55.9,12.23 -82.08,19.14 -121.64,32.12 -126.06,180.27 -43.2,241.74 49.43,36.66 402.3,85.93 471.23,131.89 68.79,45.87 109,330.49 143.87,458.44 12.69,46.6 49.37,85.89 101.17,95.9 61.98,11.97 115.41,-16.35 141.21,-55.52 19.02,-28.85 35.41,-110.32 45.14,-151.51 94,-397.62 36.49,-337.05 379.6,-420.06 112.75,-27.27 234.88,-33.09 260.46,-139.77z"/>
                </g>
                <!-- Medium star: cx=27 cy=10, diameter=9 → scale=9/1706.66 -->
                <g transform="translate(27,10) scale(0.00527) translate(-853.33,-853.33)">
                    <path class="sp2" fill-rule="evenodd" fill="currentColor" stroke="currentColor" stroke-width="160" stroke-linejoin="round" d="M1659.62 861.09c15.13,-63.06 -13.92,-114.96 -50.59,-140.12 -41.63,-28.56 -102.36,-35.73 -155,-48.14 -389.11,-91.8 -338.59,-34.47 -421.64,-377.96 -26.8,-110.82 -31.87,-240.18 -137.57,-262.58 -149.32,-31.63 -164.3,99.56 -190.09,209.99 -14.38,61.54 -57.22,278.07 -87.06,312.49 -41.22,47.55 -61.61,51 -135.67,68.15l-239.78 57.92c-26.47,5.44 -55.9,12.23 -82.08,19.14 -121.64,32.12 -126.06,180.27 -43.2,241.74 49.43,36.66 402.3,85.93 471.23,131.89 68.79,45.87 109,330.49 143.87,458.44 12.69,46.6 49.37,85.89 101.17,95.9 61.98,11.97 115.41,-16.35 141.21,-55.52 19.02,-28.85 35.41,-110.32 45.14,-151.51 94,-397.62 36.49,-337.05 379.6,-420.06 112.75,-27.27 234.88,-33.09 260.46,-139.77z"/>
                </g>
                <!-- Small star: cx=24 cy=27, diameter=6 → scale=6/1706.66 -->
                <g transform="translate(24,27) scale(0.00351) translate(-853.33,-853.33)">
                    <path class="sp3" fill-rule="evenodd" fill="currentColor" stroke="currentColor" stroke-width="160" stroke-linejoin="round" d="M1659.62 861.09c15.13,-63.06 -13.92,-114.96 -50.59,-140.12 -41.63,-28.56 -102.36,-35.73 -155,-48.14 -389.11,-91.8 -338.59,-34.47 -421.64,-377.96 -26.8,-110.82 -31.87,-240.18 -137.57,-262.58 -149.32,-31.63 -164.3,99.56 -190.09,209.99 -14.38,61.54 -57.22,278.07 -87.06,312.49 -41.22,47.55 -61.61,51 -135.67,68.15l-239.78 57.92c-26.47,5.44 -55.9,12.23 -82.08,19.14 -121.64,32.12 -126.06,180.27 -43.2,241.74 49.43,36.66 402.3,85.93 471.23,131.89 68.79,45.87 109,330.49 143.87,458.44 12.69,46.6 49.37,85.89 101.17,95.9 61.98,11.97 115.41,-16.35 141.21,-55.52 19.02,-28.85 35.41,-110.32 45.14,-151.51 94,-397.62 36.49,-337.05 379.6,-420.06 112.75,-27.27 234.88,-33.09 260.46,-139.77z"/>
                </g>
                <!-- Accent dots -->
                <circle class="d1" cx="32" cy="20" r="1.5" fill="currentColor"/>
                <circle class="d2" cx="5"  cy="27" r="1.8" fill="currentColor"/>
            </svg>
            <div class="ai-empty-title">AI Strategy Analyst</div>
            <div class="ai-empty-sub">Ask anything about the current board layout, agent composition, or upload a reference document.</div>
        </div>`;
        return;
    }
    container.innerHTML = msgs.map(m => `
        <div class="ai-msg ${m.role}">
            <div class="ai-msg-role">${m.role === 'user' ? 'You' : 'AI'}</div>
            <div class="ai-msg-body">${_aiMarkdown(m.content)}</div>
        </div>`).join('');
    container.scrollTop = container.scrollHeight;
}

function _aiMarkdown(raw) {
    // ── Helpers ───────────────────────────────────────────────────────────────
    const escHtml = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const inline  = s => {
        s = escHtml(s);
        s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        s = s.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>');
        s = s.replace(/\*([^*\n]+)\*/g,     '<em>$1</em>');
        s = s.replace(/`([^`\n]+)`/g, '<code style="background:rgba(255,255,255,0.12);padding:1px 5px;border-radius:3px;font-size:0.82em;font-family:monospace;">$1</code>');
        return s;
    };

    // ── Pre-pass: collect table blocks ────────────────────────────────────────
    // Group consecutive | lines into table blocks before line-by-line processing
    const rawLines   = raw.split('\n');
    const segments   = []; // { type: 'lines'|'table', data }
    let   lineBuffer = [];

    const flushLines = () => { if (lineBuffer.length) { segments.push({ type:'lines', data:[...lineBuffer] }); lineBuffer=[]; } };

    let   tableBuffer = [];
    const isTableRow  = l => /^\s*\|/.test(l);
    const isSepRow    = l => /^\s*\|[\s\|:\-]+\|?\s*$/.test(l);

    for (const line of rawLines) {
        if (isTableRow(line)) {
            flushLines();
            tableBuffer.push(line);
        } else {
            if (tableBuffer.length) {
                segments.push({ type:'table', data:[...tableBuffer] });
                tableBuffer = [];
            }
            lineBuffer.push(line);
        }
    }
    if (tableBuffer.length) segments.push({ type:'table', data:[...tableBuffer] });
    flushLines();

    // ── Render table segment ──────────────────────────────────────────────────
    const renderTable = rows => {
        const parsed = rows.map(r =>
            r.trim().replace(/^\||\|$/g,'').split('|').map(c => c.trim())
        );
        if (parsed.length < 2) return parsed.map(r => r.join(' | ')).join('<br>');

        const headerCells = parsed[0];
        const isHeader    = isSepRow(rows[1]);
        const bodyRows    = isHeader ? parsed.slice(2) : parsed.slice(1);

        const th = headerCells.map(c =>
            `<th style="padding:5px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.15);color:#fff;font-weight:700;white-space:nowrap;">${inline(c)}</th>`
        ).join('');

        const trs = bodyRows.map((cells, ri) => {
            const bg = ri % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent';
            const tds = headerCells.map((_, ci) => {
                const cell = cells[ci] ?? '';
                return `<td style="padding:4px 10px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.85);">${inline(cell)}</td>`;
            }).join('');
            return `<tr style="background:${bg};">${tds}</tr>`;
        }).join('');

        return `<table style="border-collapse:collapse;width:max-content;min-width:100%;font-size:0.78rem;white-space:normal;margin:6px 0;">
                <thead><tr>${th}</tr></thead>
                <tbody>${trs}</tbody>
            </table>`;
    };

    // ── Render line segment ───────────────────────────────────────────────────
    const renderLines = lines => {
        const out = [];
        let inUl = false, inOl = false;
        const closeList = () => {
            if (inUl) { out.push('</ul>'); inUl = false; }
            if (inOl) { out.push('</ol>'); inOl = false; }
        };
        for (const line of lines) {
            if (/^### /.test(line)) {
                closeList();
                out.push(`<div style="font-size:0.76rem;font-weight:900;color:#fff;margin:8px 0 2px;">${inline(line.slice(4))}</div>`);
            } else if (/^## /.test(line)) {
                closeList();
                out.push(`<div style="font-size:0.8rem;font-weight:900;color:#fff;margin:10px 0 3px;">${inline(line.slice(3))}</div>`);
            } else if (/^# /.test(line)) {
                closeList();
                out.push(`<div style="font-size:0.84rem;font-weight:900;color:#fff;margin:10px 0 3px;">${inline(line.slice(2))}</div>`);
            } else if (/^> /.test(line)) {
                closeList();
                out.push(`<div style="border-left:3px solid rgba(255,255,255,0.25);padding:2px 0 2px 10px;color:rgba(255,255,255,0.6);margin:4px 0;font-style:italic;">${inline(line.slice(2))}</div>`);
            } else if (/^---+$/.test(line.trim())) {
                closeList();
                out.push(`<hr style="border:none;border-top:1px solid rgba(255,255,255,0.12);margin:8px 0;">`);
            } else if (/^- /.test(line)) {
                if (inOl) { out.push('</ol>'); inOl = false; }
                if (!inUl) { out.push('<ul style="margin:4px 0;padding-left:14px;display:flex;flex-direction:column;gap:2px;">'); inUl = true; }
                out.push(`<li>${inline(line.slice(2))}</li>`);
            } else if (/^\d+\. /.test(line)) {
                if (inUl) { out.push('</ul>'); inUl = false; }
                if (!inOl) { out.push('<ol style="margin:4px 0;padding-left:16px;display:flex;flex-direction:column;gap:2px;">'); inOl = true; }
                out.push(`<li>${inline(line.replace(/^\d+\. /,''))}</li>`);
            } else {
                closeList();
                out.push(line === '' ? '<br>' : inline(line) + '<br>');
            }
        }
        closeList();
        return out.join('');
    };

    // ── Combine segments ──────────────────────────────────────────────────────
    return segments.map(seg =>
        seg.type === 'table' ? renderTable(seg.data) : renderLines(seg.data)
    ).join('');
}

function _aiAppendMsg(role, content) {
    const msgs = _aiLoadHistory();
    msgs.push({ role, content });
    _aiSaveHistory(msgs);
    _aiRenderMessages();
}

function _aiAppendThinking() {
    const container = document.getElementById('aiMessages');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'ai-msg assistant thinking';
    el.id = 'ai-thinking';
    el.innerHTML = `<div class="ai-msg-role">AI</div><div class="ai-msg-body">Thinking…</div>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
}

function _aiRemoveThinking() {
    document.getElementById('ai-thinking')?.remove();
}

function _aiCaptureCanvas() {
    try {
        // devicePixelRatio: Konva internal canvas pixels = CSS pixels × dpr
        // All stage.x()/scaleX() values are in CSS pixels — must multiply by dpr for drawImage source coords
        const dpr = window.devicePixelRatio || 1;

        // Map bounds in CSS (logical) pixels
        const mapX = S.stage.x() + (S.W / 2 - S.mapDisplayW / 2) * S.stage.scaleX();
        const mapY = S.stage.y() + (S.H / 2 - S.mapDisplayH / 2) * S.stage.scaleY();
        const mapW = S.mapDisplayW * S.stage.scaleX();
        const mapH = S.mapDisplayH * S.stage.scaleY();

        // Convert to physical canvas pixels for drawImage source
        const srcX = mapX * dpr;
        const srcY = mapY * dpr;
        const srcW = mapW * dpr;
        const srcH = mapH * dpr;

        const TARGET_W = 768; // wider → sharper landmarks & grid labels
        const scale = TARGET_W / mapW;

        const offscreen = document.createElement('canvas');
        offscreen.width  = TARGET_W;
        offscreen.height = Math.round(mapH * scale);
        const ctx2d = offscreen.getContext('2d');

        // Draw all Konva layers cropped to map area
        const layers = [S.mapLayer, S.paintLayer, S.drawLayer];
        layers.forEach(layer => {
            const c = layer?.canvas?._canvas || layer?.getCanvas?.()?._canvas;
            if (!c) return;
            ctx2d.drawImage(c,
                srcX, srcY, srcW, srcH,                  // src: physical canvas pixels
                0, 0, offscreen.width, offscreen.height  // dest: output canvas
            );
        });

        // Draw subtle coordinate grid so the AI can accurately estimate positions
        const OW = offscreen.width, OH = offscreen.height;
        ctx2d.save();
        ctx2d.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx2d.lineWidth = 1;
        ctx2d.setLineDash([3, 4]);
        ctx2d.font = `bold ${Math.round(OW * 0.022)}px monospace`;
        ctx2d.fillStyle = 'rgba(255,255,255,0.55)';
        ctx2d.textBaseline = 'top';
        const steps = [0.25, 0.5, 0.75];
        steps.forEach(t => {
            // vertical line at x=t
            ctx2d.beginPath(); ctx2d.moveTo(t * OW, 0); ctx2d.lineTo(t * OW, OH); ctx2d.stroke();
            // horizontal line at y=t
            ctx2d.beginPath(); ctx2d.moveTo(0, t * OH); ctx2d.lineTo(OW, t * OH); ctx2d.stroke();
        });
        // Label grid intersections with (x,y) coords
        [[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],
         [0,0.25],[0.25,0.25],[0.5,0.25],[0.75,0.25],[1,0.25],
         [0,0.5],[0.5,0.5],[1,0.5],
         [0,0.75],[0.5,0.75],[1,0.75],
         [0,1],[0.5,1],[1,1]].forEach(([gx,gy]) => {
            const px = Math.min(gx * OW + 2, OW - 28);
            const py = Math.min(gy * OH + 2, OH - 14);
            ctx2d.fillText(`${gx},${gy}`, px, py);
        });

        // Draw landmark regions and pins
        const mapName = S.maps?.find(m => m.uuid === document.getElementById('mapSelect')?.value)?.displayName
            || S.currentMap?.displayName || '';
        const landmarks = _AI_MAP_LANDMARKS[mapName];
        console.log(`[AI vision] map="${mapName}" landmarks=${landmarks ? Object.keys(landmarks).join(',') : 'NONE'}`);
        if (landmarks) {
            const fontSize = Math.round(OW * 0.030);
            ctx2d.textBaseline = 'middle';
            ctx2d.textAlign = 'center';

            // Pass 1: draw polygon fills (regions/sub-regions)
            Object.entries(landmarks).forEach(([name, pos]) => {
                if (!pos.pts) return;
                const color = pos.color || '#ffdd57';
                const opacity = pos.opacity ?? 0.28;
                ctx2d.beginPath();
                pos.pts.forEach(([nx, ny], i) => {
                    i === 0 ? ctx2d.moveTo(nx * OW, ny * OH) : ctx2d.lineTo(nx * OW, ny * OH);
                });
                ctx2d.closePath();
                ctx2d.fillStyle = color;
                ctx2d.globalAlpha = opacity;
                ctx2d.fill();
                ctx2d.globalAlpha = 1;
                ctx2d.strokeStyle = color;
                ctx2d.lineWidth = 1.5;
                ctx2d.setLineDash([]);
                ctx2d.stroke();
            });

            // Pass 2: draw labels for all entries (polygon centroid or point)
            ctx2d.font = `bold ${fontSize}px sans-serif`;
            Object.entries(landmarks).forEach(([name, pos]) => {
                const px = pos.x * OW;
                const py = pos.y * OH;
                const color = pos.color || '#ffdd57';
                const label = name.replace(/_/g, ' ').toUpperCase();
                const tw = ctx2d.measureText(label).width;
                ctx2d.fillStyle = 'rgba(0,0,0,0.78)';
                ctx2d.beginPath();
                ctx2d.roundRect(px - tw/2 - 4, py - fontSize/2 - 3, tw + 8, fontSize + 6, 4);
                ctx2d.fill();
                ctx2d.fillStyle = color;
                ctx2d.fillText(label, px, py);
            });
        }
        ctx2d.restore();

        const dataUrl = offscreen.toDataURL('image/jpeg', 0.82);
        const b64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
        console.log(`[AI vision] map crop ${offscreen.width}x${offscreen.height}px, base64 size: ${b64.length} chars (~${(b64.length/1024).toFixed(1)}kb)`);
        console.log('%c[AI vision] preview:', 'font-weight:bold');
        console.log('%c ', `font-size:1px; padding: ${Math.round(offscreen.height/2)}px ${Math.round(offscreen.width/2)}px; background: url(${dataUrl}) no-repeat center/contain;`);
        return b64;
    } catch(e) {
        console.error('[AI vision] capture failed:', e);
        return null;
    }
}

window.aiSend = async function() {
    const input = document.getElementById('aiInput');
    const sendBtn = document.getElementById('aiSendBtn');
    if (!input || !sendBtn) return;
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    aiInputResize(input);
    sendBtn.disabled = true;

    // Switch to AI tab if not already there
    if (window._activePanelTab !== 'ai') switchPanelTab('ai');

    _aiAppendMsg('user', text);
    _aiAppendThinking();

    // Refresh win-rate cache for current map (no-op if already cached)
    const _curMapName = S.maps?.find(m => m.uuid === document.getElementById('mapSelect')?.value)?.displayName
        || S.currentMap?.displayName;
    await _aiRefreshWinrates(_curMapName);

    const history  = _aiLoadHistory().slice(0, -1); // exclude msg just added
    const messages = history.map(m => ({ role: m.role, content: m.content }));
    messages.push({ role: 'user', content: text });

    try {
        const { systemStatic, systemDynamic } = _aiSystemParts();
        const payload = { systemStatic, systemDynamic, messages, model: 'claude-haiku-4-5-20251001', max_tokens: 2048 };

        const data = await api(_AI_PROXY, { method: 'POST', body: JSON.stringify(payload) });

        // AI requested a board capture (capture_board tool) — capture and continue
        if (data?.captureRequest) {
            const imgB64 = _aiCaptureCanvas();
            const continueData = await api(_AI_PROXY + '/continue', {
                method: 'POST',
                body: JSON.stringify({ ...data.captureRequest, imageB64: imgB64, systemStatic, systemDynamic }),
            });
            _aiRemoveThinking();
            _aiAppendMsg('assistant', continueData?.text || '(no response)');
            const allCalls = [...(data.toolCalls || []), ...(continueData?.toolCalls || [])];
            if (allCalls.length) await _aiExecuteToolCalls(allCalls);
        } else {
            _aiRemoveThinking();
            _aiAppendMsg('assistant', data?.text || '(no response)');
            if (data?.toolCalls?.length) await _aiExecuteToolCalls(data.toolCalls);
        }
    } catch(err) {
        _aiRemoveThinking();
        _aiAppendMsg('assistant', `⚠️ Error: ${err.message}`);
    } finally {
        sendBtn.disabled = false;
        input.focus();
    }
};

window.aiInputKeydown = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.aiSend(); }
};

window.aiInputResize = function(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 96) + 'px';
};

window.aiLoadDoc = function(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        _aiDoc = { name: file.name, content: e.target.result.slice(0, 12000) };
        document.getElementById('aiDocLabel').textContent = file.name;
        document.getElementById('aiDocClear').style.display = '';
        document.getElementById('aiDocBtn').style.display = 'none';
    };
    reader.readAsText(file);
    input.value = '';
};

window.aiClearDoc = function() {
    _aiDoc = null;
    document.getElementById('aiDocLabel').textContent = 'No document';
    document.getElementById('aiDocClear').style.display = 'none';
    document.getElementById('aiDocBtn').style.display = '';
};

let _aiExpanded = false;

window.aiToggleExpand = function() {
    _aiExpanded = !_aiExpanded;
    document.getElementById('boardPanel').classList.toggle('ai-expanded', _aiExpanded);
    document.getElementById('aiExpandIcon').innerHTML = _aiExpanded
        ? '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>'
        : '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>';
    document.getElementById('aiExpandBtn').title = _aiExpanded ? 'Collapse chat' : 'Expand chat';
};

// Clamp normalised coords to valid map interior (avoids edge/outside placements)
function _aiClamp(v) { return Math.max(0.05, Math.min(0.95, v)); }
function _aiPos(nx, ny) { return { x: _gdx(_aiClamp(nx)), y: _gdy(_aiClamp(ny)) }; }

async function _aiExecuteToolCalls(toolCalls) {
    if (!toolCalls?.length) return;
    const { attachHandlers, _pushHistory, _buildPencilArrowGroup } = window._drawingExports || {};
    const { _buildTextBox, _addTextBoxResizeHandle } = window._textExports || {};
    let summary = [];

    const prevAgent = S.selectedAgent;

    for (const call of toolCalls) {
        const inp = call.input;

        if (call.name === 'place_agent') {
            const agent = _aiFindAgent(inp.agentName);
            if (agent) {
                await placeAgent(_aiPos(inp.x, inp.y), agent);
                summary.push(agent.displayName || agent.name);
            } else {
                toast(`AI: agent "${inp.agentName}" not found`, 'warn');
            }

        } else if (call.name === 'place_ability') {
            const agent = _aiFindAgent(inp.agentName);
            // Map neutral slot labels back to real Konva slot names
            const SLOT_MAP = { hab1: 'Ability1', hab2: 'Ability2', hab3: 'Grenade', ult: 'Ultimate' };
            const realSlot = SLOT_MAP[inp.slot] || inp.slot;
            const ability = agent?.abilities?.find(a => a.slot === realSlot);
            if (agent && ability) {
                const { getAbilityAoe } = await import('./utils.js');
                const aoeInfo = getAbilityAoe(ability);
                // Must set S.selectedAgent so placeAbilityFinal saves _agentUuid correctly
                S.selectedAgent = agent;
                await placeAbilityFinal(_aiPos(inp.x, inp.y), ability, aoeInfo, inp.angle || 0);
                summary.push(ability.displayName || inp.slot);
            } else if (agent && !ability) {
                toast(`AI: slot "${inp.slot}" (${realSlot}) not found on ${inp.agentName}`, 'warn');
            } else {
                toast(`AI: agent "${inp.agentName}" not found for ability placement`, 'warn');
            }

        } else if (call.name === 'draw_arrow') {
            const color = inp.color || '#df5840';
            const p = [_gdx(_aiClamp(inp.x1)), _gdy(_aiClamp(inp.y1)), _gdx(_aiClamp(inp.x2)), _gdy(_aiClamp(inp.y2))];
            const g = _buildPencilArrowGroup?.(p, color, 3, 1, 'solid');
            if (g && attachHandlers && _pushHistory) {
                S.drawLayer.add(g); attachHandlers(g); _pushHistory(g); S.drawLayer.batchDraw();
            }
            if (inp.label) {
                _aiPlaceTextBox(inp.label, (inp.x1 + inp.x2) / 2, (inp.y1 + inp.y2) / 2, color,
                    _buildTextBox, _addTextBoxResizeHandle, attachHandlers, _pushHistory);
            }
            summary.push('arrow');

        } else if (call.name === 'place_text') {
            _aiPlaceTextBox(inp.text, inp.x, inp.y, inp.color || '#ffffff',
                _buildTextBox, _addTextBoxResizeHandle, attachHandlers, _pushHistory);
            summary.push(`"${inp.text.slice(0, 20)}"`);

        } else if (call.name === 'clear_board') {
            clearBoardSilent();
            summary.push('board cleared');
        }
    }

    // Restore previously selected agent
    S.selectedAgent = prevAgent;

    if (summary.length) toast(`AI: ${summary.join(', ')}`, 'info');
}

function _aiFindAgent(name) {
    if (!name) return null;
    const n = name.toLowerCase();
    return (S.agents || []).find(a =>
        (a.displayName || a.name || '').toLowerCase() === n
    );
}

function _aiPlaceTextBox(text, nx, ny, color, _buildTextBox, _addTextBoxResizeHandle, attachHandlers, _pushHistory) {
    if (!_buildTextBox || !attachHandlers || !_pushHistory) return;
    const g = _buildTextBox(_aiPos(nx, ny), text, { color, size: 14, bold: true });
    if (g) {
        S.drawLayer.add(g); attachHandlers(g); _addTextBoxResizeHandle?.(g); _pushHistory(g); S.drawLayer.batchDraw();
    }
}
