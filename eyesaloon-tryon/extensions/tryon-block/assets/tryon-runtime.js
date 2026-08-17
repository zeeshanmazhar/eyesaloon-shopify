(() => {
  const fetchTrackingManifest = async (manifestUrl) => {
    if (!manifestUrl) return { ready: false };

    try {
      const response = await fetch(manifestUrl, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return { ready: false };

      const manifest = await response.json();
      return {
        manifest,
        ready: manifest.status === "ready",
      };
    } catch {
      return { ready: false };
    }
  };

  const runtimeApi = {
    create({ canvas, trackingManifestUrl, video }) {
      let animationFrame = 0;
      let destroyed = false;
      let trackingManifest = null;
      const context = canvas?.getContext("2d", { alpha: true });

      const resizeCanvas = () => {
        if (!canvas || !video) return false;

        const width = video.videoWidth || video.clientWidth;
        const height = video.videoHeight || video.clientHeight;

        if (!width || !height) return false;

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        return true;
      };

      const drawAlignmentOverlay = () => {
        if (destroyed || !context || !resizeCanvas()) {
          animationFrame = window.requestAnimationFrame(drawAlignmentOverlay);
          return;
        }

        const { width, height } = canvas;
        const centerX = width / 2;
        const centerY = height * 0.44;
        const lensWidth = width * 0.22;
        const lensHeight = lensWidth * 0.55;
        const gap = width * 0.045;

        context.clearRect(0, 0, width, height);
        context.save();
        context.strokeStyle = "rgba(255, 255, 255, 0.88)";
        context.lineWidth = Math.max(2, width * 0.004);
        context.shadowColor = "rgba(0, 0, 0, 0.28)";
        context.shadowBlur = Math.max(4, width * 0.01);

        context.beginPath();
        context.ellipse(centerX - lensWidth / 2 - gap, centerY, lensWidth / 2, lensHeight / 2, 0, 0, Math.PI * 2);
        context.ellipse(centerX + lensWidth / 2 + gap, centerY, lensWidth / 2, lensHeight / 2, 0, 0, Math.PI * 2);
        context.moveTo(centerX - gap, centerY);
        context.lineTo(centerX + gap, centerY);
        context.stroke();

        context.restore();
        animationFrame = window.requestAnimationFrame(drawAlignmentOverlay);
      };

      return {
        async start() {
          if (!canvas || !video || !context) return false;

          const trackingAssets = await fetchTrackingManifest(trackingManifestUrl);
          trackingManifest = trackingAssets.manifest || null;

          destroyed = false;
          canvas.hidden = false;
          drawAlignmentOverlay();

          return {
            ready: true,
            trackingAssetsReady: trackingAssets.ready,
          };
        },
        destroy() {
          destroyed = true;
          window.cancelAnimationFrame(animationFrame);

          if (context && canvas) {
            context.clearRect(0, 0, canvas.width, canvas.height);
            canvas.hidden = true;
          }
        },
        getTrackingManifest() {
          return trackingManifest;
        },
      };
    },
  };

  window.EyesaloonTryOnRuntime = runtimeApi;
})();
