"""LLM service for AI response generation."""
import os
import anthropic
import httpx
from typing import Iterator, Dict, Any


class LLMService:
    """Service for interacting with various LLM providers."""

    SYSTEM_PROMPT_FILE = 'data/system_prompt.txt'
    CONTEXT_FOLDER = 'documents/context'
    DEFAULT_SYSTEM_PROMPT = """You are a helpful AI assistant specialized in conference insights and book knowledge.
You have access to conference transcripts and related books.
Respond concisely and insightfully, drawing from the provided context when relevant.
Be professional, engaging, and help users derive meaningful insights."""

    def __init__(self):
        self.provider = os.getenv('LLM_PROVIDER', 'claude').lower()
        self.anthropic_key = os.getenv('ANTHROPIC_API_KEY')
        self.grok_key = os.getenv('GROK_API_KEY')
        self.perplexity_key = os.getenv('PERPLEXITY_API_KEY')

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
        """Load all context files and return as concatenated string."""
        try:
            if not os.path.exists(self.CONTEXT_FOLDER):
                return ""

            context_parts = []

            for filename in os.listdir(self.CONTEXT_FOLDER):
                filepath = os.path.join(self.CONTEXT_FOLDER, filename)

                if os.path.isfile(filepath) and filename.endswith(('.txt', '.md')):
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        context_parts.append(f"--- {filename} ---\n{content}\n")

            if context_parts:
                return "\n".join(context_parts)

        except Exception as e:
            print(f"Error loading context files: {e}")

        return ""

    def generate_response(
        self,
        messages: list,
        context: str = "",
        stream: bool = False
    ) -> str | Iterator[str]:
        """Generate response from LLM.

        Args:
            messages: List of message dicts with 'role' and 'content'
            context: Additional context from embeddings
            stream: Whether to stream the response

        Returns:
            Complete response string or iterator of response chunks
        """
        # Load system prompt from file
        system_prompt = self._load_system_prompt()

        # Load context files
        context_files = self.get_context_files()
        if context_files:
            system_prompt += f"\n\nContext files:\n{context_files}"

        # Add additional context from embeddings if provided
        if context:
            system_prompt += f"\n\nRelevant context:\n{context}"

        # Estimate token count (rough: chars / 4)
        estimated_tokens = len(system_prompt) // 4
        print(f"System prompt size: {len(system_prompt)} chars (~{estimated_tokens} tokens)")

        # Route to appropriate provider
        if self.provider == 'claude':
            return self._generate_claude(messages, system_prompt, stream)
        elif self.provider == 'grok':
            return self._generate_grok(messages, system_prompt, stream)
        elif self.provider == 'perplexity':
            return self._generate_perplexity(messages, system_prompt, stream)
        else:
            raise ValueError(f"Unknown LLM provider: {self.provider}")

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
                def generate_stream():
                    with client.messages.stream(
                        model="claude-sonnet-4-5-20250929",
                        max_tokens=2048,
                        system=system_blocks,
                        messages=messages
                    ) as stream:
                        # Stream the text first
                        for text in stream.text_stream:
                            yield text

                        # Log cache usage stats AFTER streaming completes
                        # The usage data is available on the final message
                        final_message = stream.get_final_message()
                        if hasattr(final_message, 'usage'):
                            usage = final_message.usage
                            cache_read = getattr(usage, 'cache_read_input_tokens', 0)
                            cache_create = getattr(usage, 'cache_creation_input_tokens', 0)
                            input_tokens = getattr(usage, 'input_tokens', 0)
                            print(f"Cache stats - Read: {cache_read}, Create: {cache_create}, Input: {input_tokens}")

                return generate_stream()
            else:
                # Non-streaming response with caching
                response = client.messages.create(
                    model="claude-sonnet-4-5-20250929",
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

    def _generate_grok(
        self,
        messages: list,
        system_prompt: str,
        stream: bool
    ) -> str | Iterator[str]:
        """Generate response using Grok API."""
        if not self.grok_key:
            return "Grok API key not configured."

        try:
            # Grok API endpoint (xAI)
            url = "https://api.x.ai/v1/chat/completions"

            headers = {
                "Authorization": f"Bearer {self.grok_key}",
                "Content-Type": "application/json"
            }

            # Prepare messages with system prompt
            api_messages = [{"role": "system", "content": system_prompt}] + messages

            data = {
                "model": "grok-beta",
                "messages": api_messages,
                "stream": stream,
                "temperature": 0.7
            }

            if stream:
                # Streaming response
                def generate_stream():
                    with httpx.stream("POST", url, headers=headers, json=data, timeout=60.0) as response:
                        for line in response.iter_lines():
                            if line.startswith("data: "):
                                chunk = line[6:]  # Remove "data: " prefix
                                if chunk.strip() and chunk != "[DONE]":
                                    import json
                                    try:
                                        data = json.loads(chunk)
                                        if "choices" in data and len(data["choices"]) > 0:
                                            delta = data["choices"][0].get("delta", {})
                                            if "content" in delta:
                                                yield delta["content"]
                                    except json.JSONDecodeError:
                                        pass

                return generate_stream()
            else:
                # Non-streaming response
                response = httpx.post(url, headers=headers, json=data, timeout=60.0)
                response.raise_for_status()
                result = response.json()
                return result["choices"][0]["message"]["content"]

        except Exception as e:
            print(f"Error calling Grok API: {str(e)}")
            return f"Sorry, I encountered an error: {str(e)}"

    def _generate_perplexity(
        self,
        messages: list,
        system_prompt: str,
        stream: bool
    ) -> str | Iterator[str]:
        """Generate response using Perplexity API."""
        if not self.perplexity_key:
            return "Perplexity API key not configured."

        try:
            url = "https://api.perplexity.ai/chat/completions"

            headers = {
                "Authorization": f"Bearer {self.perplexity_key}",
                "Content-Type": "application/json"
            }

            # Prepare messages with system prompt
            api_messages = [{"role": "system", "content": system_prompt}] + messages

            data = {
                "model": "llama-3.1-sonar-large-128k-online",
                "messages": api_messages,
                "stream": stream
            }

            if stream:
                # Streaming response
                def generate_stream():
                    with httpx.stream("POST", url, headers=headers, json=data, timeout=60.0) as response:
                        for line in response.iter_lines():
                            if line.startswith("data: "):
                                chunk = line[6:]
                                if chunk.strip() and chunk != "[DONE]":
                                    import json
                                    try:
                                        data = json.loads(chunk)
                                        if "choices" in data and len(data["choices"]) > 0:
                                            delta = data["choices"][0].get("delta", {})
                                            if "content" in delta:
                                                yield delta["content"]
                                    except json.JSONDecodeError:
                                        pass

                return generate_stream()
            else:
                # Non-streaming response
                response = httpx.post(url, headers=headers, json=data, timeout=60.0)
                response.raise_for_status()
                result = response.json()
                return result["choices"][0]["message"]["content"]

        except Exception as e:
            print(f"Error calling Perplexity API: {str(e)}")
            return f"Sorry, I encountered an error: {str(e)}"


# Singleton instance
llm_service = LLMService()
