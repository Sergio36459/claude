"use client";

import type { StyleSpecification } from "maplibre-gl";
import { BASE_PATH } from "./config";

/**
 * Собственная подложка «мировая карта региона»: страны, границы, области
 * Украины, города с подписями. Данные Natural Earth (public domain) и глифы
 * шрифтов лежат в /public — никакой зависимости от внешних тайл-серверов.
 */
export function buildLocalStyle(theme: "light" | "dark"): StyleSpecification {
  const c =
    theme === "dark"
      ? {
          water: "#0c1117",
          land: "#1c2025",
          landUa: "#242a31",
          border: "#4a505a",
          admin1: "#343a43",
          text: "#c9c7c0",
          textCity: "#b4b2ab",
          halo: "#14171b",
          cityDot: "#8d8a83",
          countryLabel: "#7d838d",
        }
      : {
          water: "#c7d5e2",
          land: "#f3f1ea",
          landUa: "#fbfaf6",
          border: "#a19c91",
          admin1: "#cfc9bd",
          text: "#3a3833",
          textCity: "#52514e",
          halo: "#ffffff",
          cityDot: "#6b675f",
          countryLabel: "#8d887d",
        };

  const src = (file: string) =>
    ({ type: "geojson", data: `${BASE_PATH}/basemap/${file}` }) as const;

  return {
    version: 8,
    name: `uwt-local-${theme}`,
    glyphs: `${BASE_PATH}/glyphs/{fontstack}/{range}.pbf`,
    sources: {
      countries: src("countries.geojson"),
      "admin1-ua": src("admin1-ua.geojson"),
      places: src("places.geojson"),
      "country-labels": src("country-labels.geojson"),
    },
    layers: [
      { id: "water", type: "background", paint: { "background-color": c.water } },
      {
        id: "land",
        type: "fill",
        source: "countries",
        paint: { "fill-color": c.land },
      },
      {
        id: "land-ua",
        type: "fill",
        source: "countries",
        filter: ["==", ["get", "ua"], 1],
        paint: { "fill-color": c.landUa },
      },
      {
        id: "admin1-ua-line",
        type: "line",
        source: "admin1-ua",
        minzoom: 5,
        paint: {
          "line-color": c.admin1,
          "line-width": 0.7,
          "line-dasharray": [3, 2],
        },
      },
      {
        id: "country-borders",
        type: "line",
        source: "countries",
        paint: {
          "line-color": c.border,
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.8, 8, 1.6],
        },
      },
      {
        id: "city-dots",
        type: "circle",
        source: "places",
        minzoom: 4.5,
        paint: {
          "circle-radius": ["case", ["==", ["get", "cap"], 1], 3.2, 2.2],
          "circle-color": c.cityDot,
          "circle-stroke-width": 1,
          "circle-stroke-color": c.halo,
        },
      },
      // подписи городов: столицы/миллионники раньше, остальные с зумом
      {
        id: "city-labels-major",
        type: "symbol",
        source: "places",
        filter: ["<=", ["get", "rank"], 1],
        minzoom: 4.5,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["KlokanTech Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 4.5, 11, 9, 14],
          "text-offset": [0, 0.9],
          "text-anchor": "top",
        },
        paint: {
          "text-color": c.textCity,
          "text-halo-color": c.halo,
          "text-halo-width": 1.2,
        },
      },
      {
        id: "city-labels-mid",
        type: "symbol",
        source: "places",
        filter: ["==", ["get", "rank"], 2],
        minzoom: 5.6,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["KlokanTech Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 5.6, 10.5, 9, 13],
          "text-offset": [0, 0.9],
          "text-anchor": "top",
        },
        paint: {
          "text-color": c.textCity,
          "text-halo-color": c.halo,
          "text-halo-width": 1.2,
        },
      },
      {
        id: "city-labels-small",
        type: "symbol",
        source: "places",
        filter: [">=", ["get", "rank"], 3],
        minzoom: 6.5,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["KlokanTech Noto Sans Regular"],
          "text-size": 11,
          "text-offset": [0, 0.9],
          "text-anchor": "top",
        },
        paint: {
          "text-color": c.textCity,
          "text-halo-color": c.halo,
          "text-halo-width": 1.2,
        },
      },
      {
        id: "country-labels",
        type: "symbol",
        source: "country-labels",
        maxzoom: 7.5,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["KlokanTech Noto Sans Bold"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            ["case", [">", ["get", "area"], 3e11], 15, 11],
            7,
            18,
          ],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.12,
        },
        paint: {
          "text-color": c.countryLabel,
          "text-halo-color": c.halo,
          "text-halo-width": 1,
          "text-opacity": 0.85,
        },
      },
    ],
  };
}
