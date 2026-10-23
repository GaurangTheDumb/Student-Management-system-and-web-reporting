/* ===== Storage layer =====
   Data lives in localStorage by default. To use a real backend, set API_BASE to
   an endpoint that supports GET (returns the JSON db) and PUT (saves the JSON db). */
const API_BASE = '';              // e.g. 'http://localhost:3000/api/data'
const KEY = 'student_register_v1';
const SUBJECTS = ['Internet & Web Tech', 'Mathematics', 'Physics', 'Programming', 'English'];
const PALETTE = ['#2f6db5', '#e9b93a', '#3f9a72', '#b3402f', '#7a5aa6', '#d4793b'];
const empty = () => ({ students: [], marks: [], attendance: [], assignments: [] });
let db = empty();

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function load() {
  if (API_BASE) { try { db = await (await fetch(API_BASE)).json(); } catch { toast('Backend unreachable. Using local data.'); } }
  if (!db.students.length) { try { db = JSON.parse(localStorage.getItem(KEY)) || empty(); } catch { db = empty(); } }
  renderAll();
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(db));
  if (API_BASE) fetch(API_BASE, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(db) }).catch(() => toast('Could not reach the backend.'));
  renderAll();
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ===== Analytics ===== */
const grade = (p) => p >= 90 ? 'A+' : p >= 80 ? 'A' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 50 ? 'D' : 'F';
const gradeTag = (g) => g === 'F' || g === 'D' ? 'bad' : g === 'C' ? 'warn' : 'ok';
const sName = (id) => (db.students.find((s) => s.id === id) || {}).name || 'Removed';

function stats(id) {
  const m = db.marks.filter((x) => x.sid === id);
  const scored = m.reduce((a, x) => a + x.score, 0), max = m.reduce((a, x) => a + x.max, 0);
  const at = db.attendance.filter((x) => x.sid === id);
  const present = at.filter((x) => x.status !== 'Absent').length;
  const as = db.assignments.filter((x) => x.sid === id);
  const done = as.filter((x) => x.status !== 'Pending').length;
  return {
    pct: max ? scored / max * 100 : null,
    att: at.length ? present / at.length * 100 : null,
    asn: as.length ? done / as.length * 100 : null,
    scored, max, days: at.length, present, asnTotal: as.length, asnDone: done
  };
}
const avg = (arr) => { const a = arr.filter((v) => v !== null); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
const fmt = (v, s = '%') => v === null ? '–' : v.toFixed(1) + s;

/* ===== Charts (plain canvas, no libraries) ===== */
function bar(id, labels, vals, max, suffix = '') {
  const c = $(id), x = c.getContext('2d'), W = c.width, H = c.height, p = 32;
  const ink = getComputedStyle(document.body).color;
  x.clearRect(0, 0, W, H); x.font = '12px Segoe UI, sans-serif'; x.textAlign = 'center'; x.fillStyle = ink;
  if (!labels.length) { x.fillText('Add marks or attendance to see this chart.', W / 2, H / 2); return; }
  const bw = (W - p * 2) / labels.length;
  x.strokeStyle = 'rgba(128,128,128,.35)'; x.beginPath(); x.moveTo(p, H - p); x.lineTo(W - p, H - p); x.stroke();
  vals.forEach((v, i) => {
    const h = (H - p * 2) * v / (max || 1), cx = p + i * bw + bw / 2;
    x.fillStyle = PALETTE[i % PALETTE.length]; x.fillRect(p + i * bw + bw * .18, H - p - h, bw * .64, h);
    x.fillStyle = ink; x.fillText(Math.round(v) + suffix, cx, H - p - h - 5);
    x.fillText(labels[i].length > 10 ? labels[i].slice(0, 9) + '…' : labels[i], cx, H - 12);
  });
}

function renderDashboard() {
  const all = db.students.map((s) => ({ s, ...stats(s.id) }));
  const kp = [
    [db.students.length, 'Students enrolled'],
    [fmt(avg(all.map((a) => a.pct))), 'Average score'],
    [fmt(avg(all.map((a) => a.att))), 'Average attendance'],
    [fmt(avg(all.map((a) => a.asn))), 'Assignments handed in']
  ];
  $('#kpis').innerHTML = kp.map(([v, l]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('');

  const subj = SUBJECTS.map((sub) => {
    const m = db.marks.filter((x) => x.subject === sub);
    return m.length ? [sub, avg(m.map((x) => x.score / x.max * 100))] : null;
  }).filter(Boolean);
  bar('#chSubjects', subj.map((x) => x[0]), subj.map((x) => x[1]), 100, '%');

  const gc = ['A+', 'A', 'B', 'C', 'D', 'F'].map((g) => [g, all.filter((a) => a.pct !== null && grade(a.pct) === g).length]);
  const hasG = all.some((a) => a.pct !== null);
  bar('#chGrades', hasG ? gc.map((x) => x[0]) : [], gc.map((x) => x[1]), Math.max(1, ...gc.map((x) => x[1])));

  const at = all.filter((a) => a.att !== null);
  bar('#chAttendance', at.map((a) => a.s.name.split(' ')[0]), at.map((a) => a.att), 100, '%');

  const ranked = all.filter((a) => a.pct !== null).sort((a, b) => b.pct - a.pct);
  $('#ranking').innerHTML = ranked.length
    ? ranked.map((a) => `<li>${esc(a.s.name)} <span>${a.pct.toFixed(1)}% · ${grade(a.pct)}</span></li>`).join('')
    : '<li class="empty">No marks recorded yet.</li>';
}

/* ===== Tables ===== */
function table(head, rows, empty) {
  if (!rows.length) return `<p class="empty">${empty}</p>`;
  return `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
const delBtn = (col, id) => `<button data-del="${col}:${id}">Delete</button>`;

function renderTables() {
  $('#studentTable').innerHTML = table(['Name', 'Roll no.', 'Class', 'Email', 'Score', 'Attendance', ''],
    db.students.map((s) => { const t = stats(s.id); return [esc(s.name), esc(s.roll), esc(s.cls), esc(s.email) || '–', fmt(t.pct), fmt(t.att), delBtn('students', s.id)]; }),
    'No students yet. Add one above, or load the demo data.');
  $('#markTable').innerHTML = table(['Student', 'Subject', 'Marks', 'Percent', 'Grade', ''],
    db.marks.map((m) => { const p = m.score / m.max * 100, g = grade(p); return [esc(sName(m.sid)), esc(m.subject), `${m.score}/${m.max}`, p.toFixed(1) + '%', `<span class="tag ${gradeTag(g)}">${g}</span>`, delBtn('marks', m.id)]; }),
    'No marks recorded yet.');
  $('#attTable').innerHTML = table(['Student', 'Days recorded', 'Present or late', 'Attendance', 'Log'],
    db.students.map((s) => { const t = stats(s.id); const cls = t.att === null ? '' : t.att >= 75 ? 'ok' : t.att >= 60 ? 'warn' : 'bad';
      const last = db.attendance.filter((a) => a.sid === s.id).slice(-3).map((a) => `${a.date} ${a.status} ${delBtn('attendance', a.id)}`).join('<br>');
      return [esc(s.name), t.days, t.present, `<span class="tag ${cls}">${fmt(t.att)}</span>`, last || '–']; }),
    'Add a student first, then mark attendance.');
  $('#asnTable').innerHTML = table(['Student', 'Assignment', 'Status', ''],
    db.assignments.map((a) => [esc(sName(a.sid)), esc(a.title), `<span class="tag ${a.status === 'Submitted' ? 'ok' : a.status === 'Late' ? 'warn' : 'bad'}">${a.status}</span>`, delBtn('assignments', a.id)]),
    'No assignments tracked yet.');
}

function renderSelects() {
  const opts = db.students.length ? db.students.map((s) => `<option value="${s.id}">${esc(s.name)} (${esc(s.roll)})</option>`).join('') : '<option value="">Add a student first</option>';
  $$('.studentSel').forEach((el) => { const v = el.value; el.innerHTML = opts; if (v) el.value = v; });
}
function renderAll() { renderSelects(); renderTables(); renderDashboard(); }

/* ===== Report-card templates ===== */
const THEMES = {
  classic: { font: 'Georgia, serif', bg: '#fffdf6', accent: '#7a1f2b', head: '#7a1f2b', headText: '#fff', border: '3px double #7a1f2b' },
  modern:  { font: 'Segoe UI, system-ui, sans-serif', bg: '#ffffff', accent: '#2f6db5', head: 'linear-gradient(120deg,#17352d,#2f6db5)', headText: '#fff', border: '1px solid #cfd8e3' },
  minimal: { font: 'Helvetica, Arial, sans-serif', bg: '#ffffff', accent: '#222', head: '#fff', headText: '#111', border: '1px solid #222' }
};
function autoRemark(p) {
  return p === null ? 'No marks have been recorded yet.' : p >= 85 ? 'Outstanding work. Keep challenging yourself.' : p >= 70 ? 'Good progress. A little more practice will lift you further.' : p >= 50 ? 'Satisfactory. Regular revision will help raise your results.' : 'Needs extra support. Please meet the class teacher to plan improvement.';
}
function reportHTML(s, tplName, remarks, inst) {
  const t = THEMES[tplName] || THEMES.classic, st = stats(s.id);
  const rows = SUBJECTS.map((sub) => {
    const m = db.marks.filter((x) => x.sid === s.id && x.subject === sub);
    if (!m.length) return '';
    const sc = m.reduce((a, x) => a + x.score, 0), mx = m.reduce((a, x) => a + x.max, 0), p = sc / mx * 100;
    return `<tr><td>${esc(sub)}</td><td>${sc} / ${mx}</td><td>${p.toFixed(1)}%</td><td><b>${grade(p)}</b></td></tr>`;
  }).join('') || '<tr><td colspan="4">No marks recorded.</td></tr>';
  const overall = st.pct === null ? '–' : st.pct.toFixed(1) + '% (' + grade(st.pct) + ')';
  const ranked = db.students.map((x) => ({ id: x.id, p: stats(x.id).pct })).filter((x) => x.p !== null).sort((a, b) => b.p - a.p);
  const rank = ranked.findIndex((x) => x.id === s.id);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report card - ${esc(s.name)}</title><style>
body{margin:0;padding:24px;background:#eee;font-family:${t.font}}
.card{max-width:760px;margin:auto;background:${t.bg};border:${t.border};padding:0 0 24px}
.head{background:${t.head};color:${t.headText};padding:22px 28px;text-align:center;${tplName === 'minimal' ? 'border-bottom:2px solid #111;' : ''}}
.head h1{margin:0;font-size:24px}.head p{margin:4px 0 0;opacity:.85}
.info{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;padding:18px 28px}
.info span{color:#666}table{width:calc(100% - 56px);margin:0 28px;border-collapse:collapse}
th{background:${tplName === 'minimal' ? '#f0f0f0' : t.accent};color:${tplName === 'minimal' ? '#111' : '#fff'};text-align:left}
th,td{padding:9px 10px;border:1px solid #ccc}
.sum{display:flex;gap:12px;padding:18px 28px 6px;flex-wrap:wrap}
.sum div{flex:1;min-width:130px;border:1px solid #ccc;padding:10px;text-align:center}
.sum b{display:block;font-size:20px;color:${t.accent}}
.rem{margin:14px 28px 0;padding:12px;border-left:4px solid ${t.accent};background:rgba(0,0,0,.04)}
.sig{display:flex;justify-content:space-between;margin:42px 28px 0;font-size:13px;color:#555}
@media print{body{background:#fff;padding:0}}
</style></head><body><div class="card">
<div class="head"><h1>${esc(inst || 'Institute')}</h1><p>Student Report Card · Generated ${new Date().toLocaleDateString()}</p></div>
<div class="info"><div><span>Name:</span> ${esc(s.name)}</div><div><span>Roll no.:</span> ${esc(s.roll)}</div>
<div><span>Class:</span> ${esc(s.cls)}</div><div><span>Class rank:</span> ${rank < 0 ? '–' : (rank + 1) + ' of ' + ranked.length}</div></div>
<table><thead><tr><th>Subject</th><th>Marks</th><th>Percent</th><th>Grade</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sum"><div><b>${overall}</b>Overall result</div><div><b>${fmt(st.att)}</b>Attendance (${st.present}/${st.days} days)</div><div><b>${st.asnDone}/${st.asnTotal}</b>Assignments handed in</div></div>
<div class="rem"><b>Remarks:</b> ${esc(remarks || autoRemark(st.pct))}</div>
<div class="sig"><span>Class teacher</span><span>Parent / Guardian</span><span>Principal</span></div>
</div></body></html>`;
}

/* ===== Events ===== */
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#tabs button').forEach((x) => x.classList.toggle('active', x === b));
  $$('.tab').forEach((x) => x.classList.toggle('active', x.id === b.dataset.tab));
  if (b.dataset.tab === 'dash') renderDashboard();
});
function formData(f) { return Object.fromEntries(new FormData(f).entries()); }
function needStudent(d) { if (!d.sid) { toast('Add a student first.'); return false; } return true; }

$('#studentForm').addEventListener('submit', (e) => {
  e.preventDefault(); const d = formData(e.target);
  if (db.students.some((s) => s.roll === d.roll)) return toast('That roll number already exists.');
  db.students.push({ id: uid(), name: d.name.trim(), roll: d.roll.trim(), cls: d.cls.trim(), email: d.email.trim() });
  e.target.reset(); save(); toast('Student added.');
});
$('#markForm').addEventListener('submit', (e) => {
  e.preventDefault(); const d = formData(e.target); if (!needStudent(d)) return;
  const score = +d.score, max = +d.max;
  if (score > max) return toast('Marks obtained cannot be more than the maximum.');
  db.marks = db.marks.filter((m) => !(m.sid === d.sid && m.subject === d.subject && m.max === max));
  db.marks.push({ id: uid(), sid: d.sid, subject: d.subject, score, max });
  save(); toast('Marks saved.');
});
$('#attForm').addEventListener('submit', (e) => {
  e.preventDefault(); const d = formData(e.target); if (!needStudent(d)) return;
  db.attendance = db.attendance.filter((a) => !(a.sid === d.sid && a.date === d.date));
  db.attendance.push({ id: uid(), sid: d.sid, date: d.date, status: d.status });
  db.attendance.sort((a, b) => a.date.localeCompare(b.date)); save(); toast('Attendance saved.');
});
$('#asnForm').addEventListener('submit', (e) => {
  e.preventDefault(); const d = formData(e.target); if (!needStudent(d)) return;
  db.assignments.push({ id: uid(), sid: d.sid, title: d.title.trim(), status: d.status });
  e.target.title.value = ''; save(); toast('Assignment saved.');
});
document.addEventListener('click', (e) => {
  const v = e.target.dataset && e.target.dataset.del; if (!v) return;
  const [col, id] = v.split(':');
  if (col === 'students') {
    if (!confirm('Delete this student and all their records?')) return;
    db.students = db.students.filter((s) => s.id !== id);
    ['marks', 'attendance', 'assignments'].forEach((k) => (db[k] = db[k].filter((r) => r.sid !== id)));
  } else db[col] = db[col].filter((r) => r.id !== id);
  save();
});

let lastReport = '', lastName = '';
$('#repForm').addEventListener('submit', (e) => {
  e.preventDefault(); const d = formData(e.target); if (!needStudent(d)) return;
  const s = db.students.find((x) => x.id === d.sid);
  lastReport = reportHTML(s, d.tpl, d.remarks.trim(), d.inst.trim()); lastName = s.name.replace(/\s+/g, '_');
  $('#preview').srcdoc = lastReport; $('#printBtn').disabled = $('#dlBtn').disabled = false;
});
$('#printBtn').addEventListener('click', () => $('#preview').contentWindow.print());
$('#dlBtn').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lastReport], { type: 'text/html' }));
  a.download = `report_card_${lastName}.html`; a.click(); URL.revokeObjectURL(a.href);
});

$('#resetBtn').addEventListener('click', () => { if (confirm('Erase every student record? This cannot be undone.')) { db = empty(); save(); toast('All data erased.'); } });
$('#seedBtn').addEventListener('click', () => {
  if (db.students.length && !confirm('This adds demo students to your existing data. Continue?')) return;
  const names = [['Aarav Sharma', 'A101'], ['Diya Verma', 'A102'], ['Kabir Singh', 'A103'], ['Meera Patel', 'A104'], ['Rohan Gupta', 'A105']];
  const today = new Date();
  names.forEach(([name, roll], i) => {
    const id = uid(); db.students.push({ id, name, roll, cls: 'CSE-AI-1', email: '' });
    const base = 88 - i * 9;
    SUBJECTS.forEach((subject) => db.marks.push({ id: uid(), sid: id, subject, score: Math.max(25, Math.min(99, base + Math.round((Math.random() - .5) * 18))), max: 100 }));
    for (let d = 0; d < 10; d++) { const dt = new Date(today); dt.setDate(today.getDate() - d);
      db.attendance.push({ id: uid(), sid: id, date: dt.toISOString().slice(0, 10), status: Math.random() < (0.95 - i * .07) ? 'Present' : 'Absent' }); }
    ['Lab record', 'Web page project'].forEach((title) => db.assignments.push({ id: uid(), sid: id, title, status: Math.random() < (0.9 - i * .12) ? 'Submitted' : 'Pending' }));
  });
  save(); toast('Demo data loaded.');
});

document.querySelector('#attForm [name=date]').value = new Date().toISOString().slice(0, 10);
$('#subjectSel').innerHTML = SUBJECTS.map((s) => `<option>${s}</option>`).join('');
load();
