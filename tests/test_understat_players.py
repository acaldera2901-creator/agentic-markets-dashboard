from core.understat_players import parse_players_data, normalize_name

# Understat incorpora i dati come: var playersData = JSON.parse('...');
PAGE = r"""
<script>
var playersData = JSON.parse('[{"player_name":"Erling Haaland","time":"1800","xG":"20.5"},{"player_name":"Bukayo Saka","time":"900","xG":"5.0"}]');
</script>
"""

def test_parse_players_data_returns_xg_per90():
    out = parse_players_data(PAGE)
    # Haaland: 20.5 xG su 1800' = 20.5/1800*90
    assert round(out["erling haaland"], 3) == round(20.5 / 1800 * 90, 3)
    assert round(out["bukayo saka"], 3) == round(5.0 / 900 * 90, 3)

def test_parse_returns_empty_on_garbage():
    assert parse_players_data("<html>no data</html>") == {}

def test_normalize_name():
    assert normalize_name("  Erling HAALAND ") == "erling haaland"
