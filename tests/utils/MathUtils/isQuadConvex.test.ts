import { Vector2 } from 'three';
import { isQuadConvex } from '../../../src/utils/MathUtils';

describe('isQuadConvex', () => {
  test('a1 == b1 is convex', () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = a1;
    const b2 = new Vector2(1, 0);
    expect(isQuadConvex(a1, a2, b1, b2)).toBe(true);
  });

  test('a1 == b2 is convex', () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = new Vector2(0, 1);
    const b2 = a1;
    expect(isQuadConvex(a1, a2, b1, b2)).toBe(true);
  });

  test('a2 == b1 is convex', () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = a2;
    const b2 = new Vector2(1, 0);
    expect(isQuadConvex(a1, a2, b1, b2)).toBe(true);
  });

  test('a2 == b2 is convex', () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = new Vector2(0, 1);
    const b2 = a2;
    expect(isQuadConvex(a1, a2, b1, b2)).toBe(true);
  });
});
