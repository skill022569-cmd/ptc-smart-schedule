import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
// backup.js ต่อ Supabase ตอนโหลด — ใส่ค่าหลอกไว้ (เทสต์นี้ไม่ได้เรียกฐานข้อมูลจริง)
process.env.SUPABASE_URL ||= 'http://localhost'; process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test';
const { xlsxFrom } = await import('../server/backup.js');

// อ่าน ZIP กลับจาก central directory แล้วแตกไฟล์ (ตรวจว่าไฟล์ .xlsx ที่สร้างถูกโครงสร้าง)
function unzip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const n = buf.readUInt16LE(end + 10); let p = buf.readUInt32LE(end + 16); const out = {};
  for (let i = 0; i < n; i++) {
    const size = buf.readUInt32LE(p + 20), len = buf.readUInt16LE(p + 28), off = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + len).toString();
    const data = buf.subarray(off + 30 + buf.readUInt16LE(off + 26), off + 30 + buf.readUInt16LE(off + 26) + size);
    out[name] = zlib.inflateRawSync(data).toString(); p += 46 + len;
  }
  return out;
}

test('สร้างไฟล์ Excel (.xlsx) ถูกโครงสร้าง ภาษาไทยและอักขระพิเศษไม่เพี้ยน', () => {
  const files = unzip(xlsxFrom([{ name: 'subjects', rows: [{ code: '20000-1101', name: 'ภาษาไทย <&> "ทดสอบ"', credits: 2, extra: { a: 1 }, none: null }] }, { name: 'empty', rows: [] }]));
  assert.ok(files['[Content_Types].xml'].includes('/xl/worksheets/sheet2.xml'));
  assert.ok(files['xl/workbook.xml'].includes('name="subjects"'));
  const sh = files['xl/worksheets/sheet1.xml'];
  assert.ok(sh.includes('ภาษาไทย &lt;&amp;&gt; &quot;ทดสอบ&quot;'));
  assert.ok(sh.includes('<c r="C2"><v>2</v></c>'));
  assert.ok(sh.includes('{&quot;a&quot;:1}'));
});
