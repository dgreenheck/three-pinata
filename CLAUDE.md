# Claude Code Notes

## Triangulation - Boundary Detection

### Issue #1: Wrong Normal Direction (FIXED ✅)

**Problem**: BoundaryDetection tests were using `new Vector3(0, 1, 0)` as the normal, but ConstrainedTriangulator tests use `new Vector3(0, -1, 0)`.

**Solution**: Changed all BoundaryDetection tests to use `new Vector3(0, -1, 0)` to match the working tests.

**Files changed**: `lib/src/triangulators/__tests__/BoundaryDetection.test.ts`

---

### Issue #2: Testing Against Normalized Coordinates (FIXED ✅)

**Problem**: The annulus test was checking triangle centroids against `triangulator.points[i].coords` which are the **normalized/transformed 2D coordinates** used internally for triangulation, not the original vertex positions.

**Why it failed**: The triangulator normalizes coordinates for numerical stability. Checking distances in normalized space doesn't match the original geometry.

**Solution**: Changed test to check against original vertex positions:
```typescript
// WRONG - uses normalized internal coords
const v1 = triangulator.points[triangles[i]].coords;

// CORRECT - uses original vertex positions
const v1 = vertices[triangles[i]].position;
```

Also needed to use `.z` instead of `.y` since vertices are at y=0:
```typescript
const cx = (v1.x + v2.x + v3.x) / 3;
const cy = (v1.z + v2.z + v3.z) / 3; // Use .z not .y
```

**Result**: All triangulation tests now pass, including the annulus (hole) test.

---

### INCORRECT FIX - DO NOT APPLY ❌

**WRONG Solution** (do not use):
```typescript
// In discardTrianglesViolatingConstraints()
// DO NOT add bidirectional boundary storage:
boundaries.add(hashi2(constraint.v1, constraint.v2));
boundaries.add(hashi2(constraint.v2, constraint.v1)); // ❌ WRONG
```

**Why this is wrong**:
- Breaks the "two separate triangles" test
- The algorithm relies on directional edge matching - the direction determines which side is "inside"
- Adding both directions defeats the purpose of winding order
