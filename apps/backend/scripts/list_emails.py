import os
from sqlalchemy import create_engine, select, Table, MetaData
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from sqlalchemy.engine import make_url

load_dotenv()

url_str = os.getenv('DATABASE_URL')
url = make_url(url_str)
sync_url = url.set(drivername='postgresql')
sync_engine = create_engine(sync_url)
metadata = MetaData()

print("Listing all emails in 'profiles' table:")
try:
    profiles = Table('profiles', metadata, autoload_with=sync_engine)
    with Session(sync_engine) as session:
        result = session.execute(select(profiles.c.email)).scalars().all()
        for email in result:
            print(f"  - {email}")
        if not result:
            print("  (Table is empty)")
except Exception as e:
    print(f"Error: {e}")
