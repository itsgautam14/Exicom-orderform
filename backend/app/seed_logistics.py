"""Seed the logistics_rates table with the current per-country transport rates.

Called from app.seed (idempotent). Seeded rates are marked 'approved' so the
order form can use them immediately. New countries added later via the admin
panel start as 'pending' until an admin approves them.
"""
from app.database import SessionLocal, Base, engine
from app import models

# Rates in INR (incl. local + 15% markup), from the Exicom transport sheet.
#   sea_rate      = per pallet
#   air_up_to_500 = per box (1 box = 10kg), shipment ≤ 500kg
#   air_above_500 = per box, shipment > 500kg
# Country names match the frontend WORLD_COUNTRIES list so the dropdown auto-fills.
LOGISTICS_SEED = [
    dict(country="Tunisia",              sea_rate=37554.4,  air_up_to_500=7072.5, air_above_500=6842.5),
    dict(country="United Arab Emirates", sea_rate=29322.7,  air_up_to_500=5692.5, air_above_500=5175),
    dict(country="Qatar",                sea_rate=None,     air_up_to_500=6612.5, air_above_500=6325),
    dict(country="Saudi Arabia",         sea_rate=None,     air_up_to_500=None,   air_above_500=None),
    dict(country="Netherlands",          sea_rate=24384.6,  air_up_to_500=None,   air_above_500=None),
    dict(country="Malaysia",             sea_rate=23286.35, air_up_to_500=1782.5, air_above_500=1552.5),
    dict(country="Morocco",              sea_rate=26578.8,  air_up_to_500=None,   air_above_500=None),
]


def run(reset: bool = False) -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if reset:
            deleted = db.query(models.LogisticsRate).delete()
            db.commit()
            print(f"Logistics reset: removed {deleted} existing rates.")
        inserted = updated = 0
        for r in LOGISTICS_SEED:
            obj = db.query(models.LogisticsRate).filter_by(country=r["country"]).first()
            if obj:
                for k, v in r.items():
                    setattr(obj, k, v)
                obj.status = "approved"
                updated += 1
            else:
                db.add(models.LogisticsRate(**r, status="approved"))
                inserted += 1
        db.commit()
        print(f"Logistics seed complete: {inserted} inserted, {updated} updated.")
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    run(reset="--reset" in sys.argv)
