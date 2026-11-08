// The shared nav for every page under pages/.
//
// The studio (static/app.js) names its screens once, in static/nav-data.js. This
// file renders that same map resolved to the page that owns each screen, so a
// page and the studio never describe the same screen with two different names.
// Every page under pages/ already loads this file as `../shared/site.js`, so
// wiring it here wires all of them: the bar is injected above the page, the page
// you are on is marked, and nothing the page already had is rewritten or
// re-titled.
//
// Screens with no standalone page (2D scene, 3D scene, Report, Code rules) are
// not in that list; they live only in the studio's single-page router.

// The same map the studio router uses: static/nav-data.js holds the screens,
// their groups and their titles, and derives this page list from them.
import { NAV } from '../static/nav-data.js';

export { NAV };

// Below this width the bar is one button and the groups live in a panel under
// it, so a phone gets a single menu instead of a wall of links. The breakpoint
// matches where the bar's links stop fitting on one line.
const NARROW = '(max-width: 700px)';

const STYLE = `
#bps-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  align-items: center;
  padding: 7px 14px;
  background: #0b1220;
  color: #cbd5e1;
  border-bottom: 1px solid #1e293b;
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  position: relative;
  z-index: 60;
}
#bps-nav .bps-menu { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; }
#bps-nav .bps-toggle {
  display: none;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-weight: 700;
  color: #cbd5e1;
  background: #16223a;
  border: 1px solid #1e293b;
  border-radius: 4px;
  padding: 3px 9px;
  cursor: pointer;
}
#bps-nav .bps-toggle:hover { color: #e2e8f0; background: #1b2b47; }
#bps-nav .bps-toggle:focus-visible { outline: 2px solid #38bdf8; outline-offset: 1px; }
#bps-nav .bps-caret { font-size: 9px; line-height: 1; }
#bps-nav .bps-group { display: flex; flex-wrap: wrap; align-items: center; gap: 3px 10px; }
#bps-nav .bps-name {
  color: #64748b;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-right: 2px;
}
#bps-nav a { color: #94a3b8; text-decoration: none; padding: 1px 3px; border-radius: 4px; }
#bps-nav a:hover { color: #e2e8f0; background: #16223a; }
#bps-nav a.on { color: #0b1220; background: #38bdf8; font-weight: 700; }
#bps-nav .bps-home {
  color: #e2e8f0;
  font-weight: 700;
  text-decoration: none;
  padding: 1px 7px;
  border: 1px solid #1e293b;
  border-radius: 4px;
  background: #16223a;
}
#bps-nav .bps-home:hover { background: #1b2b47; }
@media (max-width: 700px) {
  #bps-nav { flex-wrap: nowrap; gap: 0; font-size: 11px; }
  #bps-nav .bps-toggle { display: inline-flex; }
  #bps-nav .bps-menu {
    display: none;
    /* A panel under the bar, not a taller bar: the page's own header keeps the
       space it had. */
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    max-height: 70vh;
    overflow-y: auto;
    padding: 10px 14px 12px;
    background: #0b1220;
    border-bottom: 1px solid #1e293b;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45);
  }
  #bps-nav.bps-open .bps-menu { display: flex; }
  #bps-nav .bps-group { flex-direction: column; align-items: flex-start; gap: 4px; }
  #bps-nav a { padding: 2px 0; }
}
`;

/*
 * Delegated actions.
 *
 * A page may be served with a Content-Security-Policy that refuses inline
 * `onclick`, so a control declares what it does as an attribute and this
 * listener runs it:
 *
 *   data-go="Editor.html"            navigate to a page
 *   data-clicks="#floorplan-upload"  forward the click to another element
 *   data-click="undo"                window.undo(), with `this` = the element
 *   data-input="setWallHeight"       window.setWallHeight(value, element)
 *   data-change="toggleFraming"      window.toggleFraming(checked, element)
 *   data-show / data-hide / data-disclosure   toggle the `hidden` class
 *
 * `data-args='["3d"]'` passes arguments first. A dotted name walks from
 * `window`, so `data-click="planOcr.runCurrent"` works. An action with no
 * handler is reported through the error reporter instead of doing nothing, so
 * a control that lost its binding lands in the support log.
 */
let actionsInstalled = false;

/** The function behind an action name, with the object it belongs to. */
function resolveAction(name) {
  const parts = String(name).split('.');
  let owner = window;
  for (const part of parts.slice(0, -1)) owner = owner?.[part];
  const fn = owner?.[parts[parts.length - 1]];
  return typeof fn === 'function' ? { fn, owner } : null;
}

function callAction(element, name, args = []) {
  const resolved = resolveAction(name);
  if (!resolved) {
    const report = window.reportClientError || window.blueprintReport;
    const message = `No handler for action "${name}"`;
    if (typeof report === 'function') report(new Error(message), { kind: 'action' });
    else console.warn(`[action] ${message}`);
    return;
  }
  resolved.fn.apply(resolved.owner === window ? element : resolved.owner, args);
}

function setHidden(selector, hidden) {
  const target = document.querySelector(selector);
  if (!target) return false;
  target.classList.toggle('hidden', hidden);
  return target.classList.contains('hidden');
}

function declaredArgs(element) {
  if (!element.dataset.args) return [];
  try {
    const parsed = JSON.parse(element.dataset.args);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function closestAction(target, attribute) {
  return target instanceof Element ? target.closest(`[${attribute}]`) : null;
}

function installActions() {
  if (actionsInstalled || typeof document === 'undefined') return;
  actionsInstalled = true;

  document.addEventListener('click', (event) => {
    const go = closestAction(event.target, 'data-go');
    if (go) {
      event.preventDefault();
      window.location.assign(go.dataset.go);
      return;
    }
    const forward = closestAction(event.target, 'data-clicks');
    if (forward) {
      event.preventDefault();
      const target = document.querySelector(forward.dataset.clicks);
      if (target) target.click();
      return;
    }
    const show = closestAction(event.target, 'data-show');
    if (show) {
      event.preventDefault();
      setHidden(show.dataset.show, false);
      return;
    }
    const hide = closestAction(event.target, 'data-hide');
    if (hide) {
      event.preventDefault();
      setHidden(hide.dataset.hide, true);
      return;
    }
    const disclosure = closestAction(event.target, 'data-disclosure');
    if (disclosure) {
      event.preventDefault();
      const target = document.querySelector(disclosure.dataset.disclosure);
      if (target) {
        const hidden = setHidden(disclosure.dataset.disclosure, !target.classList.contains('hidden'));
        if (disclosure.dataset.icon) {
          const icon = document.querySelector(disclosure.dataset.icon);
          if (icon) icon.textContent = hidden ? 'chevron_right' : 'expand_more';
        }
      }
      return;
    }
    const action = closestAction(event.target, 'data-click');
    if (!action) return;
    // A checkbox shows its state through the native toggle; preventing the
    // default would revert it after dispatch and leave the switch stuck.
    const nativeToggle = action.tagName === 'INPUT'
      && (action.type === 'checkbox' || action.type === 'radio');
    if (!nativeToggle) event.preventDefault();
    if (action.dataset.confirm && !window.confirm(action.dataset.confirm)) return;
    callAction(action, action.dataset.click, declaredArgs(action));
  });

  document.addEventListener('input', (event) => {
    const action = closestAction(event.target, 'data-input');
    if (action) callAction(action, action.dataset.input, [...declaredArgs(action), action.value, action]);
  });

  document.addEventListener('change', (event) => {
    const action = closestAction(event.target, 'data-change');
    if (!action) return;
    const checked = action.type === 'checkbox' || action.type === 'radio';
    callAction(action, action.dataset.change,
      [...declaredArgs(action), checked ? action.checked : action.value, action]);
  });
}

/** The file name this document was served as, lower-cased. */
function currentFile() {
  const name = (location.pathname.split('/').pop() || 'index.html');
  return name.toLowerCase();
}

// The button only exists so the narrow layout has something to open; on wide
// screens CSS hides it and shows the menu inline, and the state is cleared so
// coming back to narrow always starts closed.
function wireToggle(nav, toggle) {
  const set = (open) => {
    nav.classList.toggle('bps-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  toggle.addEventListener('click', (event) => {
    // Without this the document listener below closes what the click opened.
    event.stopPropagation();
    set(!nav.classList.contains('bps-open'));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('bps-open')) {
      set(false);
      toggle.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (!nav.contains(event.target)) set(false);
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest && event.target.closest('a')) set(false);
  });

  const narrow = window.matchMedia(NARROW);
  const widen = () => { if (!narrow.matches) set(false); };
  if (narrow.addEventListener) narrow.addEventListener('change', widen);
  else if (narrow.addListener) narrow.addListener(widen);
}

function build(here) {
  const nav = document.createElement('nav');
  nav.id = 'bps-nav';
  nav.setAttribute('aria-label', 'Every Floorplan 3D screen');

  // The pages are the documentation half of the app; the studio is the tool.
  // Without this link the nav only ever leads further away from it.
  const home = document.createElement('a');
  home.className = 'bps-home';
  home.href = '../static/index.html';
  home.textContent = 'Studio';
  home.title = 'Open the studio (the app shell)';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.id = 'bps-toggle';
  toggle.className = 'bps-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'bps-menu');
  toggle.title = 'Open the screen list';
  const caret = document.createElement('span');
  caret.className = 'bps-caret';
  caret.setAttribute('aria-hidden', 'true');
  caret.textContent = '\u25be';
  toggle.append('All screens', caret);

  const menu = document.createElement('div');
  menu.id = 'bps-menu';
  menu.className = 'bps-menu';

  for (const [group, entries] of NAV) {
    const box = document.createElement('div');
    box.className = 'bps-group';
    const name = document.createElement('span');
    name.className = 'bps-name';
    name.textContent = group;
    box.append(name);
    for (const [file, label] of entries) {
      const link = document.createElement('a');
      link.href = file;
      link.textContent = label;
      // The studio's title for the screen, kept on the link as its tooltip.
      link.title = `${label} · ${file}`;
      if (file.toLowerCase() === here) {
        link.classList.add('on');
        link.setAttribute('aria-current', 'page');
      }
      box.append(link);
    }
    menu.append(box);
  }

  nav.append(home, toggle, menu);
  wireToggle(nav, toggle);
  return nav;
}

function mount() {
  if (document.getElementById('bps-nav')) return;
  const style = document.createElement('style');
  style.id = 'bps-nav-style';
  style.textContent = STYLE;
  document.head.append(style);
  document.body.prepend(build(currentFile()));
}

installActions();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
}
