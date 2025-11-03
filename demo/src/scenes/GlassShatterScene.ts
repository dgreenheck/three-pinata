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
  private wireframeMaterial!: THREE.MeshBasicMaterial;
  private fractureOptions = new VoronoiFractureOptions({
    mode: "2.5D",
    fragmentCount: 50,
  });
  private settings = {
    useImpactPoint: true,
    impactRadius: 1.0,
    wireframe: false,
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

    this.wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
    });

    // Create impact marker (hidden initially)
    const markerGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
    });
    this.impactMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    this.impactMarker.visible = false;
    this.scene.add(this.impactMarker);

    // Create radius marker (wireframe sphere)
    const radiusGeometry = new THREE.SphereGeometry(1, 16, 16);
    const radiusMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
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

    this.updateMouseCoordinates(event);

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
    if (!this.glassPane) return;

    this.updateMouseCoordinates(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    if (this.hasShattered) {
      // Click fragments to apply explosive force
      this.handleExplosiveClick(this.glassPane.fragments, 1.5, 20.0);
    } else {
      // Initial click to shatter
      const intersects = this.raycaster.intersectObject(
        this.glassPane.mesh,
        false,
      );

      if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point;
        const localPoint = this.glassPane.worldToLocal(
          intersectionPoint.clone(),
        );

        // Fracture the glass
        this.fractureOptions.impactPoint = this.settings.useImpactPoint
          ? localPoint
          : undefined;
        this.fractureOptions.impactRadius = this.settings.useImpactPoint
          ? this.settings.impactRadius
          : undefined;
        this.fractureOptions.projectionAxis = "z"; // Project along the thin axis

        this.glassPane.fracture(this.fractureOptions, false, (fragment) => {
          fragment.material = this.settings.wireframe
            ? this.wireframeMaterial
            : [this.glassMaterial, this.insideMaterial];
          fragment.castShadow = true;

          this.physics.add(fragment, {
            type: "dynamic",
            collider: "convexHull",
            restitution: 0.2,
          });
        });

        this.impactMarker.visible = false;
        this.radiusMarker.visible = false;

        this.hasShattered = true;
      }
    }
  };

  private updateWireframe(): void {
    if (!this.glassPane) return;

    const material = this.settings.wireframe
      ? this.wireframeMaterial
      : [this.glassMaterial, this.insideMaterial];

    // Update main mesh if not yet shattered
    if (!this.hasShattered && this.glassPane.mesh) {
      this.glassPane.mesh.material = this.settings.wireframe
        ? this.wireframeMaterial
        : this.glassMaterial;
    }

    // Update all fragments
    this.glassPane.fragments.forEach((fragment) => {
      fragment.material = material;
    });
  }

  update(deltaTime: number): void {
    // No per-frame updates needed
  }

  getInstructions(): string {
    return `GLASS SHATTER

• Hover over glass to preview impact area
• Click to shatter at impact point
• Click fragments to apply explosive force
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

    folder
      .addBinding(this.settings, "wireframe", {
        label: "Wireframe",
      })
      .on("change", () => {
        this.updateWireframe();
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
