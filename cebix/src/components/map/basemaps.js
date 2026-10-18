import { useEffect, useState } from "react";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const EXTRA_BASEMAPS = {
  calles: {
    label: "Calles",
    layers: [{ url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", subdomains: ["a", "b", "c"], maxNative: 19, attribution: OSM_ATTR }],
  },
  callesEsri: {
    label: "Calles (Esri)",
    layers: [{ url: `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`, maxNative: 19, attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, USGS" }],
  },
  hibrido: {
    label: "Híbrido (satélite con calles y nombres)",
    layers: [
      { url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, maxNative: 17, attribution: "Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics" },
      { url: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, maxNative: 16, attribution: "Labels &copy; Esri" },
    ],
  },
  topografico: {
    label: "Topográfico (curvas de nivel)",
    layers: [{
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      subdomains: ["a", "b", "c"],
      maxNative: 17,
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    }],
  },
  relieve: {
    label: "Relieve sombreado",
    layers: [{ url: `${ESRI}/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}`, maxNative: 13, attribution: "Tiles &copy; Esri &mdash; Source: Esri" }],
  },
  natgeo: {
    label: "National Geographic",
    layers: [{ url: `${ESRI}/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}`, maxNative: 16, attribution: "Tiles &copy; Esri &mdash; National Geographic, Esri, Garmin, HERE, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA" }],
  },
  oceano: {
    label: "Océano",
    layers: [
      { url: `${ESRI}/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}`, maxNative: 13, attribution: "Tiles &copy; Esri &mdash; Esri, GEBCO, NOAA, National Geographic, DeLorme, HERE, Geonames.org" },
      { url: `${ESRI}/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}`, maxNative: 13, attribution: "Labels &copy; Esri" },
    ],
  },
  ciclista: {
    label: "Ciclista (CyclOSM)",
    layers: [{
      url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
      subdomains: ["a", "b", "c"],
      maxNative: 20,
      attribution: '<a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases">CyclOSM</a> | Map data: ' + OSM_ATTR,
    }],
  },
};

export const EXTRA_BASEMAP_KEYS = Object.keys(EXTRA_BASEMAPS);

export function expandTiles({ url, subdomains }) {
  return subdomains ? subdomains.map((s) => url.replace("{s}", s)) : [url];
}

const BTN = 32; 
const GAP = 2; 

export function useToolbarRows(ref, count, reserve = 12) {
  const [rows, setRows] = useState(count);
  useEffect(() => {
    const el = ref.current;
    const holder = el?.offsetParent; 
    const map = holder?.offsetParent;
    if (!el || !holder || !map) return undefined;
    const update = () => {
      const free = map.clientHeight - holder.offsetTop - el.offsetTop - reserve - 10; 
      const fit = Math.floor((free + GAP) / (BTN + GAP));
      setRows(Math.max(3, Math.min(count, fit)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(map);
    return () => ro.disconnect();
  }, [ref, count, reserve]);
  return rows;
}