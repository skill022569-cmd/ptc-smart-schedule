import { api, esc, $, $$, toast, modal, busy, countUp, download } from './ui.js';
import { renderGrid, indexLookup } from './grid.js';
import { findConflicts, DAYS } from '/shared/conflicts.js';

const ROLE = { admin: 'ฝ่ายวิชาการ / ผู้ดูแลระบบ', teacher: 'ครูผู้สอน', student: 'นักเรียน / นักศึกษา' };
const NAV = {
  admin: [['ภาพรวม'], ['dashboard', '📊', 'แผงควบคุม'], ['schedule', '🤖', 'จัดตารางสอน'], ['timeblocks', '⏳', 'คำร้องบล็อกเวลา'],
    ['ข้อมูลหลัก'], ['teachers', '👩‍🏫', 'ครูผู้สอน'], ['subjects', '📚', 'รายวิชา'], ['classrooms', '🏫', 'ห้องเรียน/โรงฝึกงาน'],
    ['student_groups', '👥', 'กลุ่มเรียน'], ['students', '🎓', 'นักเรียน'], ['periods', '🕘', 'เวลา-คาบเรียน'], ['offerings', '🧩', 'แผนการสอน'],
    ['ความปลอดภัย'], ['backup', '💾', 'สำรองข้อมูล'], ['logs', '🛡️', 'บันทึกกิจกรรม'], ['profile', '⚙️', 'ข้อมูลส่วนตัว']],
  teacher: [['my', '📅', 'ตารางสอนของฉัน'], ['timeblock', '⏳', 'แจ้งเวลาไม่สะดวก'], ['mystudents', '👥', 'รายชื่อนักเรียน'], ['profile', '⚙️', 'ข้อมูลส่วนตัว & PDPA']],
  student: [['my', '📅', 'ตารางเรียนของฉัน'], ['profile', '⚙️', 'ข้อมูลส่วนตัว & PDPA']],
};
const STATUS = { draft: ['ฉบับร่าง', 'warn'], published: ['ประกาศใช้', 'ok'], archived: ['เก็บถาวร', ''], pending: ['รออนุมัติ', 'warn'], approved: ['อนุมัติ', 'ok'], rejected: ['ไม่อนุมัติ', 'bad'] };
const badge = s => `<span class="badge ${STATUS[s]?.[1] || ''}">${esc(STATUS[s]?.[0] || s)}</span>`;
const fmtDate = d => d ? new Date(d).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
const page = () => $('#page');
let me, L;

// ======================= เริ่มต้น =======================
async function boot() {
  me = await api('/me');
  L = indexLookup(await api('/lookup'));
  $('#me-name').textContent = me.full_name;
  $('#me-role').textContent = ROLE[me.role];
  $('#me-av').textContent = me.full_name.replace(/^(นาย|นางสาว|นาง)/, '').trim()[0] || '?';
  $('#nav').innerHTML = NAV[me.role].map(([k, i, t]) => i ? `<a href="#${k}" data-k="${k}"><span>${i}</span>${esc(t)}</a>` : `<div class="sec">${esc(k)}</div>`).join('');
  $('#menu').onclick = () => $('#side').classList.toggle('open');
  $('#logout').onclick = async () => { await api('/auth/logout', { method: 'POST' }); location.href = '/'; };
  window.onhashchange = route;
  if (!me.pdpa_consent_at) pdpaModal();
  route();
}

function pdpaModal() {
  const m = modal(`<h2>🔒 นโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA)</h2>
    <p>วิทยาลัยการอาชีพโพนทองเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของท่าน ได้แก่ ชื่อ-สกุล รหัสประจำตัว กลุ่มเรียน/แผนก เบอร์โทรศัพท์ และอีเมล
    เพื่อวัตถุประสงค์ในการจัดตารางเรียน-ตารางสอน ยืนยันตัวตน (OTP) และแจ้งเตือนความปลอดภัยเท่านั้น</p>
    <ul class="muted"><li>ข้อมูลเบอร์โทร/อีเมลถูกเข้ารหัส (AES-256) และแสดงผลแบบปิดบังบางส่วน</li>
    <li>ท่านมีสิทธิ์ขอดู ขอสำเนา แก้ไข หรือขอลบข้อมูล ได้ที่เมนู "ข้อมูลส่วนตัว & PDPA"</li>
    <li>ข้อมูลจะถูกเก็บตลอดระยะเวลาการศึกษา/การปฏิบัติงาน และสำรองข้อมูลอย่างปลอดภัย</li></ul>
    <div class="row" style="margin-top:18px"><button class="btn ghost" id="pd-no">ไม่ยอมรับ (ออกจากระบบ)</button><button class="btn ok" id="pd-yes">✔ ยอมรับและเข้าใช้งาน</button></div>`, { closable: false });
  $('#pd-yes', m).onclick = async () => { await api('/me/consent', { method: 'POST' }); m.remove(); toast('ขอบคุณที่ยอมรับนโยบาย PDPA', 'ok'); };
  $('#pd-no', m).onclick = () => $('#logout').click();
}

function route() {
  const k = location.hash.slice(1) || NAV[me.role].find(n => n[1])[0];
  const item = NAV[me.role].find(n => n[0] === k && n[1]);
  if (!item) { location.hash = NAV[me.role].find(n => n[1])[0]; return; }
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.k === k));
  $('#title').textContent = item[2];
  $('#side').classList.remove('open');
  page().innerHTML = '<div class="card"><div class="skeleton"></div><div class="skeleton" style="width:70%"></div></div>';
  (PAGES[k] || (() => masterPage(k)))().catch(e => { if (e.message !== 'session') page().innerHTML = `<div class="card">⚠ ${esc(e.message)}</div>`; });
}

// ======================= ตารางของฉัน (ครู/นักเรียน) =======================
async function mySchedule() {
  const { version, entries } = await api('/my/schedule');
  const view = me.teacher ? { type: 'teacher', id: me.teacher.id } : { type: 'group', id: me.student?.group_id };
  const g = me.student?.group;
  page().innerHTML = `<div class="card reveal">
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>${version ? `${badge('published')} <span class="muted">${esc(version.name)}</span>` : '<span class="badge warn">ฝ่ายวิชาการยังไม่ประกาศตาราง</span>'}
      ${g ? `<div style="margin-top:6px">กลุ่ม <b>${esc(g.code)}</b> · ${esc(g.level)} ${esc(g.department)} ปี ${g.year}</div>` : ''}
      ${me.teacher ? `<div style="margin-top:6px">รวม <b>${entries.length}</b> คาบ/สัปดาห์</div>` : ''}</div>
      <button class="btn ghost sm no-print" onclick="print()">🖨 พิมพ์ / PDF</button></div>
    <div id="grid"></div><p class="muted no-print" style="font-size:.8rem">แตะที่คาบเรียนเพื่อดูรายละเอียด</p></div>`;
  renderGrid($('#grid'), { entries, L, view, onClick: classInfo });
}

function classInfo(e) {
  const s = L.subject[e.subject_id], t = L.teacher[e.teacher_id], r = L.room[e.room_id], g = L.group[e.group_id];
  const p = L.periods.find(x => x.day === e.day && x.period_no === e.period_no);
  modal(`<h2>${esc(s?.name)}</h2><p class="muted">${esc(s?.code)} · ${s?.type === 'practice' ? 'ปฏิบัติ' : 'ทฤษฎี'} · ${s?.credits} หน่วยกิต</p>
    <table class="list"><tr><td>🗓 วัน/เวลา</td><td>${DAYS[e.day]} คาบ ${e.period_no} ${p ? `(${p.start_time.slice(0, 5)}-${p.end_time.slice(0, 5)} น.)` : ''}</td></tr>
    <tr><td>👩‍🏫 ครูผู้สอน</td><td>${esc(t?.full_name)}</td></tr><tr><td>👥 กลุ่มเรียน</td><td>${esc(g?.code)} ${esc(g?.department)}</td></tr>
    <tr><td>📍 สถานที่</td><td>${esc(r?.building)} ห้อง ${esc(r?.code)}</td></tr></table>
    <button class="btn" data-close style="margin-top:16px">ปิด</button>`);
}

// ======================= ครู =======================
async function timeblockPage() {
  const list = await api('/my/timeblocks');
  const nums = [...new Set(L.periods.map(p => p.period_no))];
  const opt = nums.map(n => `<option value="${n}">คาบ ${n}</option>`).join('');
  page().innerHTML = `<div class="grid2"><form class="card reveal" id="f-tb"><h3>ส่งคำร้องช่วงเวลาไม่สะดวกสอน</h3>
    <label>วัน</label><select name="day">${[1, 2, 3, 4, 5, 6, 7].map(d => `<option value="${d}">${DAYS[d]}</option>`).join('')}</select>
    <div class="row"><div><label>ตั้งแต่</label><select name="period_from">${opt}</select></div><div><label>ถึง</label><select name="period_to">${opt}</select></div></div>
    <label>เหตุผล</label><input name="reason" placeholder="เช่น ติดราชการ, อบรม" maxlength="300">
    <button class="btn" style="margin-top:16px">📨 ส่งคำร้องไปฝ่ายวิชาการ</button></form>
    <div class="card reveal" style="animation-delay:.1s"><h3>คำร้องของฉัน</h3><div class="table-wrap"><table class="list"><thead><tr><th>วัน</th><th>คาบ</th><th>เหตุผล</th><th>สถานะ</th></tr></thead><tbody>
    ${list.map(r => `<tr><td>${DAYS[r.day]}</td><td>${r.period_from}-${r.period_to}</td><td>${esc(r.reason)}</td><td>${badge(r.status)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">ยังไม่มีคำร้อง</td></tr>'}
    </tbody></table></div></div></div>`;
  $('#f-tb').onsubmit = e => { e.preventDefault(); busy(e.submitter, async () => { await api('/my/timeblocks', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('ส่งคำร้องแล้ว', 'ok'); timeblockPage(); }); };
}

async function myStudents() {
  const groups = await api('/my/students');
  page().innerHTML = groups.map((g, i) => `<div class="card reveal" style="margin-bottom:16px;animation-delay:${i * .07}s">
    <h3>👥 ${esc(g.code)} <span class="muted" style="font-size:.9rem">${esc(g.level)} ${esc(g.department)} · ${g.students.length} คน</span></h3>
    <div class="table-wrap"><table class="list"><thead><tr><th>#</th><th>รหัสนักเรียน</th><th>ชื่อ-สกุล</th><th>หมายเหตุ</th></tr></thead><tbody>
    ${g.students.map((s, j) => `<tr><td>${j + 1}</td><td>${esc(s.code)}</td><td>${esc(s.name)}</td><td>${esc(s.special || '')}</td></tr>`).join('')}</tbody></table></div></div>`).join('')
    || '<div class="card">ยังไม่มีกลุ่มเรียนที่รับผิดชอบ</div>';
}

// ======================= ข้อมูลส่วนตัว & PDPA =======================
async function profilePage() {
  me = await api('/me');
  page().innerHTML = `<div class="grid2">
    <form class="card reveal" id="f-prof"><h3>📇 ข้อมูลติดต่อ</h3>
      <p class="muted">${esc(me.username)} · ${esc(me.full_name)}</p>
      <label>เบอร์โทรศัพท์ (รับ OTP) — ปัจจุบัน: <b>${esc(me.phone || 'ยังไม่ระบุ')}</b></label><input name="phone" inputmode="numeric" placeholder="กรอกเบอร์ใหม่ 10 หลัก" maxlength="10">
      <label>อีเมล — ปัจจุบัน: <b>${esc(me.email || 'ยังไม่ระบุ')}</b></label><input name="email" type="email" placeholder="กรอกอีเมลใหม่">
      <button class="btn" style="margin-top:16px">บันทึก</button></form>
    <form class="card reveal" id="f-pw" style="animation-delay:.08s"><h3>🔑 เปลี่ยนรหัสผ่าน</h3>
      <label>รหัสผ่านเดิม</label><input name="old" type="password" required autocomplete="current-password">
      <label>รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</label><input name="password" type="password" minlength="8" required autocomplete="new-password">
      <button class="btn" style="margin-top:16px">เปลี่ยนรหัสผ่าน</button></form>
    <div class="card reveal" style="animation-delay:.16s"><h3>🛡️ สิทธิ์ของเจ้าของข้อมูล (PDPA)</h3>
      <p>ยอมรับนโยบายเมื่อ: <b>${fmtDate(me.pdpa_consent_at)}</b></p>
      <div class="row"><button class="btn ghost" id="pd-exp">⬇ ขอสำเนาข้อมูลของฉัน</button><button class="btn danger" id="pd-del">🗑 ขอลบข้อมูล</button></div></div></div>`;
  $('#f-prof').onsubmit = e => {
    e.preventDefault();
    const body = Object.fromEntries([...new FormData(e.target)].filter(([, v]) => v));
    if (!Object.keys(body).length) return toast('ยังไม่ได้กรอกข้อมูลใหม่');
    busy(e.submitter, async () => { await api('/me', { method: 'PUT', body }); toast('บันทึกแล้ว', 'ok'); profilePage(); });
  };
  $('#f-pw').onsubmit = e => { e.preventDefault(); busy(e.submitter, async () => { await api('/me/password', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); toast('เปลี่ยนรหัสผ่านแล้ว', 'ok'); e.target.reset(); }); };
  $('#pd-exp').onclick = () => download('/api/me/export');
  $('#pd-del').onclick = () => {
    const m = modal(`<h3>ขอลบข้อมูลส่วนบุคคล</h3><p class="muted">คำขอจะส่งถึงฝ่ายวิชาการเพื่อพิจารณา (ข้อมูลที่จำเป็นตามระเบียบสถานศึกษาอาจต้องเก็บต่อ)</p>
      <label>เหตุผล</label><textarea id="rs" rows="3"></textarea><div class="row" style="margin-top:14px"><button class="btn ghost" data-close>ยกเลิก</button><button class="btn danger" id="go">ส่งคำขอ</button></div>`);
    $('#go', m).onclick = async () => { const r = await api('/me/delete-request', { method: 'POST', body: { reason: $('#rs', m).value } }); toast(r.message, 'ok'); m.remove(); };
  };
}

// ======================= Admin: แผงควบคุม =======================
async function dashboard() {
  const d = await api('/admin/dashboard');
  const max = Math.max(1, ...d.perDay);
  const stats = [['👩‍🏫', 'ครูผู้สอน', d.teachers], ['🎓', 'นักเรียน', d.students], ['👥', 'กลุ่มเรียน', d.groups], ['📚', 'รายวิชา', d.subjects],
    ['🏫', `ห้องที่ใช้งาน / ${d.rooms}`, d.roomsUsed], ['⏱', 'ชม.สอนเฉลี่ย/ครู', d.avgTeacherHours]];
  page().innerHTML = `<div class="stats">${stats.map(([i, t, n], k) => `<div class="card stat reveal" style="animation-delay:${k * .06}s"><span class="ico">${i}</span><div class="muted">${t}</div><div class="n" data-n="${n}">0</div></div>`).join('')}</div>
    <div class="grid2">
      <div class="card reveal" style="animation-delay:.3s"><h3>📈 จำนวนคาบสอนรายวัน</h3>
        <p class="muted">${d.version ? `ตารางที่ประกาศ: ${esc(d.version.name)}` : 'ยังไม่มีตารางที่ประกาศใช้'}</p>
        <div class="bars">${[1, 2, 3, 4, 5, 6, 7].map((x, i) => `<div><i data-h="${d.perDay[i] / max * 130}"></i>${DAYS[x].slice(0, 3)}<br>${d.perDay[i]}</div>`).join('')}</div></div>
      <div class="card reveal" style="animation-delay:.4s"><h3>🚨 การเข้าสู่ระบบที่น่าสงสัย (7 วัน)</h3>
        <div class="table-wrap" style="max-height:260px"><table class="list"><tbody>${d.suspicious.map(l => `<tr><td>${fmtDate(l.created_at)}</td><td>${esc(l.user?.username || l.detail?.username || '-')}</td><td>${l.action === 'account_locked' ? '<span class="badge bad">ล็อกบัญชี</span>' : l.action === 'otp_failed' ? '<span class="badge warn">OTP ผิด</span>' : '<span class="badge warn">รหัสผิด</span>'}</td><td class="muted">${esc(l.ip || '')}</td></tr>`).join('') || '<tr><td class="muted">ไม่พบความผิดปกติ ✅</td></tr>'}</tbody></table></div></div>
    </div>
    ${d.pending ? `<div class="card reveal" style="margin-top:18px;animation-delay:.5s">⏳ มีคำร้องบล็อกเวลารออนุมัติ <b>${d.pending}</b> รายการ <a href="#timeblocks">ไปที่คำร้อง →</a></div>` : ''}`;
  $$('.stat .n').forEach(countUp);
  requestAnimationFrame(() => setTimeout(() => $$('.bars i').forEach(i => i.style.height = i.dataset.h + 'px'), 300));
}

// ======================= Admin: จัดตารางสอน (AI + โหมดมือ) =======================
const S = { version: null, entries: [], view: { type: 'group', id: null }, undo: [], blocks: [] };

async function schedulePage() {
  const [versions, blocks] = await Promise.all([api('/admin/versions'), api('/admin/timeblocks')]);
  S.blocks = blocks.filter(b => b.status === 'approved');
  if (!S.version || !versions.some(v => v.id === S.version.id)) S.version = versions.find(v => v.status === 'draft') || versions[0] || null;
  else S.version = versions.find(v => v.id === S.version.id);
  S.view.id ||= L.groups[0]?.id;
  page().innerHTML = `<div class="card reveal" style="margin-bottom:16px">
    <div class="row">
      <div style="flex:2 1 260px"><label>เวอร์ชันตาราง (Restore Point)</label><select id="ver">${versions.map(v => `<option value="${v.id}" ${v.id === S.version?.id ? 'selected' : ''}>${esc(v.name)} — ${STATUS[v.status][0]} (${fmtDate(v.created_at)})</option>`).join('')}</select></div>
      <div style="flex:0 0 auto"><button class="btn" id="ai">🤖 AI จัดตารางอัตโนมัติ</button></div>
    </div>
    <div class="row no-print" style="margin-top:12px;flex-wrap:wrap">
      <button class="btn ghost sm" id="snap" style="flex:0 0 auto">📸 Snapshot / กู้คืนเป็นฉบับร่าง</button>
      <button class="btn ghost sm" id="undo" style="flex:0 0 auto">↶ ย้อนกลับ</button>
      <button class="btn ok sm" id="pub" style="flex:0 0 auto">🚀 ประกาศใช้</button>
      <button class="btn ghost sm" id="xls" style="flex:0 0 auto">⬇ Excel</button>
      <button class="btn ghost sm" style="flex:0 0 auto" onclick="print()">🖨 PDF</button>
      <button class="btn danger sm" id="delv" style="flex:0 0 auto">🗑 ลบเวอร์ชัน</button>
    </div></div>
    <div class="card reveal" style="animation-delay:.1s">
      <div class="row" style="align-items:center"><div class="tabs" id="vtabs" style="margin:0;flex:0 0 auto">
        ${[['group', '👥 กลุ่มเรียน'], ['teacher', '👩‍🏫 ครู'], ['room', '🏫 ห้อง']].map(([k, t]) => `<button data-v="${k}" class="${S.view.type === k ? 'active' : ''}">${t}</button>`).join('')}</div>
        <select id="vid"></select><div id="cstat" style="flex:0 0 auto"></div></div>
      <div id="palette-box" class="no-print" style="margin:14px 0"></div>
      <div id="grid"></div></div>`;
  $('#ver').onchange = e => { S.version = versions.find(v => v.id === e.target.value); S.undo = []; loadEntries(); };
  $('#ai').onclick = e => busy(e.currentTarget, runAi);
  $('#snap').onclick = e => S.version && busy(e.currentTarget, async () => { S.version = await api(`/admin/versions/${S.version.id}/snapshot`, { method: 'POST', body: {} }); toast('สร้างสำเนาเป็นฉบับร่างแล้ว แก้ไขได้ทันที', 'ok'); schedulePage(); });
  $('#undo').onclick = undo;
  $('#pub').onclick = e => S.version && busy(e.currentTarget, publish);
  $('#xls').onclick = () => S.version && download(`/api/admin/versions/${S.version.id}/export.csv`);
  $('#delv').onclick = e => S.version && confirm('ลบเวอร์ชันนี้?') && busy(e.currentTarget, async () => { await api(`/admin/versions/${S.version.id}`, { method: 'DELETE' }); S.version = null; schedulePage(); });
  $$('#vtabs button').forEach(b => b.onclick = () => { S.view = { type: b.dataset.v, id: null }; $$('#vtabs button').forEach(x => x.classList.toggle('active', x === b)); fillViewSelect(); draw(); });
  fillViewSelect();
  await loadEntries();
}

function fillViewSelect() {
  const list = { group: L.groups.map(g => [g.id, `${g.code} (${g.level} ${g.department})`]), teacher: L.teachers.map(t => [t.id, t.full_name]), room: L.rooms.map(r => [r.id, `${r.code} ${r.building || ''}`]) }[S.view.type];
  S.view.id ||= list[0]?.[0];
  $('#vid').innerHTML = list.map(([id, n]) => `<option value="${id}" ${id === S.view.id ? 'selected' : ''}>${esc(n)}</option>`).join('');
  $('#vid').onchange = e => { S.view.id = e.target.value; draw(); };
}

async function loadEntries() {
  S.entries = S.version ? await api(`/admin/versions/${S.version.id}/entries`) : [];
  draw();
}

const ctx = () => ({ teachers: L.teacher, rooms: L.room, groups: L.group, subjects: L.subject, blocks: S.blocks });

function draw() {
  if (!$('#grid')) return;
  if (!S.version) { $('#grid').innerHTML = '<p class="muted">ยังไม่มีตาราง — กดปุ่ม "🤖 AI จัดตารางอัตโนมัติ" เพื่อเริ่ม</p>'; $('#palette-box').innerHTML = ''; return; }
  const editable = S.version.status !== 'published';
  const conflicts = findConflicts(S.entries, ctx());
  $('#cstat').innerHTML = conflicts.size ? `<span class="badge bad">⚠ ชนกัน ${conflicts.size} คาบ</span>` : '<span class="badge ok">✔ ไม่มีคาบชน</span>';
  // คาบที่ยังจัดไม่ครบ ลากไปวางในตารางได้ (เฉพาะมุมมองกลุ่มเรียน)
  const pal = $('#palette-box');
  if (editable && S.view.type === 'group') {
    const need = L.offerings.filter(o => o.group_id === S.view.id).map(o => ({ ...o, left: (L.subject[o.subject_id]?.periods_per_week || 0) - S.entries.filter(e => e.group_id === o.group_id && e.subject_id === o.subject_id).length })).filter(o => o.left > 0);
    pal.innerHTML = need.length ? `<div class="muted" style="margin-bottom:6px">🧩 คาบที่ยังไม่ได้จัด — ลากไปวางในตาราง</div><div class="palette">${need.map(o => `<div class="slot" draggable="true" data-new="${o.id}" style="--h:200"><b>${esc(L.subject[o.subject_id]?.name)}</b><div class="muted">${esc(L.teacher[o.teacher_id]?.full_name)} · เหลือ ${o.left} คาบ</div></div>`).join('')}</div>` : '';
    $$('[data-new]', pal).forEach(s => s.ondragstart = ev => ev.dataTransfer.setData('text/plain', 'new:' + s.dataset.new));
  } else pal.innerHTML = editable ? '' : '<span class="badge ok">ตารางนี้ประกาศใช้แล้ว — กด Snapshot เพื่อสร้างฉบับร่างสำหรับแก้ไข</span>';
  renderGrid($('#grid'), { entries: S.entries, L, view: S.view, editable, conflicts, onMove: move, onAdd: add, onClick: e => editable ? editEntry(e, conflicts.get(e.id)) : classInfo(e) });
}

async function runAi() {
  const r = await api('/admin/versions/generate', { method: 'POST', body: {} });
  S.version = r.version; S.undo = [];
  toast(`🤖 AI จัดตารางเสร็จใน ${r.ms} ms — วางแล้ว ${r.placed} คาบ`, 'ok');
  if (r.unplaced.length) modal(`<h3>⚠ มีรายวิชาที่ AI จัดไม่ลง ${r.unplaced.length} รายการ</h3><p class="muted">ตรวจสอบความจุห้อง ชั่วโมงสอนสูงสุดของครู หรือเพิ่มคาบเรียน แล้วสั่งใหม่ หรือลากวางเองในโหมดมือ</p>
    <table class="list">${r.unplaced.map(u => `<tr><td>${esc(L.group[u.group_id]?.code)}</td><td>${esc(L.subject[u.subject_id]?.name)}</td><td>${esc(L.teacher[u.teacher_id]?.full_name)}</td><td>${u.periods} คาบ</td></tr>`).join('')}</table>
    <button class="btn" data-close style="margin-top:14px">ตกลง</button>`);
  await schedulePage();
}

async function move(id, day, period_no, record = true) {
  const e = S.entries.find(x => x.id === id);
  if (!e || (e.day === day && e.period_no === period_no)) return;
  const from = { day: e.day, period_no: e.period_no };
  Object.assign(e, { day, period_no }); draw(); // อัปเดตทันที แล้วค่อยบันทึก
  try { await api(`/admin/entries/${id}`, { method: 'PUT', body: { day, period_no } }); if (record) S.undo.push({ t: 'move', id, from }); }
  catch (err) { Object.assign(e, from); draw(); toast(err.message, 'bad'); }
  const c = findConflicts(S.entries, ctx()).get(id);
  if (c) toast('⚠ ' + c.join(', '), 'bad');
}

async function add(offeringId, day, period_no) {
  const o = L.offerings.find(x => x.id === offeringId);
  const room = L.rooms.find(r => !S.entries.some(e => e.room_id === r.id && e.day === day && e.period_no === period_no) && (L.subject[o.subject_id]?.type === 'practice') === (r.room_type !== 'lecture'));
  const e = await api('/admin/entries', { method: 'POST', body: { version_id: S.version.id, day, period_no, subject_id: o.subject_id, teacher_id: o.teacher_id, group_id: o.group_id, room_id: room?.id } });
  S.entries.push(e); S.undo.push({ t: 'add', id: e.id }); draw();
}

async function removeEntry(e, record = true) {
  await api(`/admin/entries/${e.id}`, { method: 'DELETE' });
  S.entries = S.entries.filter(x => x.id !== e.id);
  if (record) S.undo.push({ t: 'del', entry: e });
  draw();
}

async function undo() {
  const u = S.undo.pop();
  if (!u) return toast('ไม่มีรายการให้ย้อนกลับ');
  if (u.t === 'move') await move(u.id, u.from.day, u.from.period_no, false);
  if (u.t === 'add') await removeEntry(S.entries.find(e => e.id === u.id), false);
  if (u.t === 'room') { await api(`/admin/entries/${u.e.id}`, { method: 'PUT', body: { room_id: u.from } }); u.e.room_id = u.from; draw(); }
  if (u.t === 'del') { const { id, ...rest } = u.entry; S.entries.push(await api('/admin/entries', { method: 'POST', body: rest })); draw(); }
  toast('↶ ย้อนกลับแล้ว');
}

function editEntry(e, problems) {
  const m = modal(`<h3>${esc(L.subject[e.subject_id]?.name)}</h3><p class="muted">${DAYS[e.day]} คาบ ${e.period_no} · ${esc(L.group[e.group_id]?.code)} · ${esc(L.teacher[e.teacher_id]?.full_name)}</p>
    ${problems ? `<p class="badge bad">⚠ ${esc(problems.join(', '))}</p>` : ''}
    <label>ห้องเรียน</label><select id="rm">${L.rooms.map(r => `<option value="${r.id}" ${r.id === e.room_id ? 'selected' : ''}>${esc(r.code)} · ${esc(r.building || '')} · ${r.room_type} · ${r.capacity} ที่นั่ง${S.entries.some(x => x.id !== e.id && x.room_id === r.id && x.day === e.day && x.period_no === e.period_no) ? ' (ไม่ว่าง)' : ''}</option>`).join('')}</select>
    <div class="row" style="margin-top:16px"><button class="btn danger" id="del">ลบคาบนี้</button><button class="btn ghost" data-close>ปิด</button><button class="btn" id="save">บันทึก</button></div>`);
  $('#save', m).onclick = async () => { const room_id = $('#rm', m).value; await api(`/admin/entries/${e.id}`, { method: 'PUT', body: { room_id } }); S.undo.push({ t: 'room', e, from: e.room_id }); e.room_id = room_id; m.remove(); draw(); };
  $('#del', m).onclick = async () => { await removeEntry(e); m.remove(); };
}

async function publish() {
  try { await api(`/admin/versions/${S.version.id}/publish`, { method: 'POST', body: {} }); }
  catch (e) {
    if (e.status !== 409 || !confirm(e.message + '\n\nต้องการประกาศใช้ทั้งที่ยังชนกันหรือไม่?')) throw e;
    await api(`/admin/versions/${S.version.id}/publish`, { method: 'POST', body: { force: true } });
  }
  toast('🚀 ประกาศใช้แล้ว ครูและนักเรียนเห็นตารางนี้ทันที', 'ok');
  schedulePage();
}

// ======================= Admin: ข้อมูลหลัก (CRUD) =======================
const DAY_OPTS = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(d => [d, DAYS[d]]));
const MASTER = {
  subjects: { fields: [['code', 'รหัสวิชา'], ['name', 'ชื่อวิชา'], ['credits', 'หน่วยกิต', 'number'], ['periods_per_week', 'คาบ/สัปดาห์', 'number'], ['type', 'ประเภท', { theory: 'ทฤษฎี', practice: 'ปฏิบัติ' }]] },
  classrooms: { fields: [['code', 'ชื่อ/รหัสห้อง'], ['building', 'อาคาร'], ['room_type', 'ประเภท', { lecture: 'ห้องเรียนทั่วไป', lab: 'ห้อง Lab', workshop: 'โรงฝึกงาน' }], ['capacity', 'ความจุ', 'number']] },
  student_groups: { fields: [['code', 'รหัสกลุ่ม'], ['department', 'แผนกวิชา'], ['level', 'ระดับ', { 'ปวช.': 'ปวช.', 'ปวส.': 'ปวส.' }], ['year', 'ชั้นปี', 'number'], ['size', 'จำนวนนักเรียน', 'number'], ['program', 'รูปแบบ', { 'ปกติ': 'ปกติ', 'ทวิภาคี': 'ทวิภาคี' }]] },
  periods: { fields: [['day', 'วัน', DAY_OPTS], ['period_no', 'คาบที่', 'number'], ['start_time', 'เริ่ม', 'time'], ['end_time', 'สิ้นสุด', 'time']] },
  offerings: { fields: [['group_id', 'กลุ่มเรียน', () => Object.fromEntries(L.groups.map(g => [g.id, g.code]))], ['subject_id', 'รายวิชา', () => Object.fromEntries(L.subjects.map(s => [s.id, `${s.code} ${s.name}`]))], ['teacher_id', 'ครูผู้สอน', () => Object.fromEntries(L.teachers.map(t => [t.id, t.full_name]))]] },
  teachers: { people: 'employee_code', fields: [['employee_code', 'รหัสพนักงาน'], ['full_name', 'ชื่อ-สกุล'], ['phone', 'เบอร์โทร'], ['department', 'กลุ่มวิชา/แผนก'], ['max_hours', 'คาบสอนสูงสุด/สัปดาห์', 'number'], ['unavailable', 'เวลาไม่สะดวกสอน', 'slots']] },
  students: { people: 'student_code', fields: [['student_code', 'รหัสนักเรียน'], ['full_name', 'ชื่อ-สกุล'], ['phone', 'เบอร์โทร'], ['group_id', 'กลุ่มเรียน', () => Object.fromEntries(L.groups.map(g => [g.id, g.code]))], ['special_needs', 'เงื่อนไขพิเศษ']] },
};
const optsOf = t => typeof t === 'function' ? t() : t;
const show = (f, v) => f[2] === 'slots' ? `${(v || []).length} ช่วง` : f[2] && typeof f[2] !== 'string' ? optsOf(f[2])[v] ?? v : v;

async function masterPage(name) {
  const cfg = MASTER[name];
  if (!cfg) throw new Error('ไม่พบหน้านี้');
  const base = cfg.people ? `/admin/people/${name}` : `/admin/data/${name}`;
  let rows = await api(base);
  const reload = async () => { L = indexLookup(await api('/lookup')); masterPage(name); };
  page().innerHTML = `<div class="card reveal"><div class="row" style="margin-bottom:14px">
      <input id="q" placeholder="🔎 ค้นหา..." style="flex:2 1 220px"><div style="flex:0 0 auto" class="row">
      ${name === 'students' ? '<button class="btn ghost" id="imp" style="flex:0 0 auto">📥 นำเข้า CSV</button>' : ''}<button class="btn" id="add" style="flex:0 0 auto">＋ เพิ่มข้อมูล</button></div></div>
    <div class="table-wrap"><table class="list"><thead><tr>${cfg.fields.map(f => `<th>${f[1]}</th>`).join('')}<th></th></tr></thead><tbody id="tb"></tbody></table></div>
    <p class="muted" id="cnt"></p></div>`;
  const paint = () => {
    const k = $('#q').value.toLowerCase();
    const list = rows.filter(r => !k || cfg.fields.some(f => String(show(f, r[f[0]]) ?? '').toLowerCase().includes(k)));
    $('#tb').innerHTML = list.map(r => `<tr>${cfg.fields.map(f => `<td>${esc(show(f, r[f[0]]))}</td>`).join('')}<td style="white-space:nowrap">
      ${r.locked ? `<button class="btn ok sm" data-unlock="${r.id}">🔓 ปลดล็อก</button>` : ''}
      <button class="btn ghost sm" data-edit="${r.id}">แก้ไข</button> <button class="btn danger sm" data-del="${r.id}">ลบ</button></td></tr>`).join('') || `<tr><td colspan="9" class="muted">ไม่มีข้อมูล</td></tr>`;
    $('#cnt').textContent = `ทั้งหมด ${list.length} รายการ`;
    $$('[data-edit]').forEach(b => b.onclick = () => form(cfg, rows.find(r => r.id === b.dataset.edit), base, reload));
    $$('[data-del]').forEach(b => b.onclick = () => confirm('ยืนยันการลบ? ข้อมูลที่เกี่ยวข้องจะถูกลบด้วย') && api(`${base}/${b.dataset.del}`, { method: 'DELETE' }).then(() => { toast('ลบแล้ว', 'ok'); reload(); }).catch(e => toast(e.message, 'bad')));
    $$('[data-unlock]').forEach(b => b.onclick = () => api(`${base}/${b.dataset.unlock}`, { method: 'PUT', body: { unlock: true } }).then(() => { toast('ปลดล็อกแล้ว', 'ok'); reload(); }));
  };
  $('#q').oninput = paint;
  $('#add').onclick = () => form(cfg, null, base, reload);
  if (name === 'students') $('#imp').onclick = () => importStudents(reload);
  paint();
}

function form(cfg, row, base, done) {
  const nums = [...new Set(L.periods.map(p => p.period_no))], days = [...new Set(L.periods.map(p => p.day))];
  const input = ([k, label, t]) => {
    const v = row?.[k] ?? '';
    if (t === 'slots') return `<label>${label} (ติ๊กช่องที่ไม่สะดวก)</label><div class="table-wrap"><table class="list"><tr><th></th>${nums.map(n => `<th>${n}</th>`).join('')}</tr>
      ${days.map(d => `<tr><td>${DAYS[d]}</td>${nums.map(n => `<td><input type="checkbox" style="width:auto" data-slot="${d}-${n}" ${(v || []).some(u => u.day === d && u.period === n) ? 'checked' : ''}></td>`).join('')}</tr>`).join('')}</table></div>`;
    if (t && typeof t !== 'string') return `<label>${label}</label><select name="${k}">${Object.entries(optsOf(t)).map(([o, n]) => `<option value="${esc(o)}" ${String(v) === o ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    const ro = row && k === cfg.people ? 'readonly' : '';
    const val = k === 'phone' ? '' : v;
    return `<label>${label}</label><input name="${k}" type="${t || 'text'}" value="${esc(val)}" ${ro} ${k === 'phone' && row ? `placeholder="ปัจจุบัน ${esc(v)} — กรอกเพื่อเปลี่ยน"` : ''} ${!row && ['code', 'name', 'full_name', cfg.people].includes(k) ? 'required' : ''}>`;
  };
  const m = modal(`<h3>${row ? 'แก้ไขข้อมูล' : 'เพิ่มข้อมูล'}</h3><form>${cfg.fields.map(input).join('')}
    ${cfg.people ? `<label>${row ? 'ตั้งรหัสผ่านใหม่ (เว้นว่าง = ไม่เปลี่ยน)' : 'รหัสผ่านเริ่มต้น (เว้นว่าง = ใช้รหัสประจำตัว)'}</label><input name="password" type="password" autocomplete="new-password">` : ''}
    <div class="row" style="margin-top:18px"><button type="button" class="btn ghost" data-close>ยกเลิก</button><button class="btn">💾 บันทึก</button></div></form>`);
  $('form', m).onsubmit = e => {
    e.preventDefault();
    const body = Object.fromEntries([...new FormData(e.target)].filter(([, v]) => v !== ''));
    for (const [k, , t] of cfg.fields) if (t === 'number' && body[k] !== undefined) body[k] = +body[k];
    if (cfg.fields.some(f => f[2] === 'slots')) body.unavailable = $$('[data-slot]:checked', m).map(c => { const [d, p] = c.dataset.slot.split('-'); return { day: +d, period: +p }; });
    busy(e.submitter, async () => { await api(row ? `${base}/${row.id}` : base, { method: row ? 'PUT' : 'POST', body }); m.remove(); toast('บันทึกแล้ว', 'ok'); done(); });
  };
}

function importStudents(done) {
  const m = modal(`<h3>📥 นำเข้าข้อมูลนักเรียน (CSV)</h3>
    <p class="muted">คอลัมน์: <code>student_code,full_name,group_code,phone</code> (แถวแรกเป็นหัวตาราง) — ส่งออกจาก Excel เป็น "CSV UTF-8"</p>
    <input type="file" accept=".csv,text/csv" id="file"><label>หรือวางข้อมูล</label><textarea id="csv" rows="8" placeholder="student_code,full_name,group_code,phone&#10;68201001,นายสมปอง ตั้งใจเรียน,ชย.1/1,0812345678"></textarea>
    <div id="res"></div><div class="row" style="margin-top:14px"><button class="btn ghost" data-close>ปิด</button><button class="btn" id="go">นำเข้า</button></div>`);
  $('#file', m).onchange = async e => { $('#csv', m).value = (await e.target.files[0].text()).replace(/^﻿/, ''); };
  $('#go', m).onclick = e => busy(e.currentTarget, async () => {
    const [head, ...lines] = $('#csv', m).value.trim().split(/\r?\n/).filter(Boolean);
    const cols = head.split(',').map(s => s.trim());
    // shortcut: แยกด้วย , ธรรมดา ไม่รองรับ "ค่าที่มี , ในเครื่องหมายคำพูด" — ชื่อนักเรียนไม่มี , จึงพอ
    const rows = lines.map(l => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v.trim()])));
    const r = await api('/admin/students/import', { method: 'POST', body: { rows } });
    $('#res', m).innerHTML = `<p class="badge ok">นำเข้าสำเร็จ ${r.ok} คน</p>${r.errors.map(x => `<div class="muted" style="color:var(--bad)">${esc(x)}</div>`).join('')}`;
    if (r.ok) done();
  });
}

// ======================= Admin: คำร้อง / สำรองข้อมูล / Logs =======================
async function timeblocksAdmin() {
  const list = await api('/admin/timeblocks');
  page().innerHTML = `<div class="card reveal"><div class="table-wrap"><table class="list"><thead><tr><th>วันที่ส่ง</th><th>ครู</th><th>วัน</th><th>คาบ</th><th>เหตุผล</th><th>สถานะ</th><th></th></tr></thead><tbody>
    ${list.map(r => `<tr><td>${fmtDate(r.created_at)}</td><td>${esc(r.teacher?.user?.full_name)}</td><td>${DAYS[r.day]}</td><td>${r.period_from}-${r.period_to}</td><td>${esc(r.reason)}</td><td>${badge(r.status)}</td>
      <td style="white-space:nowrap">${r.status === 'pending' ? `<button class="btn ok sm" data-s="approved" data-id="${r.id}">อนุมัติ</button> <button class="btn danger sm" data-s="rejected" data-id="${r.id}">ไม่อนุมัติ</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">ไม่มีคำร้อง</td></tr>'}
    </tbody></table></div><p class="muted">คำร้องที่อนุมัติแล้ว AI จะหลีกเลี่ยงช่วงเวลานั้นอัตโนมัติ และโหมดมือจะแจ้งเตือนสีแดงหากวางทับ</p></div>`;
  $$('[data-s]').forEach(b => b.onclick = async () => { await api(`/admin/timeblocks/${b.dataset.id}`, { method: 'PUT', body: { status: b.dataset.s } }); toast('บันทึกแล้ว', 'ok'); timeblocksAdmin(); });
}

async function backupPage() {
  const files = await api('/admin/backups');
  const tables = ['users', 'student_groups', 'teachers', 'students', 'subjects', 'classrooms', 'periods', 'offerings', 'timetable_versions', 'timetable', 'time_block_requests', 'logs'];
  page().innerHTML = `<div class="grid2">
    <div class="card reveal"><h3>💾 ดาวน์โหลดข้อมูลสำรอง (Manual Backup)</h3>
      <button class="btn" onclick="location.href='/api/admin/backup.sql'">⬇ ฐานข้อมูลทั้งหมด (.sql)</button>
      <label>หรือเลือกตาราง (.csv)</label><div class="row"><select id="tbl">${tables.map(t => `<option>${t}</option>`).join('')}</select><button class="btn ghost" style="flex:0 0 auto" id="csv">⬇ CSV</button></div>
      <p class="muted" style="font-size:.85rem">⚠ ไฟล์สำรองมีข้อมูลส่วนบุคคล (รหัสผ่านเป็น hash, เบอร์โทรเข้ารหัส) เก็บในที่ปลอดภัยตาม PDPA</p></div>
    <div class="card reveal" style="animation-delay:.1s"><h3>☁️ สำรองอัตโนมัติทุกวัน 02:00 น.</h3><p class="muted">GitHub Actions → Supabase Storage (bucket: backups)</p>
      <div class="table-wrap" style="max-height:300px"><table class="list"><tbody>${files.map(f => `<tr><td>${esc(f.name)}</td><td class="muted">${f.metadata?.size ? (f.metadata.size / 1024).toFixed(1) + ' KB' : ''}</td></tr>`).join('') || '<tr><td class="muted">ยังไม่มีไฟล์สำรองอัตโนมัติ</td></tr>'}</tbody></table></div></div></div>`;
  $('#csv').onclick = () => download(`/api/admin/backup/${$('#tbl').value}.csv`);
}

const LOG_NAMES = { login_ok: 'เข้าสู่ระบบ', login_failed: 'รหัสผ่านผิด', account_locked: 'ล็อกบัญชี', otp_failed: 'OTP ผิด', sms_sent: 'ส่ง SMS', sms_failed: 'ส่ง SMS ไม่สำเร็จ', sms_dev: 'SMS (ทดสอบ)', pdpa_consent: 'ยอมรับ PDPA', pdpa_export: 'PDPA: ขอสำเนาข้อมูล', pdpa_delete_request: 'PDPA: ขอลบข้อมูล', backup: 'สำรองข้อมูล', export: 'ส่งออกตาราง', publish: 'ประกาศตาราง', ai_generate: 'AI จัดตาราง', snapshot: 'Snapshot', data_delete: 'ลบข้อมูล', password_reset: 'รีเซ็ตรหัสผ่าน', password_reset_requested: 'ขอรีเซ็ตรหัสผ่าน', password_change: 'เปลี่ยนรหัสผ่าน', profile_update: 'แก้ไขข้อมูลส่วนตัว', students_import: 'นำเข้านักเรียน', timeblock_request: 'คำร้องบล็อกเวลา' };
async function logsPage(action = '') {
  const list = await api('/admin/logs' + (action ? `?action=${encodeURIComponent(action)}` : ''));
  const cls = a => /failed|locked/.test(a) ? 'bad' : /pdpa/.test(a) ? 'warn' : /ok|backup|publish/.test(a) ? 'ok' : 'pri';
  page().innerHTML = `<div class="card reveal"><div class="row" style="margin-bottom:12px"><select id="act"><option value="">ทุกกิจกรรม</option>${Object.entries(LOG_NAMES).map(([k, v]) => `<option value="${k}" ${k === action ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="table-wrap"><table class="list"><thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>กิจกรรม</th><th>รายละเอียด</th><th>IP</th></tr></thead><tbody>
    ${list.map(l => `<tr><td style="white-space:nowrap">${fmtDate(l.created_at)}</td><td>${esc(l.user ? `${l.user.username} ${l.user.full_name}` : l.detail?.username || 'ระบบ')}</td><td><span class="badge ${cls(l.action)}">${esc(LOG_NAMES[l.action] || l.action)}</span></td><td class="muted" style="font-size:.8rem">${esc(l.detail ? JSON.stringify(l.detail) : '')}</td><td class="muted">${esc(l.ip || '')}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  $('#act').onchange = e => logsPage(e.target.value);
}

const PAGES = { dashboard, schedule: schedulePage, timeblocks: timeblocksAdmin, backup: backupPage, logs: () => logsPage(), my: mySchedule, timeblock: timeblockPage, mystudents: myStudents, profile: profilePage };

boot().catch(() => {});
