"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const METHOD_OPTIONS = [
  { value: "bank_transfer", label: "Bonifico Bancario" },
  { value: "usdt", label: "USDT (Crypto)" },
  { value: "cash", label: "Contanti" },
];

export default function DepositModal({ open, onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Inserisci un importo valido");
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("deposits").insert({
      user_id: user.id,
      amount: parsedAmount,
      method,
      notes: notes || null,
      status: "pending",
    });

    if (error) {
      toast.error("Errore: " + error.message);
      setLoading(false);
      return;
    }

    toast.success("Richiesta di deposito inviata — in attesa di approvazione");
    setAmount("");
    setMethod("bank_transfer");
    setNotes("");
    setLoading(false);
    onSuccess();
    onClose();
  }

  const inputStyle = {
    background: "var(--am-panel-2)",
    border: "1px solid var(--am-line-2)",
    borderRadius: 8,
    color: "var(--am-text)",
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
    width: "100%",
    transition: "border-color 0.15s",
  } as React.CSSProperties;

  const labelStyle = {
    color: "var(--am-muted)",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    display: "block",
    marginBottom: 6,
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        style={{
          background: "var(--am-panel)",
          border: "1px solid var(--am-line-2)",
          borderRadius: 12,
          maxWidth: 420,
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "var(--am-text)", fontWeight: 700 }}>
            Nuovo Deposito
          </DialogTitle>
          <DialogDescription style={{ color: "var(--am-muted)", fontSize: 13 }}>
            La richiesta verra&apos; approvata manualmente entro 24h.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div>
            <label style={labelStyle}>Importo (€)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500.00"
              required
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--am-green)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--am-line-2)")}
            />
          </div>

          <div>
            <label style={labelStyle}>Metodo</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--am-green)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--am-line-2)")}
            >
              {METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Note (opzionale)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Es. IBAN di origine, riferimento transazione..."
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
                fontFamily: "inherit",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--am-green)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--am-line-2)")}
            />
          </div>

          {/* Info box */}
          <div
            style={{
              background: "rgba(0,255,136,0.06)",
              border: "1px solid rgba(0,255,136,0.15)",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 12,
              color: "var(--am-muted)",
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "var(--am-green)", display: "block", marginBottom: 3 }}>
              Come funziona
            </strong>
            Dopo l&apos;invio, il team verifichera&apos; il pagamento e approveranno il deposito.
            Riceverai una conferma via email.
          </div>

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 8,
                border: "1px solid var(--am-line-2)",
                background: "transparent",
                color: "var(--am-muted)",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 8,
                border: "none",
                background: loading ? "rgba(0,255,136,0.4)" : "var(--am-green)",
                color: "#0a0a0a",
                fontWeight: 700,
                fontSize: 13,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Invio..." : "Invia Richiesta"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
