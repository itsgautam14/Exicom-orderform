"""FastAPI application entrypoint."""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.auth import hash_password
from app.config import settings
from app.database import Base, SessionLocal, engine
from app import migrate, models
from app.routers import auth, catalog, logistics, orders, tracking, users

_schema_ready = False


def _setup_schema() -> None:
    """Create missing tables, apply idempotent column migrations, and seed the
    default admin. Everything here is safe to call more than once — so on a
    transient DB blip (e.g. a cold-start connection hiccup) we actually retry
    on the next request instead of leaving the app stuck in a half-migrated
    state for the rest of the process's life.
    """
    global _schema_ready
    if _schema_ready:
        return
    try:
        Base.metadata.create_all(bind=engine)
        migrate.run()
        _seed_default_admin()
        _schema_ready = True
    except Exception as exc:
        print(f"Schema setup failed, will retry on next request: {exc}")


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


_setup_schema()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def retry_schema_setup(request: Request, call_next):
    # Cheap no-op once _schema_ready is True; only does real work if the very
    # first attempt (above) failed, e.g. a cold-start DB connection blip.
    _setup_schema()
    return await call_next(request)


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(orders.router)
app.include_router(catalog.router)
app.include_router(logistics.router)
app.include_router(tracking.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name}
