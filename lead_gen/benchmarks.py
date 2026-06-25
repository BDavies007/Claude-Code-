"""Sector / region benchmarks and the curated real-consumer seed list.

ALL numbers here are approximate, public-domain order-of-magnitude estimates
intended for *relative* prioritization, not financial-grade reporting. The
curated seed list below contains genuinely large, well-known energy consumers
with rough publicly-estimable annual electricity figures; each is flagged
``data_quality = "public-estimate"`` when materialized as a :class:`Lead`.

NOTHING here should be read as an exact, audited consumption figure.
"""

from __future__ import annotations

from typing import Dict, List, Tuple

from .schema import Region, Sector

# --------------------------------------------------------------------------- #
# Sector benchmarks
# --------------------------------------------------------------------------- #
# Typical annual electricity consumption (MWh) for a *large* facility/operator
# in the sector, expressed as a (low, typical, high) triple. Used to draw
# synthetic consumption values. Order-of-magnitude only.
SECTOR_CONSUMPTION_MWH: Dict[Sector, Tuple[float, float, float]] = {
    Sector.DATA_CENTER: (300_000, 2_500_000, 25_000_000),
    Sector.SEMICONDUCTOR: (500_000, 4_000_000, 30_000_000),
    Sector.STEEL: (1_000_000, 6_000_000, 40_000_000),
    Sector.ALUMINIUM: (2_000_000, 12_000_000, 60_000_000),
    Sector.CEMENT: (200_000, 1_200_000, 8_000_000),
    Sector.CHEMICALS: (500_000, 3_000_000, 25_000_000),
    Sector.MINING: (400_000, 2_500_000, 20_000_000),
    Sector.AUTOMOTIVE: (200_000, 1_000_000, 6_000_000),
    Sector.RETAIL: (300_000, 1_500_000, 12_000_000),
    Sector.TELECOM: (200_000, 1_200_000, 9_000_000),
    Sector.OIL_AND_GAS: (500_000, 3_500_000, 25_000_000),
    Sector.PAPER: (300_000, 1_500_000, 9_000_000),
    Sector.FOOD_BEVERAGE: (150_000, 800_000, 5_000_000),
    Sector.PHARMA: (100_000, 600_000, 4_000_000),
    Sector.LOGISTICS: (100_000, 700_000, 5_000_000),
}

# Decarbonization "fit/difficulty" weight in [0, 1]: how attractive and
# tractable the sector is for *our* offerings. Higher = better fit (e.g. data
# centers / retail electrify easily via PPA & on-site solar); hard-to-abate
# heavy industry scores lower on tractability but still high on opportunity.
SECTOR_FIT_WEIGHT: Dict[Sector, float] = {
    Sector.DATA_CENTER: 0.95,
    Sector.SEMICONDUCTOR: 0.85,
    Sector.STEEL: 0.45,
    Sector.ALUMINIUM: 0.55,
    Sector.CEMENT: 0.40,
    Sector.CHEMICALS: 0.55,
    Sector.MINING: 0.60,
    Sector.AUTOMOTIVE: 0.80,
    Sector.RETAIL: 0.90,
    Sector.TELECOM: 0.85,
    Sector.OIL_AND_GAS: 0.50,
    Sector.PAPER: 0.65,
    Sector.FOOD_BEVERAGE: 0.75,
    Sector.PHARMA: 0.75,
    Sector.LOGISTICS: 0.85,
}

# Typical share of electricity spend addressable by our green offerings, and a
# representative incremental value (USD) we can capture per MWh served. Used to
# estimate annual opportunity value. Coarse planning figures only.
SECTOR_ADDRESSABLE_SHARE: Dict[Sector, float] = {
    Sector.DATA_CENTER: 0.70,
    Sector.SEMICONDUCTOR: 0.55,
    Sector.STEEL: 0.30,
    Sector.ALUMINIUM: 0.35,
    Sector.CEMENT: 0.30,
    Sector.CHEMICALS: 0.40,
    Sector.MINING: 0.45,
    Sector.AUTOMOTIVE: 0.55,
    Sector.RETAIL: 0.65,
    Sector.TELECOM: 0.60,
    Sector.OIL_AND_GAS: 0.35,
    Sector.PAPER: 0.50,
    Sector.FOOD_BEVERAGE: 0.55,
    Sector.PHARMA: 0.55,
    Sector.LOGISTICS: 0.60,
}

# Representative captured value per addressable MWh (USD). Blends green premium,
# advisory fees and storage/efficiency margins. Planning-grade.
VALUE_PER_MWH_USD: float = 8.0

# Typical current renewable electricity share (%) for the sector: (low, high).
SECTOR_RENEWABLE_PCT: Dict[Sector, Tuple[float, float]] = {
    Sector.DATA_CENTER: (20.0, 75.0),  # hyperscalers vary widely
    Sector.SEMICONDUCTOR: (10.0, 60.0),
    Sector.STEEL: (3.0, 30.0),
    Sector.ALUMINIUM: (10.0, 55.0),  # some smelters run on hydro
    Sector.CEMENT: (2.0, 25.0),
    Sector.CHEMICALS: (5.0, 35.0),
    Sector.MINING: (5.0, 40.0),
    Sector.AUTOMOTIVE: (15.0, 55.0),
    Sector.RETAIL: (15.0, 70.0),
    Sector.TELECOM: (15.0, 65.0),
    Sector.OIL_AND_GAS: (3.0, 30.0),
    Sector.PAPER: (20.0, 60.0),  # biomass-heavy
    Sector.FOOD_BEVERAGE: (10.0, 55.0),
    Sector.PHARMA: (15.0, 60.0),
    Sector.LOGISTICS: (10.0, 55.0),
}

# --------------------------------------------------------------------------- #
# Region benchmarks
# --------------------------------------------------------------------------- #
# Approximate average grid carbon intensity (gCO2/kWh). Public order-of-magnitude
# figures; real intensity varies by country, time and provider.
REGION_GRID_CARBON_GCO2_KWH: Dict[Region, float] = {
    Region.NORTH_AMERICA: 370.0,
    Region.EUROPE: 250.0,
    Region.CHINA: 580.0,
    Region.INDIA: 700.0,
    Region.EAST_ASIA: 450.0,
    Region.SOUTHEAST_ASIA: 520.0,
    Region.MIDDLE_EAST: 550.0,
    Region.LATIN_AMERICA: 220.0,
    Region.AFRICA: 500.0,
    Region.OCEANIA: 410.0,
}

# Regulatory / ESG pressure proxy in [0, 1] (carbon pricing, disclosure regimes,
# investor pressure). Europe highest; emerging markets lower on average.
REGION_ESG_PRESSURE: Dict[Region, float] = {
    Region.NORTH_AMERICA: 0.65,
    Region.EUROPE: 0.90,
    Region.CHINA: 0.55,
    Region.INDIA: 0.45,
    Region.EAST_ASIA: 0.70,
    Region.SOUTHEAST_ASIA: 0.45,
    Region.MIDDLE_EAST: 0.40,
    Region.LATIN_AMERICA: 0.50,
    Region.AFRICA: 0.35,
    Region.OCEANIA: 0.70,
}

# Relative share of synthetic records to draw from each region (need not sum to
# 1; used as weights). Skewed toward heavy-industry / data-center regions.
REGION_WEIGHT: Dict[Region, float] = {
    Region.NORTH_AMERICA: 0.22,
    Region.EUROPE: 0.20,
    Region.CHINA: 0.20,
    Region.INDIA: 0.09,
    Region.EAST_ASIA: 0.10,
    Region.SOUTHEAST_ASIA: 0.05,
    Region.MIDDLE_EAST: 0.04,
    Region.LATIN_AMERICA: 0.05,
    Region.AFRICA: 0.03,
    Region.OCEANIA: 0.02,
}

# Relative share of synthetic records per sector (weights).
SECTOR_WEIGHT: Dict[Sector, float] = {
    Sector.DATA_CENTER: 0.14,
    Sector.SEMICONDUCTOR: 0.06,
    Sector.STEEL: 0.10,
    Sector.ALUMINIUM: 0.05,
    Sector.CEMENT: 0.08,
    Sector.CHEMICALS: 0.10,
    Sector.MINING: 0.07,
    Sector.AUTOMOTIVE: 0.08,
    Sector.RETAIL: 0.08,
    Sector.TELECOM: 0.06,
    Sector.OIL_AND_GAS: 0.05,
    Sector.PAPER: 0.04,
    Sector.FOOD_BEVERAGE: 0.05,
    Sector.PHARMA: 0.02,
    Sector.LOGISTICS: 0.02,
}

# Representative countries per region for synthetic record labelling.
REGION_COUNTRIES: Dict[Region, List[str]] = {
    Region.NORTH_AMERICA: ["United States", "Canada", "Mexico"],
    Region.EUROPE: ["Germany", "France", "United Kingdom", "Netherlands", "Spain", "Italy", "Sweden", "Poland"],
    Region.CHINA: ["China"],
    Region.INDIA: ["India"],
    Region.EAST_ASIA: ["Japan", "South Korea", "Taiwan"],
    Region.SOUTHEAST_ASIA: ["Singapore", "Vietnam", "Malaysia", "Indonesia", "Thailand"],
    Region.MIDDLE_EAST: ["Saudi Arabia", "United Arab Emirates", "Qatar"],
    Region.LATIN_AMERICA: ["Brazil", "Chile", "Argentina"],
    Region.AFRICA: ["South Africa", "Egypt", "Morocco"],
    Region.OCEANIA: ["Australia", "New Zealand"],
}

# Generic site-name stems used to build clearly-synthetic organization names.
SECTOR_NAME_STEMS: Dict[Sector, List[str]] = {
    Sector.DATA_CENTER: ["Cloud Campus", "Hyperscale DC", "Data Hub"],
    Sector.SEMICONDUCTOR: ["Wafer Fab", "Semiconductor Works", "Foundry"],
    Sector.STEEL: ["Steel Works", "Steel Mill", "Metalworks"],
    Sector.ALUMINIUM: ["Aluminium Smelter", "Alumina Refinery", "Light Metals"],
    Sector.CEMENT: ["Cement Works", "Clinker Plant", "Cement Co"],
    Sector.CHEMICALS: ["Chemical Park", "Petrochem Complex", "Specialty Chemicals"],
    Sector.MINING: ["Mining Operations", "Mineral Resources", "Ore Processing"],
    Sector.AUTOMOTIVE: ["Vehicle Assembly", "Auto Manufacturing", "Mobility Works"],
    Sector.RETAIL: ["Retail Group", "Commerce Network", "Distribution Retail"],
    Sector.TELECOM: ["Telecom Networks", "Mobile Operator", "Connectivity Group"],
    Sector.OIL_AND_GAS: ["Refining Complex", "Upstream Operations", "Gas Processing"],
    Sector.PAPER: ["Pulp & Paper Mill", "Paperworks", "Fibre Mill"],
    Sector.FOOD_BEVERAGE: ["Food Processing", "Beverage Works", "Agri-Foods"],
    Sector.PHARMA: ["Pharma Manufacturing", "Bioworks", "Life Sciences Plant"],
    Sector.LOGISTICS: ["Logistics Network", "Fulfilment Centres", "Cold Chain"],
}


# --------------------------------------------------------------------------- #
# Curated real-consumer seed list
# --------------------------------------------------------------------------- #
# Each tuple: (organization, Sector, Region, country, approx_annual_consumption_MWh,
#              approx_current_renewable_pct, contract_renewal_months)
#
# These are genuinely large, well-known energy consumers. The consumption figures
# are APPROXIMATE public estimates (from sustainability reports, press coverage and
# industry analyses) and exist for relative prioritization only. Renewable % and
# renewal months are coarse public estimates / placeholders. When converted to
# Lead objects they carry data_quality = "public-estimate".
CuratedSeed = Tuple[str, Sector, Region, str, float, float, float]

CURATED_REAL_CONSUMERS: List[CuratedSeed] = [
    # --- Hyperscalers / data centers ---
    ("Google (Alphabet) Data Centers", Sector.DATA_CENTER, Region.NORTH_AMERICA, "United States", 25_000_000, 64.0, 14),
    ("Amazon (AWS) Data Centers", Sector.DATA_CENTER, Region.NORTH_AMERICA, "United States", 24_000_000, 55.0, 10),
    ("Microsoft Data Centers", Sector.DATA_CENTER, Region.NORTH_AMERICA, "United States", 20_000_000, 60.0, 12),
    ("Meta Platforms Data Centers", Sector.DATA_CENTER, Region.NORTH_AMERICA, "United States", 14_000_000, 70.0, 16),
    ("Apple Data Centers & Ops", Sector.DATA_CENTER, Region.NORTH_AMERICA, "United States", 7_000_000, 75.0, 18),
    ("Equinix", Sector.DATA_CENTER, Region.NORTH_AMERICA, "United States", 6_000_000, 50.0, 9),
    ("Digital Realty", Sector.DATA_CENTER, Region.NORTH_AMERICA, "United States", 5_500_000, 45.0, 8),
    ("Tencent Data Centers", Sector.DATA_CENTER, Region.CHINA, "China", 9_000_000, 30.0, 12),
    ("Alibaba Cloud Data Centers", Sector.DATA_CENTER, Region.CHINA, "China", 9_500_000, 32.0, 11),
    ("NTT Global Data Centers", Sector.DATA_CENTER, Region.EAST_ASIA, "Japan", 5_000_000, 35.0, 10),
    # --- Semiconductors ---
    ("TSMC", Sector.SEMICONDUCTOR, Region.EAST_ASIA, "Taiwan", 25_000_000, 11.0, 14),
    ("Samsung Electronics (Semiconductor)", Sector.SEMICONDUCTOR, Region.EAST_ASIA, "South Korea", 22_000_000, 20.0, 12),
    ("SK Hynix", Sector.SEMICONDUCTOR, Region.EAST_ASIA, "South Korea", 10_000_000, 18.0, 13),
    ("Intel", Sector.SEMICONDUCTOR, Region.NORTH_AMERICA, "United States", 10_000_000, 50.0, 15),
    ("Micron Technology", Sector.SEMICONDUCTOR, Region.NORTH_AMERICA, "United States", 6_000_000, 30.0, 12),
    # --- Steel ---
    ("ArcelorMittal", Sector.STEEL, Region.EUROPE, "Luxembourg", 40_000_000, 8.0, 9),
    ("China Baowu Steel Group", Sector.STEEL, Region.CHINA, "China", 45_000_000, 6.0, 10),
    ("Nippon Steel", Sector.STEEL, Region.EAST_ASIA, "Japan", 30_000_000, 9.0, 11),
    ("POSCO", Sector.STEEL, Region.EAST_ASIA, "South Korea", 28_000_000, 7.0, 10),
    ("Tata Steel", Sector.STEEL, Region.INDIA, "India", 22_000_000, 6.0, 8),
    ("Nucor", Sector.STEEL, Region.NORTH_AMERICA, "United States", 18_000_000, 12.0, 9),
    ("JSW Steel", Sector.STEEL, Region.INDIA, "India", 16_000_000, 8.0, 8),
    ("Thyssenkrupp Steel", Sector.STEEL, Region.EUROPE, "Germany", 14_000_000, 15.0, 7),
    # --- Aluminium ---
    ("Chinalco (Aluminum Corp. of China)", Sector.ALUMINIUM, Region.CHINA, "China", 60_000_000, 15.0, 10),
    ("Hongqiao Group", Sector.ALUMINIUM, Region.CHINA, "China", 55_000_000, 12.0, 9),
    ("Rusal", Sector.ALUMINIUM, Region.EUROPE, "Russia", 40_000_000, 55.0, 12),
    ("Alcoa", Sector.ALUMINIUM, Region.NORTH_AMERICA, "United States", 30_000_000, 40.0, 11),
    ("Rio Tinto Aluminium", Sector.ALUMINIUM, Region.OCEANIA, "Australia", 35_000_000, 50.0, 13),
    ("Norsk Hydro", Sector.ALUMINIUM, Region.EUROPE, "Norway", 25_000_000, 70.0, 14),
    ("Emirates Global Aluminium", Sector.ALUMINIUM, Region.MIDDLE_EAST, "United Arab Emirates", 22_000_000, 8.0, 10),
    # --- Cement ---
    ("Holcim", Sector.CEMENT, Region.EUROPE, "Switzerland", 8_000_000, 12.0, 9),
    ("Heidelberg Materials", Sector.CEMENT, Region.EUROPE, "Germany", 7_000_000, 14.0, 8),
    ("CEMEX", Sector.CEMENT, Region.LATIN_AMERICA, "Mexico", 6_500_000, 18.0, 10),
    ("Anhui Conch Cement", Sector.CEMENT, Region.CHINA, "China", 9_000_000, 8.0, 9),
    ("UltraTech Cement", Sector.CEMENT, Region.INDIA, "India", 6_000_000, 10.0, 8),
    # --- Chemicals ---
    ("BASF", Sector.CHEMICALS, Region.EUROPE, "Germany", 25_000_000, 16.0, 9),
    ("Dow", Sector.CHEMICALS, Region.NORTH_AMERICA, "United States", 22_000_000, 18.0, 10),
    ("Sinopec (Chemicals)", Sector.CHEMICALS, Region.CHINA, "China", 24_000_000, 6.0, 11),
    ("SABIC", Sector.CHEMICALS, Region.MIDDLE_EAST, "Saudi Arabia", 20_000_000, 5.0, 10),
    ("LyondellBasell", Sector.CHEMICALS, Region.NORTH_AMERICA, "United States", 15_000_000, 12.0, 9),
    ("Linde", Sector.CHEMICALS, Region.EUROPE, "United Kingdom", 18_000_000, 25.0, 10),
    ("Air Liquide", Sector.CHEMICALS, Region.EUROPE, "France", 17_000_000, 28.0, 11),
    # --- Mining & metals ---
    ("BHP", Sector.MINING, Region.OCEANIA, "Australia", 18_000_000, 25.0, 12),
    ("Glencore", Sector.MINING, Region.EUROPE, "Switzerland", 17_000_000, 20.0, 11),
    ("Vale", Sector.MINING, Region.LATIN_AMERICA, "Brazil", 16_000_000, 60.0, 12),
    ("Anglo American", Sector.MINING, Region.AFRICA, "South Africa", 14_000_000, 15.0, 10),
    ("Freeport-McMoRan", Sector.MINING, Region.NORTH_AMERICA, "United States", 12_000_000, 18.0, 9),
    ("Codelco", Sector.MINING, Region.LATIN_AMERICA, "Chile", 13_000_000, 45.0, 11),
    # --- Automotive ---
    ("Toyota Motor (Manufacturing)", Sector.AUTOMOTIVE, Region.EAST_ASIA, "Japan", 6_000_000, 25.0, 12),
    ("Volkswagen Group (Manufacturing)", Sector.AUTOMOTIVE, Region.EUROPE, "Germany", 5_500_000, 45.0, 11),
    ("Stellantis", Sector.AUTOMOTIVE, Region.EUROPE, "Netherlands", 4_500_000, 40.0, 10),
    ("General Motors", Sector.AUTOMOTIVE, Region.NORTH_AMERICA, "United States", 4_000_000, 50.0, 9),
    ("Ford Motor", Sector.AUTOMOTIVE, Region.NORTH_AMERICA, "United States", 3_800_000, 48.0, 9),
    ("Tesla (Manufacturing)", Sector.AUTOMOTIVE, Region.NORTH_AMERICA, "United States", 3_000_000, 55.0, 10),
    ("BYD", Sector.AUTOMOTIVE, Region.CHINA, "China", 4_500_000, 30.0, 11),
    # --- Retail / e-commerce ---
    ("Walmart", Sector.RETAIL, Region.NORTH_AMERICA, "United States", 12_000_000, 36.0, 8),
    ("Amazon (Stores & Logistics)", Sector.RETAIL, Region.NORTH_AMERICA, "United States", 10_000_000, 50.0, 9),
    ("Carrefour", Sector.RETAIL, Region.EUROPE, "France", 5_000_000, 40.0, 8),
    ("Tesco", Sector.RETAIL, Region.EUROPE, "United Kingdom", 4_500_000, 55.0, 8),
    ("JD.com", Sector.RETAIL, Region.CHINA, "China", 6_000_000, 25.0, 10),
    ("IKEA (Ingka Group)", Sector.RETAIL, Region.EUROPE, "Sweden", 4_000_000, 65.0, 9),
    # --- Telecom ---
    ("China Mobile", Sector.TELECOM, Region.CHINA, "China", 9_000_000, 28.0, 10),
    ("AT&T", Sector.TELECOM, Region.NORTH_AMERICA, "United States", 7_000_000, 40.0, 9),
    ("Deutsche Telekom", Sector.TELECOM, Region.EUROPE, "Germany", 5_000_000, 60.0, 9),
    ("Verizon", Sector.TELECOM, Region.NORTH_AMERICA, "United States", 6_000_000, 42.0, 9),
    ("Vodafone Group", Sector.TELECOM, Region.EUROPE, "United Kingdom", 4_500_000, 55.0, 8),
    ("Jio (Reliance)", Sector.TELECOM, Region.INDIA, "India", 5_500_000, 20.0, 10),
    # --- Oil & gas (operations electricity) ---
    ("Saudi Aramco (Operations)", Sector.OIL_AND_GAS, Region.MIDDLE_EAST, "Saudi Arabia", 25_000_000, 4.0, 12),
    ("ExxonMobil (Operations)", Sector.OIL_AND_GAS, Region.NORTH_AMERICA, "United States", 18_000_000, 8.0, 11),
    ("Shell (Operations)", Sector.OIL_AND_GAS, Region.EUROPE, "United Kingdom", 16_000_000, 20.0, 11),
    ("PetroChina (Operations)", Sector.OIL_AND_GAS, Region.CHINA, "China", 20_000_000, 6.0, 12),
    # --- Pulp & paper ---
    ("International Paper", Sector.PAPER, Region.NORTH_AMERICA, "United States", 9_000_000, 50.0, 9),
    ("Stora Enso", Sector.PAPER, Region.EUROPE, "Finland", 7_000_000, 75.0, 10),
    ("UPM-Kymmene", Sector.PAPER, Region.EUROPE, "Finland", 6_500_000, 70.0, 10),
    # --- Food & beverage ---
    ("Nestlé", Sector.FOOD_BEVERAGE, Region.EUROPE, "Switzerland", 5_000_000, 50.0, 9),
    ("PepsiCo", Sector.FOOD_BEVERAGE, Region.NORTH_AMERICA, "United States", 4_500_000, 45.0, 8),
    ("Coca-Cola", Sector.FOOD_BEVERAGE, Region.NORTH_AMERICA, "United States", 4_000_000, 48.0, 8),
    ("Anheuser-Busch InBev", Sector.FOOD_BEVERAGE, Region.EUROPE, "Belgium", 3_500_000, 50.0, 9),
    # --- Pharma ---
    ("Pfizer (Manufacturing)", Sector.PHARMA, Region.NORTH_AMERICA, "United States", 3_000_000, 45.0, 9),
    ("Novartis (Manufacturing)", Sector.PHARMA, Region.EUROPE, "Switzerland", 2_500_000, 55.0, 9),
    # --- Logistics ---
    ("DHL (Deutsche Post)", Sector.LOGISTICS, Region.EUROPE, "Germany", 4_000_000, 40.0, 8),
    ("FedEx", Sector.LOGISTICS, Region.NORTH_AMERICA, "United States", 3_500_000, 30.0, 8),
    ("UPS", Sector.LOGISTICS, Region.NORTH_AMERICA, "United States", 3_500_000, 35.0, 8),
]


def curated_count() -> int:
    """Number of curated real-consumer seed records."""
    return len(CURATED_REAL_CONSUMERS)
