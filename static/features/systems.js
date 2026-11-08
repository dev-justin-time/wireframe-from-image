/**
 * The five cross-suite systems, built from their package barrels.
 *
 * Each feature folder exposes one entry point (features/<system>/index.js) that
 * re-exports its catalogue, rules, engine, plan, panel, scene and studio panel.
 * This module is the only place the app imports those systems from, so the
 * barrels are the real construction point rather than dead re-export files,
 * and a panel cannot accidentally import half a system.
 *
 * Every panel returns the same model:
 *
 *   { id, label, suite, headline, rows, checks, ok, empty, detail, actions }
 *
 * `actions` are either links (kind: 'link', href) or buttons the editor wires
 * by id (kind: 'action').
 */
import * as bid from './bid/index.js';
import * as bim from './bim/index.js';
import * as deck from './deck/index.js';
import * as electrical from './electrical/index.js';
import * as framing from './framing/index.js';
import * as wall from './wall/index.js';

export const STUDIO_SYSTEMS = [
    {
        id: 'bid',
        label: 'Bid',
        suite: 'bid-builder.html',
        panel: (context = {}) => bid.bidStudioPanel(context),
        snapshot: (storage) => bid.buildBidSnapshot(storage),
        csv: (built) => bid.bidCsv(built),
        proposal: (built) => bid.proposalText(built)
    },
    {
        id: 'bim',
        label: 'BIM',
        suite: 'editor.html',
        panel: (context = {}) => bim.bimStudioPanel(context),
        snapshot: (context) => bim.bimTakeoffSnapshot(context),
        csv: (takeoff) => bim.bimTakeoffCsv(takeoff.rows)
    },
    {
        id: 'deck',
        label: 'Deck',
        suite: 'deck-designer.html',
        panel: (context = {}) => deck.deckStudioPanel(context)
    },
    {
        id: 'electrical',
        label: 'Electrical',
        suite: 'electrical-designer.html',
        panel: (context = {}) => electrical.electricalStudioPanel(context)
    },
    {
        id: 'framing',
        label: 'Framing',
        suite: 'framing-designer.html',
        panel: (context = {}) => framing.framingStudioPanel(context)
    },
    {
        id: 'wall',
        label: 'Wall',
        suite: 'wall-designer.html',
        panel: (context = {}) => wall.wallStudioPanel(context)
    }
];

export const SYSTEM_IDS = STUDIO_SYSTEMS.map((system) => system.id);

export function systemById(id) {
    return STUDIO_SYSTEMS.find((system) => system.id === id) || null;
}

/** Render every panel for a context object keyed by system id. */
export function systemPanels(context = {}) {
    return STUDIO_SYSTEMS.map((system) => system.panel(context[system.id] || {}));
}

export const buildBidSnapshot = bid.buildBidSnapshot;
