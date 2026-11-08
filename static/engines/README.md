# Vendored engines

These files are copied verbatim from floorplan_3d (`E:\floorplan_3d\features\...`)
and are not edited here. Their relative imports resolve exactly as they do
upstream, which is why the directory layout has to match the source tree.

`static/engines-bridge.js` is the only code in this repo that adapts them to the
studio; the readme's "Engines from floorplan_3d" section says what each one
computes.

## Re-copying after an upstream change

From this repo's root, with the upstream tree on `E:`:

```bash
proj=$(pwd -W)
cd /e/floorplan_3d && cp --parents \
  $(cd "$proj/static/engines" && find core engine features scene -name '*.js') \
  "$proj/static/engines/"
```

Then check that nothing drifted — every mirrored file should be byte-identical:

```bash
cd static/engines
find core engine features scene -name '*.js' | while read -r f; do
  cmp -s "$f" "/e/floorplan_3d/$f" || echo "DIFF $f"
done
```

The stair and elevation modules import `three`; only the browser can resolve
that, through the `import map` in `static/index.html`. `scene-gizmo.js` also
imports `three/addons/controls/TransformControls.js`, which is vendored at
`static/vendor/three/addons/controls/` from the same three r160 build — copy it
from `E:\floorplan_3d\vendor\three\addons\controls\` if three is ever bumped. `outputs/scripts/probe-extra.mjs` covers every
DOM-free adapter in Node, and `tools/ui-check.mjs` covers the stair screens in
headless Chrome.

A re-copy can add a module an engine now imports (`validateFeatureModules` in
`tests/` does the same thing for the upstream tree). The smoke script
`outputs/scripts/probe-bridge.mjs` imports every mirrored entry point and calls the
bridge, so a missing dependency shows up there first.
