"""Main entry point for the ConfAI application."""
import os
from app import create_app

app = create_app()

if __name__ == '__main__':
    debug = os.getenv('DEBUG', 'True') == 'True'
    app.run(host='0.0.0.0', port=5000, debug=debug)
