from __future__ import annotations

import os

import psycopg2
from dotenv import load_dotenv


def main() -> None:
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")
    if not database_url.startswith(("postgres://", "postgresql://")):
        raise RuntimeError("DATABASE_URL must be a postgres:// or postgresql:// URL for this Supabase check")
    if "<YOUR-SUPABASE-DB-PASSWORD>" in database_url:
        raise RuntimeError("Replace <YOUR-SUPABASE-DB-PASSWORD> before testing the database connection")

    connection = psycopg2.connect(database_url)
    try:
        with connection.cursor() as cursor:
            cursor.execute("select version();")
            version = cursor.fetchone()[0]
            print(f"Connected to database: {version}")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
