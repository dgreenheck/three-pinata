import { Vector3 } from 'three';
import { linePlaneIntersection } from '../../../src/utils/MathUtils';

describe('linePlaneIntersection', () => {
  test('degenerate line returns null', () => {
    const a = new Vector3(1, 1, 1);
    const b = new Vector3(1, 1, 1);
    const n = new Vector3(0, 1, 0);
    const p0 = new Vector3(0, 0, 0);
    expect(linePlaneIntersection(a, b, n, p0)).toBeNull();
  });

  test('zero length normal returns null', () => {
    const a = new Vector3(0, 0, 0);
    const b = new Vector3(1, 1, 1);
    const n = new Vector3(0, 0, 0);
    const p0 = new Vector3(0, 0, 0);
    expect(linePlaneIntersection(a, b, n, p0)).toBeNull();
  });

  test('line above plane returns null', () => {
    const a = new Vector3(0, 1, 0);
    const b = new Vector3(0, 2, 0);
    const n = new Vector3(0, 1, 0);
    const p0 = new Vector3(0, 0, 0);
    expect(linePlaneIntersection(a, b, n, p0)).toBeNull();
  });

  test('line below plane returns null', () => {
    const a = new Vector3(0, -1, 0);
    const b = new Vector3(0, -2, 0);
    const n = new Vector3(0, 1, 0);
    const p0 = new Vector3(0, 0, 0);
    expect(linePlaneIntersection(a, b, n, p0)).toBeNull();
  });

  test('line cross plane returns true', () => {
    const a = new Vector3(0, -1, 0);
    const b = new Vector3(0, 1, 0);
    const n = new Vector3(0, 1, 0);
    const p0 = new Vector3(0, 0, 0);
    const result = linePlaneIntersection(a, b, n, p0);
    expect(result).not.toBeNull();
    expect(result?.x.x).toEqual(0);
    expect(result?.x.y).toEqual(0);
    expect(result?.x.z).toEqual(0);
    expect(result?.s).toBeCloseTo(0.5);
  });

  test('line start point coincident with plane returns intersection', () => {
    const a = new Vector3(0, 0, 0);
    const b = new Vector3(0, 1, 0);
    const n = new Vector3(0, 1, 0);
    const p0 = new Vector3(0, 0, 0);
    const result = linePlaneIntersection(a, b, n, p0);
    expect(result).not.toBeNull();
    expect(result?.x.x).toEqual(0);
    expect(result?.x.y).toEqual(0);
    expect(result?.x.z).toEqual(0);
    expect(result?.s).toBe(0);
  });

  test('line endpoint coincident with plane returns intersection', () => {
    const a = new Vector3(0, 1, 0);
    const b = new Vector3(0, 0, 0);
    const n = new Vector3(0, 1, 0);
    const p0 = new Vector3(0, 0, 0);
    const result = linePlaneIntersection(a, b, n, p0);
    expect(result).not.toBeNull();
    expect(result?.x.x).toEqual(0);
    expect(result?.x.y).toEqual(0);
    expect(result?.x.z).toEqual(0);
    expect(result?.s).toBe(1);
  });
});
