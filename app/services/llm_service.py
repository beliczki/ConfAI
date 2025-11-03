"""LLM service for AI response generation."""
import os
import json
import anthropic
import httpx
import google.generativeai as genai
from typing import Iterator, Dict, Any


class LLMService:
    """Service for interacting with various LLM providers."""

    SYSTEM_PROMPT_FILE = 'data/system_prompt.txt'
    CONTEXT_FOLDER = 'documents/context'
    CONTEXT_CONFIG_FILE = 'data/context_config.json'
    DEFAULT_SYSTEM_PROMPT = """You are a helpful AI assistant specialized in conference insights and book knowledge.
You have access to conference transcripts and related books.
Respond concisely and insightfully, drawing from the provided context when relevant.
Be professional, engaging, and help users derive meaningful insights."""

    def __init__(self):
        self.anthropic_key = os.getenv('ANTHROPIC_API_KEY')
        self.gemini_key = os.getenv('GEMINI_API_KEY')
        self.grok_key = os.getenv('GROK_API_KEY')
        self.perplexity_key = os.getenv('PERPLEXITY_API_KEY')

        # Configure Gemini if key is available
        if self.gemini_key:
            genai.configure(api_key=self.gemini_key)

    def _get_provider(self) -> str:
        """Get current provider from database settings."""
        try:
            from app.models import Settings
            return Settings.get('llm_provider', os.getenv('LLM_PROVIDER', 'gemini')).lower()
        except Exception as e:
            print(f"Error reading provider from database: {e}")
            return os.getenv('LLM_PROVIDER', 'gemini').lower()

    def _load_system_prompt(self) -> str:
        """Load system prompt from file or return default."""
        try:
            if os.path.exists(self.SYSTEM_PROMPT_FILE):
                with open(self.SYSTEM_PROMPT_FILE, 'r', encoding='utf-8') as f:
                    return f.read()
        except Exception as e:
            print(f"Error loading system prompt: {e}")

        return self.DEFAULT_SYSTEM_PROMPT

    def get_context_files(self) -> str:
        """Load enabled context files and return as concatenated string."""
        try:
            if not os.path.exists(self.CONTEXT_FOLDER):
                return ""

            # Load enabled files configuration
            enabled_files = {}
            if os.path.exists(self.CONTEXT_CONFIG_FILE):
                try:
                    with open(self.CONTEXT_CONFIG_FILE, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                        enabled_files = config.get('enabled_files', {})
                except Exception as e:
                    print(f"Error loading context config: {e}")

            context_parts = []

            for filename in os.listdir(self.CONTEXT_FOLDER):
                filepath = os.path.join(self.CONTEXT_FOLDER, filename)

                # Check if file is enabled (default to True if not specified)
                is_enabled = enabled_files.get(filename, True)

                if os.path.isfile(filepath) and filename.endswith(('.txt', '.md')) and is_enabled:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        context_parts.append(f"--- {filename} ---\n{content}\n")

            if context_parts:
                return "\n".join(context_parts)

        except Exception as e:
            print(f"Error loading context files: {e}")

        return ""

    def _get_context_mode(self) -> str:
        """Get current context mode from database settings."""
        try:
            from app.models import Settings
            return Settings.get('context_mode', 'context_window').lower()
        except Exception as e:
            print(f"Error reading context mode from database: {e}")
            return 'context_window'

    def _get_model_name(self, provider: str) -> str:
        """Get model name for a provider from database settings."""
        try:
            from app.models import Settings
            defaults = {
                'claude': 'claude-sonnet-4-5-20250929',
                'gemini': 'gemini-2.5-flash-lite',
                'grok': 'grok-4-fast-reasoning',
                'perplexity': 'sonar'
            }
            return Settings.get(f'{provider}_model', defaults.get(provider, ''))
        except Exception as e:
            print(f"Error reading model name for {provider}: {e}")
            # Fallback to hardcoded defaults
            return {
                'claude': 'claude-sonnet-4-5-20250929',
                'gemini': 'gemini-2.5-flash-lite',
                'grok': 'grok-4-fast-reasoning',
                'perplexity': 'sonar'
            }.get(provider, '')

    def generate_response(
        self,
        messages: list,
        context: str = "",
        stream: bool = False
    ) -> str | Iterator[str]:
        """Generate response from LLM.

        Args:
            messages: List of message dicts with 'role' and 'content'
            context: Additional context from embeddings (used in vector_embeddings mode)
            stream: Whether to stream the response

        Returns:
            Complete response string or iterator of response chunks
        """
        # Load system prompt from file
        system_prompt = self._load_system_prompt()

        # Get context mode from database
        context_mode = self._get_context_mode()
        print(f"Context mode: {context_mode}")

        if context_mode == 'context_window':
            # CONTEXT WINDOW MODE: Load all context files directly
            context_files = self.get_context_files()
            if context_files:
                system_prompt += f"\n\nContext files:\n{context_files}"
        elif context_mode == 'vector_embeddings':
            # VECTOR EMBEDDINGS MODE: Use semantic search for relevant chunks
            # Context is provided by the caller (from embedding_service.search_context)
            if context:
                system_prompt += f"\n\nRelevant context:\n{context}"

        # Get current provider from database
        provider = self._get_provider()

        # Estimate token count (rough: chars / 4)
        estimated_tokens = len(system_prompt) // 4
        print(f"System prompt size: {len(system_prompt)} chars (~{estimated_tokens} tokens)")
        print(f"Using LLM provider: {provider}")

        # Route to appropriate provider
        if provider == 'claude':
            return self._generate_claude(messages, system_prompt, stream)
        elif provider == 'gemini':
            return self._generate_gemini(messages, system_prompt, stream)
        elif provider == 'grok':
            return self._generate_grok(messages, system_prompt, stream)
        elif provider == 'perplexity':
            return self._generate_perplexity(messages, system_prompt, stream)
        else:
            raise ValueError(f"Unknown LLM provider: {provider}")

    def _generate_claude(
        self,
        messages: list,
        system_prompt: str,
        stream: bool
    ) -> str | Iterator[str]:
        """Generate response using Claude API with prompt caching."""
        if not self.anthropic_key:
            return "Claude API key not configured."

        try:
            client = anthropic.Anthropic(api_key=self.anthropic_key)

            # Get configured model name
            model_name = self._get_model_name('claude')

            # Use prompt caching by converting system prompt to list format
            # Mark the system prompt as cacheable to reduce costs
            system_blocks = [
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"}
                }
            ]

            if stream:
                # Streaming response with caching
                usage_data = {'captured': False}

                def generate_stream():
                    with client.messages.stream(
                        model=model_name,
                        max_tokens=2048,
                        system=system_blocks,
                        messages=messages
                    ) as stream:
                        # Stream the text first
                        for text in stream.text_stream:
                            yield text

                        # Log and capture cache usage stats AFTER streaming completes
                        final_message = stream.get_final_message()
                        if hasattr(final_message, 'usage'):
                            usage = final_message.usage
                            usage_data['input_tokens'] = getattr(usage, 'input_tokens', 0)
                            usage_data['output_tokens'] = getattr(usage, 'output_tokens', 0)
                            usage_data['cache_creation_tokens'] = getattr(usage, 'cache_creation_input_tokens', 0)
                            usage_data['cache_read_tokens'] = getattr(usage, 'cache_read_input_tokens', 0)
                            usage_data['captured'] = True
                            print(f"Cache stats - Read: {usage_data['cache_read_tokens']}, Create: {usage_data['cache_creation_tokens']}, Input: {usage_data['input_tokens']}, Output: {usage_data['output_tokens']}")

                def get_usage():
                    return usage_data if usage_data['captured'] else None

                return (generate_stream(), get_usage)
            else:
                # Non-streaming response with caching
                response = client.messages.create(
                    model=model_name,
                    max_tokens=2048,
                    system=system_blocks,
                    messages=messages
                )

                # Log cache usage stats
                if hasattr(response, 'usage'):
                    cache_read = getattr(response.usage, 'cache_read_input_tokens', 0)
                    cache_create = getattr(response.usage, 'cache_creation_input_tokens', 0)
                    input_tokens = getattr(response.usage, 'input_tokens', 0)
                    print(f"Cache stats - Read: {cache_read}, Create: {cache_create}, Input: {input_tokens}")

                return response.content[0].text

        except Exception as e:
            print(f"Error calling Claude API: {str(e)}")
            return f"Sorry, I encountered an error: {str(e)}"

    def _generate_gemini(
        self,
        messages: list,
        system_prompt: str,
        stream: bool
    ) -> str | Iterator[str]:
        """Generate response using Google Gemini API."""
        if not self.gemini_key:
            return "Gemini API key not configured."

        try:
            # Get configured model name
            model_name = self._get_model_name('gemini')

            # Use Gemini model
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=system_prompt
            )

            # Convert messages to Gemini format
            # Gemini expects alternating user/model messages
            gemini_messages = []
            for msg in messages:
                role = "user" if msg['role'] == 'user' else "model"
                gemini_messages.append({
                    'role': role,
                    'parts': [msg['content']]
                })

            if stream:
                # Streaming response with usage tracking
                usage_data = {
                    'input_tokens': 0,
                    'output_tokens': 0,
                    'cache_creation_tokens': 0,
                    'cache_read_tokens': 0,
                    'captured': False
                }

                def generate_stream():
                    response = model.generate_content(
                        gemini_messages,
                        stream=True,
                        generation_config=genai.types.GenerationConfig(
                            max_output_tokens=2048,
                            temperature=0.7,
                        )
                    )

                    # Stream the text
                    for chunk in response:
                        if chunk.text:
                            yield chunk.text

                        # Try to capture usage from last chunk
                        if hasattr(chunk, 'usage_metadata') and chunk.usage_metadata:
                            usage = chunk.usage_metadata
                            usage_data['input_tokens'] = getattr(usage, 'prompt_token_count', 0)
                            usage_data['output_tokens'] = getattr(usage, 'candidates_token_count', 0)
                            usage_data['captured'] = True

                    # Log usage if captured
                    if usage_data['captured']:
                        print(f"Gemini usage - Input: {usage_data['input_tokens']}, Output: {usage_data['output_tokens']}")

                def get_usage():
                    return usage_data if usage_data['captured'] else None

                return (generate_stream(), get_usage)
            else:
                # Non-streaming response
                response = model.generate_content(
                    gemini_messages,
                    generation_config=genai.types.GenerationConfig(
                        max_output_tokens=2048,
                        temperature=0.7,
                    )
                )

                # Log usage data
                if hasattr(response, 'usage_metadata') and response.usage_metadata:
                    usage = response.usage_metadata
                    input_tokens = getattr(usage, 'prompt_token_count', 0)
                    output_tokens = getattr(usage, 'candidates_token_count', 0)
                    print(f"Gemini usage - Input: {input_tokens}, Output: {output_tokens}")

                return response.text

        except Exception as e:
            print(f"Error calling Gemini API: {str(e)}")
            return f"Sorry, I encountered an error: {str(e)}"

    def _generate_grok(
        self,
        messages: list,
        system_prompt: str,
        stream: bool
    ) -> str | Iterator[str]:
        """Generate response using Grok API (xAI)."""
        print("=== GROK CALLED ===")

        if not self.grok_key:
            error_msg = "Grok API key not configured."
            print(f"ERROR: {error_msg}")
            if stream:
                def error_gen():
                    yield error_msg
                return error_gen()
            return error_msg

        try:
            # Grok API endpoint (xAI) - uses OpenAI-compatible format
            url = "https://api.x.ai/v1/chat/completions"

            headers = {
                "Authorization": f"Bearer {self.grok_key}",
                "Content-Type": "application/json"
            }

            # Prepare messages with UTF-8 encoding
            formatted_messages = []

            # Add system prompt
            if system_prompt:
                try:
                    system_content = system_prompt.encode('utf-8', errors='ignore').decode('utf-8')
                    formatted_messages.append({
                        "role": "system",
                        "content": system_content
                    })
                except Exception as e:
                    print(f"Warning: Error encoding system prompt: {e}")
                    formatted_messages.append({
                        "role": "system",
                        "content": system_prompt
                    })

            # Add conversation messages with UTF-8 encoding
            for msg in messages:
                try:
                    content = msg["content"]
                    if isinstance(content, str):
                        content = content.encode('utf-8', errors='ignore').decode('utf-8')
                    formatted_messages.append({
                        "role": msg["role"],
                        "content": content
                    })
                except Exception as e:
                    print(f"Warning: Error encoding message: {e}")
                    formatted_messages.append({
                        "role": msg["role"],
                        "content": str(msg["content"])
                    })

            # Get configured model name
            model_name = self._get_model_name('grok')

            data = {
                "model": model_name,  # xAI's configured model
                "messages": formatted_messages,
                "stream": stream,
                "temperature": 0.7
            }

            print(f"Grok API request - messages count: {len(formatted_messages)}, stream: {stream}")

            if stream:
                # Streaming response with usage tracking
                usage_data = {
                    'input_tokens': 0,
                    'output_tokens': 0,
                    'cache_creation_tokens': 0,
                    'cache_read_tokens': 0,
                    'captured': False
                }

                # Track output characters for fallback estimation
                output_chars = 0

                def generate_stream():
                    nonlocal output_chars
                    print("Starting Grok stream...")
                    try:
                        with httpx.stream("POST", url, headers=headers, json=data, timeout=120.0) as response:
                            # Check status code first
                            status = response.status_code
                            print(f"Grok response status: {status}")

                            if status != 200:
                                # Read error response body
                                error_body = ""
                                for line in response.iter_lines():
                                    error_body += line + "\n"
                                print(f"Grok error body: {error_body}")
                                yield f"\n\n[Error: HTTP {status} - {error_body}]"
                                return

                            # Read streaming response
                            chunk_count = 0
                            for line in response.iter_lines():
                                if line.startswith("data: "):
                                    chunk = line[6:]  # Remove "data: " prefix
                                    if chunk.strip() and chunk != "[DONE]":
                                        try:
                                            chunk_data = json.loads(chunk)
                                            chunk_count += 1

                                            # Debug: Log chunk structure for first and last few chunks
                                            if chunk_count <= 2 or chunk_count % 50 == 0:
                                                print(f"Grok chunk #{chunk_count} keys: {list(chunk_data.keys())}")

                                            if "choices" in chunk_data and len(chunk_data["choices"]) > 0:
                                                delta = chunk_data["choices"][0].get("delta", {})
                                                if "content" in delta:
                                                    content = delta["content"]
                                                    output_chars += len(content)
                                                    yield content

                                            # Capture usage from chunk (OpenAI format)
                                            if "usage" in chunk_data:
                                                usage = chunk_data["usage"]
                                                usage_data['input_tokens'] = usage.get('prompt_tokens', 0)
                                                usage_data['output_tokens'] = usage.get('completion_tokens', 0)
                                                usage_data['captured'] = True
                                                print(f"Grok usage captured from chunk #{chunk_count}")
                                        except json.JSONDecodeError as e:
                                            print(f"JSON decode error in streaming: {e}")
                                            pass
                                    elif chunk == "[DONE]":
                                        print(f"Grok stream: Received [DONE] after {chunk_count} chunks")

                            # If no usage captured from API, estimate from character count
                            if not usage_data['captured'] and output_chars > 0:
                                # Estimate tokens: ~1 token per 4 characters (rough approximation)
                                estimated_output = max(1, output_chars // 4)

                                # Estimate input tokens from message content
                                input_chars = sum(len(msg['content']) for msg in formatted_messages)
                                input_chars += len(system_prompt) if system_prompt else 0
                                estimated_input = max(1, input_chars // 4)

                                usage_data['input_tokens'] = estimated_input
                                usage_data['output_tokens'] = estimated_output
                                usage_data['captured'] = True
                                print(f"Grok usage (estimated) - Input: {estimated_input} (~{input_chars} chars), Output: {estimated_output} (~{output_chars} chars)")
                            elif usage_data['captured']:
                                print(f"Grok usage - Input: {usage_data['input_tokens']}, Output: {usage_data['output_tokens']}")

                            print("Grok stream completed")

                    except httpx.ConnectError as e:
                        error_msg = f"Connection error: {str(e)}"
                        print(error_msg)
                        yield f"\n\n[Error: {error_msg}]"
                    except httpx.TimeoutException as e:
                        error_msg = f"Request timeout: {str(e)}"
                        print(error_msg)
                        yield f"\n\n[Error: {error_msg}]"
                    except Exception as e:
                        print(f"Error in Grok streaming: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        yield f"\n\n[Error: {str(e)}]"

                def get_usage():
                    return usage_data if usage_data['captured'] else None

                return (generate_stream(), get_usage)
            else:
                # Non-streaming response
                print("Making non-streaming Grok request...")
                response = httpx.post(url, headers=headers, json=data, timeout=120.0)
                response.raise_for_status()
                result = response.json()
                print(f"Grok non-streaming response received")

                # Log usage if available
                if "usage" in result:
                    usage = result["usage"]
                    input_tokens = usage.get('prompt_tokens', 0)
                    output_tokens = usage.get('completion_tokens', 0)
                    print(f"Grok usage - Input: {input_tokens}, Output: {output_tokens}")

                return result["choices"][0]["message"]["content"]

        except httpx.HTTPStatusError as e:
            error_msg = f"Grok API error {e.response.status_code}: {e.response.text}"
            print(error_msg)
            if stream:
                def error_gen():
                    yield f"Sorry, I encountered an error: {error_msg}"
                return error_gen()
            return f"Sorry, I encountered an error: {error_msg}"
        except Exception as e:
            print(f"Error calling Grok API: {str(e)}")
            import traceback
            traceback.print_exc()
            if stream:
                def error_gen():
                    yield f"Sorry, I encountered an error: {str(e)}"
                return error_gen()
            return f"Sorry, I encountered an error: {str(e)}"

    def _generate_perplexity(
        self,
        messages: list,
        system_prompt: str,
        stream: bool
    ) -> str | Iterator[str]:
        """Generate response using Perplexity API."""
        print("=== PERPLEXITY CALLED ===")  # Debug

        if not self.perplexity_key:
            error_msg = "Perplexity API key not configured."
            print(f"ERROR: {error_msg}")
            if stream:
                def error_gen():
                    yield error_msg
                return error_gen()
            return error_msg

        try:
            url = "https://api.perplexity.ai/chat/completions"

            headers = {
                "Authorization": f"Bearer {self.perplexity_key}",
                "Content-Type": "application/json"
            }

            # Prepare messages - Perplexity API format
            # Perplexity requires messages without system role and strict alternation
            print(f"=== PERPLEXITY INPUT ===")
            print(f"Number of input messages: {len(messages)}")
            for i, msg in enumerate(messages):
                print(f"  Input message {i}: role={msg['role']}")
            print(f"=== END INPUT ===")

            formatted_messages = []

            # Add actual conversation messages with UTF-8 encoding
            for msg in messages:
                try:
                    # Ensure proper UTF-8 encoding for all content
                    content = msg["content"]
                    if isinstance(content, str):
                        content = content.encode('utf-8', errors='ignore').decode('utf-8')
                    formatted_messages.append({
                        "role": msg["role"],
                        "content": content
                    })
                except Exception as e:
                    print(f"Warning: Error encoding message: {e}")
                    formatted_messages.append({
                        "role": msg["role"],
                        "content": str(msg["content"])
                    })

            # Prepend system prompt (with context) to the first user message
            if system_prompt and len(system_prompt) > 0 and len(formatted_messages) > 0:
                # Find the first user message
                for i, msg in enumerate(formatted_messages):
                    if msg["role"] == "user":
                        # Include the full system prompt with context
                        # Perplexity can combine this with its web search capabilities
                        formatted_messages[i]["content"] = system_prompt + "\n\n" + formatted_messages[i]["content"]
                        print(f"Added system prompt to first user message ({len(system_prompt)} chars)")
                        break

            # Perplexity requires conversation to start with a user message
            # Remove any leading assistant messages
            while formatted_messages and formatted_messages[0]["role"] == "assistant":
                print(f"Removing leading assistant message")
                formatted_messages.pop(0)

            # Ensure messages alternate between user and assistant
            # Merge consecutive messages of the same role
            cleaned_messages = []
            for msg in formatted_messages:
                if cleaned_messages and cleaned_messages[-1]["role"] == msg["role"]:
                    # Merge with previous message
                    cleaned_messages[-1]["content"] += "\n\n" + msg["content"]
                else:
                    cleaned_messages.append(msg)

            formatted_messages = cleaned_messages

            # Debug: Print message roles to verify alternation
            print(f"=== PERPLEXITY MESSAGE STRUCTURE ===")
            for i, msg in enumerate(formatted_messages):
                print(f"  Message {i}: role={msg['role']}, content_length={len(msg['content'])}")
            print(f"=== END MESSAGE STRUCTURE ===")

            # Get configured model name
            model_name = self._get_model_name('perplexity')

            data = {
                "model": model_name,  # Perplexity's configured model
                "messages": formatted_messages,
                "stream": stream,
                "max_tokens": 2048
            }

            print(f"Perplexity API request - messages count: {len(formatted_messages)}, stream: {stream}")
            print(f"Perplexity URL: {url}")

            if stream:
                # Streaming response with usage tracking
                usage_data = {
                    'input_tokens': 0,
                    'output_tokens': 0,
                    'cache_creation_tokens': 0,
                    'cache_read_tokens': 0,
                    'captured': False
                }

                # Track output characters for fallback estimation
                output_chars = 0

                def generate_stream():
                    nonlocal output_chars
                    print("Starting Perplexity stream...")
                    try:
                        with httpx.stream("POST", url, headers=headers, json=data, timeout=120.0) as response:
                            # Check status code first, before accessing content
                            status = response.status_code
                            print(f"Perplexity response status: {status}")

                            if status != 200:
                                # Read error response body
                                error_body = ""
                                for line in response.iter_lines():
                                    error_body += line + "\n"
                                print(f"Perplexity error body: {error_body}")
                                yield f"\n\n[Error: HTTP {status} - {error_body}]"
                                return

                            # Read streaming response line by line
                            chunk_count = 0
                            for line in response.iter_lines():
                                if line.startswith("data: "):
                                    chunk = line[6:]
                                    if chunk.strip() and chunk != "[DONE]":
                                        try:
                                            chunk_data = json.loads(chunk)
                                            chunk_count += 1

                                            # Debug: Log chunk structure for first and last few chunks
                                            if chunk_count <= 2 or chunk_count % 50 == 0:
                                                print(f"Perplexity chunk #{chunk_count} keys: {list(chunk_data.keys())}")

                                            if "choices" in chunk_data and len(chunk_data["choices"]) > 0:
                                                delta = chunk_data["choices"][0].get("delta", {})
                                                if "content" in delta:
                                                    content = delta["content"]
                                                    output_chars += len(content)
                                                    # Don't print content to avoid encoding issues
                                                    yield content

                                            # Capture usage from chunk (OpenAI format)
                                            if "usage" in chunk_data:
                                                usage = chunk_data["usage"]
                                                usage_data['input_tokens'] = usage.get('prompt_tokens', 0)
                                                usage_data['output_tokens'] = usage.get('completion_tokens', 0)
                                                usage_data['captured'] = True
                                                print(f"Perplexity usage captured from chunk #{chunk_count}")
                                        except json.JSONDecodeError as e:
                                            print(f"JSON decode error in streaming: {e}")
                                            pass
                                    elif chunk == "[DONE]":
                                        print(f"Perplexity stream: Received [DONE] after {chunk_count} chunks")

                            # If no usage captured from API, estimate from character count
                            if not usage_data['captured'] and output_chars > 0:
                                # Estimate tokens: ~1 token per 4 characters (rough approximation)
                                estimated_output = max(1, output_chars // 4)

                                # Estimate input tokens from message content
                                input_chars = sum(len(msg['content']) for msg in formatted_messages)
                                input_chars += len(system_prompt) if system_prompt else 0
                                estimated_input = max(1, input_chars // 4)

                                usage_data['input_tokens'] = estimated_input
                                usage_data['output_tokens'] = estimated_output
                                usage_data['captured'] = True
                                print(f"Perplexity usage (estimated) - Input: {estimated_input} (~{input_chars} chars), Output: {estimated_output} (~{output_chars} chars)")
                            elif usage_data['captured']:
                                print(f"Perplexity usage - Input: {usage_data['input_tokens']}, Output: {usage_data['output_tokens']}")

                            print("Perplexity stream completed")

                    except httpx.ConnectError as e:
                        error_msg = f"Connection error: {str(e)}"
                        print(error_msg)
                        yield f"\n\n[Error: {error_msg}]"
                    except httpx.TimeoutException as e:
                        error_msg = f"Request timeout: {str(e)}"
                        print(error_msg)
                        yield f"\n\n[Error: {error_msg}]"
                    except Exception as e:
                        print(f"Error in Perplexity streaming: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        yield f"\n\n[Error: {str(e)}]"

                def get_usage():
                    return usage_data if usage_data['captured'] else None

                return (generate_stream(), get_usage)
            else:
                # Non-streaming response
                print("Making non-streaming Perplexity request...")
                response = httpx.post(url, headers=headers, json=data, timeout=120.0)
                response.raise_for_status()
                result = response.json()
                print(f"Perplexity non-streaming response received")

                # Log usage if available
                if "usage" in result:
                    usage = result["usage"]
                    input_tokens = usage.get('prompt_tokens', 0)
                    output_tokens = usage.get('completion_tokens', 0)
                    print(f"Perplexity usage - Input: {input_tokens}, Output: {output_tokens}")

                return result["choices"][0]["message"]["content"]

        except httpx.HTTPStatusError as e:
            error_msg = f"Perplexity API error {e.response.status_code}: {e.response.text}"
            print(error_msg)
            if stream:
                def error_gen():
                    yield f"Sorry, I encountered an error: {error_msg}"
                return error_gen()
            return f"Sorry, I encountered an error: {error_msg}"
        except Exception as e:
            print(f"Error calling Perplexity API: {str(e)}")
            import traceback
            traceback.print_exc()
            if stream:
                def error_gen():
                    yield f"Sorry, I encountered an error: {str(e)}"
                return error_gen()
            return f"Sorry, I encountered an error: {str(e)}"


# Singleton instance
llm_service = LLMService()
