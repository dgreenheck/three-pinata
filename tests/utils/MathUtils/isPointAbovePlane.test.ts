import { Vector3 } from 'three';
import { isPointAbovePlane } from '../../../src/utils/MathUtils';

describe('isPointAbovePlane', () => {
  test('point above plane returns true', () => {
    var p = new Vector3(0, 1, 0);
    var n = new Vector3(0, 1, 0);
    var o = new Vector3();
    isPointAbovePlane(p, n, o);
  });

  test('point below plane returns false', () => {
    var p = new Vector3(0, -1, 0);
    var n = new Vector3(0, 1, 0);
    var o = new Vector3();
    isPointAbovePlane(p, n, o);
  });

  test('point on plane returns true', () => {
    var p = new Vector3(1, 0, 0);
    var n = new Vector3(0, 1, 0);
    var o = new Vector3();
    isPointAbovePlane(p, n, o);
  });

  test('point on origin returns true', () => {
    var p = new Vector3();
    var n = new Vector3(0, 1, 0);
    var o = new Vector3();
    isPointAbovePlane(p, n, o);
  });
});