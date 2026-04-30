import os
from sqlalchemy import create_engine, inspect
from dotenv import load_dotenv
from sqlalchemy.engine import make_url

load_dotenv()

url_str = os.getenv('DATABASE_URL')
if not url_str:
    print("DATABASE_URL not found in .env")
    exit(1)

url = make_url(url_str)
sync_url = url.set(drivername='postgresql')
sync_engine = create_engine(sync_url)
inspector = inspect(sync_engine)

print(f"Inspecting 'user_roles' table:")
try:
    columns = inspector.get_columns('user_roles')
    print("Columns:")
    for col in columns:
        print(f"  - {col['name']}: {col['type']}")

    fks = inspector.get_foreign_keys('user_roles')
    print("Foreign Keys:")
    for fk in fks:
        print(f"  - {fk}")
except Exception as e:
    print(f"Error: {e}")

print(f"\nChecking for 'profiles' table:")
try:
    columns = inspector.get_columns('profiles')
    print("Columns:")
    for col in columns:
        print(f"  - {col['name']}: {col['type']}")
except Exception as e:
    print(f"Error: {e}")
