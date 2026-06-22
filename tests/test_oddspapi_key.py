"""Root-cause regression: tennis OddsPapi non consegnava quote perché _key()
leggeva os.environ (vuoto nel processo agent: la key vive solo in settings/.env),
mentre il gate usava settings.ODDSPAPI_KEY → fallimento silenzioso.
_key() deve leggere settings come tutti gli altri client quote."""
from config.settings import settings
from core import tennis_oddspapi_client as c


def test_key_reads_settings_when_env_missing(monkeypatch):
    monkeypatch.delenv("ODDSPAPI_KEY", raising=False)
    monkeypatch.setattr(settings, "ODDSPAPI_KEY", "settings-key-123", raising=False)
    assert c._key() == "settings-key-123"


def test_key_none_when_unset_everywhere(monkeypatch):
    monkeypatch.delenv("ODDSPAPI_KEY", raising=False)
    monkeypatch.setattr(settings, "ODDSPAPI_KEY", "", raising=False)
    assert c._key() is None
