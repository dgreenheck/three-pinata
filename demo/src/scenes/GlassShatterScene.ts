import * as THREE from "three";
import { BaseScene } from "./BaseScene";
import {
  DestructibleMesh,
  VoronoiFractureOptions,
} from "@dgreenheck/three-pinata";

/**
 * Glass Shattering Demo
 * - Vertical glass pane
 * - Click to shatter at impact point
 * - 2.5D Voronoi fracturing only
 */
export class GlassShatterScene extends BaseScene {
  private glassPane: DestructibleMesh | null = null;
  private glassMaterial!: THREE.MeshPhysicalMaterial;
  private insideMaterial!: THREE.MeshStandardMaterial;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private fractureOptions = new VoronoiFractureOptions({
    mode: "2.5D",
    fragmentCount: 50,
  });
  private settings = {
    useImpactPoint: true,
  };
  private impactMarker: THREE.Mesh | null = null;
  private hasShattered = false;

  async init(): Promise<void> {
    // Setup camera
    this.camera.position.set(0, 2, 8);
    this.controls.target.set(0, 2, 0);
    this.controls.update();

    // Create materials
    this.glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x88ccff,
      metalness: 0.2,
      roughness: 0.05,
      transmission: 0.5,
      thickness: 0.1,
      envMapIntensity: 1.0,
      transparent: true,
      opacity: 0.8,
    });

    this.insideMaterial = this.glassMaterial.clone();

    // Create impact marker (hidden initially)
    const markerGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.7,
    });
    this.impactMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    this.impactMarker.visible = false;
    this.scene.add(this.impactMarker);

    // Create glass pane
    this.createGlassPane();

    // Add click listener
    window.addEventListener("click", this.onMouseClick);
  }

  private createGlassPane(): void {
    // Create a thin vertical pane
    const glassGeometry = new THREE.BoxGeometry(4, 6, 0.2, 1, 1, 1);
    this.glassPane = new DestructibleMesh(glassGeometry, this.glassMaterial);
    this.glassPane.mesh.castShadow = true;
    this.glassPane.mesh.receiveShadow = true;
    this.glassPane.position.set(0, 3, 0);
    this.scene.add(this.glassPane);
  }

  private onMouseClick = (event: MouseEvent): void => {
    if (this.hasShattered || !this.glassPane) return;

    // Calculate mouse position in normalized device coordinates
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Raycast to find intersection with glass pane
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(
      this.glassPane.mesh,
      false,
    );

    if (intersects.length > 0) {
      const intersectionPoint = intersects[0].point;

      // Convert to local space
      const localPoint = this.glassPane.worldToLocal(intersectionPoint.clone());

      // Show impact marker
      if (this.settings.useImpactPoint && this.impactMarker) {
        this.impactMarker.position.copy(intersectionPoint);
        this.impactMarker.visible = true;
      }

      // Fracture the glass
      this.fractureOptions.impactPoint = this.settings.useImpactPoint
        ? localPoint
        : undefined;
      this.fractureOptions.projectionAxis = "z"; // Project along the thin axis

      this.glassPane.fracture(this.fractureOptions, false, (fragment) => {
        // Setup fragment with dual materials
        fragment.material = [this.glassMaterial, this.insideMaterial];
        fragment.castShadow = true;

        // Add physics
        const body = this.physics.add(fragment, {
          type: "dynamic",
          collider: "convexHull",
          restitution: 0.2,
        });

        // Add a small random impulse for dramatic effect
        const impulse = new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          Math.random() * 0.2,
          (Math.random() - 0.5) * 2,
        );
        const rapierImpulse = { x: impulse.x, y: impulse.y, z: impulse.z };
        body.rigidBody.applyImpulse(rapierImpulse, true);
      });

      this.hasShattered = true;
    }
  };

  update(deltaTime: number): void {
    // No per-frame updates needed
  }

  setupUI(): void {
    const folder = this.pane.addFolder({
      title: "Glass Shatter",
      expanded: true,
    });

    folder.addBinding(this.fractureOptions, "fragmentCount", {
      min: 10,
      max: 200,
      step: 1,
      label: "Fragment Count",
    });

    folder.addBinding(this.settings, "useImpactPoint", {
      label: "Impact Point",
    });

    folder.addButton({ title: "Reset" }).on("click", () => {
      this.reset();
    });
  }

  reset(): void {
    // Remove old glass pane
    if (this.glassPane) {
      this.scene.remove(this.glassPane);
      this.glassPane.dispose();
    }

    // Hide impact marker
    if (this.impactMarker) {
      this.impactMarker.visible = false;
    }

    // Recreate glass pane
    this.createGlassPane();
    this.hasShattered = false;
  }

  dispose(): void {
    // Remove click listener
    window.removeEventListener("click", this.onMouseClick);

    // Remove glass pane
    if (this.glassPane) {
      this.scene.remove(this.glassPane);
      this.glassPane.dispose();
    }

    // Remove impact marker
    if (this.impactMarker) {
      this.scene.remove(this.impactMarker);
      this.impactMarker.geometry.dispose();
      (this.impactMarker.material as THREE.Material).dispose();
    }
  }
}
