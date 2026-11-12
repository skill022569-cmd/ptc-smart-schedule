import zlib from 'node:zlib';
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

// ---------- Excel (.xlsx): แต่ละตาราง = 1 แผ่นงาน — สร้างเองจาก zlib ไม่ต้องพึ่งไลบรารีเพิ่ม ----------
const xmlEsc = v => String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const colName = i => { let s = ''; for (let n = i + 1; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
function sheetXml(rows) {
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const cell = (v, r, c) => {
    if (v === null || v === undefined || v === '') return '';
    const ref = colName(c) + (r + 1);
    if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(typeof v === 'object' ? JSON.stringify(v) : v)}</t></is></c>`;
  };
  const body = [cols, ...rows.map(r => cols.map(k => r[k]))].map((vals, r) => `<row r="${r + 1}">${vals.map((v, c) => cell(v, r, c)).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}
// ZIP แบบ deflate (โครงสร้างไฟล์ .xlsx)
export function zip(files) {
  const local = [], central = []; let off = 0;
  for (const f of files) {
    const name = Buffer.from(f.name), raw = Buffer.from(f.data), comp = zlib.deflateRawSync(raw), crc = zlib.crc32(raw);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(name.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(off, 42);
    local.push(h, name, comp); central.push(c, name);
    off += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...local, cd, end]);
}
export function xlsxFrom(sheets) { // [{ name, rows }]
  const ws = (i) => `xl/worksheets/sheet${i + 1}.xml`;
  return zip([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/${ws(i)}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>` },
    ...sheets.map((s, i) => ({ name: ws(i), data: sheetXml(s.rows) })),
  ]);
}
export async function toXlsx() {
  const sheets = [];
  for (const t of BACKUP_TABLES) sheets.push({ name: t, rows: await allRows(t) });
  return xlsxFrom(sheets);
}
