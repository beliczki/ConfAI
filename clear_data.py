"""Clear chats, votes, and shares from the database."""
import sqlite3
import os

DATABASE_PATH = 'data/confai.db'

def clear_data():
    """Clear all chats, messages, insights, and votes from the database."""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    try:
        # Start transaction
        print("Clearing data from database...")

        # Clear votes first (foreign key dependency)
        cursor.execute('DELETE FROM votes')
        votes_deleted = cursor.rowcount
        print(f"[OK] Deleted {votes_deleted} votes")

        # Clear user vote counts
        cursor.execute('DELETE FROM user_vote_counts')
        vote_counts_deleted = cursor.rowcount
        print(f"[OK] Reset {vote_counts_deleted} user vote counts")

        # Clear insights (shares)
        cursor.execute('DELETE FROM insights')
        insights_deleted = cursor.rowcount
        print(f"[OK] Deleted {insights_deleted} insights (shares)")

        # Clear token usage
        cursor.execute('DELETE FROM token_usage')
        tokens_deleted = cursor.rowcount
        print(f"[OK] Deleted {tokens_deleted} token usage records")

        # Clear chat messages
        cursor.execute('DELETE FROM chat_messages')
        messages_deleted = cursor.rowcount
        print(f"[OK] Deleted {messages_deleted} chat messages")

        # Clear chat threads
        cursor.execute('DELETE FROM chat_threads')
        threads_deleted = cursor.rowcount
        print(f"[OK] Deleted {threads_deleted} chat threads")

        # Clear activity log
        cursor.execute('DELETE FROM activity_log')
        activities_deleted = cursor.rowcount
        print(f"[OK] Deleted {activities_deleted} activity log entries")

        # Commit the transaction
        conn.commit()
        print("\n[SUCCESS] All data cleared successfully!")

        # Show remaining data
        print("\nRemaining data:")
        cursor.execute('SELECT COUNT(*) FROM users')
        user_count = cursor.fetchone()[0]
        print(f"  Users: {user_count}")

        cursor.execute('SELECT COUNT(*) FROM chat_threads')
        thread_count = cursor.fetchone()[0]
        print(f"  Chat threads: {thread_count}")

        cursor.execute('SELECT COUNT(*) FROM insights')
        insight_count = cursor.fetchone()[0]
        print(f"  Insights: {insight_count}")

        cursor.execute('SELECT COUNT(*) FROM votes')
        vote_count = cursor.fetchone()[0]
        print(f"  Votes: {vote_count}")

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Error clearing data: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    if os.path.exists(DATABASE_PATH):
        # Confirm before clearing
        print("WARNING: This will delete ALL chats, messages, insights, and votes!")
        print("Users will NOT be deleted.\n")
        response = input("Are you sure you want to continue? (yes/no): ")

        if response.lower() == 'yes':
            clear_data()
        else:
            print("[CANCELLED] Operation cancelled.")
    else:
        print(f"[ERROR] Database not found at {DATABASE_PATH}")
