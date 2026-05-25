import * as THREE from "three";
import { FolderApi } from "tweakpane";
import { BaseScene } from "./BaseScene";
import { DestructibleMesh, FractureOptions } from "@dgreenheck/three-pinata";

/**
 * Configuration for a wooden object
 */
interface WoodObject {
  mesh: DestructibleMesh;
  grainDirection: THREE.Vector3;
  name: string;
  fractured: boolean;
}

/**
 * Wood Yard Demo - Anisotropic Voronoi Showcase
 * - Multiple wooden objects with different sizes and orientations
 * - Each object has a grain direction for realistic splintering
 * - Click any object to fracture it with grain-following splinters
 * - Demonstrates the power of anisotropic Voronoi for wood materials
 */
export class WoodYardScene extends BaseScene {
  private woodObjects: WoodObject[] = [];
  private allFragments: DestructibleMesh[] = [];

  private impactMarker: THREE.Mesh | null = null;
  private radiusMarker: THREE.Mesh | null = null;
  private hoveredObject: WoodObject | null = null;

  // Projectile mode
  private balls: THREE.Mesh[] = [];
  private ballMaterial!: THREE.MeshStandardMaterial;

  private settings = {
    fragmentCount: 40,
    anisotropy: 4.5,
    useImpactPoint: true,
    impactRadius: 0.4,
    applyImpactForce: true,
    interactionMode: "Click to Fracture" as "Click to Fracture" | "Fire Projectiles",
  };

  async init(): Promise<void> {
    // Setup camera for overview of wood yard
    this.camera.position.set(8, 6, 10);
    this.controls.target.set(0, 1.5, 0);
    this.controls.update();

    // Load wood textures first (cached for scaled material creation)
    await this.materialFactory.loadWoodMaterials();

    // Create ball material for projectile mode
    this.ballMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.4,
      metalness: 0.6,
    });

    // Create impact markers
    const markers = this.createImpactMarkers();
    this.impactMarker = markers.impact;
    this.radiusMarker = markers.radius;

    // Create the wood yard scene
    this.createWoodYard();

    // Set up physics collision handler for projectile mode
    this.physics.onCollision = (body1, body2, started) => {
      if (!started) return;
      if (this.settings.interactionMode !== "Fire Projectiles") return;

      // Check if one is a ball and the other is a wood object
      const ball = this.balls.find(
        (b) => b === body1.object || b === body2.object,
      );
      const woodObj = this.woodObjects.find(
        (obj) => !obj.fractured && (obj.mesh === body1.object || obj.mesh === body2.object),
      );

      if (ball && woodObj) {
        this.fractureObject(woodObj, ball.position.clone());
      }
    };

    // Add event listeners
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("click", this.onMouseClick);
  }

  private createWoodYard(): void {
    // BEAMS AND POSTS
    // 1. Horizontal plank on sawhorses (classic karate chop setup)
    this.createHorizontalPlank();

    // 2. Vertical post/pillar
    this.createVerticalPost();

    // 3. Angled beam (45 degrees)
    this.createAngledBeam();

    // 4. Thick log section
    this.createLogSection();

    // FLAT SURFACES
    // 5. Wooden wall panel (vertical flat surface)
    this.createWoodWall();

    // 6. Large wooden door/panel
    this.createWoodenDoor();

    // 7. Wooden floor platform
    this.createWoodenPlatform();

    // 8. Wooden table top
    this.createTableTop();

    // SMALL PIECES
    // 9. Wooden fence section
    this.createFenceSection();

    // 10. Small wooden blocks/kindling
    this.createKindlingPile();

    // Create static supports
    this.createSupports();
  }

  private createHorizontalPlank(): void {
    // Long thin plank - grain runs along X axis
    // Dimensions: 3.0m x 0.12m x 0.3m - top face shows 3.0 x 0.3
    const geometry = new THREE.BoxGeometry(3.0, 0.12, 0.3);
    const { exterior, interior } = this.materialFactory.createScaledWoodMaterials(3.0, 0.3);
    const mesh = new DestructibleMesh(
      geometry,
      exterior,
      interior
    );
    mesh.position.set(-3, 1.3, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.physics.add(mesh, {
      type: "dynamic",
      restitution: 0.2,
      friction: 0.6,
      linearDamping: 0.3,
      angularDamping: 0.5,
    });

    this.woodObjects.push({
      mesh,
      grainDirection: new THREE.Vector3(1, 0, 0), // Grain along length
      name: "Horizontal Plank",
      fractured: false,
    });
  }

  private createVerticalPost(): void {
    // Tall vertical post - grain runs along Y axis
    // Dimensions: 0.25m x 2.5m x 0.25m - front face shows 0.25 x 2.5
    const geometry = new THREE.BoxGeometry(0.25, 2.5, 0.25);
    const { exterior, interior } = this.materialFactory.createScaledWoodMaterials(0.25, 2.5);
    const mesh = new DestructibleMesh(
      geometry,
      exterior,
      interior
    );
    mesh.position.set(3, 1.25, -2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.physics.add(mesh, {
      type: "dynamic",
      restitution: 0.2,
      friction: 0.6,
      linearDamping: 0.3,
      angularDamping: 0.5,
    });

    this.woodObjects.push({
      mesh,
      grainDirection: new THREE.Vector3(0, 1, 0), // Grain runs vertically
      name: "Vertical Post",
      fractured: false,
    });
  }

  private createAngledBeam(): void {
    // Angled beam at 45 degrees - grain runs along the beam's length
    // Dimensions: 2.5m x 0.2m x 0.2m - front face shows 2.5 x 0.2
    const geometry = new THREE.BoxGeometry(2.5, 0.2, 0.2);
    const { exterior, interior } = this.materialFactory.createScaledWoodMaterials(2.5, 0.2);
    const mesh = new DestructibleMesh(
      geometry,
      exterior,
      interior
    );
    mesh.position.set(0, 1.8, -3);
    mesh.rotation.z = Math.PI / 4; // 45 degree angle
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.physics.add(mesh, {
      type: "dynamic",
      restitution: 0.2,
      friction: 0.6,
      linearDamping: 0.3,
      angularDamping: 0.5,
    });

    // Grain direction follows the rotated beam
    const grainDir = new THREE.Vector3(1, 0, 0).applyEuler(
      new THREE.Euler(0, 0, Math.PI / 4)
    );

    this.woodObjects.push({
      mesh,
      grainDirection: grainDir.normalize(),
      name: "Angled Beam",
      fractured: false,
    });
  }

  private createLogSection(): void {
    // Thick cylindrical log section approximated with octagonal prism
    // Cylinder: radius 0.4m, height 1.5m - circumference ~2.5m x height 1.5m
    const geometry = new THREE.CylinderGeometry(0.4, 0.4, 1.5, 12);
    geometry.rotateX(Math.PI / 2); // Lay it on its side
    
    const { exterior, interior } = this.materialFactory.createScaledWoodMaterials(2.5, 1.5);
    const mesh = new DestructibleMesh(
      geometry,
      exterior,
      interior
    );
    mesh.position.set(-1, 0.4, 3);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.physics.add(mesh, {
      type: "dynamic",
      restitution: 0.15,
      friction: 0.7,
      linearDamping: 0.4,
      angularDamping: 0.6,
    });

    this.woodObjects.push({
      mesh,
      grainDirection: new THREE.Vector3(0, 0, 1), // Grain along log length
      name: "Log Section",
      fractured: false,
    });
  }

  private createWoodWall(): void {
    // Large vertical wooden wall panel - grain runs horizontally
    // Dimensions: 2.5m x 2.0m x 0.08m - front face shows 2.5 x 2.0
    const geometry = new THREE.BoxGeometry(2.5, 2.0, 0.08);
    const { exterior, interior } = this.materialFactory.createScaledWoodMaterials(2.5, 2.0);
    const mesh = new DestructibleMesh(
      geometry,
      exterior,
      interior
    );
    mesh.position.set(-5, 1.0, -3);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.physics.add(mesh, {
      type: "dynamic",
      restitution: 0.15,
      friction: 0.6,
      linearDamping: 0.3,
      angularDamping: 0.4,
    });

    this.woodObjects.push({
      mesh,
      grainDirection: new THREE.Vector3(1, 0, 0), // Horizontal grain (like horizontal planks)
      name: "Wood Wall (Horiz Grain)",
      fractured: false,
    });
  }

  private createWoodenDoor(): void {
    // Tall wooden door panel - grain runs vertically
    // Dimensions: 1.0m x 2.2m x 0.1m - front face shows 1.0 x 2.2
    const geometry = new THREE.BoxGeometry(1.0, 2.2, 0.1);
    const { exterior, interior } = this.materialFactory.createScaledWoodMaterials(1.0, 2.2);
    const mesh = new DestructibleMesh(
      geometry,
      exterior,
      interior
    );
    mesh.position.set(-2.5, 1.1, -4);
    mesh.rotation.y = Math.PI / 6; // Slight angle
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.physics.add(mesh, {
      type: "dynamic",
      restitution: 0.15,
      friction: 0.6,
      linearDamping: 0.3,
      angularDamping: 0.4,
    });

    this.woodObjects.push({
      mesh,
      grainDirection: new THREE.Vector3(0, 1, 0), // Vertical grain
      name: "Wooden Door (Vert Grain)",
      fractured: false,
    });
  }

  private createWoodenPlatform(): void {
    // Flat wooden floor/platform - grain runs along Z
    // Dimensions: 2.0m x 0.1m x 1.5m - top face shows 2.0 x 1.5
    const geometry = new THREE.BoxGeometry(2.0, 0.1, 1.5);
    const { exterior, interior } = this.materialFactory.createScaledWoodMaterials(2.0, 1.5);
    const mesh = new DestructibleMesh(
      geometry,
      exterior,
      interior
    );
    mesh.position.set(0, 0.5, 5);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // Add legs/supports for the platform (static)
    const legGeometry = new THREE.BoxGeometry(0.1, 0.5, 0.1);
    const legMaterial = new THREE.MeshStandardMaterial({
      color: 0x4A3728,
      roughness: 0.85,
    });
    const legPositions = [
      [-0.9, 0.25, 4.6],
      [0.9, 0.25, 4.6],
      [-0.9, 0.25, 5.4],
      [0.9, 0.25, 5.4],
    ];
    legPositions.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      leg.position.set(x, y, z);
      leg.castShadow = true;
      this.scene.add(leg);
      
      // Static physics for legs
      const body = this.physics.RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
      const rigidBody = this.physics.world.createRigidBody(body);
      const collider = this.physics.RAPIER.ColliderDesc.cuboid(0.05, 0.25, 0.05);
      this.physics.world.createCollider(collider, rigidBody);
    });

    this.physics.add(mesh, {
      type: "dynamic",
      restitution: 0.1,
      friction: 0.7,
      linearDamping: 0.4,
      angularDamping: 0.5,
    });

    this.woodObjects.push({
      mesh,
      grainDirection: new THREE.Vector3(0, 0, 1), // Grain along platform length
      name: "Platform (Z Grain)",
      fractured: false,
    });
  }

  private createTableTop(): void {
    // Square table top - grain runs diagonally for interesting effect
    // Dimensions: 1.2m x 0.06m x 1.2m - top face shows 1.2 x 1.2
    const geometry = new THREE.BoxGeometry(1.2, 0.06, 1.2);
    const { exterior, interior } = this.materialFactory.createScaledWoodMaterials(1.2, 1.2);
    const mesh = new DestructibleMesh(
      geometry,
      exterior,
      interior
    );
    mesh.position.set(5.5, 0.8, -1);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // Table legs (static)
    const legGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8);
    const legMaterial = new THREE.MeshStandardMaterial({
      color: 0x3D2817,
      roughness: 0.8,
    });
    const legOffsets = [
      [-0.5, -0.5],
      [0.5, -0.5],
      [-0.5, 0.5],
      [0.5, 0.5],
    ];
    legOffsets.forEach(([dx, dz]) => {
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      leg.position.set(5.5 + dx, 0.4, -1 + dz);
      leg.castShadow = true;
      this.scene.add(leg);
      
      // Static physics for legs
      const body = this.physics.RAPIER.RigidBodyDesc.fixed().setTranslation(
        5.5 + dx, 0.4, -1 + dz
      );
      const rigidBody = this.physics.world.createRigidBody(body);
      const collider = this.physics.RAPIER.ColliderDesc.cylinder(0.4, 0.04);
      this.physics.world.createCollider(collider, rigidBody);
    });

    this.physics.add(mesh, {
      type: "dynamic",
      restitution: 0.1,
      friction: 0.6,
      linearDamping: 0.3,
      angularDamping: 0.5,
    });

    // Diagonal grain direction (45 degrees in XZ plane)
    const diagonalGrain = new THREE.Vector3(1, 0, 1).normalize();

    this.woodObjects.push({
      mesh,
      grainDirection: diagonalGrain,
      name: "Table Top (Diagonal Grain)",
      fractured: false,
    });
  }

  private createFenceSection(): void {
    // Three vertical fence posts connected by horizontal rails
    const postPositions = [-0.6, 0, 0.6];
    
    postPositions.forEach((xOffset, index) => {
      // Vertical fence post - 0.1m x 1.2m x 0.1m
      const postGeometry = new THREE.BoxGeometry(0.1, 1.2, 0.1);
      const { exterior: postExterior, interior: postInterior } = 
        this.materialFactory.createScaledWoodMaterials(0.1, 1.2);
      const postMesh = new DestructibleMesh(
        postGeometry,
        postExterior,
        postInterior
      );
      postMesh.position.set(4 + xOffset, 0.6, 2);
      postMesh.castShadow = true;
      postMesh.receiveShadow = true;
      this.scene.add(postMesh);

      this.physics.add(postMesh, {
        type: "dynamic",
        restitution: 0.2,
        friction: 0.6,
        linearDamping: 0.3,
        angularDamping: 0.5,
      });

      this.woodObjects.push({
        mesh: postMesh,
        grainDirection: new THREE.Vector3(0, 1, 0), // Vertical grain
        name: `Fence Post ${index + 1}`,
        fractured: false,
      });
    });

    // Horizontal rails - 1.4m x 0.08m x 0.05m
    [0.3, 0.8].forEach((yPos, index) => {
      const railGeometry = new THREE.BoxGeometry(1.4, 0.08, 0.05);
      const { exterior: railExterior, interior: railInterior } = 
        this.materialFactory.createScaledWoodMaterials(1.4, 0.08);
      const railMesh = new DestructibleMesh(
        railGeometry,
        railExterior,
        railInterior
      );
      railMesh.position.set(4, yPos, 2.08);
      railMesh.castShadow = true;
      railMesh.receiveShadow = true;
      this.scene.add(railMesh);

      this.physics.add(railMesh, {
        type: "dynamic",
        restitution: 0.2,
        friction: 0.6,
        linearDamping: 0.3,
        angularDamping: 0.5,
      });

      this.woodObjects.push({
        mesh: railMesh,
        grainDirection: new THREE.Vector3(1, 0, 0), // Horizontal grain
        name: `Fence Rail ${index + 1}`,
        fractured: false,
      });
    });
  }

  private createKindlingPile(): void {
    // Small wooden sticks/kindling in a pile - 0.8m x 0.06m x 0.06m
    const kindlingConfigs = [
      { pos: new THREE.Vector3(2, 0.1, 4), rot: 0, grain: new THREE.Vector3(1, 0, 0) },
      { pos: new THREE.Vector3(2.1, 0.15, 4.1), rot: 0.3, grain: new THREE.Vector3(1, 0, 0) },
      { pos: new THREE.Vector3(1.9, 0.2, 3.9), rot: -0.2, grain: new THREE.Vector3(1, 0, 0) },
      { pos: new THREE.Vector3(2.05, 0.25, 4.05), rot: 0.5, grain: new THREE.Vector3(1, 0, 0) },
    ];

    kindlingConfigs.forEach((config, index) => {
      const geometry = new THREE.BoxGeometry(0.8, 0.06, 0.06);
      // Kindling - 0.8m length, 0.06m cross-section
      const { exterior, interior } = this.materialFactory.createScaledWoodMaterials(0.8, 0.06);
      const mesh = new DestructibleMesh(
        geometry,
        exterior,
        interior
      );
      mesh.position.copy(config.pos);
      mesh.rotation.y = config.rot;
      mesh.rotation.z = (Math.random() - 0.5) * 0.2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      this.physics.add(mesh, {
        type: "dynamic",
        restitution: 0.3,
        friction: 0.5,
        linearDamping: 0.4,
        angularDamping: 0.6,
      });

      // Grain follows the stick's orientation
      const grainDir = config.grain.clone().applyEuler(mesh.rotation);

      this.woodObjects.push({
        mesh,
        grainDirection: grainDir.normalize(),
        name: `Kindling ${index + 1}`,
        fractured: false,
      });
    });
  }

  private createSupports(): void {
    // Sawhorses for the horizontal plank
    const sawhorseGeometry = new THREE.BoxGeometry(0.15, 1.2, 0.4);
    const supportMaterial = new THREE.MeshStandardMaterial({
      color: 0x4A3728,
      roughness: 0.85,
      metalness: 0.0,
    });

    const positions = [
      new THREE.Vector3(-4, 0.6, 0),
      new THREE.Vector3(-2, 0.6, 0),
    ];

    positions.forEach((pos) => {
      const support = new THREE.Mesh(sawhorseGeometry, supportMaterial);
      support.position.copy(pos);
      support.castShadow = true;
      support.receiveShadow = true;
      this.scene.add(support);

      // Static physics
      const body = this.physics.RAPIER.RigidBodyDesc.fixed().setTranslation(
        pos.x,
        pos.y,
        pos.z
      );
      const rigidBody = this.physics.world.createRigidBody(body);
      const collider = this.physics.RAPIER.ColliderDesc.cuboid(0.075, 0.6, 0.2);
      this.physics.world.createCollider(collider, rigidBody);
    });
  }

  private onMouseMove = (event: MouseEvent): void => {
    this.updateMouseCoordinates(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Find which wood object is being hovered
    const unfracturedMeshes = this.woodObjects
      .filter((obj) => !obj.fractured)
      .map((obj) => obj.mesh);

    const intersects = this.raycaster.intersectObjects(unfracturedMeshes, false);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as DestructibleMesh;
      const woodObj = this.woodObjects.find((obj) => obj.mesh === hitMesh);
      
      if (woodObj && this.settings.useImpactPoint) {
        this.hoveredObject = woodObj;
        const point = intersects[0].point;
        
        if (this.impactMarker) {
          this.impactMarker.position.copy(point);
          this.impactMarker.visible = true;
        }
        if (this.radiusMarker) {
          this.radiusMarker.position.copy(point);
          this.radiusMarker.scale.setScalar(this.settings.impactRadius);
          this.radiusMarker.visible = true;
        }
      }
    } else {
      this.hoveredObject = null;
      if (this.impactMarker) this.impactMarker.visible = false;
      if (this.radiusMarker) this.radiusMarker.visible = false;
    }
  };

  private onMouseClick = (event: MouseEvent): void => {
    this.updateMouseCoordinates(event);

    if (this.settings.interactionMode === "Fire Projectiles") {
      this.fireBall();
      return;
    }

    // Click to fracture mode
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check for hits on unfractured objects
    const unfracturedMeshes = this.woodObjects
      .filter((obj) => !obj.fractured)
      .map((obj) => obj.mesh);

    const intersects = this.raycaster.intersectObjects(unfracturedMeshes, false);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as DestructibleMesh;
      const woodObj = this.woodObjects.find((obj) => obj.mesh === hitMesh);
      
      if (woodObj) {
        this.fractureObject(woodObj, intersects[0].point);
      }
    } else {
      // Check for hits on fragments (to apply force)
      this.handleExplosiveClick(this.allFragments, 0.8, 6.0);
    }
  };

  private fireBall(): void {
    const ballRadius = 0.25;
    const ballGeometry = new THREE.SphereGeometry(ballRadius, 16, 16);
    const ball = new THREE.Mesh(ballGeometry, this.ballMaterial);

    // Position ball at camera
    ball.position.copy(this.camera.position);
    ball.castShadow = true;

    this.scene.add(ball);
    this.balls.push(ball);

    // Add physics to ball
    const body = this.physics.add(ball, {
      type: "dynamic",
      restitution: 0.6,
      friction: 0.5,
      mass: 3,
    });

    if (body) {
      // Calculate direction from camera through mouse position
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const direction = this.raycaster.ray.direction.clone().normalize();

      // Fire ball with velocity
      const speed = 30;
      body.setLinearVelocity({
        x: direction.x * speed,
        y: direction.y * speed,
        z: direction.z * speed,
      });
    }
  }

  private fractureObject(woodObj: WoodObject, worldPoint: THREE.Vector3): void {
    const mesh = woodObj.mesh;
    const localPoint = mesh.worldToLocal(worldPoint.clone());

    // Transform grain direction to local space
    const localGrain = woodObj.grainDirection.clone();
    // For rotated objects, the grain is already in world space, transform to local
    const worldToLocal = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    localGrain.transformDirection(worldToLocal).normalize();

    // Create fracture options with anisotropic settings
    const fractureOptions = new FractureOptions({
      fractureMethod: "voronoi",
      fragmentCount: this.settings.fragmentCount,
      voronoiOptions: {
        mode: "3D",
        grainDirection: localGrain,
        anisotropy: this.settings.anisotropy,
        impactPoint: this.settings.useImpactPoint ? localPoint : undefined,
        impactRadius: this.settings.useImpactPoint
          ? this.settings.impactRadius
          : undefined,
      },
    });

    // Fracture the object
    const fragments = mesh.fracture(fractureOptions, (fragment) => {
      fragment.castShadow = true;
      fragment.receiveShadow = true;

      const body = this.physics.add(fragment, {
        type: "dynamic",
        restitution: 0.2,
        friction: 0.6,
        linearDamping: 0.3,
        angularDamping: 0.5,
      });

      // Apply impact impulse only if enabled
      if (body && this.settings.applyImpactForce) {
        const mass = body.mass();
        const distFromImpact = fragment.position.distanceTo(worldPoint);
        const impactFactor = Math.max(0, 1 - distFromImpact / 1.0);

        const direction = fragment.position.clone().sub(worldPoint).normalize();
        const impulseX = direction.x * mass * 2.0 * impactFactor;
        const impulseY = mass * (1.0 + impactFactor * 3.0);
        const impulseZ = direction.z * mass * 2.0 * impactFactor;

        body.applyImpulse({ x: impulseX, y: impulseY, z: impulseZ });
      }
    });

    // Add fragments to scene and tracking
    fragments.forEach((fragment) => {
      this.scene.add(fragment);
      this.allFragments.push(fragment);
    });

    // Hide original and mark as fractured
    mesh.visible = false;
    this.physics.remove(mesh);
    woodObj.fractured = true;

    // Hide markers
    if (this.impactMarker) this.impactMarker.visible = false;
    if (this.radiusMarker) this.radiusMarker.visible = false;
  }

  update(): void {
    // No per-frame updates needed
  }

  getInstructions(): string {
    return `WOOD YARD - Anisotropic Voronoi Showcase

MODE: Click to Fracture or Fire Projectiles
• Click objects to fracture (or fire balls)
• Each object has its own grain direction
• Splinters follow the grain naturally

OPTIONS:
• Impact Clustering - fragments cluster at impact
• Apply Force - push fragments on impact
• Higher anisotropy = longer splinters`;
  }

  setupUI(): FolderApi {
    const folder = this.pane.addFolder({
      title: "Wood Yard",
      expanded: true,
    });

    folder.addBinding(this.settings, "interactionMode", {
      options: {
        "Click to Fracture": "Click to Fracture",
        "Fire Projectiles": "Fire Projectiles",
      },
      label: "Mode",
    });

    folder.addBinding(this.settings, "fragmentCount", {
      min: 15,
      max: 100,
      step: 5,
      label: "Fragments",
    });

    folder.addBinding(this.settings, "anisotropy", {
      min: 1.0,
      max: 10.0,
      step: 0.5,
      label: "Anisotropy",
    });

    folder.addBinding(this.settings, "useImpactPoint", {
      label: "Impact Clustering",
    });

    folder.addBinding(this.settings, "impactRadius", {
      min: 0.1,
      max: 1.5,
      step: 0.1,
      label: "Cluster Radius",
    });

    folder.addBinding(this.settings, "applyImpactForce", {
      label: "Apply Force",
    });

    folder.addButton({ title: "Reset All" }).on("click", () => {
      this.reset();
    });

    return folder;
  }

  reset(): void {
    // Clear physics
    this.clearPhysics();

    // Remove all wood objects
    this.woodObjects.forEach((obj) => {
      this.scene.remove(obj.mesh);
      obj.mesh.dispose();
    });
    this.woodObjects = [];

    // Remove all fragments
    this.cleanupFragments(this.allFragments, false);
    this.allFragments = [];

    // Remove all balls
    this.balls.forEach((ball) => {
      this.scene.remove(ball);
      ball.geometry.dispose();
    });
    this.balls = [];

    // Hide markers
    if (this.impactMarker) this.impactMarker.visible = false;
    if (this.radiusMarker) this.radiusMarker.visible = false;

    // Re-add ground physics
    this.setupGroundPhysics();

    // Recreate wood yard
    this.createWoodYard();
  }

  dispose(): void {
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("click", this.onMouseClick);

    // Dispose wood objects
    this.woodObjects.forEach((obj) => {
      this.scene.remove(obj.mesh);
      obj.mesh.dispose();
    });

    // Dispose fragments
    this.allFragments.forEach((fragment) => {
      this.scene.remove(fragment);
      fragment.geometry.dispose();
    });

    // Dispose balls
    this.balls.forEach((ball) => {
      this.scene.remove(ball);
      ball.geometry.dispose();
    });
    this.ballMaterial.dispose();

    // Dispose markers
    if (this.impactMarker) {
      this.scene.remove(this.impactMarker);
      this.impactMarker.geometry.dispose();
      (this.impactMarker.material as THREE.Material).dispose();
    }
    if (this.radiusMarker) {
      this.scene.remove(this.radiusMarker);
      this.radiusMarker.geometry.dispose();
      (this.radiusMarker.material as THREE.Material).dispose();
    }
  }
}

