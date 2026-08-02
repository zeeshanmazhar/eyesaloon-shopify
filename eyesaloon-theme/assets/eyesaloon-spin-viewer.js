class EyesaloonSpinViewer extends HTMLElement {
  connectedCallback() {
    this.images = Array.from(this.querySelectorAll('img'));
    this.track = this.querySelector('[data-spin-track]');
    this.range = this.querySelector('[data-spin-range]');
    this.index = 0;
    this.dragging = false;
    this.startX = 0;
    this.startIndex = 0;

    if (!this.images.length || !this.track || !this.range) return;

    this.range.addEventListener('input', () => this.show(Number(this.range.value)));
    this.track.addEventListener('pointerdown', this.onPointerDown.bind(this));
    window.addEventListener('pointermove', this.onPointerMove.bind(this));
    window.addEventListener('pointerup', this.onPointerUp.bind(this));
    this.show(0);
  }

  show(index) {
    this.index = Math.max(0, Math.min(this.images.length - 1, index));
    this.images.forEach((image, imageIndex) => {
      image.hidden = imageIndex !== this.index;
    });
    this.range.value = String(this.index);
  }

  onPointerDown(event) {
    this.dragging = true;
    this.startX = event.clientX;
    this.startIndex = this.index;
    this.track.setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event) {
    if (!this.dragging) return;
    const frameDelta = Math.round((event.clientX - this.startX) / 18);
    this.show((this.startIndex + frameDelta + this.images.length) % this.images.length);
  }

  onPointerUp() {
    this.dragging = false;
  }
}

customElements.define('eyesaloon-spin-viewer', EyesaloonSpinViewer);
