import { S } from './state.js';
import { DEFAULT_KEYBINDS, KEYBIND_LABELS, KEYBIND_SECTIONS } from './constants.js';

export function formatKey(k) {
    const special = { ArrowUp:'↑', ArrowDown:'↓', ArrowLeft:'←', ArrowRight:'→', ' ':'Space', Backspace:'⌫', Delete:'Del', mb1:'M3', mb3:'M4', mb4:'M5', Tab:'Tab', CapsLock:'Caps' };
    return special[k] || k.toUpperCase();
}

let _listeningFor = null;

export function openSettings() {
    renderKeybindRows();
    document.querySelectorAll('.mode-toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === S.placeMode));
    const ind = document.getElementById('modeIndicator');
    if (ind) ind.classList.toggle('right', S.placeMode === 'drag');
    const v = document.getElementById('placeModeVideo');
    if (v) v.src = S.placeMode === 'click' ? '/assets/videos/place-click.mp4' : '/assets/videos/place-drag.mp4';
    const sa = document.getElementById('sliderAgentScale');
    const sb = document.getElementById('sliderAbilityScale');
    if (sa) { sa.value = S.agentIconScale; document.getElementById('sliderAgentVal').textContent = Math.round(S.agentIconScale * 100) + '%'; }
    if (sb) { sb.value = S.abilityIconScale; document.getElementById('sliderAbilityVal').textContent = Math.round(S.abilityIconScale * 100) + '%'; }
    const sc = document.getElementById('sliderBgOpacity');
    if (sc) { sc.value = S.iconBgOpacity; document.getElementById('sliderBgOpacityVal').textContent = Math.round(S.iconBgOpacity * 100) + '%'; }
    document.getElementById('settingsOverlay').classList.add('open');
}

export function onScaleSlider(which, val) {
    const v = parseFloat(val);
    if (which === 'agent') { S.agentIconScale = v; document.getElementById('sliderAgentVal').textContent = Math.round(v * 100) + '%'; }
    else if (which === 'ability') { S.abilityIconScale = v; document.getElementById('sliderAbilityVal').textContent = Math.round(v * 100) + '%'; }
    else { S.iconBgOpacity = v; document.getElementById('sliderBgOpacityVal').textContent = Math.round(v * 100) + '%'; }
    try { localStorage.setItem('boardIconScales', JSON.stringify({ agent: S.agentIconScale, ability: S.abilityIconScale, bgOpacity: S.iconBgOpacity })); } catch {}
}

export function closeSettings() {
    document.getElementById('settingsOverlay').classList.remove('open');
    _listeningFor = null;
}

export function startListening(id) {
    if (_listeningFor) {
        const prev = document.getElementById('kb-' + _listeningFor);
        if (prev) prev.classList.remove('listening');
    }
    _listeningFor = id;
    const badge = document.getElementById('kb-' + id);
    badge.classList.add('listening');
    badge.textContent = '...';
}

export function saveKeybinds() {
    localStorage.setItem('boardKeybinds', JSON.stringify(S.keybinds));
    closeSettings();
    window.toast?.('Key bindings saved', 'success');
}

export function resetKeybinds() {
    S.keybinds = { ...DEFAULT_KEYBINDS };
    renderKeybindRows();
}

export function renderKeybindRows() {
    ['tools','abilities','agents'].forEach(section => {
        const container = document.getElementById('keybind-section-' + section);
        container.innerHTML = KEYBIND_SECTIONS[section].map(id => `
            <div class="keybind-row">
                <span class="keybind-label">${KEYBIND_LABELS[id]}</span>
                <div class="keybind-badge" id="kb-${id}" onclick="startListening('${id}')">${formatKey(S.keybinds[id])}</div>
            </div>`).join('');
    });
}

export function setPlaceMode(mode) {
    S.placeMode = mode;
    localStorage.setItem('boardPlaceMode', mode);
    document.querySelectorAll('.mode-toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    const ind = document.getElementById('modeIndicator');
    if (ind) ind.classList.toggle('right', mode === 'drag');
    const v = document.getElementById('placeModeVideo');
    if (v) v.src = mode === 'click' ? '/assets/videos/place-click.mp4' : '/assets/videos/place-drag.mp4';
}

export function loadSettings() {
    S.keybinds = { ...DEFAULT_KEYBINDS };
    try { const _kb = localStorage.getItem('boardKeybinds'); if (_kb) Object.assign(S.keybinds, JSON.parse(_kb)); } catch {}

    S.agentIconScale = 1.0;
    S.abilityIconScale = 1.0;
    S.iconBgOpacity = 1.0;
    try { const _s = localStorage.getItem('boardIconScales'); if (_s) { const _p = JSON.parse(_s); S.agentIconScale = _p.agent ?? 1.0; S.abilityIconScale = _p.ability ?? 1.0; S.iconBgOpacity = _p.bgOpacity ?? 1.0; } } catch {}
}

export function initKeybindListeners() {
    document.addEventListener('mousedown', e => {
        if (!_listeningFor) return;
        if (e.button === 0 || e.button === 2) return;
        e.preventDefault(); e.stopPropagation();
        const newKey = `mb${e.button}`;
        S.keybinds[_listeningFor] = newKey;
        const badge = document.getElementById('kb-' + _listeningFor);
        if (badge) { badge.classList.remove('listening'); badge.textContent = formatKey(newKey); }
        _listeningFor = null;
    }, true);

    document.addEventListener('mousedown', e => {
        if (_listeningFor) return;
        if (e.button === 0 || e.button === 2) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        if (S._activeTextInput) return;
        e.preventDefault();
        const btn = `mb${e.button}`;
        if (S.currentTool === 'agent' && S.selectedAgent && S.placeMode !== 'drag') {
            const slotMap = { [S.keybinds.ability1]:'Ability1', [S.keybinds.ability2]:'Ability2', [S.keybinds.ability3]:'Grenade', [S.keybinds.ability4]:'Ultimate' };
            if (slotMap[btn]) { window.selectAbility(slotMap[btn]); return; }
        }
        if (btn === S.keybinds.erase) { window.toggleErase(); return; }
        if (btn === S.keybinds.deleteOnMouse) { window._drawingExports?.deleteUnderMouse?.(); return; }
        if (btn === S.keybinds.clear) { window.clearBoard(); return; }
        if (btn === S.keybinds.filterToggle) { window.setAgentFilter(S.agentFilter === 'all' ? 'map' : 'all'); return; }
        if (btn === S.keybinds.agent) {
            if (S.selectedAbility) { window.selectAbility(null); }
            else if (S.currentTool !== 'agent') { window.setTool('agent'); }
            return;
        }
        const toolMap = { [S.keybinds.select]:'select', [S.keybinds.line]:'line', [S.keybinds.pencil]:'pencil', [S.keybinds.rect]:'rect', [S.keybinds.text]:'text', [S.keybinds.move]:'move', [S.keybinds.multi]:'multi' };
        if (toolMap[btn]) { window.setTool(toolMap[btn]); return; }
        if (btn === S.keybinds.agentDown || btn === S.keybinds.agentUp) {
            if (!S.agents.length) return;
            const { getUuidsOnMap } = window._boardOpsExports || {};
            const visibleUuids = S.agentFilter === 'map' ? getUuidsOnMap?.() : null;
            const filtered = visibleUuids ? S.agents.filter(a => visibleUuids.has(a.uuid)) : S.agents;
            if (!filtered.length) return;
            const idx = filtered.findIndex(a => a.uuid === S.selectedAgent?.uuid);
            const next = btn === S.keybinds.agentDown ? Math.min(filtered.length - 1, idx + 1) : Math.max(0, idx - 1);
            if (next !== idx) window.selectAgent(filtered[next].uuid);
        }
    }, true);

    document.addEventListener('keydown', e => {
        if (!_listeningFor) return;
        const ignore = ['Control','Alt','Shift','Meta','Enter','Escape'];
        if (ignore.includes(e.key)) return;
        e.preventDefault();
        e.stopPropagation();
        const newKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        S.keybinds[_listeningFor] = newKey;
        const badge = document.getElementById('kb-' + _listeningFor);
        if (badge) { badge.classList.remove('listening'); badge.textContent = formatKey(newKey); }
        _listeningFor = null;
    }, true);

    document.addEventListener('keydown', e => {
        if (_listeningFor) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        if (S._activeTextInput) return;
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { if (e.repeat) return; e.preventDefault(); window.undo(); return; }
        if (e.ctrlKey && e.shiftKey && e.key === 'Z') { if (e.repeat) return; e.preventDefault(); window.redo(); return; }
        if (e.ctrlKey && e.key === 's') { e.preventDefault(); window.saveStrategy(); return; }
        if (e.key === 'Escape') {
            const settingsOpen = document.getElementById('settingsOverlay')?.classList.contains('open');
            const mapOpen = document.getElementById('mapPickerDropdown')?.style.display === 'grid';
            if (settingsOpen) { closeSettings(); return; }
            if (mapOpen) { document.getElementById('mapPickerDropdown').style.display = 'none'; document.getElementById('mapPickerBtn').classList.remove('open'); return; }
            if (S.eraseMode) { window.toggleErase(); return; }
            if (S.selectedAbility || document.getElementById('agentAbilityFloat')?.classList.contains('visible')) {
                S.selectedAbility = null;
                document.getElementById('agentAbilityFloat').classList.remove('visible');
                return;
            }
            if (S.currentTool !== 'select') { window.setTool('select'); return; }
            return;
        }

        const k = e.key.toLowerCase();

        if (S.currentTool === 'agent' && S.selectedAgent && S.placeMode !== 'drag') {
            const slotMap = {
                [S.keybinds.ability1]:'Ability1',
                [S.keybinds.ability2]:'Ability2',
                [S.keybinds.ability3]:'Grenade',
                [S.keybinds.ability4]:'Ultimate',
            };
            if (slotMap[k]) { window.selectAbility(slotMap[k]); return; }
        }

        if (k === S.keybinds.erase) { window.toggleErase(); return; }
        if (k === S.keybinds.deleteOnMouse) { window._drawingExports?.deleteUnderMouse?.(); return; }
        if (e.key === S.keybinds.clear || k === S.keybinds.clear) { window.clearBoard(); return; }
        if (k === S.keybinds.filterToggle) { window.setAgentFilter(S.agentFilter === 'all' ? 'map' : 'all'); return; }
        if (k === S.keybinds.agent) {
            if (S.selectedAbility) { window.selectAbility(null); }
            else if (S.currentTool !== 'agent') { window.setTool('agent'); }
            return;
        }
        const toolMap = {
            [S.keybinds.select]:'select', [S.keybinds.line]:'line',
            [S.keybinds.pencil]:'pencil', [S.keybinds.rect]:'rect',
            [S.keybinds.text]:'text', [S.keybinds.move]:'move', [S.keybinds.multi]:'multi',
        };
        if (toolMap[k]) window.setTool(toolMap[k]);

        if (e.key === S.keybinds.agentDown || e.key === S.keybinds.agentUp) {
            e.preventDefault();
            if (!S.agents.length) return;
            const { getUuidsOnMap } = window._boardOpsExports || {};
            const visibleUuids = S.agentFilter === 'map' ? getUuidsOnMap?.() : null;
            const filtered = visibleUuids ? S.agents.filter(a => visibleUuids.has(a.uuid)) : S.agents;
            if (!filtered.length) return;
            const idx = filtered.findIndex(a => a.uuid === S.selectedAgent?.uuid);
            const next = e.key === S.keybinds.agentDown
                ? Math.min(filtered.length - 1, idx + 1)
                : Math.max(0, idx - 1);
            if (next === idx) return;
            window.selectAgent(filtered[next].uuid);
            const thumb = document.querySelector(`.agent-thumb[data-uuid="${filtered[next].uuid}"]`);
            if (thumb) thumb.scrollIntoView({ block:'nearest', behavior:'smooth' });
        }
    });
}
