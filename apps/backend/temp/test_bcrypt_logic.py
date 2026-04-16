import bcrypt
import asyncio
from app.core.security.jwt.security import hash_password, verify_password

def standalone_test():
    password = "Password123!"
    hashed = hash_password(password)
    print(f"Hashed: {hashed}")
    
    is_valid = verify_password(password, hashed)
    print(f"Verified: {is_valid}")
    
    # Try with raw bcrypt just to be sure
    is_raw_valid = bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    print(f"Raw bcrypt verified: {is_raw_valid}")

if __name__ == "__main__":
    standalone_test()
