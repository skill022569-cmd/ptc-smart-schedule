// หน้าแรกสาธารณะ: ดูตารางเรียนที่ประกาศแล้ว แยกตามแผนก/กลุ่มเรียน (ไม่ต้องล็อกอิน)
import { esc, $, $$, modal } from './ui.js';
import { renderGrid, indexLookup } from './grid.js';
import { DAYS } from '/shared/conflicts.js';
import { showGuide } from './guide.js';
$('#guide-btn').onclick = () => showGuide('public');

const fmt = d => new Date(d).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
if (new URLSearchParams(location.search).has('preview')) $('#preview-bar').classList.remove('hidden');

const data = await (await fetch('/api/public/schedule')).json();
const L = indexLookup(data);
const depts = [...new Set(data.groups.map(g => g.department))].sort((a, b) => a.localeCompare(b, 'th'));
const saved = (() => { try { return JSON.parse(localStorage.getItem('pubView') || '{}'); } catch { return {}; } })();
let dept = depts.includes(saved.dept) ? saved.dept : depts[0];
let group = saved.group;


// ภาคเรียนไทย: 1 = พ.ค.–ต.ค., 2 = พ.ย.–เม.ย. (ม.ค.–เม.ย. นับเป็นภาค 2 ของปีการศึกษาก่อนหน้า)
// shortcut: คำนวณจากวันที่ปัจจุบัน — ถ้าวิทยาลัยเปิด/ปิดภาคไม่ตรงนี้ ให้เพิ่มช่องตั้งค่าภาคเรียน
const semester = (d = new Date()) => { const m = d.getMonth() + 1, y = d.getFullYear() + 543; return m >= 5 && m <= 10 ? `1/${y}` : `2/${m <= 4 ? y - 1 : y}`; };
$('#ver').textContent = data.version ? `ภาคเรียนที่ ${semester()} · อัปเดต ${fmt(data.version.created_at)}` : 'ยังไม่มีตารางที่ประกาศใช้';
const SIGNERS = ['หัวหน้าแผนกวิชา', 'หัวหน้างานพัฒนาหลักสูตรและการจัดการเรียนรู้', 'รองผู้อำนวยการฝ่ายวิชาการ', 'ผู้อำนวยการ'];

// หัวฟอร์ม: ตรา + ข้อมูลกลุ่ม | ตารางรายวิชา (ท.=ทฤษฎี ป.=ปฏิบัติ น.=หน่วยกิต ช.=ชั่วโมง/สัปดาห์)
// shortcut: ท./ป. คิดจากประเภทวิชา (ทฤษฎีหรือปฏิบัติล้วน) — ถ้าต้องการแบบ 1-3-2 ให้เพิ่มคอลัมน์ชั่วโมงทฤษฎี/ปฏิบัติในรายวิชา
function formHead(g) {
  const mine = data.entries.filter(e => e.group_id === g.id);
  const rows = [...new Set(mine.map(e => e.subject_id))].map(id => {
    const s = L.subject[id] || {}, h = mine.filter(e => e.subject_id === id).length;
    return { code: s.code, name: s.name, t: s.type === 'practice' ? 0 : h, p: s.type === 'practice' ? h : 0, n: s.credits || 0, h };
  }).sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const per = Math.max(8, Math.ceil(rows.length / 2));
  const cell = r => r ? `<td class="c">${esc(r.code)}</td><td>${esc(r.name)}</td><td class="c">${r.t}</td><td class="c">${r.p}</td><td class="c">${r.n}</td><td class="c">${r.h}</td>`
    : '<td></td><td></td><td></td><td></td><td></td><td></td>';
  const sum = k => rows.reduce((a, r) => a + r[k], 0);
  const half = '<col class="code"><col><col class="num"><col class="num"><col class="num"><col class="num">';
  const hd = '<th>รหัสวิชา</th><th>ชื่อรายวิชา</th><th>ท.</th><th>ป.</th><th>น.</th><th>ช.</th>';
  return `<div class="form-head">
    <div class="fh-left">
      <div class="emblem-wrap"><img class="emblem" src="/logo.png" alt="ตราวิทยาลัย" onerror="this.style.display='none'"></div>
      <div class="college">วิทยาลัยการอาชีพโพนทอง</div>
      <dl><dt>ภาคเรียนที่</dt><dd>${semester()}</dd><dt>ครูที่ปรึกษา</dt><dd>${esc(g.advisor || '—')}</dd>
        <dt>รหัสกลุ่มเรียน</dt><dd>${esc(g.code)}</dd><dt>ชื่อกลุ่มเรียน</dt><dd>${esc(g.level)} ${esc(g.department)} ปี ${g.year}${g.program !== 'ปกติ' ? ` (${esc(g.program)})` : ''}</dd></dl>
    </div>
    <div class="table-wrap"><table class="subj"><colgroup>${half}${half}</colgroup>
      <tr>${hd}${hd}</tr>
      ${Array.from({ length: per }, (_, i) => `<tr>${cell(rows[i])}${cell(rows[i + per])}</tr>`).join('')}
      <tr><th colspan="2" style="text-align:right">รวม</th><td class="c">${sum('t')}</td><td class="c">${sum('p')}</td><td class="c">${sum('n')}</td><td class="c">${sum('h')}</td><td colspan="6"></td></tr>
    </table></div>
  </div>`;
}

function draw() {
  const groups = data.groups.filter(g => g.department === dept);
  if (!groups.some(g => g.id === group)) group = groups[0]?.id;
  try { localStorage.setItem('pubView', JSON.stringify({ dept, group })); } catch { /* ไม่จำก็ได้ */ }
  $('#depts').innerHTML = depts.map(d => `<button data-d="${esc(d)}" class="${d === dept ? 'active' : ''}">${esc(d)}</button>`).join('') || '<span class="muted">ยังไม่มีข้อมูลแผนก</span>';
  $$('#depts button').forEach(b => b.onclick = () => { dept = b.dataset.d; draw(); });
  $('#grp').innerHTML = groups.map(g => `<option value="${g.id}" ${g.id === group ? 'selected' : ''}>${esc(g.code)} — ${esc(g.level)} ปี ${g.year}${g.program !== 'ปกติ' ? ` (${esc(g.program)})` : ''}</option>`).join('');
  $('#grp').onchange = e => { group = e.target.value; draw(); };
  const g = L.group[group];
  if (!data.version || !g) { $('#form-head').innerHTML = $('#signs').innerHTML = ''; $('#grid').innerHTML = '<p class="muted">ยังไม่มีตารางเรียนให้แสดง</p>'; return; }
  $('#form-head').innerHTML = formHead(g);
  renderGrid($('#grid'), { entries: data.entries, L, view: { type: 'group', id: group }, onClick: info, fullGrid: printing });
  $('#signs').innerHTML = `<div class="signs">${SIGNERS.map(r => `<div><div class="ln">ลงชื่อ.............................................</div><div>(.............................................)</div><div>${r}</div></div>`).join('')}</div>`;
}

function info(e) {
  const s = L.subject[e.subject_id], t = L.teacher[e.teacher_id], r = L.room[e.room_id], g = L.group[e.group_id];
  const p = data.periods.find(x => x.day === e.day && x.period_no === e.period_no);
  modal(`<h2>${esc(s?.name)}</h2><p class="muted">${esc(s?.code)} · ${s?.type === 'practice' ? 'ปฏิบัติ' : 'ทฤษฎี'} · ${s?.credits} หน่วยกิต</p>
    <table class="list"><tr><td>วัน/เวลา</td><td>วัน${DAYS[e.day]} คาบ ${e.period_no} ${p ? `(${p.start_time.slice(0, 5)}-${p.end_time.slice(0, 5)} น.)` : ''}</td></tr>
    <tr><td>ครูผู้สอน</td><td>${esc(t?.full_name)}</td></tr><tr><td>กลุ่มเรียน</td><td>${esc(g?.code)} ${esc(g?.department)}</td></tr>
    <tr><td>สถานที่</td><td>${esc(r?.building)} ห้อง ${esc(r?.code)}</td></tr></table>
    <button class="btn" data-close style="margin-top:16px">ปิด</button>`);
}

// กันตารางล้นไปหน้า 2: ตอนเข้าโหมดพิมพ์ ถ้าสูงเกิน A4 แนวนอน (พื้นที่พิมพ์ ~194mm) ให้ย่อทั้งหน้าลงจนพอดี
const PAGE_H = 194 * 96 / 25.4;
matchMedia('print').addEventListener('change', mq => {
  const main = $('main');
  main.style.zoom = '';
  const h = main.getBoundingClientRect().height;
  if (mq.matches && h > PAGE_H) main.style.zoom = (PAGE_H / h * 0.97).toFixed(3);
});
// พิมพ์จากมือถือ: สลับเป็นตารางเต็มก่อนพิมพ์ แล้วกลับเป็นแบบรายวัน
let printing = false;
addEventListener('beforeprint', () => { printing = true; draw(); });
addEventListener('afterprint', () => { printing = false; draw(); });
draw();
