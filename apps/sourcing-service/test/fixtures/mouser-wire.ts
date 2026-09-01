import type { MouserSearchWireResponse } from "../../src/providers/mouser";

/** Hand-authored synthetic wire shape. This is not a captured provider response. */
export const SYNTHETIC_MOUSER_SEARCH: MouserSearchWireResponse = {
  Errors: [],
  SearchResults: {
    NumberOfResult: 1,
    Parts: [{
      Availability: "synthetic availability text",
      FactoryStock: "synthetic factory-stock text",
      LeadTime: "8 Weeks",
      LifecycleStatus: "Synthetic Active Label",
      Manufacturer: "Synthetic Components",
      ManufacturerPartNumber: "SYN-MO-100",
      Min: "5",
      Mult: "10",
      MouserPartNumber: "999-SYN-MO-100",
      PriceBreaks: [
        { Quantity: 100, Price: "0.75", Currency: "USD" },
        { Quantity: 1, Price: "1.25", Currency: "USD" },
        { Quantity: 10, Price: "$1.00", Currency: "USD" },
        { Quantity: 10, Price: "0.90", Currency: "EUR" },
      ],
      ProductDetailUrl: "https://www.mouser.com/ProductDetail/Synthetic/SYN-MO-100",
      Reeling: true,
      IsDiscontinued: "false",
      AvailableOnOrder: "100",
      AvailabilityInStock: "1200",
    }],
  },
};
