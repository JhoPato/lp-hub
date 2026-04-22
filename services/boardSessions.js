const DOG_BREEDS = [
    'Corgi','Husky','Shiba','Akita','Samoyed','Poodle','Beagle','Boxer',
    'Collie','Dalmatian','Vizsla','Whippet','Spitz','Kelpie','Malinois',
    'Setter','Retriever','Spaniel','Terrier','Basenji','Greyhound','Saluki',
    'Weimaraner','Ridgeback','Pointer','Stafford','Bulldog','Schnauzer',
];

const sessions = new Map();
const SESSION_TTL = 4 * 60 * 60 * 1000;

function _generateCode() {
    const breed = DOG_BREEDS[Math.floor(Math.random() * DOG_BREEDS.length)];
    const num = String(Math.floor(Math.random() * 900) + 100);
    const code = `${breed}-${num}`;
    return sessions.has(code) ? _generateCode() : code;
}

function createSession({ hostUserId, hostUsername }) {
    const roomCode = _generateCode().toUpperCase();
    sessions.set(roomCode, {
        roomCode,
        hostUserId,
        hostUsername,
        createdAt: Date.now(),
        state: { mapUuid: null, side: 'atk', objects: [] },
        participants: new Map(),
    });
    return roomCode;
}

function getSession(roomCode) {
    return sessions.get(roomCode.toUpperCase()) || null;
}

function deleteSession(roomCode) {
    sessions.delete(roomCode.toUpperCase());
}

setInterval(() => {
    const now = Date.now();
    for (const [code, s] of sessions) {
        if (now - s.createdAt > SESSION_TTL) sessions.delete(code);
    }
}, 30 * 60 * 1000);

module.exports = { createSession, getSession, deleteSession };
