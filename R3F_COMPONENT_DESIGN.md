# React Three Fiber Component Design Document
## three-pinata R3F Integration

**Version:** 1.0
**Date:** 2025-10-31
**Status:** Draft

---

## 1. Overview

### 1.1 Purpose
Create a React Three Fiber (R3F) component wrapper for the `@dgreenheck/three-pinata` library that enables declarative mesh fracturing and slicing within React applications.

### 1.2 Goals
- Provide idiomatic R3F integration following ecosystem conventions
- Maintain compatibility with the core library API
- Support TypeScript with full type safety
- Enable automatic fragment lifecycle management
- Allow imperative control for complex scenarios
- Keep the API surface simple and intuitive

### 1.3 Non-Goals
- Replace the core library (this is a wrapper only)
- Provide physics integration (users handle via callbacks)
- Bundle the core library (peer dependency)

---

## 2. API Design

### 2.1 Component Signature

```tsx
import { DestructibleMesh } from '@dgreenheck/three-pinata-react';

<DestructibleMesh
  // Standard R3F mesh props
  geometry={geometry}
  material={material}
  position={[0, 0, 0]}
  rotation={[0, 0, 0]}
  scale={1}
  castShadow
  receiveShadow

  // Common fracture options (direct props)
  fragmentCount?: number
  fractureMode?: '3D' | '2.5D'

  // Advanced fracture options
  fractureOptions?: Partial<VoronoiFractureOptions>
  sliceOptions?: Partial<SliceOptions>

  // Fragment lifecycle callbacks
  onFragmentCreated?: (fragment: THREE.Mesh, index: number) => void
  onFractureComplete?: (fragments: THREE.Mesh[]) => void
  onSliceComplete?: (top: DestructibleMesh, bottom: DestructibleMesh) => void
  onUnfreezeComplete?: () => void

  // R3F event handlers work as expected
  onClick?: ThreeEvent<MouseEvent>
  onPointerOver?: ThreeEvent<PointerEvent>
  // ... all standard R3F events

  // Standard Three.js object props via R3F
  ref={ref}
  {...otherProps}
/>
```

### 2.2 Ref Interface

Following R3F conventions, expose the underlying `DestructibleMesh` instance directly:

```tsx
const meshRef = useRef<DestructibleMesh>(null);

// Access the core library instance and its methods
meshRef.current?.fracture(options: VoronoiFractureOptions, freeze?, setup?, onComplete?);
meshRef.current?.slice(normal, origin, options?, onSlice?);
meshRef.current?.unfreeze(onFragment?, onComplete?);
meshRef.current?.getFragments();
meshRef.current?.dispose();
meshRef.current?.isFrozen();

// Also access the internal mesh if needed
meshRef.current?.mesh;
meshRef.current?.fragments;
```

**Design Decision:** Direct instance exposure (not a wrapper interface) because:
- Matches R3F ecosystem patterns (drei, rapier, cannon)
- Users learn the actual library API (documentation consistency)
- No abstraction layer to maintain
- TypeScript types work automatically
- More transparent and predictable

### 2.3 TypeScript Types

```tsx
import type {
  DestructibleMesh as DestructibleMeshImpl,
  VoronoiFractureOptions,
  SliceOptions
} from '@dgreenheck/three-pinata';
import type { MeshProps } from '@react-three/fiber';

export interface DestructibleMeshProps extends Omit<MeshProps, 'ref'> {
  // Geometry and material (R3F standard)
  geometry: THREE.BufferGeometry;
  material?: THREE.Material | THREE.Material[];

  // Common fracture options as direct props
  fragmentCount?: number;
  fractureMode?: '3D' | '2.5D';

  // Advanced options
  fractureOptions?: Partial<VoronoiFractureOptions>;
  sliceOptions?: Partial<SliceOptions>;

  // Callbacks
  onFragmentCreated?: (fragment: THREE.Mesh, index: number) => void;
  onFractureComplete?: (fragments: THREE.Mesh[]) => void;
  onSliceComplete?: (
    top: DestructibleMeshImpl,
    bottom: DestructibleMeshImpl
  ) => void;
  onUnfreezeComplete?: () => void;
}

// Re-export library types
export type {
  VoronoiFractureOptions,
  SliceOptions,
  FractureOptions
} from '@dgreenheck/three-pinata';
```

---

## 3. Architecture

### 3.1 Component Structure

```tsx
import { forwardRef, useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DestructibleMesh as DestructibleMeshImpl } from '@dgreenheck/three-pinata';

export const DestructibleMesh = forwardRef<DestructibleMeshImpl, DestructibleMeshProps>(
  (props, ref) => {
    // Internal instance
    const instanceRef = useRef<DestructibleMeshImpl>(null);

    // Track fragments for rendering
    const [fragments, setFragments] = useState<THREE.Mesh[]>([]);

    // Expose instance via ref
    useImperativeHandle(ref, () => instanceRef.current!);

    // Lifecycle management
    useEffect(() => {
      // Create instance
      // Sync props
      // Cleanup on unmount
    }, []);

    return (
      <group>
        {/* Original mesh */}
        <primitive object={instanceRef.current?.mesh} />

        {/* Fragments */}
        {fragments.map((fragment, i) => (
          <primitive key={i} object={fragment} />
        ))}
      </group>
    );
  }
);
```

### 3.2 Key Implementation Details

#### 3.2.1 Instance Creation
- Create `DestructibleMeshImpl` instance in a `useRef` (not state - it's a mutable object)
- Initialize with geometry and material props
- Handle geometry/material changes via `useEffect`

#### 3.2.2 Fragment Management
- Store fragment array in state to trigger re-renders
- Wrap library's fracture callbacks to update React state
- Render fragments using `<primitive>` to avoid creating new Three.js objects
- Let R3F manage the actual scene graph updates

#### 3.2.3 Props Handling
- Merge `fragmentCount` and `fractureMode` direct props with `fractureOptions`
- Pass merged options to library methods
- Spread remaining props to the group container

#### 3.2.4 Cleanup
- Call `dispose()` on unmount
- Remove fragments from state
- Let R3F handle Three.js object cleanup

### 3.3 Prop Merging Strategy

```tsx
// Merge direct props with options object
const getFractureOptions = (): VoronoiFractureOptions => {
  return new VoronoiFractureOptions({
    fragmentCount: props.fragmentCount ?? 50,
    mode: props.fractureMode ?? '3D',
    ...props.fractureOptions, // User options override defaults
  });
};
```

---

## 4. Usage Examples

### 4.1 Basic Usage

```tsx
import { Canvas } from '@react-three/fiber';
import { DestructibleMesh } from '@dgreenheck/three-pinata-react';
import { BoxGeometry, MeshStandardMaterial } from 'three';

function App() {
  const meshRef = useRef<DestructibleMesh>(null);

  const handleClick = () => {
    meshRef.current?.fracture(
      new VoronoiFractureOptions({ fragmentCount: 30 })
    );
  };

  return (
    <Canvas>
      <DestructibleMesh
        ref={meshRef}
        geometry={new BoxGeometry(2, 2, 2)}
        material={new MeshStandardMaterial({ color: 'orange' })}
        fragmentCount={30}
        onClick={handleClick}
        castShadow
      />
    </Canvas>
  );
}
```

### 4.2 Impact-Based Fracturing

```tsx
function GlassPane() {
  const meshRef = useRef<DestructibleMesh>(null);

  const handleImpact = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();

    meshRef.current?.fracture(
      new VoronoiFractureOptions({
        mode: '2.5D',
        fragmentCount: 50,
        impactPoint: event.point,
        impactRadius: 1.0,
      })
    );
  };

  return (
    <DestructibleMesh
      ref={meshRef}
      geometry={glassGeometry}
      material={glassMaterial}
      fractureMode="2.5D"
      onClick={handleImpact}
    />
  );
}
```

### 4.3 With Physics Integration

```tsx
import { RigidBody, RapierRigidBody } from '@react-three/rapier';

function PhysicsExample() {
  const meshRef = useRef<DestructibleMesh>(null);
  const fragmentBodies = useRef<RapierRigidBody[]>([]);

  const handleFracture = () => {
    meshRef.current?.fracture(
      new VoronoiFractureOptions({ fragmentCount: 20 }),
      false, // don't freeze
      (fragment, index) => {
        // Setup callback - user adds physics here
        // Note: This happens during fracture, before fragments are in scene
        // User needs to handle physics creation after fracture completes
      },
      () => {
        // Fracture complete - now add physics to fragments
        const fragments = meshRef.current?.getFragments() ?? [];
        // Create RigidBodies for each fragment...
      }
    );
  };

  return (
    <DestructibleMesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      onFragmentCreated={(fragment, i) => {
        console.log(`Fragment ${i} created`);
      }}
    />
  );
}
```

### 4.4 Slicing

```tsx
function SliceableObject() {
  const meshRef = useRef<DestructibleMesh>(null);
  const [slicedParts, setSlicedParts] = useState<{
    top?: DestructibleMesh;
    bottom?: DestructibleMesh;
  }>({});

  const handleSlice = () => {
    const { top, bottom } = meshRef.current?.slice(
      new Vector3(0, 1, 0), // slice normal (upward)
      new Vector3(0, 0, 0), // slice origin
      new SliceOptions()
    );

    setSlicedParts({ top, bottom });
    // Now you can add these to the scene, apply physics, etc.
  };

  return (
    <>
      <DestructibleMesh ref={meshRef} geometry={geo} material={mat} />

      {/* Render sliced parts */}
      {slicedParts.top && <primitive object={slicedParts.top} />}
      {slicedParts.bottom && <primitive object={slicedParts.bottom} />}
    </>
  );
}
```

### 4.5 Frozen Fracture (Pre-fracture for Performance)

```tsx
function PreFractured() {
  const meshRef = useRef<DestructibleMesh>(null);

  useEffect(() => {
    // Pre-fracture on mount, but keep frozen
    meshRef.current?.fracture(
      new VoronoiFractureOptions({ fragmentCount: 100 }),
      true // freeze = true
    );
  }, []);

  const handleImpact = () => {
    // Unfreeze to reveal fragments
    meshRef.current?.unfreeze(
      (fragment, index) => {
        // Apply physics impulse to each fragment
      }
    );
  };

  return (
    <DestructibleMesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      onClick={handleImpact}
    />
  );
}
```

---

## 5. Implementation Plan

### Phase 1: Core Component (MVP)
1. **Setup Package Structure**
   - Create `lib/react/` directory or separate package
   - Configure TypeScript (tsconfig.json)
   - Setup build tool (Vite with library mode)
   - Configure package.json with exports

2. **Implement DestructibleMesh Component**
   - Basic component with ref forwarding
   - Instance creation and lifecycle
   - Props to instance mapping
   - Fragment state management
   - Automatic cleanup

3. **TypeScript Types**
   - Props interface
   - Ref type exports
   - Re-export library types

### Phase 2: Testing & Examples
4. **Create Example App**
   - Convert one demo scene to R3F
   - Test basic fracture functionality
   - Test slicing functionality
   - Test frozen fracture pattern

5. **Documentation**
   - README with installation
   - API reference
   - Usage examples
   - Migration guide from vanilla Three.js

### Phase 3: Polish & Release
6. **Performance Optimization**
   - Memo component if needed
   - Optimize re-renders
   - Test with large fragment counts

7. **Additional Features** (if needed)
   - Helper hooks (useDestructible?)
   - Debug mode
   - DevTools integration

---

## 6. Technical Decisions

### 6.1 Decided

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Component Type | Declarative R3F component | Requested by user, matches R3F patterns |
| Ref Interface | Direct instance exposure | Most common in R3F ecosystem, simpler |
| Props API | Common props + options object | Balance between convenience and flexibility |
| Fragment Rendering | Automatic with callbacks | Easier for common cases, callbacks for advanced use |
| Trigger Method | Imperative via ref | More flexible, matches physics libraries |

### 6.2 Open Questions

1. **Package Location**
   - [ ] Separate package `@dgreenheck/three-pinata-react`?
   - [ ] Subfolder export `@dgreenheck/three-pinata/react`?
   - [ ] Monorepo workspace?

2. **Slice Return Handling**
   - [ ] Should sliced DestructibleMesh instances be automatically added to scene?
   - [ ] Or should user handle placement manually (current design)?

3. **Material Handling for Fragments**
   - [ ] Support separate inner/outer materials as props?
   - [ ] Or require users to use material arrays (current)?

4. **Fragment Keys**
   - [ ] Use index-based keys (simple but potential issues with re-fracturing)?
   - [ ] Generate unique IDs for each fragment?

5. **Re-fracturing**
   - [ ] How to handle fracturing already fractured meshes?
   - [ ] Should component track and re-render recursively?

---

## 7. File Structure

```
lib/react/
├── src/
│   ├── DestructibleMesh.tsx       # Main component
│   ├── types.ts                    # TypeScript interfaces
│   ├── index.ts                    # Public exports
│   └── utils.ts                    # Helper functions (if needed)
├── examples/                       # Example usage (optional)
│   └── basic-fracture.tsx
├── package.json
├── tsconfig.json
├── vite.config.ts                  # Build configuration
├── README.md
└── LICENSE                         # MIT (same as main package)

# Alternative: Integrated into main package
lib/
├── src/
│   ├── react/                      # R3F components
│   │   ├── DestructibleMesh.tsx
│   │   └── index.ts
│   └── ... (existing core library)
```

---

## 8. Dependencies

### Peer Dependencies
```json
{
  "peerDependencies": {
    "react": "^18.0.0",
    "@react-three/fiber": "^8.0.0",
    "three": ">=0.158.0",
    "@dgreenheck/three-pinata": "^0.3.17"
  }
}
```

### Dev Dependencies
```json
{
  "devDependencies": {
    "@types/react": "^18.0.0",
    "@types/three": "^0.180.0",
    "typescript": "^5.2.2",
    "vite": "^6.0.0",
    "vite-plugin-dts": "^3.9.1"
  }
}
```

---

## 9. Performance Considerations

### 9.1 Rendering Optimization
- Use `<primitive>` to avoid creating wrapper objects
- Fragments are created by library (unavoidable)
- React only manages the rendering, not geometry creation

### 9.2 Memory Management
- Automatic disposal on unmount
- User responsible for physics cleanup
- Consider warning if many fragments created

### 9.3 Re-render Prevention
- Component should not re-render on fracture (state change needed for fragments only)
- Use refs for mutable data
- Consider memo if props change frequently

---

## 10. Future Enhancements

### Potential Additions (Post-MVP)
- **Helper Hooks**: `useDestructible()`, `useFracture()`
- **Presets**: Common configurations (glass, wood, stone)
- **Animation Helpers**: Fragment explosion, gravity effects
- **Debug Visualization**: Show Voronoi cells, seed points
- **Performance Monitoring**: Fragment count warnings
- **React Suspense**: Async fracture operations
- **Web Worker Support**: Offload fracture computation

---

## 11. Migration Guide

### From Vanilla Three.js to R3F

**Before (Vanilla):**
```tsx
const mesh = new DestructibleMesh(geometry, material);
scene.add(mesh);

mesh.fracture(new VoronoiFractureOptions({ fragmentCount: 30 }));
```

**After (R3F):**
```tsx
<DestructibleMesh
  ref={meshRef}
  geometry={geometry}
  material={material}
  fragmentCount={30}
/>

// Later
meshRef.current?.fracture();
```

---

## 12. References

- [React Three Fiber Documentation](https://docs.pmnd.rs/react-three-fiber)
- [drei Components](https://github.com/pmndrs/drei) - Reference for R3F component patterns
- [@react-three/rapier](https://github.com/pmndrs/react-three-rapier) - Physics integration example
- [three-pinata Core Library](https://github.com/dgreenheck/three-pinata)

---

## Appendix: Alternative Designs Considered

### A.1 Fully Declarative Approach (Rejected)
```tsx
<DestructibleMesh fractured={shouldFracture} />
```
**Rejected because:** Less flexible for impact-based fracturing and complex scenarios

### A.2 Hook-Only Approach (Rejected)
```tsx
const { meshRef, fracture } = useDestructible(geometry, material);
```
**Rejected because:** Less declarative, doesn't fit R3F patterns well

### A.3 Custom Ref Interface (Considered)
```tsx
meshRef.current.fracture() // wrapper method
vs
meshRef.current?.fracture() // direct instance
```
**Decision:** Direct instance exposure for transparency and simplicity
