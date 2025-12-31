import { OrbitControls } from "./lib/OrbitControls.js";
import * as THREE from "./lib/three.module.js";

export class MapRenderer3D {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.isInitialized = false;
    this.animationId = null;
    this.mapData = null;
    this.currentFloor = 1;
    this.resizeHandler = this.onWindowResize.bind(this);
    this.playerMarkers = [];
  }

  init() {
    if (this.isInitialized) return;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111);

    // Camera
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 10000);
    this.camera.position.set(500, 500, 500);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404040); // soft white light
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    this.isInitialized = true;
    this.animate();

    window.addEventListener("resize", this.resizeHandler, false);
  }

  onWindowResize() {
    if (!this.camera || !this.renderer) return;

    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    if (!this.isInitialized) return;
    this.animationId = requestAnimationFrame(() => this.animate());
    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  focusOn(x, y, z) {
    if (!this.controls) return;
    this.controls.target.set(x, y, z);
    this.controls.update();
  }

  update(mapData, currentFloor) {
    if (!this.isInitialized) this.init();

    this.mapData = mapData;
    this.currentFloor = currentFloor;

    // Clear existing meshes
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }

    // Clear player markers reference
    this.playerMarkers = [];

    // Re-add lights
    const ambientLight = new THREE.AmbientLight(0x404040);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 200, 100);
    this.scene.add(directionalLight);

    this.buildMap();
  }

  updatePlayerMarkers(playerLocations) {
    if (!this.isInitialized || !this.mapData) return;

    // Clear existing markers
    this.playerMarkers.forEach((marker) => {
      this.scene.remove(marker);
    });
    this.playerMarkers = [];

    if (!playerLocations) return;

    const FLOOR_HEIGHT_STEP = 64;
    const WALL_HEIGHT = 32;
    const OFFSET = 12;

    // Group players by room
    const playersByRoom = {};
    for (const [userId, roomIndex] of Object.entries(playerLocations)) {
      if (!playersByRoom[roomIndex]) playersByRoom[roomIndex] = [];
      playersByRoom[roomIndex].push(userId);
    }

    // Create markers for each room
    for (const [roomIndexStr, userIds] of Object.entries(playersByRoom)) {
      const roomIndex = parseInt(roomIndexStr);
      const room = this.mapData.rooms[roomIndex];
      if (!room) continue;

      const floor = room.floor !== undefined ? room.floor : 1;
      const yPos = (floor - 1) * FLOOR_HEIGHT_STEP;

      let centerX, centerY;
      if (room.shape === "circle") {
        centerX = room.x + room.radius;
        centerY = room.y + room.radius;
      } else {
        centerX = room.x + room.width / 2;
        centerY = room.y + room.height / 2;
      }

      const count = userIds.length;

      userIds.forEach((userId, index) => {
        let offsetX = 0;
        let offsetZ = 0;

        if (count === 2) {
          // Side by side
          offsetX = (index === 0 ? -1 : 1) * OFFSET;
        } else if (count === 3) {
          // Triangle
          const angle = (index * 2 * Math.PI) / 3 - Math.PI / 2;
          offsetX = Math.cos(angle) * OFFSET;
          offsetZ = Math.sin(angle) * OFFSET;
        } else if (count === 4) {
          // Square
          offsetX = (index % 2 === 0 ? -1 : 1) * OFFSET;
          offsetZ = (index < 2 ? -1 : 1) * OFFSET;
        } else if (count > 4) {
          // Circle
          const angle = (index * 2 * Math.PI) / count;
          offsetX = Math.cos(angle) * OFFSET * 1.5;
          offsetZ = Math.sin(angle) * OFFSET * 1.5;
        }

        // Create red hazy sphere
        const geometry = new THREE.SphereGeometry(8, 16, 16);
        const material = new THREE.MeshBasicMaterial({
          color: 0xff0000,
          transparent: true,
          opacity: 0.6,
          depthTest: false, // Always visible
        });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.renderOrder = 999; // On top

        // Position in center of room + offset, floating slightly
        sphere.position.set(
          centerX + offsetX,
          yPos + WALL_HEIGHT / 2,
          centerY + offsetZ
        );

        this.scene.add(sphere);
        this.playerMarkers.push(sphere);
      });
    }
  }

  createTextSprite(message, parameters = {}) {
    const fontface = parameters.fontface || "Arial";
    const fontsize = parameters.fontsize || 24;
    const borderThickness = parameters.borderThickness || 4;
    const borderColor = parameters.borderColor || { r: 0, g: 0, b: 0, a: 1.0 };
    const backgroundColor = parameters.backgroundColor || {
      r: 0,
      g: 0,
      b: 0,
      a: 0.6,
    };
    const textColor = parameters.textColor || {
      r: 255,
      g: 255,
      b: 255,
      a: 1.0,
    };

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    context.font = "Bold " + fontsize + "px " + fontface;

    // get size data (height depends only on font size)
    const metrics = context.measureText(message);
    const textWidth = metrics.width;

    // Resize canvas to fit text
    canvas.width = textWidth + borderThickness * 2 + 20; // padding
    canvas.height = fontsize * 1.4 + borderThickness * 2;

    // Re-apply font after resize
    context.font = "Bold " + fontsize + "px " + fontface;

    // background color
    context.fillStyle = `rgba(${backgroundColor.r},${backgroundColor.g},${backgroundColor.b},${backgroundColor.a})`;
    // border color
    context.strokeStyle = `rgba(${borderColor.r},${borderColor.g},${borderColor.b},${borderColor.a})`;

    context.lineWidth = borderThickness;

    // Draw rounded rectangle
    const x = borderThickness / 2;
    const y = borderThickness / 2;
    const w = canvas.width - borderThickness;
    const h = canvas.height - borderThickness;
    const r = 6;

    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + w - r, y);
    context.quadraticCurveTo(x + w, y, x + w, y + r);
    context.lineTo(x + w, y + h - r);
    context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    context.lineTo(x + r, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
    context.fill();
    context.stroke();

    // text color
    context.fillStyle = `rgba(${textColor.r},${textColor.g},${textColor.b},${textColor.a})`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(message, canvas.width / 2, canvas.height / 2);

    // canvas contents will be used for a texture
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false, // Always render on top
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.renderOrder = 999; // Ensure it renders last (on top)

    // Scale sprite to match text size
    const scaleFactor = 0.5;
    sprite.scale.set(
      canvas.width * scaleFactor,
      canvas.height * scaleFactor,
      1
    );

    return sprite;
  }

  buildMap() {
    if (!this.mapData) return;

    const WALL_HEIGHT = 32; // Standard wall height
    const FLOOR_HEIGHT_STEP = 64; // Distance between floors
    const SHOW_INACTIVE_FLOOR_LABELS = false; // Feature toggle

    // Helper to get material based on floor
    const getMaterial = (floor, color, opacityOverride = null) => {
      const isCurrent = floor === this.currentFloor;
      const opacity =
        opacityOverride !== null ? opacityOverride : isCurrent ? 1.0 : 0.1;
      const transparent = opacity < 1.0;
      return new THREE.MeshStandardMaterial({
        color: color,
        transparent: transparent,
        opacity: opacity,
        side: THREE.DoubleSide,
      });
    };

    // Rooms
    this.mapData.rooms.forEach((room) => {
      if (room.visible === false) return;

      const floor = room.floor !== undefined ? room.floor : 1;
      const yPos = (floor - 1) * FLOOR_HEIGHT_STEP;

      // Floor
      let geometry;
      if (room.shape === "circle") {
        geometry = new THREE.CylinderGeometry(room.radius, room.radius, 2, 32);
      } else {
        geometry = new THREE.BoxGeometry(room.width, 2, room.height);
      }

      const material = getMaterial(floor, 0x004400);
      const mesh = new THREE.Mesh(geometry, material);

      if (room.shape === "circle") {
        mesh.position.set(room.x + room.radius, yPos, room.y + room.radius);
      } else {
        mesh.position.set(
          room.x + room.width / 2,
          yPos,
          room.y + room.height / 2
        );
      }
      this.scene.add(mesh);

      // Ceiling
      const ceilingMesh = mesh.clone();
      if (room.shape === "circle") {
        ceilingMesh.position.set(
          room.x + room.radius,
          yPos + WALL_HEIGHT,
          room.y + room.radius
        );
      } else {
        ceilingMesh.position.set(
          room.x + room.width / 2,
          yPos + WALL_HEIGHT,
          room.y + room.height / 2
        );
      }
      this.scene.add(ceilingMesh);

      // Walls for room
      // We can create 4 walls for rectangle
      if (room.shape !== "circle") {
        const wallMat = getMaterial(floor, 0x008800);

        // Top wall
        const w1 = new THREE.Mesh(
          new THREE.BoxGeometry(room.width, WALL_HEIGHT, 2),
          wallMat
        );
        w1.position.set(
          room.x + room.width / 2,
          yPos + WALL_HEIGHT / 2,
          room.y
        );
        this.scene.add(w1);

        // Bottom wall
        const w2 = new THREE.Mesh(
          new THREE.BoxGeometry(room.width, WALL_HEIGHT, 2),
          wallMat
        );
        w2.position.set(
          room.x + room.width / 2,
          yPos + WALL_HEIGHT / 2,
          room.y + room.height
        );
        this.scene.add(w2);

        const w3 = new THREE.Mesh(
          new THREE.BoxGeometry(2, WALL_HEIGHT, room.height),
          wallMat
        );
        w3.position.set(
          room.x,
          yPos + WALL_HEIGHT / 2,
          room.y + room.height / 2
        );
        this.scene.add(w3);

        // Right wall
        const w4 = new THREE.Mesh(
          new THREE.BoxGeometry(2, WALL_HEIGHT, room.height),
          wallMat
        );
        w4.position.set(
          room.x + room.width,
          yPos + WALL_HEIGHT / 2,
          room.y + room.height / 2
        );
        this.scene.add(w4);
      } else {
        // Cylinder wall
        const wallGeo = new THREE.CylinderGeometry(
          room.radius,
          room.radius,
          WALL_HEIGHT,
          32,
          1,
          true
        );
        const wallMat = getMaterial(floor, 0x008800);
        const w = new THREE.Mesh(wallGeo, wallMat);
        w.position.set(
          room.x + room.radius,
          yPos + WALL_HEIGHT / 2,
          room.y + room.radius
        );
        this.scene.add(w);
      }

      // Room Label
      if (room.label && room.labelVisible !== false) {
        // Check if we should show label based on floor
        if (floor === this.currentFloor || SHOW_INACTIVE_FLOOR_LABELS) {
          const sprite = this.createTextSprite(room.label, {
            fontsize: 32,
            backgroundColor: { r: 0, g: 0, b: 0, a: 0.5 },
          });

          let centerX, centerY;
          if (room.shape === "circle") {
            centerX = room.x + room.radius;
            centerY = room.y + room.radius;
          } else {
            centerX = room.x + room.width / 2;
            centerY = room.y + room.height / 2;
          }

          sprite.position.set(centerX, yPos + WALL_HEIGHT + 20, centerY);

          // Fade out labels on other floors
          if (floor !== this.currentFloor) {
            sprite.material.opacity = 0.2;
          }

          this.scene.add(sprite);
        }
      }
    });

    // Hallways
    this.mapData.hallways.forEach((hallway) => {
      if (hallway.visible === false) return;

      const floor = hallway.floor !== undefined ? hallway.floor : 1;
      const yPos = (floor - 1) * FLOOR_HEIGHT_STEP;
      const material = getMaterial(floor, 0x005500);
      const wallMat = getMaterial(floor, 0x008800);

      hallway.segments.forEach((segment) => {
        const dx = segment.x2 - segment.x1;
        const dy = segment.y2 - segment.y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx); // In 2D: Y is down. In 3D: Z is down (mapped from Y)

        // Floor
        const geo = new THREE.BoxGeometry(len, 2, hallway.width);
        const mesh = new THREE.Mesh(geo, material);

        // Position: center of segment
        const cx = (segment.x1 + segment.x2) / 2;
        const cy = (segment.y1 + segment.y2) / 2;

        mesh.position.set(cx, yPos, cy);
        mesh.rotation.y = -angle; // Rotate around Y axis (up)
        this.scene.add(mesh);

        // Ceiling
        const ceilingMesh = mesh.clone();
        ceilingMesh.position.set(cx, yPos + WALL_HEIGHT, cy);
        ceilingMesh.rotation.y = -angle;
        this.scene.add(ceilingMesh);

        // Walls
        const perpX = -dy / len;
        const perpY = dx / len;
        const offX = perpX * (hallway.width / 2);
        const offY = perpY * (hallway.width / 2);

        // Wall 1
        const w1 = new THREE.Mesh(
          new THREE.BoxGeometry(len, WALL_HEIGHT, 2),
          wallMat
        );
        w1.position.set(cx + offX, yPos + WALL_HEIGHT / 2, cy + offY);
        w1.rotation.y = -angle;
        this.scene.add(w1);

        // Wall 2
        const w2 = new THREE.Mesh(
          new THREE.BoxGeometry(len, WALL_HEIGHT, 2),
          wallMat
        );
        w2.position.set(cx - offX, yPos + WALL_HEIGHT / 2, cy - offY);
        w2.rotation.y = -angle;
        this.scene.add(w2);
      });
    });

    // Standalone Walls
    this.mapData.walls.forEach((wall) => {
      if (wall.visible === false) return;

      const floor = wall.floor !== undefined ? wall.floor : 1;
      const yPos = (floor - 1) * FLOOR_HEIGHT_STEP;
      const material = getMaterial(floor, 0x00aa00); // Lighter for walls

      wall.segments.forEach((segment) => {
        const dx = segment.x2 - segment.x1;
        const dy = segment.y2 - segment.y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        const geo = new THREE.BoxGeometry(len, WALL_HEIGHT, 2); // Thin wall
        const mesh = new THREE.Mesh(geo, material);

        const cx = (segment.x1 + segment.x2) / 2;
        const cy = (segment.y1 + segment.y2) / 2;

        mesh.position.set(cx, yPos + WALL_HEIGHT / 2, cy);
        mesh.rotation.y = -angle;
        this.scene.add(mesh);
      });
    });

    // Markers (Simple spheres for now)
    if (this.mapData.standaloneMarkers) {
      this.mapData.standaloneMarkers.forEach((marker) => {
        if (marker.visible === false) return;

        const floor = marker.floor !== undefined ? marker.floor : 1;
        const yPos = (floor - 1) * FLOOR_HEIGHT_STEP;
        const material = getMaterial(floor, 0xff0000);

        const geo = new THREE.SphereGeometry(8, 16, 16);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(marker.x, yPos + 8, marker.y);
        this.scene.add(mesh);
      });
    }
  }

  dispose() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    window.removeEventListener("resize", this.resizeHandler);
    this.isInitialized = false;
  }
}
