import os
from sqlalchemy import create_engine, text
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

query = text("""
SELECT 
    trg.tgname AS trigger_name,
    p.proname AS function_name,
    prosrc AS function_body
FROM pg_trigger trg
JOIN pg_class cls ON trg.tgrelid = cls.oid
JOIN pg_proc p ON trg.tgfoid = p.oid
WHERE cls.relname = 'event_tiers';
""")

with sync_engine.connect() as conn:
    print("Checking triggers on 'event_tiers'...")
    result = conn.execute(query)
    found = False
    for row in result:
        found = True
        print(f"\nTrigger: {row[0]}")
        print(f"Function: {row[1]}")
        print("Body:")
        print(row[2])
    
    if not found:
        print("No triggers found on 'event_tiers'.")

    print("\nChecking columns on 'event_tiers'...")
    from sqlalchemy import inspect
    inspector = inspect(sync_engine)
    columns = inspector.get_columns('event_tiers')
    for col in columns:
        print(f"  - {col['name']}: {col['type']}")
