"""Firebase ID-token auth with role claims. Roles: dealer, analyst, sqe, supplier, exec, system."""
from __future__ import annotations

import re
from dataclasses import dataclass

import firebase_admin
from fastapi import Depends, Header, HTTPException
from firebase_admin import auth as fb_auth
from google.auth.transport import requests as g_requests
from google.oauth2 import id_token

from .config import settings

if not firebase_admin._apps:
    firebase_admin.initialize_app(options={"projectId": settings.project})


@dataclass
class User:
    uid: str
    role: str
    org_id: str | None = None
    is_demo: bool = False


ACTABLE = {"dealer", "analyst", "sqe", "supplier", "exec"}
DEMO_SUPPLIER_ORG = "S-KAV"


def current_user(authorization: str | None = Header(default=None),
                 x_dev_role: str | None = Header(default=None),
                 x_dev_uid: str | None = Header(default=None),
                 x_act_as: str | None = Header(default=None),
                 x_act_org: str | None = Header(default=None)) -> User:
    if settings.dev_auth and x_dev_role:
        return User(uid=x_dev_uid or f"dev-{x_dev_role}", role=x_dev_role, org_id="S-KAV" if x_dev_role == "supplier" else None)
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Sign in required")
    token = authorization.split(" ", 1)[1]
    try:
        claims = fb_auth.verify_id_token(token)
        role = claims.get("role", "analyst")
        if role == "demo":  # judges' demo account: one login, can act as any role from the UI switcher
            role = x_act_as if x_act_as in ACTABLE else "analyst"
            # The judge can act for any supplier, so an 8D sent to any Tier-1 reaches its inbox.
            org = x_act_org if x_act_org and re.fullmatch(r"S-[A-Z]{2,8}", x_act_org) else DEMO_SUPPLIER_ORG
            return User(uid=claims["uid"], role=role, org_id=org if role == "supplier" else None, is_demo=True)
        return User(uid=claims["uid"], role=role, org_id=claims.get("org_id"))
    except Exception:
        pass
    # Pub/Sub push and Cloud Scheduler send Google-signed OIDC tokens from the service account.
    try:
        info = id_token.verify_oauth2_token(token, g_requests.Request())
        if info.get("email", "").endswith(".iam.gserviceaccount.com"):
            return User(uid=info["email"], role="system")
    except Exception:
        pass
    raise HTTPException(401, "Invalid or expired token")


def require(*roles: str):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles and user.role != "system":
            raise HTTPException(403, f"This action needs one of: {', '.join(roles)}")
        return user
    return dep
