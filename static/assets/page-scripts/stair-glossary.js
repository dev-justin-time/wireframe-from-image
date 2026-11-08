        const TERMS = [
            { term: 'Alternating tread staircase', text: 'Staggered L-shaped steps either side of a centre line, so the user ascends by alternating feet. Saves plan space and allows a steeper slope while keeping a comfortable step depth.' },
            { term: 'Angle', text: 'Slope of the flight, measured from horizontal. A stair must be between 20° and 50°; the ideal value is 30–35°.' },
            { term: 'Balancing', text: 'Gradually turning the treads through a turn so the going changes evenly. It improves comfort, safety and the look of a turned stair, and increases the contact surface with the interior stringer.' },
            { term: 'Blondel\u2019s law', text: 'G + 2H = 590 to 650 mm (23.2 to 25.6 in), ideal 630 mm (24.8 in). It verifies the consistency between step height and going; named for François Blondel (1618–1686).' },
            { term: 'Flight', text: 'A series of steps between two landings.' },
            { term: 'Floor opening', text: 'The opening in the upper floor that lets the staircase through.' },
            { term: 'Going', text: 'Horizontal distance between two consecutive step nosings. Must be 230–330 mm (9–13 in); ideal 280 mm (11 in).' },
            { term: 'Half-turn staircase', text: 'A stair with two 90° turns, so the direction reverses over 180°.' },
            { term: 'Headroom', text: 'Distance between the ceiling at the floor opening and the walkline. Must be greater than 1900 mm (75 in); ideal at least 2100 mm (83 in).' },
            { term: 'Height', text: 'Vertical distance between the lower floor and the upper floor.' },
            { term: 'Landing', text: 'A horizontal surface wider than the usual steps, for a rest or a change of direction.' },
            { term: 'Landing step', text: 'Optional step in the extension of the upper floor. It gives an overlap on the last step, makes the stringer and handrail connection easier, and can hide the fixing plate.' },
            { term: 'Overlap', text: 'The part of a step covered by the step above. It improves comfort; 40–50 mm is ideal.' },
            { term: 'Quarter-turn staircase', text: 'A stair with one 90° turn.' },
            { term: 'Riser', text: 'The vertical part connecting two consecutive steps.' },
            { term: 'Spiral staircase', text: 'A helical stair whose steps radiate around a central axis.' },
            { term: 'Stair width', text: 'Usable width of the stair. Must be greater than 700 mm (28 in); ideal at least 800 mm (32 in).' },
            { term: 'Step', text: 'The horizontal surface on which the foot is placed.' },
            { term: 'Step height', text: 'Vertical distance between two consecutive step nosings. Must be 150–200 mm (6–8 in); ideal 175 mm (7 in).' },
            { term: 'Step nosing', text: 'The overhanging front edge of a step.' },
            { term: 'Straight staircase', text: 'A staircase without a change in direction.' },
            { term: 'Stringer', text: 'The member that holds the staircase steps.' },
            { term: 'Total run', text: 'Horizontal distance between the nosing of the first step and the upper-floor nosing: steps × going + landing step.' },
            { term: 'Walkline', text: 'A fictitious line tracing the user\u2019s path; the going of a turning stair is measured on it. At 1 m wide or less it runs up the middle; wider than 1 m it sits 500 mm (20 in) from the interior handrail.' }
        ];

        const FORMULAS = [
            { name: 'Steps and risers', formula: 'steps = round(H ÷ 175) − 1 · risers = steps + 1', example: '16 steps · 17 risers' },
            { name: 'Step height', formula: 'h = H ÷ (steps + 1)', example: '176.47 mm' },
            { name: 'Blondel\u2019s law', formula: 'G + 2h = 590…650 (ideal 630)', example: '277.06 + 2 × 176.47 = 630 mm' },
            { name: 'Going', formula: 'G = B − 2h   or   G = (L − landing step) ÷ steps', example: '277.06 mm' },
            { name: 'Step depth', formula: 'd = G + overlap', example: '322.06 → 320 mm' },
            { name: 'Overlap', formula: 'overlap = d − G', example: '42.94 mm' },
            { name: 'Landing step', formula: 'landing step ≥ overlap, up to the next 10 mm', example: '50 mm' },
            { name: 'Angle', formula: 'θ = arctan(h ÷ G)', example: '32.49°' },
            { name: 'Total run', formula: 'L = steps × G + landing step', example: '4482.96 mm' },
            { name: 'Headroom', formula: 'tan(θ) × (floor opening − landing step) − floor thickness', example: '1947.45 mm' }
        ];

        const grid = document.getElementById('glossary-grid');
        const count = document.getElementById('glossary-count');
        const empty = document.getElementById('glossary-empty');

        grid.innerHTML = TERMS.map((entry) => `
            <article class="term-card rounded-xl border border-slate-200 bg-white p-3" data-term="${entry.term.toLowerCase()}">
                <h3 class="text-[12px] font-bold text-slate-900">${entry.term}</h3>
                <p class="text-[11px] text-slate-600 mt-1 leading-relaxed">${entry.text}</p>
            </article>`).join('');

        function filter(query = '') {
            const needle = String(query).trim().toLowerCase();
            let shown = 0;
            grid.querySelectorAll('.term-card').forEach((card) => {
                const haystack = `${card.dataset.term} ${card.textContent}`.toLowerCase();
                const match = !needle || haystack.includes(needle);
                card.hidden = !match;
                if (match) shown += 1;
            });
            count.textContent = needle ? `${shown} of ${TERMS.length} terms` : `${TERMS.length} terms`;
            empty.classList.toggle('hidden', shown !== 0);
            return shown;
        }

        document.getElementById('glossary-search').addEventListener('input', (event) => filter(event.target.value));

        document.getElementById('formula-list').innerHTML = FORMULAS.map((entry, index) => `
            <div class="grid sm:grid-cols-[1.1fr_1.4fr_1fr] gap-1 sm:gap-3 px-4 py-2.5 text-[11px]">
                <span class="font-semibold text-slate-800"><span class="text-slate-400 font-mono mr-1">${String(index + 1).padStart(2, '0')}</span>${entry.name}</span>
                <span class="font-mono text-sky-800">${entry.formula}</span>
                <span class="font-mono text-slate-500">${entry.example}</span>
            </div>`).join('');

        filter('');

        // Small API for the headless checks.
        window.stairGlossary = {
            terms: TERMS.length,
            formulas: FORMULAS.length,
            filter,
            termsList: TERMS.map((entry) => entry.term)
        };
