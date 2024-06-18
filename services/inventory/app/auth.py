import os

import jwt
from fastapi import HTTPException, Request

SECRET = os.environ["MERIDIAN_JWT_SECRET"]


def require_auth(request: Request) -> None:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")

    if scheme != "Bearer" or not token:
        raise HTTPException(status_code=401, detail="missing or invalid bearer token")

    try:
        jwt.decode(token, SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="missing or invalid bearer token")
