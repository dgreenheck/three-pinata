import { Vector2 } from 'three';
import { isPointOnRightSideOfLine } from '../../../src/utils/MathUtils';

describe('isPointOnRightSideOfLine', () => {
  test('test point on right side returns true', () => {
    const a = new Vector2(0, 0);
    const b = new Vector2(1, 1);
    const p = new Vector2(1, 0);
    expect(isPointOnRightSideOfLine(a, b, p)).toBe(true);
  });

  test('test point on left side returns false', () => {
    const a = new Vector2(0, 0);
    const b = new Vector2(1, 1);
    const p = new Vector2(0, 1);
    expect(isPointOnRightSideOfLine(a, b, p)).not.toBe(true);
  });

  test('test point is equal to first vertex of line returns true', () => {
    const a = new Vector2(0, 0);
    const b = new Vector2(1, 1);
    const p = new Vector2(0, 0);
    expect(isPointOnRightSideOfLine(a, b, p)).toBe(true);
  });

  test('test point is equal to second vertex of line returns true', () => {
    const a = new Vector2(0, 0);
    const b = new Vector2(1, 1);
    const p = new Vector2(1, 1);
    expect(isPointOnRightSideOfLine(a, b, p)).toBe(true);
  });

  test('test point is equal to midpoint returns true', () => {
    const a = new Vector2(0, 0);
    const b = new Vector2(1, 1);
    const p = new Vector2(0.5, 0.5);
    expect(isPointOnRightSideOfLine(a, b, p)).toBe(true);
  });
});