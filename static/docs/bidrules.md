# Bid and proposal rules (USA)

Guide for the **bid-builder**. These are commercial and contract conventions,
not building-code clauses. Deposit caps, tax treatment, lien law and contract
forms are set by the state, so confirm them before a proposal is signed.

## 1. Pricing structure

| Rule id | Requirement |
|---|---|
| `scope-definition` | Price a defined scope: name the drawings and schedules included and list the exclusions. |
| `allowances` | Label every allowance, say what it covers and how an overage is billed. |
| `markup` | Overhead 10–20% of base, profit 10–20% of base plus overhead, shown separately. |
| `contingency` | 5% minimum, 10%+ where the existing structure is unknown. |
| `alternates` | Price alternates separately and keep them out of the contract total until accepted. |

## 2. Contract and payment

| Rule id | Requirement |
|---|---|
| `deposit` | Keep the deposit inside the state cap (often 10–33%) and receipt it. |
| `progress-billing` | Bill against completed milestones, with the final payment at substantial completion. |
| `change-orders` | Every scope change is priced and signed before the work starts. |
| `validity` | State a 14–30 day validity period; re-price after expiry. |
| `warranty` | One-year workmanship warranty minimum, manufacturer warranties passed through. |

## 3. Scope and risk

| Rule id | Requirement |
|---|---|
| `exclusions` | Write down the exclusions: permits, engineering, hazardous material, structural repair, site access. |
| `tax` | Apply sales tax to the base the state requires (materials only unless labour is taxable). |
| `insurance` | General liability and workers’ compensation certificates, licence number on the proposal. |
| `permits` | Name who pulls the permit, include the fee, allow inspection time. |
| `lien-waivers` | Conditional waivers with each progress payment, unconditional at closing. |
| `record-keeping` | Keep the proposal, schedules, takeoffs, quotes and signed acceptance together. |

## 4. The arithmetic

```
base            Σ suite takeoffs + manual lines
overhead        base × overhead %
profit          (base + overhead) × profit %
contingency     base × contingency %
pre-tax total   base + overhead + profit + contingency + permit + design − discount
sales tax       tax base × tax %          (materials only unless labour is taxable)
contract total  pre-tax total + tax
gross margin    (overhead + profit) ÷ pre-tax total      target 15–30%
progress        total × stage %  (deposit / rough-in / final)
```

## 5. How the harvest works

The builder does not store a second copy of any price. It reads each designer's
saved draft from browser storage and re-runs that suite's own engine. The
`*-editor-draft` keys are versioned by `core/drafts.js` (`{ version, savedAt, data }`,
old unversioned payloads still accepted) and the harvest unwraps them through that
module with `consume: false`, so reading a draft here never steals it from the studio:

| Suite | Draft key | Rebuilt with |
|---|---|---|
| Deck | `deck-editor-draft`, `deck-suite-draft` | `computeDeckDesign` |
| Electrical | `electrical-editor-draft`, `electrical-suite-draft` | `computeElectricalDesign` |
| Landscape | `landscape-suite-plan` | `designLandscape` |
| Lighting | `lighting-suite-plan` | `designLighting` |
| Plumbing | `plumbing-suite-plan` | `designPlumbing` |
| Roof | `roof-suite-draft` | `computeRoofDesign` |
| Wall | `wall-suite-draft` | `computeWallDesign` |
| Stairs | `stair-designer-draft` | quantities only: the stair designer has no priced takeoff |

A missing draft is reported as a missing source rather than guessed at. The
stair designer contributes quantities, so its priced lines have to be added
manually or carried by the framing takeoff.

## 6. Issue checklist

1. Every suite you are pricing shows a saved design.
2. Allowances refreshed against supplier quotes.
3. Markup and contingency produce a 15–30% gross margin.
4. Tax applied to the correct base for the state.
5. Deposit inside the state cap and in the contract.
6. Progress billing tied to milestones, not dates.
7. Alternates listed separately and excluded from the total.
8. Exclusions, warranty and validity stated on the proposal.
9. Permits and inspections priced and assigned.
10. Signed acceptance and lien waivers filed with the bid.

## 7. Source links

- Consumer home-improvement contract rules vary by state: check the state
  contractor licensing board (for example https://www.nahb.org/).
- Sales tax on construction: https://www.streamlinedsalestax.org/
- Lien law by state: https://www.nolo.com/legal-encyclopedia/mechanics-liens
- Contracts and change orders: https://www.constructionlawyer.org/
