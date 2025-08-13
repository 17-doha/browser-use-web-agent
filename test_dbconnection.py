# test_db_connection.py
import psycopg2
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

# Test direct psycopg2 connection
def test_direct_connection():
    try:
        conn = psycopg2.connect(
            host="aws-0-eu-north-1.pooler.supabase.com",
            port=6543,
            database="postgres",
            user="postgres.rpwwyugngnvdegzfltvo",
            password="h5APXXtrN!Y%eP2",
            sslmode="disable",
            connect_timeout=10
        )
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        result = cursor.fetchone()
        print(f"Direct connection successful: {result[0]}")
        conn.close()
        return True
    except Exception as e:
        print(f"Direct connection failed: {e}")
        return False

# Test SQLAlchemy connection with NullPool
def test_sqlalchemy_connection():
    try:
        DATABASE_URL = "postgresql://postgres.rpwwyugngnvdegzfltvo:h5APXXtrN!Y%eP2@aws-0-eu-north-1.pooler.supabase.com:6543/postgres"
        
        engine = create_engine(
            DATABASE_URL,
            poolclass=NullPool,
            connect_args={
                'sslmode': 'disable',
                'connect_timeout': 10,
            },
        )
        
        with engine.connect() as conn:
            result = conn.execute("SELECT version()")
            row = result.fetchone()
            print(f"SQLAlchemy connection successful: {row[0]}")
        
        return True
    except Exception as e:
        print(f"SQLAlchemy connection failed: {e}")
        return False

if __name__ == "__main__":
    print("Testing database connections...")
    test_direct_connection()
    test_sqlalchemy_connection()