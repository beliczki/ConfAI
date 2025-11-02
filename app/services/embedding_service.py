"""Embedding service for document processing with ChromaDB."""
import os
import json
from typing import List, Dict
import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer
from app.models import Settings


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
        # Chunk settings (loaded from database, with fallback to class constants)
        self.chunk_size = self.CHUNK_SIZE
        self.chunk_overlap = self.CHUNK_OVERLAP
        self.chunks_to_retrieve = 5

    def initialize(self):
        """Initialize embedding model and ChromaDB."""
        try:
            print("=== Initializing embedding service ===")

            # Load chunk settings from database
            print("Loading chunk settings from database...")
            try:
                self.chunk_size = int(Settings.get('chunk_size', self.CHUNK_SIZE))
                self.chunk_overlap = int(Settings.get('chunk_overlap', 200))
                self.chunks_to_retrieve = int(Settings.get('chunks_to_retrieve', 5))
                print(f"[OK] Loaded embedding settings: chunk_size={self.chunk_size}, chunk_overlap={self.chunk_overlap}, chunks_to_retrieve={self.chunks_to_retrieve}")
            except Exception as db_error:
                print(f"[WARNING] Error loading settings from database: {db_error}")
                print("[INFO] Using default settings")
                self.chunk_size = self.CHUNK_SIZE
                self.chunk_overlap = self.CHUNK_OVERLAP

            # Initialize sentence transformer model
            # Using all-MiniLM-L6-v2: lightweight, fast, and good quality
            print("Loading sentence transformer model (this may take a minute on first run)...")
            try:
                self.model = SentenceTransformer('all-MiniLM-L6-v2')
                print("[OK] Sentence transformer model loaded")
            except Exception as model_error:
                print(f"[ERROR] Failed to load sentence transformer model: {model_error}")
                raise Exception(f"Failed to load embedding model. Make sure sentence-transformers is installed and you have internet connection for first-time model download: {model_error}")

            # Initialize ChromaDB client (persistent storage)
            print("Initializing ChromaDB...")
            try:
                os.makedirs(self.CHROMA_DB_PATH, exist_ok=True)
                self.client = chromadb.PersistentClient(
                    path=self.CHROMA_DB_PATH,
                    settings=ChromaSettings(anonymized_telemetry=False)
                )
                print("[OK] ChromaDB client initialized")
            except Exception as chroma_error:
                print(f"[ERROR] Failed to initialize ChromaDB: {chroma_error}")
                raise Exception(f"Failed to initialize ChromaDB. Make sure chromadb is installed: {chroma_error}")

            # Get or create collection
            print("Getting or creating collection...")
            try:
                self.collection = self.client.get_or_create_collection(
                    name=self.COLLECTION_NAME,
                    metadata={"description": "Context documents for AI chat"}
                )
                print(f"[OK] Collection ready with {self.collection.count()} existing documents")
            except Exception as collection_error:
                print(f"[ERROR] Failed to create/get collection: {collection_error}")
                raise Exception(f"Failed to create/get ChromaDB collection: {collection_error}")

            self.embeddings_initialized = True
            print("=== Embedding service initialization complete ===\n")

        except Exception as e:
            print(f"[ERROR] Error initializing embedding service: {e}")
            import traceback
            traceback.print_exc()
            self.embeddings_initialized = False
            # Re-raise the exception so it can be caught by the caller
            raise

    def chunk_text(self, text: str, filename: str) -> List[Dict]:
        """Split text into overlapping chunks."""
        chunks = []
        text_length = len(text)
        start = 0
        chunk_id = 0

        while start < text_length:
            end = start + self.chunk_size
            chunk_text = text[start:end]

            # Try to break at sentence boundary if possible
            if end < text_length:
                last_period = chunk_text.rfind('.')
                last_newline = chunk_text.rfind('\n')
                break_point = max(last_period, last_newline)

                if break_point > self.chunk_size // 2:
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
            start = end - self.chunk_overlap

        return chunks

    def process_context_files(self):
        """Process all context files and store their embeddings."""
        print("\n=== Starting context files processing ===")

        if not self.embeddings_initialized:
            self.initialize()

        if not self.embeddings_initialized:
            print("[ERROR] Failed to initialize embedding service")
            return False

        try:
            # Clear existing documents by getting all IDs and deleting them
            print("\n[1/4] Clearing existing embeddings...")
            if self.collection.count() > 0:
                try:
                    # Get all document IDs
                    existing = self.collection.get()
                    if existing and 'ids' in existing and existing['ids']:
                        self.collection.delete(ids=existing['ids'])
                        print(f"  [OK] Deleted {len(existing['ids'])} existing chunks")
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

            # Load context config to check file modes
            print("\n[2/4] Loading configuration...")
            config_file = 'data/context_config.json'
            file_modes = {}
            if os.path.exists(config_file):
                try:
                    with open(config_file, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                        file_modes = config.get('file_modes', {})
                    print(f"  [OK] Loaded file modes for {len(file_modes)} files")
                except Exception as e:
                    print(f"  [ERROR] Error loading context config: {e}")

            if not os.path.exists(self.CONTEXT_FOLDER):
                print(f"  [ERROR] Context folder not found: {self.CONTEXT_FOLDER}")
                return False

            # Count files in vector mode
            vector_files = [f for f in os.listdir(self.CONTEXT_FOLDER)
                          if os.path.isfile(os.path.join(self.CONTEXT_FOLDER, f))
                          and f.endswith(('.txt', '.md'))
                          and file_modes.get(f, None) == 'vector']

            print(f"  [OK] Found {len(vector_files)} files in vector mode to process")

            total_chunks = 0

            # Process each context file that is in vector mode
            print("\n[3/4] Processing and chunking files...")
            for filename in os.listdir(self.CONTEXT_FOLDER):
                filepath = os.path.join(self.CONTEXT_FOLDER, filename)

                # Only process files that are explicitly set to vector mode
                is_vector_mode = file_modes.get(filename, None) == 'vector'

                if os.path.isfile(filepath) and filename.endswith(('.txt', '.md')) and is_vector_mode:
                    print(f"  Processing: {filename}")

                    # Read file content
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()

                    # Chunk the text
                    chunks = self.chunk_text(content, filename)
                    print(f"    -> Created {len(chunks)} chunks")

                    if chunks:
                        # Generate embeddings for all chunks
                        print(f"    -> Generating embeddings...")
                        chunk_texts = [chunk['text'] for chunk in chunks]
                        embeddings = self.model.encode(chunk_texts, show_progress_bar=False)

                        # Prepare data for ChromaDB
                        ids = [chunk['id'] for chunk in chunks]
                        metadatas = [chunk['metadata'] for chunk in chunks]

                        # Add to collection
                        print(f"    -> Storing in database...")
                        self.collection.add(
                            ids=ids,
                            embeddings=embeddings.tolist(),
                            documents=chunk_texts,
                            metadatas=metadatas
                        )

                        total_chunks += len(chunks)
                        print(f"    [OK] Added {len(chunks)} chunks from {filename}\n")

            print(f"\n[4/4] Finalizing...")
            print(f"  [OK] Successfully processed {len(vector_files)} documents")
            print(f"  [OK] Total chunks created: {total_chunks}")
            print("=== Embedding processing complete ===\n")
            return True

        except Exception as e:
            print(f"\n[ERROR] Error processing context files: {e}")
            import traceback
            traceback.print_exc()
            print("=== Embedding processing failed ===\n")
            return False

    def search_context(self, query: str, top_k: int = None) -> str:
        """Search for relevant context based on query using semantic search."""
        if not self.embeddings_initialized:
            self.initialize()

        if not self.embeddings_initialized or self.collection.count() == 0:
            return ""

        # Use configured chunks_to_retrieve if top_k not specified
        if top_k is None:
            top_k = self.chunks_to_retrieve

        try:
            # Generate query embedding
            query_embedding = self.model.encode(query, show_progress_bar=False)

            # Search ChromaDB
            results = self.collection.query(
                query_embeddings=[query_embedding.tolist()],
                n_results=min(top_k, self.collection.count())
            )

            # Format results as context string with clear source attribution
            context_parts = []
            if results['documents'] and len(results['documents']) > 0:
                for i, doc in enumerate(results['documents'][0]):
                    metadata = results['metadatas'][0][i]
                    filename = metadata.get('filename', 'unknown')
                    chunk_id = metadata.get('chunk_id', i)

                    # Format: --- Source: filename (Chunk #X) ---
                    source_header = f"--- Source: {filename} (Chunk #{chunk_id + 1}) ---"
                    context_parts.append(f"{source_header}\n{doc}\n")

            return "\n".join(context_parts) if context_parts else ""

        except Exception as e:
            print(f"Error searching context: {e}")
            return ""

    def get_stats(self) -> Dict:
        """Get statistics about stored embeddings."""
        try:
            # Initialize if not already initialized
            if not self.embeddings_initialized:
                self.initialize()

            # If initialization failed, return zeros
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
