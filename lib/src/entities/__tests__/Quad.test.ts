import Quad from "../Quad";

describe("Quad", () => {
  test("should create quad with all properties", () => {
    const quad = new Quad(1, 2, 3, 4, 10, 20, 30, 40, 50, 60);

    expect(quad.q1).toBe(1);
    expect(quad.q2).toBe(2);
    expect(quad.q3).toBe(3);
    expect(quad.q4).toBe(4);
    expect(quad.t1).toBe(10);
    expect(quad.t2).toBe(20);
    expect(quad.t1L).toBe(30);
    expect(quad.t1R).toBe(40);
    expect(quad.t2L).toBe(50);
    expect(quad.t2R).toBe(60);
  });

  test("should convert to string", () => {
    const quad = new Quad(1, 2, 3, 4, 10, 20, 30, 40, 50, 60);
    const str = quad.toString();

    expect(str).toBe("T10/T20 (V1,V2,V3,V4)");
  });
});
