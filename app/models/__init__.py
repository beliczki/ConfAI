"""Database models for ConfAI."""
import os
import sqlite3
from datetime import datetime
from contextlib import contextmanager

DATABASE_PATH = os.getenv('DATABASE_URL', 'sqlite:///data/confai.db').replace('sqlite:///', '')


@contextmanager
def get_db():
    """Get database connection context manager."""
    # Ensure data directory exists
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def init_db():
    """Initialize the database with tables."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                avatar_gradient TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_allowed BOOLEAN DEFAULT 1
            )
        ''')

        # Login tokens table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS login_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                token TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Chat threads table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS chat_threads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL DEFAULT 'New Chat',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')

        # Chat messages table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                thread_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
            )
        ''')

        # Insights table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS insights (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                message_id INTEGER,
                content TEXT NOT NULL,
                upvotes INTEGER DEFAULT 0,
                downvotes INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE SET NULL
            )
        ''')

        # Votes table (track individual votes)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS votes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                insight_id INTEGER NOT NULL,
                vote_type TEXT NOT NULL CHECK(vote_type IN ('up', 'down')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (insight_id) REFERENCES insights(id) ON DELETE CASCADE,
                UNIQUE(user_id, insight_id)
            )
        ''')

        # User vote count tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_vote_counts (
                user_id INTEGER PRIMARY KEY,
                votes_used INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')

        # Create indexes for performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_chat_threads_user ON chat_threads(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_insights_user ON insights(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_votes_insight ON votes(insight_id)')

        conn.commit()
        print("Database initialized successfully")


# Helper functions for models
class User:
    """User model helper."""

    @staticmethod
    def create(email, name, avatar_gradient):
        """Create a new user."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO users (email, name, avatar_gradient) VALUES (?, ?, ?)',
                (email, name, avatar_gradient)
            )
            return cursor.lastrowid

    @staticmethod
    def get_by_email(email):
        """Get user by email."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
            return cursor.fetchone()

    @staticmethod
    def get_by_id(user_id):
        """Get user by ID."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
            return cursor.fetchone()


class ChatThread:
    """Chat thread model helper."""

    @staticmethod
    def create(user_id, title='New Chat'):
        """Create a new chat thread."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO chat_threads (user_id, title) VALUES (?, ?)',
                (user_id, title)
            )
            return cursor.lastrowid

    @staticmethod
    def get_by_user(user_id):
        """Get all threads for a user."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT * FROM chat_threads WHERE user_id = ? ORDER BY updated_at DESC',
                (user_id,)
            )
            return cursor.fetchall()

    @staticmethod
    def get_by_id(thread_id):
        """Get thread by ID."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM chat_threads WHERE id = ?', (thread_id,))
            return cursor.fetchone()

    @staticmethod
    def delete(thread_id):
        """Delete a thread."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM chat_threads WHERE id = ?', (thread_id,))


class ChatMessage:
    """Chat message model helper."""

    @staticmethod
    def create(thread_id, role, content):
        """Create a new message."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO chat_messages (thread_id, role, content) VALUES (?, ?, ?)',
                (thread_id, role, content)
            )
            # Update thread's updated_at
            cursor.execute(
                'UPDATE chat_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                (thread_id,)
            )
            return cursor.lastrowid

    @staticmethod
    def get_by_thread(thread_id):
        """Get all messages for a thread."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at ASC',
                (thread_id,)
            )
            return cursor.fetchall()


class Insight:
    """Insight model helper."""

    @staticmethod
    def create(user_id, content, message_id=None):
        """Create a new insight."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO insights (user_id, content, message_id) VALUES (?, ?, ?)',
                (user_id, content, message_id)
            )
            return cursor.lastrowid

    @staticmethod
    def get_all():
        """Get all insights with vote counts."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT i.*, u.name as user_name, u.avatar_gradient,
                       (i.upvotes - i.downvotes) as net_votes
                FROM insights i
                JOIN users u ON i.user_id = u.id
                ORDER BY net_votes DESC, i.created_at DESC
            ''')
            return cursor.fetchall()

    @staticmethod
    def vote(insight_id, user_id, vote_type):
        """Add or update a vote for an insight."""
        with get_db() as conn:
            cursor = conn.cursor()

            # Check if user has already voted on this insight
            cursor.execute(
                'SELECT vote_type FROM votes WHERE user_id = ? AND insight_id = ?',
                (user_id, insight_id)
            )
            existing_vote = cursor.fetchone()

            if existing_vote:
                # Update vote
                old_vote = existing_vote['vote_type']
                if old_vote != vote_type:
                    # Remove old vote count
                    if old_vote == 'up':
                        cursor.execute(
                            'UPDATE insights SET upvotes = upvotes - 1 WHERE id = ?',
                            (insight_id,)
                        )
                    else:
                        cursor.execute(
                            'UPDATE insights SET downvotes = downvotes - 1 WHERE id = ?',
                            (insight_id,)
                        )

                    # Add new vote count
                    if vote_type == 'up':
                        cursor.execute(
                            'UPDATE insights SET upvotes = upvotes + 1 WHERE id = ?',
                            (insight_id,)
                        )
                    else:
                        cursor.execute(
                            'UPDATE insights SET downvotes = downvotes + 1 WHERE id = ?',
                            (insight_id,)
                        )

                    # Update vote record
                    cursor.execute(
                        'UPDATE votes SET vote_type = ? WHERE user_id = ? AND insight_id = ?',
                        (vote_type, user_id, insight_id)
                    )
            else:
                # New vote
                # Check vote limit
                cursor.execute(
                    'SELECT votes_used FROM user_vote_counts WHERE user_id = ?',
                    (user_id,)
                )
                vote_count = cursor.fetchone()

                if vote_count and vote_count['votes_used'] >= 3:
                    return False, "Vote limit reached"

                # Insert vote
                cursor.execute(
                    'INSERT INTO votes (user_id, insight_id, vote_type) VALUES (?, ?, ?)',
                    (user_id, insight_id, vote_type)
                )

                # Update insight counts
                if vote_type == 'up':
                    cursor.execute(
                        'UPDATE insights SET upvotes = upvotes + 1 WHERE id = ?',
                        (insight_id,)
                    )
                else:
                    cursor.execute(
                        'UPDATE insights SET downvotes = downvotes + 1 WHERE id = ?',
                        (insight_id,)
                    )

                # Update user vote count
                cursor.execute('''
                    INSERT INTO user_vote_counts (user_id, votes_used)
                    VALUES (?, 1)
                    ON CONFLICT(user_id) DO UPDATE SET votes_used = votes_used + 1
                ''', (user_id,))

            return True, "Vote recorded"

    @staticmethod
    def get_user_vote_count(user_id):
        """Get how many votes a user has used."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT votes_used FROM user_vote_counts WHERE user_id = ?',
                (user_id,)
            )
            result = cursor.fetchone()
            return result['votes_used'] if result else 0
