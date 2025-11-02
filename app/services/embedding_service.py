"""Embedding service for document processing with ChromaDB."""
import os
import json
from typing import List, Dict
import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
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
        self.provider = None  # 'sentence-transformers' or 'gemini'
        self.st_model = None  # Sentence transformers model
        self.gemini_key = None  # Gemini API key
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

            # Load embedding provider from database
            self.provider = Settings.get('embedding_provider', 'sentence-transformers')
            print(f"[INFO] Using embedding provider: {self.provider}")

            # Initialize the selected embedding provider
            if self.provider == 'gemini':
                self._init_gemini()
            else:
                self._init_sentence_transformers()

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

    def _init_sentence_transformers(self):
        """Initialize sentence transformers model."""
        print("Loading sentence transformer model (this may take a minute on first run)...")
        try:
            model_name = Settings.get('st_model_name', 'all-MiniLM-L6-v2')
            self.st_model = SentenceTransformer(model_name)
            print(f"[OK] Sentence transformer model loaded: {model_name}")
        except Exception as model_error:
            print(f"[ERROR] Failed to load sentence transformer model: {model_error}")
            raise Exception(f"Failed to load embedding model. Make sure sentence-transformers is installed and you have internet connection for first-time model download: {model_error}")

    def _init_gemini(self):
        """Initialize Gemini embedding API."""
        print("Initializing Gemini embedding API...")
        try:
            self.gemini_key = os.getenv('GEMINI_API_KEY')
            if not self.gemini_key:
                raise Exception("GEMINI_API_KEY not found in environment variables")
            genai.configure(api_key=self.gemini_key)
            print("[OK] Gemini embedding API initialized")
        except Exception as gemini_error:
            print(f"[ERROR] Failed to initialize Gemini: {gemini_error}")
            raise Exception(f"Failed to initialize Gemini embedding API: {gemini_error}")

    def encode(self, texts):
        """Encode texts to embeddings using the configured provider.

        Args:
            texts: String or list of strings to encode

        Returns:
            numpy array or list of embeddings
        """
        if not self.embeddings_initialized:
            self.initialize()

        # Handle single string input
        if isinstance(texts, str):
            texts = [texts]
            single_input = True
        else:
            single_input = False

        try:
            if self.provider == 'sentence-transformers':
                embeddings = self.st_model.encode(texts, show_progress_bar=False)
            elif self.provider == 'gemini':
                embeddings = self._gemini_encode(texts)
            else:
                raise Exception(f"Unknown embedding provider: {self.provider}")

            # Return single embedding if single input
            if single_input:
                return embeddings[0] if isinstance(embeddings, list) else embeddings
            return embeddings

        except Exception as e:
            print(f"[ERROR] Failed to encode texts: {e}")
            raise

    def _gemini_encode(self, texts):
        """Encode texts using Gemini API one at a time for consistent format."""
        import numpy as np
        import time

        all_embeddings = []

        for idx, text in enumerate(texts):
            try:
                # Process one text at a time to ensure consistent response format
                result = genai.embed_content(
                    model="models/text-embedding-004",
                    content=text,
                    task_type="retrieval_document"
                )

                # Gemini API returns a dict, check for 'embedding' key
                if isinstance(result, dict) and 'embedding' in result:
                    embedding_vector = result['embedding']
                elif hasattr(result, 'embedding'):
                    # Alternative: result might be an object with embedding attribute
                    embedding_vector = result.embedding
                else:
                    raise Exception(f"Unexpected Gemini response format: {type(result)}, keys: {result.keys() if isinstance(result, dict) else 'N/A'}")

                # Ensure it's a simple list of floats
                if isinstance(embedding_vector, list):
                    all_embeddings.append(embedding_vector)
                else:
                    # Convert to list if numpy array or other type
                    all_embeddings.append(list(embedding_vector))

                # Rate limiting - process 10 per second
                if (idx + 1) % 10 == 0 and (idx + 1) < len(texts):
                    time.sleep(0.1)

            except Exception as e:
                print(f"[ERROR] Gemini encoding failed for text {idx + 1}/{len(texts)}: {e}")
                raise

        return np.array(all_embeddings)

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
            # Clear existing documents and recreate collection to handle dimension changes
            print("\n[1/4] Clearing existing embeddings...")
            try:
                # Delete the entire collection to handle embedding dimension changes
                # (e.g., switching from 384-dim sentence-transformers to 768-dim Gemini)
                self.client.delete_collection(self.COLLECTION_NAME)
                print("  [OK] Deleted existing collection")

                # Recreate collection
                self.collection = self.client.create_collection(
                    name=self.COLLECTION_NAME,
                    metadata={"description": "Context documents for AI chat"}
                )
                print("  [OK] Created new collection")
            except Exception as delete_error:
                # Collection might not exist yet, that's fine
                print(f"  [INFO] No existing collection to delete (this is normal for first run)")
                # Collection should already be created in initialize()

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
                        embeddings = self.encode(chunk_texts)

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
            query_embedding = self.encode(query)

            # Convert to proper format for ChromaDB
            # Ensure it's a flat list, not nested
            if hasattr(query_embedding, 'tolist'):
                # NumPy array
                embedding_list = query_embedding.tolist()
            else:
                # Already a list
                embedding_list = query_embedding

            # Ensure we have a flat list (not nested)
            if isinstance(embedding_list, list) and isinstance(embedding_list[0], list):
                embedding_list = embedding_list[0]

            # Search ChromaDB
            results = self.collection.query(
                query_embeddings=[embedding_list],
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
