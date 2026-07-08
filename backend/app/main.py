"""FastAPI application entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app import migrate
from app.routers import orders, catalog, logistics

# Create missing tables, then apply idempotent column migrations to existing ones.
Base.metadata.create_all(bind=engine)
try:
    migrate.run()
except Exception as exc:  # never block startup on a migration hiccup (e.g. transient DB blip)
    print(f"Schema migration skipped: {exc}")

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


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name}
