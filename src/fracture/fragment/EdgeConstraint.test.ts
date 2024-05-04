import EdgeConstraint from '../fragment/EdgeConstraint';

describe('EdgeConstraint', () => {
  test('indentical edges are equal', () => {
    const edgeA = new EdgeConstraint(1, 2);
    const edgeB = new EdgeConstraint(1, 2);

    expect(edgeA.equals(edgeB)).toBe(true);
  });

  test('different v1 edge are not equal', () => {
    const edgeA = new EdgeConstraint(1, 2);
    const edgeB = new EdgeConstraint(3, 2);

    expect(edgeA.equals(edgeB)).toBe(false);
  });

  test('different v2 edge are not equal', () => {
    const edgeA = new EdgeConstraint(1, 2);
    const edgeB = new EdgeConstraint(1, 3);

    expect(edgeA.equals(edgeB)).toBe(false);
  });

  test('edges in opposite directions are equal', () => {
    const edgeA = new EdgeConstraint(1, 2);
    const edgeB = new EdgeConstraint(2, 1);

    expect(edgeA.equals(edgeB)).toBe(true);
  });
});
