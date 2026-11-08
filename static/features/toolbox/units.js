/**
 * Units and colour space for the 3D toolbox.
 *
 * Written from the definitions: the sRGB transfer function is the piecewise
 * IEC 61966-2-1 curve (not a gamma-2.2 approximation), and every factor is the
 * defining value — 1 in = 25.4 mm exactly, 1 lb = 0.45359237 kg, 1 MiB = 2^20 B —
 * so the length table agrees with the DXF importer's `$INSUNITS` reader.
 *
 * Nothing here touches the DOM, so the whole module runs in Node and the gate
 * can pin the numbers.
 */

import { PIXELS_PER_METER } from '../../core/world-space.js';

// --- sRGB <-> linear -------------------------------------------------------

/**
 * The sRGB curve's knee. IEC 61966-2-1 publishes it rounded on both sides
 * (0.04045 and 0.0031308); this module uses the exact quotient so the two
 * directions are true inverses. The difference at the knee is 3e-8, four orders
 * of magnitude below one 8-bit step, and it removes the only discontinuity a
 * round trip could hit.
 */
export const SRGB_KNEE = 0.04045;
export const LINEAR_KNEE = SRGB_KNEE / 12.92;

/** One sRGB-encoded channel (0..1) to linear light (0..1). */
export function srgbToLinear(channel) {
    const value = Number(channel);
    if (!Number.isFinite(value)) return NaN;
    const c = Math.min(1, Math.max(0, value));
    return c <= SRGB_KNEE ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * One linear channel to sRGB (0..1). Negative light has no encoding, so this
 * returns NaN and `linearToSrgbColor` reports it rather than inventing a value.
 */
export function linearToSrgb(channel) {
    const c = Number(channel);
    if (!Number.isFinite(c) || c < 0) return NaN;
    return c <= LINEAR_KNEE ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

/** Parse `#rgb`, `#rrggbb`, bare hex, or an `rgb()`/`rgba()` triple. */
export function parseHexColor(input) {
    const text = String(input ?? '').trim().toLowerCase();
    if (!text) return null;

    const rgbCall = text.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/);
    if (rgbCall) {
        const channels = rgbCall.slice(1, 4).map(Number);
        if (!channels.every((value) => Number.isFinite(value) && value >= 0 && value <= 255)) return null;
        return { r: Math.round(channels[0]), g: Math.round(channels[1]), b: Math.round(channels[2]) };
    }

    const hex = (text.startsWith('#') ? text.slice(1) : text);
    if (/^[0-9a-f]{3}$/.test(hex)) {
        return { r: parseInt(hex[0] + hex[0], 16), g: parseInt(hex[1] + hex[1], 16), b: parseInt(hex[2] + hex[2], 16) };
    }
    if (/^[0-9a-f]{6}$/.test(hex)) {
        return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16)
        };
    }
    return null;
}

const clampByte = (value) => Math.min(255, Math.max(0, Math.round(Number(value) || 0)));

/** `{ r, g, b }` (0..255) to a lowercase `#rrggbb` string. */
export function rgbToHex({ r, g, b } = {}) {
    const hex = [r, g, b].map((value) => clampByte(value).toString(16).padStart(2, '0')).join('');
    return `#${hex}`;
}

/** WCAG/Rec.709 relative luminance of a linear RGB triple. */
export function relativeLuminance({ r = 0, g = 0, b = 0 } = {}) {
    return 0.2126 * Number(r) + 0.7152 * Number(g) + 0.0722 * Number(b);
}

/**
 * A hex or `rgb()` colour in every space the toolbox reports.
 * Returns `{ error }` instead of throwing so a panel can render the message.
 */
export function colorReport(input) {
    const rgb = parseHexColor(input);
    if (!rgb) {
        return { error: 'Enter a hex colour (#3b82f6), three hex digits (#38f) or an rgb() triple.' };
    }
    const srgb = { r: rgb.r / 255, g: rgb.g / 255, b: rgb.b / 255 };
    const linear = {
        r: srgbToLinear(srgb.r),
        g: srgbToLinear(srgb.g),
        b: srgbToLinear(srgb.b)
    };
    return {
        error: null,
        hex: rgbToHex(rgb),
        rgb255: rgb,
        srgb,
        linear,
        linear255: {
            r: Math.round(linear.r * 255),
            g: Math.round(linear.g * 255),
            b: Math.round(linear.b * 255)
        },
        luminance: relativeLuminance(linear)
    };
}

/**
 * The reverse direction: linear channels to display sRGB. Values below 0 or
 * above 1 are clamped, and every clamp is reported — a negative linear value is
 * a colour the display cannot show, not a rotation of the hue.
 */
export function linearToSrgbColor({ r = 0, g = 0, b = 0 } = {}) {
    const warnings = [];
    const channels = [Number(r), Number(g), Number(b)];
    const srgb = channels.map((value) => {
        if (!Number.isFinite(value)) {
            warnings.push('A channel is not a number; it is treated as 0.');
            return 0;
        }
        if (value < 0) {
            warnings.push('A linear channel below 0 has no sRGB encoding; it is clamped to black.');
            return 0;
        }
        if (value > 1) {
            warnings.push('A linear channel above 1 exceeds display white; it is clamped.');
            return 1;
        }
        return linearToSrgb(value);
    });
    const rgb255 = srgb.map((value) => Math.round(value * 255));
    return {
        srgb: { r: srgb[0], g: srgb[1], b: srgb[2] },
        rgb255: { r: rgb255[0], g: rgb255[1], b: rgb255[2] },
        hex: rgbToHex({ r: rgb255[0], g: rgb255[1], b: rgb255[2] }),
        warnings
    };
}

// --- Units ----------------------------------------------------------------

/**
 * One table for the whole page: every factor converts to the group's base unit.
 * Area and volume units are listed rather than derived so a typo in a square or
 * a cube cannot silently change a quantity.
 */
export const UNIT_GROUPS = [
    {
        id: 'length',
        label: 'Length',
        base: 'm',
        units: [
            { id: 'm', label: 'metre', symbol: 'm', factor: 1 },
            { id: 'cm', label: 'centimetre', symbol: 'cm', factor: 0.01 },
            { id: 'mm', label: 'millimetre', symbol: 'mm', factor: 0.001 },
            { id: 'um', label: 'micrometre', symbol: 'µm', factor: 1e-6 },
            { id: 'km', label: 'kilometre', symbol: 'km', factor: 1000 },
            { id: 'in', label: 'inch', symbol: 'in', factor: 0.0254 },
            { id: 'ft', label: 'foot', symbol: 'ft', factor: 0.3048 },
            { id: 'yd', label: 'yard', symbol: 'yd', factor: 0.9144 },
            { id: 'mi', label: 'mile', symbol: 'mi', factor: 1609.344 },
            { id: 'nmi', label: 'nautical mile', symbol: 'nmi', factor: 1852 },
            { id: 'thou', label: 'thou (mil)', symbol: 'thou', factor: 0.0000254 },
            { id: 'planpx', label: 'plan pixel', symbol: 'px', factor: 1 / PIXELS_PER_METER }
        ]
    },
    {
        id: 'area',
        label: 'Area',
        base: 'm2',
        units: [
            { id: 'm2', label: 'square metre', symbol: 'm²', factor: 1 },
            { id: 'cm2', label: 'square centimetre', symbol: 'cm²', factor: 1e-4 },
            { id: 'mm2', label: 'square millimetre', symbol: 'mm²', factor: 1e-6 },
            { id: 'ha', label: 'hectare', symbol: 'ha', factor: 10000 },
            { id: 'km2', label: 'square kilometre', symbol: 'km²', factor: 1e6 },
            { id: 'in2', label: 'square inch', symbol: 'in²', factor: 0.00064516 },
            { id: 'ft2', label: 'square foot', symbol: 'ft²', factor: 0.09290304 },
            { id: 'yd2', label: 'square yard', symbol: 'yd²', factor: 0.83612736 },
            { id: 'acre', label: 'acre', symbol: 'acre', factor: 4046.8564224 }
        ]
    },
    {
        id: 'volume',
        label: 'Volume',
        base: 'm3',
        units: [
            { id: 'm3', label: 'cubic metre', symbol: 'm³', factor: 1 },
            { id: 'l', label: 'litre', symbol: 'L', factor: 0.001 },
            { id: 'ml', label: 'millilitre', symbol: 'mL', factor: 1e-6 },
            { id: 'cm3', label: 'cubic centimetre', symbol: 'cm³', factor: 1e-6 },
            { id: 'mm3', label: 'cubic millimetre', symbol: 'mm³', factor: 1e-9 },
            { id: 'in3', label: 'cubic inch', symbol: 'in³', factor: 0.000016387064 },
            { id: 'ft3', label: 'cubic foot', symbol: 'ft³', factor: 0.028316846592 },
            { id: 'yd3', label: 'cubic yard', symbol: 'yd³', factor: 0.764554857984 },
            { id: 'galus', label: 'US gallon', symbol: 'gal (US)', factor: 0.003785411784 },
            { id: 'galuk', label: 'imperial gallon', symbol: 'gal (UK)', factor: 0.00454609 },
            { id: 'flozus', label: 'US fluid ounce', symbol: 'fl oz (US)', factor: 0.0000295735295625 }
        ]
    },
    {
        id: 'mass',
        label: 'Mass',
        base: 'kg',
        units: [
            { id: 'kg', label: 'kilogram', symbol: 'kg', factor: 1 },
            { id: 'g', label: 'gram', symbol: 'g', factor: 0.001 },
            { id: 'mg', label: 'milligram', symbol: 'mg', factor: 1e-6 },
            { id: 't', label: 'tonne', symbol: 't', factor: 1000 },
            { id: 'lb', label: 'pound', symbol: 'lb', factor: 0.45359237 },
            { id: 'oz', label: 'ounce', symbol: 'oz', factor: 0.028349523125 },
            { id: 'st', label: 'stone', symbol: 'st', factor: 6.35029318 }
        ]
    },
    {
        id: 'angle',
        label: 'Angle',
        base: 'rad',
        units: [
            { id: 'rad', label: 'radian', symbol: 'rad', factor: 1 },
            { id: 'mrad', label: 'milliradian', symbol: 'mrad', factor: 0.001 },
            { id: 'deg', label: 'degree', symbol: '°', factor: Math.PI / 180 },
            { id: 'grad', label: 'gradian', symbol: 'grad', factor: Math.PI / 200 },
            { id: 'turn', label: 'turn', symbol: 'turn', factor: Math.PI * 2 }
        ]
    },
    {
        id: 'data',
        label: 'Data size',
        base: 'byte',
        units: [
            { id: 'bit', label: 'bit', symbol: 'b', factor: 0.125 },
            { id: 'byte', label: 'byte', symbol: 'B', factor: 1 },
            { id: 'kilobyte', label: 'kilobyte (1000 B)', symbol: 'kB', factor: 1000 },
            { id: 'megabyte', label: 'megabyte (10⁶ B)', symbol: 'MB', factor: 1e6 },
            { id: 'gigabyte', label: 'gigabyte (10⁹ B)', symbol: 'GB', factor: 1e9 },
            { id: 'kibibyte', label: 'kibibyte (1024 B)', symbol: 'KiB', factor: 1024 },
            { id: 'mebibyte', label: 'mebibyte (2²⁰ B)', symbol: 'MiB', factor: 1048576 },
            { id: 'gibibyte', label: 'gibibyte (2³⁰ B)', symbol: 'GiB', factor: 1073741824 },
            { id: 'tebibyte', label: 'tebibyte (2⁴⁰ B)', symbol: 'TiB', factor: 1099511627776 }
        ]
    }
];

const UNIT_INDEX = new Map();
UNIT_GROUPS.forEach((group) => {
    group.units.forEach((unit) => UNIT_INDEX.set(unit.id, { group, unit }));
});

/** `{ group, unit }` for a unit id, or null. */
export function findUnit(id) {
    return UNIT_INDEX.get(String(id)) || null;
}

/** Units of one group, in table order. */
export function unitsInGroup(groupId) {
    const group = UNIT_GROUPS.find((entry) => entry.id === groupId);
    return group ? group.units : [];
}

/**
 * Convert a value between two units of the same quantity. Throws with a message
 * a panel can show when the units are unknown, unrelated, or the value is not a
 * number.
 */
export function convertUnit(value, from, to) {
    const source = findUnit(from);
    const target = findUnit(to);
    if (!source) throw new Error(`Unknown unit "${from}".`);
    if (!target) throw new Error(`Unknown unit "${to}".`);
    if (source.group.id !== target.group.id) {
        throw new Error(`Cannot convert ${source.unit.symbol} to ${target.unit.symbol}: different quantities.`);
    }
    const amount = Number(value);
    if (!Number.isFinite(amount)) throw new Error('Enter a number to convert.');
    return (amount * source.unit.factor) / target.unit.factor;
}

/** Readable number: fixed places for ordinary sizes, exponent for extremes. */
export function formatNumber(value, digits = 4) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    if (number === 0) return '0';
    const magnitude = Math.abs(number);
    if (magnitude >= 1e7 || magnitude < 1e-4) return number.toExponential(Math.max(1, digits - 1));
    return String(Number(number.toFixed(digits)));
}

/**
 * Factors that explain a plan/model scale mismatch, with the cause named. The
 * platform's own scales are in the list: a plan pixel is 1/30 m and a legacy
 * wall height was quoted as 96 in.
 */
export const SCALE_HINTS = [
    { factor: 1000, label: 'metres → millimetres (×1000)' },
    { factor: 0.001, label: 'millimetres → metres (÷1000)' },
    { factor: 100, label: 'metres → centimetres (×100)' },
    { factor: 0.01, label: 'centimetres → metres (÷100)' },
    { factor: 25.4, label: 'inches → millimetres (×25.4)' },
    { factor: 1 / 25.4, label: 'millimetres → inches (÷25.4)' },
    { factor: 2.54, label: 'inches → centimetres (×2.54)' },
    { factor: 1 / 2.54, label: 'centimetres → inches (÷2.54)' },
    { factor: 0.0254, label: 'inches → metres (×0.0254)' },
    { factor: 1 / 0.0254, label: 'metres → inches (×39.37)' },
    { factor: 0.3048, label: 'feet → metres (×0.3048)' },
    { factor: 1 / 0.3048, label: 'metres → feet (×3.281)' },
    { factor: 12, label: 'feet → inches (×12)' },
    { factor: 1 / 12, label: 'inches → feet (÷12)' },
    { factor: PIXELS_PER_METER, label: `plan pixels → metres (${PIXELS_PER_METER} px/m)` },
    { factor: 1 / PIXELS_PER_METER, label: `metres → plan pixels (×${PIXELS_PER_METER})` }
];

/** Match a factor against `SCALE_HINTS`; returns the hint or null. */
export function explainScale(factor, tolerance = 0.001) {
    const value = Number(factor);
    if (!Number.isFinite(value) || value <= 0) return null;
    return SCALE_HINTS.find((hint) => Math.abs(value - hint.factor) / hint.factor <= tolerance) || null;
}

/**
 * Given a length measured on the drawing and the length the model reports,
 * return the factor between them and the unit slip that most likely caused it.
 */
export function scaleMismatch(measured, model) {
    const a = Number(measured);
    const b = Number(model);
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('Enter both lengths as numbers.');
    if (b === 0) throw new Error('The model length cannot be zero.');
    const factor = a / b;
    const hint = explainScale(factor);
    return { factor, hint: hint ? hint.label : null };
}
