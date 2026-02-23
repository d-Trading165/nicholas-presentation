/* ============================================
   SLIDE NAVIGATION & PRESENTATION CONTROLLER
   ============================================ */

class Presentation {
    constructor() {
        this.currentSlide = 0;
        this.slides = [];
        this.drawing = new DrawingEngine();
        this.helpVisible = false;

        this._init();
    }

    _init() {
        // Gather slides
        this.slides = Array.from(document.querySelectorAll('.slide'));
        this.totalSlides = this.slides.length;

        // Initialize drawing canvases for all slides
        this.slides.forEach((slide, i) => {
            this.drawing.initCanvas(i, slide);
        });

        // Show first slide
        this.slides[0].classList.add('active');
        this._updateCounter();
        this._updateProgress();

        // Bind events
        this._bindKeyboard();
        this._bindResize();
        this._buildToolbar();

        // Show help hint briefly
        this._flashHelp();
    }

    // --- Navigation ---
    goTo(index) {
        if (index < 0 || index >= this.totalSlides || index === this.currentSlide) return;

        const direction = index > this.currentSlide ? 'left' : 'right';
        const current = this.slides[this.currentSlide];
        const next = this.slides[index];

        // Exit current
        current.classList.remove('active');
        current.classList.add(direction === 'left' ? 'exiting-left' : 'exiting-right');

        // Enter next
        next.style.transform = direction === 'left' ? 'translateX(40px)' : 'translateX(-40px)';
        next.classList.add('active');

        // Force reflow then animate
        next.offsetHeight;
        next.style.transform = '';

        // Clean up exit class after transition
        setTimeout(() => {
            current.classList.remove('exiting-left', 'exiting-right');
        }, 650);

        this.currentSlide = index;
        this._updateCounter();
        this._updateProgress();
    }

    next() {
        this.goTo(this.currentSlide + 1);
    }

    prev() {
        this.goTo(this.currentSlide - 1);
    }

    // --- Fullscreen ---
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen();
        }
    }

    // --- UI Updates ---
    _updateCounter() {
        const el = document.getElementById('slide-counter');
        if (el) el.textContent = `${this.currentSlide + 1} / ${this.totalSlides}`;
    }

    _updateProgress() {
        const el = document.getElementById('progress-bar');
        if (el) {
            const pct = ((this.currentSlide + 1) / this.totalSlides) * 100;
            el.style.width = pct + '%';
        }
    }

    // --- Help ---
    toggleHelp() {
        this.helpVisible = !this.helpVisible;
        const el = document.getElementById('help-overlay');
        if (el) el.classList.toggle('visible', this.helpVisible);
    }

    _flashHelp() {
        // Brief hint at bottom
        const hint = document.createElement('div');
        hint.style.cssText = `
            position: fixed; bottom: 20px; left: 30px;
            font-family: 'Segoe UI', sans-serif; font-size: 0.75em;
            color: #5a5650; z-index: 100; letter-spacing: 0.05em;
            transition: opacity 1s ease; user-select: none;
        `;
        hint.textContent = 'Press H for help';
        document.body.appendChild(hint);

        setTimeout(() => { hint.style.opacity = '0'; }, 4000);
        setTimeout(() => { hint.remove(); }, 5000);
    }

    // --- Drawing mode ---
    toggleDraw() {
        const on = this.drawing.toggleDrawMode();
        const indicator = document.getElementById('draw-mode-indicator');
        const toolbar = document.getElementById('drawing-toolbar');

        if (indicator) indicator.classList.toggle('visible', on);
        if (toolbar) toolbar.classList.toggle('visible', on);

        this._updateToolbarState();
    }

    _updateToolbarState() {
        // Update active tool button
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === this.drawing.currentTool);
        });

        // Update active color swatch
        document.querySelectorAll('.color-swatch').forEach(sw => {
            sw.classList.toggle('active', sw.dataset.color === this.drawing.currentColor);
        });
    }

    // --- Build toolbar DOM ---
    _buildToolbar() {
        const toolbar = document.getElementById('drawing-toolbar');
        if (!toolbar) return;

        const tools = [
            { name: 'pen',         icon: '✏️', key: '1' },
            { name: 'circle',      icon: '⭕', key: '2' },
            { name: 'arrow',       icon: '➡️', key: '3' },
            { name: 'highlighter', icon: '🖍️', key: '4' },
            { name: 'eraser',      icon: '🧹', key: '5' },
        ];

        // Tool buttons
        tools.forEach(t => {
            const btn = document.createElement('button');
            btn.classList.add('tool-btn');
            btn.dataset.tool = t.name;
            btn.title = `${t.name} (${t.key})`;
            btn.textContent = t.icon;
            btn.addEventListener('click', () => {
                this.drawing.setTool(t.name);
                this._updateToolbarState();
            });
            toolbar.appendChild(btn);
        });

        // Separator
        const sep = document.createElement('div');
        sep.classList.add('tool-separator');
        toolbar.appendChild(sep);

        // Color swatches
        this.drawing.colors.forEach(color => {
            const sw = document.createElement('div');
            sw.classList.add('color-swatch');
            sw.dataset.color = color;
            sw.style.background = color;
            sw.title = color;
            sw.addEventListener('click', () => {
                this.drawing.setColor(color);
                this._updateToolbarState();
            });
            toolbar.appendChild(sw);
        });

        // Separator
        const sep2 = document.createElement('div');
        sep2.classList.add('tool-separator');
        toolbar.appendChild(sep2);

        // Undo button
        const undoBtn = document.createElement('button');
        undoBtn.classList.add('tool-btn');
        undoBtn.title = 'Undo (Ctrl+Z)';
        undoBtn.textContent = '↩️';
        undoBtn.addEventListener('click', () => {
            this.drawing.undo(this.currentSlide);
        });
        toolbar.appendChild(undoBtn);

        // Clear button
        const clearBtn = document.createElement('button');
        clearBtn.classList.add('tool-btn');
        clearBtn.title = 'Clear slide (Ctrl+Del)';
        clearBtn.textContent = '🗑️';
        clearBtn.addEventListener('click', () => {
            this.drawing.clearSlide(this.currentSlide);
        });
        toolbar.appendChild(clearBtn);

        this._updateToolbarState();
    }

    // --- Keyboard bindings ---
    _bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Don't intercept if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const key = e.key;
            const ctrl = e.ctrlKey || e.metaKey;

            // Help
            if (key === 'h' || key === 'H') {
                e.preventDefault();
                this.toggleHelp();
                return;
            }

            // Close help if visible
            if (this.helpVisible && key === 'Escape') {
                this.toggleHelp();
                return;
            }

            // Fullscreen
            if (key === 'f' || key === 'F') {
                e.preventDefault();
                this.toggleFullscreen();
                return;
            }

            // Draw mode toggle
            if (key === 'd' || key === 'D') {
                e.preventDefault();
                this.toggleDraw();
                return;
            }

            // Escape exits draw mode
            if (key === 'Escape') {
                if (this.drawing.drawMode) {
                    this.drawing.setDrawMode(false);
                    document.getElementById('draw-mode-indicator')?.classList.remove('visible');
                    document.getElementById('drawing-toolbar')?.classList.remove('visible');
                }
                return;
            }

            // Drawing tool shortcuts (only in draw mode)
            if (this.drawing.drawMode) {
                if (key === '1') { this.drawing.setTool('pen'); this._updateToolbarState(); return; }
                if (key === '2') { this.drawing.setTool('circle'); this._updateToolbarState(); return; }
                if (key === '3') { this.drawing.setTool('arrow'); this._updateToolbarState(); return; }
                if (key === '4') { this.drawing.setTool('highlighter'); this._updateToolbarState(); return; }
                if (key === '5') { this.drawing.setTool('eraser'); this._updateToolbarState(); return; }

                if (key === 'c' || key === 'C') {
                    this.drawing.cycleColor();
                    this._updateToolbarState();
                    return;
                }

                if (ctrl && key === 'z') {
                    e.preventDefault();
                    this.drawing.undo(this.currentSlide);
                    return;
                }

                if (ctrl && key === 'Delete') {
                    e.preventDefault();
                    this.drawing.clearSlide(this.currentSlide);
                    return;
                }
            }

            // Navigation (don't navigate in draw mode to prevent accidental moves)
            if (!this.drawing.drawMode) {
                if (key === 'ArrowRight' || key === ' ' || key === 'PageDown') {
                    e.preventDefault();
                    this.next();
                }
                if (key === 'ArrowLeft' || key === 'PageUp') {
                    e.preventDefault();
                    this.prev();
                }
            }
        });
    }

    // --- Resize ---
    _bindResize() {
        let timeout;
        window.addEventListener('resize', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.drawing.resize();
            }, 200);
        });
    }
}

// --- Boot ---
document.addEventListener('DOMContentLoaded', () => {
    window.pres = new Presentation();
});
