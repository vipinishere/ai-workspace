"""
AES-256-GCM encryption service for storing API keys securely.

Usage:
    service = EncryptionService(key_hex="...")
    encrypted = service.encrypt("sk-your-api-key")
    original  = service.decrypt(encrypted)
"""

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import get_settings


class EncryptionService:
    """AES-256-GCM authenticated encryption."""

    _NONCE_SIZE = 12  # 96-bit nonce (GCM standard)

    def __init__(self, key_hex: str) -> None:
        raw = bytes.fromhex(key_hex)
        if len(raw) not in (16, 24, 32):
            raise ValueError("ENCRYPTION_KEY must be 32, 48, or 64 hex chars (16/24/32 bytes)")
        self._key = raw

    def encrypt(self, plaintext: str) -> str:
        """Encrypt a UTF-8 string and return base64(nonce || ciphertext)."""
        nonce = os.urandom(self._NONCE_SIZE)
        aesgcm = AESGCM(self._key)
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
        return base64.b64encode(nonce + ciphertext).decode("ascii")

    def decrypt(self, encrypted: str) -> str:
        """Decrypt a base64(nonce || ciphertext) string and return plaintext."""
        data = base64.b64decode(encrypted)
        if len(data) < self._NONCE_SIZE + 16:  # at minimum nonce + 16-byte GCM tag
            raise ValueError("Encrypted data is too short")
        nonce = data[: self._NONCE_SIZE]
        ciphertext = data[self._NONCE_SIZE :]
        aesgcm = AESGCM(self._key)
        return aesgcm.decrypt(nonce, ciphertext, None).decode("utf-8")

    @staticmethod
    def make_preview(raw_key: str) -> str:
        """Return first-4 + '...' + last-4 characters of a key."""
        if len(raw_key) <= 8:
            return raw_key[:2] + "..." + raw_key[-2:]
        return raw_key[:4] + "..." + raw_key[-4:]


def get_encryption_service() -> EncryptionService:
    """FastAPI dependency / module-level singleton."""
    settings = get_settings()
    return EncryptionService(settings.ENCRYPTION_KEY)


# Module-level singleton
_encryption_service: EncryptionService | None = None


def encryption_service() -> EncryptionService:
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = get_encryption_service()
    return _encryption_service
