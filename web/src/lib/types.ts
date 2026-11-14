// Contract types — PLAN_MVP §4, ARAYUZLER §8. Owner: Gümüş (Rol B).
// Do not edit locally. Changes go through Gümüş: ARAYUZLER.md + this file + docs/contract/*.schema.json + mock JSON, one PR.

/** Location ids come from site_index.locations (engine/config/locations.yaml); not a fixed list since 14 Nov. */
export type LocationId = string;
export type RotationId = 'fallow_wheat' | 'chickpea_wheat' | 'lentil_wheat';
export type DepthId = 'shallow' | 'medium' | 'deep';
export type CropId = 'wheat' | 'chickpea' | 'lentil' | 'fallow';
export type LegumeId = 'chickpea' | 'lentil';
export type Badge = 'measured' | 'model' | 'official' | 'statistic' | 'literature' | 'assumption' | 'user';

export interface Text { en: string; tr: string }

/** Value object. `value: null` = not yet sourced ("pending"): show "pending", never a number. */
export interface V {
  value: number | null;
  unit: string;
  source: string;
  source_url?: string;
  type: Badge;
  verified: boolean;
  as_of?: string;
}

interface FileHeader {
  schema_version: '1.0';
  mock: boolean;
  generated_at: string;
}

// §4.1 site_index.json
export interface Location {
  id: LocationId; name: string; district: string; province: string;
  lat: number; lon: number; elevation_m: number; note: Text;
}
export interface Evidence { text: Text; source: string; source_url?: string }
export interface Strategy { why: Text; evidence: Evidence[]; benefits: Text[]; gaps: Text[]; local_review: Text[] }
export interface Rotation {
  id: RotationId;
  is_baseline: boolean;
  crops: [CropId, CropId];          // [year-1 crop, 'wheat']
  label: Text;
  soil_traits: { n_fixing: boolean; tillage_passes: V; note: Text };
  strategy: Strategy;
}
export interface DepthClass { id: DepthId; depth_m: number; label: Text }
export interface SiteIndex extends FileHeader {
  power_range: { start: string; end: string };
  locations: Location[];
  rotations: Rotation[];            // baseline always first
  depth_classes: DepthClass[];
  start_years: [number, number];    // [first, last], both inclusive
}

// §4.2 results/{location_id}.json
export interface SoilProperty {
  id: 'clay' | 'sand' | 'silt' | 'phh2o' | 'soc' | 'nitrogen' | 'cec' | 'bdod' | 'cfvo';
  label: Text; depth: string; q05: number; q50: number; q95: number; unit: string;
  source: string; type: Badge; how_obtained: 'wcs' | 'gee' | 'manual_viewer'; meaning: Text;
}
export interface FirstCrop { crop_id: LegumeId; eta_mm: number; etc_mm: number; stress_days: number; yield_ratio: number }
export interface WheatResult { eta_mm: number; etc_mm: number; stress_days: number; heat_days_flowering: number; yield_ratio: number }
export interface SequenceRow {
  start_year: number;
  rotation_id: RotationId;
  depth_id: DepthId;
  pre_sowing_precip_mm: number;
  water_at_wheat_sowing_mm: number;
  fallow_storage_efficiency: number | null;  // fallow_wheat only
  bare_days: number;
  wind_exposed_bare_days: number;
  bare_by_month: number[];                   // 24, index 0 = July of start_year
  stress_by_month: number[];                 // 24
  fullness_by_month: number[];               // 24, 0–100 (100 = field capacity)
  first_crop: FirstCrop | null;              // null for fallow_wheat
  wheat: WheatResult;
}
export interface ResultsFile extends FileHeader {
  location_id: LocationId;
  soil: {
    awc_mm_per_m: { value: number | null; unit?: string; source: string; type: Badge; verified: boolean };
    properties: SoilProperty[];
    not_available_remotely: string[];
  };
  sequences: SequenceRow[];                  // 216 = 3 rotations × 3 depths × 24 years
}

// §4.3 ledger/{location_id}.json
export type LedgerCrop = 'fallow' | 'bare' | 'wheat' | 'chickpea' | 'lentil';
export interface LedgerWeek { week_start: string; p_mm: number; eta_mm: number; dp_mm: number; aw_mm: number; crop: LedgerCrop }
export interface LedgerSeries { start_year: number; rotation_id: RotationId; depth_id: DepthId; weeks: LedgerWeek[] }
export interface LedgerFile extends FileHeader { location_id: LocationId; series: LedgerSeries[] }

// §4.3b smap/{location_id}.json — always present; when available is false, latest is null and lists are empty
export interface SmapFile extends FileHeader {
  location_id: LocationId;
  available: boolean;
  product: string;
  cell_km: number;
  latest: { date: string; rootzone_wetness: number; rootzone_m3m3: number; percentile_for_month: number } | null;
  monthly_climatology: { month: number; p10: number; p50: number; p90: number }[];
  monthly_series: { month_start: string; rootzone_wetness: number; surface_wetness: number }[];
}

// §4.4 defaults.json
export interface CropDefaults { ym_kg_per_da: V; price_tl_per_kg: V; cost_tl_per_da: V; support_tl_per_da: V }
export interface FallowDefaults { cost_tl_per_da: V; support_tl_per_da: V }
export interface LocationDefaults { wheat: CropDefaults; chickpea: CropDefaults; lentil: CropDefaults; fallow: FallowDefaults }
export interface DefaultsFile extends FileHeader { values: Record<LocationId, LocationDefaults> }

// §4.5 validation.json
export type CheckId = 'mass_balance' | 'et0_fao56_ex18' | 'pse_literature' | 'trial_ratio' | 'precip_vs_mgm';
export interface Check { id: CheckId; status: 'pass' | 'fail' | 'info' | 'pending'; value: string; reference: string; note: Text }
export interface ValidationFile extends FileHeader { checks: Check[] }
