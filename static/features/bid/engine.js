/**
 * Bid and proposal engine.
 *
 * The builder takes the priced bills of materials harvested from every suite,
 * adds the commercial structure (overhead, profit, contingency, permit, design
 * fee, tax) and produces the totals, the progress billing and the proposal
 * text. One model feeds the screen, the CSV and the printed proposal.
 */

export const BID_DEFAULTS = {
    project: {
        name: 'Residential package',
        client: '',
        address: '',
        date: new Date().toISOString().slice(0, 10),
        reference: 'BID-' + new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        validityDays: 30,
        scope: ''
    },
    markup: {
        overhead: 12,
        profit: 15,
        contingency: 5,
        tax: 7.5,
        permit: 450,
        design: 1200,
        discount: 0
    },
    taxLabour: false,
    depositPct: 30,
    billing: [30, 40, 30]
};

const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
};
const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);

const LABOUR_GROUP = /labour|labor|install/i;

/** Split a group's lines into material and labour value. */
function splitGroups(groups = []) {
    let material = 0;
    let labour = 0;
    groups.forEach((group) => {
        group.lines.forEach((line) => {
            if (LABOUR_GROUP.test(group.label) || LABOUR_GROUP.test(line.group || '') || line.labour) labour += line.total;
            else material += line.total;
        });
    });
    return { material: round(material, 2), labour: round(labour, 2) };
}

export function buildBid({ groups = [], alternateLines = [], project = {}, markup = {}, taxLabour = false, depositPct = 30, billing = [30, 40, 30] } = {}) {
    const config = {
        project: { ...BID_DEFAULTS.project, ...project },
        markup: { ...BID_DEFAULTS.markup, ...markup },
        taxLabour: Boolean(taxLabour),
        depositPct: clamp(depositPct, 0, 100),
        billing
    };

    const priced = groups.map((group) => ({
        ...group,
        subtotal: round(group.lines.reduce((total, line) => total + line.total, 0), 2)
    }));
    const base = round(priced.reduce((total, group) => total + group.subtotal, 0), 2);
    const split = splitGroups(priced);

    const overhead = round(base * (clamp(config.markup.overhead, 0, 60) / 100), 2);
    const profit = round((base + overhead) * (clamp(config.markup.profit, 0, 50) / 100), 2);
    const contingency = round(base * (clamp(config.markup.contingency, 0, 25) / 100), 2);
    const discount = round(clamp(config.markup.discount, 0, base), 2);
    const permit = round(Math.max(Number(config.markup.permit) || 0, 0), 2);
    const design = round(Math.max(Number(config.markup.design) || 0, 0), 2);

    const preTax = round(base + overhead + profit + contingency + permit + design - discount, 2);
    const taxBase = config.taxLabour ? preTax : Math.max(split.material - discount, 0);
    const tax = round(taxBase * (clamp(config.markup.tax, 0, 25) / 100), 2);
    const total = round(preTax + tax, 2);

    const alternateTotal = round(alternateLines.reduce((sum, line) => sum + line.total, 0), 2);
    const alternativeTax = round(alternateTotal * (clamp(config.markup.tax, 0, 25) / 100), 2);

    const stages = [
        { key: 'deposit', label: 'Deposit with acceptance', pct: clamp(config.depositPct, 0, 100) },
        { key: 'rough', label: 'Rough-in and materials on site', pct: clamp(billing?.[1] ?? 40, 0, 100) },
        { key: 'final', label: 'Substantial completion', pct: clamp(billing?.[2] ?? 30, 0, 100) }
    ];
    const billingTotal = stages.reduce((sum, stage) => sum + stage.pct, 0);
    const schedule = stages.map((stage, index) => ({
        ...stage,
        amount: index === stages.length - 1
            ? round(total - stages.slice(0, -1).reduce((sum, entry) => sum + round(total * (entry.pct / 100), 2), 0), 2)
            : round(total * (stage.pct / 100), 2)
    }));

    const costs = {
        base,
        material: split.material,
        labour: split.labour,
        overhead,
        profit,
        contingency,
        permit,
        design,
        discount,
        preTax,
        taxBase,
        tax,
        total,
        margin: preTax > 0 ? round(((profit + overhead) / preTax) * 100, 1) : 0,
        perSqm: null
    };

    return {
        config,
        groups: priced,
        alternates: alternateLines,
        costs,
        alternateTotal,
        alternativeTax,
        schedule,
        billingTotal,
        counts: {
            suites: priced.filter((group) => group.kind === 'suite').length,
            lines: priced.reduce((totalLines, group) => totalLines + group.lines.length, 0),
            alternates: alternateLines.length
        }
    };
}

export function bidChecks(bid) {
    const checks = [];
    const push = (id, severity, label, message) => checks.push({ id, severity, label, message });
    const { costs, config, counts, schedule } = bid;

    push('sources', counts.suites > 0 ? 'ok' : 'error', 'Suite sources',
        counts.suites > 0
            ? `${counts.suites} suite${counts.suites === 1 ? '' : 's'} harvested, ${counts.lines} priced lines.`
            : 'No saved suite design found: open a designer and save a design, or add manual lines.');
    push('markup', costs.margin >= 10 && costs.margin <= 40 ? 'ok' : costs.margin < 10 ? 'warning' : 'warning', 'Margin',
        `${costs.margin}% gross margin on the pre-tax total. Typical residential work runs 15–30%.`);
    push('tax', costs.taxBase > 0 ? 'ok' : 'warning', 'Sales tax',
        config.taxLabour
            ? `Tax applied to the full pre-tax total at ${config.markup.tax}%.`
            : `Tax applied to materials only ($${costs.material.toFixed(0)}) at ${config.markup.tax}%.`);
    push('billing', Math.abs(bid.billingTotal - 100) < 0.01 ? 'ok' : 'warning', 'Progress billing',
        `${schedule.map((stage) => `${stage.pct}%`).join(' / ')} = ${bid.billingTotal}% of the contract.`);
    push('contingency', config.markup.contingency >= 5 ? 'ok' : 'warning', 'Contingency',
        `${config.markup.contingency}% on the base. Under 5% leaves no room for site surprises.`);
    push('validity', config.project.validityDays >= 14 ? 'ok' : 'warning', 'Validity',
        `Proposal valid for ${config.project.validityDays} days.`);
    push('alternates', counts.alternates > 0 ? 'info' : 'ok', 'Alternates',
        counts.alternates > 0
            ? `${counts.alternates} alternate lines worth $${bid.alternateTotal.toFixed(0)} are priced but excluded from the contract total.`
            : 'No alternates in this package.');
    push('deposit', config.depositPct >= 10 && config.depositPct <= 40 ? 'ok' : 'warning', 'Deposit',
        `${config.depositPct}% on acceptance. Keep the deposit within the state’s limit and put it in writing.`);

    const errors = checks.filter((check) => check.severity === 'error').length;
    const warnings = checks.filter((check) => check.severity === 'warning').length;
    return { checks, errors, warnings, ok: errors === 0 };
}

export function bidCsv(bid) {
    const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [['suite', 'group', 'code', 'description', 'qty', 'unit', 'unit cost', 'total', 'note'].map(quote).join(',')];
    bid.groups.forEach((group) => {
        group.lines.forEach((line) => {
            rows.push([group.label, line.group, line.code, line.description, line.qty, line.unit, line.unitCost.toFixed(2), line.total.toFixed(2), line.note].map(quote).join(','));
        });
        rows.push([group.label, '', '', 'Subtotal', '', '', '', group.subtotal.toFixed(2), ''].map(quote).join(','));
    });
    const summary = [
        ['Summary', '', '', 'Base', '', '', '', bid.costs.base],
        ['Summary', '', '', 'Overhead', '', '', '', bid.costs.overhead],
        ['Summary', '', '', 'Profit', '', '', '', bid.costs.profit],
        ['Summary', '', '', 'Contingency', '', '', '', bid.costs.contingency],
        ['Summary', '', '', 'Permit', '', '', '', bid.costs.permit],
        ['Summary', '', '', 'Design fee', '', '', '', bid.costs.design],
        ['Summary', '', '', 'Discount', '', '', '', bid.costs.discount],
        ['Summary', '', '', 'Pre-tax', '', '', '', bid.costs.preTax],
        ['Summary', '', '', 'Tax', '', '', '', bid.costs.tax],
        ['Summary', '', '', 'Total', '', '', '', bid.costs.total]
    ];
    summary.forEach((row) => rows.push(row.map(quote).join(',')));
    return rows.join('\n');
}

export function proposalText(bid) {
    const { config, costs, groups, schedule } = bid;
    const money = (value) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const lines = [];
    lines.push(`PROPOSAL ${config.project.reference}`);
    lines.push(`${config.project.name}`);
    lines.push('');
    lines.push(`Prepared for: ${config.project.client || '—'}`);
    lines.push(`Project address: ${config.project.address || '—'}`);
    lines.push(`Date: ${config.project.date} · Valid ${config.project.validityDays} days`);
    lines.push('');
    lines.push('SCOPE');
    lines.push(config.project.scope || 'Supply and install the work described in the schedules attached to this proposal.');
    lines.push('');
    groups.forEach((group) => {
        lines.push(`${group.label.toUpperCase()} — ${money(group.subtotal)}`);
        group.lines.slice(0, 12).forEach((line) => {
            lines.push(`  · ${line.description} — ${line.qty} ${line.unit} @ ${money(line.unitCost)} = ${money(line.total)}`);
        });
        if (group.lines.length > 12) lines.push(`  · … ${group.lines.length - 12} more lines in the attached schedule`);
        lines.push('');
    });
    lines.push('PRICE');
    lines.push(`  Base (materials and scheduled work)   ${money(costs.base)}`);
    lines.push(`  Overhead (${config.markup.overhead}%)                        ${money(costs.overhead)}`);
    lines.push(`  Profit (${config.markup.profit}%)                          ${money(costs.profit)}`);
    lines.push(`  Contingency (${config.markup.contingency}%)                   ${money(costs.contingency)}`);
    lines.push(`  Permit allowance                    ${money(costs.permit)}`);
    lines.push(`  Design and documentation            ${money(costs.design)}`);
    if (costs.discount) lines.push(`  Discount                            -${money(costs.discount)}`);
    lines.push(`  Sales tax                           ${money(costs.tax)}`);
    lines.push(`  CONTRACT TOTAL                      ${money(costs.total)}`);
    lines.push('');
    if (bid.alternates.length) {
        lines.push('ALTERNATES (not included in the contract total)');
        bid.alternates.forEach((line) => {
            lines.push(`  · ${line.description} — ${line.qty} ${line.unit} = ${money(line.total)}`);
        });
        lines.push('');
    }
    lines.push('PROGRESS BILLING');
    schedule.forEach((stage) => {
        lines.push(`  ${stage.label} (${stage.pct}%) — ${money(stage.amount)}`);
    });
    lines.push('');
    lines.push('INCLUSIONS AND EXCLUSIONS');
    lines.push('  · Allowance prices are for planning; supplier quotes replace them before the contract.');
    lines.push('  · Permits, inspections and utility fees are included only as the line items above.');
    lines.push('  · Concealed conditions, hazardous material and structural repairs are excluded.');
    lines.push('  · Work is scheduled on written acceptance and the deposit.');
    lines.push('');
    lines.push('Acceptance: ______________________________  Date: ______________');
    return lines.join('\n');
}

export function bidSummaryLines(bid) {
    if (!bid) return [];
    return [
        `${bid.counts.suites} suites · ${bid.counts.lines} priced lines`,
        `Base $${bid.costs.base.toFixed(0)} · overhead $${bid.costs.overhead.toFixed(0)} · profit $${bid.costs.profit.toFixed(0)}`,
        `Contingency $${bid.costs.contingency.toFixed(0)} · permit $${bid.costs.permit.toFixed(0)} · design $${bid.costs.design.toFixed(0)}`,
        `Tax $${bid.costs.tax.toFixed(0)} · total $${bid.costs.total.toFixed(0)}`,
        `Deposit ${bid.config.depositPct}% = $${bid.schedule[0].amount.toFixed(0)}`
    ];
}
