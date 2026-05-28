export interface WeatherData {
  temp: number;      // Celsius
  wind: number;      // m/s
  condition: string; // "clear", "rain", "clouds", etc.
  rain: number;      // mm/h (0 if none)
  icon: string;      // emoji icon
}

// Team → city name for OpenWeatherMap city-name queries
const TEAM_CITY: Record<string, string> = {
  // Serie A
  juventus: "Turin,IT",
  "inter milan": "Milan,IT",
  "ac milan": "Milan,IT",
  milan: "Milan,IT",
  "as roma": "Rome,IT",
  roma: "Rome,IT",
  lazio: "Rome,IT",
  "ss lazio": "Rome,IT",
  napoli: "Naples,IT",
  atalanta: "Bergamo,IT",
  fiorentina: "Florence,IT",
  torino: "Turin,IT",
  verona: "Verona,IT",
  bologna: "Bologna,IT",
  genoa: "Genoa,IT",
  sampdoria: "Genoa,IT",
  parma: "Parma,IT",
  udinese: "Udine,IT",
  lecce: "Lecce,IT",
  cagliari: "Cagliari,IT",
  sassuolo: "Reggio nell'Emilia,IT",
  empoli: "Empoli,IT",
  monza: "Monza,IT",
  como: "Como,IT",
  venezia: "Venice,IT",
  // Premier League
  arsenal: "London,GB",
  chelsea: "London,GB",
  "tottenham hotspur": "London,GB",
  tottenham: "London,GB",
  "west ham united": "London,GB",
  "crystal palace": "London,GB",
  "brentford": "London,GB",
  fulham: "London,GB",
  "manchester city": "Manchester,GB",
  "manchester united": "Manchester,GB",
  liverpool: "Liverpool,GB",
  everton: "Liverpool,GB",
  "aston villa": "Birmingham,GB",
  "wolverhampton wanderers": "Wolverhampton,GB",
  wolves: "Wolverhampton,GB",
  "leicester city": "Leicester,GB",
  leicester: "Leicester,GB",
  "newcastle united": "Newcastle upon Tyne,GB",
  newcastle: "Newcastle upon Tyne,GB",
  "nottingham forest": "Nottingham,GB",
  brighton: "Brighton,GB",
  "brighton & hove albion": "Brighton,GB",
  southampton: "Southampton,GB",
  ipswich: "Ipswich,GB",
  "ipswich town": "Ipswich,GB",
  sunderland: "Sunderland,GB",
  burnley: "Burnley,GB",
  "leeds united": "Leeds,GB",
  "afc bournemouth": "Bournemouth,GB",
  bournemouth: "Bournemouth,GB",
  // La Liga
  "real madrid": "Madrid,ES",
  "atletico madrid": "Madrid,ES",
  barcelona: "Barcelona,ES",
  sevilla: "Seville,ES",
  "real betis": "Seville,ES",
  villarreal: "Villarreal,ES",
  "real sociedad": "San Sebastian,ES",
  "athletic bilbao": "Bilbao,ES",
  athletic: "Bilbao,ES",
  valencia: "Valencia,ES",
  osasuna: "Pamplona,ES",
  girona: "Girona,ES",
  getafe: "Getafe,ES",
  mallorca: "Palma de Mallorca,ES",
  "celta vigo": "Vigo,ES",
  "deportivo alaves": "Vitoria-Gasteiz,ES",
  alaves: "Vitoria-Gasteiz,ES",
  "rayo vallecano": "Madrid,ES",
  espanyol: "Barcelona,ES",
  "las palmas": "Las Palmas de Gran Canaria,ES",
  leganes: "Leganes,ES",
  // Bundesliga
  "fc bayern munich": "Munich,DE",
  "bayern munich": "Munich,DE",
  "borussia dortmund": "Dortmund,DE",
  "rb leipzig": "Leipzig,DE",
  "bayer leverkusen": "Leverkusen,DE",
  "eintracht frankfurt": "Frankfurt,DE",
  wolfsburg: "Wolfsburg,DE",
  "borussia monchengladbach": "Monchengladbach,DE",
  "sc freiburg": "Freiburg im Breisgau,DE",
  freiburg: "Freiburg im Breisgau,DE",
  "union berlin": "Berlin,DE",
  "hertha bsc": "Berlin,DE",
  "werder bremen": "Bremen,DE",
  hoffenheim: "Sinsheim,DE",
  "tsg hoffenheim": "Sinsheim,DE",
  mainz: "Mainz,DE",
  "1. fsv mainz 05": "Mainz,DE",
  augsburg: "Augsburg,DE",
  "fc augsburg": "Augsburg,DE",
  cologne: "Cologne,DE",
  "1. fc koln": "Cologne,DE",
  bochum: "Bochum,DE",
  // Ligue 1
  "paris saint-germain": "Paris,FR",
  psg: "Paris,FR",
  marseille: "Marseille,FR",
  "olympique de marseille": "Marseille,FR",
  lyon: "Lyon,FR",
  "olympique lyonnais": "Lyon,FR",
  monaco: "Monaco,MC",
  nice: "Nice,FR",
  "ogc nice": "Nice,FR",
  lens: "Lens,FR",
  rennes: "Rennes,FR",
  lille: "Lille,FR",
  "losc lille": "Lille,FR",
  nantes: "Nantes,FR",
  strasbourg: "Strasbourg,FR",
  montpellier: "Montpellier,FR",
  reims: "Reims,FR",
  brest: "Brest,FR",
  toulouse: "Toulouse,FR",
  lorient: "Lorient,FR",
  metz: "Metz,FR",
  clermont: "Clermont-Ferrand,FR",
};

function normTeam(name: string): string {
  return name
    .replace(/\b(FC|AC|AS|SS|US|SSC|AFC|SC|SV|CF|Calcio)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function resolveCity(homeTeam: string): string | null {
  const norm = normTeam(homeTeam);
  // Direct match
  if (TEAM_CITY[norm]) return TEAM_CITY[norm];
  // Substring match
  for (const [key, city] of Object.entries(TEAM_CITY)) {
    if (norm.includes(key) || key.includes(norm)) return city;
  }
  return null;
}

function conditionEmoji(main: string): string {
  const m = main.toLowerCase();
  if (m.includes("rain") || m.includes("drizzle")) return "🌧️";
  if (m.includes("thunder")) return "⛈️";
  if (m.includes("snow")) return "❄️";
  if (m.includes("mist") || m.includes("fog")) return "🌫️";
  if (m.includes("cloud")) return "☁️";
  return "☀️";
}

export async function fetchMatchWeather(
  homeTeam: string,
  kickoffDate: Date
): Promise<WeatherData | null> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) return null;

  const city = resolveCity(homeTeam);
  if (!city) return null;

  const hoursUntil =
    (kickoffDate.getTime() - Date.now()) / 3_600_000;
  if (hoursUntil < 0 || hoursUntil > 120) return null;

  try {
    const url = new URL("https://api.openweathermap.org/data/2.5/forecast");
    url.searchParams.set("q", city);
    url.searchParams.set("appid", apiKey);
    url.searchParams.set("units", "metric");
    url.searchParams.set("cnt", "8"); // 8 × 3h slots = 24h ahead

    const r = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) return null;

    const data = await r.json() as {
      list: Array<{
        dt: number;
        main: { temp: number };
        wind: { speed: number };
        weather: Array<{ main: string }>;
        rain?: { "3h": number };
      }>;
    };

    // Find the forecast slot closest to kickoff
    const kickoffTs = Math.floor(kickoffDate.getTime() / 1000);
    let best = data.list[0];
    let minDiff = Infinity;
    for (const slot of data.list) {
      const diff = Math.abs(slot.dt - kickoffTs);
      if (diff < minDiff) { minDiff = diff; best = slot; }
    }

    const condition = best.weather[0]?.main ?? "Clear";
    return {
      temp: Math.round(best.main.temp),
      wind: Math.round(best.wind.speed * 10) / 10,
      condition,
      rain: best.rain?.["3h"] ?? 0,
      icon: conditionEmoji(condition),
    };
  } catch (e) {
    console.warn(`[weather] ${homeTeam}:`, e);
    return null;
  }
}
