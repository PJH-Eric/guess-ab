'use strict';

const { DatabaseSync } = require('node:sqlite');

function openRoomStore(filename) {
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, checkpoint TEXT NOT NULL);
  `);

  const list = db.prepare('SELECT checkpoint FROM rooms');
  const save = db.prepare('INSERT INTO rooms VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET checkpoint = excluded.checkpoint');
  const remove = db.prepare('DELETE FROM rooms WHERE id = ?');

  return {
    load() { return list.all().map(row => JSON.parse(row.checkpoint)); },
    write(changes) {
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const [id, checkpoint] of changes) {
          if (checkpoint) save.run(id, JSON.stringify(checkpoint));
          else remove.run(id);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  };
}

module.exports = { openRoomStore };
