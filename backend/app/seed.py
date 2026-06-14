"""Seed the catalog from Exicom Pricebook - LSQ.

Run idempotently at startup or manually:  python -m app.seed
New products are inserted; existing (matched by product_code + product_name) are skipped.
"""
from app.database import SessionLocal, Base, engine
from app import models

# ---------------------------------------------------------------------------
# All products from the Exicom Pricebook (LSQ)
# unit_price = first-tier price (lowest MoQ bracket = highest unit price)
# currency   = USD where available, else INR
# MoQ tiers are noted in code_note / description
# ---------------------------------------------------------------------------

SEED_PRODUCTS = [

    # ── AC Charger — Export (USD pricing) ─────────────────────────────────

    dict(product_code="HE518585",
         code_note="Spin Air AC Charger\n22 kW / Type 2 / Wifi + RFID + Modem",
         product_name="Spin Air 22kW (Wifi, RFID and Modem)",
         description="Power: 22 kW (3-Phase)\nConnector: Type 2 / 5m Cable\nWifi + RFID + Modem\nMoQ tiers: 1-50 @ $360 | 51-150 @ $339 | 150+ @ $318",
         unit_price=360.00, currency="USD", unit="Nos.", category="AC Charger"),

    dict(product_code="HE518585",
         code_note="Spin Air AC Charger\n22 kW / Type 2 / Black / Wifi + RFID + Modem",
         product_name="Spin Air 22kW (Wifi, RFID and Modem) - Black",
         description="Power: 22 kW (3-Phase)\nConnector: Type 2 / 5m Cable\nWifi + RFID + Modem | Black Variant\nMoQ tiers: 1-50 @ $384 | 51-150 @ $362 | 150+ @ $339",
         unit_price=384.00, currency="USD", unit="Nos.", category="AC Charger"),

    dict(product_code="HE518585",
         code_note="Spin Air AC Charger\n22 kW / Type 2 / Wifi + RFID",
         product_name="Spin Air 22kW (Wifi and RFID)",
         description="Power: 22 kW (3-Phase)\nConnector: Type 2 / 5m Cable\nWifi + RFID\nMoQ tiers: 1-50 @ $351 | 51-150 @ $331 | 150+ @ $310",
         unit_price=351.00, currency="USD", unit="Nos.", category="AC Charger"),

    dict(product_code="HE518585",
         code_note="Spin Air AC Charger\n22 kW / Type 2 / Black / Wifi + RFID",
         product_name="Spin Air 22kW (Wifi and RFID) - Black",
         description="Power: 22 kW (3-Phase)\nConnector: Type 2 / 5m Cable\nWifi + RFID | Black Variant\nMoQ tiers: 1-50 @ $375 | 51-150 @ $353 | 150+ @ $331",
         unit_price=375.00, currency="USD", unit="Nos.", category="AC Charger"),

    dict(product_code="HE518585",
         code_note="Spin Air AC Charger\n22 kW / Type 2 / Light Cyan / Wifi",
         product_name="Spin Air 22kW (Wifi)",
         description="Power: 22 kW (3-Phase)\nConnector: Type 2 / 5m Cable\nWifi only\nMoQ tiers: 1-50 @ $342 | 51-150 @ $322 | 150+ @ $302",
         unit_price=342.00, currency="USD", unit="Nos.", category="AC Charger"),

    dict(product_code="HE518585",
         code_note="Spin Air AC Charger\n22 kW / Type 2 / Black / Wifi",
         product_name="Spin Air 22kW (Wifi) - Black",
         description="Power: 22 kW (3-Phase)\nConnector: Type 2 / 5m Cable\nWifi only | Black Variant\nMoQ tiers: 1-50 @ $366 | 51-150 @ $345 | 150+ @ $323",
         unit_price=366.00, currency="USD", unit="Nos.", category="AC Charger"),

    dict(product_code="HE518581",
         code_note="Spin Air AC Charger\n7.5 kW / Type 2 / Wifi + RFID + Modem",
         product_name="Spin Air 7.5kW (Wifi, RFID and Modem)",
         description="Power: 7.5 kW (1-Phase)\nConnector: Type 2 / 5m Cable\nWifi + RFID + Modem\nMoQ tiers: 1-50 @ $276 | 51-150 @ $260 | 150+ @ $244",
         unit_price=276.00, currency="USD", unit="Nos.", category="AC Charger"),

    dict(product_code="HE518581",
         code_note="Spin Air AC Charger\n7.5 kW / Type 2 / Black / Wifi + RFID + Modem",
         product_name="Spin Air 7.5kW (Wifi, RFID and Modem) - Black",
         description="Power: 7.5 kW (1-Phase)\nConnector: Type 2 / 5m Cable\nWifi + RFID + Modem | Black Variant\nMoQ tiers: 1-50 @ $300 | 51-150 @ $283 | 150+ @ $265",
         unit_price=300.00, currency="USD", unit="Nos.", category="AC Charger"),

    dict(product_code="HE518581",
         code_note="Spin Air AC Charger\n7.5 kW / Type 2 / Wifi + RFID",
         product_name="Spin Air 7.5kW (Wifi and RFID)",
         description="Power: 7.5 kW (1-Phase)\nConnector: Type 2 / 5m Cable\nWifi + RFID\nMoQ tiers: 1-50 @ $267 | 51-150 @ $251 | 150+ @ $236",
         unit_price=267.00, currency="USD", unit="Nos.", category="AC Charger"),

    dict(product_code="HE518581",
         code_note="Spin Air AC Charger\n7.5 kW / Type 2 / Black / Wifi + RFID",
         product_name="Spin Air 7.5kW (Wifi and RFID) - Black",
         description="Power: 7.5 kW (1-Phase)\nConnector: Type 2 / 5m Cable\nWifi + RFID | Black Variant\nMoQ tiers: 1-50 @ $291 | 51-150 @ $274 | 150+ @ $257",
         unit_price=291.00, currency="USD", unit="Nos.", category="AC Charger"),

    dict(product_code="HE518581",
         code_note="Spin Air AC Charger\n7.5 kW / Type 2 / Light Cyan / Wifi",
         product_name="Spin Air 7.5kW (Wifi)",
         description="Power: 7.5 kW (1-Phase)\nConnector: Type 2 / 5m Cable\nWifi only\nMoQ tiers: 1-50 @ $258 | 51-150 @ $243 | 150+ @ $228",
         unit_price=258.00, currency="USD", unit="Nos.", category="AC Charger"),

    dict(product_code="HE518581",
         code_note="Spin Air AC Charger\n7.5 kW / Type 2 / Black / Wifi",
         product_name="Spin Air 7.5kW (Wifi) - Black",
         description="Power: 7.5 kW (1-Phase)\nConnector: Type 2 / 5m Cable\nWifi only | Black Variant\nMoQ tiers: 1-50 @ $282 | 51-150 @ $266 | 150+ @ $249",
         unit_price=282.00, currency="USD", unit="Nos.", category="AC Charger"),

    # UL-certified models (North America)
    dict(product_code="HE531505",
         code_note="Spin Air AC Charger (UL)\n7 kW / NEMA 14-50p / NACS",
         product_name="Spin Air 7kW UL (NEMA 14-50p, NACS)",
         description="Power: 7 kW (1-Phase)\nInput: NEMA 14-50p (4-Pin plug)\nOutput: NACS\nWifi + RFID + Modem + Ethernet\nMoQ tiers: 1-50 @ $360 | 51-150 @ $339 | 150+ @ $318",
         unit_price=360.00, currency="USD", unit="Nos.", category="AC Charger"),

    dict(product_code="HE531502",
         code_note="Spin Air AC Charger (UL)\n9 kW / NEMA 6-50p / Type 1",
         product_name="Spin Air 9kW UL (NEMA 6-50p, Type 1)",
         description="Power: 9 kW (1-Phase)\nInput: NEMA 6-50p (3-Pin plug)\nOutput: Type 1\nWifi + RFID + Modem + Ethernet\nMoQ tiers: 1-50 @ $414 | 51-150 @ $390 | 150+ @ $366",
         unit_price=414.00, currency="USD", unit="Nos.", category="AC Charger"),

    dict(product_code="HE531503",
         code_note="Spin Air AC Charger (UL)\n9 kW / NEMA 14-50p / Type 1",
         product_name="Spin Air 9kW UL (NEMA 14-50p, Type 1)",
         description="Power: 9 kW (1-Phase)\nInput: NEMA 14-50p (4-Pin plug)\nOutput: Type 1\nWifi + RFID + Modem + Ethernet\nMoQ tiers: 1-50 @ $414 | 51-150 @ $390 | 150+ @ $366",
         unit_price=414.00, currency="USD", unit="Nos.", category="AC Charger"),

    dict(product_code="HE531504",
         code_note="Spin Air AC Charger (UL)\n9 kW / NEMA 14-50p / NACS",
         product_name="Spin Air 9kW UL (NEMA 14-50p, NACS)",
         description="Power: 9 kW (1-Phase)\nInput: NEMA 14-50p (4-Pin plug)\nOutput: NACS\nWifi + RFID + Modem + Ethernet\nMoQ tiers: 1-50 @ $366 | 51-150 @ $345 | 150+ @ $323",
         unit_price=366.00, currency="USD", unit="Nos.", category="AC Charger"),

    dict(product_code="HE531296",
         code_note="Spin Air AC Charger (UL)\n11 kW / Hardwire / Type 1",
         product_name="Spin Air 11kW UL (Hardwire, Type 1)",
         description="Power: 11 kW (1-Phase)\nInput: Hardwire\nOutput: Type 1\nWifi + RFID + Modem + Ethernet\nMoQ tiers: 1-50 @ $456 | 51-150 @ $429 | 150+ @ $403",
         unit_price=456.00, currency="USD", unit="Nos.", category="AC Charger"),

    dict(product_code="HE531501",
         code_note="Spin Air AC Charger (UL)\n11 kW / Hardwire / NACS",
         product_name="Spin Air 11kW UL (Hardwire, NACS)",
         description="Power: 11 kW (1-Phase)\nInput: Hardwire\nOutput: NACS\nWifi + RFID + Modem + Ethernet\nMoQ tiers: 1-50 @ $384 | 51-150 @ $362 | 150+ @ $339",
         unit_price=384.00, currency="USD", unit="Nos.", category="AC Charger"),

    dict(product_code="HE531324",
         code_note="Spin Free AC Charger\n3.3 kW",
         product_name="Spin Free 3.3kW",
         description="Power: 3.3 kW (1-Phase)\nMoQ tiers: 1-50 @ $85 | 51-150 @ $80 | 150+ @ $75",
         unit_price=85.00, currency="USD", unit="Nos.", category="AC Charger"),

    # ── AC Charger — India / Domestic (INR pricing) ────────────────────────

    dict(product_code="HE531097",
         code_note="Spin Air AC Charger (India)\n22 kW / Wifi + RFID + Modem + Ethernet",
         product_name="Spin Air 22kW IN (Wifi, RFID, Modem and Ethernet)",
         description="Power: 22 kW (3-Phase)\nWifi + RFID + Modem + Ethernet\nMoQ tiers: 1-50 @ ₹27,550 | 51-150 @ ₹26,125 | 150+ @ ₹24,700",
         unit_price=27550.00, currency="INR", unit="Nos.", category="AC Charger"),

    dict(product_code="HE531125",
         code_note="Spin Air AC Charger (India)\n22 kW / Wifi + RFID + Modem",
         product_name="Spin Air 22kW IN (Wifi, RFID and Modem)",
         description="Power: 22 kW (3-Phase)\nWifi + RFID + Modem\nMoQ tiers: 1-50 @ ₹25,650 | 51-150 @ ₹24,225 | 150+ @ ₹22,800",
         unit_price=25650.00, currency="INR", unit="Nos.", category="AC Charger"),

    dict(product_code="HE531126",
         code_note="Spin Air AC Charger (India)\n22 kW / Wifi + RFID",
         product_name="Spin Air 22kW IN (Wifi and RFID)",
         description="Power: 22 kW (3-Phase)\nWifi + RFID\nMoQ tiers: 1-50 @ ₹24,700 | 51-150 @ ₹23,275 | 150+ @ ₹21,850",
         unit_price=24700.00, currency="INR", unit="Nos.", category="AC Charger"),

    dict(product_code="HE531121",
         code_note="Spin Air AC Charger (India)\n22 kW / Wifi",
         product_name="Spin Air 22kW IN (Wifi)",
         description="Power: 22 kW (3-Phase)\nWifi only\nMoQ tiers: 1-50 @ ₹23,750 | 51-150 @ ₹22,325 | 150+ @ ₹20,900",
         unit_price=23750.00, currency="INR", unit="Nos.", category="AC Charger"),

    dict(product_code="HE531098",
         code_note="Spin Air AC Charger (India)\n7.5 kW / Wifi + RFID + Modem + Ethernet",
         product_name="Spin Air 7.5kW IN (Wifi, RFID, Modem and Ethernet)",
         description="Power: 7.5 kW (1-Phase)\nWifi + RFID + Modem + Ethernet\nMoQ tiers: 1-50 @ ₹19,475 | 51-150 @ ₹18,525 | 150+ @ ₹17,575",
         unit_price=19475.00, currency="INR", unit="Nos.", category="AC Charger"),

    dict(product_code="HE531122",
         code_note="Spin Air AC Charger (India)\n7.5 kW / Wifi + RFID + Modem",
         product_name="Spin Air 7.5kW IN (Wifi, RFID and Modem)",
         description="Power: 7.5 kW (1-Phase)\nWifi + RFID + Modem\nMoQ tiers: 1-50 @ ₹17,575 | 51-150 @ ₹16,625 | 150+ @ ₹15,675",
         unit_price=17575.00, currency="INR", unit="Nos.", category="AC Charger"),

    dict(product_code="HE531123",
         code_note="Spin Air AC Charger (India)\n7.5 kW / Wifi + RFID",
         product_name="Spin Air 7.5kW IN (Wifi and RFID)",
         description="Power: 7.5 kW (1-Phase)\nWifi + RFID\nMoQ tiers: 1-50 @ ₹16,625 | 51-150 @ ₹15,675 | 150+ @ ₹14,725",
         unit_price=16625.00, currency="INR", unit="Nos.", category="AC Charger"),

    dict(product_code="HE531124",
         code_note="Spin Air AC Charger (India)\n7.5 kW / Wifi",
         product_name="Spin Air 7.5kW IN (Wifi)",
         description="Power: 7.5 kW (1-Phase)\nWifi only\nMoQ tiers: 1-50 @ ₹15,675 | 51-150 @ ₹14,725 | 150+ @ ₹13,775",
         unit_price=15675.00, currency="INR", unit="Nos.", category="AC Charger"),

    dict(product_code="HE531234",
         code_note="Spin Free AC Charger (India)\n3.3 kW",
         product_name="Spin Free 3.3kW IN",
         description="Power: 3.3 kW (1-Phase)\nMoQ tiers: 1-50 @ ₹8,075 | 51-150 @ ₹7,600 | 150+ @ ₹7,125",
         unit_price=8075.00, currency="INR", unit="Nos.", category="AC Charger"),

    # ── DC Charger — Export (USD pricing, no part code in pricebook) ───────

    dict(product_code="DCEXP-60K-200A",
         code_note="DC Fast Charger (Export)\n60 kW / 200A",
         product_name="DC 60kW 200A (Export)",
         description="Power: 60 kW DC Fast Charger\nMax Current: 200A\nMoQ tiers: 1-5 @ $12,100 | 6-10 @ $11,700 | 10+ @ $11,400",
         unit_price=12100.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="DCEXP-60K-250A",
         code_note="DC Fast Charger (Export)\n60 kW / 250A",
         product_name="DC 60kW 250A (Export)",
         description="Power: 60 kW DC Fast Charger\nMax Current: 250A\nMoQ tiers: 1-5 @ $12,500 | 6-10 @ $12,200 | 10+ @ $11,800",
         unit_price=12500.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="DCEXP-120K-200A",
         code_note="DC Fast Charger (Export)\n120 kW / 200A",
         product_name="DC 120kW 200A (Export)",
         description="Power: 120 kW DC Fast Charger\nMax Current: 200A\nMoQ tiers: 1-5 @ $17,900 | 6-10 @ $17,400 | 10+ @ $16,900",
         unit_price=17900.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="DCEXP-120K-250A",
         code_note="DC Fast Charger (Export)\n120 kW / 250A",
         product_name="DC 120kW 250A (Export)",
         description="Power: 120 kW DC Fast Charger\nMax Current: 250A\nMoQ tiers: 1-5 @ $18,400 | 6-10 @ $17,800 | 10+ @ $17,300",
         unit_price=18400.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="DCEXP-180K-250A",
         code_note="DC Fast Charger (Export)\n180 kW / 250A",
         product_name="DC 180kW 250A (Export)",
         description="Power: 180 kW DC Fast Charger\nMax Current: 250A\nMoQ tiers: 1-5 @ $23,700 | 6-10 @ $23,000 | 10+ @ $22,300",
         unit_price=23700.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="DCEXP-240K-250A",
         code_note="DC Fast Charger (Export)\n240 kW / 250A",
         product_name="DC 240kW 250A (Export)",
         description="Power: 240 kW DC Fast Charger\nMax Current: 250A\nMoQ tiers: 1-5 @ $26,000 | 6-10 @ $25,200 | 10+ @ $24,400",
         unit_price=26000.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="DCEXP-240K-375A",
         code_note="DC Fast Charger (Export)\n240 kW / 375A",
         product_name="DC 240kW 375A (Export)",
         description="Power: 240 kW DC Fast Charger\nMax Current: 375A\nMoQ tiers: 1-5 @ $28,900 | 6-10 @ $28,000 | 10+ @ $27,200",
         unit_price=28900.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="DCEXP-360K-375A",
         code_note="DC Fast Charger (Export)\n360 kW / 375A",
         product_name="DC 360kW 375A (Export)",
         description="Power: 360 kW DC Fast Charger\nMax Current: 375A\nMoQ tiers: 1-5 @ $37,800 | 6-10 @ $36,700 | 10+ @ $35,600",
         unit_price=37800.00, currency="USD", unit="Nos.", category="DC Charger"),

    # ── DC Charger — India / Domestic (INR pricing, Slim / Harmony series) ─

    dict(product_code="DCIND-30K-SGL-NDLS",
         code_note="DC Fast Charger (India)\n30 kW / Single Gun / 80A / NDLS",
         product_name="30kW Single Gun 80A NDLS",
         description="Power: 30 kW DC Fast Charger\nSingle Gun, 80A\nNon-DLS (NDLS)\nMoQ tiers: 1-2 @ ₹4,25,000 | 3-5 @ ₹3,75,000 | 5+ @ ₹3,25,000",
         unit_price=425000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-60K-SLIM-200A-NDLS",
         code_note="DC Fast Charger (India)\n60 kW Slim Gen 2.0 / 200A Phoenix Gun / NDLS",
         product_name="60kW Slim Gen 2.0 200A Phoenix Gun NDLS",
         description="Power: 60 kW Slim Gen 2.0\n200A Phoenix Gun\nNon-DLS (NDLS)\nMoQ tiers: 1-2 @ ₹6,50,000 | 3-5 @ ₹6,00,000 | 5+ @ ₹5,65,000",
         unit_price=650000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-80K-SLIM-200A-NDLS",
         code_note="DC Fast Charger (India)\n80 kW Slim Gen 2.0 / 200A Phoenix Gun / NDLS",
         product_name="80kW Slim Gen 2.0 200A Phoenix Gun NDLS",
         description="Power: 80 kW Slim Gen 2.0\n200A Phoenix Gun\nNon-DLS (NDLS)\nMoQ tiers: 1-2 @ ₹7,00,000 | 3-5 @ ₹6,50,000 | 5+ @ ₹5,90,000",
         unit_price=700000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-80K-SLIM-250A-NDLS",
         code_note="DC Fast Charger (India)\n80 kW Slim Gen 2.0 x2 Ring / 250A H&S Gun / NDLS",
         product_name="80kW Slim Gen 2.0 x2 Ring 250A H&S Gun NDLS",
         description="Power: 80 kW Slim Gen 2.0 x2 Ring\n250A H&S Gun\nNon-DLS (NDLS)\nMoQ tiers: 1-2 @ ₹15,00,000 | 3-5 @ ₹14,00,000 | 5+ @ ₹12,75,000",
         unit_price=1500000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-60U120K-200A-NDLS",
         code_note="DC Fast Charger (India)\n60 upgradable to 120 kW / 200A Gun / NDLS",
         product_name="60 upgradable to 120kW 200A Gun NDLS",
         description="Power: 60 kW (upgradable to 120 kW)\n200A Gun\nNon-DLS (NDLS)\nMoQ tiers: 1-2 @ ₹8,00,000 | 3-5 @ ₹7,75,000 | 5+ @ ₹7,50,000",
         unit_price=800000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-60U120K-250A-DLS",
         code_note="DC Fast Charger (India)\n60 upgradable to 120 kW / 250A Gun / DLS",
         product_name="60 upgradable to 120kW 250A Gun DLS",
         description="Power: 60 kW (upgradable to 120 kW)\n250A Gun\nDLS\nMoQ tiers: 1-2 @ ₹8,50,000 | 3-5 @ ₹8,25,000 | 5+ @ ₹8,00,000",
         unit_price=850000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-120K-200A-NDLS",
         code_note="DC Fast Charger (India)\n120 kW / 200A Gun / NDLS",
         product_name="120kW 200A Gun NDLS",
         description="Power: 120 kW\n200A Gun\nNon-DLS (NDLS)\nMoQ tiers: 1-2 @ ₹9,50,000 | 3-5 @ ₹9,00,000 | 5+ @ ₹8,50,000",
         unit_price=950000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-120K-250A-DLS",
         code_note="DC Fast Charger (India)\n120 kW / 250A Gun / DLS",
         product_name="120kW 250A Gun DLS",
         description="Power: 120 kW\n250A Gun\nDLS\nMoQ tiers: 1-2 @ ₹10,25,000 | 3-5 @ ₹9,75,000 | 5+ @ ₹9,25,000",
         unit_price=1025000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-120U180K-250A-NDLS",
         code_note="DC Fast Charger (India)\n120 upgradable to 180 kW / 250A Gun / NDLS",
         product_name="120 upgradable to 180kW 250A Gun NDLS",
         description="Power: 120 kW (upgradable to 180 kW)\n250A Gun\nNon-DLS (NDLS)\nMoQ tiers: 1-2 @ ₹10,25,000 | 3-5 @ ₹9,75,000 | 5+ @ ₹9,35,000",
         unit_price=1025000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-120U180K-250A-DLS",
         code_note="DC Fast Charger (India)\n120 upgradable to 180 kW / 250A Gun / DLS",
         product_name="120 upgradable to 180kW 250A Gun DLS",
         description="Power: 120 kW (upgradable to 180 kW)\n250A Gun\nDLS\nMoQ tiers: 1-2 @ ₹10,75,000 | 3-5 @ ₹10,25,000 | 5+ @ ₹9,75,000",
         unit_price=1075000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-120U180K-375A-DLS",
         code_note="DC Fast Charger (India)\n120 upgradable to 180 kW / 375A Gun / DLS",
         product_name="120 upgradable to 180kW 375A Gun DLS",
         description="Power: 120 kW (upgradable to 180 kW)\n375A Gun\nDLS\nMoQ tiers: 1-2 @ ₹11,90,000 | 3-5 @ ₹11,40,000 | 5+ @ ₹10,90,000",
         unit_price=1190000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-180K-250A-NDLS",
         code_note="DC Fast Charger (India)\n180 kW / 250A Gun / NDLS",
         product_name="180kW 250A Gun NDLS",
         description="Power: 180 kW\n250A Gun\nNon-DLS (NDLS)\nMoQ tiers: 1-2 @ ₹12,25,000 | 3-5 @ ₹11,75,000 | 5+ @ ₹11,20,000",
         unit_price=1225000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-180K-250A-DLS",
         code_note="DC Fast Charger (India)\n180 kW / 250A Gun / DLS",
         product_name="180kW 250A Gun DLS",
         description="Power: 180 kW\n250A Gun\nDLS\nMoQ tiers: 1-2 @ ₹12,75,000 | 3-5 @ ₹12,25,000 | 5+ @ ₹11,75,000",
         unit_price=1275000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-180K-375A-DLS",
         code_note="DC Fast Charger (India)\n180 kW / 375A Gun / DLS",
         product_name="180kW 375A Gun DLS",
         description="Power: 180 kW\n375A Gun\nDLS\nMoQ tiers: 1-2 @ ₹13,40,000 | 3-5 @ ₹12,90,000 | 5+ @ ₹12,40,000",
         unit_price=1340000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-240K-250A-NDLS",
         code_note="DC Fast Charger (India)\n240 kW / 250A Gun / NDLS",
         product_name="240kW 250A Gun NDLS",
         description="Power: 240 kW\n250A Gun\nNon-DLS (NDLS)\nMoQ tiers: 1-2 @ ₹13,00,000 | 3-5 @ ₹12,75,000 | 5+ @ ₹12,25,000",
         unit_price=1300000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-240K-250A-DLS",
         code_note="DC Fast Charger (India)\n240 kW / 250A Gun / DLS",
         product_name="240kW 250A Gun DLS",
         description="Power: 240 kW\n250A Gun\nDLS\nMoQ tiers: 1-2 @ ₹13,50,000 | 3-5 @ ₹13,25,000 | 5+ @ ₹12,75,000",
         unit_price=1350000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-240K-375A-DLS",
         code_note="DC Fast Charger (India)\n240 kW / 375A Gun / DLS",
         product_name="240kW 375A Gun DLS",
         description="Power: 240 kW\n375A Gun\nDLS\nMoQ tiers: 1-2 @ ₹14,50,000 | 3-5 @ ₹14,00,000 | 5+ @ ₹13,65,000",
         unit_price=1450000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-320K-300A-NDLS",
         code_note="DC Ultra Fast Charger (India)\n320 kW Gen 2.0 / 300A Gun / NDLS",
         product_name="320kW Gen 2.0 300A Gun NDLS",
         description="Power: 320 kW Gen 2.0\n300A Gun\nNon-DLS (NDLS)\nMoQ tiers: 1-2 @ ₹18,00,000 | 3-5 @ ₹17,50,000 | 5+ @ ₹17,00,000",
         unit_price=1800000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-320K-375A-NDLS",
         code_note="DC Ultra Fast Charger (India)\n320 kW Gen 2.0 / 375A Gun / NDLS",
         product_name="320kW Gen 2.0 375A Gun NDLS",
         description="Power: 320 kW Gen 2.0\n375A Gun\nNon-DLS (NDLS)\nMoQ tiers: 1-2 @ ₹18,50,000 | 3-5 @ ₹18,00,000 | 5+ @ ₹17,50,000",
         unit_price=1850000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-360K-300A-NDLS",
         code_note="DC Ultra Fast Charger (India)\n360 kW Gen 2.0 / 300A Gun / NDLS",
         product_name="360kW Gen 2.0 300A Gun NDLS",
         description="Power: 360 kW Gen 2.0\n300A Gun\nNon-DLS (NDLS)\nMoQ tiers: 1-2 @ ₹19,00,000 | 3-5 @ ₹18,50,000 | 5+ @ ₹18,00,000",
         unit_price=1900000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-360K-375A-NDLS",
         code_note="DC Ultra Fast Charger (India)\n360 kW Gen 2.0 / 375A Gun / NDLS",
         product_name="360kW Gen 2.0 375A Gun NDLS",
         description="Power: 360 kW Gen 2.0\n375A Gun\nNon-DLS (NDLS)\nMoQ tiers: 1-2 @ ₹19,50,000 | 3-5 @ ₹19,00,000 | 5+ @ ₹18,50,000",
         unit_price=1950000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-400K-300A-NDLS",
         code_note="DC Ultra Fast Charger (India)\n400 kW Gen 2.0 / 300A Gun / NDLS",
         product_name="400kW Gen 2.0 300A Gun NDLS",
         description="Power: 400 kW Gen 2.0\n300A Gun\nNon-DLS (NDLS)\nMoQ tiers: 1-2 @ ₹20,00,000 | 3-5 @ ₹19,50,000 | 5+ @ ₹19,00,000",
         unit_price=2000000.00, currency="INR", unit="Nos.", category="DC Charger"),

    dict(product_code="DCIND-400K-375A-NDLS",
         code_note="DC Ultra Fast Charger (India)\n400 kW Gen 2.0 / 375A Gun / NDLS",
         product_name="400kW Gen 2.0 375A Gun NDLS",
         description="Power: 400 kW Gen 2.0\n375A Gun\nNon-DLS (NDLS)\nMoQ tiers: 1-2 @ ₹20,50,000 | 3-5 @ ₹20,00,000 | 5+ @ ₹19,50,000",
         unit_price=2050000.00, currency="INR", unit="Nos.", category="DC Charger"),

    # ── DC Charger — International EV200xxx series (USD + MYR pricing) ─────

    dict(product_code="EV200148",
         code_note="Harmony DC Charger\n40x30kW / CCS2 125A / Infy PLC",
         product_name="40x30kW 125A CCS2 5m (Infy PLC)",
         description="Power: 40x30 kW\nConnector: 1x CCS2 125A, 5m cable\nPLC: Infy\nFlat pricing: $2,250",
         unit_price=2250.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200114",
         code_note="Harmony DC Charger\n30 kW / CCS2 125A / Gridwiz PLC",
         product_name="30kW DCFC CCS2 125A 5m (Gridwiz PLC)",
         description="Power: 30 kW\nConnector: 1x CCS2 125A, 5m cable\nPLC: Gridwiz\nFlat pricing: $2,500",
         unit_price=2500.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200158",
         code_note="Harmony DC Charger\n30 kW / CCS 100A / Infy PLC",
         product_name="30kW CCS 100A (Infy PLC) - Type A",
         description="Power: 30 kW\nConnector: 1x CCS 100A\nPLC: Infy\nFlat pricing: $2,500",
         unit_price=2500.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200159",
         code_note="Harmony DC Charger\n30 kW / CCS 100A / Infy PLC",
         product_name="30kW CCS 100A (Infy PLC) - Type B",
         description="Power: 30 kW\nConnector: 1x CCS 100A\nPLC: Infy\nFlat pricing: $2,500",
         unit_price=2500.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200163",
         code_note="Harmony DC Charger\n30 kW / CCS 125A / Infy PLC",
         product_name="30kW CCS 125A (Infy PLC)",
         description="Power: 30 kW\nConnector: 1x CCS 125A\nPLC: Infy\nFlat pricing: $2,500",
         unit_price=2500.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200143",
         code_note="Harmony DC Charger\n30 kW / CCS2 125A 7.5m / Gridwiz PLC",
         product_name="30kW DCFC CCS2 125A 7.5m (Gridwiz PLC)",
         description="Power: 30 kW\nConnector: 1x CCS2 125A, 7.5m cable\nPLC: Gridwiz\nFlat pricing: $2,656",
         unit_price=2656.25, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200147",
         code_note="Harmony DC Charger\n30 kW / CCS + GBT / Gridwiz PLC",
         product_name="HarmonyD30K CCS & GBT (Gridwiz PLC)",
         description="Power: 30 kW\nConnector: 1x CCS + 1x GBT\nPLC: Gridwiz\nModel: HarmonyD30K1K0-24-100-100-30a-G1030\nFlat pricing: $2,781",
         unit_price=2781.25, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200101",
         code_note="Harmony DC Charger\n30 kW / CCS2 125A + CHAdeMO / Gridwiz PLC",
         product_name="Harmony 30kW CCS2 125A + CH (Gridwiz PLC)",
         description="Power: 30 kW\nConnector: 1x CCS2 125A + 1x CHAdeMO\nPLC: Gridwiz\nFlat pricing: $3,156",
         unit_price=3156.25, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200108",
         code_note="Harmony DC Charger\n60 kW / CCS2 200A + CHAdeMO",
         product_name="60kW DCFC CCS2 200A + CHAdeMO",
         description="Power: 60 kW\nConnectors: 1x CCS2 200A + 1x CHAdeMO\nFlat pricing: $5,163",
         unit_price=5162.50, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200125",
         code_note="Harmony DC Charger\n60 kW / CCS2 200A 5m / 180kW Frame",
         product_name="Harmony 60kW CCS2 200A 5m (180kW Frame)",
         description="Power: 60 kW (2x CCS2 200A)\n5m cable | 180kW Frame\nFlat pricing: $5,163",
         unit_price=5162.50, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200164",
         code_note="Harmony DC Charger\n60 kW / CCS2 200A 5m / Gridwiz PLC",
         product_name="60kW 200A 2xCCS2 5m (Gridwiz PLC)",
         description="Power: 60 kW\nConnectors: 2x CCS2 200A, 5m cable\nPLC: Gridwiz\nFlat pricing: $5,225",
         unit_price=5225.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200153",
         code_note="Harmony DC Charger\n60 kW / CCS2 200A 5m / AC Contactor",
         product_name="60kW 200A 2xCCS2 5m with AC Contactor",
         description="Power: 60 kW\nConnectors: 2x CCS2 200A, 5m cable\nWith AC contactor\nFlat pricing: $5,238",
         unit_price=5237.50, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200140",
         code_note="Harmony DC Charger\n60 kW / CCS2 200A 8m / 180kW Frame",
         product_name="Harmony 60kW CCS2 200A 8m (180kW Frame)",
         description="Power: 60 kW (2x CCS2 200A)\n8m cable | 180kW Frame\nFlat pricing: $5,538",
         unit_price=5537.50, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200100",
         code_note="Harmony DC Charger\n82 kW / CCS2 200A + CHAdeMO + 22kW Type 2",
         product_name="82kW DCFC CCS2 200A + CHAdeMO + 22kW AC",
         description="Power: 82 kW\nConnectors: 1x CCS2 200A + 1x CHAdeMO + 1x 22kW Type 2\nFlat pricing: $5,225",
         unit_price=5225.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200146",
         code_note="Harmony DC Charger\n120 kW / CCS + GBT 180kW",
         product_name="HarmonyD120K CCS & GBT (180kW)",
         description="Power: 120 kW\nConnectors: 1x CCS + 1x GBT\nModel: HarmonyD120K1K0-24-300-125-30a-G10180\nFlat pricing: $5,663",
         unit_price=5662.50, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200104",
         code_note="Harmony DC Charger\n120 kW / CCS2 250A 5m",
         product_name="120kW DCFC 2xCCS2 250A 5m",
         description="Power: 120 kW\nConnectors: 2x CCS2 250A, 5m cable\nFlat pricing: $6,038",
         unit_price=6037.50, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200156",
         code_note="Harmony DC Charger\n120 kW / CCS2 300A + GBT 250A / Infy PLC",
         product_name="120kW CCS2 300A + GBT 250A 5m (Infy PLC) - Type A",
         description="Power: 120 kW\nCCS2 300A 5m + GBT 250A 5m\nPLC: Infy\nFlat pricing: $6,288",
         unit_price=6287.50, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200157",
         code_note="Harmony DC Charger\n120 kW / CCS2 300A + GBT 250A / Infy PLC",
         product_name="120kW CCS2 300A + GBT 250A 5m (Infy PLC) - Type B",
         description="Power: 120 kW\nCCS2 300A 5m + GBT 250A 5m\nPLC: Infy\nFlat pricing: $6,288",
         unit_price=6287.50, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200128",
         code_note="Harmony DC Charger\n120 kW / CCS2 300A 5m / 180kW Frame",
         product_name="Harmony 120kW DCFC CCS2 300A 5m (180kW Frame)",
         description="Power: 120 kW (2x CCS2 300A)\n5m cable | 180kW Frame\nFlat pricing: $6,663",
         unit_price=6662.50, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200162",
         code_note="Harmony DC Charger\n120 kW / CCS2 300A 5m / Gridwiz PLC",
         product_name="120kW 300A 2xCCS2 5m (Gridwiz PLC)",
         description="Power: 120 kW\nConnectors: 2x CCS2 300A, 5m cable\nPLC: Gridwiz\nFlat pricing: $6,663",
         unit_price=6662.50, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200154",
         code_note="Harmony DC Charger\n120 kW / CCS2 300A 5m / AC Contactor",
         product_name="120kW 300A 2xCCS2 5m with AC Contactor",
         description="Power: 120 kW\nConnectors: 2x CCS2 300A, 5m cable\nWith AC contactor\nFlat pricing: $6,756",
         unit_price=6756.25, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200166",
         code_note="Harmony DC Charger\n120 kW / CCS2 300A 5m / Gridwiz + AC Contactor",
         product_name="120kW 300A 2xCCS2 5m Gridwiz + AC Contactor",
         description="Power: 120 kW\nConnectors: 2x CCS2 300A, 5m cable\nPLC: Gridwiz + AC contactor\nFlat pricing: $6,756",
         unit_price=6756.25, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200139",
         code_note="Harmony DC Charger\n120 kW / CCS2 300A 8.5m / 180kW Frame",
         product_name="Harmony 120kW DCFC CCS2 300A 8.5m (180kW Frame)",
         description="Power: 120 kW (2x CCS2 300A)\n8.5m cable | 180kW Frame\nFlat pricing: $8,100",
         unit_price=8100.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200141",
         code_note="Harmony DC Charger\n120 kW / CCS2 300A 10m / 180kW Frame",
         product_name="Harmony 120kW DCFC CCS2 300A 10m (180kW Frame)",
         description="Power: 120 kW (2x CCS2 300A)\n10m cable | 180kW Frame\nFlat pricing: $9,538",
         unit_price=9537.50, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200111",
         code_note="Harmony DC Charger\n142 kW / CCS2 250A + CHAdeMO + 22kW Type 2",
         product_name="142kW DCFC CCS2 250A + CHAdeMO + 22kW AC",
         description="Power: 142 kW\nConnectors: 1x CCS2 250A + 1x CHAdeMO + 1x 22kW Type 2\nFlat pricing: $6,725",
         unit_price=6725.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200149",
         code_note="Harmony DC Charger\n160 kW / CCS2 200A 5m / Infy PLC 40kW",
         product_name="160kW 200A 2xCCS2 5m (Infy PLC 40kW Module)",
         description="Power: 160 kW (40kW Module)\nConnectors: 2x CCS2 200A, 5m cable\nPLC: Infy\nFlat pricing: $7,813",
         unit_price=7812.50, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200150",
         code_note="Harmony DC Charger\n160 kW / CCS2 300A 5m / Infy PLC 40kW",
         product_name="160kW 300A 2xCCS2 5m (Infy PLC 40kW Module)",
         description="Power: 160 kW (40kW Module)\nConnectors: 2x CCS2 300A, 5m cable\nPLC: Infy\nFlat pricing: $7,813",
         unit_price=7812.50, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200142",
         code_note="Harmony DC Charger\n160 kW / 300A / 40kW Module",
         product_name="HarmonyD160K 300A 40kW Module",
         description="Power: 160 kW\nModel: HarmonyD160K1K0-22-300-300-40a\n40kW Module\nFlat pricing: $8,563",
         unit_price=8562.50, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200107",
         code_note="Harmony DC Charger\n180 kW / CCS2 250A",
         product_name="180kW DCFC 2xCCS2 250A",
         description="Power: 180 kW\nConnectors: 2x CCS2 250A\nFlat pricing: $8,141",
         unit_price=8140.625, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200124",
         code_note="Harmony DC Charger\n180 kW / CCS2 300A",
         product_name="180kW DCFC 2xCCS2 300A",
         description="Power: 180 kW\nConnectors: 2x CCS2 300A\nFlat pricing: $8,141",
         unit_price=8140.625, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200135",
         code_note="Harmony DC Charger\n180 kW / GB/T 250A",
         product_name="180kW 250A 2xGB/T",
         description="Power: 180 kW\nConnectors: 2x GB/T 250A\nFlat pricing: $8,141",
         unit_price=8140.625, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200144",
         code_note="Harmony DC Charger\n180 kW / GBT 250A + CCS 250A",
         product_name="Harmony 180kW GBT 250A 6m + CCS 250A 5m",
         description="Power: 180 kW\n1x GBT 250A 6m + 1x CCS 250A 5m\nFlat pricing: $8,141",
         unit_price=8140.625, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200152",
         code_note="Harmony DC Charger\n180 kW / CCS2 300A 8.5m",
         product_name="180kW 300A 2xCCS2 8.5m",
         description="Power: 180 kW\nConnectors: 2x CCS2 300A, 8.5m cable\nFlat pricing: $9,578",
         unit_price=9578.125, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200155",
         code_note="Harmony DC Charger\n200 kW / CCS2 200A 5m / Infy PLC",
         product_name="200kW 200A 2xCCS2 5m (Infy PLC)",
         description="Power: 200 kW\nConnectors: 2x CCS2 200A, 5m cable\nPLC: Infy\nFlat pricing: $8,785",
         unit_price=8785.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200165",
         code_note="Harmony DC Charger\n200 kW / CCS 200A 5m / Infy PLC",
         product_name="200kW 2xCCS 200A 5m (Infy PLC)",
         description="Power: 200 kW\nConnectors: 2x CCS 200A, 5m cable\nPLC: Infy\nFlat pricing: $8,785",
         unit_price=8785.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200160",
         code_note="Harmony DC Charger\n240 kW / CCS 200A / Infy PLC 40kW",
         product_name="240kW 40kW Module 2xCCS 200A (Infy PLC)",
         description="Power: 240 kW (40kW Module)\nConnectors: 2x CCS 200A\nPLC: Infy\nFlat pricing: $7,785",
         unit_price=7785.00, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200161",
         code_note="Harmony DC Charger\n320 kW / CCS 300A / Infy PLC 40kW",
         product_name="320kW 40kW Module 2xCCS 300A (Infy PLC)",
         description="Power: 320 kW (40kW Module)\nConnectors: 2x CCS 300A\nPLC: Infy\nFlat pricing: $10,656",
         unit_price=10656.25, currency="USD", unit="Nos.", category="DC Charger"),

    dict(product_code="EV200151",
         code_note="Harmony DC Charger\n360 kW / CCS2 300A 5m / 40kW Module",
         product_name="360kW 300A 2xCCS2 5m (40kW Module)",
         description="Power: 360 kW (40kW Module)\nConnectors: 2x CCS2 300A, 5m cable\nFlat pricing: $11,156",
         unit_price=11156.25, currency="USD", unit="Nos.", category="DC Charger"),

    # ── Accessories & Spare Parts ──────────────────────────────────────────

    dict(product_code="HE531364",
         code_note="Harmony DC Spare\nDLS 250A Power Module",
         product_name="HarmonyD120K DLS250 Power Module",
         description="Model: HarmonyD120K1K0-22-G2.0-DLS250-P\nSpare / accessory module\nPrice: $2,000",
         unit_price=2000.00, currency="USD", unit="Nos.", category="Accessories"),

    dict(product_code="HE531366",
         code_note="Harmony DC Spare\nDLS 375A Power Module (180kW)",
         product_name="HarmonyD180K DLS375 Power Module",
         description="Model: HarmonyD180K1K0-22-G2.0-DLS375-P\nSpare / accessory module\nPrice: $2,500",
         unit_price=2500.00, currency="USD", unit="Nos.", category="Accessories"),

    dict(product_code="HE531368",
         code_note="Harmony DC Spare\nDLS 375A Power Module (240kW)",
         product_name="HarmonyD240K DLS375 Power Module",
         description="Model: HarmonyD240K1K0-22-G2.0-DLS375-P\nSpare / accessory module\nPrice: $3,500",
         unit_price=3500.00, currency="USD", unit="Nos.", category="Accessories"),

    dict(product_code="HE531365",
         code_note="Harmony DC Spare\nDLS 250A Power Module (180kW)",
         product_name="HarmonyD180K DLS250 Power Module",
         description="Model: HarmonyD180K1K0-22-G2.0-DLS250-P\nSpare / accessory module\nPrice: $3,000",
         unit_price=3000.00, currency="USD", unit="Nos.", category="Accessories"),

    dict(product_code="HE531367",
         code_note="Harmony DC Spare\nDLS 250A Power Module (240kW)",
         product_name="HarmonyD240K DLS250 Power Module",
         description="Model: HarmonyD240K1K0-22-G2.0-DLS250-P\nSpare / accessory module\nPrice: $3,500",
         unit_price=3500.00, currency="USD", unit="Nos.", category="Accessories"),

    dict(product_code="HE521683",
         code_note="Load Balancing Kit\nSingle Phase / Single Charger",
         product_name="Load Balancing Kit (Single Phase)",
         description="Load Balancing Kit for Single Charger\nSingle Phase\nPrice: $210",
         unit_price=210.00, currency="USD", unit="Nos.", category="Accessories"),

    dict(product_code="HE521684",
         code_note="Load Balancing Kit\nThree Phase / Single Charger",
         product_name="Load Balancing Kit (Three Phase)",
         description="Load Balancing Kit for Single Charger\nThree Phase\nPrice: $165",
         unit_price=165.00, currency="USD", unit="Nos.", category="Accessories"),
]


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        inserted = 0
        for p in SEED_PRODUCTS:
            exists = (
                db.query(models.CatalogProduct)
                .filter_by(product_code=p["product_code"], product_name=p["product_name"])
                .first()
            )
            if not exists:
                db.add(models.CatalogProduct(**p))
                inserted += 1
        db.commit()
        if inserted:
            print(f"Seeded {inserted} new catalog products.")
        else:
            print("Catalog already up to date; no new products inserted.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
