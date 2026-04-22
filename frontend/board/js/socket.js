import { S } from './state.js';
import { getCanvasPos } from './utils.js';
import { _buildVisionCone, _addVisionHandle, _tryAttachVisionToAgent, _castVisionCone, _refreshAnnihilationBounce } from './vision.js';
import { _updateMoveGroup } from './movement.js';

export function initSocket() {
    const _roomCode = new URLSearchParams(window.location.search).get('room');
    if (!_roomCode) return;

    let _socket = null;
    let _skipEmit = false;
    const _remoteCursors = {};

    function _ensureId(shape) {
        if (!shape.getAttr('_id')) shape.setAttr('_id', Math.random().toString(36).slice(2, 11));
    }

    const _origCollect = window.collectObjects;
    if (_origCollect) {
        window.collectObjects = function() {
            const objs = _origCollect();
            objs.forEach(o => {
            });
            return objs;
        };
    }

    function _mox() { return S.W / 2 - S.mapDisplayW / 2; }
    function _moy() { return S.H / 2 - S.mapDisplayH / 2; }
    function _nx(v) { return (v - _mox()) / S.mapDisplayW; }
    function _ny(v) { return (v - _moy()) / S.mapDisplayH; }
    function _dx(nv) { return nv * S.mapDisplayW + _mox(); }
    function _dy(nv) { return nv * S.mapDisplayH + _moy(); }
    function _npts(pts) { return pts.map((v, i) => i % 2 === 0 ? _nx(v) : _ny(v)); }
    function _dpts(pts) { return pts.map((v, i) => i % 2 === 0 ? _dx(v) : _dy(v)); }
    function _nAoi(str) {
        if (!str) return str;
        const a = JSON.parse(str), ref = Math.min(S.mapDisplayW, S.mapDisplayH);
        if (a.radius != null)     a.radius     /= ref;
        if (a.length != null)     a.length     /= S.mapDisplayW;
        if (a.castOffset != null) a.castOffset /= S.mapDisplayW;
        if (a.minLen != null)     a.minLen     /= S.mapDisplayW;
        if (a.maxLen != null)     a.maxLen     /= S.mapDisplayW;
        if (a.pathPoints != null) a.pathPoints = a.pathPoints.map((v, i) => i % 2 === 0 ? v / S.mapDisplayW : v / S.mapDisplayH);
        return JSON.stringify(a);
    }
    function _dAoi(str) {
        if (!str) return str;
        const a = JSON.parse(str), ref = Math.min(S.mapDisplayW, S.mapDisplayH);
        if (a.radius != null)     a.radius     *= ref;
        if (a.length != null)     a.length     *= S.mapDisplayW;
        if (a.castOffset != null) a.castOffset *= S.mapDisplayW;
        if (a.minLen != null)     a.minLen     *= S.mapDisplayW;
        if (a.maxLen != null)     a.maxLen     *= S.mapDisplayW;
        if (a.pathPoints != null) a.pathPoints = a.pathPoints.map((v, i) => i % 2 === 0 ? v * S.mapDisplayW : v * S.mapDisplayH);
        return JSON.stringify(a);
    }

    function _detectLineStyle(node) {
        return window._boardOpsExports?._detectLineStyle?.(node) ?? 'solid';
    }

    function _serializeNode(node) {
        if (!S.mapDisplayW || !S.mapDisplayH) return null;
        const cls = node.getClassName();
        const a = node.attrs;
        const base = { _id: node.getAttr('_id'), _norm: true };
        if (cls === 'Arrow') { const ox=a.x||0,oy=a.y||0; const ap=(a.points||[]).map((v,i)=>i%2===0?v+ox:v+oy); return { ...base, type:'arrow', points:_npts(ap), stroke:a.stroke, strokeWidth:a.strokeWidth, fill:a.fill, tension:a.tension||0, pointerLength:a.pointerLength, pointerWidth:a.pointerWidth, lineStyle:_detectLineStyle(node), opacity:node.opacity() }; }
        if (cls === 'Line')  { const ox=a.x||0,oy=a.y||0; const ap=(a.points||[]).map((v,i)=>i%2===0?v+ox:v+oy); return { ...base, type:'line', points:_npts(ap), stroke:a.stroke, strokeWidth:a.strokeWidth, tension:a.tension||0, lineStyle:_detectLineStyle(node), opacity:node.opacity() }; }
        if (cls === 'Circle') return { ...base, type:'circle', x:_nx(a.x||0), y:_ny(a.y||0), radius:a.radius/Math.min(S.mapDisplayW,S.mapDisplayH), stroke:a.stroke, strokeWidth:a.strokeWidth, fill:a.fill };
        if (cls === 'Rect')   return { ...base, type:'rect',   x:_nx(a.x||0), y:_ny(a.y||0), width:a.width/S.mapDisplayW, height:a.height/S.mapDisplayH, stroke:a.stroke, strokeWidth:a.strokeWidth, fill:a.fill };
        if (cls === 'Text')   return { ...base, type:'text',   x:_nx(a.x||0), y:_ny(a.y||0), text:a.text, fontSize:a.fontSize, fill:a.fill };
        if (cls === 'Group') {
            const t = node.getAttr('_type');
            if (t === 'agent')     return { ...base, type:'agent',   x:_nx(a.x||0), y:_ny(a.y||0), agentUuid:node.getAttr('_agentUuid'), stroke:node.getAttr('_stroke') };
            if (t === 'ability')   return { ...base, type:'ability',  x:_nx(a.x||0), y:_ny(a.y||0), angle:node.rotation(), agentUuid:node.getAttr('_agentUuid'), slot:node.getAttr('_slot'), stroke:node.getAttr('_stroke'), aoeInfo:_nAoi(node.getAttr('_aoeInfo')), aoeHidden:node.getAttr('_aoeHidden')||false, bounceEnabled:node.getAttr('_bounceEnabled') };
            if (t === 'text')      return { ...base, type:'text', x:_nx(a.x||0), y:_ny(a.y||0), runs:node.getAttr('_runs'), textFont:node.getAttr('_textFont'), textSize:node.getAttr('_textSize'), textOpacity:node.getAttr('_textOpacity'), fill:node.getAttr('_textColor') };
            if (t === 'move-path') { const ln = node.getChildren().find(c => c instanceof Konva.Line); if (ln) { const ox=a.x||0,oy=a.y||0; const ap=(ln.points()||[]).map((v,i)=>i%2===0?v+ox:v+oy); return { ...base, type:'move-path', points:_npts(ap), speed:node.getAttr('_moveSpeed'), stroke:node.getAttr('_stroke'), dash:node.getAttr('_moveDash') }; } }
            if (t === 'vision') return { ...base, type:'vision', x:_nx(a.x||0), y:_ny(a.y||0), radius:(node.getAttr('_radius')||200) / Math.min(S.mapDisplayW, S.mapDisplayH), direction:node.getAttr('_direction')||0, coneAngle:node.getAttr('_coneAngle')||S.visionConeAngle, stroke:node.getAttr('_stroke') };
            if (t === 'marker-icon') return { ...base, type:'marker-icon', x:_nx(a.x||0), y:_ny(a.y||0), iconKey:node.getAttr('_iconKey'), stroke:node.getAttr('_stroke') };
            if (t === 'pencil-arrow') { const ln = node.getChildren().find(c => c.name() === '_stroke'); if (ln) { const ox=a.x||0,oy=a.y||0; const ap=(ln.points()||[]).map((v,i)=>i%2===0?v+ox:v+oy); return { ...base, type:'pencil-arrow', points:_npts(ap), stroke:ln.stroke(), strokeWidth:ln.strokeWidth(), opacity:node.opacity() }; } }
            if (t === 'map-paint') return { ...base, type:'map-paint', shapeType:node.getAttr('_shapeType'), x:_nx(node.getAttr('_shapeX')||0), y:_ny(node.getAttr('_shapeY')||0), w:node.getAttr('_shapeW') != null ? node.getAttr('_shapeW')/S.mapDisplayW : null, h:node.getAttr('_shapeH') != null ? node.getAttr('_shapeH')/S.mapDisplayH : null, r:node.getAttr('_shapeR') != null ? node.getAttr('_shapeR')/Math.min(S.mapDisplayW,S.mapDisplayH) : null, stroke:node.getAttr('_stroke'), fillOpacity:node.getAttr('_fillOpacity') };
            if (t === 'textbox') { const bw = node.getAttr('_boxWidth')||240; return { ...base, type:'textbox', x:_nx(a.x||0), y:_ny(a.y||0), text:node.getAttr('_text')||'', textFont:node.getAttr('_textFont'), textSize:node.getAttr('_textSize'), textColor:node.getAttr('_textColor'), textBold:node.getAttr('_textBold'), textItalic:node.getAttr('_textItalic'), textAlign:node.getAttr('_textAlign')||'left', textShadow:node.getAttr('_textShadow')||false, textOpacity:node.getAttr('_textOpacity')??1, hasBg:node.getAttr('_hasBg')||false, bgColor:node.getAttr('_bgColor'), bgOpacity:node.getAttr('_bgOpacity')??0.88, hasBorder:node.getAttr('_hasBorder')||false, borderColor:node.getAttr('_borderColor'), hasStroke:node.getAttr('_hasStroke')||false, strokeColor:node.getAttr('_strokeColor'), boxWidth:bw/S.mapDisplayW }; }
        }
        return null;
    }

    function _denormalize(o) {
        if (!o._norm) return o;
        const d = { ...o };
        d._norm = false;
        if (d.x != null) d.x = _dx(d.x);
        if (d.y != null) d.y = _dy(d.y);
        if (d.points) d.points = _dpts(d.points);
        if (d.radius != null) d.radius = d.radius * Math.min(S.mapDisplayW, S.mapDisplayH);
        if (d.width  != null) d.width  = d.width  * S.mapDisplayW;
        if (d.height != null) d.height = d.height * S.mapDisplayH;
        if (d.aoeInfo) d.aoeInfo = _dAoi(d.aoeInfo);
        if (d.type === 'map-paint') {
            if (d.w != null) d.w = d.w * S.mapDisplayW;
            if (d.h != null) d.h = d.h * S.mapDisplayH;
            if (d.r != null) d.r = d.r * Math.min(S.mapDisplayW, S.mapDisplayH);
        }
        if (d.type === 'textbox' && d.boxWidth != null) d.boxWidth = d.boxWidth * S.mapDisplayW;
        return d;
    }

    function _mpEmit(event, data) {
        if (_skipEmit || !_socket) return;
        _socket.emit(event, data);
    }

    function _renderPresence(participants) {
        const bar = document.getElementById('presenceBar');
        const avatars = document.getElementById('presenceAvatars');
        const label = document.getElementById('roomCodeLabel');
        bar.style.display = 'flex';
        label.textContent = _roomCode;
        label.dataset.code = _roomCode;
        participants.forEach(p => { _participantColors[p.socketId] = p.color; });
        avatars.innerHTML = participants.map(p =>
            `<div id="av-${p.socketId}" title="${p.username||''}" style="width:12px;height:12px;border-radius:50%;background:${p.color};box-shadow:0 0 0 2px rgba(255,255,255,0.15);"></div>`
        ).join('');
    }

    const _participantColors = {};

    function _upsertCursor(socketId, x, y, color, dragging) {
        const container = document.querySelector('.board-main') || document.body;
        let el = _remoteCursors[socketId];
        if (!el) {
            el = document.createElement('div');
            el.className = 'remote-cursor';
            el.style.color = color;
            el.innerHTML = `<svg width="16" height="20" viewBox="0 0 16 20" fill="none"><path d="M0 0L0 16L4.5 12L7 18L9 17L6.5 11L12 11Z" fill="${color}" stroke="rgba(0,0,0,0.6)" stroke-width="0.8"/></svg>`;
            container.appendChild(el);
            _remoteCursors[socketId] = el;
        }
        el.style.left = x + 'px';
        el.style.top  = y + 'px';
        el.classList.toggle('dragging', !!dragging);
    }

    function _removeCursor(socketId) {
        const el = _remoteCursors[socketId];
        if (el) { el.remove(); delete _remoteCursors[socketId]; }
    }

    async function _applyRemoteEl(data) {
        const id = data._id || data.id;
        if (id) {
            const exists = S.drawLayer.getChildren().some(n => n.getAttr('_id') === id)
                        || S.paintLayer.getChildren().some(n => n.getAttr('_id') === id);
            if (exists) return;
        }
        _skipEmit = true;
        try { await window._boardOpsExports?.restoreObjects?.([_denormalize(data)]); } finally { _skipEmit = false; }
    }

    const token = localStorage.getItem('lp_hub_token');
    _socket = io({ auth: { token } });
    window._mpSocket = _socket;
    _socket.on('disconnect', () => { _pendingEmit.clear(); window._mpSocket = null; });
    _socket.on('connect',    () => { window._mpSocket = _socket; });

    let _hasJoined = false;
    let _isReconnect = false;
    _socket.on('connect', () => {
        if (_hasJoined) {
            _isReconnect = true;
            _socket.emit('session:join', { roomCode: _roomCode });
        } else {
            _hasJoined = true;
            _isReconnect = false;
            _socket.emit('session:join', { roomCode: _roomCode });
        }
    });
    _socket.on('disconnect', () => { _hasJoined = false; });

    _socket.on('session:error', (msg) => {
        alert('Session error: ' + msg);
        window.location.href = '/manager/strategies.html';
    });

    _socket.on('session:state', async ({ state, participants, isHost }) => {
        _renderPresence(participants);
        const activeIds = new Set(participants.map(p => p.socketId));
        Object.keys(_remoteAgentSel).forEach(sid => { if (!activeIds.has(sid)) delete _remoteAgentSel[sid]; });

        const boardHasContent = S.drawLayer.getChildren().length > 0 || S.paintLayer.getChildren().length > 0;

        if (isHost && _isReconnect) {
            _isReconnect = false;
            const currentMap = document.getElementById('mapSelect').value;
            _socket.emit('board:init', {
                mapUuid: currentMap || null,
                side: S.currentSide,
                objects: window.collectObjects(),
            });
            if (S.selectedAgent?.uuid) {
                _remoteAgentSel[_socket.id] = S.selectedAgent.uuid;
                _refreshAgentBorders();
                _mpEmit('agent:select', { agentUuid: S.selectedAgent.uuid });
            }
            return;
        }

        if (isHost && !state.objects?.length && boardHasContent) {
            _isReconnect = false;
            const currentMap = document.getElementById('mapSelect').value;
            _socket.emit('board:init', {
                mapUuid: currentMap || null,
                side: S.currentSide,
                objects: window.collectObjects(),
            });
            if (S.selectedAgent?.uuid) {
                _remoteAgentSel[_socket.id] = S.selectedAgent.uuid;
                _refreshAgentBorders();
                _mpEmit('agent:select', { agentUuid: S.selectedAgent.uuid });
            }
            return;
        }

        _isReconnect = false;
        _skipEmit = true; window._boardOpsExports?.clearBoardSilent?.(); _skipEmit = false;
        if (state.mapUuid) {
            document.getElementById('mapSelect').value = state.mapUuid;
            if (typeof window.syncMapPickerLabel === 'function') window.syncMapPickerLabel();
            await window._boardOpsExports?.redrawMap?.();
        }
        if (state.side && state.side !== S.currentSide) {
            _skipEmit = true;
            await window.setSide(state.side);
            _skipEmit = false;
        }
        if (state.objects?.length) {
            _skipEmit = true;
            try { await window._boardOpsExports?.restoreObjects?.(state.objects.map(o => _denormalize(o))); } finally { _skipEmit = false; }
        }
        if (S.selectedAgent?.uuid) {
            _remoteAgentSel[_socket.id] = S.selectedAgent.uuid;
            _refreshAgentBorders();
            _mpEmit('agent:select', { agentUuid: S.selectedAgent.uuid });
        }
    });

    _socket.on('user:joined', (p) => {
        _participantColors[p.socketId] = p.color;
        const avatars = document.getElementById('presenceAvatars');
        if (avatars) avatars.insertAdjacentHTML('beforeend',
            `<div id="av-${p.socketId}" title="${p.username||''}" style="width:12px;height:12px;border-radius:50%;background:${p.color};box-shadow:0 0 0 2px rgba(255,255,255,0.15);"></div>`
        );
        if (S.selectedAgent?.uuid) _mpEmit('agent:select', { agentUuid: S.selectedAgent.uuid });
    });

    _socket.on('user:left', ({ socketId }) => {
        document.getElementById('av-' + socketId)?.remove();
        _removeCursor(socketId);
    });

    _socket.on('el:add',    async (data) => { await _applyRemoteEl(data); });
    _socket.on('el:delete', ({ id }) => {
        _skipEmit = true;
        S.drawLayer.getChildren().forEach(n => { if (n.getAttr('_id') === id) n.destroy(); });
        S.paintLayer.getChildren().forEach(n => { if (n.getAttr('_id') === id) { n.destroy(); S.paintLayer.batchDraw(); } });
        _skipEmit = false;
        S.drawLayer.batchDraw();
    });
    const _draggingMap = {};
    const _elOrigOpacity = {};
    _socket.on('el:move', ({ id, x, y, dragging, socketId }) => {
        S.drawLayer.getChildren().forEach(n => {
            if (n.getAttr('_id') !== id) return;
            n.x(_dx(x)); n.y(_dy(y));
            if (n.getAttr('_type') === 'agent') {
                const visionId = n.getAttr('_visionId');
                if (visionId) {
                    const vg = S.drawLayer.getChildren().find(c => c.getAttr('_id') === visionId);
                    if (vg) {
                        vg.x(n.x()); vg.y(n.y());
                        const poly = vg.getChildren().find(c => c instanceof Konva.Line);
                        const _nAbs = n.getAbsolutePosition();
                        if (poly) poly.points(_castVisionCone(_nAbs.x, _nAbs.y, S._VISION_RADIUS, vg.getAttr('_direction')||0, vg.getAttr('_coneAngle')||S.visionConeAngle, 360));
                    }
                }
            }
            if (dragging) {
                if (_elOrigOpacity[id] === undefined) _elOrigOpacity[id] = n.opacity();
                n.opacity(0.4);
            } else if (_elOrigOpacity[id] !== undefined) {
                n.opacity(_elOrigOpacity[id]);
                delete _elOrigOpacity[id];
            }
        });
        S.drawLayer.batchDraw();
        if (socketId !== undefined) _draggingMap[socketId] = !!dragging;
    });
    _socket.on('side:change', ({ side }) => {
        _skipEmit = true; window.setSide(side); _skipEmit = false;
    });
    _socket.on('map:change', async ({ mapUuid }) => {
        _skipEmit = true;
        document.getElementById('mapSelect').value = mapUuid;
        if (typeof window.syncMapPickerLabel === 'function') window.syncMapPickerLabel();
        window._boardOpsExports?.clearBoardSilent?.();
        await window._boardOpsExports?.redrawMap?.();
        _skipEmit = false;
    });
    _socket.on('board:clear', () => {
        _skipEmit = true; window._boardOpsExports?.clearBoardSilent?.(); _skipEmit = false;
    });
    _socket.on('cursor:move', ({ socketId, x, y }) => {
        const color = _participantColors[socketId] || '#fff';
        _upsertCursor(socketId, _dx(x), _dy(y), color, _draggingMap[socketId]);
    });

    window.addEventListener('_el:changing', (e) => {
        const data = _serializeNode(e.detail);
        if (data) _mpEmit('el:update', { ...data, dragging: true });
    });

    window.addEventListener('_el:changed', (e) => {
        const data = _serializeNode(e.detail);
        if (data) _mpEmit('el:update', { ...data, dragging: false });
    });

    window.addEventListener('_el:deleted', (e) => {
        const id = e.detail?.getAttr?.('_id');
        if (id && !_skipEmit && _socket) _mpEmit('el:delete', { id });
    });

    window.addEventListener('_el:restored', (e) => {
        if (_skipEmit || !_socket) return;
        const data = _serializeNode(e.detail);
        if (data) _mpEmit('el:add', data);
    });

    _socket.on('el:update', async ({ dragging, ...data }) => {
        if (dragging) {
            const n = S.drawLayer.getChildren().find(c => c.getAttr('_id') === data._id);
            if (!n) return;
            if (data.points && (data.type === 'arrow' || data.type === 'line')) {
                const pts = _dpts(data.points);
                n.x(0); n.y(0); n.points(pts);
            } else if (data.points && data.type === 'move-path') {
                const pts = _dpts(data.points);
                n.x(0); n.y(0); _updateMoveGroup(n, pts);
            } else if (data.angle != null) {
                n.rotation(data.angle);
                const ig = n.findOne('.icon-grp'); if (ig) ig.rotation(-data.angle);
                if (n.getAttr('_abilityName') === 'Annihilation') _refreshAnnihilationBounce(n);
            } else if (data.aoeInfo) {
                const rawAoi = _dAoi(data.aoeInfo);
                const aoi = JSON.parse(rawAoi);
                n.setAttr('_aoeInfo', rawAoi);
                const co = aoi.castOffset || 0;
                const len = aoi.length || 0;
                const body = n.findOne('.aoe-body');
                if (body) {
                    if (aoi.type === 'line') body.points([co, 0, co + len, 0]);
                    else if ((aoi.type === 'blaze' || aoi.type === 'high-tide') && aoi.pathPoints?.length >= 4) body.points(aoi.pathPoints);
                    else if ((aoi.type === 'blaze' || aoi.type === 'high-tide') && aoi.straight) body.points([0, 0, len, 0]);
                    else body.width(len);
                }
                if (aoi.type === 'cone') {
                    const fov = n.findOne('.cone-fov');
                    if (fov) { fov.visible(aoi.fovVisible !== false); if (aoi.fovVisible !== false) window._visionExports?._refreshConeFov?.(n); }
                } else if (aoi.type !== 'high-tide' && aoi.type !== 'blaze') {
                    const rh = n.findOne('.rot-handle'); if (rh) rh.x(co + len);
                } else if ((aoi.type === 'blaze' || aoi.type === 'high-tide') && aoi.straight) {
                    const rh = n.findOne('.rot-handle'); if (rh) { rh.x(len); rh.y(0); }
                }
            }
            S.drawLayer.batchDraw();
        } else {
            _skipEmit = true;
            S.drawLayer.getChildren().forEach(n => { if (n.getAttr('_id') === data._id) n.destroy(); });
            _skipEmit = false;
            await _applyRemoteEl(data);
        }
    });

    const _remoteAgentSel = {};
    if (!document.getElementById('_mp-bar-style')) {
        const s = document.createElement('style');
        s.id = '_mp-bar-style';
        s.textContent = '@keyframes mp-bar-in{from{width:0;opacity:0}to{width:4px;opacity:1}}';
        document.head.appendChild(s);
    }

    function _refreshAgentBorders() {
        document.querySelectorAll('.mp-sel-bar').forEach(b => b.remove());
        document.querySelectorAll('.agent-thumb').forEach(el => {
            el.style.borderColor = '';
            el.style.position = '';
        });

        const byAgent = {};
        Object.entries(_remoteAgentSel).forEach(([sid, uuid]) => {
            if (!byAgent[uuid]) byAgent[uuid] = [];
            byAgent[uuid].push(sid);
        });

        Object.entries(byAgent).forEach(([uuid, sids]) => {
            const thumb = document.querySelector(`.agent-thumb[data-uuid="${uuid}"]`);
            if (!thumb) return;

            const isMine = _remoteAgentSel[_socket.id] === uuid;
            const borderColor = isMine
                ? (_participantColors[_socket.id] || '#fff')
                : (_participantColors[sids[0]] || '#fff');
            thumb.style.borderColor = borderColor;

            if (sids.length > 1) {
                const ordered = [...sids].sort(a => a === _socket.id ? -1 : 1);
                const colors = ordered.map(s => _participantColors[s] || '#fff');
                const segH = 100 / colors.length;
                const grad = colors.map((c, i) => `${c} ${i * segH}% ${(i + 1) * segH}%`).join(', ');
                const bar = document.createElement('div');
                bar.className = 'mp-sel-bar';
                bar.style.cssText = `position:absolute;left:3px;top:5px;bottom:5px;width:4px;z-index:2;background:linear-gradient(to bottom,${grad});border-radius:2px;animation:mp-bar-in .25s ease;pointer-events:none;`;
                thumb.style.position = 'relative';
                thumb.insertBefore(bar, thumb.firstChild);
            }
        });
    }

    _socket.on('agent:select', ({ socketId, agentUuid }) => {
        _remoteAgentSel[socketId] = agentUuid;
        _refreshAgentBorders();
    });

    _socket.on('user:left', ({ socketId: sid }) => {
        delete _remoteAgentSel[sid];
        _refreshAgentBorders();
    });

    const _origSelectAgent = window.selectAgent;
    window.selectAgent = function(uuid) {
        _origSelectAgent(uuid);
        _remoteAgentSel[_socket.id] = uuid;
        _refreshAgentBorders();
        _mpEmit('agent:select', { agentUuid: uuid });
    };

    const _previewNodes = {};

    window.__mpPreviewUpdate = function(clientX, clientY, type, uuid, slot) {
        if (!S.mapDisplayW) return;
        const { _clientToWorld } = window._drawingExports || {};
        if (!_clientToWorld) return;
        const pos = _clientToWorld(clientX, clientY);
        const agentUuid = type === 'ability' ? (S.selectedAgent?.uuid) : uuid;
        _mpEmit('preview:move', { x: _nx(pos.x), y: _ny(pos.y), type, agentUuid, slot });
    };

    window.__mpPreviewRemove = function() {
        _mpEmit('preview:remove', {});
    };

    _socket.on('preview:move', ({ socketId, x, y, type, agentUuid, slot }) => {
        const ax = _dx(x), ay = _dy(y);
        const prev = _previewNodes[socketId];
        if (prev) { prev.x(ax); prev.y(ay); S.drawLayer.batchDraw(); return; }
        const color = _participantColors[socketId] || '#fff';
        let node = null;
        if (type === 'agent') {
            const agent = S.agents.find(a => a.uuid === agentUuid);
            if (!agent) return;
            node = new Konva.Group({ x: ax, y: ay, opacity: 0.5, listening: false });
            node.add(new Konva.Circle({ radius: 22, fill: '#111', stroke: color, strokeWidth: 3 }));
            _skipEmit = true; S.drawLayer.add(node); _skipEmit = false;
            _previewNodes[socketId] = node;
            const { loadImg } = window._utils || {};
            (loadImg || window.loadImg)?.(agent.displayIconSmall || agent.displayIcon).then(img => {
                if (!_previewNodes[socketId] || !img) return;
                const r = 19;
                const ig = new Konva.Group({ clipFunc: ctx => ctx.arc(0,0,r,0,Math.PI*2) });
                ig.add(new Konva.Image({ image:img, x:-r, y:-r, width:r*2, height:r*2 }));
                node.add(ig);
                S.drawLayer.batchDraw();
            });
        } else if (type === 'ability') {
            const ag = S.agents.find(a => a.uuid === agentUuid);
            const ability = ag?.abilities.find(a => a.slot === slot);
            if (!ability) return;
            const { getAbilityAoe } = window._utils || {};
            const aoe = (getAbilityAoe || window.getAbilityAoe)?.(ability);
            if (!aoe) return;
            const { buildAoeGroup } = window._agentsExports || {};
            node = buildAoeGroup?.({ x: ax, y: ay }, aoe, 0, color, false);
            if (!node) return;
            node.opacity(0.5);
            node.listening(false);
            _skipEmit = true; S.drawLayer.add(node); _skipEmit = false;
            _previewNodes[socketId] = node;
            if (aoe.type !== 'circle') {
                const { loadImg } = window._utils || {};
                (loadImg || window.loadImg)?.(ability.displayIcon).then(img => {
                    if (!_previewNodes[socketId] || !img) return;
                    const r = 13;
                    const ig = new Konva.Group({ clipFunc: ctx => ctx.arc(0,0,r,0,Math.PI*2) });
                    ig.add(new Konva.Image({ image:img, x:-r, y:-r, width:r*2, height:r*2 }));
                    node.add(ig);
                    S.drawLayer.batchDraw();
                });
            }
        } else if (type === 'vision') {
            const ca = S.visionConeAngle * 180 / Math.PI;
            node = new Konva.Group({ x: ax, y: ay, opacity: 0.5, listening: false });
            node.add(new Konva.Wedge({ radius: 90, angle: ca, fill: color + '44', stroke: color + 'cc', strokeWidth: 1.5, rotation: -ca / 2 }));
            node.add(new Konva.Circle({ radius: 5, fill: color }));
            _skipEmit = true; S.drawLayer.add(node); _skipEmit = false;
            _previewNodes[socketId] = node;
        }
        if (node) S.drawLayer.batchDraw();
    });

    _socket.on('preview:remove', ({ socketId }) => {
        const prev = _previewNodes[socketId];
        if (!prev) return;
        _skipEmit = true; prev.destroy(); _skipEmit = false;
        delete _previewNodes[socketId];
        S.drawLayer.batchDraw();
    });

    _socket.on('user:left', ({ socketId }) => {
        const prev = _previewNodes[socketId];
        if (!prev) return;
        _skipEmit = true; prev.destroy(); _skipEmit = false;
        delete _previewNodes[socketId];
        S.drawLayer.batchDraw();
    });

    const _boardBody = document.querySelector('.board-body') || document.getElementById('board-container');
    if (_boardBody) {
        _boardBody.addEventListener('mousemove', (e) => {
            if (!S.stage) return;
            const pos = getCanvasPos();
            if (pos && S.mapDisplayW) _mpEmit('cursor:move', { x: _nx(pos.x), y: _ny(pos.y) });
        });
    }

    const _pendingEmit = new Set();

    document.addEventListener('pointerup', () => {
        if (_pendingEmit.size === 0) return;
        setTimeout(() => {
            if (_skipEmit) { _pendingEmit.clear(); return; }
            _pendingEmit.forEach(node => {
                if (!node.getLayer()) return;
                const data = _serializeNode(node);
                if (data) _mpEmit('el:add', data);
            });
            _pendingEmit.clear();
        }, 30);
    }, true);

    const _origLayerAdd = S.drawLayer.add.bind(S.drawLayer);
    S.drawLayer.add = function(...nodes) {
        _origLayerAdd(...nodes);
        nodes.forEach(node => {
            _ensureId(node);
            if (!_skipEmit) _pendingEmit.add(node);
            let _lastDrag = 0;
            node.on('dragstart', () => {
                if (_skipEmit) return;
            });
            node.on('dragmove', () => {
                if (_skipEmit) return;
                const now = Date.now();
                if (now - _lastDrag < 33) return;
                _lastDrag = now;
                const cls = node.getClassName();
                const t = node.getAttr('_type');
                if (cls === 'Arrow' || cls === 'Line' || t === 'move-path') {
                    const data = _serializeNode(node);
                    if (data) _mpEmit('el:update', { ...data, dragging: true });
                } else {
                    _mpEmit('el:move', { id: node.getAttr('_id'), x: _nx(node.x()), y: _ny(node.y()), dragging: true });
                }
            });
            node.on('dragend', () => {
                if (_skipEmit) return;
                const cls = node.getClassName();
                const t = node.getAttr('_type');
                if (cls === 'Arrow' || cls === 'Line' || t === 'move-path') {
                    const data = _serializeNode(node);
                    if (data) { _mpEmit('el:update', { ...data, dragging: false }); return; }
                }
                _mpEmit('el:move', { id: node.getAttr('_id'), x: _nx(node.x()), y: _ny(node.y()), dragging: false });
            });
        });
        return this;
    };

    const _origPaintLayerAdd = S.paintLayer.add.bind(S.paintLayer);
    S.paintLayer.add = function(...nodes) {
        _origPaintLayerAdd(...nodes);
        nodes.forEach(node => {
            if (node.getAttr('_type') === 'map-paint') {
                _ensureId(node);
                if (!_skipEmit) _pendingEmit.add(node);
            }
        });
        return this;
    };

    const _origDestroy = Konva.Node.prototype.destroy;
    Konva.Node.prototype.destroy = function(...args) {
        const id = this.getAttr('_id');
        if (id && !_skipEmit && _socket) _mpEmit('el:delete', { id });
        return _origDestroy.apply(this, args);
    };

    const _origSetSide = window.setSide;
    window.setSide = function(s) {
        _origSetSide(s);
        _mpEmit('side:change', { side: s });
    };

    const mapSelect = document.getElementById('mapSelect');
    if (mapSelect) {
        mapSelect.addEventListener('change', () => {
            _mpEmit('map:change', { mapUuid: mapSelect.value });
        });
    }

    const _origClear = window.clearBoard;
    if (_origClear) {
        window.clearBoard = function() {
            _origClear();
            _mpEmit('board:clear');
        };
    }

    let _closeResolve = null;
    window._resolveClose = function(action) {
        document.getElementById('saveBeforeCloseModal').style.display = 'none';
        if (_closeResolve) { _closeResolve(action); _closeResolve = null; }
    };

    function _promptSaveBeforeClose() {
        return new Promise(resolve => {
            _closeResolve = resolve;
            document.getElementById('saveBeforeCloseModal').style.display = 'flex';
        });
    }

    window.addEventListener('beforeunload', (e) => {
        if (_socket) _socket.disconnect();
    });

    document.querySelectorAll('a[href]').forEach(a => {
        a.addEventListener('click', async (e) => {
            e.preventDefault();
            const action = await _promptSaveBeforeClose();
            if (action === 'save') await window.saveStrategy();
            window.location.href = a.href;
        });
    });
}
