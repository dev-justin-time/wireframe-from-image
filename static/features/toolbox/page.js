import { mountShell } from './shell.js';

/**
 * Bootstrap for `pages/toolbox.html`: hand the page to the shell and show a
 * failure in the work area rather than in the console, the same way the design
 * suites report a broken panel.
 */
mountShell().catch((error) => {
    const host = document.getElementById('toolbox-work');
    if (!host) return;
    host.innerHTML = '';
    const notice = document.createElement('p');
    notice.className = 'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700';
    notice.setAttribute('role', 'alert');
    notice.textContent = `The toolbox could not start: ${error.message}`;
    host.appendChild(notice);
});
