import * as THREE from "three";
import { BaseScene } from "./BaseScene";
import {
  DestructibleMesh,
  VoronoiFractureOptions,
  FractureOptions,
  fracture,
} from "@dgreenheck/three-pinata";

/**
 * Glass Shattering Demo
 * - Vertical glass pane
 * - Click to shatter at impact point
 * - Choose between Voronoi or Simple fracturing
 */
export class GlassShatterScene extends BaseScene {
  private glassPane: DestructibleMesh | null = null;
  private glassMaterial!: THREE.MeshPhysicalMaterial;
  private insideMaterial!: THREE.MeshStandardMaterial;
  private wireframeMaterial!: THREE.MeshBasicMaterial;
  private voronoiFractureOptions = new VoronoiFractureOptions({
    mode: "2.5D",
    fragmentCount: 50,
  });
  private simpleFractureOptions = new FractureOptions({
    fragmentCount: 50,
    fractureMode: "Non-Convex",
  });
  private settings = {
    fractureMethod: "Voronoi" as "Voronoi" | "Simple",
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
    this.glassMaterial = this.materialFactory.createGlassMaterial();
    this.insideMaterial = this.materialFactory.createGlassInsideMaterial();
    this.wireframeMaterial = this.materialFactory.createWireframeMaterial();

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
    this.glassPane.mesh.receiveShadow = false;
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

        if (this.settings.fractureMethod === "Voronoi") {
          this.fractureWithVoronoi(localPoint);
        } else {
          this.fractureWithSimple();
        }

        this.impactMarker.visible = false;
        this.radiusMarker.visible = false;

        this.hasShattered = true;
      }
    }
  };

  private fractureWithVoronoi(localPoint: THREE.Vector3): void {
    if (!this.glassPane) return;

    // Configure Voronoi fracture options
    this.voronoiFractureOptions.impactPoint = this.settings.useImpactPoint
      ? localPoint
      : undefined;
    this.voronoiFractureOptions.impactRadius = this.settings.useImpactPoint
      ? this.settings.impactRadius
      : undefined;
    this.voronoiFractureOptions.projectionAxis = "z"; // Project along the thin axis

    this.glassPane.fracture(this.voronoiFractureOptions, false, (fragment) => {
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
  }

  private fractureWithSimple(): void {
    if (!this.glassPane) return;

    const fragmentGeometries = fracture(
      this.glassPane.mesh.geometry,
      this.simpleFractureOptions,
    );

    // Hide the original mesh
    this.glassPane.mesh.visible = false;

    // Create mesh objects for each fragment
    fragmentGeometries.forEach((fragmentGeometry: THREE.BufferGeometry) => {
      // Compute bounding box to get the center of this fragment
      fragmentGeometry.computeBoundingBox();
      const center = new THREE.Vector3();
      fragmentGeometry.boundingBox!.getCenter(center);

      // Translate the geometry so its center is at the origin
      fragmentGeometry.translate(-center.x, -center.y, -center.z);

      // Recompute bounding sphere after translation
      fragmentGeometry.computeBoundingSphere();

      const fragment = new THREE.Mesh(
        fragmentGeometry,
        this.settings.wireframe
          ? this.wireframeMaterial
          : [this.glassMaterial, this.insideMaterial],
      );

      // Position the fragment at its original center within the group
      fragment.position.copy(center);
      fragment.castShadow = true;
      fragment.visible = true;

      // Add as child to the DestructibleMesh group
      this.glassPane!.add(fragment);
      this.glassPane!.fragments.push(fragment);

      // Add physics
      this.physics.add(fragment, {
        type: "dynamic",
        collider: "convexHull",
        restitution: 0.2,
      });
    });
  }

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

  update(_deltaTime: number): void {
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

    folder
      .addBinding(this.settings, "fractureMethod", {
        options: {
          "Voronoi (High Quality, Slow)": "Voronoi",
          "Simple (Low Quality, Fast)": "Simple",
        },
        label: "Fracture Method",
      })
      .on("change", () => {
        // Update fragment count for both options when method changes
        this.simpleFractureOptions.fragmentCount =
          this.voronoiFractureOptions.fragmentCount;
      });

    folder
      .addBinding(this.voronoiFractureOptions, "fragmentCount", {
        min: 10,
        max: 200,
        step: 1,
        label: "Fragment Count",
      })
      .on("change", () => {
        // Keep both fracture options in sync
        this.simpleFractureOptions.fragmentCount =
          this.voronoiFractureOptions.fragmentCount;
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
