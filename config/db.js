const mongoose = require('mongoose');

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('[DB] MongoDB Atlas connected successfully.');
    } catch (err) {
        console.error('[DB] Connection failed:', err.message);
        process.exit(1);
    }
}

module.exports = connectDB;
