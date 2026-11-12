import { api, esc, $, $$, toast, modal, busy, countUp, download, viewAs } from './ui.js';
import { renderGrid, indexLookup } from './grid.js';
import { findConflicts, DAYS } from '/shared/conflicts.js';
import { showGuide } from './guide.js';
import { renderForm, fitForPrint, unfitPrint } from './form.js';

const ROLE = { admin: 'ผู้ดูแลระบบ', dept: 'ฝ่ายวิชาการแผนก' };
const NAV = {
  admin: [['ภาพรวม'], ['dashboard', '📊', 'แผงควบคุม'], ['schedule', '🤖', 'จัดตารางสอน'],
    ['ข้อมูลหลัก'], ['student_groups', '👥', 'กลุ่มเรียน'], ['teachers', '👩‍🏫', 'ครูผู้สอน'], ['students', '🎓', 'นักเรียน'], ['offerings', '🧩', 'แผนการสอน'],
    ['subjects', '📚', 'รายวิชา'], ['classrooms', '🏫', 'ห้องเรียน/โรงฝึกงาน'], ['periods', '🕘', 'เวลา-คาบเรียน'],
    ['ระบบ'], ['accounts', '🔑', 'บัญชีผู้ใช้'], ['backup', '💾', 'สำรองข้อมูล'], ['logs', '🛡️', 'บันทึกกิจกรรม'], ['profile', '⚙️', 'ข้อมูลส่วนตัว']],
  dept: [['งานของแผนก'], ['schedule', '🤖', 'จัดตารางสอน'],
    ['ข้อมูลแผนก'], ['student_groups', '👥', 'กลุ่มเรียน'], ['teachers', '👩‍🏫', 'ครูผู้สอน'], ['students', '🎓', 'นักเรียน'], ['offerings', '🧩', 'แผนการสอน'],
    ['ข้อมูลอ้างอิง (ดูอย่างเดียว)'], ['subjects', '📚', 'รายวิชา'], ['classrooms', '🏫', 'ห้องเรียน/โรงฝึกงาน'], ['periods', '🕘', 'เวลา-คาบเรียน'],
    ['บัญชี'], ['profile', '⚙️', 'ข้อมูลส่วนตัว']],
};
const STATUS = { draft: ['ฉบับร่าง', 'warn'], published: ['ประกาศใช้', 'ok'], archived: ['เก็บถาวร', ''], pending: ['รออนุมัติ', 'warn'], approved: ['อนุมัติ', 'ok'], rejected: ['ไม่อนุมัติ', 'bad'] };
const badge = s => `<span class="badge ${STATUS[s]?.[1] || ''}">${esc(STATUS[s]?.[0] || s)}</span>`;
const fmtDate = d => d ? new Date(d).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
const page = () => $('#page');
let me, L;
// บทบาทที่ใช้งานจริงตอนนี้ (แอดมินที่กดจำลองเป็นแผนก = dept)
const role = () => (me.view ? 'dept' : me.role);
const myDept = () => (role() === 'dept' ? me.view?.department || me.department : null);
const departments = () => [...new Set(L.groups.map(g => g.department))].sort((a, b) => a.localeCompare(b, 'th'));
const dl = url => download(url + (viewAs.get() ? `?viewAs=${encodeURIComponent(viewAs.get())}` : ''));

// ======================= เริ่มต้น =======================
async function boot() {
  me = await api('/me');
  if (me.role !== 'admin' && viewAs.get()) viewAs.set('');
  L = indexLookup(await api('/lookup'));
  $('#me-name').textContent = me.full_name;
  $('#me-role').textContent = me.view ? `👁 จำลองเป็นฝ่ายวิชาการแผนก${me.view.department}` : ROLE[me.role] + (me.department ? me.department : '');
  $('#me-av').textContent = me.full_name.replace(/^(นาย|นางสาว|นาง)/, '').trim()[0] || '?';
  $('#nav').innerHTML = NAV[role()].map(([k, i, t]) => i ? `<a href="#${k}" data-k="${k}"><span>${i}</span>${esc(t)}</a>` : `<div class="sec">${esc(k)}</div>`).join('');
  $('#menu').onclick = () => $('#side').classList.toggle('open');
  $('#logout').onclick = async () => { viewAs.set(''); await api('/auth/logout', { method: 'POST' }); location.href = '/'; };
  $('#guide-btn').onclick = () => (role() === 'admin' ? showGuide('admin', 'dept', 'public') : showGuide('dept', 'public'));
  if (me.role === 'admin') viewAsControl();
  window.onhashchange = route;
  if (!me.pdpa_consent_at) pdpaModal();
  route();
}

// ปุ่ม "มุมมอง" ของแอดมิน: สลับไปดูแบบบุคคลทั่วไป หรือแบบฝ่ายวิชาการแผนกใดก็ได้ โดยไม่ต้องสลับบัญชี
function viewAsControl() {
  const cur = viewAs.get();
  $('#viewas').classList.remove('hidden');
  $('#viewas').innerHTML = `<label for="va" style="margin:0">👁 มุมมอง</label><select id="va">
    <option value="">ผู้ดูแลระบบ (ตัวจริง)</option><option value="__public">บุคคลทั่วไป (หน้าดูตาราง)</option>
    ${departments().map(d => `<option value="${esc(d)}" ${d === cur ? 'selected' : ''}>ฝ่ายวิชาการ: ${esc(d)}</option>`).join('')}</select>`;
  $('#va').onchange = e => {
    const v = e.target.value;
    if (v === '__public') { viewAs.set(''); location.href = '/?preview=1'; return; }
    viewAs.set(v); location.hash = ''; location.reload();
  };
  if (cur) {
    $('#viewas-bar').classList.remove('hidden');
    $('#viewas-bar').innerHTML = `👁 กำลังจำลองเป็น <b>ฝ่ายวิชาการแผนก${esc(cur)}</b> — สิทธิ์และข้อมูลที่เห็นเหมือนบัญชีจริงของแผนกนี้ทุกอย่าง <button class="btn sm" id="va-exit">← กลับเป็นผู้ดูแลระบบ</button>`;
    $('#va-exit').onclick = () => { viewAs.set(''); location.hash = ''; location.reload(); };
  }
}

function pdpaModal() {
  const m = modal(`<h2>🔒 นโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA)</h2>
    <p>วิทยาลัยการอาชีพโพนทองเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของท่าน ได้แก่ ชื่อ-สกุล รหัสประจำตัว กลุ่มเรียน/แผนก เบอร์โทรศัพท์ และอีเมล
    เพื่อวัตถุประสงค์ในการจัดตารางเรียน-ตารางสอน ยืนยันตัวตนเจ้าหน้าที่ (OTP) และแจ้งเตือนความปลอดภัยเท่านั้น</p>
    <ul class="muted"><li>ข้อมูลเบอร์โทร/อีเมลถูกเข้ารหัส (AES-256) และแสดงผลแบบปิดบังบางส่วน</li>
    <li>ท่านมีสิทธิ์ขอดู ขอสำเนา แก้ไข หรือขอลบข้อมูล ได้ที่เมนู "ข้อมูลส่วนตัว & PDPA"</li>
    <li>ข้อมูลจะถูกเก็บตลอดระยะเวลาการศึกษา/การปฏิบัติงาน และสำรองข้อมูลอย่างปลอดภัย</li></ul>
    <div class="row" style="margin-top:18px"><button class="btn ghost" id="pd-no">ไม่ยอมรับ (ออกจากระบบ)</button><button class="btn ok" id="pd-yes">✔ ยอมรับและเข้าใช้งาน</button></div>`, { closable: false });
  $('#pd-yes', m).onclick = async () => { await api('/me/consent', { method: 'POST' }); m.remove(); toast('ขอบคุณที่ยอมรับนโยบาย PDPA', 'ok'); };
  $('#pd-no', m).onclick = () => $('#logout').click();
}

function route() {
  const k = location.hash.slice(1) || NAV[role()].find(n => n[1])[0];
  const item = NAV[role()].find(n => n[0] === k && n[1]);
  if (!item) { location.hash = NAV[role()].find(n => n[1])[0]; return; }
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.k === k));
  $('#title').textContent = item[2];
  $('#side').classList.remove('open');
  page().innerHTML = '<div class="card"><div class="skeleton"></div><div class="skeleton" style="width:70%"></div></div>';
  (PAGES[k] || (() => masterPage(k)))().catch(e => { if (e.message !== 'session') page().innerHTML = `<div class="card">⚠ ${esc(e.message)}</div>`; });
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
  $('#pd-exp').onclick = () => dl('/api/me/export');
  $('#pd-del').onclick = () => {
    const m = modal(`<h3>ขอลบข้อมูลส่วนบุคคล</h3><p class="muted">คำขอจะส่งถึงผู้ดูแลระบบเพื่อพิจารณา (ข้อมูลที่จำเป็นตามระเบียบสถานศึกษาอาจต้องเก็บต่อ)</p>
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
`;
  $$('.stat .n').forEach(countUp);
  requestAnimationFrame(() => setTimeout(() => $$('.bars i').forEach(i => i.style.height = i.dataset.h + 'px'), 300));
}

// ======================= Admin: จัดตารางสอน (AI + โหมดมือ) =======================
const S = { version: null, entries: [], view: { type: 'group', id: null }, undo: [] };

async function schedulePage() {
  const versions = await api('/versions');
  if (!S.version || !versions.some(v => v.id === S.version.id)) S.version = versions.find(v => v.status === 'draft') || versions[0] || null;
  else S.version = versions.find(v => v.id === S.version.id);
  S.view.id ||= myGroups()[0]?.id;
  page().innerHTML = `<div class="card reveal" style="margin-bottom:16px">
    <div class="row">
      <div style="flex:2 1 260px"><label>เวอร์ชันตาราง (Restore Point)${myDept() ? ' — AI จะจัดเฉพาะกลุ่มเรียนของแผนก โดยล็อกคาบของแผนกอื่นในฉบับนี้ไว้' : ''}</label><select id="ver">${versions.map(v => `<option value="${v.id}" ${v.id === S.version?.id ? 'selected' : ''}>${esc(v.name)} — ${STATUS[v.status][0]} (${fmtDate(v.created_at)})</option>`).join('')}</select></div>
      <div style="flex:0 0 auto"><button class="btn" id="ai">🤖 AI จัดตาราง${myDept() ? `แผนก${esc(myDept())}` : 'ทั้งวิทยาลัย'}</button></div>
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
  $('#snap').onclick = e => S.version && busy(e.currentTarget, async () => { S.version = await api(`/versions/${S.version.id}/snapshot`, { method: 'POST', body: {} }); toast('สร้างสำเนาเป็นฉบับร่างแล้ว แก้ไขได้ทันที', 'ok'); schedulePage(); });
  $('#undo').onclick = undo;
  $('#pub').onclick = e => S.version && busy(e.currentTarget, publish);
  $('#xls').onclick = () => S.version && dl(`/api/versions/${S.version.id}/export.csv`);
  $('#delv').onclick = e => S.version && confirm('ลบเวอร์ชันนี้?') && busy(e.currentTarget, async () => { await api(`/versions/${S.version.id}`, { method: 'DELETE' }); S.version = null; schedulePage(); });
  $$('#vtabs button').forEach(b => b.onclick = () => { S.view = { type: b.dataset.v, id: null }; $$('#vtabs button').forEach(x => x.classList.toggle('active', x === b)); fillViewSelect(); draw(); });
  fillViewSelect();
  await loadEntries();
}

function fillViewSelect() {
  const list = { group: myGroups().map(g => [g.id, `${g.code} (${g.level} ${g.department})`]), teacher: L.teachers.map(t => [t.id, t.full_name]), room: L.rooms.map(r => [r.id, `${r.code} ${r.building || ''}`]) }[S.view.type];
  S.view.id ||= list[0]?.[0];
  $('#vid').innerHTML = list.map(([id, n]) => `<option value="${id}" ${id === S.view.id ? 'selected' : ''}>${esc(n)}</option>`).join('');
  $('#vid').onchange = e => { S.view.id = e.target.value; draw(); };
}

async function loadEntries() {
  S.entries = S.version ? await api(`/versions/${S.version.id}/entries`) : [];
  draw();
}

const ctx = () => ({ teachers: L.teacher, rooms: L.room, groups: L.group, subjects: L.subject, periods: L.periods, weeklyMax: L.weekly_max });
const myGroups = () => L.groups.filter(g => !myDept() || g.department === myDept());

function draw() {
  if (!$('#grid')) return;
  if (!S.version) { $('#grid').innerHTML = '<p class="muted">ยังไม่มีตาราง — กดปุ่ม "🤖 AI จัดตารางอัตโนมัติ" เพื่อเริ่ม</p>'; $('#palette-box').innerHTML = ''; return; }
  const editable = S.version.status !== 'published';
  const conflicts = findConflicts(S.entries, ctx());
  $('#cstat').innerHTML = conflicts.size ? `<button type="button" class="badge bad" id="cstat-btn" title="กดดูว่าคาบไหนซ้อนกับคาบไหน" style="cursor:pointer">⚠ ชนกัน ${conflicts.size} คาบ — กดดู</button>` : '<span class="badge ok">✔ ไม่มีคาบชน</span>';
  $('#cstat-btn')?.addEventListener('click', conflictsModal);
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
  const r = await api('/versions/generate', { method: 'POST', body: { base_version_id: S.version?.id } });
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
  try { await api(`/entries/${id}`, { method: 'PUT', body: { day, period_no } }); if (record) S.undo.push({ t: 'move', id, from }); }
  catch (err) { Object.assign(e, from); draw(); return toast(err.message, 'bad'); } // บันทึกไม่สำเร็จ = ไม่ได้ย้าย
  if (record) clashModal(e); // ย้อนกลับ (undo) ไม่ต้องเตือนซ้ำ
}

const whenOf = e => { const p = L.periods.find(x => x.day === e.day && x.period_no === e.period_no);
  return `วัน${DAYS[e.day]} คาบ ${e.period_no}${p ? ` (${p.start_time.slice(0, 5)}–${p.end_time.slice(0, 5)} น.)` : ''}`; };
const clashRow = (x, why, extra = '') => { const g = L.group[x.group_id], s = L.subject[x.subject_id];
  return `<tr><td><b>${esc(s?.code)}</b> ${esc(s?.name)}</td><td>${esc(g?.code)}<br><span class="muted">${esc(g?.department)}</span></td><td>${esc(L.teacher[x.teacher_id]?.full_name)}</td><td>${esc(L.room[x.room_id]?.code || '-')}</td><td><span class="badge bad">${esc(why || '—')}</span></td>${extra}</tr>`; };
const CLASH_HEAD = '<th>วิชา</th><th>กลุ่ม / แผนก</th><th>ครู</th><th>ห้อง</th><th>สาเหตุ</th>';
function clashBox(html) {
  $$('.modal.clash').forEach(x => x.remove()); // มีได้ทีละกล่อง ไม่ขึ้นซ้อน
  const m = modal(html);
  m.classList.add('clash');
  $('.card', m).style.width = 'min(820px, 100%)'; // ตารางรายละเอียดต้องกว้างพอ
  return m;
}

// ป้าย "ชนกัน N คาบ": รายการคาบที่ชนทั้งหมด จัดกลุ่มตามวัน/คาบ ให้เห็นว่าอันไหนซ้อนกับอันไหน
function conflictsModal() {
  const conf = findConflicts(S.entries, ctx());
  const bad = S.entries.filter(e => conf.has(e.id)).sort((a, b) => a.day - b.day || a.period_no - b.period_no);
  const slots = [...new Map(bad.map(e => [`${e.day}|${e.period_no}`, e])).values()];
  const m = clashBox(`<h3>⚠ รายการคาบที่ชนกัน (${bad.length} คาบ)</h3>
    <p class="muted" style="margin-top:0">คาบที่อยู่ในช่วงเวลาเดียวกันด้านล่างคือคาบที่ซ้อนกัน — กด "ไปดู" เพื่อเปิดตารางของกลุ่มนั้นแล้วลากแก้</p>
    ${slots.map(t => `<p style="margin:14px 0 6px"><b>${whenOf(t)}</b></p>
      <div class="table-wrap"><table class="list"><thead><tr>${CLASH_HEAD}<th></th></tr></thead><tbody>
      ${bad.filter(e => e.day === t.day && e.period_no === t.period_no).map(e => clashRow(e, conf.get(e.id).join(', '),
        `<td><button class="btn ghost sm" data-goto="${e.group_id}">ไปดู</button></td>`)).join('')}
      </tbody></table></div>`).join('')}
    <div class="row" style="margin-top:14px"><button class="btn" data-close>ทราบแล้ว</button></div>`);
  $$('[data-goto]', m).forEach(b => b.onclick = () => {
    S.view = { type: 'group', id: b.dataset.goto };
    $$('#vtabs button').forEach(x => x.classList.toggle('active', x.dataset.v === 'group'));
    fillViewSelect(); draw(); m.remove();
  });
}

// กล่องแจ้งเตือนเมื่อย้าย/วางคาบแล้วชน: บอกว่าซ้อนกับคาบไหน วิชา กลุ่ม/แผนก ครู ห้อง
function clashModal(e) {
  const problems = findConflicts(S.entries, ctx()).get(e.id);
  if (!problems) return $$('.modal.clash').forEach(x => x.remove());
  const same = (k, x) => e[k] && x[k] === e[k];
  const clashes = S.entries.filter(x => x.id !== e.id && x.day === e.day && x.period_no === e.period_no &&
    (same('teacher_id', x) || same('room_id', x) || same('group_id', x)));
  const why = x => [same('teacher_id', x) && 'ครูซ้อน', same('room_id', x) && 'ห้องซ้อน', same('group_id', x) && 'กลุ่มเรียนซ้อน'].filter(Boolean).join(', ');
  clashBox(`<h3>⚠ คาบเรียนซ้อนกัน</h3>
    <p>คาบที่ย้ายไป <b>${whenOf(e)}</b><br>${esc(L.subject[e.subject_id]?.name)} · กลุ่ม ${esc(L.group[e.group_id]?.code)} (${esc(L.group[e.group_id]?.department)}) · ${esc(L.teacher[e.teacher_id]?.full_name)}</p>
    ${clashes.length ? `<p style="margin-bottom:6px"><b>ซ้อนกับ:</b></p><div class="table-wrap"><table class="list"><thead><tr>${CLASH_HEAD}</tr></thead><tbody>${clashes.map(x => clashRow(x, why(x))).join('')}</tbody></table></div>` : ''}
    <p class="muted">ปัญหาทั้งหมด: ${esc(problems.join(', '))}</p>
    <div class="row" style="margin-top:14px"><button class="btn" data-close>ทราบแล้ว</button></div>`);
}

async function add(offeringId, day, period_no) {
  const o = L.offerings.find(x => x.id === offeringId);
  const room = L.rooms.find(r => !S.entries.some(e => e.room_id === r.id && e.day === day && e.period_no === period_no) && (L.subject[o.subject_id]?.type === 'practice') === (r.room_type !== 'lecture'));
  const e = await api('/entries', { method: 'POST', body: { version_id: S.version.id, day, period_no, subject_id: o.subject_id, teacher_id: o.teacher_id, group_id: o.group_id, room_id: room?.id } });
  S.entries.push(e); S.undo.push({ t: 'add', id: e.id }); draw();
  clashModal(e);
}

async function removeEntry(e, record = true) {
  await api(`/entries/${e.id}`, { method: 'DELETE' });
  S.entries = S.entries.filter(x => x.id !== e.id);
  if (record) S.undo.push({ t: 'del', entry: e });
  draw();
}

async function undo() {
  const u = S.undo.pop();
  if (!u) return toast('ไม่มีรายการให้ย้อนกลับ');
  if (u.t === 'move') await move(u.id, u.from.day, u.from.period_no, false);
  if (u.t === 'add') await removeEntry(S.entries.find(e => e.id === u.id), false);
  if (u.t === 'room') { await api(`/entries/${u.e.id}`, { method: 'PUT', body: { room_id: u.from } }); u.e.room_id = u.from; draw(); }
  if (u.t === 'del') { const { id, ...rest } = u.entry; S.entries.push(await api('/entries', { method: 'POST', body: rest })); draw(); }
  toast('↶ ย้อนกลับแล้ว');
}

function editEntry(e, problems) {
  const m = modal(`<h3>${esc(L.subject[e.subject_id]?.name)}</h3><p class="muted">${DAYS[e.day]} คาบ ${e.period_no} · ${esc(L.group[e.group_id]?.code)} · ${esc(L.teacher[e.teacher_id]?.full_name)}</p>
    ${problems ? `<p class="badge bad">⚠ ${esc(problems.join(', '))}</p>` : ''}
    <label>ห้องเรียน</label><select id="rm">${L.rooms.map(r => `<option value="${r.id}" ${r.id === e.room_id ? 'selected' : ''}>${esc(r.code)} · ${esc(r.building || '')} · ${r.room_type} · ${r.capacity} ที่นั่ง${S.entries.some(x => x.id !== e.id && x.room_id === r.id && x.day === e.day && x.period_no === e.period_no) ? ' (ไม่ว่าง)' : ''}</option>`).join('')}</select>
    <div class="row" style="margin-top:16px"><button class="btn danger" id="del">ลบคาบนี้</button><button class="btn ghost" data-close>ปิด</button><button class="btn" id="save">บันทึก</button></div>`);
  $('#save', m).onclick = async () => { const room_id = $('#rm', m).value; await api(`/entries/${e.id}`, { method: 'PUT', body: { room_id } }); S.undo.push({ t: 'room', e, from: e.room_id }); e.room_id = room_id; m.remove(); draw(); };
  $('#del', m).onclick = async () => { await removeEntry(e); m.remove(); };
}

async function publish() {
  let r;
  try { r = await api(`/versions/${S.version.id}/publish`, { method: 'POST', body: {} }); }
  catch (e) {
    if (e.status !== 409 || !confirm(e.message + '\n\nต้องการประกาศใช้ทั้งที่ยังชนกันหรือไม่?')) throw e;
    r = await api(`/versions/${S.version.id}/publish`, { method: 'POST', body: { force: true } });
  }
  S.version = r.version;
  toast(myDept() ? `🚀 นำตารางแผนก${myDept()}ไปรวมกับตารางที่ประกาศแล้ว (แผนกอื่นไม่ถูกแก้)` : '🚀 ประกาศใช้แล้ว ทุกคนเห็นตารางนี้ที่หน้าแรกทันที', 'ok');
  schedulePage();
}

// ======================= Admin: ข้อมูลหลัก (CRUD) =======================
const DAY_OPTS = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(d => [d, DAYS[d]]));
const MASTER = {
  subjects: { adminOnly: true, fields: [['code', 'รหัสวิชา'], ['name', 'ชื่อวิชา'], ['credits', 'หน่วยกิต', 'number'], ['periods_per_week', 'คาบ/สัปดาห์', 'number'], ['type', 'ประเภท', { theory: 'ทฤษฎี', practice: 'ปฏิบัติ' }]] },
  classrooms: { adminOnly: true, fields: [['code', 'ชื่อ/รหัสห้อง'], ['building', 'อาคาร'], ['room_type', 'ประเภท', { lecture: 'ห้องเรียนทั่วไป', lab: 'ห้อง Lab', workshop: 'โรงฝึกงาน' }], ['capacity', 'ความจุ', 'number']] },
  student_groups: { fields: [['code', 'รหัสกลุ่ม'], ['department', 'แผนกวิชา'], ['level', 'ระดับ', { 'ปวช.': 'ปวช.', 'ปวส.': 'ปวส.' }], ['year', 'ชั้นปี', 'number'], ['size', 'จำนวนนักเรียน', 'number'], ['program', 'รูปแบบ', { 'ปกติ': 'ปกติ', 'ทวิภาคี': 'ทวิภาคี' }], ['advisor', 'ครูที่ปรึกษา']] },
  periods: { adminOnly: true, fields: [['day', 'วัน', DAY_OPTS], ['period_no', 'คาบที่', 'number'], ['start_time', 'เริ่ม', 'time'], ['end_time', 'สิ้นสุด', 'time']] },
  offerings: { fields: [['group_id', 'กลุ่มเรียน', () => Object.fromEntries(myGroups().map(g => [g.id, g.code]))], ['subject_id', 'รายวิชา', () => Object.fromEntries(L.subjects.map(s => [s.id, `${s.code} ${s.name}`]))], ['teacher_id', 'ครูผู้สอน', () => Object.fromEntries(L.teachers.map(t => [t.id, t.full_name]))]] },
  teachers: { people: 'employee_code', fields: [['employee_code', 'รหัสพนักงาน'], ['full_name', 'ชื่อ-สกุล'], ['department', 'แผนก/กลุ่มวิชา'], ['max_hours', 'คาบสอนสูงสุด/สัปดาห์', 'number'], ['unavailable', 'เวลาไม่สะดวกสอน', 'slots']] },
  students: { people: 'student_code', fields: [['student_code', 'รหัสนักเรียน'], ['full_name', 'ชื่อ-สกุล'], ['group_id', 'กลุ่มเรียน', () => Object.fromEntries(myGroups().map(g => [g.id, g.code]))], ['special_needs', 'เงื่อนไขพิเศษ']] },
};
const optsOf = t => typeof t === 'function' ? t() : t;
const show = (f, v) => f[2] === 'slots' ? `${(v || []).length} ช่วง` : f[2] && typeof f[2] !== 'string' ? optsOf(f[2])[v] ?? v : v;

async function masterPage(name) {
  const cfg = MASTER[name];
  if (!cfg) throw new Error('ไม่พบหน้านี้');
  const base = cfg.people ? `/people/${name}` : `/data/${name}`;
  const ro = cfg.adminOnly && role() !== 'admin';
  let rows = await api(base);
  const reload = async () => { L = indexLookup(await api('/lookup')); masterPage(name); };
  page().innerHTML = `<div class="card reveal"><div class="row" style="margin-bottom:14px">
      <input id="q" placeholder="🔎 ค้นหา..." style="flex:2 1 220px"><div style="flex:0 0 auto" class="row">
      ${ro ? '<span class="badge">ดูอย่างเดียว — แก้ไขได้เฉพาะผู้ดูแลระบบ</span>' : `${name === 'students' ? '<button class="btn ghost" id="imp" style="flex:0 0 auto">📥 นำเข้า CSV</button>' : ''}<button class="btn" id="add" style="flex:0 0 auto">＋ เพิ่มข้อมูล</button>`}</div></div>
    <div class="table-wrap"><table class="list"><thead><tr>${cfg.fields.map(f => `<th>${f[1]}</th>`).join('')}<th></th></tr></thead><tbody id="tb"></tbody></table></div>
    <p class="muted" id="cnt"></p></div>`;
  const paint = () => {
    const k = $('#q').value.toLowerCase();
    const list = rows.filter(r => !k || cfg.fields.some(f => String(show(f, r[f[0]]) ?? '').toLowerCase().includes(k)));
    $('#tb').innerHTML = list.map(r => `<tr>${cfg.fields.map(f => `<td>${esc(show(f, r[f[0]]))}</td>`).join('')}<td style="white-space:nowrap">${ro ? '' : `<button class="btn ghost sm" data-edit="${r.id}">แก้ไข</button> <button class="btn danger sm" data-del="${r.id}">ลบ</button>`}</td></tr>`).join('') || `<tr><td colspan="9" class="muted">ไม่มีข้อมูล</td></tr>`;
    $('#cnt').textContent = `ทั้งหมด ${list.length} รายการ`;
    $$('[data-edit]').forEach(b => b.onclick = () => form(cfg, rows.find(r => r.id === b.dataset.edit), base, reload));
    $$('[data-del]').forEach(b => b.onclick = () => confirm('ยืนยันการลบ? ข้อมูลที่เกี่ยวข้องจะถูกลบด้วย') && api(`${base}/${b.dataset.del}`, { method: 'DELETE' }).then(() => { toast('ลบแล้ว', 'ok'); reload(); }).catch(e => toast(e.message, 'bad')));
  };
  $('#q').oninput = paint;
  if (!ro) $('#add').onclick = () => form(cfg, null, base, reload);
  if (!ro && name === 'students') $('#imp').onclick = () => importStudents(reload);
  if (name === 'periods') weeklyMaxCard(reload);
  paint();
}

// ตั้งค่าคาบสูงสุดต่อสัปดาห์ (ใช้กับทั้งครูแต่ละคนและกลุ่มเรียนแต่ละกลุ่ม) — แก้ได้เฉพาะแอดมิน
function weeklyMaxCard(reload) {
  const admin = role() === 'admin';
  page().insertAdjacentHTML('afterbegin', `<form class="card reveal" id="f-wk" style="margin-bottom:16px">
    <h3 style="margin-bottom:4px">⏱ คาบเรียน / คาบสอนสูงสุดต่อสัปดาห์</h3>
    <p class="muted" style="margin-top:0">ใช้กับ <b>ครูแต่ละคน</b> และ <b>กลุ่มเรียนแต่ละกลุ่ม</b> — AI จัดไม่เกินค่านี้ ตารางที่เกินจะขึ้นสีแดง และเพิ่มแผนการสอนเกินค่านี้ไม่ได้</p>
    <div class="row" style="align-items:center"><div style="flex:0 1 200px"><input name="weekly_max" type="number" min="1" max="60" value="${L.weekly_max}" ${admin ? '' : 'readonly'} aria-label="คาบสูงสุดต่อสัปดาห์"></div>
    <span style="flex:0 0 auto">คาบ/สัปดาห์</span>${admin ? '<button class="btn">💾 บันทึก</button>' : '<span class="badge">แก้ไขได้เฉพาะผู้ดูแลระบบ</span>'}</div></form>`);
  $('#f-wk').onsubmit = e => {
    e.preventDefault();
    if (!admin) return;
    busy(e.submitter, async () => { const r = await api('/admin/settings', { method: 'PUT', body: { weekly_max: +e.target.weekly_max.value } }); toast(`ตั้งค่าเป็น ${r.weekly_max} คาบ/สัปดาห์แล้ว`, 'ok'); await reload(); });
  };
}

function form(cfg, row, base, done) {
  const nums = [...new Set(L.periods.map(p => p.period_no))], days = [...new Set(L.periods.map(p => p.day))];
  const input = ([k, label, t]) => {
    const v = row?.[k] ?? '';
    if (t === 'slots') return `<label>${label} (ติ๊กช่องที่ไม่สะดวก)</label><div class="table-wrap"><table class="list"><tr><th></th>${nums.map(n => `<th>${n}</th>`).join('')}</tr>
      ${days.map(d => `<tr><td>${DAYS[d]}</td>${nums.map(n => `<td><input type="checkbox" style="width:auto" data-slot="${d}-${n}" ${(v || []).some(u => u.day === d && u.period === n) ? 'checked' : ''}></td>`).join('')}</tr>`).join('')}</table></div>`;
    if (t && typeof t !== 'string') return `<label>${label}</label><select name="${k}">${Object.entries(optsOf(t)).map(([o, n]) => `<option value="${esc(o)}" ${String(v) === o ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    const lockDept = k === 'department' && myDept();
    const ro = (row && k === cfg.people) || lockDept ? 'readonly' : '';
    const val = lockDept ? myDept() : v;
    return `<label>${label}</label><input name="${k}" type="${t || 'text'}" value="${esc(val)}" ${ro} ${!row && ['code', 'name', 'full_name', cfg.people].includes(k) ? 'required' : ''}>`;
  };
  const m = modal(`<h3>${row ? 'แก้ไขข้อมูล' : 'เพิ่มข้อมูล'}</h3><form>${cfg.fields.map(input).join('')}
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
    <p class="muted">คอลัมน์: <code>student_code,full_name,group_code</code> (แถวแรกเป็นหัวตาราง) — ส่งออกจาก Excel เป็น "CSV UTF-8"</p>
    <input type="file" accept=".csv,text/csv" id="file"><label>หรือวางข้อมูล</label><textarea id="csv" rows="8" placeholder="student_code,full_name,group_code&#10;68201001,นายสมปอง ตั้งใจเรียน,ชย.1/1"></textarea>
    <div id="res"></div><div class="row" style="margin-top:14px"><button class="btn ghost" data-close>ปิด</button><button class="btn" id="go">นำเข้า</button></div>`);
  $('#file', m).onchange = async e => { $('#csv', m).value = (await e.target.files[0].text()).replace(/^﻿/, ''); };
  $('#go', m).onclick = e => busy(e.currentTarget, async () => {
    const [head, ...lines] = $('#csv', m).value.trim().split(/\r?\n/).filter(Boolean);
    const cols = head.split(',').map(s => s.trim());
    // shortcut: แยกด้วย , ธรรมดา ไม่รองรับ "ค่าที่มี , ในเครื่องหมายคำพูด" — ชื่อนักเรียนไม่มี , จึงพอ
    const rows = lines.map(l => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v.trim()])));
    const r = await api('/students/import', { method: 'POST', body: { rows } });
    $('#res', m).innerHTML = `<p class="badge ok">นำเข้าสำเร็จ ${r.ok} คน</p>${r.errors.map(x => `<div class="muted" style="color:var(--bad)">${esc(x)}</div>`).join('')}`;
    if (r.ok) done();
  });
}

// ======================= Admin: คำร้อง / สำรองข้อมูล / Logs =======================
// ยืนยันการสมัคร: SMS ส่ง OTP ไปที่เบอร์ของเจ้าของบัญชี แล้วผู้ดูแลระบบกรอกรหัสที่เจ้าของเบอร์แจ้ง
function otpModal(u) {
  const m = modal(`<div style="text-align:center"><div style="font-size:42px">📱</div><h3>ยืนยันเบอร์โทรของ ${esc(u.full_name)}</h3>
    <p class="muted">ระบบส่งรหัส OTP 6 หลักทาง SMS ไปที่ <b>${esc(u.phone)}</b> แล้ว<br>ให้เจ้าของเบอร์แจ้งรหัส แล้วกรอกด้านล่าง (รหัสมีอายุ 5 นาที)</p></div>
    <form><input name="otp" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required autocomplete="one-time-code" style="text-align:center;font-size:1.6rem;letter-spacing:.5em" aria-label="รหัส OTP">
    <div class="row" style="margin-top:16px"><button type="button" class="btn ghost" id="resend">↻ ส่งรหัสใหม่</button><button type="button" class="btn ghost" data-close>ไว้ทีหลัง</button><button class="btn ok">✔ ยืนยัน</button></div></form>`);
  $('[name=otp]', m).focus();
  $('form', m).onsubmit = e => {
    e.preventDefault();
    busy(e.submitter, async () => { await api(`/admin/accounts/${u.id}/verify`, { method: 'POST', body: { otp: e.target.otp.value } }); m.remove(); toast('✔ ยืนยันเบอร์โทรแล้ว บัญชีนี้เข้าสู่ระบบได้', 'ok'); accountsPage(); });
  };
  $('#resend', m).onclick = e => busy(e.currentTarget, async () => { const r = await api(`/admin/accounts/${u.id}/resend`, { method: 'POST' }); toast(`ส่งรหัสใหม่ไปที่ ${r.phone} แล้ว`); });
}

async function accountsPage() {
  const rows = await api('/admin/accounts');
  page().innerHTML = `<div class="card reveal"><div class="row" style="margin-bottom:14px;align-items:center">
      <p class="muted" style="margin:0;flex:2 1 300px">เข้าระบบได้ 2 แบบ: <b>ผู้ดูแลระบบ</b> (ทำได้ทุกอย่าง) และ <b>ฝ่ายวิชาการแผนก</b> (จัดการเฉพาะแผนกตัวเอง)</p>
      <button class="btn" id="add">＋ สร้างบัญชี</button></div>
    <div class="table-wrap"><table class="list"><thead><tr><th>ชื่อผู้ใช้</th><th>ชื่อ-สกุล</th><th>บทบาท</th><th>แผนก</th><th>เบอร์โทร (OTP)</th><th></th></tr></thead><tbody>
    ${rows.map(u => `<tr><td>${esc(u.username)}</td><td>${esc(u.full_name)}</td><td><span class="badge ${u.role === 'admin' ? 'pri' : 'ok'}">${ROLE[u.role]}</span></td><td>${esc(u.department || '-')}</td><td>${esc(u.phone || '-')} ${u.verified ? '<span class="badge ok">✔ ยืนยันแล้ว</span>' : `<span class="badge warn">รอยืนยัน OTP</span> <button class="btn ok sm" data-verify="${u.id}">ยืนยัน OTP</button>`}</td>
      <td style="white-space:nowrap">${u.locked ? `<button class="btn ok sm" data-unlock="${u.id}">🔓 ปลดล็อก</button> ` : ''}<button class="btn ghost sm" data-edit="${u.id}">แก้ไข</button>${u.id === me.id ? '' : ` <button class="btn danger sm" data-del="${u.id}">ลบ</button>`}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  const form = u => {
    const m = modal(`<h3>${u ? 'แก้ไขบัญชี' : 'สร้างบัญชีใหม่'}</h3><form>
      <label>ชื่อผู้ใช้ (ใช้ล็อกอิน)</label><input name="username" value="${esc(u?.username || '')}" ${u ? 'readonly' : 'required'} autocomplete="off">
      <label>ชื่อ-สกุล</label><input name="full_name" value="${esc(u?.full_name || '')}" required>
      <label>บทบาท</label><select name="role" ${u?.id === me.id ? 'disabled' : ''}><option value="dept" ${u?.role !== 'admin' ? 'selected' : ''}>ฝ่ายวิชาการแผนก</option><option value="admin" ${u?.role === 'admin' ? 'selected' : ''}>ผู้ดูแลระบบ</option></select>
      <label>แผนก (สำหรับฝ่ายวิชาการ)</label><input name="department" list="dl-dept" value="${esc(u?.department || '')}" placeholder="เช่น ช่างยนต์">
      <datalist id="dl-dept">${departments().map(d => `<option value="${esc(d)}">`).join('')}</datalist>
      <label>เบอร์มือถือของเจ้าของบัญชี ${u?.phone ? `(ปัจจุบัน ${esc(u.phone)} — เว้นว่าง = ไม่เปลี่ยน, เปลี่ยนแล้วต้องยืนยัน OTP ใหม่)` : '(ระบบจะส่ง OTP ไปเบอร์นี้เพื่อยืนยันการสมัคร)'}</label><input name="phone" inputmode="numeric" maxlength="10" pattern="0[0-9]{9}" ${u ? '' : 'required'}>
      <label>${u ? 'ตั้งรหัสผ่านใหม่ (เว้นว่าง = ไม่เปลี่ยน)' : 'รหัสผ่าน (อย่างน้อย 8 ตัว)'}</label><input name="password" type="password" minlength="8" ${u ? '' : 'required'} autocomplete="new-password">
      <div class="row" style="margin-top:18px"><button type="button" class="btn ghost" data-close>ยกเลิก</button><button class="btn">💾 บันทึก</button></div></form>`);
    $('form', m).onsubmit = e => {
      e.preventDefault();
      const body = Object.fromEntries([...new FormData(e.target)].filter(([k, v]) => v !== '' || k === 'department'));
      if (body.role === 'dept' && !body.department) return toast('บัญชีฝ่ายวิชาการต้องระบุแผนก', 'bad');
      busy(e.submitter, async () => {
        const saved = await api(u ? `/admin/accounts/${u.id}` : '/admin/accounts', { method: u ? 'PUT' : 'POST', body });
        m.remove(); toast('บันทึกแล้ว', 'ok'); await accountsPage();
        if (!saved.verified && (!u || body.phone)) otpModal(saved); // เพิ่งส่ง OTP ไป
      });
    };
  };
  $('#add').onclick = () => form(null);
  $$('[data-edit]').forEach(b => b.onclick = () => form(rows.find(u => u.id === b.dataset.edit)));
  $$('[data-verify]').forEach(b => b.onclick = () => otpModal(rows.find(u => u.id === b.dataset.verify)));
  $$('[data-unlock]').forEach(b => b.onclick = () => api(`/admin/accounts/${b.dataset.unlock}`, { method: 'PUT', body: { unlock: true } }).then(() => { toast('ปลดล็อกแล้ว', 'ok'); accountsPage(); }));
  $$('[data-del]').forEach(b => b.onclick = () => confirm('ลบบัญชีนี้?') && api(`/admin/accounts/${b.dataset.del}`, { method: 'DELETE' }).then(() => { toast('ลบแล้ว', 'ok'); accountsPage(); }).catch(e => toast(e.message, 'bad')));
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

const LOG_NAMES = { settings_update: 'แก้ไขการตั้งค่า', account_verified: 'ยืนยันเบอร์บัญชี', account_create: 'สร้างบัญชี', account_update: 'แก้ไขบัญชี',  login_ok: 'เข้าสู่ระบบ', login_failed: 'รหัสผ่านผิด', account_locked: 'ล็อกบัญชี', otp_failed: 'OTP ผิด', sms_sent: 'ส่ง SMS', sms_failed: 'ส่ง SMS ไม่สำเร็จ', sms_dev: 'SMS (ทดสอบ)', pdpa_consent: 'ยอมรับ PDPA', pdpa_export: 'PDPA: ขอสำเนาข้อมูล', pdpa_delete_request: 'PDPA: ขอลบข้อมูล', backup: 'สำรองข้อมูล', export: 'ส่งออกตาราง', publish: 'ประกาศตาราง', ai_generate: 'AI จัดตาราง', snapshot: 'Snapshot', data_delete: 'ลบข้อมูล', password_reset: 'รีเซ็ตรหัสผ่าน', password_reset_requested: 'ขอรีเซ็ตรหัสผ่าน', password_change: 'เปลี่ยนรหัสผ่าน', profile_update: 'แก้ไขข้อมูลส่วนตัว', students_import: 'นำเข้านักเรียน', timeblock_request: 'คำร้องบล็อกเวลา' };
async function logsPage(action = '') {
  const list = await api('/admin/logs' + (action ? `?action=${encodeURIComponent(action)}` : ''));
  const cls = a => /failed|locked/.test(a) ? 'bad' : /pdpa/.test(a) ? 'warn' : /ok|backup|publish/.test(a) ? 'ok' : 'pri';
  page().innerHTML = `<div class="card reveal"><div class="row" style="margin-bottom:12px"><select id="act"><option value="">ทุกกิจกรรม</option>${Object.entries(LOG_NAMES).map(([k, v]) => `<option value="${k}" ${k === action ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="table-wrap"><table class="list"><thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>กิจกรรม</th><th>รายละเอียด</th><th>IP</th></tr></thead><tbody>
    ${list.map(l => `<tr><td style="white-space:nowrap">${fmtDate(l.created_at)}</td><td>${esc(l.user ? `${l.user.username} ${l.user.full_name}` : l.detail?.username || 'ระบบ')}</td><td><span class="badge ${cls(l.action)}">${esc(LOG_NAMES[l.action] || l.action)}</span></td><td class="muted" style="font-size:.8rem">${esc(l.detail ? JSON.stringify(l.detail) : '')}</td><td class="muted">${esc(l.ip || '')}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  $('#act').onchange = e => logsPage(e.target.value);
}

const PAGES = { dashboard, schedule: schedulePage, accounts: accountsPage, backup: backupPage, logs: () => logsPage(), profile: profilePage };

// ปุ่มพิมพ์/PDF ในหน้าจัดตาราง: พิมพ์เป็นแบบฟอร์มราชการเดียวกับหน้าบุคคลทั่วไป (ตามมุมมอง กลุ่ม/ครู/ห้อง ที่เลือกอยู่)
addEventListener('beforeprint', () => {
  const on = !!($('#vid') && S.version && S.view.id);
  document.body.classList.toggle('print-form-mode', on);
  if (on) { renderForm($('#print-sheet'), { L, entries: S.entries, view: S.view, fullGrid: true }); fitForPrint($('#print-sheet')); }
});
addEventListener('afterprint', () => { document.body.classList.remove('print-form-mode'); unfitPrint($('#print-sheet')); $('#print-sheet').innerHTML = ''; });

boot().catch(() => {});
