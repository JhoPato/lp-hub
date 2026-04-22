import { S } from './state.js';
import { _VG, _VISION_RADIUS, _VISION_HANDLE_DIST, MAP_VISION_PASSTHROUGH, MARKER_ICONS } from './constants.js';

export function _floodFillGrid(igx, igy) {
    if (!S._visionData) return null;
    if (igx < 0 || igy < 0 || igx >= _VG || igy >= _VG) return null;
    if (S._visionData[igy * _VG + igx] === 1) return null;
    const filled = new Uint8Array(_VG * _VG);
    const stack = [igx + igy * _VG];
    while (stack.length) {
        const idx = stack.pop();
        if (filled[idx] || S._visionData[idx] === 1) continue;
        filled[idx] = 1;
        const x = idx % _VG, y = (idx / _VG) | 0;
        if (x > 0)      stack.push(idx - 1);
        if (x < _VG-1)  stack.push(idx + 1);
        if (y > 0)      stack.push(idx - _VG);
        if (y < _VG-1)  stack.push(idx + _VG);
    }
    return filled;
}

export function _fillToCanvas(filled, color, opacity) {
    const vc = document.createElement('canvas');
    vc.width = _VG; vc.height = _VG;
    const ctx = vc.getContext('2d');
    const imgData = ctx.createImageData(_VG, _VG);
    const r = parseInt(color.slice(1,3), 16);
    const g = parseInt(color.slice(3,5), 16);
    const b = parseInt(color.slice(5,7), 16);
    const a = Math.round(opacity * 255);
    for (let i = 0; i < _VG * _VG; i++) {
        if (!filled[i]) continue;
        imgData.data[i*4]   = r;
        imgData.data[i*4+1] = g;
        imgData.data[i*4+2] = b;
        imgData.data[i*4+3] = a;
    }
    ctx.putImageData(imgData, 0, 0);
    return vc;
}

export function _renderMapPaintCanvas(shapeType, x, y, w, h, r, color, opacity) {
    if (!S._visionScale || !S._visionData || !S._mapAlphaFull) return null;
    const vc = document.createElement('canvas');
    vc.width = S.W; vc.height = S.H;
    const ctx = vc.getContext('2d');
    const imgData = ctx.createImageData(S.W, S.H);
    const ri = parseInt(color.slice(1,3), 16) || 0;
    const gi = parseInt(color.slice(3,5), 16) || 0;
    const bi = parseInt(color.slice(5,7), 16) || 0;
    const a = Math.round(opacity * 255);
    const x1r = Math.min(x, x+w), y1r = Math.min(y, y+h), x2r = Math.max(x, x+w), y2r = Math.max(y, y+h);
    for (let cy = 0; cy < S.H; cy++) {
        for (let cx = 0; cx < S.W; cx++) {
            if (!S._mapAlphaFull[cy * S.W + cx]) continue;
            let inside = false;
            if (shapeType === 'rect') {
                inside = cx >= x1r && cx <= x2r && cy >= y1r && cy <= y2r;
            } else {
                const dx = cx - x, dy = cy - y;
                inside = dx*dx + dy*dy <= r*r;
            }
            if (inside) {
                const i = cy * S.W + cx;
                imgData.data[i*4]=ri; imgData.data[i*4+1]=gi; imgData.data[i*4+2]=bi; imgData.data[i*4+3]=a;
            }
        }
    }
    ctx.putImageData(imgData, 0, 0);
    return vc;
}

export function _buildMapPaintGroup(shapeType, x, y, w, h, r, color, opacity) {
    const kImg = new Konva.Image({ width: S.W, height: S.H, listening: false });
    const grp = new Konva.Group({ x: 0, y: 0, draggable: false });
    grp.setAttr('_type', 'map-paint');
    grp.setAttr('_shapeType', shapeType);
    grp.setAttr('_shapeX', x); grp.setAttr('_shapeY', y);
    if (shapeType === 'rect') { grp.setAttr('_shapeW', w); grp.setAttr('_shapeH', h); }
    else { grp.setAttr('_shapeR', r); }
    grp.setAttr('_stroke', color);
    grp.setAttr('_fillOpacity', opacity);
    grp.add(kImg);
    _refreshMapPaint(grp);
    return grp;
}

export function _refreshMapPaint(grp) {
    if (!S._visionScale || !S._visionData) return;
    const t = grp.getAttr('_shapeType'), x = grp.getAttr('_shapeX'), y = grp.getAttr('_shapeY');
    const w = grp.getAttr('_shapeW'), h = grp.getAttr('_shapeH'), r = grp.getAttr('_shapeR');
    const vc = _renderMapPaintCanvas(t, x, y, w, h, r, grp.getAttr('_stroke'), grp.getAttr('_fillOpacity'));
    if (!vc) return;
    const kImg = grp.getChildren()[0];
    if (!kImg) return;
    kImg.image(vc); kImg.width(S.W); kImg.height(S.H);
}

export function _buildVisionGrid(img, dw, dh, rot, mapUuid) {
    const vc = document.createElement('canvas');
    vc.width = _VG; vc.height = _VG;
    const ctx = vc.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, _VG, _VG);
    S._visionScale = _VG / Math.max(dw, dh);
    ctx.save();
    ctx.translate(_VG / 2, _VG / 2);
    ctx.rotate(rot * Math.PI / 180);
    ctx.drawImage(img, -dw * S._visionScale / 2, -dh * S._visionScale / 2, dw * S._visionScale, dh * S._visionScale);
    ctx.restore();
    let id;
    try { id = ctx.getImageData(0, 0, _VG, _VG); } catch(e) { console.warn('Vision grid CORS:', e.message); return; }
    const raw = id.data;
    S._visionData = new Uint8Array(_VG * _VG);
    for (let i = 0; i < _VG * _VG; i++) {
        const lum = raw[i*4] * 0.299 + raw[i*4+1] * 0.587 + raw[i*4+2] * 0.114;
        if (lum < 60) S._visionData[i] = 1;
    }
    const zones = MAP_VISION_PASSTHROUGH[mapUuid] || [];
    zones.forEach(({ cx, cy, r }) => {
        const gx = cx * _VG, gy = cy * _VG, gr = r * _VG;
        const x0 = Math.max(0, (gx - gr) | 0), x1 = Math.min(_VG - 1, Math.ceil(gx + gr));
        const y0 = Math.max(0, (gy - gr) | 0), y1 = Math.min(_VG - 1, Math.ceil(gy + gr));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            if ((x - gx) ** 2 + (y - gy) ** 2 <= gr * gr) S._visionData[y * _VG + x] = 0;
        }
    });
}

export function _buildMapAlphaFull(img, dw, dh, rot) {
    const vc = document.createElement('canvas');
    vc.width = S.W; vc.height = S.H;
    const ctx = vc.getContext('2d');
    ctx.save();
    ctx.translate(S.W / 2, S.H / 2);
    ctx.rotate(rot * Math.PI / 180);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    let id;
    try { id = ctx.getImageData(0, 0, S.W, S.H); } catch(e) { S._mapAlphaFull = null; return; }
    const raw = id.data;
    S._mapAlphaFull = new Uint8Array(S.W * S.H);
    for (let i = 0; i < S.W * S.H; i++) {
        if (raw[i * 4 + 3] > 20) S._mapAlphaFull[i] = 1;
    }
}

export function _s2g(sx, sy) {
    return { x: (sx - S.W / 2) * S._visionScale + _VG / 2, y: (sy - S.H / 2) * S._visionScale + _VG / 2 };
}

export function _isWallAt(gx, gy) {
    if (!S._visionData) return false;
    const ix = Math.round(gx), iy = Math.round(gy);
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            const x = ix + dx, y = iy + dy;
            if (x < 0 || y < 0 || x >= _VG || y >= _VG) return true;
            if (S._visionData[y * _VG + x] === 1) return true;
        }
    }
    return false;
}

// Coarser wall check (3×3) used only while dragging for performance
function _isWallAtFast(gx, gy) {
    if (!S._visionData) return false;
    const ix = Math.round(gx), iy = Math.round(gy);
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const x = ix + dx, y = iy + dy;
            if (x < 0 || y < 0 || x >= _VG || y >= _VG) return true;
            if (S._visionData[y * _VG + x] === 1) return true;
        }
    }
    return false;
}

// Low-res cast used only during active drag (90 rays, step 1.5, 3×3 check)
function _castVisionConeDrag(ox, oy, radius, direction, coneAngle) {
    if (radius < 5) return [0, 0];
    const { x: gox, y: goy } = _s2g(ox, oy);
    const gradius = radius * S._visionScale;
    const half = coneAngle / 2;
    const numRays = 90;
    const pts = [0, 0];
    for (let i = 0; i <= numRays; i++) {
        const angle = direction - half + (i / numRays) * coneAngle;
        const cdx = Math.cos(angle), cdy = Math.sin(angle);
        let r = 0, hitR = gradius;
        while (r < gradius) {
            r += 1.5;
            if (_isWallAtFast(gox + cdx * r, goy + cdy * r)) { hitR = r; break; }
        }
        const px = cdx * hitR / S._visionScale, py = cdy * hitR / S._visionScale;
        pts.push(px, py);
        if (i === (numRays >> 1)) { S._vCenterX = px; S._vCenterY = py; }
    }
    return _simplifyArc(pts, 3.0);
}

export function _dpReduce(pts, s, e, tol, keep) {
    if (e - s < 4) return;
    const sx = pts[s], sy = pts[s+1], ex = pts[e], ey = pts[e+1];
    const len = Math.sqrt((ex-sx)**2 + (ey-sy)**2);
    let maxD = 0, maxI = s;
    for (let i = s+2; i < e; i += 2) {
        const d = len < 0.001
            ? Math.sqrt((pts[i]-sx)**2 + (pts[i+1]-sy)**2)
            : Math.abs((ey-sy)*(pts[i]-sx) - (ex-sx)*(pts[i+1]-sy)) / len;
        if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD >= tol) {
        keep.add(maxI);
        _dpReduce(pts, s, maxI, tol, keep);
        _dpReduce(pts, maxI, e, tol, keep);
    }
}

export function _simplifyArc(pts, tol) {
    if (pts.length < 8) return pts;
    const arcStart = 2, arcEnd = pts.length - 2;
    const keep = new Set([arcStart, arcEnd]);
    _dpReduce(pts, arcStart, arcEnd, tol, keep);
    const sorted = [...keep].sort((a, b) => a - b);
    const out = [pts[0], pts[1]];
    sorted.forEach(i => out.push(pts[i], pts[i+1]));
    return out;
}

export function _castVisionCone(ox, oy, radius, direction, coneAngle, numRays) {
    if (radius < 5) return [0, 0];
    const { x: gox, y: goy } = _s2g(ox, oy);
    const gradius = radius * S._visionScale;
    const half = coneAngle / 2;
    const pts = [0, 0];
    for (let i = 0; i <= numRays; i++) {
        const angle = direction - half + (i / numRays) * coneAngle;
        const cdx = Math.cos(angle), cdy = Math.sin(angle);
        let r = 0, hitR = gradius;
        while (r < gradius) {
            r += 0.7;
            if (_isWallAt(gox + cdx * r, goy + cdy * r)) { hitR = r; break; }
        }
        const px = cdx * hitR / S._visionScale, py = cdy * hitR / S._visionScale;
        pts.push(px, py);
        if (i === (numRays >> 1)) { S._vCenterX = px; S._vCenterY = py; }
    }
    return _simplifyArc(pts, 3.0);
}

export function _castRay(cx, cy, worldAngleRad, maxDistCanvas) {
    if (!S._visionData) return maxDistCanvas;
    const { x: gox, y: goy } = _s2g(cx, cy);
    const gradius = maxDistCanvas * S._visionScale;
    const cdx = Math.cos(worldAngleRad), cdy = Math.sin(worldAngleRad);
    let r = 0;
    while (r < gradius) {
        r += 0.7;
        if (_isWallAt(gox + cdx * r, goy + cdy * r)) return r / S._visionScale;
    }
    return maxDistCanvas;
}

export function _refreshConeFov(g) {
    if (!S._visionData) return;
    const fov = g.findOne('.cone-fov');
    if (!fov || !fov.visible() || !(fov instanceof Konva.Line)) return;
    const raw = g.getAttr('_aoeInfo');
    if (!raw) return;
    const aoi = JSON.parse(raw);
    const waRad = (aoi.coneAngle || 55) * Math.PI / 180;
    const worldAngleRad = g.rotation() * Math.PI / 180;
    const _gAbs = g.getAbsolutePosition();
    const rawPts = _castVisionCone(_gAbs.x, _gAbs.y, aoi.radius, worldAngleRad, waRad, 360);
    const cosA = Math.cos(-worldAngleRad), sinA = Math.sin(-worldAngleRad);
    const localPts = [];
    for (let i = 0; i < rawPts.length; i += 2) {
        const wx = rawPts[i], wy = rawPts[i + 1];
        localPts.push(wx * cosA - wy * sinA, wx * sinA + wy * cosA);
    }
    fov.points(localPts);
    g.getLayer()?.batchDraw();
}

export function _refreshCrossClip(g) {
    const raw = g.getAttr('_aoeInfo');
    if (!raw) return;
    const aoeInfo = JSON.parse(raw);
    if (!aoeInfo.wallClip || !S._visionData) return;
    const half = aoeInfo.length || 60;
    const cx = g.x(), cy = g.y();
    const gRotRad = g.rotation() * Math.PI / 180;
    const LA = [Math.PI / 4, -3 * Math.PI / 4, 3 * Math.PI / 4, -Math.PI / 4];
    const d = LA.map(la => _castRay(cx, cy, gRotRad + la, half));
    const armLines = g.getChildren().filter(c => c.className === 'Line');
    if (armLines.length < 2) return;
    armLines[0].points([d[1] * Math.cos(LA[1]), d[1] * Math.sin(LA[1]), d[0] * Math.cos(LA[0]), d[0] * Math.sin(LA[0])]);
    armLines[1].points([d[2] * Math.cos(LA[2]), d[2] * Math.sin(LA[2]), d[3] * Math.cos(LA[3]), d[3] * Math.sin(LA[3])]);
    g.getLayer()?.batchDraw();
}

export function _castBounce(cx, cy, angleRad, totalLenPx) {
    if (!S._visionData) return null;
    const { x: gox, y: goy } = _s2g(cx, cy);
    const maxDist = totalLenPx * S._visionScale;
    const cdx = Math.cos(angleRad), cdy = Math.sin(angleRad);
    let mapX = Math.floor(gox), mapY = Math.floor(goy);
    const stepX = cdx >= 0 ? 1 : -1, stepY = cdy >= 0 ? 1 : -1;
    const deltaX = cdx !== 0 ? Math.abs(1 / cdx) : Infinity;
    const deltaY = cdy !== 0 ? Math.abs(1 / cdy) : Infinity;
    let sideX = cdx >= 0 ? (mapX + 1 - gox) * deltaX : (gox - mapX) * deltaX;
    let sideY = cdy >= 0 ? (mapY + 1 - goy) * deltaY : (goy - mapY) * deltaY;
    const MIN_DIST = 2.0;
    const _ddaWall = (x, y) => {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x+dx, ny = y+dy;
            if (nx < 0 || ny < 0 || nx >= _VG || ny >= _VG) return true;
            if (S._visionData[ny * _VG + nx] === 1) return true;
        }
        return false;
    };
    let side = 0, hitDist = -1;
    for (let i = 0; i < 3000; i++) {
        let dist;
        if (sideX < sideY) { dist = sideX; sideX += deltaX; mapX += stepX; side = 0; }
        else               { dist = sideY; sideY += deltaY; mapY += stepY; side = 1; }
        if (dist > maxDist) break;
        if (dist < MIN_DIST) continue;
        if (_ddaWall(mapX, mapY)) { hitDist = dist; break; }
    }
    if (hitDist < 0) return null;
    const reflectAngle = side === 0 ? Math.atan2(cdy, -cdx) : Math.atan2(-cdy, cdx);
    const hitDistPx = hitDist / S._visionScale;
    return { hitDistPx, reflectAngle, remainDistPx: totalLenPx - hitDistPx };
}

export function _refreshAnnihilationBounce(g) {
    const totalLenPx = g.getAttr('_lenPx');
    const halfW      = g.getAttr('_halfWPx');
    const color      = g.getAttr('_stroke') || '#ffffff';
    const bounceEnabled = g.getAttr('_bounceEnabled');
    g.findOne('.aoe-bounce')?.destroy();
    const body   = g.findOne('.aoe-body');
    const handle = g.findOne('.rot-handle');
    if (!bounceEnabled || !S._visionData) {
        if (body)   body.width(totalLenPx);
        if (handle) handle.x(totalLenPx);
        return;
    }
    const rotRad = g.rotation() * Math.PI / 180;
    const bounce = _castBounce(g.x(), g.y(), rotRad, totalLenPx);
    if (!bounce) {
        if (body)   body.width(totalLenPx);
        if (handle) handle.x(totalLenPx);
        return;
    }
    if (body)   body.width(bounce.hitDistPx);
    if (handle) handle.x(bounce.hitDistPx);
    const SAFE = 8;
    const bStartX = g.x() + Math.cos(rotRad) * bounce.hitDistPx + Math.cos(bounce.reflectAngle) * SAFE;
    const bStartY = g.y() + Math.sin(rotRad) * bounce.hitDistPx + Math.sin(bounce.reflectAngle) * SAFE;
    const clippedRemain = SAFE + Math.min(bounce.remainDistPx - SAFE, _castRay(bStartX, bStartY, bounce.reflectAngle, bounce.remainDistPx - SAFE));
    if (clippedRemain <= SAFE + 2) return;
    const localAngleDeg = (bounce.reflectAngle - rotRad) * 180 / Math.PI;
    const bg = new Konva.Group({ x: bounce.hitDistPx, y: 0, rotation: localAngleDeg, name: 'aoe-bounce' });
    bg.add(new Konva.Rect({ x: 0, y: -halfW, width: clippedRemain, height: halfW * 2, fill: color + '28', stroke: color, strokeWidth: 1.5 }));
    g.add(bg);
    g.findOne('.rot-handle')?.moveToTop();
    g.findOne('.icon-grp')?.moveToTop();
    g.getLayer()?.batchDraw();
}

export function _toggleAnnihilationBounce(g) {
    const enabled = !g.getAttr('_bounceEnabled');
    g.setAttr('_bounceEnabled', enabled);
    if (!enabled) {
        g.findOne('.aoe-bounce')?.destroy();
        const body = g.findOne('.aoe-body'), handle = g.findOne('.rot-handle'), len = g.getAttr('_lenPx');
        if (body)   body.width(len);
        if (handle) handle.x(len);
        g.getLayer()?.batchDraw();
    } else {
        _refreshAnnihilationBounce(g);
    }
    window.dispatchEvent(new CustomEvent('_el:changed', { detail: g }));
}

export function _markerIconSvgUrl(iconDef, color) {
    const fill = iconDef.fill ? color : 'none';
    const stroke = iconDef.fill ? 'none' : color;
    const sw = iconDef.fill ? 0 : 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 ${iconDef.vb} ${iconDef.vb}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${iconDef.d}"/></svg>`;
    return 'data:image/svg+xml;base64,' + btoa(svg);
}

export function _placeMarkerIcon(pos, iconKey, color) {
    const def = MARKER_ICONS.find(i => i.key === iconKey);
    if (!def) return null;
    const col = color || S.currentColor;
    const size = 32;
    const g = new Konva.Group({ x: pos.x, y: pos.y });
    g.setAttr('_type', 'marker-icon');
    g.setAttr('_iconKey', iconKey);
    g.setAttr('_stroke', col);
    const img = new window.Image();
    img.src = _markerIconSvgUrl(def, col);
    const kImg = new Konva.Image({ image: img, width: size, height: size, offsetX: size / 2, offsetY: size / 2 });
    img.onload = () => { g.getLayer()?.batchDraw(); };
    g.add(kImg);
    return g;
}

export function _buildVisionCone(ox, oy, radius, direction, coneAngle) {
    const g = new Konva.Group({ x: ox, y: oy });
    g.setAttr('_type', 'vision');
    g.setAttr('_radius', _VISION_RADIUS);
    g.setAttr('_direction', direction);
    g.setAttr('_coneAngle', coneAngle);
    g.setAttr('_stroke', S.currentColor);
    const _sox = S.stage ? ox * S.stage.scaleX() + S.stage.x() : ox;
    const _soy = S.stage ? oy * S.stage.scaleY() + S.stage.y() : oy;
    const pts = _castVisionCone(_sox, _soy, _VISION_RADIUS, direction, coneAngle, 360);
    g.add(new Konva.Line({ points: pts, closed: true, fill: S.currentColor + '28', stroke: S.currentColor + 'aa', strokeWidth: 1.5, lineJoin: 'round' }));
    g.add(new Konva.Circle({ x: 0, y: 0, radius: 5, fill: S.currentColor, opacity: 0.9 }));
    return g;
}

export function _updateVisionCone(g, ox, oy, radius, direction, coneAngle) {
    g.setAttr('_radius', _VISION_RADIUS);
    g.setAttr('_direction', direction);
    g.setAttr('_coneAngle', coneAngle);
    const poly = g.getChildren().find(c => c instanceof Konva.Line);
    const _sox = S.stage ? ox * S.stage.scaleX() + S.stage.x() : ox;
    const _soy = S.stage ? oy * S.stage.scaleY() + S.stage.y() : oy;
    if (poly) poly.points(_castVisionCone(_sox, _soy, _VISION_RADIUS, direction, coneAngle, 360));
}

export function _refreshVisionGroup(g) {
    const dir = g.getAttr('_direction') || 0, ca = g.getAttr('_coneAngle') || S.visionConeAngle;
    const poly = g.getChildren().find(c => c instanceof Konva.Line);
    const _gAbs = g.getAbsolutePosition();
    if (poly) { poly.points(_castVisionCone(_gAbs.x, _gAbs.y, _VISION_RADIUS, dir, ca, 360)); }
    const diam = g.findOne('.v-handle');
    if (diam) { diam.x(Math.cos(dir) * _VISION_HANDLE_DIST); diam.y(Math.sin(dir) * _VISION_HANDLE_DIST); }
    g.getLayer()?.batchDraw();
}

export function _tryAttachVisionToAgent(vg) {
    const HIT = 30;
    const vx = vg.x(), vy = vg.y();
    const agentNodes = S.drawLayer.getChildren().filter(n => n.getAttr('_type') === 'agent');
    for (const ag of agentNodes) {
        const dx = vx - ag.x(), dy = vy - ag.y();
        if (dx * dx + dy * dy <= HIT * HIT) {
            const agId = ag.getAttr('_id');
            if (vg.getAttr('_attachedTo') === agId) return;
            _detachVisionFromAgent(vg);
            vg.setAttr('_attachedTo', agId);
            ag.setAttr('_visionId', vg.getAttr('_id'));
            vg.x(ag.x()); vg.y(ag.y());
            // Recast polygon from agent's position with preserved cone angle
            const poly = vg.getChildren().find(c => c instanceof Konva.Line);
            const dir0 = vg.getAttr('_direction') || 0;
            const ca0  = vg.getAttr('_coneAngle')  || S.visionConeAngle;
            const _agAbs0 = ag.getAbsolutePosition();
            if (poly) poly.points(_castVisionCone(_agAbs0.x, _agAbs0.y, _VISION_RADIUS, dir0, ca0, 360));
            // Put vision behind agent
            vg.zIndex(Math.max(0, ag.zIndex() - 1));
            let _vaRaf = null;
            ag.on('dragmove._va', () => {
                vg.x(ag.x()); vg.y(ag.y());
                if (_vaRaf) return;
                _vaRaf = requestAnimationFrame(() => {
                    _vaRaf = null;
                    const p2 = vg.getChildren().find(c => c instanceof Konva.Line);
                    const d2 = vg.getAttr('_direction') || 0;
                    const _agAbs = ag.getAbsolutePosition();
                    if (p2) p2.points(_castVisionConeDrag(_agAbs.x, _agAbs.y, _VISION_RADIUS, d2, vg.getAttr('_coneAngle') || S.visionConeAngle));
                    S.drawLayer.batchDraw();
                });
            });
            ag.on('dragend._va', () => {
                const p2 = vg.getChildren().find(c => c instanceof Konva.Line);
                const d2 = vg.getAttr('_direction') || 0;
                const _agAbs = ag.getAbsolutePosition();
                if (p2) p2.points(_castVisionCone(_agAbs.x, _agAbs.y, _VISION_RADIUS, d2, vg.getAttr('_coneAngle') || S.visionConeAngle, 360));
                S.drawLayer.batchDraw();
            });
            return;
        }
    }
    _detachVisionFromAgent(vg);
}

export function _detachVisionFromAgent(vg) {
    const attachedId = vg.getAttr('_attachedTo');
    if (!attachedId) return;
    const ag = S.drawLayer.getChildren().find(n => n.getAttr('_id') === attachedId);
    if (ag) { ag.off('dragmove._va'); ag.off('dragend._va'); ag.setAttr('_visionId', null); }
    vg.setAttr('_attachedTo', null);
}

export function _tryAttachNearbyVision(ag) {
    const HIT = 30;
    const ax = ag.x(), ay = ag.y();
    S.drawLayer.getChildren().filter(n => n.getAttr('_type') === 'vision').forEach(vg => {
        const dx = ax - vg.x(), dy = ay - vg.y();
        if (dx * dx + dy * dy <= HIT * HIT) _tryAttachVisionToAgent(vg);
    });
}

export function _addVisionHandle(g) {
    if (g.findOne('.v-handle')) return;
    const dir = g.getAttr('_direction') || 0;
    const col = g.getAttr('_stroke') || '#fff';
    const diam = new Konva.Rect({
        name: 'v-handle',
        x: Math.cos(dir) * _VISION_HANDLE_DIST,
        y: Math.sin(dir) * _VISION_HANDLE_DIST,
        width: 10, height: 10, offsetX: 5, offsetY: 5, rotation: 45,
        fill: col, stroke: 'rgba(0,0,0,0.5)', strokeWidth: 1,
        draggable: true, hitStrokeWidth: 12,
    });
    diam.on('mouseenter', () => { const c = S.stage?.container(); if (c) c.style.cursor = 'grab'; });
    diam.on('mouseleave', () => { const c = S.stage?.container(); if (c) c.style.cursor = 'crosshair'; });
    diam.on('dragstart', () => { const c = S.stage?.container(); if (c) c.style.cursor = 'grabbing'; });
    diam.on('dragend',   () => { const c = S.stage?.container(); if (c) c.style.cursor = 'crosshair'; });
    let _vhRaf = null;
    diam.on('dragmove', () => {
        if (_vhRaf) return;
        _vhRaf = requestAnimationFrame(() => {
            _vhRaf = null;
            const dx = diam.x(), dy = diam.y();
            const newDir = Math.atan2(dy, dx);
            g.setAttr('_direction', newDir);
            const poly = g.getChildren().find(c => c instanceof Konva.Line);
            const _gAbsDrag = g.getAbsolutePosition();
            if (poly) poly.points(_castVisionConeDrag(_gAbsDrag.x, _gAbsDrag.y, _VISION_RADIUS, newDir, g.getAttr('_coneAngle') || S.visionConeAngle));
            diam.x(Math.cos(newDir) * _VISION_HANDLE_DIST);
            diam.y(Math.sin(newDir) * _VISION_HANDLE_DIST);
            g.getLayer()?.batchDraw();
        });
    });
    diam.on('dragend', () => {
        const newDir = g.getAttr('_direction') || 0;
        const poly = g.getChildren().find(c => c instanceof Konva.Line);
        const _gAbsEnd = g.getAbsolutePosition();
        if (poly) poly.points(_castVisionCone(_gAbsEnd.x, _gAbsEnd.y, _VISION_RADIUS, newDir, g.getAttr('_coneAngle') || S.visionConeAngle, 360));
        g.getLayer()?.batchDraw();
    });
    g.add(diam);
}

export function _coneSvg(deg, s) {
    const r = s * 0.42, cx = s / 2, cy = s / 2;
    const a = deg * Math.PI / 180;
    const x1 = +(cx + r * Math.cos(-a / 2)).toFixed(1), y1 = +(cy + r * Math.sin(-a / 2)).toFixed(1);
    const x2 = +(cx + r * Math.cos(a / 2)).toFixed(1),  y2 = +(cy + r * Math.sin(a / 2)).toFixed(1);
    return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" fill="none"><path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${a > Math.PI ? 1 : 0},1 ${x2},${y2} Z" fill="currentColor" opacity="0.4" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}
