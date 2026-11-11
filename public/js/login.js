import { api, toast, $, $$, busy, tilt } from './ui.js';

let role = 'student', temp = null, resetTemp = null;
const show = id => { $$('section').forEach(s => s.classList.add('hidden')); $(id).classList.remove('hidden'); };
const go = () => { location.href = '/app.html'; };

$$('.role').forEach(el => {
  tilt(el);
  el.onclick = () => {
    role = el.dataset.role;
    $('#login-title').textContent = role === 'student' ? '🎓 นักเรียน / นักศึกษา' : '👩‍🏫 ครูผู้สอน / บุคลากร';
    $('#lbl-user').textContent = role === 'student' ? 'รหัสนักเรียน' : 'รหัสพนักงาน';
    show('#step-login'); $('#username').focus();
  };
});
$$('[data-back]').forEach(b => b.onclick = () => show('#step-role'));
$('#to-forgot').onclick = () => show('#step-forgot');

$('#f-login').onsubmit = e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  busy(e.submitter, async () => {
    const r = await api('/auth/login', { method: 'POST', body: { ...f, role } });
    if (!r.otp) return go();
    temp = r.temp; $('#otp-phone').textContent = r.phone; show('#step-otp'); cells[0].focus(); toast('ส่งรหัส OTP ทาง SMS แล้ว');
  });
};

// ช่องกรอก OTP 6 ช่อง: เลื่อนอัตโนมัติ, ลบย้อนกลับ, วางรหัสได้
const box = $('.otp');
box.innerHTML = '<input inputmode="numeric" maxlength="1" autocomplete="one-time-code">'.repeat(6);
const cells = $$('input', box);
cells.forEach((c, i) => {
  c.oninput = () => { c.value = c.value.replace(/\D/g, ''); if (c.value && cells[i + 1]) cells[i + 1].focus(); if (cells.every(x => x.value)) $('#f-otp').requestSubmit(); };
  c.onkeydown = e => { if (e.key === 'Backspace' && !c.value && cells[i - 1]) cells[i - 1].focus(); };
  c.onpaste = e => { e.preventDefault(); [...e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)].forEach((d, j) => cells[j].value = d); $('#f-otp').requestSubmit(); };
});
$('#f-otp').onsubmit = e => {
  e.preventDefault();
  busy($('#f-otp .btn'), async () => {
    try { await api('/auth/otp', { method: 'POST', body: { temp, otp: cells.map(c => c.value).join('') } }); go(); }
    catch (err) { cells.forEach(c => c.value = ''); cells[0].focus(); throw err; }
  });
};

$('#f-forgot').onsubmit = e => {
  e.preventDefault();
  busy(e.submitter, async () => {
    const r = await api('/auth/forgot', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
    resetTemp = r.temp; toast(r.message); $('#f-reset').classList.remove('hidden'); e.target.classList.add('hidden');
  });
};
$('#f-reset').onsubmit = e => {
  e.preventDefault();
  busy(e.submitter, async () => {
    await api('/auth/reset', { method: 'POST', body: { ...Object.fromEntries(new FormData(e.target)), temp: resetTemp } });
    toast('ตั้งรหัสผ่านใหม่เรียบร้อย กรุณาเข้าสู่ระบบ', 'ok');
    e.target.reset(); e.target.classList.add('hidden'); $('#f-forgot').classList.remove('hidden'); show('#step-role');
  });
};

// ยังล็อกอินอยู่ -> เข้าแอปเลย (ใช้ fetch ตรง ไม่ให้ api() redirect วนกลับหน้านี้)
fetch('/api/me').then(r => { if (r.ok) go(); });
