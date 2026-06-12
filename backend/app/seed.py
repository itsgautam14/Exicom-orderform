"""Seed the catalog with the products from the reference PDF.

Run once after the DB is created:  python -m app.seed
"""
from app.database import SessionLocal, Base, engine
from app import models

SEED_PRODUCTS = [
    dict(product_code="HE518585",
         code_note="Spin Air AC Charger\n22 kW / Type 2 / Light Cyan",
         product_name="Spin Air 22kW AC Charger",
         description="Power: 22 kW (3-Phase)\nConnector: Type 2 / 5m Cable\nWifi only",
         unit_price=342.00, currency="USD", unit="Nos.", category="AC Charger"),
    dict(product_code="HE518581",
         code_note="Spin Air AC Charger\n7.5 kW / Type 2 / Light Cyan",
         product_name="Spin Air 7kW AC Charger",
         description="Power: 7.5 kW (1-Phase)\nConnector: Type 2 / 5m Cable\nWifi only",
         unit_price=258.00, currency="USD", unit="Nos.", category="AC Charger"),
    dict(product_code="HE60KW",
         code_note="DC Fast Charger\n60KW Harmony Gen2.0",
         product_name="60KW Harmony Gen2.0 200Amp",
         description="Power: 60 kW DC Fast Charger\nConnector: CCS2 + CHAdeMO\nMax current: 200A",
         unit_price=600000.00, currency="INR", unit="Nos.", category="DC Charger"),
    dict(product_code="HE120KW",
         code_note="DC Fast Charger\n120KW Harmony Gen 2.0",
         product_name="120KW Harmony Gen 2.0 200Amp",
         description="Power: 120 kW DC Fast Charger\nConnector: CCS2 + CHAdeMO\nMax current: 200A",
         unit_price=900000.00, currency="INR", unit="Nos.", category="DC Charger"),
    dict(product_code="HE480KW",
         code_note="DC Ultra-Fast Charger\n480KW Harmony Distributed",
         product_name="480KW Harmony Distributed",
         description="1 Power Cube + 6 Dispensers\n480 kW total output\nCCS2 + CHAdeMO",
         unit_price=5470000.00, currency="INR", unit="Set", category="DC Charger"),
]


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(models.CatalogProduct).count() == 0:
            db.add_all(models.CatalogProduct(**p) for p in SEED_PRODUCTS)
            db.commit()
            print(f"Seeded {len(SEED_PRODUCTS)} catalog products.")
        else:
            print("Catalog already populated; skipping.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
