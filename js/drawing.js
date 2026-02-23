/* ============================================
   DRAWING ENGINE
   Canvas-based real-time markup overlay
   ============================================ */

class DrawingEngine {
    constructor() {
        this.canvases = new Map();      // slideIndex -> canvas element
        this.contexts = new Map();      // slideIndex -> context
        this.histories = new Map();     // slideIndex -> array of ImageData snapshots
        this.isDrawing = false;
        this.drawMode = false;
        this.currentTool = 'pen';
        this.currentColor = '#e63946';
        this.lineWidth = 3;
        this.startX = 0;
        this.startY = 0;
        this.snapshotBeforeShape = null;

        this.tools = {
            pen:         { cursor: 'crosshair', width: 3 },
            circle:      { cursor: 'crosshair', width: 3 },
            arrow:       { cursor: 'crosshair', width: 3 },
            highlighter: { cursor: 'crosshair', width: 22 },
            eraser:      { cursor: 'cell',      width: 24 }
        };

        this.colors = ['#e63946', '#457b9d', '#f4d35e', '#ffffff', '#2a9d8f'];
    }

    // Initialize canvas for a given slide
    initCanvas(slideIndex, slideElement) {
        if (this.canvases.has(slideIndex)) return;

        const canvas = document.createElement('canvas');
        canvas.classList.add('drawing-canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        slideElement.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        this.canvases.set(slideIndex, canvas);
        this.contexts.set(slideIndex, ctx);
        this.histories.set(slideIndex, []);

        this._bindCanvasEvents(canvas, slideIndex);
    }

    // Resize all canvases on window resize
    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;

        this.canvases.forEach((canvas, idx) => {
            const ctx = this.contexts.get(idx);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            canvas.width = w;
            canvas.height = h;

            // Restore content
            ctx.putImageData(imageData, 0, 0);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        });
    }

    // Toggle draw mode on/off
    toggleDrawMode() {
        this.drawMode = !this.drawMode;
        this._updateCanvasState();
        return this.drawMode;
    }

    setDrawMode(on) {
        this.drawMode = on;
        this._updateCanvasState();
    }

    _updateCanvasState() {
        this.canvases.forEach(canvas => {
            if (this.drawMode) {
                canvas.classList.add('active');
                canvas.style.cursor = this.tools[this.currentTool].cursor;
            } else {
                canvas.classList.remove('active');
                canvas.style.cursor = 'default';
            }
        });
    }

    // Tool selection
    setTool(toolName) {
        if (this.tools[toolName]) {
            this.currentTool = toolName;
            this.lineWidth = this.tools[toolName].width;
            this._updateCanvasState();
        }
    }

    // Color selection
    setColor(color) {
        this.currentColor = color;
    }

    cycleColor() {
        const idx = this.colors.indexOf(this.currentColor);
        const next = (idx + 1) % this.colors.length;
        this.currentColor = this.colors[next];
        return this.currentColor;
    }

    // Undo last stroke on current slide
    undo(slideIndex) {
        const history = this.histories.get(slideIndex);
        const ctx = this.contexts.get(slideIndex);
        const canvas = this.canvases.get(slideIndex);
        if (!history || history.length === 0) return;

        history.pop();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (history.length > 0) {
            ctx.putImageData(history[history.length - 1], 0, 0);
        }
    }

    // Clear all drawings on current slide
    clearSlide(slideIndex) {
        const ctx = this.contexts.get(slideIndex);
        const canvas = this.canvases.get(slideIndex);
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.histories.set(slideIndex, []);
    }

    // Save snapshot for undo
    _saveSnapshot(slideIndex) {
        const ctx = this.contexts.get(slideIndex);
        const canvas = this.canvases.get(slideIndex);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const history = this.histories.get(slideIndex);

        // Limit history to 50 steps
        if (history.length > 50) history.shift();
        history.push(imageData);
    }

    // Bind mouse/touch events to a canvas
    _bindCanvasEvents(canvas, slideIndex) {
        // Mouse events
        canvas.addEventListener('mousedown', (e) => this._onStart(e, slideIndex));
        canvas.addEventListener('mousemove', (e) => this._onMove(e, slideIndex));
        canvas.addEventListener('mouseup', (e) => this._onEnd(e, slideIndex));
        canvas.addEventListener('mouseleave', (e) => this._onEnd(e, slideIndex));

        // Touch events
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this._onStart(touch, slideIndex);
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this._onMove(touch, slideIndex);
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this._onEnd(e, slideIndex);
        });
    }

    _getPos(e) {
        return { x: e.clientX, y: e.clientY };
    }

    _onStart(e, slideIndex) {
        if (!this.drawMode) return;
        this.isDrawing = true;

        const { x, y } = this._getPos(e);
        this.startX = x;
        this.startY = y;

        const ctx = this.contexts.get(slideIndex);
        const canvas = this.canvases.get(slideIndex);

        if (this.currentTool === 'circle' || this.currentTool === 'arrow') {
            // Save canvas state before shape drawing for live preview
            this.snapshotBeforeShape = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }

        if (this.currentTool === 'pen' || this.currentTool === 'highlighter' || this.currentTool === 'eraser') {
            ctx.beginPath();
            ctx.moveTo(x, y);
        }
    }

    _onMove(e, slideIndex) {
        if (!this.isDrawing || !this.drawMode) return;

        const { x, y } = this._getPos(e);
        const ctx = this.contexts.get(slideIndex);
        const canvas = this.canvases.get(slideIndex);

        switch (this.currentTool) {
            case 'pen':
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = this.currentColor;
                ctx.lineWidth = this.lineWidth;
                ctx.lineTo(x, y);
                ctx.stroke();
                break;

            case 'highlighter':
                ctx.globalAlpha = 0.3;
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = this.currentColor;
                ctx.lineWidth = this.tools.highlighter.width;
                ctx.lineTo(x, y);
                ctx.stroke();
                break;

            case 'eraser':
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = this.tools.eraser.width;
                ctx.lineTo(x, y);
                ctx.stroke();
                break;

            case 'circle':
                // Live preview: restore snapshot then draw circle
                ctx.putImageData(this.snapshotBeforeShape, 0, 0);
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = this.currentColor;
                ctx.lineWidth = this.lineWidth;
                ctx.beginPath();
                const rx = Math.abs(x - this.startX) / 2;
                const ry = Math.abs(y - this.startY) / 2;
                const cx = (x + this.startX) / 2;
                const cy = (y + this.startY) / 2;
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                ctx.stroke();
                break;

            case 'arrow':
                // Live preview: restore snapshot then draw arrow
                ctx.putImageData(this.snapshotBeforeShape, 0, 0);
                this._drawArrow(ctx, this.startX, this.startY, x, y);
                break;
        }
    }

    _onEnd(e, slideIndex) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        const ctx = this.contexts.get(slideIndex);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath(); // Reset path

        this.snapshotBeforeShape = null;
        this._saveSnapshot(slideIndex);
    }

    _drawArrow(ctx, fromX, fromY, toX, toY) {
        const headLen = 18;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const angle = Math.atan2(dy, dx);

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = this.currentColor;
        ctx.fillStyle = this.currentColor;
        ctx.lineWidth = this.lineWidth;

        // Shaft
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(
            toX - headLen * Math.cos(angle - Math.PI / 6),
            toY - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            toX - headLen * Math.cos(angle + Math.PI / 6),
            toY - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
    }
}
