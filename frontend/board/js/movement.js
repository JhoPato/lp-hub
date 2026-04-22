import { S } from './state.js';
import { MOVE_SPEEDS, STIM_RADIUS_M, STIM_BUFF, STIM_DURATION, STIM_BORDER_COLOR, _MOVE_IMGS } from './constants.js';
import { m2px } from './utils.js';

export function _px2m(px) {
    const sel = document.getElementById('mapSelect');
    const meta = S.maps.find(x => x.uuid === sel?.value);
    const xm = meta?.xMultiplier || 0.0000566;
    return px / (100 * xm * (S.mapDisplayW || S.W));
}

export function _pathLengthPx(pts) {
    let len = 0;
    for (let i = 2; i < pts.length; i += 2) {
        const dx = pts[i] - pts[i-2], dy = pts[i+1] - pts[i-1];
        len += Math.sqrt(dx*dx + dy*dy);
    }
    return len;
}

export function _moveTime(pts, speedKey) {
    return _px2m(_pathLengthPx(pts)) / (MOVE_SPEEDS[speedKey] || 5.40);
}

export function _getStimPositions() {
    const out = [];
    S.drawLayer?.getChildren().forEach(node => {
        if (node.getAttr('_type') !== 'ability') return;
        if (node.getAttr('_abilityName') !== 'Stim Beacon') return;
        out.push({ x: node.x(), y: node.y(), rPx: m2px(STIM_RADIUS_M) });
    });
    return out;
}

export function _isStimAffected(pts, stimPos) {
    if (!stimPos?.length) return false;
    for (let i = 0; i < pts.length; i += 2) {
        for (const s of stimPos) {
            const dx = pts[i] - s.x, dy = pts[i + 1] - s.y;
            if (dx * dx + dy * dy <= s.rPx * s.rPx) return true;
        }
    }
    return false;
}

export function _moveTimeStim(pts, speedKey, stimPos) {
    const base = MOVE_SPEEDS[speedKey] || 5.40;
    const buff = base * (1 + STIM_BUFF);
    let total = 0, buffDistLeft = 0;
    for (let i = 2; i < pts.length; i += 2) {
        const dx = pts[i] - pts[i-2], dy = pts[i+1] - pts[i-1];
        const segM = _px2m(Math.sqrt(dx*dx + dy*dy));
        const midX = (pts[i] + pts[i-2]) / 2, midY = (pts[i+1] + pts[i-1]) / 2;
        const inAoe = stimPos.some(s => (midX-s.x)**2 + (midY-s.y)**2 <= s.rPx*s.rPx);
        if (inAoe) {
            total += segM / buff;
            buffDistLeft = STIM_DURATION * buff;
        } else if (buffDistLeft > 0) {
            if (segM <= buffDistLeft) { total += segM / buff; buffDistLeft -= segM; }
            else { total += buffDistLeft / buff + (segM - buffDistLeft) / base; buffDistLeft = 0; }
        } else {
            total += segM / base;
        }
    }
    return total;
}

export function _stimAffectedPts(pts, speedKey, stimPos) {
    if (!stimPos?.length || pts.length < 4) return [];
    const n = pts.length / 2;
    const base = MOVE_SPEEDS[speedKey] || 5.40;
    const buffSpd = base * (1 + STIM_BUFF);
    const ptInAoe = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
        ptInAoe[i] = stimPos.some(s => { const dx=pts[i*2]-s.x, dy=pts[i*2+1]-s.y; return dx*dx+dy*dy<=s.rPx*s.rPx; });
    }
    const ptAffected = [...ptInAoe];
    let buffLeft = 0;
    for (let i = 1; i < n; i++) {
        const dx=pts[i*2]-pts[i*2-2], dy=pts[i*2+1]-pts[i*2-1];
        const segM = _px2m(Math.sqrt(dx*dx+dy*dy));
        if (ptInAoe[i]) { buffLeft = STIM_DURATION * buffSpd; }
        else if (buffLeft > 0) { ptAffected[i] = true; buffLeft = Math.max(0, buffLeft - segM); }
    }
    const segs = [];
    let seg = null;
    for (let i = 0; i < n; i++) {
        if (ptAffected[i]) {
            if (!seg) seg = i > 0 ? [pts[(i-1)*2], pts[(i-1)*2+1], pts[i*2], pts[i*2+1]] : [pts[0], pts[1]];
            else seg.push(pts[i*2], pts[i*2+1]);
        } else if (seg) {
            seg.push(pts[i*2], pts[i*2+1]);
            if (seg.length >= 4) segs.push(seg);
            seg = null;
        }
    }
    if (seg && seg.length >= 4) segs.push(seg);
    return segs;
}

export function _buildStimLayers(pts, speedKey, stimPos, dashed) {
    const grp = new Konva.Group({ name: 'stim-layers' });
    const dp = dashed ? [10, 7] : undefined;
    for (const sp of _stimAffectedPts(pts, speedKey, stimPos)) {
        if (sp.length < 4) continue;
        grp.add(new Konva.Line({ points:sp, stroke:STIM_BORDER_COLOR, strokeWidth:14, lineCap:'round', lineJoin:'round', tension:0.3, dash:dp, opacity:0.18 }));
        grp.add(new Konva.Line({ points:sp, stroke:STIM_BORDER_COLOR, strokeWidth:5,  lineCap:'round', lineJoin:'round', tension:0.3, dash:dp, opacity:0.85 }));
    }
    return grp;
}

export function _rebuildAllMovePaths() {
    const stimPos = _getStimPositions();
    S.drawLayer?.getChildren().forEach(node => {
        if (node.getAttr('_type') !== 'move-path') return;
        const line = node.getChildren().find(c => c instanceof Konva.Line);
        if (!line) return;
        const pts = line.points();
        const spd = node.getAttr('_moveSpeed');
        const stroke = node.getAttr('_stroke');
        const dashed = node.getAttr('_moveDash');
        const affected = _isStimAffected(pts, stimPos);
        node.findOne('.stim-layers')?.destroy();
        if (affected) {
            const sl = _buildStimLayers(pts, spd, stimPos, dashed);
            node.add(sl); sl.moveToBottom(); line.moveToTop();
        }
        const oldLbl = node.getChildren().find(c => c.getAttr?.('_type') === 'time-label');
        if (oldLbl) oldLbl.destroy();
        if (pts.length >= 4) {
            const t = affected ? _moveTimeStim(pts, spd, stimPos) : _moveTime(pts, spd);
            node.add(_buildMoveLabel(pts[pts.length-2], pts[pts.length-1], t, stroke, spd));
        }
    });
    S.drawLayer?.batchDraw();
}

export function _buildMoveLabel(endX, endY, seconds, stroke, speedKey) {
    const g = new Konva.Group({ x: endX, y: endY });
    g.setAttr('_type', 'time-label');
    const iconSize = 14, iconPad = 4;
    const txt = new Konva.Text({ text: seconds.toFixed(1) + 's', fontSize: 13, fontFamily: 'Inter, sans-serif', fontStyle: 'bold', fill: '#fff' });
    const tw = iconSize + iconPad + txt.width() + 14, th = Math.max(txt.height(), iconSize) + 6;
    const bg = new Konva.Rect({ x: -tw/2, y: -th/2, width: tw, height: th, fill: stroke, cornerRadius: 4, opacity: 0.92 });
    const ix = -tw/2 + 6, iy = -iconSize/2;
    const imgEl = _MOVE_IMGS[speedKey];
    if (imgEl) {
        const icon = new Konva.Image({ image: imgEl, x: ix, y: iy, width: iconSize, height: iconSize });
        g.add(bg, icon);
    } else {
        g.add(bg);
    }
    txt.x(ix + iconSize + iconPad); txt.y(-txt.height()/2);
    g.add(txt);
    return g;
}

export function _buildMoveGroup(pts, speedKey, stroke, dashed) {
    const g = new Konva.Group();
    g.setAttr('_type', 'move-path');
    g.setAttr('_moveSpeed', speedKey);
    g.setAttr('_stroke', stroke);
    g.setAttr('_moveDash', dashed);
    const stimPos = _getStimPositions();
    const affected = pts.length >= 4 && _isStimAffected(pts, stimPos);
    if (affected) { const sl = _buildStimLayers(pts, speedKey, stimPos, dashed); g.add(sl); }
    const line = new Konva.Line({
        points: pts, stroke, strokeWidth: 3, hitStrokeWidth: 10,
        lineCap: 'round', lineJoin: 'round', tension: 0.3,
        dash: dashed ? [10, 7] : undefined,
    });
    g.add(line);
    if (pts.length >= 4) {
        const t = affected ? _moveTimeStim(pts, speedKey, stimPos) : _moveTime(pts, speedKey);
        g.add(_buildMoveLabel(pts[pts.length-2], pts[pts.length-1], t, stroke, speedKey));
    }
    return g;
}

export function _updateMoveGroup(g, pts) {
    const stimPos = _getStimPositions();
    const affected = pts.length >= 4 && _isStimAffected(pts, stimPos);
    g.findOne('.stim-layers')?.destroy();
    if (affected) {
        const sl = _buildStimLayers(pts, g.getAttr('_moveSpeed'), stimPos, g.getAttr('_moveDash'));
        g.add(sl); sl.moveToBottom();
    }
    const line = g.getChildren().find(c => c instanceof Konva.Line);
    if (line) { line.points(pts); line.moveToTop(); }
    const old = g.getChildren().find(c => c.getAttr?.('_type') === 'time-label');
    if (old) old.destroy();
    if (pts.length >= 4) {
        const spd = g.getAttr('_moveSpeed');
        const t = affected ? _moveTimeStim(pts, spd, stimPos) : _moveTime(pts, spd);
        g.add(_buildMoveLabel(pts[pts.length-2], pts[pts.length-1], t, g.getAttr('_stroke'), spd));
    }
}
