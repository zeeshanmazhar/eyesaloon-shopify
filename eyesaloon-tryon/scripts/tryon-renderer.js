import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const createFrameRenderer = ({ canvas, modelUrl }) => {
  let disposed = false;
  let frame = null;
  let frameWidth = 1;
  let frameHeight = 1;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas,
    powerPreference: "low-power",
  });
  const loader = new GLTFLoader();
  const group = new THREE.Group();
  const light = new THREE.HemisphereLight(0xffffff, 0x666666, 2.2);

  camera.position.set(0, 0, 1000);
  scene.add(light);
  scene.add(group);
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const resize = (width, height) => {
    if (!width || !height) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
  };

  const prepareFrame = (object) => {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    frameWidth = Math.max(size.x, 0.001);
    frameHeight = Math.max(size.y, 0.001);
    object.position.sub(center);

    object.traverse((child) => {
      if (child.isMesh) {
        child.frustumCulled = false;
        if (child.material) {
          child.material.depthTest = true;
          child.material.depthWrite = true;
          child.material.transparent = child.material.transparent || child.material.opacity < 1;
        }
      }
    });

    return object;
  };

  return {
    async load() {
      if (!modelUrl) return false;

      const response = await fetch(modelUrl, {
        credentials: "omit",
        mode: "cors",
      });

      if (!response.ok) {
        throw new Error(`3D model request failed with ${response.status}.`);
      }

      const modelBuffer = await response.arrayBuffer();
      const gltf = await new Promise((resolve, reject) => {
        loader.parse(modelBuffer, "", resolve, reject);
      });

      if (disposed) return false;

      frame = prepareFrame(gltf.scene);
      group.add(frame);
      return true;
    },
    renderFit(fit, viewport) {
      if (!frame || disposed) return false;

      resize(viewport.width, viewport.height);

      const scale = Math.min(fit.width / frameWidth, (fit.height * 1.26) / frameHeight);
      group.position.set(fit.centerX - viewport.width / 2, viewport.height / 2 - fit.centerY, 0);
      group.rotation.set(0, 0, -fit.roll);
      group.scale.setScalar(scale);
      renderer.render(scene, camera);
      return true;
    },
    clear() {
      renderer.clear();
    },
    destroy() {
      disposed = true;
      group.traverse((child) => {
        child.geometry?.dispose?.();

        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose?.());
        } else {
          child.material?.dispose?.();
        }
      });
      renderer.dispose();
    },
  };
};

window.EyesaloonTryOnFrameRenderer = { createFrameRenderer };
