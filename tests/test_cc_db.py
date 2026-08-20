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


def test_una_query_con_percento_letterale_non_esplode(mocker):
    # Con params=() psycopg2 interpola comunque, e ogni % letterale diventa un
    # segnaposto: "ilike '%mail%'" moriva con IndexError.
    from tools.control_center import db

    finto = mocker.Mock()
    finto.fetchall.return_value = [(1,)]
    cur = mocker.MagicMock()
    cur.__enter__ = mocker.Mock(return_value=finto)
    cur.__exit__ = mocker.Mock(return_value=False)
    conn = mocker.MagicMock()
    conn.__enter__ = mocker.Mock(return_value=conn)
    conn.__exit__ = mocker.Mock(return_value=False)
    conn.cursor.return_value = cur
    mocker.patch.object(db.psycopg2, "connect", return_value=conn)
    mocker.patch.object(db, "_dsn", return_value="postgresql://x")

    db.fetch_all("select 1 where a ilike '%mail%'")
    # senza params, execute riceve un solo argomento
    chiamate = [c for c in finto.execute.call_args_list if "ilike" in str(c)]
    assert len(chiamate[0][0]) == 1

    db.fetch_all("select 1 where a = %s", ("x",))
    con_params = [c for c in finto.execute.call_args_list if c[0][0].endswith("%s")]
    assert con_params[0][0][1] == ("x",)
