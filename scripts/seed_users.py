"""Create demo Firebase Auth users with role claims. Passwords are generated and written to .env.demo
(git-ignored), never printed.

Usage: python scripts/seed_users.py
"""
from __future__ import annotations

import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "agents"))

import firebase_admin  # noqa: E402
from firebase_admin import auth  # noqa: E402

from f2f.config import settings  # noqa: E402

USERS = [
    ("demo@field-to-fix.test", "Demo (all roles)", {"role": "demo"}),
    ("analyst@field-to-fix.test", "Warranty Analyst", {"role": "analyst"}),
    ("sqe@field-to-fix.test", "Supplier Quality Eng.", {"role": "sqe"}),
    ("dealer@field-to-fix.test", "Pune Service Tech", {"role": "dealer"}),
    ("supplier@field-to-fix.test", "Kaveri Hoses Quality", {"role": "supplier", "org_id": "S-KAV"}),
    ("exec@field-to-fix.test", "Head of Quality", {"role": "exec"}),
]


def main() -> None:
    firebase_admin.initialize_app(options={"projectId": settings.project})
    lines = []
    for email, name, claims in USERS:
        pw = secrets.token_urlsafe(12)
        try:
            u = auth.get_user_by_email(email)
            auth.update_user(u.uid, password=pw, display_name=name)
        except auth.UserNotFoundError:
            u = auth.create_user(email=email, password=pw, display_name=name)
        auth.set_custom_user_claims(u.uid, claims)
        lines.append(f"{email}={pw}")
        print(f"ready: {email}  role={claims['role']}")
    (ROOT / ".env.demo").write_text("\n".join(lines) + "\n")
    print("passwords written to .env.demo")


if __name__ == "__main__":
    main()
