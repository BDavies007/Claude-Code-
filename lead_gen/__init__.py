"""Lead-generation & scoring model for Beyond Green Group.

Identifies, scores, ranks and segments the world's largest energy consumers as
sales prospects for green-energy / decarbonization offerings.

See ``lead_gen/README.md`` for the prominent data-integrity caveat: the package
ships a small CURATED set of real, publicly-estimable large energy consumers
(``data_quality = "public-estimate"``) and fills the remainder of any requested
list with clearly-labelled SYNTHETIC records (``data_quality = "synthetic"``).
No fabricated company is ever presented as a factual named energy consumer.
"""

from __future__ import annotations

__version__ = "1.0.0"

__all__ = ["__version__"]
