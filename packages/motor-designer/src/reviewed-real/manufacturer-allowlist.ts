import type { ReviewedManufacturer } from "./types";

function manufacturer(id: string, displayName: string, ...primarySourceHosts: string[]): Readonly<ReviewedManufacturer> {
  return Object.freeze({
    id,
    displayName,
    primarySourceHosts: Object.freeze(primarySourceHosts),
  });
}

/**
 * Code-owned trust root for this staged tranche. Catalog input cannot extend or
 * rewrite it to make an arbitrary evidence URL appear manufacturer-authored.
 */
export const REVIEWED_REAL_MANUFACTURER_ALLOWLIST = Object.freeze([
  manufacturer("texas-instruments", "Texas Instruments", "ti.com", "www.ti.com"),
  manufacturer("stmicroelectronics", "STMicroelectronics", "st.com"),
  manufacturer("toshiba-semiconductor-storage", "Toshiba Electronic Devices & Storage", "toshiba.semicon-storage.com"),
  manufacturer("allegro-microsystems", "Allegro MicroSystems", "allegromicro.com", "www.allegromicro.com"),
  manufacturer("renesas-electronics", "Renesas Electronics", "renesas.com", "www.renesas.com"),
]);
