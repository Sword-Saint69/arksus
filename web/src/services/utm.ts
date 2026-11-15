// WGS84 ↔ UTM (northern hemisphere), Krüger series to n³: millimetre-level
// within a zone, far finer than a 10 m Sentinel-2 pixel. Sentinel-2 tiles are
// delivered in UTM, the map works in longitude and latitude.

const A = 6378137;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const E0 = 500000;
const n = F / (2 - F);
const A_ = (A / (1 + n)) * (1 + n ** 2 / 4 + n ** 4 / 64);
const ALPHA = [n / 2 - (2 * n ** 2) / 3 + (5 * n ** 3) / 16, (13 * n ** 2) / 48 - (3 * n ** 3) / 5, (61 * n ** 3) / 240];
const BETA = [n / 2 - (2 * n ** 2) / 3 + (37 * n ** 3) / 96, n ** 2 / 48 + n ** 3 / 15, (17 * n ** 3) / 480];
const DELTA = [2 * n - (2 * n ** 2) / 3 - 2 * n ** 3, (7 * n ** 2) / 3 - (8 * n ** 3) / 5, (56 * n ** 3) / 15];
const RAD = Math.PI / 180;
const C = (2 * Math.sqrt(n)) / (1 + n);

export const zoneOf = (lon: number): number => Math.floor((lon + 180) / 6) + 1;
const centralMeridian = (zone: number) => (zone * 6 - 183) * RAD;

/** Longitude, latitude (degrees) → easting, northing (metres) in the given zone. */
export function toUtm(lon: number, lat: number, zone: number): [number, number] {
  const phi = lat * RAD, dl = lon * RAD - centralMeridian(zone);
  const s = Math.sin(phi);
  const t = Math.sinh(Math.atanh(s) - C * Math.atanh(C * s));
  const xi = Math.atan2(t, Math.cos(dl));
  const eta = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
  let e = eta, nn = xi;
  for (let j = 1; j <= 3; j++) {
    e += ALPHA[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
    nn += ALPHA[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
  }
  return [E0 + K0 * A_ * e, K0 * A_ * nn];
}

/** Easting, northing (metres) in the given zone → longitude, latitude (degrees). */
export function fromUtm(easting: number, northing: number, zone: number): [number, number] {
  const xi = northing / (K0 * A_), eta = (easting - E0) / (K0 * A_);
  let xi1 = xi, eta1 = eta;
  for (let j = 1; j <= 3; j++) {
    xi1 -= BETA[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    eta1 -= BETA[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }
  const chi = Math.asin(Math.sin(xi1) / Math.cosh(eta1));
  let phi = chi;
  for (let j = 1; j <= 3; j++) phi += DELTA[j - 1] * Math.sin(2 * j * chi);
  const lam = centralMeridian(zone) + Math.atan2(Math.sinh(eta1), Math.cos(xi1));
  return [lam / RAD, phi / RAD];
}
