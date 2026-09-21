import io

import pytest

from core import football_data_uk as fd


@pytest.mark.parametrize("final, accepted", [
    ("https://www.football-data.co.uk/mmz4281/2627/I2.csv", True),
    ("https://football-data.co.uk/mmz4281/2627/I2.csv", True),
    ("https://football-data.co.uk/mmz4281/2627/EC.csv", False),
    ("https://football-data.co.uk/mmz4281/2526/I2.csv", False),
    ("https://evil.example/mmz4281/2627/I2.csv", False),
    ("http://football-data.co.uk/mmz4281/2627/I2.csv", False),
    ("https://football-data.co.uk:8443/mmz4281/2627/I2.csv", False),
    ("https://football-data.co.uk/mmz4281/2627/I2.csv?other=division", False),
])
def test_download_redirect_keeps_exact_source_identity(monkeypatch, final, accepted):
    response = io.BytesIO(b"Div,Date\nI2,20/09/2026\n")
    response.geturl = lambda: final
    monkeypatch.setattr(fd.urllib.request, "urlopen", lambda *args, **kwargs: response)
    if accepted:
        assert fd.download_csv("SB", 2026) == "Div,Date\nI2,20/09/2026\n"
    else:
        with pytest.raises(FileNotFoundError):
            fd.download_csv("SB", 2026)
