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
    impactRadius: 1.0,
  };
  private impactMarker: THREE.Mesh | null = null;
  private radiusMarker: THREE.Mesh | null = null;
  private hasShattered = false;

  async init(): Promise<void> {
    // Setup camera
    this.camera.position.set(0, 2, 8);
    this.controls.target.set(0, 2, 0);
    this.controls.update();

    // Create materials
    this.glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x88ffff,
      metalness: 0.2,
      roughness: 0.05,
      transmission: 0.5,
      thickness: 0.1,
      envMapIntensity: 1.0,
      transparent: true,
      opacity: 0.8,
    });

    this.insideMaterial = this.glassMaterial.clone();
    this.insideMaterial.color = new THREE.Color(0x88ffee);

    // Create impact marker (hidden initially)
    const markerGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.7,
    });
    this.impactMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    this.impactMarker.visible = false;
    this.scene.add(this.impactMarker);

    // Create radius marker (wireframe sphere)
    const radiusGeometry = new THREE.SphereGeometry(1, 16, 16);
    const radiusMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.3,
      wireframe: true,
    });
    this.radiusMarker = new THREE.Mesh(radiusGeometry, radiusMaterial);
    this.radiusMarker.visible = false;
    this.scene.add(this.radiusMarker);

    // Create glass pane
    this.createGlassPane();

    // Add event listeners
    window.addEventListener("mousemove", this.onMouseMove);
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

  private onMouseMove = (event: MouseEvent): void => {
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

      // Show impact marker and radius visualization
      if (
        this.settings.useImpactPoint &&
        this.impactMarker &&
        this.radiusMarker
      ) {
        this.impactMarker.position.copy(intersectionPoint);
        this.impactMarker.visible = true;

        // Position and scale the radius marker
        this.radiusMarker.position.copy(intersectionPoint);
        this.radiusMarker.scale.setScalar(this.settings.impactRadius);
        this.radiusMarker.visible = true;
      }
    } else {
      // Hide markers when not hovering over glass
      if (this.impactMarker) this.impactMarker.visible = false;
      if (this.radiusMarker) this.radiusMarker.visible = false;
    }
  };

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

      // Fracture the glass
      this.fractureOptions.impactPoint = this.settings.useImpactPoint
        ? localPoint
        : undefined;
      this.fractureOptions.impactRadius = this.settings.useImpactPoint
        ? this.settings.impactRadius
        : undefined;
      this.fractureOptions.projectionAxis = "z"; // Project along the thin axis

      this.glassPane.fracture(this.fractureOptions, false, (fragment) => {
        // Setup fragment with dual materials
        fragment.material = [this.glassMaterial, this.insideMaterial];
        fragment.castShadow = true;

        // Add physics (validation now happens in PhysicsWorld.add)
        this.physics.add(fragment, {
          type: "dynamic",
          collider: "convexHull",
          restitution: 0.2,
        });
      });

      this.hasShattered = true;
    }
  };

  update(deltaTime: number): void {
    // No per-frame updates needed
  }

  getInstructions(): string {
    return `GLASS SHATTER

• Hover over glass to preview impact area
• Click to shatter at impact point
• Adjust fragment count and impact radius
• Toggle impact point clustering`;
  }

  setupUI(): any {
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

    folder.addBinding(this.settings, "impactRadius", {
      min: 0.5,
      max: 3.0,
      step: 0.1,
      label: "Impact Radius",
    });

    folder.addButton({ title: "Reset" }).on("click", () => {
      this.reset();
    });

    return folder;
  }

  reset(): void {
    // Clear all physics first
    this.clearPhysics();

    // Remove old glass pane
    if (this.glassPane) {
      this.scene.remove(this.glassPane);
      this.glassPane.dispose();
    }

    // Hide markers
    if (this.impactMarker) {
      this.impactMarker.visible = false;
    }
    if (this.radiusMarker) {
      this.radiusMarker.visible = false;
    }

    // Re-add ground physics
    this.setupGroundPhysics();

    // Recreate glass pane
    this.createGlassPane();
    this.hasShattered = false;
  }

  dispose(): void {
    // Remove event listeners
    window.removeEventListener("mousemove", this.onMouseMove);
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

    // Remove radius marker
    if (this.radiusMarker) {
      this.scene.remove(this.radiusMarker);
      this.radiusMarker.geometry.dispose();
      (this.radiusMarker.material as THREE.Material).dispose();
    }
  }
}
