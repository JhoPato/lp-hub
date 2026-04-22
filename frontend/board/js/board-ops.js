import { S } from './state.js';
import { MAP_ROTATION, SLOT_KEY, getSlotKey, _CACHE_TTL } from './constants.js';
import { loadImg } from './utils.js';
import { _buildVisionCone, _addVisionHandle, _tryAttachVisionToAgent, _refreshVisionGroup, _buildMapPaintGroup, _refreshMapPaint, _placeMarkerIcon } from './vision.js';
import { _buildMoveGroup, _updateMoveGroup } from './movement.js';

export function _cacheGet(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts > _CACHE_TTL) { localStorage.removeItem(key); return null; }
        return data;
    } catch { return null; }
}

export function _cacheSet(key, data) {
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

export function _proxyImg(url) {
    if (!url) return '';
    return '/api/vapi-proxy?url=' + encodeURIComponent(url);
}

export function _gnx(v) { return (v - (S.W/2 - S.mapDisplayW/2)) / S.mapDisplayW; }
export function _gny(v) { return (v - (S.H/2 - S.mapDisplayH/2)) / S.mapDisplayH; }
export function _gdx(nv) { return nv * S.mapDisplayW + (S.W/2 - S.mapDisplayW/2); }
export function _gdy(nv) { return nv * S.mapDisplayH + (S.H/2 - S.mapDisplayH/2); }
export function _gnpts(pts) { return pts.map((v,i) => i%2===0 ? _gnx(v) : _gny(v)); }
export function _gdpts(pts) { return pts.map((v,i) => i%2===0 ? _gdx(v) : _gdy(v)); }
export function _gnAoi(str) {
    if (!str) return str;
    const a = JSON.parse(str), ref = Math.min(S.mapDisplayW, S.mapDisplayH);
    if (a.radius != null)     a.radius     /= ref;
    if (a.length != null)     a.length     /= S.mapDisplayW;
    if (a.castOffset != null) a.castOffset /= S.mapDisplayW;
    if (a.minLen != null)     a.minLen     /= S.mapDisplayW;
    if (a.maxLen != null)     a.maxLen     /= S.mapDisplayW;
    if (a.pathPoints != null) a.pathPoints = a.pathPoints.map((v,i) => i%2===0 ? v/S.mapDisplayW : v/S.mapDisplayH);
    return JSON.stringify(a);
}
export function _gdAoi(str) {
    if (!str) return str;
    const a = JSON.parse(str), ref = Math.min(S.mapDisplayW, S.mapDisplayH);
    if (a.radius != null)     a.radius     *= ref;
    if (a.length != null)     a.length     *= S.mapDisplayW;
    if (a.castOffset != null) a.castOffset *= S.mapDisplayW;
    if (a.minLen != null)     a.minLen     *= S.mapDisplayW;
    if (a.maxLen != null)     a.maxLen     *= S.mapDisplayW;
    if (a.pathPoints != null) a.pathPoints = a.pathPoints.map((v,i) => i%2===0 ? v*S.mapDisplayW : v*S.mapDisplayH);
    return JSON.stringify(a);
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

export function gameToCanvas(loc) {
    const sel = document.getElementById('mapSelect');
    const m = S.maps.find(x => x.uuid === sel.value);
    if (!m || !m.xMultiplier) return { x: S.W/2, y: S.H/2 };
    const u = loc.y * m.xMultiplier + m.xScalarToAdd;
    const v = loc.x * m.yMultiplier + m.yScalarToAdd;
    const lx = (u - 0.5) * S.mapDisplayW;
    const ly = (v - 0.5) * S.mapDisplayH;
    const rot = MAP_ROTATION[m.uuid] || 0;
    const rad = rot * Math.PI / 180;
    const rx = lx * Math.cos(rad) - ly * Math.sin(rad);
    const ry = lx * Math.sin(rad) + ly * Math.cos(rad);
    const sign = S.currentSide === 'def' ? -1 : 1;
    return { x: S.W/2 + rx * sign, y: S.H/2 + ry * sign };
}

export function syncMapPickerLabel() {
    const sel = document.getElementById('mapSelect');
    const m = S.maps.find(x => x.uuid === sel.value);
    if (m) document.getElementById('mapPickerLabel').textContent = m.displayName;
    document.querySelectorAll('.map-pill').forEach(p => p.classList.toggle('selected', p.dataset.uuid === sel.value));
}

export async function redrawMap() {
    return window._boardOpsExports?.redrawMap?.();
}

export function collectObjects() {
    const objs = [];
    S.paintLayer.getChildren().forEach(node => {
        const t = node.getAttr('_type');
        if (t === 'map-paint') {
            const sw = node.getAttr('_shapeW'), sh = node.getAttr('_shapeH'), sr = node.getAttr('_shapeR');
            objs.push({ _norm:true, type:'map-paint', shapeType:node.getAttr('_shapeType'), x:_gnx(node.getAttr('_shapeX')||0), y:_gny(node.getAttr('_shapeY')||0), w:sw!=null?sw/S.mapDisplayW:null, h:sh!=null?sh/S.mapDisplayH:null, r:sr!=null?sr/Math.min(S.mapDisplayW,S.mapDisplayH):null, stroke:node.getAttr('_stroke'), fillOpacity:node.getAttr('_fillOpacity') });
        }
    });
    S.drawLayer.getChildren().forEach(node => {
        if (!node) return;
        const cls = node.getClassName();
        const a = node.attrs;
        if (cls === 'Arrow') {
            const ox=a.x||0, oy=a.y||0;
            const ap=(a.points||[]).map((v,i)=>i%2===0?v+ox:v+oy);
            objs.push({ _norm:true, type:'arrow', points:_gnpts(ap), stroke:a.stroke, strokeWidth:a.strokeWidth, fill:a.fill, tension:a.tension||0, pointerLength:a.pointerLength, pointerWidth:a.pointerWidth, lineStyle:_detectLineStyle(node), opacity:node.opacity() });
        } else if (cls === 'Line') {
            const ox=a.x||0, oy=a.y||0;
            const ap=(a.points||[]).map((v,i)=>i%2===0?v+ox:v+oy);
            objs.push({ _norm:true, type:'line', points:_gnpts(ap), stroke:a.stroke, strokeWidth:a.strokeWidth, tension:node.tension?.()??0, lineStyle:_detectLineStyle(node), opacity:node.opacity() });
        } else if (cls === 'Circle') {
            objs.push({ _norm:true, type:'circle', x:_gnx(a.x||0), y:_gny(a.y||0), radius:(a.radius||0)/Math.min(S.mapDisplayW,S.mapDisplayH), stroke:a.stroke, strokeWidth:a.strokeWidth, fill:a.fill });
        } else if (cls === 'Rect') {
            objs.push({ _norm:true, type:'rect', x:_gnx(a.x||0), y:_gny(a.y||0), width:(a.width||0)/S.mapDisplayW, height:(a.height||0)/S.mapDisplayH, stroke:a.stroke, strokeWidth:a.strokeWidth, fill:a.fill });
        } else if (cls === 'Text') {
            objs.push({ _norm:true, type:'text', x:_gnx(a.x||0), y:_gny(a.y||0), text:a.text, fontSize:a.fontSize, fill:a.fill });
        } else if (cls === 'Group') {
            const t = node.getAttr('_type');
            if (t === 'agent') {
                objs.push({ _norm:true, type:'agent', x:_gnx(a.x||0), y:_gny(a.y||0), agentUuid:node.getAttr('_agentUuid'), stroke:node.getAttr('_stroke') });
            } else if (t === 'ability') {
                objs.push({ _norm:true, type:'ability', x:_gnx(a.x||0), y:_gny(a.y||0), angle:node.rotation(), agentUuid:node.getAttr('_agentUuid'), slot:node.getAttr('_slot'), stroke:node.getAttr('_stroke'), aoeInfo:_gnAoi(node.getAttr('_aoeInfo')), aoeHidden:node.getAttr('_aoeHidden')||false, bounceEnabled:node.getAttr('_bounceEnabled') });
            } else if (t === 'move-path') {
                const ln = node.getChildren().find(c => c instanceof Konva.Line);
                if (ln) {
                    const ox=a.x||0, oy=a.y||0;
                    const pts=(ln.points()||[]).map((v,i)=>i%2===0?v+ox:v+oy);
                    objs.push({ _norm:true, type:'move-path', points:_gnpts(pts), speed:node.getAttr('_moveSpeed'), stroke:node.getAttr('_stroke'), dash:node.getAttr('_moveDash') });
                }
            } else if (t === 'vision') {
                objs.push({ _norm:true, type:'vision', x:_gnx(a.x||0), y:_gny(a.y||0), radius:(node.getAttr('_radius')||200)/Math.min(S.mapDisplayW,S.mapDisplayH), direction:node.getAttr('_direction')||0, coneAngle:node.getAttr('_coneAngle')||S.visionConeAngle, stroke:node.getAttr('_stroke')||S.currentColor });
            } else if (t === 'marker-icon') {
                objs.push({ _norm:true, type:'marker-icon', x:_gnx(a.x||0), y:_gny(a.y||0), iconKey:node.getAttr('_iconKey'), stroke:node.getAttr('_stroke')||S.currentColor });
            } else if (t === 'pencil-arrow') {
                const ln = node.getChildren().find(c => c.name() === '_stroke');
                if (ln) {
                    const ox=a.x||0, oy=a.y||0;
                    const pts=(ln.points()||[]).map((v,i)=>i%2===0?v+ox:v+oy);
                    objs.push({ _norm:true, type:'pencil-arrow', points:_gnpts(pts), stroke:ln.stroke(), strokeWidth:ln.strokeWidth(), opacity:node.opacity() });
                }
            } else if (t === 'text') {
                objs.push({ _norm:true, type:'text', x:_gnx(a.x||0), y:_gny(a.y||0), runs:node.getAttr('_runs'), textFont:node.getAttr('_textFont'), textSize:node.getAttr('_textSize'), textOpacity:node.getAttr('_textOpacity'), fill:node.getAttr('_textColor') });
            } else if (t === 'textbox') {
                const bw = node.getAttr('_boxWidth') || 240;
                objs.push({ _norm:true, type:'textbox', x:_gnx(a.x||0), y:_gny(a.y||0), text:node.getAttr('_text')||'', textFont:node.getAttr('_textFont'), textSize:node.getAttr('_textSize'), textColor:node.getAttr('_textColor'), textBold:node.getAttr('_textBold'), textItalic:node.getAttr('_textItalic'), textAlign:node.getAttr('_textAlign')||'left', textShadow:node.getAttr('_textShadow')||false, textOpacity:node.getAttr('_textOpacity')??1, hasBg:node.getAttr('_hasBg')||false, bgColor:node.getAttr('_bgColor'), bgOpacity:node.getAttr('_bgOpacity')??0.88, hasBorder:node.getAttr('_hasBorder')||false, borderColor:node.getAttr('_borderColor'), hasStroke:node.getAttr('_hasStroke')||false, strokeColor:node.getAttr('_strokeColor'), boxWidth:bw/S.mapDisplayW });
            }
        }
    });
    return objs;
}

export async function restoreObjects(objs) {
    const { attachHandlers, _pushHistory, _buildPencilArrowGroup, _applyLineStyle, _hitStroke } = window._drawingExports || {};
    const { _buildRichTextKonva, _buildTextBox, _addTextBoxResizeHandle } = window._textExports || {};
    const { placeAgent, placeAbilityFinal, _reorderAgentsToTop } = window._agentsExports || {};
    const { getAbilityAoe } = await import('./utils.js');

    S._restoring = true;
    const prevColor = S.currentColor;
    for (const o of objs) {
        S.currentColor = o.stroke || o.fill?.slice(0,7) || '#df5840';
        const rx = o._norm ? _gdx(o.x??0) : (o.x??0);
        const ry = o._norm ? _gdy(o.y??0) : (o.y??0);
        const rpts = pts => o._norm ? _gdpts(pts||[]) : (pts||[]);
        if (o.type === 'pencil-arrow') {
            const g = _buildPencilArrowGroup(rpts(o.points), o.stroke||'#df5840', o.strokeWidth||2, o.opacity??1, o.lineStyle||'solid');
            if (o._id) g.setAttr('_id', o._id);
            S.drawLayer.add(g); attachHandlers(g); _pushHistory(g);
        } else if (o.type === 'arrow') {
            const s = new Konva.Arrow({ points:rpts(o.points), stroke:o.stroke, strokeWidth:o.strokeWidth, hitStrokeWidth:_hitStroke(o.strokeWidth), fill:o.fill||o.stroke, tension:o.tension||0, pointerLength:o.pointerLength||12, pointerWidth:o.pointerWidth||8, lineCap:'round', x:0, y:0 });
            _applyLineStyle(s, o.lineStyle||'solid', o.stroke);
            if (o.opacity != null) s.opacity(o.opacity);
            if (o._id) s.setAttr('_id', o._id);
            S.drawLayer.add(s); attachHandlers(s); _pushHistory(s);
        } else if (o.type === 'line') {
            const s = new Konva.Line({ points:rpts(o.points), stroke:o.stroke, strokeWidth:o.strokeWidth, hitStrokeWidth:_hitStroke(o.strokeWidth), tension:o.tension||0, lineCap:'round', lineJoin:'round', x:0, y:0 });
            _applyLineStyle(s, o.lineStyle||'solid', o.stroke);
            if (o.opacity != null) s.opacity(o.opacity);
            if (o._id) s.setAttr('_id', o._id);
            S.drawLayer.add(s); attachHandlers(s); _pushHistory(s);
        } else if (o.type === 'circle') {
            const r = o._norm ? (o.radius||0)*Math.min(S.mapDisplayW,S.mapDisplayH) : (o.radius||0);
            const s = new Konva.Circle({ x:rx, y:ry, radius:r, stroke:o.stroke, strokeWidth:o.strokeWidth, fill:o.fill });
            if (o._id) s.setAttr('_id', o._id);
            S.drawLayer.add(s); attachHandlers(s); _pushHistory(s);
        } else if (o.type === 'rect') {
            const w = o._norm ? (o.width||0)*S.mapDisplayW : (o.width||0);
            const h = o._norm ? (o.height||0)*S.mapDisplayH : (o.height||0);
            const s = new Konva.Rect({ x:rx, y:ry, width:w, height:h, stroke:o.stroke, strokeWidth:o.strokeWidth, fill:o.fill });
            if (o._id) s.setAttr('_id', o._id);
            S.drawLayer.add(s); attachHandlers(s); _pushHistory(s);
        } else if (o.type === 'text') {
            if (o.runs) {
                const savedFont = S.currentTextFont, savedSize = S.currentTextSize, savedOpacity = S.currentTextOpacity;
                S.currentTextFont = o.textFont || S.currentTextFont;
                S.currentTextSize = o.textSize || S.currentTextSize;
                S.currentTextOpacity = o.textOpacity != null ? o.textOpacity : S.currentTextOpacity;
                const g = _buildRichTextKonva({ x:rx, y:ry }, JSON.parse(o.runs));
                g.opacity(S.currentTextOpacity);
                if (o._id) g.setAttr('_id', o._id);
                S.drawLayer.add(g); attachHandlers(g); _pushHistory(g);
                S.currentTextFont = savedFont; S.currentTextSize = savedSize; S.currentTextOpacity = savedOpacity;
            } else {
                const s = new Konva.Text({ x:rx, y:ry, text:o.text, fontSize:o.fontSize||16, fill:o.fill, fontFamily:'monospace', fontStyle:'bold' });
                if (o._id) s.setAttr('_id', o._id);
                S.drawLayer.add(s); attachHandlers(s); _pushHistory(s);
            }
        } else if (o.type === 'move-path') {
            const g = _buildMoveGroup(rpts(o.points), o.speed||'rifle-run', o.stroke||S.currentColor, o.dash);
            g.x(0); g.y(0);
            if (o._id) g.setAttr('_id', o._id);
            S.drawLayer.add(g); attachHandlers(g); _pushHistory(g);
        } else if (o.type === 'vision') {
            const savedColor = S.currentColor;
            if (o.stroke) S.currentColor = o.stroke;
            const r = o._norm ? (o.radius||0)*Math.min(S.mapDisplayW,S.mapDisplayH) : (o.radius||200);
            const g = _buildVisionCone(rx, ry, r, o.direction||0, o.coneAngle||S.visionConeAngle);
            S.currentColor = savedColor;
            if (o._id) g.setAttr('_id', o._id);
            S.drawLayer.add(g); attachHandlers(g); _addVisionHandle(g); _tryAttachVisionToAgent(g); _pushHistory(g);
        } else if (o.type === 'marker-icon') {
            const g = _placeMarkerIcon({ x:rx, y:ry }, o.iconKey||'pin', o.stroke);
            if (g) { if (o._id) g.setAttr('_id', o._id); S.drawLayer.add(g); attachHandlers(g); _pushHistory(g); }
        } else if (o.type === 'map-paint') {
            const w = o._norm && o.w!=null ? o.w*S.mapDisplayW : o.w;
            const h = o._norm && o.h!=null ? o.h*S.mapDisplayH : o.h;
            const r = o._norm && o.r!=null ? o.r*Math.min(S.mapDisplayW,S.mapDisplayH) : o.r;
            const g = _buildMapPaintGroup(o.shapeType||'rect', rx, ry, w, h, r, o.stroke||S.currentColor, o.fillOpacity??0.5);
            if (o._id) g.setAttr('_id', o._id); S.paintLayer.add(g); _pushHistory(g);
        } else if (o.type === 'textbox') {
            const bw = o._norm ? (o.boxWidth||0.3)*S.mapDisplayW : (o.boxWidth||240);
            const g = _buildTextBox({ x:rx, y:ry }, o.text||'', { font:o.textFont, size:o.textSize, color:o.textColor, bold:o.textBold, italic:o.textItalic, align:o.textAlign||'left', shadow:o.textShadow||false, hasBg:o.hasBg||false, bgColor:o.bgColor, bgOpacity:o.bgOpacity??0.88, hasBorder:o.hasBorder||false, borderColor:o.borderColor, hasStroke:o.hasStroke||false, strokeColor:o.strokeColor, opacity:o.textOpacity??1, boxWidth:bw });
            if (o._id) g.setAttr('_id', o._id);
            S.drawLayer.add(g); attachHandlers(g); _addTextBoxResizeHandle(g); _pushHistory(g);
        } else if (o.type === 'agent') {
            const ag = S.agents.find(a => a.uuid === o.agentUuid);
            if (ag) await placeAgent({ x:rx, y:ry }, ag, o._id||null);
        } else if (o.type === 'ability') {
            const ag = S.agents.find(a => a.uuid === o.agentUuid);
            const ability = ag?.abilities.find(a => a.slot === o.slot);
            const prevSel = S.selectedAgent; S.selectedAgent = ag;
            if (ability) {
                const aoeInfoStr = o._norm && o.aoeInfo ? _gdAoi(o.aoeInfo) : o.aoeInfo;
                const aoeInfo = aoeInfoStr ? JSON.parse(aoeInfoStr) : getAbilityAoe(ability);
                const _placed = await placeAbilityFinal({ x:rx, y:ry }, ability, aoeInfo, o.angle||0, o._id||null);
                if (o.aoeHidden && _placed) {
                    const _ac = _placed.findOne('.aoe-circle');
                    if (_ac) { _ac.visible(false); _placed.setAttr('_aoeHidden', true); }
                    S._aoeHiddenMap[((_placed.getAttr('_agentUuid')||'')+'_'+(_placed.getAttr('_slot')||''))] = true;
                }
                if (_placed && o.bounceEnabled === false) {
                    _placed.setAttr('_bounceEnabled', false);
                    _placed.findOne('.aoe-bounce')?.destroy();
                    const _ab = _placed.findOne('.aoe-body'), _rh = _placed.findOne('.rot-handle'), _lp = _placed.getAttr('_lenPx');
                    if (_ab) _ab.width(_lp); if (_rh) _rh.x(_lp);
                }
            }
            S.selectedAgent = prevSel;
        }
    }
    S.currentColor = prevColor;
    S._restoring = false;
    window._agentsExports?._reorderAgentsToTop?.();
    S.paintLayer.batchDraw();
}

export function clearBoardSilent() {
    S.drawLayer.destroyChildren();
    S.paintLayer.destroyChildren();
    S.drawLayer.batchDraw();
    S.paintLayer.batchDraw();
    S._undoStack = []; S._redoStack = [];
    applyAgentFilter();
}

export function getUuidsOnMap() {
    const uuids = new Set();
    S.drawLayer.getChildren().forEach(n => {
        if (n.getAttr('_type') === 'agent') uuids.add(n.getAttr('_agentUuid'));
    });
    return uuids;
}

export function applyAgentFilter() {
    const onMap = S.agentFilter === 'map' ? getUuidsOnMap() : null;
    let anyVisible = false;
    document.querySelectorAll('.agent-thumb').forEach(el => {
        const show = !onMap || onMap.has(el.dataset.uuid);
        el.style.display = show ? '' : 'none';
        if (show) anyVisible = true;
    });
    const scroll = document.getElementById('agentSidebarScroll');
    let empty = scroll.querySelector('.agent-filter-empty');
    if (!anyVisible && S.agentFilter === 'map') {
        if (!empty) {
            empty = document.createElement('div');
            empty.className = 'agent-filter-empty';
            empty.style.cssText = 'font-size:0.48rem;font-weight:700;color:var(--text-muted);text-align:center;padding:12px 0;letter-spacing:0.04em;text-transform:uppercase;';
            empty.textContent = 'None';
            scroll.appendChild(empty);
        }
    } else if (empty) {
        empty.remove();
    }
    setTimeout(updateAgentFog, 10);
}

export function updateAgentFog() {
    const sb = document.getElementById('agentSidebarScroll');
    if (!sb) return;
    const atTop    = sb.scrollTop < 4;
    const atBottom = sb.scrollTop + sb.clientHeight >= sb.scrollHeight - 4;
    const fadeSize = '44px';
    let mask;
    if (atTop && atBottom)       mask = 'none';
    else if (atTop)              mask = `linear-gradient(to bottom, black calc(100% - ${fadeSize}), transparent 100%)`;
    else if (atBottom)           mask = `linear-gradient(to top,   black calc(100% - ${fadeSize}), transparent 100%)`;
    else                         mask = `linear-gradient(to bottom, transparent 0%, black ${fadeSize}, black calc(100% - ${fadeSize}), transparent 100%)`;
    sb.style.maskImage = mask;
    sb.style.webkitMaskImage = mask;
}

export function renderAbilityBar(skipAnim = false) {
    const floatPanel = document.getElementById('agentAbilityFloat');
    const bar = document.getElementById('abilityBar');
    if (!S.selectedAgent || S.currentTool !== 'agent') { floatPanel.classList.remove('visible'); return; }
    const portrait = document.getElementById('agentFloatPortrait');
    portrait.style.opacity = '0';
    portrait.style.transition = 'opacity 0.15s ease';
    const newSrc = S.selectedAgent.killfeedPortrait || S.selectedAgent.displayIcon || '';
    if (portrait.src !== newSrc) {
        portrait.onload = () => { portrait.style.opacity = '1'; };
        portrait.src = newSrc;
    } else {
        portrait.style.opacity = '1';
    }
    const SLOT_ORDER = { Ability1:0, Ability2:1, Grenade:2, Ultimate:3 };
    const abilities = S.selectedAgent.abilities
        .filter(a => SLOT_KEY[a.slot])
        .sort((a, b) => (SLOT_ORDER[a.slot] ?? 99) - (SLOT_ORDER[b.slot] ?? 99));
    const isDrag = S.placeMode === 'drag';
    bar.innerHTML = abilities.map((a, i) => {
        const sk = getSlotKey(a.slot);
        const animStyle = skipAnim ? 'animation:none;' : `animation-delay:${i * 0.04}s;`;
        return `
        <div class="ability-slot ${!isDrag && S.selectedAbility?.slot === a.slot ? 'selected' : ''}" data-slot="${a.slot}" onmousedown="onAbilityMouseDown(event,'${a.slot}')" ${isDrag ? '' : `onclick="selectAbility('${a.slot}')"`} title="${a.displayName}" style="${animStyle}">
            ${isDrag ? '' : `<div class="ability-key">${sk}</div>`}
            ${a.displayIcon ? `<img src="${a.displayIcon}">` : `<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:0.9rem;font-weight:900;color:var(--text-muted);">${sk}</div>`}
        </div>`;
    }).join('');
    floatPanel.classList.add('visible');
}

export function selectAgentById(uuid) {
    S.selectedAgent = S.agents.find(a => a.uuid === uuid);
    S.selectedAbility = null;
    document.querySelectorAll('.agent-thumb').forEach(el => el.classList.toggle('selected', el.dataset.uuid === uuid));
    renderAbilityBar();
}

export async function loadMaps() {
    try {
        let data = _cacheGet('vapi_maps');
        if (!data) {
            const res = await fetch('https://valorant-api.com/v1/maps');
            data = (await res.json()).data;
            _cacheSet('vapi_maps', data);
        }
        S.maps = data.filter(m => m.displayIcon && m.tacticalDescription);
        const sel = document.getElementById('mapSelect');
        sel.innerHTML = S.maps.map(m => `<option value="${m.uuid}">${m.displayName}</option>`).join('');
        const grid = document.getElementById('mapPickerDropdown');
        grid.innerHTML = S.maps.map(m => `
            <div class="map-pill" data-uuid="${m.uuid}" onclick="pickMap('${m.uuid}')">
                <div class="map-pill-bg" style="background-image:url('${_proxyImg(m.listViewIcon || m.displayIcon)}')"></div>
                <div class="map-pill-name">${m.displayName}</div>
            </div>`).join('');
        S.maps.forEach(m => { const i = new Image(); i.src = _proxyImg(m.listViewIcon || m.displayIcon); });
        const savedMap = localStorage.getItem('boardLastMap');
        const restored = savedMap && S.maps.find(m => m.uuid === savedMap);
        if (restored) sel.value = savedMap;
        else { const ascent = S.maps.find(m => m.displayName === 'Ascent'); if (ascent) sel.value = ascent.uuid; }
        S._lastMapValue = sel.value;
        syncMapPickerLabel();
        await window._boardOpsExports?.redrawMap?.();
    } catch { document.getElementById('mapPickerLabel').textContent = 'Maps unavailable'; }
}

export async function loadAgents() {
    try {
        let data = _cacheGet('vapi_agents_enUS');
        if (!data) {
            const res = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=en-US');
            data = (await res.json()).data;
            _cacheSet('vapi_agents_enUS', data);
        }
        S.agents = data.sort((a,b) => a.displayName.localeCompare(b.displayName));
        const grid = document.getElementById('agentGrid');
        grid.innerHTML = S.agents.map(a => `
            <div class="agent-thumb" data-uuid="${a.uuid}" onmousedown="onAgentMouseDown(event,'${a.uuid}')" onclick="selectAgent('${a.uuid}')" title="${a.displayName}">
                <img src="${a.displayIconSmall||a.displayIcon}" loading="lazy" alt="${a.displayName}" draggable="false">
            </div>`).join('');
        if (S.agents.length) { S.selectedAgent = S.agents[0]; document.querySelector('.agent-thumb').classList.add('selected'); }
        setTimeout(updateAgentFog, 50);
    } catch { console.warn('Could not load agents'); }
}

export function renderBoardMoments() {
    const el = document.getElementById('boardMomentsList');
    if (!S.boardMoments.length) {
        el.innerHTML = '<div class="panel-empty">No moments yet.<br>Draw something and click <b>+ New</b>.</div>';
        return;
    }
    el.innerHTML = S.boardMoments.map((m, i) => `
        <div class="bmoment-row${m.id === S.activeMomentId ? ' active' : ''}" onclick="loadBoardMoment('${m.id}')">
            <span class="bmoment-label">${m.label}</span>
            <button class="bmoment-del" onclick="event.stopPropagation();deleteBoardMoment('${m.id}')" title="Delete">✕</button>
        </div>`).join('');
}

export async function _applyBoardMoment(id, skipSave = false) {
    const target = S.boardMoments.find(m => m.id === id);
    if (!target) return;
    if (!skipSave && S.activeMomentId) {
        const curr = S.boardMoments.find(m => m.id === S.activeMomentId);
        if (curr) curr.objects = collectObjects();
    }
    clearBoardSilent();
    S.activeMomentId = id;
    await restoreObjects(target.objects || []);
    applyAgentFilter();
    if (target.momentData) await renderMomentDots(target.momentData.playerLocations);
    renderBoardMoments();
}

export async function renderMomentDots(playerLocations) {
    const ATK = '#df5840', DEF = '#22c55e';
    const { attachHandlers, _pushHistory } = window._drawingExports || {};
    const { placeAgent } = window._agentsExports || {};
    const savedColor = S.currentColor;
    for (const entry of playerLocations || []) {
        if (!entry.location) continue;
        const agent = entry.characterId ? S.agents.find(a => a.uuid === entry.characterId) : null;
        S.currentColor = entry.isAttacker ? ATK : DEF;
        const pos = gameToCanvas(entry.location);
        if (agent) {
            await placeAgent(pos, agent);
        } else {
            const g = new Konva.Group({ x: pos.x, y: pos.y });
            g.add(new Konva.Circle({ radius: 22, fill: '#111', stroke: S.currentColor, strokeWidth: 3 }));
            g.setAttr('_type', 'agent'); g.setAttr('_stroke', S.currentColor);
            S.drawLayer.add(g); attachHandlers(g); _pushHistory(g);
        }
    }
    S.currentColor = savedColor;
    S.drawLayer.batchDraw();
}

export async function loadBoardRound() {
    const raw = localStorage.getItem('lphub_board_round');
    if (!raw) return;
    let roundData;
    try { roundData = JSON.parse(raw); } catch { return; }
    localStorage.removeItem('lphub_board_round');

    if (roundData.mapUuid) {
        const sel = document.getElementById('mapSelect');
        if ([...(sel.options)].some(o => o.value === roundData.mapUuid)) {
            sel.value = roundData.mapUuid;
            await window._boardOpsExports?.redrawMap?.();
        }
    }

    S.boardMoments = (roundData.moments || []).map((m, i) => ({
        id:         `pracc_${i}_${Date.now()}`,
        label:      `${m.time}  ${m.isFK ? '⭐ ' : ''}${m.killerName} → ${m.victimName}`,
        momentData: { playerLocations: m.playerLocations },
        objects:    [],
    }));
    S.activeMomentId = S.boardMoments[0]?.id || null;
    renderBoardMoments();
    if (S.activeMomentId) await _applyBoardMoment(S.activeMomentId, true);
}

export function flipNode(node) {
    const cls = node.getClassName();
    if (cls === 'Transformer') return;
    if (cls === 'Arrow' || cls === 'Line') {
        const pts = node.points(), nx = node.x(), ny = node.y(), newPts = [];
        for (let i = 0; i < pts.length; i += 2) {
            newPts.push(S.W - (nx + pts[i]), S.H - (ny + pts[i + 1]));
        }
        node.x(0); node.y(0); node.points(newPts);
    } else if (cls === 'Group') {
        const t = node.getAttr('_type');
        if (t === 'move-path') {
            const line = node.getChildren().find(c => c instanceof Konva.Line);
            if (line) {
                const pts = line.points(), newPts = [];
                for (let i = 0; i < pts.length; i += 2) newPts.push(S.W - pts[i], S.H - pts[i + 1]);
                _updateMoveGroup(node, newPts);
            }
        } else if (t === 'vision') {
            node.x(S.W - node.x());
            node.y(S.H - node.y());
            node.setAttr('_direction', (node.getAttr('_direction') || 0) + Math.PI);
        } else if (t === 'map-paint') {
            node.setAttr('_shapeX', S.W - node.getAttr('_shapeX'));
            node.setAttr('_shapeY', S.H - node.getAttr('_shapeY'));
        } else {
            node.x(S.W - node.x());
            node.y(S.H - node.y());
            if (t === 'ability') node.rotation(node.rotation() + 180);
        }
    } else {
        node.x(S.W - node.x());
        node.y(S.H - node.y());
    }
}
