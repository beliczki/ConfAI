"""Embedding service for document processing with ChromaDB."""
import os
import json
from typing import List, Dict
import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer


class EmbeddingService:
    """Service for document embeddings using ChromaDB."""

    CONTEXT_FOLDER = 'documents/context'
    CHROMA_DB_PATH = 'data/chromadb'
    COLLECTION_NAME = 'context_documents'
    CHUNK_SIZE = 512  # Characters per chunk
    CHUNK_OVERLAP = 128  # Overlap between chunks

    def __init__(self):
        self.embeddings_initialized = False
        self.model = None
        self.client = None
        self.collection = None

    def initialize(self):
        """Initialize embedding model and ChromaDB."""
        try:
            print("Initializing embedding service...")

            # Initialize sentence transformer model
            # Using all-MiniLM-L6-v2: lightweight, fast, and good quality
            self.model = SentenceTransformer('all-MiniLM-L6-v2')

            # Initialize ChromaDB client (persistent storage)
            os.makedirs(self.CHROMA_DB_PATH, exist_ok=True)
            self.client = chromadb.PersistentClient(
                path=self.CHROMA_DB_PATH,
                settings=ChromaSettings(anonymized_telemetry=False)
            )

            # Get or create collection
            self.collection = self.client.get_or_create_collection(
                name=self.COLLECTION_NAME,
                metadata={"description": "Context documents for AI chat"}
            )

            self.embeddings_initialized = True
            print(f"Embedding service initialized. Collection has {self.collection.count()} documents.")

        except Exception as e:
            print(f"Error initializing embedding service: {e}")
            self.embeddings_initialized = False

    def chunk_text(self, text: str, filename: str) -> List[Dict]:
        """Split text into overlapping chunks."""
        chunks = []
        text_length = len(text)
        start = 0
        chunk_id = 0

        while start < text_length:
            end = start + self.CHUNK_SIZE
            chunk_text = text[start:end]

            # Try to break at sentence boundary if possible
            if end < text_length:
                last_period = chunk_text.rfind('.')
                last_newline = chunk_text.rfind('\n')
                break_point = max(last_period, last_newline)

                if break_point > self.CHUNK_SIZE // 2:
                    end = start + break_point + 1
                    chunk_text = text[start:end]

            chunks.append({
                'id': f"{filename}_chunk_{chunk_id}",
                'text': chunk_text.strip(),
                'metadata': {
                    'filename': filename,
                    'chunk_id': chunk_id,
                    'start': start,
                    'end': end
                }
            })

            chunk_id += 1
            start = end - self.CHUNK_OVERLAP

        return chunks

    def process_context_files(self):
        """Process all context files and store their embeddings."""
        if not self.embeddings_initialized:
            self.initialize()

        if not self.embeddings_initialized:
            print("Failed to initialize embedding service")
            return False

        try:
            # Clear existing documents by getting all IDs and deleting them
            print("Clearing existing embeddings...")
            if self.collection.count() > 0:
                try:
                    # Get all document IDs
                    existing = self.collection.get()
                    if existing and 'ids' in existing and existing['ids']:
                        self.collection.delete(ids=existing['ids'])
                        print(f"Deleted {len(existing['ids'])} existing chunks")
                except Exception as delete_error:
                    print(f"Warning: Error clearing embeddings: {delete_error}")
                    # If deletion fails, try to create a new collection
                    try:
                        self.client.delete_collection(self.COLLECTION_NAME)
                        self.collection = self.client.create_collection(
                            name=self.COLLECTION_NAME,
                            metadata={"description": "Context documents for AI chat"}
                        )
                        print("Recreated collection")
                    except Exception as recreate_error:
                        print(f"Error recreating collection: {recreate_error}")
                        return False

            # Load context config to check enabled files
            config_file = 'data/context_config.json'
            enabled_files = {}
            if os.path.exists(config_file):
                try:
                    with open(config_file, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                        enabled_files = config.get('enabled_files', {})
                except Exception as e:
                    print(f"Error loading context config: {e}")

            if not os.path.exists(self.CONTEXT_FOLDER):
                print(f"Context folder not found: {self.CONTEXT_FOLDER}")
                return False

            total_chunks = 0

            # Process each context file
            for filename in os.listdir(self.CONTEXT_FOLDER):
                filepath = os.path.join(self.CONTEXT_FOLDER, filename)

                # Check if file is enabled (default to True if not specified)
                is_enabled = enabled_files.get(filename, True)

                if os.path.isfile(filepath) and filename.endswith(('.txt', '.md')) and is_enabled:
                    print(f"Processing file: {filename}")

                    # Read file content
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()

                    # Chunk the text
                    chunks = self.chunk_text(content, filename)

                    if chunks:
                        # Generate embeddings for all chunks
                        chunk_texts = [chunk['text'] for chunk in chunks]
                        embeddings = self.model.encode(chunk_texts, show_progress_bar=False)

                        # Prepare data for ChromaDB
                        ids = [chunk['id'] for chunk in chunks]
                        metadatas = [chunk['metadata'] for chunk in chunks]

                        # Add to collection
                        self.collection.add(
                            ids=ids,
                            embeddings=embeddings.tolist(),
                            documents=chunk_texts,
                            metadatas=metadatas
                        )

                        total_chunks += len(chunks)
                        print(f"  Added {len(chunks)} chunks from {filename}")

            print(f"Embedding processing complete. Total chunks: {total_chunks}")
            return True

        except Exception as e:
            print(f"Error processing context files: {e}")
            import traceback
            traceback.print_exc()
            return False

    def search_context(self, query: str, top_k: int = 5) -> str:
        """Search for relevant context based on query using semantic search."""
        if not self.embeddings_initialized:
            self.initialize()

        if not self.embeddings_initialized or self.collection.count() == 0:
            return ""

        try:
            # Generate query embedding
            query_embedding = self.model.encode(query, show_progress_bar=False)

            # Search ChromaDB
            results = self.collection.query(
                query_embeddings=[query_embedding.tolist()],
                n_results=min(top_k, self.collection.count())
            )

            # Format results as context string
            context_parts = []
            if results['documents'] and len(results['documents']) > 0:
                for i, doc in enumerate(results['documents'][0]):
                    metadata = results['metadatas'][0][i]
                    filename = metadata.get('filename', 'unknown')
                    context_parts.append(f"[{filename}]\n{doc}\n")

            return "\n".join(context_parts) if context_parts else ""

        except Exception as e:
            print(f"Error searching context: {e}")
            return ""

    def get_stats(self) -> Dict:
        """Get statistics about stored embeddings."""
        try:
            if not self.embeddings_initialized:
                return {
                    'initialized': False,
                    'document_count': 0,
                    'chunk_count': 0
                }

            # Count unique documents
            if self.collection.count() == 0:
                return {
                    'initialized': True,
                    'document_count': 0,
                    'chunk_count': 0
                }

            # Get all items to count unique files
            items = self.collection.get()
            unique_files = set()
            if items['metadatas']:
                for metadata in items['metadatas']:
                    if 'filename' in metadata:
                        unique_files.add(metadata['filename'])

            return {
                'initialized': True,
                'document_count': len(unique_files),
                'chunk_count': self.collection.count()
            }

        except Exception as e:
            print(f"Error getting stats: {e}")
            return {
                'initialized': False,
                'document_count': 0,
                'chunk_count': 0
            }


# Singleton instance
embedding_service = EmbeddingService()
