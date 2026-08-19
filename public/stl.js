export async function renderStlToPng(arrayBuffer, size = 320) {
  const THREE = await import('three');
  const { STLLoader } = await import('three/addons/loaders/STLLoader.js');

  const geometry = new STLLoader().parse(arrayBuffer);
  geometry.computeBoundingBox();

  const center = new THREE.Vector3();
  const dims = new THREE.Vector3();
  if (geometry.boundingBox) {
    geometry.boundingBox.getSize(dims);
    geometry.boundingBox.getCenter(center);
  }
  geometry.translate(-center.x, -center.y, -center.z);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size);
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000000);

  const maxDim = Math.max(dims.x, dims.y, dims.z, 0.001);
  const dist = (maxDim / 2) / Math.tan(THREE.MathUtils.degToRad(20)) * 1.2;
  camera.position.set(dist, dist * 0.55, dist);
  camera.lookAt(0, 0, 0);

  const material = new THREE.MeshStandardMaterial({ color: 0xd7dee8, roughness: 0.55, metalness: 0.08 });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x556677, 1.1);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(1, 1.5, 1).normalize();
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-1, -0.5, -0.5);
  scene.add(hemi, key, fill);

  renderer.render(scene, camera);
  const png = renderer.domElement.toDataURL('image/png');

  renderer.dispose();
  geometry.dispose();
  material.dispose();

  return png;
}
