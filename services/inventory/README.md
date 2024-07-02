# inventory

Python 3.12 + FastAPI + SQLModel over SQLite. Source of truth for stock levels.

```
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Reads `DATABASE_URL`, `MERIDIAN_JWT_SECRET` and `SEED_DATA_DIR`. Tables are
created with `SQLModel.metadata.create_all` on startup and seeded from
`skus.json` if the items table is empty.

FastAPI serves the live schema at `/openapi.json` and Swagger UI at `/docs`.
There is also an `openapi.json` checked in at the service root that was exported
for the API review.

Fields are snake_case.
