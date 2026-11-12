import { esc } from './ui.js';
import { DAYS, LUNCH, isLunch, contiguous, lunchBetween } from '/shared/conflicts.js';

const MORNING = { start: '07:40', end: '08:00', label: 'กิจกรรมหน้าเสาธง' };
const hue = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

// แสดงตารางรายสัปดาห์ (แถว = วัน, คอลัมน์ = คาบ)
// view: { type: 'group'|'teacher'|'room', id }, L = ข้อมูล lookup ที่ index ด้วย id แล้ว
export function renderGrid(el, { entries, L, view, editable = false, conflicts = new Map(), onMove, onAdd, onClick, fullGrid = false }) {
  const days = [...new Set(L.periods.map(p => p.day))].sort();
  const nums = [...new Set(L.periods.map(p => p.period_no))].sort((a, b) => a - b);
  const time = n => L.periods.find(p => p.period_no === n);
  // คอลัมน์ = คาบเรียน + ช่องพักเที่ยง (ช่วงว่างตอนเที่ยง หรือคาบที่ตั้งเวลาไว้ทับเที่ยง)
  const cols = [];
  nums.forEach((n, i) => {
    if (i && lunchBetween(time(nums[i - 1]), time(n))) cols.push({ gap: true });
    cols.push({ n, lunch: isLunch(time(n)) });
  });
  const hasLunch = cols.some(c => c.gap || c.lunch);
  const key = { group: 'group_id', teacher: 'teacher_id', room: 'room_id' }[view.type];
  const mine = entries.filter(e => !view.id || e[key] === view.id);
  // คาบติดกันที่เป็นวิชา/ครู/ห้อง/กลุ่มเดียวกัน รวมเป็นช่องเดียว (เฉพาะโหมดดู — โหมดแก้ไขต้องลากได้ทีละคาบ) ไม่รวมข้ามพักเที่ยง
  const same = (a, b) => ['subject_id', 'teacher_id', 'room_id', 'group_id'].every(k => a[k] === b[k]);
  const cellsOf = d => {
    const at = n => mine.filter(e => e.day === d && e.period_no === n);
    const out = [];
    for (let i = 0; i < cols.length;) {
      const c = cols[i];
      if (c.gap) { out.push(c); i++; continue; }
      const list = at(c.n);
      let span = 1;
      while (!editable && !c.lunch && list.length === 1 && i + span < cols.length) {
        const nc = cols[i + span];
        if (nc.gap || nc.lunch || !contiguous(time(cols[i + span - 1].n), time(nc.n))) break;
        const next = at(nc.n);
        if (next.length !== 1 || !same(list[0], next[0])) break;
        span++;
      }
      out.push({ n: c.n, last: cols[i + span - 1].n, list, span, lunch: c.lunch });
      i += span;
    }
    return out;
  };

  const slot = e => {
    const s = L.subject[e.subject_id] || {}, bad = conflicts.get(e.id);
    const lines = {
      group: [L.teacher[e.teacher_id]?.full_name, 'ห้อง ' + (L.room[e.room_id]?.code || 'ไม่ระบุ')],
      teacher: ['กลุ่ม ' + L.group[e.group_id]?.code, 'ห้อง ' + (L.room[e.room_id]?.code || '-')],
      room: ['กลุ่ม ' + L.group[e.group_id]?.code, L.teacher[e.teacher_id]?.full_name],
    }[view.type];
    return `<div class="slot ${bad ? 'conflict' : ''}" style="--h:${hue(s.code)}" data-id="${e.id}" ${editable ? 'draggable="true"' : ''}
      title="${esc(bad ? '⚠ ' + bad.join(', ') : s.name)}"><b>${esc(s.name)}</b><div class="muted">${esc(s.code)}</div>${lines.map(x => `<div class="muted">${esc(x)}</div>`).join('')}</div>`;
  };

  if (!editable && !fullGrid && matchMedia('(max-width: 700px)').matches) {
    el.innerHTML = `<div class="agenda">${days.map(d => {
      const cells = cellsOf(d).filter(c => c.list?.length);
      const at = hasLunch ? cells.findIndex(c => (time(c.n)?.start_time || '') >= LUNCH.end) : -2;
      const lunchRow = `<div class="lunch-row">พักกลางวัน ${LUNCH.start}–${LUNCH.end} น.</div>`;
      return `<h4>วัน${DAYS[d]}</h4>` + (cells.map((c, k) => (k === at ? lunchRow : '') + c.list.map(e => {
        const a = time(c.n), b = time(c.last);
        const tm = a && b ? `${esc(a.start_time.slice(0, 5))}<br>${esc(b.end_time.slice(0, 5))}` : `คาบ ${c.n}`;
        return slot(e).replace('<b>', `<div class="tm">${tm}</div><div><b>`).replace(/<\/div>$/, '</div></div>');
      }).join('')).join('') + (cells.length && at === -1 ? lunchRow : '') || '<div class="muted">ไม่มีเรียน</div>');
    }).join('')}</div>`;
    el.querySelectorAll('.slot').forEach(s => s.onclick = () => onClick?.(entries.find(e => e.id === s.dataset.id)));
    return;
  }
  // แบบฟอร์มราชการ: แถว "เวลา" + แถว "วัน/คาบ" และช่องแนวตั้ง กิจกรรมหน้าเสาธง / พักกลางวัน
  const range = t => (t ? esc(`${t.start_time.slice(0, 5)} - ${t.end_time.slice(0, 5)}`) : '');
  const first = time(nums[0]);
  const morning = first && first.start_time.slice(0, 5) >= MORNING.end;
  const band = txt => `<td class="band" rowspan="${days.length + 1}"><span>${txt}</span></td>`;
  el.innerHTML = `<div class="table-wrap"><table class="tt"><tbody>
    <tr><th class="hd-first">เวลา</th>${morning ? `<th class="band">${MORNING.start} - ${MORNING.end}</th>` : ''}${cols.map(c =>
      c.gap ? `<th class="band">${LUNCH.start} - ${LUNCH.end}</th>` : `<th>${range(time(c.n))}</th>`).join('')}</tr>
    <tr><th class="hd-first">วัน/คาบ</th>${morning ? band(MORNING.label) : ''}${cols.map(c =>
      c.gap ? band('พักกลางวัน') : `<th>${c.lunch ? 'พัก' : c.n}</th>`).join('')}</tr>
    ${days.map(d => `<tr><th class="day">วัน${DAYS[d]}</th>${cellsOf(d).map(c => c.gap ? ''
      : `<td data-day="${d}" data-p="${c.n}"${c.lunch ? ' class="lunch"' : ''}${c.span > 1 ? ` colspan="${c.span}"` : ''}>${c.list.map(slot).join('')}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div>`;

  el.querySelectorAll('.slot').forEach(s => s.onclick = () => onClick?.(entries.find(e => e.id === s.dataset.id)));
  if (!editable) return;
  el.querySelectorAll('.slot').forEach(s => s.ondragstart = ev => ev.dataTransfer.setData('text/plain', 'move:' + s.dataset.id));
  el.querySelectorAll('td[data-day]').forEach(td => {
    td.ondragover = ev => { ev.preventDefault(); td.classList.add('drop'); };
    td.ondragleave = () => td.classList.remove('drop');
    td.ondrop = ev => {
      ev.preventDefault(); td.classList.remove('drop');
      const [kind, id] = ev.dataTransfer.getData('text/plain').split(':');
      const day = +td.dataset.day, p = +td.dataset.p;
      if (kind === 'move') onMove?.(id, day, p); else if (kind === 'new') onAdd?.(id, day, p);
    };
  });
}

export function indexLookup(lk) {
  const by = a => Object.fromEntries(a.map(x => [x.id, x]));
  return { ...lk, subject: by(lk.subjects), teacher: by(lk.teachers), room: by(lk.rooms), group: by(lk.groups) };
}
