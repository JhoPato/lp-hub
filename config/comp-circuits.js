'use strict';

// ── Comp Circuits Config ───────────────────────────────────────────────────────
// Add/remove event IDs here when new seasons start.
// Each eventId maps to a VLR.gg event (vlr.gg/event/{id}/...).
// Matches older than 4 months are auto-deleted from the DB via TTL index.

module.exports = [
    { name: 'VCT Americas',       eventIds: [2860] },
    { name: 'VCT EMEA',           eventIds: [2863] },
    { name: 'VCT Pacific',        eventIds: [2775, 2776] },
    { name: 'VCT China',          eventIds: [2864] },
    { name: 'Masters',            eventIds: [2760, 2765] },
    { name: 'Champions',          eventIds: [2766] },
    { name: 'GC North America',   eventIds: [2902] },
    { name: 'GC EMEA',            eventIds: [2893, 2840] },
    { name: 'GC Brazil',          eventIds: [2869] },
    { name: 'GC Korea',           eventIds: [2904] },
    { name: 'GC Southeast Asia',  eventIds: [2870, 2871] },
    // GC Champions: add event ID when Riot announces it (usually Nov/Dec)
    // { name: 'GC Champions', eventIds: [XXXX] },
    { name: 'VCL North America',  eventIds: [2857, 2858] },
    { name: 'VCL Brazil',         eventIds: [2787] },
    { name: 'VCL EMEA',           eventIds: [2782, 2925] },
    { name: 'VCL Korea',          eventIds: [2830] },
    { name: 'VCL Southeast Asia', eventIds: [2823, 2825] },
];
