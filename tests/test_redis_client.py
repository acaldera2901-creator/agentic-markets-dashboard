import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_publish_adds_to_stream():
    mock_r = AsyncMock()
    with patch("core.redis_client._client", mock_r):
        from core.redis_client import publish
        await publish("market:data", {"foo": "bar"})
        mock_r.xadd.assert_called_once_with("market:data", {"foo": "bar"})
