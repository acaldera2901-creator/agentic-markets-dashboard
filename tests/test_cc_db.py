import pytest

from tools.control_center.db import load_env, normalize_db_url


def test_converte_la_forma_sqlalchemy():
    # La trappola misurata il 2026-08-20: psql e psycopg2 ignorano questo
    # schema in silenzio e cadono sul socket locale, dando un errore che
    # sembra "database giu'".
    raw = "postgresql+asyncpg://u:p@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
    assert normalize_db_url(raw) == "postgresql://u:p@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"


def test_lascia_intatto_un_url_gia_valido():
    raw = "postgresql://u:p@host:5432/postgres"
    assert normalize_db_url(raw) == raw


def test_toglie_le_virgolette_dal_valore_env():
    assert normalize_db_url('"postgresql://u:p@h:5432/d"') == "postgresql://u:p@h:5432/d"


def test_url_assente_e_un_errore_non_un_default():
    with pytest.raises(ValueError, match="assente"):
        normalize_db_url("")
    with pytest.raises(ValueError, match="assente"):
        normalize_db_url(None)


def test_schema_sconosciuto_non_passa_in_silenzio():
    with pytest.raises(ValueError, match="schema"):
        normalize_db_url("mysql://u:p@h/d")


def test_load_env_legge_le_coppie_e_salta_i_commenti(tmp_path):
    f = tmp_path / ".env"
    f.write_text('# commento\nDATABASE_URL="postgresql://a"\nVUOTO=\nTELEGRAM_BOT_TOKEN=abc\n\n')
    env = load_env(str(f))
    assert env["DATABASE_URL"] == "postgresql://a"
    assert env["TELEGRAM_BOT_TOKEN"] == "abc"
    assert env["VUOTO"] == ""
    assert "# commento" not in env
