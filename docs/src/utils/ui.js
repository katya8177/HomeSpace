export function createRoundedRectButton(scene, options) {
    const {
        x,
        y,
        width,
        height,
        radius = 12,
        fillColor = 0x07488d,
        hoverFillColor = 0x6fe3b5,
        text = '',
        textStyle = {},
        onClick
    } = options;
    
    const container = scene.add.container(x, y);
    
    const bg = scene.add.graphics();
    const draw = (color) => {
        bg.clear();
        bg.fillStyle(color, 1);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    };
    draw(fillColor);
    
    const label = scene.add.text(0, 0, text, {
        fontSize: '24px',
        fill: '#fafafa',
        fontStyle: 'bold',
        ...textStyle
    }).setOrigin(0.5);
    
    const hit = scene.add.zone(0, 0, width, height)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
    
    hit.on('pointerover', () => draw(hoverFillColor));
    hit.on('pointerout', () => draw(fillColor));
    if (typeof onClick === 'function') {
        hit.on('pointerdown', onClick);
    }
    
    container.add([bg, label, hit]);
    
    // Удобно возвращать и контейнер, и методы
    container.setData('setFill', (color) => draw(color));
    container.setData('setText', (t) => label.setText(t));
    
    return container;
}

export function createRoundedTextButton(scene, options) {
    const {
        x,
        y,
        paddingX = 16,
        paddingY = 10,
        radius = 14,
        fillColor = 0x07488d,
        hoverFillColor = 0x6fe3b5,
        text = '',
        textStyle = {},
        onClick
    } = options;
    
    const label = scene.add.text(0, 0, text, {
        fontSize: '18px',
        fill: '#fafafa',
        fontStyle: 'bold',
        ...textStyle
    }).setOrigin(0.5);
    
    const w = label.width + paddingX * 2;
    const h = label.height + paddingY * 2;
    
    const container = scene.add.container(x, y);
    const bg = scene.add.graphics();
    const draw = (color) => {
        bg.clear();
        bg.fillStyle(color, 1);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    };
    draw(fillColor);
    
    const hit = scene.add.zone(0, 0, w, h)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
    
    hit.on('pointerover', () => draw(hoverFillColor));
    hit.on('pointerout', () => draw(fillColor));
    if (typeof onClick === 'function') {
        hit.on('pointerdown', onClick);
    }
    
    container.add([bg, label, hit]);
    container.setData('setFill', (color) => draw(color));
    container.setData('setText', (t) => label.setText(t));
    
    return container;
}

