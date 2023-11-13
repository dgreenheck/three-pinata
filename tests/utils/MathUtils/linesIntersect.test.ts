import { Vector2 } from 'three'
import { linesIntersect } from '../../../src/utils/MathUtils';

describe('linesIntersect', () => {
  test('intersection exists', () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = new Vector2(0, 1);
    const b2 = new Vector2(1, 0);
    expect(linesIntersect(a1, a2, b1, b2)).toBe(true);
  });

  test('no intersection', () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = new Vector2(0, 1);
    const b2 = new Vector2(1, 2);
    expect(linesIntersect(a1, a2, b1, b2)).toBe(false);
  });

  test('a1 == b1 intersect', () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = a1;
    const b2 = new Vector2(1, 0);
    expect(linesIntersect(a1, a2, b1, b2)).toBe(false);
  });

  test('a1 == b2 intersect', () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = new Vector2(0, 1);
    const b2 = a1;
    expect(linesIntersect(a1, a2, b1, b2)).toBe(false);
  });

  test('a2 == b1 intersect', () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = a2;
    const b2 = new Vector2(1, 0);
    expect(linesIntersect(a1, a2, b1, b2)).toBe(false);
  });

  test('a2 == b2 intersect', () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = new Vector2(0, 1);
    const b2 = a2;
    expect(linesIntersect(a1, a2, b1, b2)).toBe(false);
  });
});