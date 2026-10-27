// PlexUW desktop icon set (original artwork, fu6). 24x24 grid, 1.75 stroke, round joins,
// drawn to sit with the Aperture Band mark: rounded geometry plus one #FF7A1A accent per
// icon (the band's corner wedge, a dot or a short stroke). Inline SVG, built with DOM APIs.
const NS = 'http://www.w3.org/2000/svg';
const c = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
// Each entry: [stroke paths, accent paths (orange stroke), accent fills (orange fill)].
const SET = {
  mark: ['M3 8.6Q3 7 4.6 7.2Q12 8.1 19.4 7.2Q21 7 21 8.6v6.8q0 1.6-1.6 1.6H4.6Q3 17 3 15.4z', '', 'M16.2 15.2h2.9v-2.9z'],
  home: ['M4 10.8 12 4.5l8 6.3V18.6q0 1.4-1.4 1.4H5.4Q4 20 4 18.6z', 'M10 20v-4.6q0-.9.9-.9h2.2q.9 0 .9.9V20'],
  search: [c(10.5, 10.5, 6.25), 'M15.2 15.2 20 20'],
  ask: ['M11 3.5l1.7 4.6 4.6 1.7-4.6 1.7L11 16.1l-1.7-4.6-4.6-1.7 4.6-1.7z', 'M18 14.5v5M15.5 17h5'],
  film: ['M5.5 3.5h13q1.5 0 1.5 1.5v14q0 1.5-1.5 1.5h-13Q4 20.5 4 19V5q0-1.5 1.5-1.5zM8 3.5v17M16 3.5v17M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4', 'M10.5 9.5h3v5h-3z'],
  tv: ['M4.6 5h14.8Q21 5 21 6.6v9.8q0 1.6-1.6 1.6H4.6Q3 18 3 16.4V6.6Q3 5 4.6 5zM8.5 21h7', 'M12 18v3', 'M15.6 15.4h3v-3z'],
  music: ['M9 17.5V6.2l10-2.2v11.3' + c(6.75, 17.5, 2.25) + c(16.75, 15.3, 2.25), 'M9 9.4l10-2.2'],
  playlist: ['M4 6h12M4 11h12M4 16h7', 'M14 17.5h6M17 14.5v6'],
  photo: ['M4.6 5h14.8Q21 5 21 6.6v10.8q0 1.6-1.6 1.6H4.6Q3 19 3 17.4V6.6Q3 5 4.6 5zM3.5 16.5l5-5 4 4 2.5-2.5 5 5', c(15.5, 9, 1.5)],
  folder: ['M3.5 7.2q0-1.7 1.7-1.7h3.9l2 2h7.7q1.7 0 1.7 1.7v8.1q0 1.7-1.7 1.7H5.2q-1.7 0-1.7-1.7z', 'M3.5 10h17'],
  gear: [c(12, 12, 6.2) + 'M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1', c(12, 12, 2.4)],
  server: ['M5.5 4h13Q20 4 20 5.5v4Q20 11 18.5 11h-13Q4 11 4 9.5v-4Q4 4 5.5 4zM5.5 13h13q1.5 0 1.5 1.5v4q0 1.5-1.5 1.5h-13Q4 20 4 18.5v-4Q4 13 5.5 13zM11 7.5h5.5M11 16.5h5.5', 'M7.5 7.5h.01M7.5 16.5h.01'],
  profile: [c(12, 8.8, 3.6) + 'M4.8 20q1.4-5 7.2-5t7.2 5'],
  sidebar: ['M5 4h14q2 0 2 2v12q0 2-2 2H5q-2 0-2-2V6q0-2 2-2zM9.5 4v16', 'M5.5 8h1.5M5.5 11h1.5'],
  chev: ['M7 10l5 5 5-5'],
};
export const PX_ICONS = Object.keys(SET);
export function pxIcon(name, cls) {
  const d = SET[name] || SET.folder;
  const v = document.createElementNS(NS, 'svg');
  v.setAttribute('viewBox', '0 0 24 24'); v.setAttribute('aria-hidden', 'true'); v.setAttribute('focusable', 'false');
  v.setAttribute('class', 'pxi' + (cls ? ' ' + cls : '')); v.dataset.icon = name;
  const p = (dd, kind) => { if (!dd) return; const e = document.createElementNS(NS, 'path'); e.setAttribute('d', dd); e.setAttribute('class', kind); v.appendChild(e); };
  p(d[0], 'pxis'); p(d[1], 'pxia'); p(d[2], 'pxif');
  return v;
}
