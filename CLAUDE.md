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

---

## CRITICAL: Do NOT Use Static Storage for Data Collection ❌

### Issue #3: Static Accumulators Lose Data

**Problem**: Using static class properties to accumulate data across multiple instances does NOT work reliably. Data gets saved to the accumulator but is lost before it can be retrieved.

**Examples of what NOT to do**:
```typescript
// ❌ WRONG - Static storage
class MyClass {
  private static dataAccumulator: SomeData[] = [];

  static getAndClearData(): SomeData[] {
    const result = [...this.dataAccumulator];
    this.dataAccumulator = [];
    return result;
  }

  constructor() {
    // Add data to static accumulator
    MyClass.dataAccumulator.push(someData);
  }
}
```

**Why this fails**:
- Data gets cleared at unexpected times
- Multiple fracturing operations may interfere with each other
- Timing issues between when data is accumulated and when it's retrieved
- No guaranteed execution order

**Correct approaches**:
1. **Instance properties**: Store data as instance properties and return it directly
2. **Callbacks**: Pass a callback function to collect data as it's generated
3. **Return values**: Return data structures that include the collected information
4. **Event emitters**: Use an event system to emit data as it's collected

**Example - Correct approach using instance property**:
```typescript
class MyClass {
  // ✅ CORRECT - Instance property
  invalidVertices: SomeData[] = [];

  constructor() {
    // Store in instance property
    this.invalidVertices.push(someData);
  }
}

// Retrieve from instance
const instance = new MyClass();
const data = instance.invalidVertices;
```

**Example - Correct approach using callback**:
```typescript
function processData(onDataFound?: (data: SomeData) => void) {
  // When data is found, call callback immediately
  if (onDataFound) {
    onDataFound(someData);
  }
}
```
