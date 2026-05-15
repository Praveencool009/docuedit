import Database from 'better-sqlite3'
import { join } from 'path'

const DB_PATH = process.env.DB_PATH || join(process.cwd(), 'usage.db')

let db: Database.Database

function getDb() {
  if (!db) {
    db = new Database(DB_PATH)
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        file_type TEXT,
        file_name TEXT,
        success INTEGER NOT NULL,
        error TEXT,
        ip TEXT
      )
    `)
  }
  return db
}

export function logConversion(data: {
  fileType: string
  fileName: string
  success: boolean
  error?: string
  ip?: string
}) {
  const d = getDb()
  d.prepare(`
    INSERT INTO conversions (timestamp, file_type, file_name, success, error, ip)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    new Date().toISOString(),
    data.fileType,
    data.fileName,
    data.success ? 1 : 0,
    data.error || null,
    data.ip || null
  )
}

export function getStats() {
  const d = getDb()
  const total = (d.prepare('SELECT COUNT(*) as n FROM conversions').get() as any).n
  const success = (d.prepare('SELECT COUNT(*) as n FROM conversions WHERE success=1').get() as any).n
  const failed = (d.prepare('SELECT COUNT(*) as n FROM conversions WHERE success=0').get() as any).n
  const today = (d.prepare("SELECT COUNT(*) as n FROM conversions WHERE date(timestamp)=date('now')").get() as any).n
  const thisWeek = (d.prepare("SELECT COUNT(*) as n FROM conversions WHERE timestamp >= datetime('now', '-7 days')").get() as any).n
  const byType = d.prepare('SELECT file_type, COUNT(*) as n FROM conversions GROUP BY file_type').all()
  const recent = d.prepare('SELECT * FROM conversions ORDER BY id DESC LIMIT 50').all()
  return { total, success, failed, today, thisWeek, byType, recent }
}
