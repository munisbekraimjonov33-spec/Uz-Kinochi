const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

let db;

async function initDb() {
    db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS movies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT UNIQUE NOT NULL,
            file_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            username TEXT
        );

        CREATE TABLE IF NOT EXISTS admins (
            user_id INTEGER PRIMARY KEY
        );
    `);

    // Migration: Add columns if they don't exist
    try { await db.exec('ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0'); } catch (e) {}
    try { await db.exec('ALTER TABLE users ADD COLUMN referred_by INTEGER'); } catch (e) {}
    
    console.log('Database initialized');
    return db;
}

async function addMovie(name, code, file_id) {
    return await db.run(
        'INSERT INTO movies (name, code, file_id) VALUES (?, ?, ?)',
        [name, code, file_id]
    );
}

async function getMovieByCode(code) {
    return await db.get('SELECT * FROM movies WHERE code = ?', [code]);
}

async function getMoviesByName(name) {
    return await db.all('SELECT * FROM movies WHERE name LIKE ?', [`%${name}%`]);
}

async function deleteMovieByCode(code) {
    return await db.run('DELETE FROM movies WHERE code = ?', [code]);
}

async function upsertUser(userId, username, referrerId = null) {
    const user = await db.get('SELECT * FROM users WHERE user_id = ?', [userId]);
    if (!user) {
        await db.run(
            'INSERT INTO users (user_id, username, referred_by) VALUES (?, ?, ?)',
            [userId, username, referrerId]
        );
        if (referrerId) {
            await db.run('UPDATE users SET points = points + 1 WHERE user_id = ?', [referrerId]);
        }
    } else {
        await db.run('UPDATE users SET username = ? WHERE user_id = ?', [username, userId]);
    }
}

async function getUser(userId) {
    return await db.get('SELECT * FROM users WHERE user_id = ?', [userId]);
}

async function getStats() {
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    const movieCount = await db.get('SELECT COUNT(*) as count FROM movies');
    return {
        users: userCount.count,
        movies: movieCount.count
    };
}

async function getAllUserIds() {
    const users = await db.all('SELECT user_id FROM users');
    return users.map(u => u.user_id);
}

async function getRandomMovie() {
    return await db.get('SELECT * FROM movies ORDER BY RANDOM() LIMIT 1');
}

async function getTopReferrers() {
    return await db.all('SELECT username, points FROM users ORDER BY points DESC LIMIT 10');
}

async function getChannels() {
    return await db.all('SELECT * FROM channels');
}

async function addChannel(chatId, title) {
    return await db.run('INSERT INTO channels (chat_id, title) VALUES (?, ?)', [chatId, title]);
}

async function deleteChannel(id) {
    return await db.run('DELETE FROM channels WHERE id = ?', [id]);
}

module.exports = {
    initDb,
    addMovie,
    getMovieByCode,
    getMoviesByName,
    deleteMovieByCode,
    upsertUser,
    getUser,
    getStats,
    getAllUserIds,
    getRandomMovie,
    getTopReferrers,
    getChannels,
    addChannel,
    deleteChannel
};
