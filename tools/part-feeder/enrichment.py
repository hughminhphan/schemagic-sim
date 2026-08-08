"""Provider-neutral catalog enrichment interface.

No provider implementation, authentication flow, credential storage, or network
client belongs in this module. Enrichers operate on already selected tranche
rows and return source-labelled factual candidates only.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping, Protocol, Sequence


@dataclass(frozen=True)
class EnrichmentResult:
    provider: str
    provider_part_id: str
    matched_mpn: str
    match_confidence: float
    attributes: Mapping[str, Any] = field(default_factory=dict)
    datasheet_urls: Sequence[str] = field(default_factory=tuple)


class CatalogEnricher(Protocol):
    provider: str

    def enrich(self, part: Mapping[str, object]) -> EnrichmentResult:
        """Return source-labelled facts for one already selected catalog row."""
        ...
