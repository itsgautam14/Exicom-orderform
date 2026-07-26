"""FastAPI application entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import hash_password
from app.config import settings
from app.database import Base, SessionLocal, engine
from app import migrate, models
from app.routers import auth, catalog, logistics, orders, tracking, users

# Create missing tables, then apply idempotent column migrations to existing ones.
# Wrapped so a transient DB blip (e.g. Neon DNS hiccup) never blocks startup — the
# schema is idempotent and already exists once it has run successfully once.
try:
    Base.metadata.create_all(bind=engine)
    migrate.run()
except Exception as exc:
    print(f"Schema setup skipped (will retry next request): {exc}")


def _seed_default_admin() -> None:
    """Create one admin account on first boot so there's a way to log in and
    create everyone else, if the `users` table is still empty."""
    db = SessionLocal()
    try:
        if db.query(models.User).first() is not None:
            return
        if not settings.default_admin_password:
            print(
                "No users exist yet and DEFAULT_ADMIN_PASSWORD is not set — "
                "set DEFAULT_ADMIN_* env vars and restart to seed the first admin account."
            )
            return
        admin = models.User(
            username=settings.default_admin_username,
            email=settings.default_admin_email,
            full_name=settings.default_admin_full_name,
            password_hash=hash_password(settings.default_admin_password),
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"Seeded default admin user '{admin.username}' — log in and create other accounts from the Users tab.")
    except Exception as exc:
        print(f"Default admin seeding skipped (will retry next request): {exc}")
    finally:
        db.close()


_seed_default_admin()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(orders.router)
app.include_router(catalog.router)
app.include_router(logistics.router)
app.include_router(tracking.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name}
