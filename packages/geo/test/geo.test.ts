import { describe, expect, it } from "vitest";
import {
  haversineKm,
  lerpLine,
  lineLengthKm,
  resampleLine,
  ringAreaSqkm,
  simplifyLine,
  type LngLat,
} from "../src/index";

describe("haversineKm", () => {
  it("Киев — Харьков ≈ 410 км", () => {
    const kyiv: LngLat = [30.52, 50.45];
    const kharkiv: LngLat = [36.23, 49.99];
    expect(haversineKm(kyiv, kharkiv)).toBeGreaterThan(390);
    expect(haversineKm(kyiv, kharkiv)).toBeLessThan(430);
  });
});

describe("resampleLine", () => {
  const line: LngLat[] = [
    [30, 50],
    [31, 50],
    [32, 50],
  ];
  it("возвращает ровно n вершин с сохранёнными концами", () => {
    const r = resampleLine(line, 7);
    expect(r).toHaveLength(7);
    expect(r[0]).toEqual([30, 50]);
    expect(r[6]![0]).toBeCloseTo(32, 6);
  });
  it("сохраняет длину линии", () => {
    const r = resampleLine(line, 50);
    expect(lineLengthKm(r)).toBeCloseTo(lineLengthKm(line), 1);
  });
});

describe("lerpLine", () => {
  it("t=0 → a, t=1 → b, t=0.5 → середина", () => {
    const a: LngLat[] = [
      [30, 50],
      [31, 50],
    ];
    const b: LngLat[] = [
      [30, 52],
      [31, 52],
    ];
    expect(lerpLine(a, b, 0)).toEqual(a);
    expect(lerpLine(a, b, 1)).toEqual(b);
    expect(lerpLine(a, b, 0.5)[0]![1]).toBeCloseTo(51);
  });
});

describe("simplifyLine", () => {
  it("удаляет коллинеарные точки, сохраняет форму", () => {
    const line: LngLat[] = [
      [30, 50],
      [30.5, 50],
      [31, 50],
      [31, 51],
    ];
    const s = simplifyLine(line, 0.01);
    expect(s.length).toBeLessThan(line.length);
    expect(s[0]).toEqual([30, 50]);
    expect(s[s.length - 1]).toEqual([31, 51]);
  });
});

describe("ringAreaSqkm", () => {
  it("квадрат 1°×1° на широте 50° ≈ 111.32 × 71.6 км", () => {
    const ring: LngLat[] = [
      [30, 50],
      [31, 50],
      [31, 51],
      [30, 51],
    ];
    const area = ringAreaSqkm(ring);
    // cos(50.5°) ≈ 0.636 → ~7880 км²; допускаем аппроксимационный разброс
    expect(area).toBeGreaterThan(7000);
    expect(area).toBeLessThan(9000);
  });
});
