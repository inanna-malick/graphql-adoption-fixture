from sqlmodel import Field, SQLModel


class Item(SQLModel, table=True):
    sku: str = Field(primary_key=True)
    name: str
    qty_on_hand: int
    unit_price_cents: int
    warehouse: str
    reserved: int = 0


class ReserveRequest(SQLModel):
    quantity: int
