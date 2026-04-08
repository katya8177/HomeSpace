// src/utils/sceneUi.js

export function createDisposables() {
    const fns = [];
    return {
        add(fn) {
            if (typeof fn === 'function') fns.push(fn);
            return fn;
        },
        run() {
            while (fns.length) {
                const fn = fns.pop();
                try { fn(); } catch { /* noop */ }
            }
        }
    };
}

export function createNotificationManager(scene, opts = {}) {
    const {
        startY = 90,
        spacing = 10,
        duration = 2200,
        maxVisible = 3,
        depth = 3000
    } = opts;

    const items = [];

    function layout() {
        const cam = scene.cameras.main;
        const cx = cam.width / 2;
        let y = startY;
        for (const it of items) {
            if (!it?.text || it.text.destroyed) continue;
            it.text.setPosition(cx, y);
            y += it.text.height + spacing;
        }
    }

    function dismiss(it) {
        if (!it || it.dismissing) return;
        it.dismissing = true;
        if (!it.text || it.text.destroyed) return;

        scene.tweens.add({
            targets: it.text,
            y: it.text.y - 20,
            alpha: 0,
            duration: 250,
            onComplete: () => {
                if (it.text && !it.text.destroyed) it.text.destroy();
                const idx = items.indexOf(it);
                if (idx !== -1) items.splice(idx, 1);
                layout();
            }
        });
    }

    function show(message, type = 'info', custom = {}) {
        const cam = scene.cameras.main;

        const colors = {
            success: '#4ecca3',
            error: '#e94560',
            warning: '#ffd700',
            info: '#0865fa'
        };

        const bg = custom.color || colors[type] || colors.info;
        const ttl = typeof custom.duration === 'number' ? custom.duration : duration;

        const text = scene.add.text(cam.width / 2, startY, message, {
            fontSize: custom.fontSize || '16px',
            fill: '#ffffff',
            backgroundColor: bg,
            padding: { x: 16, y: 10 }
        }).setOrigin(0.5).setDepth(depth);

        const it = { text, dismissAt: scene.time.now + ttl, dismissing: false };
        items.unshift(it);

        // Ограничение видимых
        while (items.length > maxVisible) {
            dismiss(items[items.length - 1]);
        }

        layout();

        it.timer = scene.time.delayedCall(ttl, () => dismiss(it));

        // Можно закрыть кликом
        text.setInteractive({ useHandCursor: true });
        text.on('pointerdown', () => dismiss(it));

        return it;
    }

    function destroy() {
        for (const it of items.splice(0, items.length)) {
            try { it.timer?.remove(false); } catch { /* noop */ }
            if (it.text && !it.text.destroyed) it.text.destroy();
        }
    }

    return { show, destroy };
}

export function createScrollArea(scene, config) {
    const {
        x,
        y,
        width,
        height,
        content,
        wheelStep = 60,
        clampPadding = 10
    } = config;

    // Mask rect
    const maskGfx = scene.make.graphics({ x: 0, y: 0, add: false });
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(x, y, width, height);
    const mask = maskGfx.createGeometryMask();
    maskGfx.destroy();

    content.setMask(mask);

    const state = {
        scrollY: 0,
        contentHeight: 0
    };

    function computeContentHeight() {
        const bounds = content.getBounds();
        state.contentHeight = Math.max(height, bounds.height + clampPadding * 2);
    }

    function clampScroll() {
        computeContentHeight();
        const maxScroll = Math.max(0, state.contentHeight - height);
        state.scrollY = Math.min(maxScroll, Math.max(0, state.scrollY));
        content.y = y - state.scrollY;
    }

    // Hit area for wheel
    const hit = scene.add.zone(x, y, width, height).setOrigin(0, 0).setInteractive();

    const wheelHandler = (pointer, gameObjects, dx, dy) => {
        // Только когда курсор над областью
        if (!hit.input?.enabled) return;
        const over = Phaser.Geom.Rectangle.Contains(hit.getBounds(), pointer.x, pointer.y);
        if (!over) return;

        state.scrollY += Math.sign(dy) * wheelStep;
        clampScroll();
    };

    scene.input.on('wheel', wheelHandler);

    // Initial clamp
    clampScroll();

    function destroy() {
        try { scene.input.off('wheel', wheelHandler); } catch { /* noop */ }
        try { hit.destroy(); } catch { /* noop */ }
        try { content.clearMask(true); } catch { /* noop */ }
    }

    return {
        hit,
        clampScroll,
        setScrollY(v) {
            state.scrollY = v;
            clampScroll();
        },
        getScrollY() { return state.scrollY; },
        getMaxScroll() {
            computeContentHeight();
            return Math.max(0, state.contentHeight - height);
        },
        destroy
    };
}

