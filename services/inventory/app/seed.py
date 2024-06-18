import json
import os
import pathlib

from sqlmodel import Session, select

from .models import Item

SEED_DIR = pathlib.Path(os.environ.get("SEED_DATA_DIR", "/seed"))


def seed(engine) -> None:
    with Session(engine) as session:
        if session.exec(select(Item)).first() is not None:
            return

        rows = json.loads((SEED_DIR / "skus.json").read_text())
        for row in rows:
            session.add(Item(**row))
        session.commit()

        print(f"seeded {len(rows)} items")
