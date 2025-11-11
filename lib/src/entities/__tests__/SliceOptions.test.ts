import { Vector2 } from "three";
import { SliceOptions } from "../SliceOptions";

describe("SliceOptions", () => {
  describe("Constructor", () => {
    it("should initialize with default values", () => {
      const options = new SliceOptions();

      expect(options.textureScale).toEqual(new Vector2(1, 1));
      expect(options.textureOffset).toEqual(new Vector2(0, 0));
    });

    it("should allow modification of textureScale", () => {
      const options = new SliceOptions();
      options.textureScale = new Vector2(2, 3);

      expect(options.textureScale.x).toBe(2);
      expect(options.textureScale.y).toBe(3);
    });

    it("should allow modification of textureOffset", () => {
      const options = new SliceOptions();
      options.textureOffset = new Vector2(0.5, 0.25);

      expect(options.textureOffset.x).toBe(0.5);
      expect(options.textureOffset.y).toBe(0.25);
    });
  });
});
