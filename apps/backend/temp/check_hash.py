import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def check_hash():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT email, hashed_password FROM users WHERE email = 'tester_uuid@example.com'"))
        row = res.fetchone()
        if row:
            email, hashed = row
            print(f"Email: {email}")
            print(f"Hash:  {hashed}")
            print(f"Len:   {len(hashed)}")
        else:
            print("User not found")

if __name__ == "__main__":
    asyncio.run(check_hash())
