require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('../models/User');
const Team     = require('../models/Team');

const TEAMS = [
    { name: 'LP Tau',            tag: 'TAU', region: 'BR' },
    { name: 'LP Youngsters',     tag: 'YNG', region: 'BR' },
    { name: 'Lost Puppies',      tag: 'LP',  region: 'UK' },
    { name: 'Lost Puppies Wales', tag: 'WAL', region: 'UK' },
    { name: 'LP FR',             tag: 'FR',  region: 'FR' },
    { name: 'LP ITA',            tag: 'ITA', region: 'IT' },
    { name: 'LP Peuchén',        tag: 'PCH', region: 'CL' },
    { name: 'LP ES',             tag: 'ES',  region: 'ES' },
    { name: 'LP DE',             tag: 'DE',  region: 'DE' },
    { name: 'LP TR',             tag: 'TR',  region: 'TR' },
    { name: 'LP US',             tag: 'US',  region: 'US' },
    { name: 'Bitfix Puppies GC', tag: 'GC',  region: 'EU' },
];


const OWNERS = [
    { username: 'porridge', email: 'owner@lostpuppies.hub',   password: 'burntpizza6767' },
    { username: 'JhoPato',  email: 'helielsonjho@gmail.com',  password: 'vacapreta123'   },
];

async function bootstrap() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Bootstrap] Connected to MongoDB.\n');

    for (const t of TEAMS) {
        const exists = await Team.findOne({ name: t.name });
        if (exists) {
            console.log(`[Teams] Already exists: ${t.name}`);
        } else {
            await Team.create({ ...t, game: 'Valorant' });
            console.log(`[Teams] Created: ${t.name}`);
        }
    }

    console.log('');
    for (const o of OWNERS) {
        const existing = await User.findOne({ username: o.username });
        if (existing) {
            existing.role         = 'owner';
            existing.teamId       = null;
            existing.passwordHash = User.hashPassword(o.password);
            existing.isActive     = true;
            await existing.save();
            console.log(`[Owners] Updated to owner: ${o.username}`);
        } else {
            await User.create({
                username:     o.username,
                email:        o.email,
                passwordHash: User.hashPassword(o.password),
                role:         'owner',
                teamId:       null,
                isActive:     true,
            });
            console.log(`[Owners] Created: ${o.username}`);
        }
    }

    console.log('\n[Bootstrap] ✅ Done! Login at /login.html');
    await mongoose.disconnect();
    process.exit(0);
}

bootstrap().catch(err => {
    console.error('[Bootstrap] Error:', err.message);
    process.exit(1);
});
