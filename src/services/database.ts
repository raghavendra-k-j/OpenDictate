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
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id INTEGER NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
      );
    `);
  }
  return db;
}

export interface NoteRow {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface EntryRow {
  id: number;
  note_id: number;
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

export function deleteNote(id: number): void {
  getDb().prepare('DELETE FROM notes WHERE id = ?').run(id);
}

export function addEntry(noteId: number, content: string): EntryRow {
  const d = getDb();
  const stmt = d.prepare('INSERT INTO entries (note_id, content) VALUES (?, ?)');
  const info = stmt.run(noteId, content);
  d.prepare("UPDATE notes SET updated_at = datetime('now') WHERE id = ?").run(noteId);
  return d.prepare('SELECT * FROM entries WHERE id = ?').get(info.lastInsertRowid) as EntryRow;
}

export function getEntries(noteId: number): EntryRow[] {
  return getDb().prepare('SELECT * FROM entries WHERE note_id = ? ORDER BY created_at ASC').all(noteId) as EntryRow[];
}

export function updateEntry(id: number, content: string): void {
  const d = getDb();
  d.prepare("UPDATE entries SET content = ?, updated_at = datetime('now') WHERE id = ?").run(content, id);
  const entry = d.prepare('SELECT note_id FROM entries WHERE id = ?').get(id) as { note_id: number } | undefined;
  if (entry) {
    d.prepare("UPDATE notes SET updated_at = datetime('now') WHERE id = ?").run(entry.note_id);
  }
}

export function deleteEntry(id: number): void {
  const d = getDb();
  const entry = d.prepare('SELECT note_id FROM entries WHERE id = ?').get(id) as { note_id: number } | undefined;
  d.prepare('DELETE FROM entries WHERE id = ?').run(id);
  if (entry) {
    d.prepare("UPDATE notes SET updated_at = datetime('now') WHERE id = ?").run(entry.note_id);
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
