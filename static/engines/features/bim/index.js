/**
 * BIM kit: IFC class mapping, the element quantity table and the QTO CSV.
 * The studio panel and the editor's download both come through here.
 */
export * from './takeoff.js';

export const BIM_KIT = [
    { id: 'classes', label: 'Plan type → IFC class map' },
    { id: 'quantities', label: 'Wall length, net area and volume; fixture footprints' },
    { id: 'openings', label: 'Doors and windows deducted from their wall' },
    { id: 'csv', label: 'IfcClass/Name/Count/LengthM/AreaM2/VolumeM3 export' }
];
