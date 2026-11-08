        function toggleCategory(id) {
            const el = document.getElementById(id);
            const icon = document.getElementById(id + '-icon');
            if (el.classList.contains('hidden')) {
                el.classList.remove('hidden');
                el.classList.add('grid');
                icon.innerHTML = 'expand_more';
            } else {
                el.classList.add('hidden');
                el.classList.remove('grid');
                icon.innerHTML = 'chevron_right';
            }
        }
