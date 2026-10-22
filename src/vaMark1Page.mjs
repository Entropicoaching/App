import { createSession, mark, calibrate, clearCalibration, lock, compare, aggregate, pointerPoint, save, restore } from './vaMark1.mjs';
import { fixtures } from './vaMark1Fixtures.mjs';
export function mount(dom, getStorage) {
  const all = fixtures(), sessions = all.map(createSession), el = id => dom.getElementById(id);
  let clip = 0, frame = 0, diameter = null;
  const pending = () => { diameter = null; };
  const f = () => all[clip], s = () => sessions[clip];
  function message(t) { el('message').textContent = t; }
  function render() {
    const q = f().frames[frame], p = s().marks[frame].point;
    el('scene').setAttribute('viewBox', '0 0 640 360');
    el('disc').setAttribute('cx', q.disc.x); el('disc').setAttribute('cy', q.disc.y);
    el('cross').setAttribute('cx', p?.x ?? -100); el('cross').setAttribute('cy', p?.y ?? -100);
    el('x').value = p ? String(p.x) : ''; el('y').value = p ? String(p.y) : '';
    el('scaleInfo').textContent = s().calibration ? '45 cm / ' + s().calibration.disc_px + ' px fra markeret diameter' : 'Ingen markeret diameter';
    const ends = diameter?.length ? diameter : s().calibration?.frame_id === q.frame_id ? s().calibration.endpoints : null;
    for (const [id, p] of [['edgeA', ends?.[0]], ['edgeB', ends?.[1]]]) {
      el(id).setAttribute('cx', p?.x ?? -100); el(id).setAttribute('cy', p?.y ?? -100);
    }
    el('frame').value = String(frame); el('clip').value = String(clip);
    el('frameInfo').textContent = f().clip_id + ' | frame ' + q.frame_id + ' | faktisk tid ' + q.t_s + ' s | ' +
      s().marks.filter(m => m.point).length + '/4 markeret | ' + (s().locked ? 'fastlaast' : 'kladde');
    const result = compare(f(), s());
    el('result').textContent = JSON.stringify(result, null, 2);
    el('aggregate').textContent = 'Alle tre syntetiske klip: ' + JSON.stringify(aggregate(all.map((a, i) => ({ fixture: a, session: sessions[i] }))));
  }
  function change(fn) { try { fn(); render(); message('Kladde aendret. Fastlaas foer sammenligning.'); } catch (e) { message('AFVIST: ' + e.message); } }
  el('scene').addEventListener('click', e => change(() => {
    const p = pointerPoint(el('scene').getBoundingClientRect(), f().image, e.clientX, e.clientY);
    if (!p) throw Error('outside_image');
    if (diameter) {
      diameter.push(p);
      if (diameter.length === 2) {
        const endpoints = diameter; pending();
        sessions[clip] = calibrate(f(), s(), f().frames[frame].frame_id, endpoints);
      }
    } else sessions[clip] = mark(f(), s(), frame, p);
  }));
  el('setPoint').addEventListener('click', () => change(() => {
    if (!el('x').value.trim() || !el('y').value.trim()) throw Error('missing_coordinate');
    sessions[clip] = mark(f(), s(), frame, { x: Number(el('x').value), y: Number(el('y').value) });
  }));
  el('clearPoint').addEventListener('click', () => change(() => { sessions[clip] = mark(f(), s(), frame, null); }));
  el('calibrate').addEventListener('click', () => {
    sessions[clip] = clearCalibration(f(), s()); diameter = []; render();
    message('Klik to modsatte kanter paa skiven i billedet. Diameteren er 45 cm.');
  });
  // Pending coordinate edits immediately invalidate prior results and refresh coverage.
  for (const id of ['x', 'y']) el(id).addEventListener('input', () => {
    const x = el('x').value, y = el('y').value;
    pending(); sessions[clip] = mark(f(), s(), frame, null); render();
    el('x').value = x; el('y').value = y;
    message('Punkt fjernet. Anvend det nye punkt og fastlaas igen.');
  });
  el('clip').addEventListener('change', () => {
    const n = Number(el('clip').value);
    if (!Number.isInteger(n) || n < 0 || n >= all.length) return message('AFVIST: clip');
    pending(); clip = n; frame = 0; render(); message('Valgt syntetisk klip.');
  });
  el('frame').addEventListener('change', () => {
    const n = Number(el('frame').value);
    if (!Number.isInteger(n) || n < 0 || n >= f().frames.length) return message('AFVIST: frame');
    pending(); frame = n; render();
  });
  el('compare').addEventListener('click', () => {
    try { if (diameter) throw Error('diameter_pending'); sessions[clip] = lock(f(), s()); render(); message('Nominel syntetisk sammenligning. Usikkerhed ukendt.'); }
    catch (e) { message('AFVIST: ' + e.message); }
  });
  el('save').addEventListener('click', () => {
    try { const r = save(getStorage(), f(), s()); message(r.ok ? 'Gemt lokalt for dette syntetiske klip.' : 'IKKE GEMT: ' + r.reason); }
    catch (e) { message('IKKE GEMT: ' + e.message); }
  });
  el('restore').addEventListener('click', () => {
    // Clear stale results on failed load; never keep an old PASS on screen.
    pending(); sessions[clip] = createSession(f());
    try { const r = restore(getStorage(), f()); if (r.ok) sessions[clip] = r.session; render(); message(r.ok ? 'Gendannet med eksakt syntetisk basis.' : 'IKKE GENDANNET: ' + r.reason); }
    catch (e) { render(); message('IKKE GENDANNET: ' + e.message); }
  });
  render(); message('Marker centrum i alle fire billeder. Automatisk spor vises foerst ved fastlaasning.');
}
