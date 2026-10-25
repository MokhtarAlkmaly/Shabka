import type { OperatorId } from "./operators";
import type { LatLon } from "../lib/geo";

export const TAIZ_OPERATORS: OperatorId[] = ["yemenmobile", "you"];

export interface TaizPlace {
  id: string;
  name: string;
  center: LatLon;
}

/** نقاط مرجعية تقريبية للتنقل، وليست حدود تغطية أو حدوداً إدارية. */
export const TAIZ_SECTIONS: { id: string; title: string; places: TaizPlace[] }[] = [
  {
    id: "city",
    title: "مدينة تعز",
    places: [{ id: "jamal", name: "شارع جمال", center: [13.5789, 44.0214] }],
  },
  {
    id: "surroundings",
    title: "الحوبان وشرعب الرونة",
    places: [
      { id: "hawban", name: "الحوبان", center: [13.6300, 44.0700] },
      { id: "sharaab", name: "شرعب الرونة", center: [13.7900, 43.8700] },
    ],
  },
];
