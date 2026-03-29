import { app } from 'electron';
import path from 'node:path';
import Database from 'better-sqlite3';

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'opendictate.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Migrate: add content column if upgrading from older schema
    const columns = db.pragma('table_info(notes)') as { name: string }[];
    if (!columns.some(c => c.name === 'content')) {
      db.exec("ALTER TABLE notes ADD COLUMN content TEXT NOT NULL DEFAULT ''");
    }
  }
  return db;
}

export interface NoteRow {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function createNote(title: string): NoteRow {
  const d = getDb();
  const stmt = d.prepare('INSERT INTO notes (title) VALUES (?)');
  const info = stmt.run(title);
  return d.prepare('SELECT * FROM notes WHERE id = ?').get(info.lastInsertRowid) as NoteRow;
}

export function getAllNotes(): NoteRow[] {
  return getDb().prepare('SELECT * FROM notes ORDER BY updated_at DESC').all() as NoteRow[];
}

export function getNote(id: number): NoteRow | undefined {
  return getDb().prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRow | undefined;
}

export function updateNoteTitle(id: number, title: string): void {
  getDb().prepare("UPDATE notes SET title = ?, updated_at = datetime('now') WHERE id = ?").run(title, id);
}

export function updateNoteContent(id: number, content: string): void {
  getDb().prepare("UPDATE notes SET content = ?, updated_at = datetime('now') WHERE id = ?").run(content, id);
}

export function deleteNote(id: number): void {
  getDb().prepare('DELETE FROM notes WHERE id = ?').run(id);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
