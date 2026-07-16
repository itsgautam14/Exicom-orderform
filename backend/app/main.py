"""FastAPI application entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app import migrate
from app.routers import orders, catalog, logistics, tracking

# Create missing tables, then apply idempotent column migrations to existing ones.
# Wrapped so a transient DB blip (e.g. Neon DNS hiccup) never blocks startup — the
# schema is idempotent and already exists once it has run successfully once.
try:
    Base.metadata.create_all(bind=engine)
    migrate.run()
except Exception as exc:
    print(f"Schema setup skipped (will retry next request): {exc}")

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(orders.router)
app.include_router(catalog.router)
app.include_router(logistics.router)
app.include_router(tracking.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name}
