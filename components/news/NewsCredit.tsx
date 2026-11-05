"use client";
// components/news/NewsCredit.tsx — the photo credit under an emma card (author + licence, both linked when
// the watcher saved the links). It reads news-<hash>-e.credit.json beside the card; no file → nothing shown.
import { useEffect, useState } from "react";
import { emmaCreditUrl, parseCredit, type PhotoCredit } from "@/lib/news/per-note";

export function NewsCredit({ src, label = "Photo" }: { src: string; label?: string }) {
  const [credit, setCredit] = useState<PhotoCredit | null>(null);
  useEffect(() => {
    const u = emmaCreditUrl(src);
    if (!u) return;
    let live = true;
    fetch(u).then((r) => (r.ok ? r.json() : null)).then((j) => { if (live) setCredit(parseCredit(j)); }).catch(() => {});
    return () => { live = false; };
  }, [src]);
  if (!credit) return null;
  return (
    <p className="nw-credit">
      {label}: {credit.url ? <a href={credit.url} target="_blank" rel="noopener noreferrer">{credit.author}</a> : credit.author}
      {" · "}
      {credit.licenseUrl ? <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer">{credit.license}</a> : credit.license}
    </p>
  );
}
