/**
 * Wall covering kit: paint, plaster, wallpaper, panels, tile, siding, stucco
 * and masonry. Each module is standalone; this is the single import for the
 * designer page, the editor and the tests.
 */
export * from './materials.js';
export * from './design.js';
export * from './glossary.js';
export * from './preview.js';
export * from './studio-panel.js';

export const WALL_KIT = [
    { id: 'coverings', label: 'Covering catalogue: 35 paints and systems' },
    { id: 'palette', label: 'Paint sheens, 26 colours and four harmonies' },
    { id: 'takeoff', label: 'Net area, packs, litres, labour and cost' },
    { id: 'checks', label: 'Substrate, wet area, vapour, fire, WRB, grade and wind checks' },
    { id: 'reference', label: 'Glossary and formulas' },
    { id: 'editor', label: 'Finishes panel and send-to-editor draft' }
];
