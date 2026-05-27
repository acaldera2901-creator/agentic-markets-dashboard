import pytest
from unittest.mock import AsyncMock

@pytest.fixture
def mock_redis(mocker):
    r = AsyncMock()
    mocker.patch("core.redis_client.get_redis", return_value=r)
    return r
