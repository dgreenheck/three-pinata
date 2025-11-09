import * as THREE from "three";
import { FolderApi, ButtonApi } from "tweakpane";
import { BaseScene } from "./BaseScene";
import {
  DestructibleMesh,
  FractureOptions,
} from "@dgreenheck/three-pinata";

/**
 * Glass Shattering Demo
 * - Vertical glass pane
 * - Click to shatter at impact point
 * - Choose between Voronoi or Simple fracturing
 */
export class GlassShatterScene extends BaseScene {
  private glassPane: DestructibleMesh | null = null;
  private fragments: THREE.Mesh[] = [];
  private glassMaterial!: THREE.MeshPhysicalMaterial;
  private insideMaterial!: THREE.MeshStandardMaterial;
  private fractureOptions = new FractureOptions({
    fractureMethod: "voronoi",
    fragmentCount: 50,
    voronoiOptions: {
      mode: "2.5D",
    },
  });
  private settings = {
    fractureMethod: "Voronoi" as "Voronoi" | "Simple",
    useImpactPoint: true,
    impactRadius: 1.0,
  };
  private impactMarker: THREE.Mesh | null = null;
  private radiusMarker: THREE.Mesh | null = null;
  private hasShattered = false;
  private resetButton: ButtonApi | null = null;

  async init(): Promise<void> {
    // Setup camera
    this.camera.position.set(1, 4, 8);
    this.controls.target.set(0, 2, 0);
    this.controls.update();

    // Create materials
    this.glassMaterial = this.materialFactory.createGlassMaterial();
    this.insideMaterial = this.materialFactory.createGlassInsideMaterial();

    // Create impact and radius markers
    const markers = this.createImpactMarkers();
    this.impactMarker = markers.impact;
    this.radiusMarker = markers.radius;

    // Create glass pane
    this.createGlassPane();

    // Add event listeners
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("click", this.onMouseClick);
  }

  private createGlassPane(): void {
    // Clear fragments
    this.fragments = [];

    // Create a thin vertical pane
    const glassGeometry = new THREE.BoxGeometry(4, 6, 0.2, 1, 1, 1);
    this.glassPane = new DestructibleMesh(
      glassGeometry,
      this.glassMaterial,
      this.insideMaterial,
    );
    this.glassPane.castShadow = true;
    this.glassPane.receiveShadow = false;
    this.glassPane.position.set(0, 3, 0);
    this.scene.add(this.glassPane);
  }

  private onMouseMove = (event: MouseEvent): void => {
    if (this.hasShattered || !this.glassPane) return;

    this.updateMouseCoordinates(event);

    // Raycast to find intersection with glass pane
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.glassPane, false);

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
      this.handleExplosiveClick(this.fragments, 1.5, 20.0);
    } else {
      // Initial click to shatter
      const intersects = this.raycaster.intersectObject(this.glassPane, false);

      if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point;
        const localPoint = this.glassPane.worldToLocal(
          intersectionPoint.clone(),
        );

        this.fractureGlassPane(localPoint);

        this.impactMarker.visible = false;
        this.radiusMarker.visible = false;

        this.hasShattered = true;
      }
    }
  };

  private fractureGlassPane(localPoint: THREE.Vector3): void {
    if (!this.glassPane) return;

    // Disable reset button and show fracturing message
    if (this.resetButton) {
      this.resetButton.disabled = true;
      this.resetButton.title = "Shattering...";
    }

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      if (!this.glassPane) return;

      // Configure fracture options based on settings
      this.fractureOptions.fractureMethod =
        this.settings.fractureMethod === "Voronoi" ? "voronoi" : "simple";

      // Configure Voronoi-specific options
      if (
        this.settings.fractureMethod === "Voronoi" &&
        this.fractureOptions.voronoiOptions
      ) {
        this.fractureOptions.voronoiOptions.impactPoint = this.settings
          .useImpactPoint
          ? localPoint
          : undefined;
        this.fractureOptions.voronoiOptions.impactRadius = this.settings
          .useImpactPoint
          ? this.settings.impactRadius
          : undefined;
        this.fractureOptions.voronoiOptions.projectionAxis = "z"; // Project along the thin axis
      }

      this.fragments = this.glassPane.fracture(this.fractureOptions, (fragment) => {
        fragment.castShadow = true;

        this.physics.add(fragment, {
          type: "dynamic",
          restitution: 0.2,
        });
      });

      // Add fragments to scene
      this.fragments.forEach((fragment) => {
        this.scene.add(fragment);
      });

      // Hide original glass pane
      this.glassPane.visible = false;

      // Re-enable reset button
      if (this.resetButton) {
        this.resetButton.disabled = false;
        this.resetButton.title = "Reset";
      }
    }, 10);
  }

  update(): void {
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

  setupUI(): FolderApi {
    const folder = this.pane.addFolder({
      title: "Glass Shatter",
      expanded: true,
    });

    folder
      .addBinding(this.settings, "fractureMethod", {
        options: BaseScene.FRACTURE_METHOD_OPTIONS,
        label: "Fracture Method",
      })
      .on("change", () => {
        // Enable/disable impact controls based on fracture method
        const isSimple = this.settings.fractureMethod === "Simple";
        useImpactPointBinding.disabled = isSimple;
        impactRadiusBinding.disabled = isSimple;
      });

    folder.addBinding(this.fractureOptions, "fragmentCount", {
      min: 2,
      max: 64,
      step: 1,
      label: "Fragment Count",
    });

    const useImpactPointBinding = folder.addBinding(
      this.settings,
      "useImpactPoint",
      {
        label: "Impact Point",
      },
    );

    const impactRadiusBinding = folder.addBinding(
      this.settings,
      "impactRadius",
      {
        min: 0.5,
        max: 3.0,
        step: 0.1,
        label: "Impact Radius",
      },
    );

    this.resetButton = folder.addButton({ title: "Reset" }).on("click", () => {
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

    // Remove all fragments
    this.cleanupFragments(this.fragments);
    this.fragments = [];

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
