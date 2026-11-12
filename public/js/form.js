// แบบฟอร์มตารางเรียนราชการ (ใช้ร่วมกัน: หน้าบุคคลทั่วไป และปุ่มพิมพ์ของหน้าจัดตาราง)
import { esc } from './ui.js';
import { renderGrid } from './grid.js';

// ภาคเรียนไทย: 1 = พ.ค.–ต.ค., 2 = พ.ย.–เม.ย. (ม.ค.–เม.ย. นับเป็นภาค 2 ของปีการศึกษาก่อนหน้า)
// shortcut: คำนวณจากวันที่ปัจจุบัน — ถ้าวิทยาลัยเปิด/ปิดภาคไม่ตรงนี้ ให้เพิ่มช่องตั้งค่าภาคเรียน
export const semester = (d = new Date()) => { const m = d.getMonth() + 1, y = d.getFullYear() + 543; return m >= 5 && m <= 10 ? `1/${y}` : `2/${m <= 4 ? y - 1 : y}`; };
const SIGNERS = ['หัวหน้าแผนกวิชา', 'หัวหน้างานพัฒนาหลักสูตรและการจัดการเรียนรู้', 'รองผู้อำนวยการฝ่ายวิชาการ', 'ผู้อำนวยการ'];
const KEY = { group: 'group_id', teacher: 'teacher_id', room: 'room_id' };

// หัวข้อด้านซ้ายของฟอร์ม ตามมุมมอง กลุ่มเรียน / ครู / ห้อง
function infoOf(L, view, mine) {
  const sem = ['ภาคเรียนที่', semester()];
  if (view.type === 'teacher') {
    const t = L.teacher[view.id] || {};
    return ['ตารางสอน', [sem, ['ชื่อครูผู้สอน', t.full_name], ['แผนก', t.department || '—'], ['จำนวนคาบสอน', `${mine.length} คาบ/สัปดาห์`]]];
  }
  if (view.type === 'room') {
    const r = L.room[view.id] || {};
    return ['ตารางการใช้ห้อง', [sem, ['ห้อง', r.code], ['อาคาร', r.building || '—'], ['ใช้งาน', `${mine.length} คาบ/สัปดาห์`]]];
  }
  const g = L.group[view.id] || {};
  return ['ตารางเรียน', [sem, ['ครูที่ปรึกษา', g.advisor || '—'], ['รหัสกลุ่มเรียน', g.code],
    ['ชื่อกลุ่มเรียน', `${g.level || ''} ${g.department || ''} ปี ${g.year || ''}${g.program && g.program !== 'ปกติ' ? ` (${g.program})` : ''}`]]];
}

// ตารางรายวิชา (ท.=ทฤษฎี ป.=ปฏิบัติ น.=หน่วยกิต ช.=ชั่วโมง/สัปดาห์)
// shortcut: ท./ป. คิดจากประเภทวิชา (ทฤษฎีหรือปฏิบัติล้วน) — ถ้าต้องการแบบ 1-3-2 ให้เพิ่มคอลัมน์ชั่วโมงทฤษฎี/ปฏิบัติในรายวิชา
function subjectTable(L, mine) {
  const rows = [...new Set(mine.map(e => e.subject_id))].map(id => {
    const s = L.subject[id] || {}, h = mine.filter(e => e.subject_id === id).length;
    return { code: s.code, name: s.name, t: s.type === 'practice' ? 0 : h, p: s.type === 'practice' ? h : 0, n: s.credits || 0, h };
  }).sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const per = Math.max(5, Math.ceil(rows.length / 2));
  const cell = r => r ? `<td class="c">${esc(r.code)}</td><td>${esc(r.name)}</td><td class="c">${r.t}</td><td class="c">${r.p}</td><td class="c">${r.n}</td><td class="c">${r.h}</td>`
    : '<td></td><td></td><td></td><td></td><td></td><td></td>';
  const sum = k => rows.reduce((a, r) => a + r[k], 0);
  const half = '<col class="code"><col><col class="num"><col class="num"><col class="num"><col class="num">';
  const hd = '<th>รหัสวิชา</th><th>ชื่อรายวิชา</th><th>ท.</th><th>ป.</th><th>น.</th><th>ช.</th>';
  return `<div class="table-wrap"><table class="subj"><colgroup>${half}${half}</colgroup>
    <tr>${hd}${hd}</tr>
    ${Array.from({ length: per }, (_, i) => `<tr>${cell(rows[i])}${cell(rows[i + per])}</tr>`).join('')}
    <tr><th colspan="2" style="text-align:right">รวม</th><td class="c">${sum('t')}</td><td class="c">${sum('p')}</td><td class="c">${sum('n')}</td><td class="c">${sum('h')}</td><td colspan="6"></td></tr>
  </table></div>`;
}

export function renderForm(el, { L, entries, view, onClick, fullGrid = false }) {
  const mine = entries.filter(e => e[KEY[view.type]] === view.id);
  const [title, info] = infoOf(L, view, mine);
  el.innerHTML = `<div class="form-head">
      <div class="fh-left">
        <div class="emblem-wrap"><img class="emblem" src="/logo.png" alt="ตราวิทยาลัย" onerror="this.style.display='none'"></div>
        <div class="college">วิทยาลัยการอาชีพโพนทอง</div><div class="form-title">${title}</div>
        <dl>${info.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v ?? '—')}</dd>`).join('')}</dl>
      </div>
      ${subjectTable(L, mine)}
    </div>
    <div class="form-grid"></div>
    <div class="signs">${SIGNERS.map(r => `<div><div class="ln">ลงชื่อ.............................................</div><div>(.............................................)</div><div>${r}</div></div>`).join('')}</div>`;
  renderGrid(el.querySelector('.form-grid'), { entries, L, view, onClick, fullGrid });
}
