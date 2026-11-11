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

$('#ver').textContent = data.version ? `อัปเดตล่าสุด ${fmt(data.version.created_at)}` : 'ยังไม่มีตารางที่ประกาศใช้';

function draw() {
  const groups = data.groups.filter(g => g.department === dept);
  if (!groups.some(g => g.id === group)) group = groups[0]?.id;
  try { localStorage.setItem('pubView', JSON.stringify({ dept, group })); } catch { /* ไม่จำก็ได้ */ }
  $('#depts').innerHTML = depts.map(d => `<button data-d="${esc(d)}" class="${d === dept ? 'active' : ''}">${esc(d)}</button>`).join('') || '<span class="muted">ยังไม่มีข้อมูลแผนก</span>';
  $$('#depts button').forEach(b => b.onclick = () => { dept = b.dataset.d; draw(); });
  $('#grp').innerHTML = groups.map(g => `<option value="${g.id}" ${g.id === group ? 'selected' : ''}>${esc(g.code)} — ${esc(g.level)} ปี ${g.year}${g.program !== 'ปกติ' ? ` (${esc(g.program)})` : ''}</option>`).join('');
  $('#grp').onchange = e => { group = e.target.value; draw(); };
  const g = L.group[group];
  const n = data.entries.filter(e => e.group_id === group).length;
  $('#info').innerHTML = g ? `กลุ่ม <b>${esc(g.code)}</b> · ${esc(g.level)} ${esc(g.department)} ปี ${g.year} · <span class="badge pri">${n} คาบ/สัปดาห์</span>` : '';
  if (!data.version || !g) { $('#grid').innerHTML = '<p class="muted">ยังไม่มีตารางเรียนให้แสดง</p>'; return; }
  renderGrid($('#grid'), { entries: data.entries, L, view: { type: 'group', id: group }, onClick: info, fullGrid: printing });
}

function info(e) {
  const s = L.subject[e.subject_id], t = L.teacher[e.teacher_id], r = L.room[e.room_id], g = L.group[e.group_id];
  const p = data.periods.find(x => x.day === e.day && x.period_no === e.period_no);
  modal(`<h2>${esc(s?.name)}</h2><p class="muted">${esc(s?.code)} · ${s?.type === 'practice' ? 'ปฏิบัติ' : 'ทฤษฎี'} · ${s?.credits} หน่วยกิต</p>
    <table class="list"><tr><td>🗓 วัน/เวลา</td><td>${DAYS[e.day]} คาบ ${e.period_no} ${p ? `(${p.start_time.slice(0, 5)}-${p.end_time.slice(0, 5)} น.)` : ''}</td></tr>
    <tr><td>👩‍🏫 ครูผู้สอน</td><td>${esc(t?.full_name)}</td></tr><tr><td>👥 กลุ่มเรียน</td><td>${esc(g?.code)} ${esc(g?.department)}</td></tr>
    <tr><td>📍 สถานที่</td><td>${esc(r?.building)} ห้อง ${esc(r?.code)}</td></tr></table>
    <button class="btn" data-close style="margin-top:16px">ปิด</button>`);
}

// พิมพ์จากมือถือ: สลับเป็นตารางเต็มก่อนพิมพ์ แล้วกลับเป็นแบบรายวัน
let printing = false;
addEventListener('beforeprint', () => { printing = true; draw(); });
addEventListener('afterprint', () => { printing = false; draw(); });
draw();
