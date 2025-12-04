import { Question, StatsGroup } from "./types";

export const COLOR_PALETTE = {
  BDG:   { bg:"bg-amber-50 dark:bg-amber-900/20", border:"border-amber-400", bar:"bg-amber-400", text:"text-amber-700 dark:text-amber-200" },
  SPG:   { bg:"bg-blue-50 dark:bg-blue-900/20",   border:"border-blue-500",   bar:"bg-blue-500",   text:"text-blue-700 dark:text-blue-200" },
  StPO:  { bg:"bg-rose-50 dark:bg-rose-900/20",    border:"border-rose-500",    bar:"bg-rose-500",    text:"text-rose-700 dark:text-rose-200" },
  ADMIN: { bg:"bg-emerald-50 dark:bg-emerald-900/20",  border:"border-emerald-500",  bar:"bg-emerald-500",  text:"text-emerald-700 dark:text-emerald-200" },
};

export const GROUPS: Omit<StatsGroup, 'total'|'attempted'|'correct'>[] = [
  { key:"BDG",   title:"Dienstrecht (BDG)",           color:COLOR_PALETTE.BDG },
  { key:"SPG",   title:"Sicherheitspolizei (SPG)",     color:COLOR_PALETTE.SPG },
  { key:"STPO",  title:"Strafprozess/StGB",            color:COLOR_PALETTE.StPO },
  { key:"ADMIN", title:"Verwaltung & Verkehr",          color:COLOR_PALETTE.ADMIN },
];

export const GROUP_TAGS: Record<string, string[]> = {
  BDG: ["BDG"],
  SPG: ["SPG"],
  STPO: ["StPO", "StGB"],
  ADMIN: ["AVG", "VStG", "WaffG", "StVO", "KFG", "FSG"]
};

export const DEFAULT_QUESTIONS: Question[] = [
  { id: "bdg-43-ma-1", question:"§ 43 BDG: Wie hat ein Beamter seine dienstlichen Aufgaben zu erfüllen? Wählen Sie alle zutreffenden.", choices:["Unter Beachtung der geltenden Rechtsordnung.","Treu, gewissenhaft, engagiert und unparteiisch.","Nur nach ständiger Rücksprache mit dem unmittelbaren Vorgesetzten.","So, dass das Vertrauen der Allgemeinheit erhalten bleibt.","Primär an interne Dienstanweisungen, nicht an Gesetze, gebunden."], correct:[0,1,3], explain:"§ 43 BDG: Rechtstreue, Gewissenhaftigkeit, Engagement, Unparteilichkeit und Wahrung des Vertrauens der Allgemeinheit.", law_ref:"BDG § 43", tags:["BDG"], last_checked:"2025-11-11", difficulty:1 },
  { id:"bdg-44-ma-1", question:"§ 44 BDG (Weisungen): In welchen Fällen ist zu remonstrieren/abzulehnen? Wählen Sie alle zutreffenden.", choices:["Wenn die Weisung von einem unzuständigen Organ erteilt wurde.","Wenn die Befolgung gegen verwaltungsrechtliche Vorschriften verstoßen würde.","Wenn die Befolgung gegen strafrechtliche Vorschriften verstoßen würde.","Wenn der Inhalt unklar ist und trotz Nachfrage unklar bleibt.","Wenn die Weisung mündlich erteilt wurde."], correct:[0,1,2,3], explain:"Unzuständigkeit oder Rechtswidrigkeit → Remonstrationspflicht; Mündlichkeit allein macht eine Weisung nicht unbeachtlich.", law_ref:"BDG § 44", tags:["BDG"], last_checked:"2025-11-11", difficulty:2 },
  { id:"bdg-43a-ma-1", question:"§ 43a BDG (achtungsvoller Umgang): Welche Aussagen treffen zu? Wählen Sie alle zutreffenden.", choices:["Beamte haben menschenwürdeverletzender Verhalten zu unterlassen.","Vorgesetzte und Mitarbeiter begegnen einander mit Achtung.","Spontane Entgleisungen sind disziplinär immer irrelevant.","Vorgesetzte haben für achtungsvollen Umgang Sorge zu tragen.","§ 43a betrifft nur den Umgang mit Parteien."], correct:[0,1,3], explain:"§ 43a BDG verlangt würdevollen, diskriminierungsfreien Umgang; spontane Entgleisungen können relevant sein.", law_ref:"BDG § 43a", tags:["BDG"], last_checked:"2025-11-11", difficulty:1 },
  { id:"bdg-39-ma-1", question:"§ 39 BDG (Dienstzuteilung): Unter welchen Bedingungen ist eine Zuteilung ohne schriftliche Zustimmung über 90 Tage zulässig? Wählen Sie alle zutreffenden.", choices:["Wenn der Dienstbetrieb auf andere Weise nicht aufrechterhalten werden kann.","Wenn sie zum Zwecke einer Ausbildung erfolgt.","Wenn wichtige private Gründe vorliegen.","Wenn der Kommandant der entsendenden Dienststelle zustimmt.","Wenn der Kommandant der Zuteilungsdienststelle zustimmt."], correct:[0,1], explain:">90 Tage ohne Zustimmung: nur zur Aufrechterhaltung des Dienstbetriebs oder zu Ausbildungszwecken.", law_ref:"BDG § 39", tags:["BDG"], last_checked:"2025-11-11", difficulty:2 },
];

// Utility: RNG for shuffling
function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for(let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  return function(){
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^ h >>> 16) >>> 0;
  };
}

function mulberry32(a: number) {
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(array: T[], seedStr: string): T[] {
  const seed = xmur3(seedStr)();
  const rng = mulberry32(seed);
  const a = [...array];
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(rng()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

export function hashPassword(str: string): string {
  let hash = 0;
  for(let i=0;i<str.length;i++){
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash)}`;
}

export function generateId(prefix="id"): string {
  const cleanPrefix = prefix.replace(/[^a-z0-9]+/gi, "").toLowerCase() || "id";
  return `${cleanPrefix}-${Math.random().toString(36).slice(2,8)}-${Date.now().toString(36)}`;
}