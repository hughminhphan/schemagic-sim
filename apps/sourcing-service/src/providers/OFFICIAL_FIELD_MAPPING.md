# Official provider field mapping

Verified against the linked official documentation on 2026-08-23. This note
records a conservative technical mapping, not approval to call an API or a legal
interpretation of provider terms. Both executable policy manifests remain
disabled pending account access and written deployment approval.

The adapters contain no HTTP client, credentials, token logic, or live payloads.
An injected server-only transport owns those concerns. Transport requests expose
only bounded exact lookup criteria and an abort signal. Provider errors and raw
wire responses are never copied into snapshots.

## DigiKey Product Information V4

Official sources:

- [ProductDetails endpoint](https://developer.digikey.com/products/product-information-v4/productsearch/productdetails?prod=true)
- [Product Information V4 OpenAPI document](https://developer.digikey.com/node/2357/oas-download)
- [API User Agreement](https://developer.digikey.com/api-user-agreement)

The transport uses the single-product `ProductDetails` shape and a provider
manufacturer ID. The ID must be injected from DigiKey's Manufacturers method;
Robonyx does not infer it from an internal manufacturer registry key.

| DigiKey field | Frozen normalized field | Rule |
| --- | --- | --- |
| `SearchLocaleUsed.Site`, `Currency` | `region`, `currency` | Must exactly equal the request or no offer is emitted. |
| `Manufacturer.Id`, `ManufacturerProductNumber` | `part` | Both must exactly match the injected manufacturer reference and requested MPN. |
| `ProductVariations[].DigiKeyProductNumber` | `distributorSku` | Required non-empty string. |
| `PackageType.Name` | `packaging` | Only documented names are accepted: Tape and Reel/Digi-Reel → `reel`, Cut Tape → `cut_tape`, Tube, Tray, and Bulk. Other names remain unknown and that variation is omitted. |
| `MarketPlace` | `marketplace` | Required boolean; missing values remain unknown and the variation is omitted. |
| `BackOrderNotAllowed` | `backorderAvailable` | The documented prohibition is inverted. Missing values remain unknown and all variations are omitted. |
| `QuantityAvailableforPackageType` | `stockQuantity` | Accepted only as a non-negative integer. The aggregate product quantity is not used. |
| `MinimumOrderQuantity` | `minimumOrderQuantity` | Accepted only as a positive integer. |
| `StandardPricing[].BreakQuantity`, `UnitPrice` | `priceBreaks` | Positive integer quantities and non-negative finite numeric unit prices only; sorted deterministically. |
| `ManufacturerLeadWeeks` | `leadTimeDays`, `leadTimeKind` | Strict numeric weeks or the documented `N weeks` form, multiplied by seven; kind is `manufacturer`. Other forms remain unknown. |
| `ProductStatus.Status` | `lifecycle` | Exact documented labels only: Active, Obsolete, Last Time Buy, and Not For New Designs. Preliminary and distributor-only discontinuation stay unknown. |
| `EndOfLife` | `lifecycle` | `true` proves obsolete only when it does not conflict with another status; conflicts become unknown. |
| `DateLastBuyChance` | `lastTimeBuyAt` | Used only with exact Last Time Buy status and a valid timestamp. |
| `ProductUrl` | `productUrl` | V1 requires HTTP(S); native V2 additionally requires HTTPS on `www.digikey.com`. |

`StandardPackage` is explicitly the manufacturer's standard package quantity;
it is not mapped to order multiple. `Discontinued` means no longer sold or
stocked by DigiKey and is not promoted to a manufacturer lifecycle fact.
Customer-specific `MyPricing` is not normalized; only `StandardPricing` is used.
Product-status numeric IDs are not documented as a stable enumeration and are
ignored. The request `region` must be a DigiKey site code because that is the
provenance value returned by `SearchLocaleUsed.Site`.

DigiKey's agreement requires source attribution and restricts modification,
aggregation, database creation, downstream display, and unapproved use. Whether
this normalized representation and Robonyx's deployment modes are permitted
requires written approval; consequently cache TTL, persistence, credentials,
rate limits, and both execution modes stay disabled in the manifest.

## Mouser Search API V2

Official sources:

- [Search API overview](https://www.mouser.com/en/api-search/)
- [Search API V2 OpenAPI document](https://api.mouser.com/api/docs/V2)
- [Search API Terms of Service](https://www.mouser.com/en/apiterms/)

The injected manufacturer name must be an exact value from Mouser's
`manufacturerlist` method. A request is limited to ten values, one manufacturer,
the documented Exact option, 3–40 characters per value, and no embedded pipe.

The V2 request field is named and described as `mouserPartNumber`, even though
the response includes `ManufacturerPartNumber`. The official contract does not
unambiguously state that arbitrary manufacturer MPNs are accepted by that field.
No live transport should be implemented or enabled until Mouser confirms the
exact-MPN usage intended here.

The draft normalizer retains only these documented, strictly parseable facts:

| Mouser field | Draft field | Rule |
| --- | --- | --- |
| `Manufacturer`, `ManufacturerPartNumber` | `part` match | Must exactly match the injected manufacturer name and requested MPN. |
| `MouserPartNumber` | `distributorSku` | Retained as the distributor SKU. |
| `Min` | `minimumOrderQuantity` | Positive ASCII integer only. |
| `Mult` | `orderMultiple` | Positive ASCII integer only. |
| `AvailabilityInStock` | `stockQuantity` | Non-negative ASCII integer only; prose forms are not parsed. |
| `PriceBreaks[].Quantity`, `Price`, `Currency` | `priceBreaks` | Positive quantity, currency equal to the request, and currency-free ASCII decimal price only. Symbols, grouping, and locale-specific formats remain unknown. |
| `ProductDetailUrl` | `productUrl` | Retained for attribution, but cannot form an offer by itself. |

Current V2 ambiguities deliberately left unknown:

- The Search API overview lists Packaging and Standard Pack Quantity as
  available data, but the current V2 `MouserPart` schema exposes neither field.
  `Reeling` and `AlternatePackagings` do not prove the packaging of the returned
  orderable SKU.
- `LifecycleStatus` and string-valued `IsDiscontinued` have no documented value
  enumeration or precedence/conflict rule in the V2 schema.
- `LeadTime` is a string with no documented unit or kind.
- `AvailableOnOrder` is a string and does not prove the frozen
  `backorderAvailable` boolean. The dated `AvailabilityOnOrder` array describes
  upstream quantities/dates, not whether a customer backorder is accepted.
- No marketplace semantic is present in the V2 response.
- The response proves price currency but does not expose a normalized region
  that can be checked against the request.
- `Availability` and `FactoryStock` are strings without documented parse formats
  or sufficiently precise semantics, so they are not used.
- `SalesMaximumOrderQty` has no frozen V1 destination and is not reinterpreted as
  an order multiple.

Packaging, marketplace, and backorder availability are required by the frozen
V1 `DistributorOffer`. The V1 adapter therefore returns a canonical `partial`
snapshot with no offer. The native V2 adapter uses the approved unknown-capable
offer contract: it retains a safely identified `www.mouser.com` SKU with the
documented stock, order, and price facts, marks every unresolved semantic with a
typed unknown reason, and keeps the snapshot `partial`. Unknown observations can
never satisfy a hard commercial policy constraint.

Mouser's terms prohibit caching or otherwise storing Mouser content and require
application enrollment, attribution, and distinct presentation from third-party
content. The permitted status of normalization/aggregation and the intended
public or self-host deployment must be confirmed in writing. The manifest
therefore remains disabled with zero cache and persistence lifetimes.
