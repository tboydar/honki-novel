import * as THREE from '../../vendor/three.module.js';
import { createWorld } from '../world.js';
import { createGame } from '../game.js';
import { createOrbit, disposeScene } from '../util.js';

export function create({ camera, canvas, sfx }) {
  camera.near = 0.5; camera.far = 1200; camera.updateProjectionMatrix();
  const world = createWorld();
  const game = createGame({ scene: world.scene, camera, canvas, sfx });
  const orbit = createOrbit({ target: new THREE.Vector3(0, 22, 0), theta: 0.6, elev: 0.32, radius: 78, min: 28, max: 120 });
  return {
    scene: world.scene,
    update(t, dt) {
      orbit.apply(camera, t, dt);
      world.update(t, dt, camera);
      game.update(t, dt);
    },
    drag: orbit.drag,
    zoom: orbit.zoom,
    pick(x, y, coarse) { orbit.touch(); game.pick(x, y, coarse); },
    setViewport: world.setViewport,
    dispose() { game.dispose(); disposeScene(world.scene); },
  };
}
