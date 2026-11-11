// ตัวช่วยฝั่งหน้าเว็บ: เรียก API, ป้องกัน XSS, toast, modal, เอฟเฟกต์
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// มุมมองจำลองของแอดมิน (ชื่อแผนก) เก็บต่อแท็บเบราว์เซอร์
export const viewAs = {
  get() { try { return sessionStorage.getItem('viewAsDept') || ''; } catch { return ''; } },
  set(d) { try { d ? sessionStorage.setItem('viewAsDept', d) : sessionStorage.removeItem('viewAsDept'); } catch { /* โหมดส่วนตัว */ } },
};

export async function api(path, { method = 'GET', body } = {}) {
  const headers = body ? { 'Content-Type': 'application/json' } : {};
  if (viewAs.get()) headers['X-View-As-Dept'] = encodeURIComponent(viewAs.get()); // header ต้องเป็น ASCII
  const r = await fetch('/api' + path, { method, headers, body: body && JSON.stringify(body), credentials: 'same-origin' });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && !path.startsWith('/auth')) { location.href = '/login.html'; throw new Error('session'); }
  if (!r.ok) throw Object.assign(new Error(data.error || 'เกิดข้อผิดพลาด'), { status: r.status });
  return data;
}

export function toast(msg, type = '') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.append(box); }
  const t = document.createElement('div');
  t.className = `toast ${type}`; t.textContent = msg;
  box.append(t);
  setTimeout(() => { t.style.transition = 'opacity .4s, transform .4s'; t.style.opacity = 0; t.style.transform = 'translateX(40px)'; setTimeout(() => t.remove(), 400); }, 3800);
}

export function modal(html, { closable = true } = {}) {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="card">${html}</div>`;
  if (closable) m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) m.remove(); });
  document.body.append(m);
  return m;
}

// ปุ่มแสดง spinner ระหว่างรอ และกันกดซ้ำ
export async function busy(btn, fn) {
  const html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span> กำลังประมวลผล...';
  try { return await fn(); } catch (e) { toast(e.message, 'bad'); } finally { btn.disabled = false; btn.innerHTML = html; }
}

export function countUp(el) {
  const target = +el.dataset.n, t0 = performance.now();
  const step = t => { const p = Math.min(1, (t - t0) / 900); el.textContent = (target * (1 - (1 - p) ** 3)).toFixed(target % 1 ? 1 : 0); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

// เอฟเฟกต์ ripple ทุกปุ่ม + การ์ดเอียงตามเมาส์
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('.btn'); if (!b) return;
  const r = b.getBoundingClientRect(), s = document.createElement('span'), d = Math.max(r.width, r.height);
  s.className = 'ripple'; Object.assign(s.style, { width: d + 'px', height: d + 'px', left: e.clientX - r.left - d / 2 + 'px', top: e.clientY - r.top - d / 2 + 'px' });
  b.append(s); setTimeout(() => s.remove(), 600);
});
export function tilt(el) {
  el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.transform = `perspective(700px) rotateY(${((e.clientX - r.left) / r.width - .5) * 12}deg) rotateX(${-((e.clientY - r.top) / r.height - .5) * 12}deg) translateY(-4px)`; });
  el.addEventListener('pointerleave', () => { el.style.transform = ''; });
}

export function download(url) { const a = document.createElement('a'); a.href = url; a.click(); }
