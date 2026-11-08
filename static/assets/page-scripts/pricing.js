import { SharedViewer } from '../../scene/SharedViewer.js';

document.addEventListener('DOMContentLoaded', () => {
    const viewer = new SharedViewer();
    viewer.init('shared-viewer-container');
});
