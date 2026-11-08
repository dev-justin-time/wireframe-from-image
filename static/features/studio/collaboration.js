/**
 * Studio feature 43 - presence and comments.
 *
 * Neither belongs in the undoable project state, so this module owns its own
 * store: comments in localStorage per project, presence over BroadcastChannel
 * (same browser, any tab). The shape is deliberately transport-agnostic - swap
 * `channelFactory` for a WebSocket wrapper and the editor code does not change.
 */

const COMMENT_PREFIX = 'floorplan3d_comments_';
const PRESENCE_TTL = 12_000;
const CURSOR_INTERVAL = 120;

const memory = new Map();

function storageOf(storage) {
    if (storage) return storage;
    if (typeof localStorage !== 'undefined') return localStorage;
    return {
        getItem: (key) => (memory.has(key) ? memory.get(key) : null),
        setItem: (key, value) => memory.set(key, String(value)),
        removeItem: (key) => memory.delete(key)
    };
}

const colors = ['#13a4ec', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#0ea5e9'];

export function createCollaboration({
    projectId = 'default',
    user = null,
    storage = null,
    channelFactory = null,
    now = () => Date.now()
} = {}) {
    const store = storageOf(storage);
    const commentsKey = `${COMMENT_PREFIX}${projectId}`;
    const peers = new Map();
    const listeners = new Set();
    let lastCursorAt = 0;
    let disposed = false;

    const me = {
        id: user?.id || `user_${Math.random().toString(36).slice(2, 8)}`,
        name: user?.name || 'Designer',
        color: user?.color || colors[Math.floor(Math.random() * colors.length)]
    };

    const readComments = () => {
        try {
            const parsed = JSON.parse(store.getItem(commentsKey) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    };

    const writeComments = (comments) => {
        store.setItem(commentsKey, JSON.stringify(comments));
        emit({ type: 'comments' });
    };

    let channel = null;
    try {
        channel = channelFactory ? channelFactory(projectId) : (
            typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`floorplan3d_${projectId}`) : null
        );
    } catch {
        channel = null;
    }

    function emit(event) {
        listeners.forEach((listener) => {
            try {
                listener(event);
            } catch (error) {
                console.warn('collaboration listener failed', error);
            }
        });
    }

    function prunePeers() {
        const cutoff = now() - PRESENCE_TTL;
        let changed = false;
        peers.forEach((peer, id) => {
            if (peer.at < cutoff) {
                peers.delete(id);
                changed = true;
            }
        });
        if (changed) emit({ type: 'presence' });
    }

    if (channel) {
        channel.addEventListener('message', (event) => {
            const message = event.data;
            if (!message || message.from === me.id) return;

            if (message.type === 'presence') {
                peers.set(message.from, {
                    id: message.from,
                    name: message.user?.name || 'Guest',
                    color: message.user?.color || '#94a3b8',
                    cursor: message.cursor || null,
                    at: now()
                });
                emit({ type: 'presence' });
            } else if (message.type === 'hello') {
                announce();
                peers.set(message.from, {
                    id: message.from,
                    name: message.user?.name || 'Guest',
                    color: message.user?.color || '#94a3b8',
                    cursor: message.cursor || null,
                    at: now()
                });
                emit({ type: 'presence' });
            } else if (message.type === 'comments') {
                emit({ type: 'comments' });
            } else if (message.type === 'bye') {
                peers.delete(message.from);
                emit({ type: 'presence' });
            }
        });
    }

    function announce(cursor = null) {
        if (!channel) return;
        channel.postMessage({
            type: 'presence',
            from: me.id,
            user: { name: me.name, color: me.color },
            cursor,
            at: now()
        });
    }

    const heartbeat = setInterval(() => {
        prunePeers();
        announce();
    }, 5000);

    announce();

    return {
        me,
        get online() {
            prunePeers();
            return peers.size + 1;
        },
        peers() {
            prunePeers();
            return [...peers.values()];
        },
        comments() {
            return readComments();
        },
        addComment({ x = 0, y = 0, text = '', category = 'note', author = null } = {}) {
            const trimmed = String(text || '').trim();
            if (!trimmed) return null;

            const comment = {
                id: `comment_${now()}_${Math.random().toString(36).slice(2, 6)}`,
                x,
                y,
                text: trimmed,
                category,
                author: author || { id: me.id, name: me.name, color: me.color },
                createdAt: now(),
                resolved: false
            };
            writeComments([...readComments(), comment]);
            channel?.postMessage({ type: 'comments', from: me.id });
            return comment;
        },
        resolveComment(id, resolved = true) {
            const comments = readComments().map((comment) => (
                comment.id === id ? { ...comment, resolved } : comment
            ));
            writeComments(comments);
            channel?.postMessage({ type: 'comments', from: me.id });
            return comments.find((comment) => comment.id === id) || null;
        },
        removeComment(id) {
            writeComments(readComments().filter((comment) => comment.id !== id));
            channel?.postMessage({ type: 'comments', from: me.id });
        },
        setCursor(cursor) {
            const timestamp = now();
            if (timestamp - lastCursorAt < CURSOR_INTERVAL) return;
            lastCursorAt = timestamp;
            announce(cursor);
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        status() {
            return {
                projectId,
                online: peers.size + 1,
                peers: [...peers.values()],
                comments: readComments().length,
                transport: channel ? 'broadcast-channel' : 'local'
            };
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            clearInterval(heartbeat);
            channel?.postMessage({ type: 'bye', from: me.id });
            channel?.close?.();
            listeners.clear();
        }
    };
}
