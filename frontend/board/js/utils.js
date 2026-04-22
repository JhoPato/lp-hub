import { S } from './state.js';
import { ABILITY_AOE_DB } from './constants.js';

export function _proxyUrl(url) {
    if (!url) return url;
    try {
        const h = new URL(url).hostname;
        if (h === 'media.valorant-api.com' || h === 'valorant-api.com') {
            return '/api/vapi-proxy?url=' + encodeURIComponent(url);
        }
    } catch {}
    return url;
}

export async function loadImg(url) {
    if (!url) return null;
    const src = _proxyUrl(url);
    if (S.imgCache[src]) return S.imgCache[src];
    return new Promise(res => {
        const i = new Image(); i.crossOrigin = 'anonymous';
        i.onload = () => { S.imgCache[src] = i; res(i); };
        i.onerror = () => res(null);
        i.src = src;
    });
}

export function getCanvasPos() {
    const p = S.stage.getPointerPosition();
    if (!p) return null;
    return {
        x: (p.x - S.stage.x()) / S.stage.scaleX(),
        y: (p.y - S.stage.y()) / S.stage.scaleY(),
    };
}

export function m2px(m) {
    const sel = document.getElementById('mapSelect');
    const meta = S.maps.find(x => x.uuid === sel?.value);
    const xm = meta?.xMultiplier || 0.0000566;
    return m * 100 * xm * (S.mapDisplayW || S.W);
}

export function getAbilityAoe(ability) {
    const raw = ability?.displayName || '';
    const norm = s => s.replace(/\s*\/\s*/g, ' / ').trim();
    const _ciKey = Object.keys(ABILITY_AOE_DB).find(k => k !== '_default' && k.toLowerCase() === raw.toLowerCase());
    const e = ABILITY_AOE_DB[raw]
           || ABILITY_AOE_DB[norm(raw)]
           || ABILITY_AOE_DB[raw.split('/')[0].trim()]
           || (_ciKey ? ABILITY_AOE_DB[_ciKey] : null)
           || ABILITY_AOE_DB['_default'];
    const px = m => Math.max(12, m2px(m));
    const co = e.castOffset ? px(e.castOffset) : 0;
    const rng = e.minLen !== undefined ? { minLen: px(e.minLen), maxLen: px(e.maxLen) } : {};
    const defLen = (e.len ? px(e.len) : undefined) || rng.minLen;
    switch (e.type) {
        case 'circle':   return { type:'circle',   radius: px(e.r) };
        case 'line':     return { type:'line',     radius: px(e.r||1), length: defLen, castOffset: co, ...rng };
        case 'cone':     return { type:'cone',     radius: px(e.r), coneAngle: e.coneAngle || 55 };
        case 'cylinder':      return { type:'cylinder',      radius: px(e.r * 2), length: defLen, castOffset: co, ...rng };
        case 'annihilation':  return { type:'annihilation',  radius: px(e.r * 2), length: defLen };
        case 'blaze':         return { type:'blaze',         radius: 4,            maxLen: px(e.maxLen||21), minLen: px(e.minLen||1) };
        case 'high-tide':     return { type:'high-tide',     radius: 4,            maxLen: px(e.maxLen||60) };
        case 'rect':     return { type:'rect',     radius: px(e.w),     length: defLen, castOffset: co, ...rng };
        case 'cross':    return { type:'cross',    radius: 0,           length: px(e.len || 10), wallClip: !!e.wallClip };
        case 'arrow':    return { type:'arrow',    radius: 0 };
        case 'none':     return { type:'none',     radius: 0 };
        default:         return { type:'circle',   radius: px(4) };
    }
}

export function _clientToWorld(clientX, clientY) {
    const content = S.stage.content;
    const rect = content.getBoundingClientRect();
    const sx = rect.width  / content.offsetWidth  || 1;
    const sy = rect.height / content.offsetHeight || 1;
    return {
        x: ((clientX - rect.left) / sx - S.stage.x()) / S.stage.scaleX(),
        y: ((clientY - rect.top)  / sy - S.stage.y()) / S.stage.scaleY(),
    };
}
