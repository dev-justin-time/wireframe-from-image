import { ftIn } from './engine.js';
import { studDepthM } from './catalog.js';

/**
 * 2D drawings for the framing suite.
 *
 * The plan is a top cut through the studs: the wall is a band as deep as the
 * stud, every stud is a tick, and every opening is a gap with its header
 * dashed across. The elevation is the wall laid flat, with every plate, king,
 * jack, header, cripple and block in its real position and proportion.
 *
 * World units are metres. Plan x is east, plan z is south; the canvas fits the
 * storey with a margin, so the same drawing works for a 6 m cabin and a 30 m
 * house.
 */

const PADDING = 64;
const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);

/** Accept either a raw wall (x1/z1) or an engine wall frame (start/end). */
function endpoints(wall = {}) {
    if (wall.start && wall.end) {
        return { x1: wall.start.x, z1: wall.start.z, x2: wall.end.x, z2: wall.end.z };
    }
    const x1 = Number(wall.x1) || 0;
    const z1 = Number(wall.z1) || 0;
    return { x1, z1, x2: Number.isFinite(Number(wall.x2)) ? Number(wall.x2) : x1, z2: Number.isFinite(Number(wall.z2)) ? Number(wall.z2) : z1 };
}

export function createFramingPlan(config = {}) {
    return { walls: (config.storeys?.[0]?.walls || []).map((wall) => ({ ...wall })) };
}

export function planBounds(walls = []) {
    const points = walls.flatMap((wall) => {
        const wallEnds = endpoints(wall);
        return [
            { x: wallEnds.x1, z: wallEnds.z1 },
            { x: wallEnds.x2, z: wallEnds.z2 }
        ];
    });
    if (!points.length) return { minX: 0, maxX: 8, minZ: 0, maxZ: 6, widthM: 8, depthM: 6 };
    const xs = points.map((point) => point.x);
    const zs = points.map((point) => point.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    return {
        minX,
        maxX,
        minZ,
        maxZ,
        widthM: Math.max(maxX - minX, 1),
        depthM: Math.max(maxZ - minZ, 1)
    };
}

export function planTransform(width, height, walls, view = {}) {
    const bounds = planBounds(walls);
    const zoom = clamp(view.zoom ?? 1, 0.4, 4);
    const scale = Math.min(
        (width - PADDING * 2) / bounds.widthM,
        (height - PADDING * 2) / bounds.depthM
    ) * zoom;
    const originX = width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale;
    const originY = height / 2 - ((bounds.minZ + bounds.maxZ) / 2) * scale;
    return {
        scale,
        bounds,
        toScreen: (x, z) => ({ x: originX + x * scale, y: originY + z * scale }),
        toWorld: (x, y) => ({ x: (x - originX) / scale, z: (y - originY) / scale })
    };
}

export function wallFrame(wall) {
    const { x1, z1, x2, z2 } = endpoints(wall);
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz) || 1;
    return { x: dx / length, z: dz / length, length };
}

/** A wall band from its centreline, `depth` metres either side of the middle. */
export function wallPolygon(wall, depth) {
    const { x1, z1, x2, z2 } = endpoints(wall);
    const dir = wallFrame(wall);
    const normal = { x: -dir.z, z: dir.x };
    const half = depth / 2;
    return [
        { x: x1 - normal.x * half, z: z1 - normal.z * half },
        { x: x2 - normal.x * half, z: z2 - normal.z * half },
        { x: x2 + normal.x * half, z: z2 + normal.z * half },
        { x: x1 + normal.x * half, z: z1 + normal.z * half }
    ];
}

export function pointOnWall(wall, point) {
    const { x1, z1 } = endpoints(wall);
    const dir = wallFrame(wall);
    const dx = point.x - x1;
    const dz = point.z - z1;
    const along = dx * dir.x + dz * dir.z;
    const across = Math.abs(dx * -dir.z + dz * dir.x);
    return { along, across, inside: along >= -0.05 && along <= dir.length + 0.05 && across <= 0.25 };
}

export function wallAt(walls = [], point, tolerance = 0.3) {
    return walls.find((wall) => {
        const hit = pointOnWall(wall, point);
        return hit.across <= tolerance && hit.along >= -tolerance && hit.along <= wallFrame(wall).length + tolerance;
    }) || null;
}

/** Snap a point to a foot grid and, within 0.3 m, to an existing endpoint. */
export function snapPlanPoint(point, walls = [], gridM = 0.3048) {
    const candidates = walls.flatMap((wall) => {
        const wallEnds = endpoints(wall);
        return [
            { x: wallEnds.x1, z: wallEnds.z1 },
            { x: wallEnds.x2, z: wallEnds.z2 }
        ];
    });
    for (const candidate of candidates) {
        if (Math.hypot(point.x - candidate.x, point.z - candidate.z) < 0.3) return { ...candidate, snapped: 'endpoint' };
    }
    return {
        x: Math.round(point.x / gridM) * gridM,
        z: Math.round(point.z / gridM) * gridM,
        snapped: 'grid'
    };
}

function polygon(ctx, transform, points) {
    ctx.beginPath();
    points.forEach((point, index) => {
        const screen = transform.toScreen(point.x, point.z);
        if (index === 0) ctx.moveTo(screen.x, screen.y);
        else ctx.lineTo(screen.x, screen.y);
    });
    ctx.closePath();
}

function arrow(ctx, from, to, colour = '#475569') {
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    [[from, angle], [to, angle + Math.PI]].forEach(([point, direction]) => {
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(point.x - Math.cos(direction - 0.4) * 6, point.y - Math.sin(direction - 0.4) * 6);
        ctx.lineTo(point.x - Math.cos(direction + 0.4) * 6, point.y - Math.sin(direction + 0.4) * 6);
        ctx.closePath();
        ctx.fill();
    });
}

function dimension(ctx, from, to, text, colour = '#475569') {
    arrow(ctx, from, to, colour);
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    const width = ctx.measureText(text).width + 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mid.x - width / 2, mid.y - 8, width, 14);
    ctx.fillStyle = colour;
    ctx.textAlign = 'center';
    ctx.fillText(text, mid.x, mid.y + 2);
}

function tag(ctx, x, y, text, background, colour = '#0f172a') {
    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    const width = ctx.measureText(text).width + 8;
    ctx.fillStyle = background;
    ctx.fillRect(x - width / 2, y - 7, width, 14);
    ctx.fillStyle = colour;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y + 3);
}

/**
 * Top-down framing plan for one storey.
 */
export function drawFramingPlan(ctx, width, height, design, options = {}) {
    const index = clamp(options.storeyIndex ?? 0, 0, Math.max((design?.storeys?.length || 1) - 1, 0));
    const storey = design?.storeys?.[index];
    const walls = storey?.walls || [];
    const selectedWallId = options.selectedWallId || null;
    const show = {
        studs: true,
        openings: true,
        dimensions: true,
        labels: true,
        blocking: false,
        ...(options.show || {})
    };
    const transform = planTransform(width, height, walls, options.view || {});
    const depth = studDepthM(design?.config?.studSize || '2x4');

    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);
    drawGrid(ctx, width, height, transform);

    if (!walls.length) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No walls on this storey yet — drag on the plan to draw one.', width / 2, height / 2 - 8);
        ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText('Use “Rectangle” to start from the footprint, or copy the storey below.', width / 2, height / 2 + 10);
        ctx.restore();
        return;
    }

    // Exterior walls first so partitions read on top of the shell.
    const ordered = [...walls].sort((a, b) => Number(b.exterior) - Number(a.exterior));
    ordered.forEach((wall) => {
        const isSelected = wall.id === selectedWallId;
        polygon(ctx, transform, wallPolygon(wall, depth));
        ctx.fillStyle = isSelected ? '#fef3c7' : wall.exterior ? '#e7e5e4' : '#f1f5f9';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#b45309' : wall.exterior ? '#78716c' : '#94a3b8';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        if (show.studs) {
            wall.members.filter((member) => ['stud', 'king', 'jack'].includes(member.kind)).forEach((member) => {
                const dir = wallFrame(wall);
                const normal = { x: -dir.z, z: dir.x };
                const centre = (member.x0 + member.x1) / 2;
                const from = {
                    x: wall.start.x + dir.x * centre - normal.x * depth * 0.42,
                    z: wall.start.z + dir.z * centre - normal.z * depth * 0.42
                };
                const to = {
                    x: wall.start.x + dir.x * centre + normal.x * depth * 0.42,
                    z: wall.start.z + dir.z * centre + normal.z * depth * 0.42
                };
                const a = transform.toScreen(from.x, from.z);
                const b = transform.toScreen(to.x, to.z);
                ctx.strokeStyle = member.kind === 'king' ? '#b45309' : member.kind === 'jack' ? '#c2410c' : '#57534e';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            });
        }

        if (show.blocking) {
            wall.members.filter((member) => member.kind === 'block').forEach((member) => {
                const dir = wallFrame(wall);
                const normal = { x: -dir.z, z: dir.x };
                const centre = (member.x0 + member.x1) / 2;
                const a = transform.toScreen(
                    wall.start.x + dir.x * centre - normal.x * depth * 0.3,
                    wall.start.z + dir.z * centre - normal.z * depth * 0.3
                );
                const b = transform.toScreen(
                    wall.start.x + dir.x * centre + normal.x * depth * 0.3,
                    wall.start.z + dir.z * centre + normal.z * depth * 0.3
                );
                ctx.strokeStyle = '#0ea5e9';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            });
        }

        wall.openings.forEach((opening) => {
            const dir = wallFrame(wall);
            const normal = { x: -dir.z, z: dir.x };
            const point = (along, offset = 0) => transform.toScreen(
                wall.start.x + dir.x * along + normal.x * offset,
                wall.start.z + dir.z * along + normal.z * offset
            );
            const left = point(opening.startM);
            const right = point(opening.endM);
            const half = (depth * transform.scale) / 2;
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(left.x - normal.x * half, left.y - normal.z * half);
            ctx.lineTo(right.x - normal.x * half, right.y - normal.z * half);
            ctx.lineTo(right.x + normal.x * half, right.y + normal.z * half);
            ctx.lineTo(left.x + normal.x * half, left.y + normal.z * half);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Jambs and the header dashed across the opening.
            ctx.strokeStyle = '#475569';
            ctx.beginPath();
            ctx.moveTo(left.x - normal.x * half, left.y - normal.z * half);
            ctx.lineTo(left.x + normal.x * half, left.y + normal.z * half);
            ctx.moveTo(right.x - normal.x * half, right.y - normal.z * half);
            ctx.lineTo(right.x + normal.x * half, right.y + normal.z * half);
            ctx.stroke();
            if (show.openings) {
                ctx.setLineDash([4, 3]);
                ctx.strokeStyle = '#b45309';
                ctx.beginPath();
                ctx.moveTo(left.x, left.y);
                ctx.lineTo(right.x, right.y);
                ctx.stroke();
                ctx.setLineDash([]);
                const mid = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
                const label = opening.type === 'door' ? 'D' : opening.type === 'window' ? 'W' : 'O';
                tag(ctx, mid.x, mid.y - 10, `${label} ${ftIn(opening.widthM)}`, '#fffbeb', '#b45309');
            }
        });

        if (show.labels) {
            const dir = wallFrame(wall);
            const normal = { x: -dir.z, z: dir.x };
            const mid = transform.toScreen(
                (wall.start.x + wall.end.x) / 2 + normal.x * (depth * 1.6 + 0.2),
                (wall.start.z + wall.end.z) / 2 + normal.z * (depth * 1.6 + 0.2)
            );
            tag(ctx, mid.x, mid.y, `${wall.name.replace(/^Wall /, 'W')} ${ftIn(wall.lengthM)}`, wall.exterior ? '#e7e5e4' : '#e2e8f0');
        }
    });

    if (show.dimensions) {
        const bounds = transform.bounds;
        const offset = 0.9;
        const a = transform.toScreen(bounds.minX, bounds.maxZ + offset);
        const b = transform.toScreen(bounds.maxX, bounds.maxZ + offset);
        dimension(ctx, a, b, ftIn(bounds.widthM), '#0f172a');
        const c = transform.toScreen(bounds.minX - offset, bounds.minZ);
        const d = transform.toScreen(bounds.minX - offset, bounds.maxZ);
        dimension(ctx, c, d, ftIn(bounds.depthM), '#0f172a');
    }

    drawLegend(ctx, width, height, design, storey, { ...options, scale: transform.scale });
    ctx.restore();
}

function drawGrid(ctx, width, height, transform) {
    const step = transform.scale * 0.3048;
    if (step < 8) return;
    ctx.strokeStyle = '#eef2f7';
    ctx.lineWidth = 1;
    for (let x = width / 2 % step; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = height / 2 % step; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
}

function drawLegend(ctx, width, height, design, storey, options) {
    const margin = 12;
    const entries = [
        ['#e7e5e4', 'exterior wall'],
        ['#f1f5f9', 'partition'],
        ['#57534e', 'stud'],
        ['#b45309', 'king / header'],
        ['#0ea5e9', 'blocking']
    ];
    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    const boxWidth = 190;
    const boxHeight = entries.length * 13 + 22;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.fillRect(margin, height - margin - boxHeight, boxWidth, boxHeight);
    ctx.strokeRect(margin, height - margin - boxHeight, boxWidth, boxHeight);
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'left';
    ctx.fillText(`${storey?.name || 'Storey'} · ${design?.config?.studSize || '2x4'} @ ${design?.config?.studSpacingIn || 16} in OC`, margin + 8, height - margin - boxHeight + 13);
    entries.forEach(([colour, label], index) => {
        const y = height - margin - boxHeight + 26 + index * 13;
        ctx.fillStyle = colour;
        ctx.fillRect(margin + 8, y - 7, 10, 8);
        ctx.strokeStyle = '#cbd5e1';
        ctx.strokeRect(margin + 8, y - 7, 10, 8);
        ctx.fillStyle = '#475569';
        ctx.fillText(label, margin + 24, y);
    });

    // Scale bar: 2 m at the drawing scale, or 1 m when the drawing is small.
    const scalePx = Number(options.scale) || 0;
    const barM = scalePx * 2 > 90 ? 2 : 1;
    const bar = Math.max(24, barM * scalePx);
    const scaleX = width - margin - bar - 10;
    const scaleY = height - margin - 10;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scaleX, scaleY);
    ctx.lineTo(scaleX + bar, scaleY);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(scaleX, scaleY - 4);
    ctx.lineTo(scaleX, scaleY + 4);
    ctx.moveTo(scaleX + bar, scaleY - 4);
    ctx.lineTo(scaleX + bar, scaleY + 4);
    ctx.stroke();
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.fillText(`${barM} m`, scaleX + bar / 2, scaleY - 8);
}

function rect(ctx, x0, y0, x1, y1) {
    ctx.beginPath();
    ctx.rect(x0, y0, Math.max(x1 - x0, 0.5), Math.max(y1 - y0, 0.5));
}

/**
 * Elevation of one framed wall: the drawing a framer marks the plates from.
 */
export function drawWallElevation(ctx, width, height, frame, options = {}) {
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    if (!frame) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Select a wall on the plan to see its framing elevation.', width / 2, height / 2);
        ctx.restore();
        return;
    }

    const padX = 54;
    const padY = 34;
    const scale = Math.min(
        (width - padX * 2) / Math.max(frame.lengthM, 0.5),
        (height - padY * 2) / Math.max(frame.heightM, 0.5)
    );
    const baseY = height - padY;
    const left = (width - frame.lengthM * scale) / 2;
    const xOf = (metres) => left + metres * scale;
    const yOf = (metres) => baseY - metres * scale;

    // Exterior sheathing outline behind the frame.
    if (frame.sheathed) {
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(xOf(0) - 4, yOf(frame.heightM) - 4, frame.lengthM * scale + 8, frame.heightM * scale + 8);
        ctx.strokeStyle = '#fcd34d';
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1;
        ctx.strokeRect(xOf(0) - 4, yOf(frame.heightM) - 4, frame.lengthM * scale + 8, frame.heightM * scale + 8);
        ctx.setLineDash([]);
    }

    const colours = {
        'plate-bottom': '#86efac',
        'plate-top': '#bbf7d0',
        stud: '#e7d8c3',
        king: '#d6b88a',
        jack: '#c9a06a',
        cripple: '#efe4d2',
        header: '#fbbf24',
        sill: '#cbd5e1',
        block: '#7dd3fc'
    };

    frame.members.forEach((member) => {
        const x0 = xOf(member.x0);
        const x1 = xOf(member.x1);
        const y0 = yOf(member.y1);
        const y1 = yOf(member.y0);
        ctx.fillStyle = colours[member.kind] || '#e2e8f0';
        ctx.strokeStyle = member.kind === 'header' ? '#b45309' : '#8b7355';
        ctx.lineWidth = member.kind === 'header' ? 1.2 : 0.8;
        rect(ctx, x0, y0, x1, y1);
        ctx.fill();
        ctx.stroke();
    });

    // Opening outline and dimension.
    frame.openings.forEach((opening) => {
        const x0 = xOf(opening.startM);
        const x1 = xOf(opening.endM);
        const yTop = yOf(opening.topM);
        const ySill = yOf(opening.sillM);
        ctx.strokeStyle = opening.clamped ? '#dc2626' : '#0f172a';
        ctx.setLineDash([5, 3]);
        ctx.lineWidth = 1.2;
        ctx.strokeRect(x0, yTop, x1 - x0, ySill - yTop);
        ctx.setLineDash([]);
        const midX = (x0 + x1) / 2;
        const label = `${opening.type === 'door' ? 'DOOR' : opening.type === 'window' ? 'WINDOW' : 'OPENING'} ${ftIn(opening.widthM)} × ${ftIn(opening.heightM)}`;
        if (x1 - x0 > 90) tag(ctx, midX, (yTop + ySill) / 2, label, 'rgba(255,255,255,0.9)', '#0f172a');
        if (opening.header?.engineered) {
            tag(ctx, midX, yTop - 12, 'ENGINEERED HEADER', '#fef2f2', '#b91c1c');
        }
    });

    // Dimensions: overall length, height, opening positions and stud spacing.
    dimension(ctx, { x: xOf(0), y: baseY + 22 }, { x: xOf(frame.lengthM), y: baseY + 22 }, ftIn(frame.lengthM), '#0f172a');
    dimension(ctx, { x: left - 24, y: yOf(0) }, { x: left - 24, y: yOf(frame.heightM) }, ftIn(frame.heightM), '#0f172a');
    const firstStud = frame.members.find((member) => member.kind === 'stud');
    if (firstStud) {
        dimension(
            ctx,
            { x: xOf(firstStud.x0), y: yOf(frame.heightM) - 16 },
            { x: xOf(firstStud.x1 + frame.spacingM), y: yOf(frame.heightM) - 16 },
            `${frame.spacingM ? Math.round(frame.spacingM / 0.0254) : 16} in`,
            '#b45309'
        );
    }

    // Text callouts.
    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.fillText(`${frame.studSize} @ ${Math.round(frame.spacingM / 0.0254)} in OC · ${ftIn(frame.studLengthM)} stud`, 10, 14);
    ctx.fillText(`${frame.topPlates === 2 ? 'Double' : 'Single'} top plate · treated sole plate${frame.sheathed ? ' · sheathed' : ''}`, 10, 26);
    ctx.textAlign = 'right';
    ctx.fillText(`${frame.name} · ${frame.exterior ? 'exterior' : 'partition'}`, width - 10, 14);
    ctx.fillText(`${frame.counts.studs + frame.counts.kings + frame.counts.jacks + frame.counts.cripples} studs · ${frame.counts.blocks} blocks`, width - 10, 26);

    const worst = frame.openings.reduce((entry, opening) => (
        !entry || opening.header.utilisation > entry.header.utilisation ? opening : entry
    ), null);
    if (worst) {
        ctx.textAlign = 'center';
        ctx.fillStyle = worst.header.engineered ? '#b91c1c' : '#475569';
        ctx.fillText(worst.header.note, width / 2, height - 6);
    }
    ctx.restore();
}
