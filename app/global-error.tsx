"use client";

// #PRELAUNCH-AUDIT: error boundary globale. Senza questa, un'eccezione non gestita
// durante il render (es. una singola card con payload malformato) svuotava l'intera
// app in pagina bianca. Qui la contieni in una fallback UI con "Ricarica", senza
// toccare il monolite del board. Next.js richiede che global-error renda <html>/<body>.

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d1210",
          color: "#e7ede9",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#6d7d75", marginBottom: 14 }}>
            BetRedge
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 10px", lineHeight: 1.2 }}>
            Qualcosa non ha caricato correttamente.
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#93a49b", margin: "0 0 22px" }}>
            Riprova a caricare la pagina. Se il problema persiste, scrivici a info@betredge.com.
          </p>
          <button
            onClick={() => reset()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 22px",
              borderRadius: 10,
              border: "none",
              background: "#2ea043",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Ricarica
          </button>
        </div>
      </body>
    </html>
  );
}
