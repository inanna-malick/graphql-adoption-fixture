import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from sqlmodel import Session, SQLModel, create_engine, select

from .auth import require_auth
from .models import Item, ReserveRequest
from .seed import seed

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:////app/data/inventory.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)
    seed(engine)
    yield


app = FastAPI(
    title="Meridian Inventory",
    description="Stock levels and reservations for the Meridian warehouses.",
    version="0.7.0",
    lifespan=lifespan,
)


def get_session():
    with Session(engine) as session:
        yield session


@app.get("/health")
def health():
    return {"status": "ok", "service": "inventory"}


@app.get("/items", response_model=list[Item], dependencies=[Depends(require_auth)])
def list_items(session: Session = Depends(get_session)):
    return session.exec(select(Item).order_by(Item.sku)).all()


@app.get("/items/{sku}", response_model=Item, dependencies=[Depends(require_auth)])
def get_item(sku: str, session: Session = Depends(get_session)):
    item = session.get(Item, sku)
    if item is None:
        raise HTTPException(status_code=404, detail=f"no item with sku {sku}")
    return item


@app.post("/items/{sku}/reserve", response_model=Item, dependencies=[Depends(require_auth)])
def reserve_item(
    sku: str,
    body: ReserveRequest,
    session: Session = Depends(get_session),
):
    item = session.get(Item, sku)
    if item is None:
        raise HTTPException(status_code=404, detail=f"no item with sku {sku}")

    if body.quantity > item.quantity_available:
        raise HTTPException(
            status_code=409,
            detail=f"only {item.quantity_available} of {sku} on hand",
        )

    item.quantity_available -= body.quantity
    item.reserved += body.quantity
    session.add(item)
    session.commit()
    session.refresh(item)
    return item
