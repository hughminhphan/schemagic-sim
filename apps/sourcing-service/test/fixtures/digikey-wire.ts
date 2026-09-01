import type { DigiKeyProductDetailsWireResponse } from "../../src/providers/digikey";

/** Hand-authored synthetic wire shape. This is not a captured provider response. */
export const SYNTHETIC_DIGIKEY_PRODUCT_DETAILS: DigiKeyProductDetailsWireResponse = {
  SearchLocaleUsed: { Site: "US", Language: "en", Currency: "USD" },
  Product: {
    Manufacturer: { Id: 4242, Name: "Synthetic Components" },
    ManufacturerProductNumber: "SYN-DK-100",
    ProductUrl: "https://www.digikey.com/en/products/detail/synthetic/SYN-DK-100/1",
    BackOrderNotAllowed: false,
    Discontinued: false,
    EndOfLife: false,
    ProductStatus: { Id: 3, Status: "Last Time Buy" },
    DateLastBuyChance: "2027-01-01T00:00:00Z",
    ManufacturerLeadWeeks: "6 weeks",
    ProductVariations: [
      {
        DigiKeyProductNumber: "SYN-DK-100-CT-ND",
        PackageType: { Id: 1, Name: "Cut Tape (CT)" },
        StandardPricing: [
          { BreakQuantity: 100, UnitPrice: 0.75 },
          { BreakQuantity: 1, UnitPrice: 1.25 },
          { BreakQuantity: 10, UnitPrice: 1 },
        ],
        MarketPlace: false,
        QuantityAvailableforPackageType: 250,
        MinimumOrderQuantity: 1,
        StandardPackage: 100,
      },
      {
        DigiKeyProductNumber: "SYN-DK-100-TR-ND",
        PackageType: { Id: 2, Name: "Tape and Reel (TR)" },
        StandardPricing: [{ BreakQuantity: 1000, UnitPrice: 0.5 }],
        MarketPlace: false,
        QuantityAvailableforPackageType: 5000,
        MinimumOrderQuantity: 1000,
        StandardPackage: 1000,
      },
    ],
  },
};
