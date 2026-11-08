/**
 * Dressed lumber sizes shared by the framing suites.
 *
 * A 2x10 is 1½ × 9¼ in (38 × 235 mm) everywhere: in the stair parts library, in
 * the deck engine and in any takeoff built from them. Keeping the table here
 * means a suite can size a member without importing the 3D part builders that
 * need Three.js.
 */

export const IN = 0.0254;
export const FT = 12 * IN;

export const LUMBER = {
    '1x4': { thickness: 0.75 * IN, width: 3.5 * IN },
    '1x6': { thickness: 0.75 * IN, width: 5.5 * IN },
    '1x8': { thickness: 0.75 * IN, width: 7.25 * IN },
    '2x2': { thickness: 1.5 * IN, width: 1.5 * IN },
    '2x4': { thickness: 1.5 * IN, width: 3.5 * IN },
    '2x6': { thickness: 1.5 * IN, width: 5.5 * IN },
    '2x8': { thickness: 1.5 * IN, width: 7.25 * IN },
    '2x10': { thickness: 1.5 * IN, width: 9.25 * IN },
    '2x12': { thickness: 1.5 * IN, width: 11.25 * IN },
    '4x4': { thickness: 3.5 * IN, width: 3.5 * IN },
    '6x6': { thickness: 5.5 * IN, width: 5.5 * IN },
    '5/4x6': { thickness: 1 * IN, width: 5.5 * IN }
};
