import * as THREE from "three";
import { FolderApi } from "tweakpane";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BaseScene } from "./BaseScene";
import { DestructibleMesh, FractureOptions } from "@dgreenheck/three-pinata";
import {
  createVoronoiMaterial,
  updateVoronoiMaterialSettings,
  VoronoiShaderSettings,
} from "../shaders/voronoiShader";

import teaCupUrl from "../assets/tea_cup.glb";
import envMapUrl from "../assets/autumn_field_puresky_4k.jpg";
import { PMREMGenerator } from "three";

interface FragmentState {
  fragment: THREE.Mesh;
  originalPosition: THREE.Vector3;
  originalRotation: THREE.Euler;
  explodedPosition: THREE.Vector3;
  randomRotation: THREE.Euler;
}

/**
 * Kintsugi Demo
 * - Demonstrates the Japanese art of kintsugi (golden joinery)
 * - Shows Voronoi fracture patterns with gold-filled cracks
 * - Animated explosion/assembly with dissolve effect
 */
export class KintsugiScene extends BaseScene {
  private teaCupGeometry: THREE.BufferGeometry | null = null;
  private teaCupMaterial: THREE.MeshStandardMaterial | null = null;
  private teaCupTexture: THREE.Texture | null = null;
  private kintsugiEnvMap: THREE.Texture | null = null;

  private fragments: THREE.Mesh[] = [];
  private fragmentStates: FragmentState[] = [];
  private voronoiMesh: THREE.Mesh | null = null;
  private voronoiSeeds: THREE.Vector3[] = [];

  private animationTime = 0;
  private isAnimating = false;

  private settings: VoronoiShaderSettings & {
    fragmentCount: number;
    explosionAmount: number;
    explosionDistance: number;
    playAnimation: boolean;
    explosionDuration: number;
    dissolveDuration: number;
    endBuffer: number;
  } = {
    fragmentCount: 32,
    explosionAmount: 0.0,
    explosionDistance: 2.0,
    lineWidth: 0.03,
    goldColor: { r: 255, g: 215, b: 0 },
    noiseOctaves: 4,
    noiseFrequency: 3.0,
    noiseAmplitude: 0.02,
    noiseLacunarity: 2.0,
    noisePersistence: 0.5,
    bevelStrength: 1.0,
    bevelWidth: 0.007,
    dissolveThreshold: 1.826,
    dissolveEdgeWidth: 0.29,
    dissolveEdgeIntensity: 10.0,
    dissolveColor: { r: 255, g: 241, b: 150 },
    playAnimation: false,
    explosionDuration: 2.0,
    dissolveDuration: 1.0,
    endBuffer: 3.0,
  };

  async init(): Promise<void> {
    // Setup camera for viewing the tea cup
    this.camera.position.set(5, 3, 5);
    this.controls.target.set(0, 3, 0);
    this.controls.update();

    // Load environment map for reflections
    await this.loadKintsugiEnvMap();

    // Load the tea cup model
    await this.loadTeaCupModel();

    // Create the fractured object
    this.createFracturedObject();
  }

  private async loadKintsugiEnvMap(): Promise<void> {
    const loader = new THREE.TextureLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        envMapUrl,
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          texture.colorSpace = THREE.SRGBColorSpace;

          // Use PMREMGenerator to create prefiltered mipmapped environment map
          const pmremGenerator = new PMREMGenerator(this.renderer!);
          pmremGenerator.compileEquirectangularShader();
          const envMapRT = pmremGenerator.fromEquirectangular(texture);
          this.kintsugiEnvMap = envMapRT.texture;
          pmremGenerator.dispose();
          texture.dispose();

          resolve();
        },
        undefined,
        reject,
      );
    });
  }

  private async loadTeaCupModel(): Promise<void> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(teaCupUrl);

    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        this.teaCupGeometry = mesh.geometry;
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          this.teaCupMaterial = mesh.material;
          this.teaCupTexture = mesh.material.map;
        }
      }
    });

    if (!this.teaCupGeometry) {
      throw new Error("No mesh found in tea cup model");
    }
  }

  private generateVoronoiSeeds(
    boundingBox: THREE.Box3,
    count: number,
  ): THREE.Vector3[] {
    const seeds: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      seeds.push(
        new THREE.Vector3(
          THREE.MathUtils.lerp(
            boundingBox.min.x,
            boundingBox.max.x,
            Math.random(),
          ),
          THREE.MathUtils.lerp(
            boundingBox.min.y,
            boundingBox.max.y,
            Math.random(),
          ),
          THREE.MathUtils.lerp(
            boundingBox.min.z,
            boundingBox.max.z,
            Math.random(),
          ),
        ),
      );
    }
    return seeds;
  }

  private cleanup(): void {
    // Remove and dispose fragments
    this.fragments.forEach((fragment) => {
      this.scene.remove(fragment);
      fragment.geometry.dispose();
      if (Array.isArray(fragment.material)) {
        fragment.material.forEach((mat) => mat.dispose());
      } else {
        fragment.material.dispose();
      }
    });
    this.fragments = [];
    this.fragmentStates = [];

    // Remove and dispose voronoi mesh
    if (this.voronoiMesh) {
      this.scene.remove(this.voronoiMesh);
      this.voronoiMesh.geometry.dispose();
      if (this.voronoiMesh.material instanceof THREE.Material) {
        this.voronoiMesh.material.dispose();
      }
      this.voronoiMesh = null;
    }
  }

  private createFracturedObject(): void {
    if (!this.teaCupGeometry) {
      console.error("Tea cup model not loaded yet");
      return;
    }

    this.cleanup();

    const geometry = this.teaCupGeometry.clone();
    const originalGeometry = this.teaCupGeometry.clone();

    // Compute bounding box and generate seeds
    geometry.computeBoundingBox();
    if (!geometry.boundingBox) {
      geometry.boundingBox = new THREE.Box3();
      geometry.computeBoundingBox();
    }
    this.voronoiSeeds = this.generateVoronoiSeeds(
      geometry.boundingBox,
      this.settings.fragmentCount,
    );

    // Create materials for fragments
    const fragmentMaterial = new THREE.MeshPhysicalMaterial({
      map: this.teaCupTexture,
      roughness: 0.1,
      metalness: 0.3,
      clearcoat: 0.5,
      clearcoatRoughness: 0.2,
      envMap: this.kintsugiEnvMap,
    });

    const insideMaterial = new THREE.MeshStandardMaterial({
      color: 0x202020,
      roughness: 1.0,
      metalness: 0.0,
    });

    // Create and fracture mesh
    const destructibleMesh = new DestructibleMesh(
      geometry,
      fragmentMaterial,
      insideMaterial,
    );

    const fractureOptions = new FractureOptions({
      fractureMethod: "voronoi",
      fragmentCount: this.settings.fragmentCount,
      voronoiOptions: {
        mode: "3D",
        seedPoints: this.voronoiSeeds,
      },
    });

    this.fragments = destructibleMesh.fracture(fractureOptions);

    // Setup fragment states and add to scene
    this.fragments.forEach((fragment) => {
      fragment.position.y += 3; // Raise the teacup
      fragment.castShadow = true;
      fragment.receiveShadow = true;
      const state = this.calculateFragmentState(fragment);
      this.fragmentStates.push(state);
      fragment.position.copy(state.originalPosition);
      this.scene.add(fragment);
    });

    // Create Voronoi visualization mesh with the kintsugi shader
    const voronoiMaterial = createVoronoiMaterial(
      this.voronoiSeeds,
      this.settings,
      this.teaCupTexture,
      this.kintsugiEnvMap,
    );
    this.voronoiMesh = new THREE.Mesh(originalGeometry, voronoiMaterial);
    this.voronoiMesh.position.y = 3; // Raise the teacup
    this.voronoiMesh.castShadow = true;
    this.voronoiMesh.receiveShadow = true;
    this.voronoiMesh.visible = this.settings.explosionAmount === 0;
    this.scene.add(this.voronoiMesh);

    this.updateFragmentPositions();
  }

  private calculateFragmentState(fragment: THREE.Mesh): FragmentState {
    const originalPosition = fragment.position.clone();
    const originalRotation = fragment.rotation.clone();

    // Calculate direction relative to teacup center (at y=2), not world origin
    const teacupCenter = new THREE.Vector3(0, 2, 0);
    const direction = fragment.position.clone().sub(teacupCenter).normalize();
    const explodedPosition = originalPosition
      .clone()
      .add(direction.clone().multiplyScalar(this.settings.explosionDistance));

    const randomRotation = new THREE.Euler(
      (Math.random() - 0.5) * Math.PI * 2,
      (Math.random() - 0.5) * Math.PI * 2,
      (Math.random() - 0.5) * Math.PI * 2,
    );

    return {
      fragment,
      originalPosition,
      originalRotation,
      explodedPosition,
      randomRotation,
    };
  }

  private recalculateExplosionPositions(): void {
    const teacupCenter = new THREE.Vector3(0, 2, 0);
    this.fragmentStates.forEach((state) => {
      const direction = state.originalPosition
        .clone()
        .sub(teacupCenter)
        .normalize();
      state.explodedPosition = state.originalPosition
        .clone()
        .add(direction.multiplyScalar(this.settings.explosionDistance));
    });
  }

  private updateFragmentPositions(): void {
    const showFragments = this.settings.explosionAmount > 0.001;

    this.fragmentStates.forEach((state) => {
      state.fragment.visible = showFragments;

      state.fragment.position.lerpVectors(
        state.originalPosition,
        state.explodedPosition,
        this.settings.explosionAmount,
      );

      state.fragment.rotation.set(
        state.originalRotation.x +
          state.randomRotation.x * this.settings.explosionAmount,
        state.originalRotation.y +
          state.randomRotation.y * this.settings.explosionAmount,
        state.originalRotation.z +
          state.randomRotation.z * this.settings.explosionAmount,
      );
    });

    if (this.voronoiMesh) {
      this.voronoiMesh.visible = this.settings.explosionAmount < 0.001;
    }
  }

  private updateAnimation(deltaTime: number): void {
    if (!this.isAnimating) return;

    this.animationTime += deltaTime;

    const explosionDuration = this.settings.explosionDuration;
    const dissolveDuration = this.settings.dissolveDuration;
    const endBuffer = this.settings.endBuffer;
    const totalDuration = explosionDuration + dissolveDuration + endBuffer;

    // Loop animation
    if (this.animationTime > totalDuration) {
      this.animationTime = 0;
    }

    // Phase 1: Explosion (pieces come together)
    if (this.animationTime < explosionDuration) {
      const t = this.animationTime / explosionDuration;
      const easedT = 1 - (1 - t) * (1 - t); // ease-out (quadratic)
      this.settings.explosionAmount = 1.0 - easedT;
      this.settings.dissolveThreshold = -1;
      if (this.voronoiMesh?.material instanceof THREE.MeshPhysicalMaterial) {
        updateVoronoiMaterialSettings(this.voronoiMesh.material, {
          dissolveThreshold: this.settings.dissolveThreshold,
        });
      }
      this.updateFragmentPositions();
    }
    // Phase 2: Dissolve (veins appear)
    else if (this.animationTime < explosionDuration + dissolveDuration) {
      this.settings.explosionAmount = 0;
      const t = (this.animationTime - explosionDuration) / dissolveDuration;
      this.settings.dissolveThreshold = -1 + t * 3;
      if (this.voronoiMesh?.material instanceof THREE.MeshPhysicalMaterial) {
        updateVoronoiMaterialSettings(this.voronoiMesh.material, {
          dissolveThreshold: this.settings.dissolveThreshold,
        });
      }
      this.updateFragmentPositions();
    }
    // Phase 3: End buffer (hold final state)
    else {
      this.settings.explosionAmount = 0;
      this.settings.dissolveThreshold = 2.0;
      if (this.voronoiMesh?.material instanceof THREE.MeshPhysicalMaterial) {
        updateVoronoiMaterialSettings(this.voronoiMesh.material, {
          dissolveThreshold: this.settings.dissolveThreshold,
        });
      }
      this.updateFragmentPositions();
    }
  }

  update(deltaTime: number): void {
    // Handle animation toggle
    if (this.settings.playAnimation && !this.isAnimating) {
      this.isAnimating = true;
      this.animationTime = 0;
    } else if (!this.settings.playAnimation && this.isAnimating) {
      this.isAnimating = false;
    }

    if (this.isAnimating) {
      this.updateAnimation(deltaTime);
    }
  }

  getInstructions(): string {
    return `KINTSUGI

• Adjust explosion to see fragments scatter
• Use dissolve to reveal golden veins
• Play animation to see full effect
• Customize line width and noise for varied crack patterns
• Refracture to generate new patterns`;
  }

  setupUI(): FolderApi {
    const folder = this.pane.addFolder({
      title: "Kintsugi",
      expanded: true,
    });

    // Fracture folder
    const fractureFolder = folder.addFolder({
      title: "Fracture",
      expanded: true,
    });

    fractureFolder.addBinding(this.settings, "fragmentCount", {
      min: 10,
      max: 64,
      step: 1,
      label: "Fragments",
    });

    fractureFolder.addButton({ title: "Refracture" }).on("click", () => {
      this.createFracturedObject();
    });

    // Animation folder
    const animationFolder = folder.addFolder({
      title: "Animation",
      expanded: true,
    });

    animationFolder.addBinding(this.settings, "playAnimation", {
      label: "Play",
    });

    animationFolder
      .addBinding(this.settings, "explosionAmount", {
        min: 0.0,
        max: 1.0,
        step: 0.001,
        label: "Explosion",
      })
      .on("change", () => {
        this.updateFragmentPositions();
      });

    animationFolder
      .addBinding(this.settings, "explosionDistance", {
        min: 0.5,
        max: 10.0,
        step: 0.1,
        label: "Distance",
      })
      .on("change", () => {
        this.recalculateExplosionPositions();
        this.updateFragmentPositions();
      });

    animationFolder.addBinding(this.settings, "explosionDuration", {
      min: 0.5,
      max: 5.0,
      step: 0.1,
      label: "Explosion Time",
    });

    animationFolder.addBinding(this.settings, "dissolveDuration", {
      min: 0.5,
      max: 10.0,
      step: 0.1,
      label: "Dissolve Time",
    });

    // Gold Veins folder
    const veinsFolder = folder.addFolder({
      title: "Gold Veins",
      expanded: false,
    });

    veinsFolder
      .addBinding(this.settings, "lineWidth", {
        min: 0.001,
        max: 0.1,
        step: 0.001,
        label: "Width",
      })
      .on("change", () => {
        if (this.voronoiMesh?.material instanceof THREE.MeshPhysicalMaterial) {
          updateVoronoiMaterialSettings(this.voronoiMesh.material, {
            lineWidth: this.settings.lineWidth,
          });
        }
      });

    veinsFolder
      .addBinding(this.settings, "noiseOctaves", {
        min: 0,
        max: 8,
        step: 1,
        label: "Octaves",
      })
      .on("change", () => {
        if (this.voronoiMesh?.material instanceof THREE.MeshPhysicalMaterial) {
          updateVoronoiMaterialSettings(this.voronoiMesh.material, {
            noiseOctaves: this.settings.noiseOctaves,
          });
        }
      });

    veinsFolder
      .addBinding(this.settings, "noiseFrequency", {
        min: 0.1,
        max: 10.0,
        step: 0.1,
        label: "Frequency",
      })
      .on("change", () => {
        if (this.voronoiMesh?.material instanceof THREE.MeshPhysicalMaterial) {
          updateVoronoiMaterialSettings(this.voronoiMesh.material, {
            noiseFrequency: this.settings.noiseFrequency,
          });
        }
      });

    veinsFolder
      .addBinding(this.settings, "noiseAmplitude", {
        min: 0.0,
        max: 0.1,
        step: 0.001,
        label: "Amplitude",
      })
      .on("change", () => {
        if (this.voronoiMesh?.material instanceof THREE.MeshPhysicalMaterial) {
          updateVoronoiMaterialSettings(this.voronoiMesh.material, {
            noiseAmplitude: this.settings.noiseAmplitude,
          });
        }
      });

    veinsFolder
      .addBinding(this.settings, "noiseLacunarity", {
        min: 1.0,
        max: 4.0,
        step: 0.1,
        label: "Lacunarity",
      })
      .on("change", () => {
        if (this.voronoiMesh?.material instanceof THREE.MeshPhysicalMaterial) {
          updateVoronoiMaterialSettings(this.voronoiMesh.material, {
            noiseLacunarity: this.settings.noiseLacunarity,
          });
        }
      });

    veinsFolder
      .addBinding(this.settings, "noisePersistence", {
        min: 0.0,
        max: 1.0,
        step: 0.01,
        label: "Persistence",
      })
      .on("change", () => {
        if (this.voronoiMesh?.material instanceof THREE.MeshPhysicalMaterial) {
          updateVoronoiMaterialSettings(this.voronoiMesh.material, {
            noisePersistence: this.settings.noisePersistence,
          });
        }
      });

    veinsFolder
      .addBinding(this.settings, "bevelStrength", {
        min: 0.0,
        max: 2.0,
        step: 0.01,
        label: "Bevel Strength",
      })
      .on("change", () => {
        if (this.voronoiMesh?.material instanceof THREE.MeshPhysicalMaterial) {
          updateVoronoiMaterialSettings(this.voronoiMesh.material, {
            bevelStrength: this.settings.bevelStrength,
          });
        }
      });

    veinsFolder
      .addBinding(this.settings, "bevelWidth", {
        min: 0.001,
        max: 0.02,
        step: 0.001,
        label: "Bevel Width",
      })
      .on("change", () => {
        if (this.voronoiMesh?.material instanceof THREE.MeshPhysicalMaterial) {
          updateVoronoiMaterialSettings(this.voronoiMesh.material, {
            bevelWidth: this.settings.bevelWidth,
          });
        }
      });

    // Dissolve folder
    const dissolveFolder = folder.addFolder({
      title: "Dissolve",
      expanded: false,
    });

    dissolveFolder
      .addBinding(this.settings, "dissolveThreshold", {
        min: -2,
        max: 2,
        step: 0.001,
        label: "Threshold",
      })
      .on("change", () => {
        if (this.voronoiMesh?.material instanceof THREE.MeshPhysicalMaterial) {
          updateVoronoiMaterialSettings(this.voronoiMesh.material, {
            dissolveThreshold: this.settings.dissolveThreshold,
          });
        }
      });

    dissolveFolder
      .addBinding(this.settings, "dissolveEdgeWidth", {
        min: 0.01,
        max: 0.5,
        step: 0.01,
        label: "Edge Width",
      })
      .on("change", () => {
        if (this.voronoiMesh?.material instanceof THREE.MeshPhysicalMaterial) {
          updateVoronoiMaterialSettings(this.voronoiMesh.material, {
            dissolveEdgeWidth: this.settings.dissolveEdgeWidth,
          });
        }
      });

    dissolveFolder
      .addBinding(this.settings, "dissolveEdgeIntensity", {
        min: 0.0,
        max: 10.0,
        step: 0.1,
        label: "Edge Intensity",
      })
      .on("change", () => {
        if (this.voronoiMesh?.material instanceof THREE.MeshPhysicalMaterial) {
          updateVoronoiMaterialSettings(this.voronoiMesh.material, {
            dissolveEdgeIntensity: this.settings.dissolveEdgeIntensity,
          });
        }
      });

    dissolveFolder
      .addBinding(this.settings, "dissolveColor", {
        label: "Color",
      })
      .on("change", () => {
        if (this.voronoiMesh?.material instanceof THREE.MeshPhysicalMaterial) {
          updateVoronoiMaterialSettings(this.voronoiMesh.material, {
            dissolveColor: this.settings.dissolveColor,
          });
        }
      });

    folder.addButton({ title: "Reset" }).on("click", () => {
      this.reset();
    });

    return folder;
  }

  reset(): void {
    this.isAnimating = false;
    this.settings.playAnimation = false;
    this.animationTime = 0;
    this.settings.explosionAmount = 0;
    this.settings.dissolveThreshold = 1.826;

    this.createFracturedObject();
  }

  dispose(): void {
    this.cleanup();

    // Dispose loaded assets
    if (this.teaCupGeometry) {
      this.teaCupGeometry.dispose();
    }
    if (this.teaCupMaterial) {
      this.teaCupMaterial.dispose();
    }
    if (this.teaCupTexture) {
      this.teaCupTexture.dispose();
    }
    if (this.kintsugiEnvMap) {
      this.kintsugiEnvMap.dispose();
    }
  }
}
