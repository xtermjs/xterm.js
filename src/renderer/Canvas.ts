export function createBackgroundFillData(width: number, height: number, r: number, g: number, b: number, a: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  let offset = 0;
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = a;
      offset += 4;
    }
  }
  return data;
}
