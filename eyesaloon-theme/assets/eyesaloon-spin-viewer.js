if (!customElements.get('eyesaloon-spin-viewer')) {
  class EyesaloonSpinViewer extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;
      this.initialized = true;

    this.images = Array.from(this.querySelectorAll('img'));
    this.track = this.querySelector('[data-spin-track]');
    this.range = this.querySelector('[data-spin-range]');
    this.index = 0;
    this.dragging = false;
    this.startX = 0;
    this.startIndex = 0;

    if (!this.images.length || !this.track || !this.range) return;

      this.onRangeInput = () => this.show(Number(this.range.value));
      this.boundPointerDown = this.onPointerDown.bind(this);
      this.boundPointerMove = this.onPointerMove.bind(this);
      this.boundPointerUp = this.onPointerUp.bind(this);

      this.range.addEventListener('input', this.onRangeInput);
      this.track.addEventListener('pointerdown', this.boundPointerDown);
      window.addEventListener('pointermove', this.boundPointerMove);
      window.addEventListener('pointerup', this.boundPointerUp);
    this.show(0);
  }

    disconnectedCallback() {
      this.range?.removeEventListener('input', this.onRangeInput);
      this.track?.removeEventListener('pointerdown', this.boundPointerDown);
      window.removeEventListener('pointermove', this.boundPointerMove);
      window.removeEventListener('pointerup', this.boundPointerUp);
      this.initialized = false;
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
}
