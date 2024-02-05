# Meridian Logistics — services monorepo

Everything that runs behind `api.meridian-logistics.example`.

Each service lives under `services/` and owns its own database. Nothing is
shared at runtime; the only thing the services agree on is the fixture data in
`shared/seed-data`.

Internal services authenticate with an HS256 bearer token signed with
`MERIDIAN_JWT_SECRET`. See `shared/auth/`.
