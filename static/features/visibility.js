/**
 * Per-item visibility.
 *
 * `Item.visible` is the model flag; everything that renders or interacts with a
 * plan object goes through these helpers so "hidden" means the same thing
 * everywhere (not drawn in 3D, ghosted in plan, not draggable).
 */

export function isVisible(item) {
    return item?.visible !== false;
}

export function setVisible(item, visible) {
    if (!item) return false;
    item.visible = Boolean(visible);
    return item.visible;
}

export function toggleVisible(item) {
    return setVisible(item, !isVisible(item));
}

export function visibleItems(items = []) {
    return items.filter(isVisible);
}

export function hiddenCount(items = []) {
    return items.reduce((count, item) => count + (isVisible(item) ? 0 : 1), 0);
}
