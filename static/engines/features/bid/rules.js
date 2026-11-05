/**
 * Commercial rules for the bid and proposal builder.
 *
 * These are not building-code clauses: they are the contract and pricing
 * conventions a residential package needs, drawn from common practice and from
 * the consumer-protection rules most states apply to home-improvement
 * contracts. Contracts, licensing and lien law are state-specific.
 */

export const RULE_CATEGORIES = [
    { id: 'pricing', label: 'Pricing structure' },
    { id: 'contract', label: 'Contract & payment' },
    { id: 'scope', label: 'Scope & exclusions' },
    { id: 'risk', label: 'Risk & compliance' }
];

export const RULES = [
    {
        id: 'scope-definition',
        category: 'scope',
        title: 'Define the scope before the price',
        summary: 'A proposal prices a defined scope. Name the drawings, schedules and specifications it includes, and list what is excluded, so the price cannot be read as an all-in promise.',
        requirements: [
            'Reference the drawings and the schedules attached to the proposal.',
            'List the exclusions explicitly.',
            'State who supplies and installs each trade.',
            'Tie the price to the quantities actually measured.'
        ]
    },
    {
        id: 'allowances',
        category: 'pricing',
        title: 'Label every allowance',
        summary: 'Suite prices are planning allowances. Mark them as allowances, name what they cover, and say how an overage is billed.',
        requirements: [
            'Call out allowance lines in the proposal.',
            'State how the allowance is adjusted against the invoice.',
            'Do not bury an allowance inside a fixed price.',
            'Refresh allowances from supplier quotes before signature.'
        ]
    },
    {
        id: 'markup',
        category: 'pricing',
        title: 'Overhead and profit on cost',
        summary: 'Overhead recovers the cost of being in business; profit is the return on the work. Apply profit after overhead so the margin is not diluted.',
        requirements: [
            'Overhead 10–20% of the base for residential work.',
            'Profit 10–20% of base plus overhead.',
            'Keep the two separate on the proposal.',
            'Check the gross margin, not just the markup.'
        ]
    },
    {
        id: 'contingency',
        category: 'pricing',
        title: 'Contingency 5–10%',
        summary: 'Concealed conditions are normal in renovation. A 5–10% contingency on the base keeps the job solvent without a change order for every surprise.',
        requirements: [
            'Carry 5% minimum on a straightforward job.',
            'Carry 10%+ where the existing structure is unknown.',
            'State what the contingency covers.',
            'Return the unused contingency or disclose it as profit.'
        ]
    },
    {
        id: 'tax',
        category: 'risk',
        title: 'Sales tax on the right base',
        summary: 'Most states tax materials and sometimes labour. Apply tax to the base your state requires and show it as its own line.',
        requirements: [
            'Confirm whether labour is taxable in the state.',
            'Tax the material base, not the profit.',
            'Show tax separately on the proposal.',
            'Keep resale or exemption certificates on file.'
        ]
    },
    {
        id: 'deposit',
        category: 'contract',
        title: 'Deposit within the state limit',
        summary: 'Many states cap the deposit on a home-improvement contract. Keep it in writing, receipt it, and never take the full contract value up front.',
        requirements: [
            'Check the state deposit cap (often 10–33%).',
            'Put the deposit in the written contract.',
            'Receipt every payment.',
            'Do not start work without the deposit cleared.'
        ]
    },
    {
        id: 'progress-billing',
        category: 'contract',
        title: 'Progress billing against milestones',
        summary: 'Bill against completed milestones, not calendar dates, and keep the final payment large enough to cover punch-list work.',
        requirements: [
            'Milestones in the contract, not just percentages.',
            'Final payment at substantial completion.',
            'Hold retainage where the contract allows.',
            'Invoice with the schedule and photos attached.'
        ]
    },
    {
        id: 'change-orders',
        category: 'contract',
        title: 'Written change orders only',
        summary: 'Any change to the scope is priced and signed before the work is done. An unsigned change is a dispute waiting to happen.',
        requirements: [
            'Price the change against the same markup structure.',
            'Sign before the work starts.',
            'Reference the original proposal number.',
            'Update the schedule with the change.'
        ]
    },
    {
        id: 'validity',
        category: 'contract',
        title: 'Proposal validity period',
        summary: 'Material prices move. State how long the proposal stands, typically 14–30 days, and what happens after that.',
        requirements: [
            'State the validity period on the face of the proposal.',
            'Re-price after expiry.',
            'Note any supplier price-hold conditions.',
            'Do not let an old proposal be accepted silently.'
        ]
    },
    {
        id: 'alternates',
        category: 'pricing',
        title: 'Price alternates separately',
        summary: 'Alternates let the client choose without reopening the whole proposal. Price them as add or deduct lines and keep them out of the contract total until accepted.',
        requirements: [
            'List each alternate with its own price.',
            'Exclude alternates from the contract total.',
            'State the acceptance deadline.',
            'Carry the chosen alternate into a change order.'
        ]
    },
    {
        id: 'exclusions',
        category: 'scope',
        title: 'Write the exclusions down',
        summary: 'Permits, engineering, hazardous material, structural repair, utility upgrades and site access are the usual surprises. Say which are excluded.',
        requirements: [
            'List permit and inspection responsibility.',
            'Exclude hazardous material abatement.',
            'Exclude concealed structural repair.',
            'State site access, storage and power assumptions.'
        ]
    },
    {
        id: 'insurance',
        category: 'risk',
        title: 'Insurance and licensing',
        summary: 'Carry general liability and workers’ compensation, and hold the licence the state requires. Clients increasingly ask for certificates before signing.',
        requirements: [
            'Current general liability certificate.',
            'Workers’ compensation where required.',
            'State licence number on the proposal.',
            'Subcontractor certificates on file.'
        ]
    },
    {
        id: 'permits',
        category: 'risk',
        title: 'Permits and inspections',
        summary: 'Decks, pools, electrical services and structural work usually need a permit. Price the permit and the inspection time, and name who pulls it.',
        requirements: [
            'State who pulls the permit.',
            'Include the permit fee as a line item.',
            'Allow for inspection scheduling.',
            'Do not start permitted work before the permit is issued.'
        ]
    },
    {
        id: 'lien-waivers',
        category: 'risk',
        title: 'Lien waivers at each payment',
        summary: 'Collect conditional lien waivers from every supplier and subcontractor as payments are made, so the owner is protected at closing.',
        requirements: [
            'Conditional waiver with each progress payment.',
            'Final unconditional waiver at closing.',
            'Match waivers to the payment amount.',
            'Keep them with the contract file.'
        ]
    },
    {
        id: 'warranty',
        category: 'contract',
        title: 'Warranty and call-back',
        summary: 'State the workmanship warranty and pass through the manufacturer’s product warranty. A clear call-back policy prevents most complaints.',
        requirements: [
            'Workmanship warranty of at least one year.',
            'Pass through manufacturer warranties in writing.',
            'State the call-back response time.',
            'Keep a punch-list close-out process.'
        ]
    },
    {
        id: 'record-keeping',
        category: 'risk',
        title: 'Keep the bid file',
        summary: 'Keep the proposal, the schedules, the takeoffs, the supplier quotes and the signed acceptance together, so the price can be defended line by line.',
        requirements: [
            'Archive the CSV export with the proposal.',
            'Keep supplier quotes used for each allowance.',
            'Store the signed acceptance and change orders.',
            'Keep the file for the state’s limitation period.'
        ]
    }
];

export const FORMULAS = [
    { label: 'Base', expression: 'Σ suite takeoffs + manual lines', note: 'Every priced line the suites produced.' },
    { label: 'Overhead', expression: 'base × overhead %', note: 'Recovers fixed business cost.' },
    { label: 'Profit', expression: '(base + overhead) × profit %', note: 'Applied after overhead.' },
    { label: 'Contingency', expression: 'base × contingency %', note: '5–10% for concealed conditions.' },
    { label: 'Pre-tax total', expression: 'base + overhead + profit + contingency + permit + design − discount', note: 'The contract value before tax.' },
    { label: 'Sales tax', expression: 'tax base × tax %', note: 'Materials only unless the state taxes labour.' },
    { label: 'Contract total', expression: 'pre-tax total + tax', note: 'What the client signs.' },
    { label: 'Gross margin', expression: '(overhead + profit) ÷ pre-tax total', note: 'Target 15–30% on residential work.' },
    { label: 'Progress billing', expression: 'total × stage % (deposit / rough-in / final)', note: 'Milestones in the contract, not dates.' }
];

export const GLOSSARY = [
    { term: 'Base cost', category: 'Pricing', short: 'The measured cost of the work before markup.', detail: 'Built from every suite takeoff plus manual lines. It is the number the markup percentages apply to.' },
    { term: 'Overhead', category: 'Pricing', short: 'The cost of running the business, spread over the job.', detail: 'Insurance, vehicles, office, tools and supervision. Usually 10–20% of the base for residential work.' },
    { term: 'Profit', category: 'Pricing', short: 'The return the contractor keeps after overhead.', detail: 'Applied on base plus overhead, typically 10–20%. The gross margin is profit plus overhead over the contract.' },
    { term: 'Contingency', category: 'Pricing', short: 'Money held for unforeseen site conditions.', detail: '5% on a clear job, 10%+ where structure or services are unknown. Disclose what happens to the unused balance.' },
    { term: 'Allowance', category: 'Pricing', short: 'A planning price for a product not yet selected.', detail: 'Label it, say what it covers, and describe how the invoice reconciles against it.' },
    { term: 'Alternate', category: 'Pricing', short: 'An optional scope priced separately from the base.', detail: 'Excluded from the contract total until accepted, then carried in by change order.' },
    { term: 'Change order', category: 'Contract', short: 'A signed amendment to the scope and price.', detail: 'Priced with the same markup structure and signed before the extra work starts.' },
    { term: 'Deposit', category: 'Contract', short: 'The payment on acceptance that releases materials.', detail: 'Capped by many states; put it in the contract and receipt it.' },
    { term: 'Retainage', category: 'Contract', short: 'A percentage held back until completion.', detail: 'Common on larger contracts; release it at substantial completion or the end of the punch list.' },
    { term: 'Substantial completion', category: 'Contract', short: 'When the work is usable for its intended purpose.', detail: 'Triggers the final payment and starts the warranty and punch-list clock.' },
    { term: 'Lien waiver', category: 'Risk', short: 'A supplier’s or subcontractor’s release of lien rights for a payment.', detail: 'Conditional with each progress payment, unconditional at closing.' },
    { term: 'Punch list', category: 'Contract', short: 'The short list of incomplete or defective items at handover.', detail: 'Close it in writing before the final payment is released.' },
    { term: 'Validity', category: 'Contract', short: 'How long the proposal price stands.', detail: '14–30 days is typical; material prices and subcontractor quotes move quickly.' },
    { term: 'Gross margin', category: 'Pricing', short: 'The share of the contract left after direct cost.', detail: 'Different from markup: a 15% markup on cost is about a 13% margin. Watch the margin, not the markup.' }
];
