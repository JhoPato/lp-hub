import { S } from './state.js';

export const SLOT_API = ['Ability1','Ability2','Grenade','Ultimate'];
export const getSlotKey = slot => {
    const map = { Ability1:'ability1', Ability2:'ability2', Grenade:'ability3', Ultimate:'ability4' };
    const kb = S.keybinds[map[slot]];
    return kb ? kb.toUpperCase() : '';
};
export const SLOT_KEY = { Ability1:true, Ability2:true, Grenade:true, Ultimate:true };

export const ABILITY_AOE_DB = {
    'Gravity Well':       { type:'circle',   r:5.06 },
    'Nova Pulse':         { type:'circle',   r:5.06 },
    'Nebula':             { type:'circle',   r:5.06 },
    'Nebula / Dissipate': { type:'circle',   r:5.06 },
    'Cosmic Divide':      { type:'line', r:1, len:10, minLen:10, maxLen:1000 },
    'Astral Form / Cosmic Divide': { type:'line', r:1, len:10, minLen:10, maxLen:1000 },
    'Aftershock':         { type:'cylinder', r:3,    len:10  },
    'Fault Line':         { type:'rect',     w:6.71, minLen:6.71, maxLen:47.0, castOffset:8 },
    'Rolling Thunder':    { type:'rect',     w:18,   len:32,  castOffset:8  },
    'Stim Beacon':        { type:'circle',   r:6.39 },
    'Incendiary':         { type:'circle',   r:4.79 },
    'Sky Smoke':          { type:'circle',   r:4.42 },
    'Orbital Strike':     { type:'circle',   r:9.58 },
    'Trademark':          { type:'circle',   r:10.65},
    'Rendezvous':         { type:'circle',   r:19.16},
    'Meddle':             { type:'circle',   r:4.26 },
    'Ruse':               { type:'circle',   r:4.26 },
    'Trapwire':           { type:'line',     len:15.32, minLen:1, maxLen:15.32 },
    'Cyber Cage':         { type:'circle',   r:3.96 },
    'Barrier Mesh':       { type:'cross',    len:7.59, wallClip:true },
    'Sonic Sensor':       { type:'rect',     w:8,    len:9   },
    'GravNet':            { type:'circle',   r:6.92 },
    'Seize':              { type:'circle',   r:7.01 },
    'Annihilation':       { type:'annihilation', r:1.5, len:40  },
    'Haunt':              { type:'circle',   r:31.94},
    'Nightfall':          { type:'rect',     w:20,   len:40  },
    'Mosh Pit':           { type:'circle',   r:6.60 },
    'Wingman':            { type:'arrow' },
    'Storm Surge':        { type:'circle',   r:6.39 },
    'Cove':               { type:'circle',   r:4.90 },
    'Reckoning':          { type:'rect',     w:21,   len:34  },
    'Undercut':           { type:'cylinder', r:3,    len:35  },
    'Kill Contract':      { type:'rect',     w:15,   len:36  },
    'Cloudburst':         { type:'circle',   r:3.57 },
    'FRAG/ment':          { type:'circle',   r:4.26 },
    'ZERO/point':         { type:'circle',   r:15.97},
    'NULL/cmd':           { type:'circle',   r:45.25},
    'Zero/Point':         { type:'circle',   r:15.97},
    'Nanoswarm':          { type:'circle',   r:4.79 },
    'Alarmbot':           { type:'circle',   r:5.86 },
    'Alarm Bot':          { type:'circle',   r:5.86 },
    'Turret':             { type:'cone',     r:106.5, coneAngle:100 },
    'Lockdown':           { type:'circle',   r:34.60},
    'Fast Lane':          { type:'rect',     w:3.5,  len:46.5, minLen:1, maxLen:46.5 },
    'Relay Bolt':         { type:'circle',   r:5.32 },
    'Paranoia':           { type:'cylinder', r:4.3,  len:27.39 },
    'Dark Cover':         { type:'circle',   r:4.37 },
    'Blaze':              { type:'blaze',    maxLen:21, minLen:1 },
    'High Tide':          { type:'high-tide',maxLen:60 },
    'Hot Hands':          { type:'circle',   r:4.79 },
    'Boom Bot':           { type:'arrow' },
    'Stealthbot':         { type:'arrow' },
    'Stealth Drone':      { type:'arrow' },
    'Infiltrators':       { type:'arrow' },
    'Barrier Orb':        { type:'rect',     w:1.5,  len:10.4 },
    'Slow Orb':           { type:'circle',   r:6.39 },
    'Healing Orb':        { type:'circle',   r:5.32 },
    'Resurrection':       { type:'circle',   r:5.32 },
    'Regrowth':           { type:'circle',   r:19.16},
    'Shock Bolt':         { type:'circle',   r:4.26 },
    'Recon Bolt':         { type:'circle',   r:31.94},
    "Hunter's Fury":      { type:'cylinder', r:1.76, len:66  },
    'Special Delivery':   { type:'circle',   r:5.59 },
    'Guided Salvo':       { type:'circle',   r:4.79 },
    'Armageddon':         { type:'rect',     w:12,   len:32  },
    'Crosscut':           { type:'circle',   r:25.55},
    'Chokehold':          { type:'circle',   r:7.01 },
    'Interceptor':        { type:'circle',   r:19.16},
    'Snake Bite':         { type:'circle',   r:4.79 },
    'Poison Cloud':       { type:'circle',   r:4.79 },
    'Toxic Screen':       { type:'line',     r:61.27},
    "Viper's Pit":        { type:'none' },
    'Razorvine':          { type:'circle',   r:6.65 },
    'Shear':              { type:'rect',     w:1,    len:12  },
    'Steel Garden':       { type:'circle',   r:29.81},
    'Saturate':           { type:'circle',   r:6.39 },
    'Convergent Paths':   { type:'rect',     w:13.5, len:36  },
    'Waveform':           { type:'circle',   r:4.72 },
    'M-pulse':            { type:'circle',   r:5.5  },
    'Bassquake':          { type:'cone',     r:40,   coneAngle:60 },
    '_default':           { type:'none'              },
};

export const MOVE_SPEEDS = { 'knife-run':6.75, 'knife-walk':4.05, 'rifle-run':5.40, 'rifle-walk':3.24, 'neon-run':9.20 };

export const STIM_RADIUS_M = 6.39;
export const STIM_BUFF     = 0.10;
export const STIM_DURATION = 4.0;
export const STIM_BORDER_COLOR = '#e8b84b';

export const VISION_PRESETS = [
    { key: 'normal', label: 'Normal',       deg: 103  },
    { key: 'op1',    label: 'OP Scope ×1',  deg: 53.4 },
    { key: 'op2',    label: 'OP Scope ×2',  deg: 28.2 },
];

export const _VG = 512;
export const _VISION_RADIUS = 800;
export const _VISION_HANDLE_DIST = 60;

export const _MOVE_SVG_MAP = { 'rifle-run':'RifleRun-icon..svg', 'rifle-walk':'RifleWalk-icon..svg', 'knife-run':'KnifeRun-icon..svg', 'knife-walk':'KnifeWalk-icon..svg', 'neon-run':'NeonRun-1.svg' };
export const _MOVE_IMGS = {};
Object.entries(_MOVE_SVG_MAP).forEach(([k,f]) => {
    const img = new Image();
    img.onload = () => {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, 64, 64);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 64, 64);
        const out = new Image(); out.src = c.toDataURL();
        _MOVE_IMGS[k] = out;
    };
    img.src = `/assets/svg/${f}`;
});

export const MAP_VISION_PASSTHROUGH = {
    '7eaecc1b-4337-bbf6-6ab9-04b8f06b3319': [ // Ascent
        { cx: 0.547, cy: 0.091, r: 0.020 },   // circle top (mid top)
        { cx: 0.479, cy: 0.545, r: 0.020 },   // circle center
        { cx: 0.405, cy: 0.837, r: 0.020 },   // circle bottom-left
    ],
};

export const MAP_ROTATION = {
    'd960549e-485c-e861-8d71-aa9d1aed12a2':  90, // Split
    '7eaecc1b-4337-bbf6-6ab9-04b8f06b3319':  90, // Ascent
    '1c18ab1f-420d-0d8b-71d0-77ad3c439115':  90, // Corrode
    '2bee0dc9-4ffe-519b-1cbd-7fbe763a6047':  90, // Haven
    'b529448b-4d60-346e-e89e-00a4c527a405': 180, // Fracture
    'e2ad5c54-4114-a870-9641-8ea21279579a': -90, // Icebox
    '224b0a95-48b9-f703-1bd8-67aca101a61f':  90, // Abyss
};

export const DRAW_TOOLS = new Set(['line','pencil','circle','rect','text','move','multi']);
export const TEXT_FONTS = [
    { name:'Inter',      label:'Inter',      css:"'Inter', sans-serif"       },
    { name:'Mono',       label:'Mono',       css:"'Roboto Mono', monospace"  },
    { name:'Bebas',      label:'BEBAS',      css:"'Bebas Neue', sans-serif"  },
    { name:'Orbitron',   label:'Orbitron',   css:"'Orbitron', sans-serif"    },
];
export const ERASER_RADIUS = 11;

export const MARKER_ICONS = [
    { key:'pin',       label:'Pin',        vb:24, d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z', fill:true  },
    { key:'star',      label:'Star',       vb:24, d:'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',                                                                       fill:true  },
    { key:'warning',   label:'Warning',    vb:24, d:'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',                                                                fill:false },
    { key:'flag',      label:'Flag',       vb:24, d:'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',                                                                                                   fill:false },
    { key:'anchor',    label:'Anchor',     vb:24, d:'M12 2 a2 2 0 1 0 0 4 a2 2 0 1 0 0-4 z M12 6 L12 21 M5 9 L19 9 M4 19 C4 23 8 25 12 22 C16 25 20 23 20 19',                                                          fill:false },
    { key:'crosshair', label:'Crosshair',  vb:24, d:'M12 2 a10 10 0 1 0 0 20 a10 10 0 1 0 0-20 z M12 2 v4 M12 18 v4 M2 12 h4 M18 12 h4 M12 9 a3 3 0 1 0 0 6 a3 3 0 1 0 0-6 z',                                          fill:false },
    { key:'shield',    label:'Shield',     vb:24, d:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',                                                                                                                          fill:false },
];

export const DEFAULT_KEYBINDS = {
    select:'s', line:'l', pencil:'q', rect:'r', agent:'g',
    text:'t', move:'m', multi:'v',
    erase:'w', clear:'Delete', deleteOnMouse:'e',
    ability1:'1', ability2:'2', ability3:'3', ability4:'4',
    agentUp:'ArrowUp', agentDown:'ArrowDown', filterToggle:'f',
};

export const KEYBIND_LABELS = {
    select:'Select', line:'Line', pencil:'Pencil', rect:'Rectangle', agent:'Agent Mode',
    text:'Text', move:'Walk', multi:'Map',
    erase:'Eraser', clear:'Clear Board', deleteOnMouse:'Delete on Mouse',
    ability1:'Ability 1', ability2:'Ability 2', ability3:'Ability 3', ability4:'Ability 4',
    agentUp:'Previous Agent', agentDown:'Next Agent', filterToggle:'ALL / MAP',
};
export const KEYBIND_SECTIONS = {
    tools:     ['select','line','pencil','rect','agent','text','move','multi','erase','deleteOnMouse','clear'],
    abilities: ['ability1','ability2','ability3','ability4'],
    agents:    ['agentUp','agentDown','filterToggle'],
};

export const _CACHE_TTL = 24 * 60 * 60 * 1000; // 24 h

export const _TOOL_ORDER = ['line','pencil','circle','rect','text','move','multi'];
