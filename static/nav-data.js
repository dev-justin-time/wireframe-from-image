// The studio's screens, named once.
//
// The router in app.js and the shared page nav in ../shared/site.js both read
// this file, so a screen's group, its title and its page cannot drift apart:
// rename a screen here and both the studio and every page follow.
//
// This lives under static/ because the server serves that directory at /, so
// the browser reaches it as /nav-data.js.

export const GROUPS = [
  ['Design', ['plan-studio', 'editor', 'scene-2d', 'scene-3d', 'app', 'wall-designer', 'kitchen-designer', 'toolbox', 'demo', 'webgpu-demo']],
  ['Structure', ['framing-designer', 'deck-designer', 'roof-designer', 'stair-designer', 'stair-l-designer',
    'stair-u-designer', 'stair-spiral-designer', 'stair-steep-designer', 'stair-gallery', 'stair-parts',
    'stair-glossary', 'foundation-designer']],
  ['Systems', ['electrical-designer', 'lighting-designer', 'plumbing-designer']],
  ['Site', ['landscape-designer', 'site-plan']],
  ['Project', ['project-dashboard', 'project-schedule', 'permits-inspections', 'bid-builder', 'report',
    'price-book', 'pricing', 'calc', 'code-rules']],
  ['About', ['index', 'features', 'gallery', 'about', 'contact']],
];

export const TITLES = {
  'plan-studio': 'Plan studio', 'code-rules': 'Code rules', editor: 'Editor', 'scene-2d': '2D scene', 'scene-3d': '3D scene',
  app: 'App', 'wall-designer': 'Wall designer',
  'kitchen-designer': 'Kitchen designer', toolbox: 'Toolbox', demo: 'Demo', 'webgpu-demo': 'WebGPU demo',
  'framing-designer': 'Framing designer', 'deck-designer': 'Deck designer', 'roof-designer': 'Roof designer',
  'stair-designer': 'Stair designer', 'stair-l-designer': 'L stair', 'stair-u-designer': 'U stair',
  'stair-spiral-designer': 'Spiral stair', 'stair-steep-designer': 'Steep stair', 'stair-gallery': 'Stair gallery',
  'stair-parts': 'Stair parts', 'stair-glossary': 'Stair glossary', 'foundation-designer': 'Foundation designer',
  'electrical-designer': 'Electrical designer', 'lighting-designer': 'Lighting designer',
  'plumbing-designer': 'Plumbing designer', 'landscape-designer': 'Landscape designer', 'site-plan': 'Site plan',
  'project-dashboard': 'Project dashboard', 'project-schedule': 'Schedule', 'permits-inspections': 'Permits and inspections',
  'bid-builder': 'Bid builder', report: 'Report', 'price-book': 'Price book', pricing: 'Pricing', calc: 'Calculator',
  index: 'Home', features: 'Features', gallery: 'Gallery', about: 'About', contact: 'Contact',
};

// Screens that exist only as routes inside the studio's single-page router;
// they have no page of their own under pages/.
export const STUDIO_ONLY = new Set(['scene-2d', 'scene-3d', 'report', 'code-rules']);

// Screens whose page file is not simply `<screen>.html`.
const PAGE = { editor: 'Editor.html' };

export function pageFor(screen) {
  return PAGE[screen] || `${screen}.html`;
}

// The grouped [page file, title] list the shared nav renders, in studio order,
// minus the screens that only exist inside the studio.
export const NAV = GROUPS
  .map(([group, screens]) => [group, screens.filter((screen) => !STUDIO_ONLY.has(screen)).map((screen) => [pageFor(screen), TITLES[screen]])])
  .filter(([, entries]) => entries.length > 0);
