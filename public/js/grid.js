import { esc } from './ui.js';
import { DAYS } from '/shared/conflicts.js';

const hue = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

// แสดงตารางรายสัปดาห์ (แถว = วัน, คอลัมน์ = คาบ)
// view: { type: 'group'|'teacher'|'room', id }, L = ข้อมูล lookup ที่ index ด้วย id แล้ว
export function renderGrid(el, { entries, L, view, editable = false, conflicts = new Map(), onMove, onAdd, onClick, fullGrid = false }) {
  const days = [...new Set(L.periods.map(p => p.day))].sort();
  const nums = [...new Set(L.periods.map(p => p.period_no))].sort((a, b) => a - b);
  const time = n => L.periods.find(p => p.period_no === n);
  const key = { group: 'group_id', teacher: 'teacher_id', room: 'room_id' }[view.type];
  const mine = entries.filter(e => !view.id || e[key] === view.id);
  // คาบติดกันที่เป็นวิชา/ครู/ห้อง/กลุ่มเดียวกัน รวมเป็นช่องเดียว (เฉพาะโหมดดู — โหมดแก้ไขต้องลากได้ทีละคาบ)
  const same = (a, b) => ['subject_id', 'teacher_id', 'room_id', 'group_id'].every(k => a[k] === b[k]);
  const cellsOf = d => {
    const at = n => mine.filter(e => e.day === d && e.period_no === n);
    const out = [];
    for (let i = 0; i < nums.length;) {
      const list = at(nums[i]);
      let span = 1;
      while (!editable && list.length === 1 && i + span < nums.length) {
        const next = at(nums[i + span]);
        if (next.length !== 1 || !same(list[0], next[0])) break;
        span++;
      }
      out.push({ n: nums[i], last: nums[i + span - 1], list, span });
      i += span;
    }
    return out;
  };

  const slot = e => {
    const s = L.subject[e.subject_id] || {}, bad = conflicts.get(e.id);
    const lines = {
      group: [L.teacher[e.teacher_id]?.full_name, '📍 ' + (L.room[e.room_id]?.code || 'ไม่ระบุห้อง')],
      teacher: ['👥 ' + L.group[e.group_id]?.code, '📍 ' + (L.room[e.room_id]?.code || '-')],
      room: ['👥 ' + L.group[e.group_id]?.code, L.teacher[e.teacher_id]?.full_name],
    }[view.type];
    return `<div class="slot ${bad ? 'conflict' : ''}" style="--h:${hue(s.code)}" data-id="${e.id}" ${editable ? 'draggable="true"' : ''}
      title="${esc(bad ? '⚠ ' + bad.join(', ') : s.name)}"><b>${esc(s.code)} ${esc(s.name)}</b>${lines.map(x => `<div class="muted">${esc(x)}</div>`).join('')}</div>`;
  };

  if (!editable && !fullGrid && matchMedia('(max-width: 700px)').matches) {
    el.innerHTML = `<div class="agenda">${days.map(d => {
      const cells = cellsOf(d).filter(c => c.list.length);
      return `<h4>${DAYS[d]}</h4>` + (cells.map(c => c.list.map(e => {
        const a = time(c.n), b = time(c.last);
        const tm = a && b ? `${esc(a.start_time.slice(0, 5))}<br>${esc(b.end_time.slice(0, 5))}` : `คาบ ${c.n}`;
        return slot(e).replace('<b>', `<div class="tm">${tm}</div><div><b>`).replace(/<\/div>$/, '</div></div>');
      }).join('')).join('') || '<div class="muted">ไม่มีเรียน</div>');
    }).join('')}</div>`;
    el.querySelectorAll('.slot').forEach(s => s.onclick = () => onClick?.(entries.find(e => e.id === s.dataset.id)));
    return;
  }
  el.innerHTML = `<div class="table-wrap"><table class="tt"><thead><tr><th></th>${nums.map(n => {
    const t = time(n); return `<th>คาบ ${n}<br>${t ? esc(t.start_time.slice(0, 5) + '-' + t.end_time.slice(0, 5)) : ''}</th>`;
  }).join('')}</tr></thead><tbody>${days.map(d => `<tr><th class="day">${DAYS[d]}</th>${cellsOf(d).map(c =>
    `<td data-day="${d}" data-p="${c.n}"${c.span > 1 ? ` colspan="${c.span}"` : ''}>${c.list.map(slot).join('')}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div>`;

  el.querySelectorAll('.slot').forEach(s => s.onclick = () => onClick?.(entries.find(e => e.id === s.dataset.id)));
  if (!editable) return;
  el.querySelectorAll('.slot').forEach(s => s.ondragstart = ev => ev.dataTransfer.setData('text/plain', 'move:' + s.dataset.id));
  el.querySelectorAll('td').forEach(td => {
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
