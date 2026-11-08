/**
 * Comment pins for the plan canvas. Comments are stored in plan pixels (the
 * space the canvas draws in), so the pins pan and zoom with the drawing.
 */
export function drawComments(ctx, comments = [], { selectedId = null } = {}) {
    if (!comments.length) return;

    ctx.save();
    comments.forEach((comment) => {
        if (!comment || comment.resolved) return;
        const x = comment.x;
        const y = comment.y;
        const color = comment.author?.color || '#f59e0b';

        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(x, y, selectedId === comment.id ? 9 : 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((comment.author?.name || '?').slice(0, 1).toUpperCase(), x, y);

        if (selectedId === comment.id) {
            const text = String(comment.text || '').slice(0, 40);
            ctx.font = '10px Inter, sans-serif';
            const width = ctx.measureText(text).width + 12;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.fillRect(x + 12, y - 10, width, 20);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(text, x + 18, y);
        }
    });
    ctx.restore();
}
