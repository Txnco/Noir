import bcrypt
import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def debug_bcrypt():
    password = "Password123!"
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT email, hashed_password FROM users WHERE email = 'tester_native@example.com'"))
        row = res.fetchone()
        if not row:
            print("User not found")
            return
        
        email, stored_hash = row
        print(f"Email: {email}")
        print(f"Stored Hash: {stored_hash}")
        
        # Try verify
        is_valid = bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8'))
        print(f"Native bcrypt check: {is_valid}")
        
        # Test new hash
        new_salt = bcrypt.gensalt()
        new_hash = bcrypt.hashpw(password.encode('utf-8'), new_salt).decode('utf-8')
        print(f"New Hash: {new_hash}")
        is_new_valid = bcrypt.checkpw(password.encode('utf-8'), new_hash.encode('utf-8'))
        print(f"New Hash valid: {is_new_valid}")

if __name__ == "__main__":
    asyncio.run(debug_bcrypt())
