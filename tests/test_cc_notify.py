from tools.control_center import notify


def test_niente_notifiche_niente_chiamate(mocker):
    run = mocker.patch.object(notify.subprocess, "run")
    post = mocker.patch.object(notify.requests, "post")
    assert notify.send([], env={}) == []
    run.assert_not_called()
    post.assert_not_called()


def test_manda_su_macos_e_telegram(mocker):
    run = mocker.patch.object(notify.subprocess, "run")
    post = mocker.patch.object(notify.requests, "post")
    canali = notify.send(
        [{"check_id": "c", "kind": "down", "title": "T", "body": "B"}],
        env={"TELEGRAM_BOT_TOKEN": "tok", "TELEGRAM_CHAT_ID": "42"},
    )
    assert set(canali) == {"macos", "telegram"}
    assert run.call_args[0][0][0] == "osascript"
    assert post.call_args[1]["json"]["chat_id"] == "42"


def test_senza_token_resta_solo_macos(mocker):
    mocker.patch.object(notify.subprocess, "run")
    post = mocker.patch.object(notify.requests, "post")
    canali = notify.send([{"check_id": "c", "kind": "down", "title": "T", "body": "B"}], env={})
    assert canali == ["macos"]
    post.assert_not_called()


def test_il_token_non_finisce_mai_nel_messaggio(mocker):
    mocker.patch.object(notify.subprocess, "run")
    post = mocker.patch.object(notify.requests, "post")
    notify.send(
        [{"check_id": "c", "kind": "down", "title": "T", "body": "B"}],
        env={"TELEGRAM_BOT_TOKEN": "SEGRETO", "TELEGRAM_CHAT_ID": "42"},
    )
    assert "SEGRETO" not in post.call_args[1]["json"]["text"]


def test_un_canale_che_esplode_non_blocca_l_altro(mocker):
    mocker.patch.object(notify.subprocess, "run", side_effect=OSError("no osascript"))
    mocker.patch.object(notify.requests, "post")
    canali = notify.send(
        [{"check_id": "c", "kind": "down", "title": "T", "body": "B"}],
        env={"TELEGRAM_BOT_TOKEN": "tok", "TELEGRAM_CHAT_ID": "42"},
    )
    assert canali == ["telegram"]


def test_telegram_che_risponde_400_non_conta_come_consegnato(mocker):
    # Un chat_id sbagliato da' 400: senza raise_for_status il canale
    # d'allerta morirebbe in silenzio.
    class Resp400:
        def raise_for_status(self):
            raise RuntimeError("400 Bad Request: chat not found")

    mocker.patch.object(notify.subprocess, "run", side_effect=OSError("no osascript"))
    mocker.patch.object(notify.requests, "post", return_value=Resp400())
    canali = notify.send(
        [{"check_id": "c", "kind": "down", "title": "T", "body": "B"}],
        env={"TELEGRAM_BOT_TOKEN": "tok", "TELEGRAM_CHAT_ID": "sbagliato"},
    )
    assert canali == []
