"""Script to clear all votes and shares from the database."""
import sqlite3
import os

# Get database path (same as in models/__init__.py)
db_path = os.getenv('DATABASE_URL', 'sqlite:///data/confai.db').replace('sqlite:///', '')

print(f"Connecting to database: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Delete all votes
    cursor.execute('DELETE FROM votes')
    votes_deleted = cursor.rowcount
    print(f"Deleted {votes_deleted} votes")

    # Delete all insights (shares)
    cursor.execute('DELETE FROM insights')
    insights_deleted = cursor.rowcount
    print(f"Deleted {insights_deleted} insights (shares)")

    # Reset all user vote counts
    cursor.execute('DELETE FROM user_vote_counts')
    vote_counts_deleted = cursor.rowcount
    print(f"Reset vote counts for {vote_counts_deleted} users")

    # Commit the changes
    conn.commit()
    print("\n[SUCCESS] Successfully cleared all votes and shares from the database")

except Exception as e:
    conn.rollback()
    print(f"\n[ERROR] Error: {e}")
    raise

finally:
    conn.close()
