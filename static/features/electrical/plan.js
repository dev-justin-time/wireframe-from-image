/**
 * Panel elevation and one-line diagram for the electrical suite.
 *
 * The left column is the service one-line (drop or lateral, meter, main, bus),
 * the right is the panel front with every breaker in its space. Both read the
 * same circuit list as the schedule, so a breaker moved in the design moves in
 * the drawing.
 */

const clamp = (value, min, max) => Math.min(Math.max(Number(value) || min, min), max);

export function createElectricalPlan(config = {}) {
    return { config: { ...config } };
}

export function normalizeElectricalPlan(raw = {}) {
    return { config: { ...(raw.config || {}) } };
}

/** Space-by-space layout of the panel front, in CSS pixels. */
export function panelLayout(design, width, height) {
    const margin = 16;
    const headerHeight = 118;
    const footerHeight = 54;
    const bodyTop = headerHeight;
    const bodyHeight = Math.max(height - headerHeight - footerHeight, 160);
    const rowCount = Math.max(Math.ceil(design.spaces.total / 2), 1);
    const rowHeight = bodyHeight / rowCount;
    const columnWidth = Math.min((width * 0.56) / 2, 132);
    const panelLeft = width - columnWidth * 2 - margin - 26;
    const panelTop = bodyTop + 6;
    const panelHeight = bodyHeight - 12;

    // Allocate one slot per space; a 240 V circuit takes two adjacent spaces in
    // the same column, which is how a real panel is laid out.
    const slots = [];
    const circuits = design.circuits;
    let space = 1;
    let column = 0;
    let row = 0;
    const place = (circuit, span = 1) => {
        for (let step = 0; step < span; step += 1) {
            slots.push({
                space: space + step,
                column,
                row: row + step,
                x: panelLeft + column * columnWidth,
                y: panelTop + (row + step) * rowHeight,
                width: columnWidth - 4,
                height: rowHeight - 3,
                circuit: step === 0 ? circuit : null,
                span: span > 1 ? 'pair' : 'single'
            });
        }
        space += span;
        row += span;
        if (row >= rowCount) {
            row = 0;
            column = Math.min(column + 1, 1);
        }
    };

    circuits.forEach((circuit) => {
        const span = circuit.voltage > 150 ? 2 : 1;
        if (space + span - 1 > design.spaces.total) return;
        place(circuit, span);
    });
    while (space <= design.spaces.total) {
        place(null, 1);
    }

    return {
        header: { x: margin, y: 10, width: width - margin * 2, height: headerHeight - 20 },
        panel: { x: panelLeft - 10, y: panelTop - 10, width: columnWidth * 2 + 14, height: panelHeight + 12 },
        slots,
        footer: { x: margin, y: height - footerHeight + 6, width: width - margin * 2, height: footerHeight - 14 },
        rowHeight,
        columnWidth
    };
}

/** The circuit whose breaker sits under a point, for hover and click. */
export function circuitAt(design, width, height, point) {
    const layout = panelLayout(design, width, height);
    const slot = layout.slots.find((entry) => (
        point.x >= entry.x && point.x <= entry.x + entry.width
        && point.y >= entry.y && point.y <= entry.y + entry.height
    ));
    if (!slot) return null;
    if (slot.circuit) return { circuit: slot.circuit, space: slot.space };
    // A 240 V pair: report the circuit on the first slot of the pair.
    const pair = layout.slots.find((entry) => entry.space === slot.space - 1 && entry.circuit);
    return pair ? { circuit: pair.circuit, space: pair.space } : null;
}

function roundRect(ctx, x, y, width, height, radius = 4) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function label(ctx, text, x, y, { size = 10, colour = '#334155', align = 'left', weight = '400' } = {}) {
    ctx.fillStyle = colour;
    ctx.font = `${weight} ${size}px ui-monospace, monospace`;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
}

function drawServiceLine(ctx, design, width) {
    const x = 26;
    const top = 18;
    const serviceLabel = design.engine || design.config.serviceType;

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, top + 10);
    ctx.lineTo(x + 130, top + 10);
    ctx.stroke();

    // Utility and meter.
    label(ctx, design.config.serviceType === 'overhead' ? 'SERVICE DROP' : 'SERVICE LATERAL', x, top + 4, { size: 9, colour: '#64748b' });
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(x + 64, top + 16, 34, 30);
    label(ctx, 'kWh', x + 81, top + 35, { size: 9, align: 'center', weight: '700' });
    ctx.beginPath();
    ctx.moveTo(x + 98, top + 31);
    ctx.lineTo(x + 140, top + 31);
    ctx.stroke();

    // Main breaker.
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 140, top + 18, 46, 26);
    label(ctx, `${design.mainBreaker}A`, x + 163, top + 35, { size: 10, align: 'center', colour: '#f8fafc', weight: '700' });
    label(ctx, 'MAIN', x + 163, top + 52, { size: 8, align: 'center', colour: '#64748b' });
    ctx.beginPath();
    ctx.moveTo(x + 186, top + 31);
    ctx.lineTo(x + 220, top + 31);
    ctx.stroke();

    // Bus and grounding.
    ctx.fillStyle = '#b45309';
    ctx.fillRect(x + 220, top + 20, 8, 22);
    label(ctx, `${design.serviceAmps}A BUS`, x + 234, top + 30, { size: 9, colour: '#92400e', weight: '700' });
    label(ctx, `${design.feeder.size} CU · ${design.feeder.vdPercent}% VD`, x + 234, top + 43, { size: 9, colour: '#64748b' });

    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x + 224, top + 46);
    ctx.lineTo(x + 224, top + 66);
    ctx.lineTo(x + 176, top + 66);
    ctx.stroke();
    label(ctx, `${design.gec} GEC`, x + 24, top + 70, { size: 9, colour: '#0f766e', weight: '700' });
    ctx.beginPath();
    ctx.moveTo(x + 168, top + 70);
    ctx.lineTo(x + 152, top + 70);
    ctx.stroke();
    // Ground rods.
    for (let index = 0; index < design.config.groundingElectrodes; index += 1) {
        const rodX = x + 128 + index * 20;
        ctx.beginPath();
        ctx.moveTo(rodX, top + 70);
        ctx.lineTo(rodX, top + 90);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rodX - 5, top + 90);
        ctx.lineTo(rodX + 5, top + 90);
        ctx.stroke();
    }
    label(ctx, 'NEUTRAL / GROUND BARS BONDED AT THE SERVICE ONLY', width - 16, top + 84, { size: 8, colour: '#94a3b8', align: 'right' });
    void serviceLabel;
}

export function drawElectricalPlan(ctx, width, height, design, options = {}) {
    const dpr = options.dpr || 1;
    const layout = panelLayout(design, width, height);
    const selected = options.selected || null;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    drawServiceLine(ctx, design, width);

    // Panel enclosure.
    const panel = layout.panel;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    roundRect(ctx, panel.x, panel.y, panel.width, panel.height, 6);
    ctx.fill();
    ctx.stroke();
    label(ctx, design.panel.label, panel.x + 8, panel.y + 14, { size: 9, colour: '#475569', weight: '700' });
    label(ctx, `${design.spaces.used} USED · ${design.spaces.spares} SPARE`, panel.x + panel.width - 8, panel.y + 14, { size: 9, colour: '#64748b', align: 'right' });

    layout.slots.forEach((slot) => {
        const circuit = slot.circuit;
        const isSelected = selected && circuit && circuit.id === selected;
        ctx.fillStyle = circuit ? (isSelected ? '#0f172a' : '#f1f5f9') : '#ffffff';
        ctx.strokeStyle = circuit ? '#cbd5e1' : '#e2e8f0';
        ctx.lineWidth = 1;
        roundRect(ctx, slot.x, slot.y, slot.width, slot.height, 3);
        ctx.fill();
        ctx.stroke();

        if (circuit) {
            const textColour = isSelected ? '#f8fafc' : '#0f172a';
            label(ctx, `${circuit.breaker}A`, slot.x + 7, slot.y + slot.height / 2 + 4, { size: 10, colour: textColour, weight: '700' });
            label(ctx, circuit.voltage > 150 ? '2P' : '1P', slot.x + slot.width - 7, slot.y + slot.height / 2 + 4,
                { size: 8, colour: isSelected ? '#cbd5e1' : '#64748b', align: 'right' });
            if (circuit.gfci || circuit.afci) {
                ctx.fillStyle = circuit.gfci ? '#0f766e' : '#7c3aed';
                ctx.beginPath();
                ctx.arc(slot.x + slot.width / 2, slot.y + 5, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            label(ctx, `${slot.space}`, slot.x + 7, slot.y + slot.height / 2 + 4, { size: 9, colour: '#cbd5e1' });
        }
    });

    // Directory column.
    const dirX = 26;
    label(ctx, 'PANEL DIRECTORY', dirX, layout.panel.y + 14, { size: 9, colour: '#475569', weight: '700' });
    const listTop = layout.panel.y + 30;
    const listRows = Math.max(Math.floor((layout.panel.height - 40) / 16), 4);
    design.circuits.slice(0, listRows).forEach((circuit, index) => {
        const y = listTop + index * 16;
        label(ctx, `${String(index + 1).padStart(2, ' ')}  ${circuit.label}`, dirX, y, { size: 9, colour: '#334155' });
        label(ctx, `${circuit.breaker}A`, dirX + Math.min(width * 0.3, 210), y, { size: 9, colour: '#64748b', align: 'right' });
    });
    if (design.circuits.length > listRows) {
        label(ctx, `+${design.circuits.length - listRows} more circuits on the schedule`, dirX, listTop + listRows * 16, { size: 9, colour: '#94a3b8' });
    }

    // Load bar.
    const footer = layout.footer;
    const ratio = clamp(design.demandAmps / Math.max(design.serviceAmps, 1), 0, 1);
    ctx.fillStyle = '#e2e8f0';
    roundRect(ctx, footer.x, footer.y, footer.width, 12, 6);
    ctx.fill();
    ctx.fillStyle = ratio > 0.95 ? '#dc2626' : ratio > 0.8 ? '#b45309' : '#0ea5e9';
    roundRect(ctx, footer.x, footer.y, Math.max(footer.width * ratio, 6), 12, 6);
    ctx.fill();
    label(ctx, `DEMAND ${design.demandVa} VA · ${design.demandAmps} A`, footer.x, footer.y + 28, { size: 9, colour: '#334155' });
    label(ctx, `${design.serviceAmps} A SERVICE · ${Math.round(ratio * 100)}% LOADED`, footer.x + footer.width, footer.y + 28,
        { size: 9, colour: '#64748b', align: 'right' });
    label(ctx, `${design.circuits.filter((circuit) => circuit.gfci).length} GFCI · ${design.circuits.filter((circuit) => circuit.afci).length} AFCI`,
        footer.x, footer.y + 40, { size: 9, colour: '#0f766e' });

    ctx.restore();
}
