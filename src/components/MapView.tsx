import { useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { OPERATOR_BY_ID, TECH_INFO, type Tech } from "../data/operators";
import { formatDistance, haversine, type LatLon } from "../lib/geo";
import { effectiveRange } from "../lib/coverage";
import type { Tower } from "../lib/towers";

export type BaseLayer = "streets" | "satellite" | "light";

const TILES: Record<BaseLayer, { url: string; attribution: string }> = {
  streets: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap",
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
};

const iconCache = new Map<string, L.DivIcon>();
function towerIcon(color: string, topTech: Tech, selected: boolean) {
  const key = `${color}-${topTech}-${selected}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const size = selected ? 38 : 30;
    icon = L.divIcon({
      className: "",
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
      popupAnchor: [0, -size],
      html: `
        <div class="tower-pin ${selected ? "tower-pin--sel" : ""}" style="--c:${color};width:${size}px;height:${size}px">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9"/><path d="M7.8 4.7a6.14 6.14 0 0 0-.8 7.5"/>
            <circle cx="12" cy="9" r="2"/><path d="M16.2 4.8c2 2 2.26 5.11.8 7.47"/>
            <path d="M19.1 1.9a9.96 9.96 0 0 1 0 14.1"/><path d="M9.5 18h5"/><path d="m8 22 4-11 4 11"/>
          </svg>
          <span class="tower-badge" style="background:${TECH_INFO[topTech].color}">${topTech}</span>
        </div>`,
    });
    iconCache.set(key, icon);
  }
  return icon;
}

const userIcon = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div class="user-dot"><span></span></div>`,
});

const pointIcon = L.divIcon({
  className: "",
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  html: `<svg viewBox="0 0 24 32" width="30" height="40"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="#0f172a"/><circle cx="12" cy="12" r="5" fill="#facc15"/></svg>`,
});

function MapEvents({
  onClick,
  onMoveEnd,
}: {
  onClick: (p: LatLon) => void;
  onMoveEnd: (center: LatLon, zoom: number) => void;
}) {
  const map = useMapEvents({
    click(e) {
      onClick([e.latlng.lat, e.latlng.lng]);
    },
    moveend() {
      const c = map.getCenter();
      onMoveEnd([c.lat, c.lng], map.getZoom());
    },
  });
  return null;
}

function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function FlyTo({ target }: { target: { pos: LatLon; zoom?: number; nonce: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target.pos, target.zoom ?? Math.max(map.getZoom(), 14), { duration: 1.2 });
  }, [target, map]);
  return null;
}

interface Props {
  initialCenter: LatLon;
  userPos: LatLon | null;
  accuracy: number | null;
  analysisPoint: LatLon | null;
  towers: Tower[];
  circleTech: Tech | null;
  baseLayer: BaseLayer;
  selectedTowerId: string | null;
  flyTarget: { pos: LatLon; zoom?: number; nonce: number } | null;
  onMapClick: (p: LatLon) => void;
  onMoveEnd: (center: LatLon, zoom: number) => void;
  onSelectTower: (id: string | null) => void;
}

export default function MapView(props: Props) {
  const {
    initialCenter, userPos, accuracy, analysisPoint, towers, circleTech,
    baseLayer, selectedTowerId, flyTarget, onMapClick, onMoveEnd, onSelectTower,
  } = props;
  const tile = TILES[baseLayer];

  const circleTowers = useMemo(
    () => (circleTech ? towers.filter((t) => t.techs.includes(circleTech)) : []),
    [towers, circleTech]
  );

  return (
    <div dir="ltr" className="h-full w-full">
      <MapContainer center={initialCenter} zoom={14} className="h-full w-full" zoomControl={false}>
        <TileLayer key={baseLayer} url={tile.url} attribution={tile.attribution} maxZoom={19} />
        <MapEvents onClick={onMapClick} onMoveEnd={onMoveEnd} />
        <FlyTo target={flyTarget} />
        <AutoResize />

        {circleTech &&
          circleTowers.map((t) => (
            <Circle
              key={`c-${t.id}`}
              center={[t.lat, t.lon]}
              radius={effectiveRange(t, circleTech)}
              pathOptions={{
                color: OPERATOR_BY_ID[t.operatorId].color,
                weight: 1,
                opacity: 0.35,
                fillOpacity: 0.07,
              }}
              interactive={false}
            />
          ))}

        {towers.map((t) => {
          const op = OPERATOR_BY_ID[t.operatorId];
          const dist = analysisPoint ? haversine(analysisPoint, [t.lat, t.lon]) : null;
          return (
            <Marker
              key={t.id}
              position={[t.lat, t.lon]}
              icon={towerIcon(op.color, t.techs[0], t.id === selectedTowerId)}
              eventHandlers={{ click: () => onSelectTower(t.id) }}
            >
              <Popup>
                <div dir="rtl" className="min-w-[200px] font-[Tajawal] text-right">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: op.color }} />
                    <b className="text-base">{op.name}</b>
                    <span className="text-xs text-slate-500">{op.nameEn}</span>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {t.techs.map((tech) => (
                      <span
                        key={tech}
                        className="rounded px-1.5 py-0.5 text-xs font-bold text-white"
                        style={{ background: TECH_INFO[tech].color }}
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {dist !== null && (
                        <tr><td className="text-slate-500">المسافة</td><td>{formatDistance(dist)}</td></tr>
                      )}
                      <tr><td className="text-slate-500">عدد الخلايا</td><td>{t.cells}</td></tr>
                      {t.lac ? <tr><td className="text-slate-500">LAC/TAC</td><td>{t.lac}</td></tr> : null}
                      {t.samples ? <tr><td className="text-slate-500">عينات القياس</td><td>{t.samples}</td></tr> : null}
                      {t.avgSignal ? <tr><td className="text-slate-500">متوسط الإشارة</td><td>{t.avgSignal} dBm</td></tr> : null}
                      <tr>
                        <td className="text-slate-500">الإحداثيات</td>
                        <td dir="ltr">{t.lat.toFixed(5)}, {t.lon.toFixed(5)}</td>
                      </tr>
                      <tr>
                        <td className="text-slate-500">المصدر</td>
                        <td>{t.source === "simulated" ? "تقديري" : t.source === "csv" ? "ملف OpenCellID" : "OpenCellID API"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {userPos && accuracy && accuracy < 3000 && (
          <Circle
            center={userPos}
            radius={accuracy}
            pathOptions={{ color: "#2563eb", weight: 1, fillOpacity: 0.08 }}
            interactive={false}
          />
        )}
        {userPos && (
          <Marker position={userPos} icon={userIcon} zIndexOffset={1000}>
            <Popup><div dir="rtl" className="font-[Tajawal]">موقعك الحالي</div></Popup>
          </Marker>
        )}
        {analysisPoint && (!userPos || haversine(analysisPoint, userPos) > 5) && (
          <Marker position={analysisPoint} icon={pointIcon} zIndexOffset={900}>
            <Popup><div dir="rtl" className="font-[Tajawal]">نقطة التحليل</div></Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
