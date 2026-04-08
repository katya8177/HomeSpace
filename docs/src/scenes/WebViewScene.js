// src/scenes/WebViewScene.js
export class WebViewScene extends Phaser.Scene {
    constructor() {
        super('WebViewScene');
        this.container = null;
        this.originalCanvasStyle = null;
    }
    
    create(data) {
        const { width, height } = this.cameras.main;
        const { page, title } = data;
        
        // Сохраняем оригинальные стили canvas
        const canvas = document.querySelector('canvas');
        if (canvas) {
            this.originalCanvasStyle = canvas.style.cssText;
            canvas.style.opacity = '0.3';
        }
        
        // Создаём полноэкранный div поверх всего
        const overlay = document.createElement('div');
        overlay.id = 'webview-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            animation: fadeIn 0.2s ease;
        `;
        
        // Верхняя панель
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            background: linear-gradient(135deg, #0f0f1a, #1a1a2e);
            border-bottom: 1px solid #4ecca3;
        `;
        
        const titleEl = document.createElement('div');
        titleEl.style.cssText = `
            color: #ffd700;
            font-size: 20px;
            font-weight: bold;
            font-family: 'Inter', sans-serif;
        `;
        titleEl.textContent = title || page;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            background: #e94560;
            border: none;
            color: white;
            font-size: 24px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.2s ease;
        `;
        closeBtn.onmouseover = () => closeBtn.style.transform = 'scale(1.1)';
        closeBtn.onmouseout = () => closeBtn.style.transform = 'scale(1)';
        closeBtn.onclick = () => this.closeWebView();
        
        header.appendChild(titleEl);
        header.appendChild(closeBtn);
        
        // Контейнер для iframe
        const iframeContainer = document.createElement('div');
        iframeContainer.style.cssText = `
            flex: 1;
            width: 100%;
            overflow: auto;
            background: #1a1a2e;
        `;
        
        const iframe = document.createElement('iframe');
        iframe.src = `/${page}.html`;
        iframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            background: #1a1a2e;
        `;
        
        iframeContainer.appendChild(iframe);
        overlay.appendChild(header);
        overlay.appendChild(iframeContainer);
        
        // Добавляем стили для анимации
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(overlay);
        
        this.overlay = overlay;
        this.iframe = iframe;
        this.style = style;
        
        // Обработка ESC
        this.escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeWebView();
            }
        };
        document.addEventListener('keydown', this.escHandler);
        
        // Обработка сообщений от iframe
        this.messageHandler = (event) => {
            if (event.data === 'close-webview') {
                this.closeWebView();
            }
        };
        window.addEventListener('message', this.messageHandler);
    }
    
    closeWebView() {
        // Анимация закрытия
        if (this.overlay) {
            this.overlay.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => {
                if (this.overlay && this.overlay.parentNode) {
                    this.overlay.parentNode.removeChild(this.overlay);
                }
                if (this.style && this.style.parentNode) {
                    this.style.parentNode.removeChild(this.style);
                }
                
                // Восстанавливаем canvas
                const canvas = document.querySelector('canvas');
                if (canvas && this.originalCanvasStyle !== undefined) {
                    canvas.style.cssText = this.originalCanvasStyle || '';
                }
            }, 200);
        }
        
        // Удаляем обработчики
        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
        }
        if (this.messageHandler) {
            window.removeEventListener('message', this.messageHandler);
        }
        
        // Возвращаемся в меню
        this.time.delayedCall(200, () => {
            this.scene.start('MenuScene');
        });
    }
    
    destroy() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        if (this.style && this.style.parentNode) {
            this.style.parentNode.removeChild(this.style);
        }
        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
        }
        if (this.messageHandler) {
            window.removeEventListener('message', this.messageHandler);
        }
        super.destroy();
    }
}