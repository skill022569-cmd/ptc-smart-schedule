import { db, q, log } from './db.js';

export const BACKUP_TABLES = ['users', 'student_groups', 'teachers', 'students', 'subjects', 'classrooms', 'periods',
  'offerings', 'timetable_versions', 'timetable', 'time_block_requests', 'logs']; // เรียงตาม foreign key

async function allRows(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = await q(db.from(table).select('*').range(from, from + 999));
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const sqlVal = v => v === null || v === undefined ? 'NULL'
  : typeof v === 'number' || typeof v === 'boolean' ? String(v)
  : `'${(typeof v === 'object' ? JSON.stringify(v) : String(v)).replace(/'/g, "''")}'`;

export async function toSql() {
  let out = `-- PTC Smart Schedule backup ${new Date().toISOString()}\nbegin;\n`;
  for (const t of BACKUP_TABLES) {
    for (const r of await allRows(t)) {
      const cols = Object.keys(r);
      out += `insert into ${t} (${cols.join(',')}) ${t === 'logs' ? 'overriding system value ' : ''}values (${cols.map(c => sqlVal(r[c])).join(',')}) on conflict do nothing;\n`;
    }
  }
  return out + 'commit;\n';
}

const csvCell = v => { const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function toCsv(rows) {
  if (!rows.length) return '﻿';
  const cols = Object.keys(rows[0]);
  return '﻿' + [cols.join(','), ...rows.map(r => cols.map(c => csvCell(r[c])).join(','))].join('\n'); // BOM ให้ Excel อ่านภาษาไทยถูก
}
export const tableCsv = async t => toCsv(await allRows(t));

// เรียกจาก GitHub Actions ทุกวัน 02:00 น. (scripts/backup.js)
export async function backupToStorage() {
  const name = `ptc-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
  const { error } = await db.storage.from('backups').upload(name, new Blob([await toSql()], { type: 'application/sql' }));
  if (error) throw error;
  await log(null, 'backup', { file: name, auto: true });
  return name;
}
