/**
 * The toolbox shell: the tool list, the `?tool=` route and the panel mount.
 *
 * One page hosts every tool, so a new tool is a registry entry plus a panel
 * module and cannot drift from the navigation, the title or the harness. The
 * route lives in the query string rather than the path so the page works from
 * any static host without rewrite rules.
 */

import { TOOLBOX, TOOLBOX_GROUPS, toolById, toolsInGroup } from './index.js';

const $ = (id) => document.getElementById(id);

let mountToken = 0;

function setStatus(message, kind = 'info') {
    const node = $('toolbox-status');
    if (!node) return;
    node.textContent = message;
    node.className = kind === 'error'
        ? 'min-h-[1rem] text-[10px] text-red-600'
        : 'min-h-[1rem] text-[10px] text-slate-400';
}

function renderNav(activeId) {
    const host = $('toolbox-list');
    if (!host) return;
    host.innerHTML = '';
    TOOLBOX_GROUPS.forEach((group) => {
        const tools = toolsInGroup(group.id);
        if (!tools.length) return;
        const heading = document.createElement('h3');
        heading.className = 'mb-1 mt-3 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400';
        heading.textContent = group.label;
        host.appendChild(heading);
        tools.forEach((tool) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'tool-button';
            button.dataset.tool = tool.id;
            button.setAttribute('aria-pressed', tool.id === activeId ? 'true' : 'false');
            button.textContent = tool.label;
            button.addEventListener('click', () => { selectTool(tool.id); });
            host.appendChild(button);
        });
    });
    const planned = TOOLBOX_GROUPS.reduce((sum, group) => sum + group.planned, 0) - TOOLBOX.length;
    const note = $('toolbox-planned');
    if (note) {
        note.textContent = planned > 0
            ? `${planned} more tools are planned (see toolplan.md); each ships as a registry entry and a panel.`
            : '';
    }
}

/** Mount one tool. Late panels from a previous click are dropped. */
export async function selectTool(id) {
    const entry = toolById(id) || TOOLBOX[0];
    if (!entry) return null;

    const token = ++mountToken;
    renderNav(entry.id);
    if (window.toolboxKit) window.toolboxKit.active = entry.id;

    const title = $('toolbox-title');
    if (title) title.textContent = entry.label;
    const summary = $('toolbox-summary');
    if (summary) summary.textContent = entry.summary;

    const url = new URL(window.location.href);
    url.searchParams.set('tool', entry.id);
    window.history.replaceState(null, '', url);

    setStatus('');
    const host = $('toolbox-work');
    if (!host) return null;

    try {
        const panel = await import(`./panels/${entry.panel}`);
        if (token !== mountToken) return null;
        if (typeof panel.mount !== 'function') throw new Error(`${entry.panel} does not export mount().`);
        host.innerHTML = '';
        panel.mount(host);
        document.title = `${entry.label} · 3D toolbox`;
        return entry;
    } catch (error) {
        if (token !== mountToken) return null;
        host.innerHTML = '';
        const notice = document.createElement('p');
        notice.className = 'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700';
        notice.setAttribute('role', 'alert');
        notice.textContent = `This tool could not start: ${error.message}`;
        host.appendChild(notice);
        setStatus(`Could not start ${entry.label}.`, 'error');
        return null;
    }
}

/**
 * Boot the page and expose `window.toolboxKit` for the browser harness. The
 * handle mirrors the other suites' kits: the registry, the active id and the
 * same `select` the nav uses.
 */
export function mountShell() {
    const host = $('toolbox-work');
    if (!host || !$('toolbox-list')) return Promise.resolve(null);

    const requested = new URLSearchParams(window.location.search).get('tool');
    const first = (toolById(requested) || TOOLBOX[0]).id;

    window.toolboxKit = {
        registry: TOOLBOX,
        groups: TOOLBOX_GROUPS,
        active: first,
        tools: () => TOOLBOX.map((tool) => tool.id),
        select: selectTool,
        setStatus
    };

    window.addEventListener('popstate', () => {
        const id = new URLSearchParams(window.location.search).get('tool');
        selectTool((toolById(id) || TOOLBOX[0]).id);
    });

    return selectTool(first);
}
