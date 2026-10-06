# Redesign v3c · filone pages — chiavi nuove da tradurre in F10

**Fonti:** `lib/v3c/pages-copy.ts` (News · Books · Pro · Metodo · paywall) e `lib/v3c/community-copy.ts` (leaderboard · invite · community · cornice legale/profilo).
**Complete:** EN (fonte) e IT. **In fallback inglese:** es, fr, de, pt, nl, pl, tr, sv, ru (`PAGES_FALLBACK_TO_EN`).
Regole imposte da `lib/v3c/pages.test.ts`: ≤ 22 parole per stringa, lessico onesto (niente beat the market / ROI / CLV / hit rate / guaranteed / lock / sure win / easy money / crush), nessun piano «Base».
`()` = funzione con argomenti (numeri e prezzi arrivano dalle fonti, mai scritti nella copy) · `[n]` = lista di n coppie titolo/sottotitolo.

Per aggiungere una lingua: un oggetto `PagesCopy` / `CommunityCopy` nuovo, poi `pagesCopyFor` / `communityCopyFor` lo devono restituire e la lingua esce da `PAGES_FALLBACK_TO_EN`.

## pages-copy (125 chiavi)

### `pricing` (32)
tab · title · metaStrong() · metaRest · freeName · freeLede · proName · proLede · perMonth · perYear() · included · pro · notLive · free[4] · freeSoon[2] · proItems[5] · everythingFree · freeCta · proCta · railCard · railCardAnnual · railCrypto · railPaypal · railUsdt · withdrawal · promo() · sameStrong · same · anatomyTitle · anatomyLede · anatomyNever · fine

### `paywall` (10)
lab · title · lede · blend · open · closed · cta() · cancel · factorKinds[3] · example

### `news` (20)
tab · title · metaStrong() · metaRest · guide · read · minutes() · empty · emptySub · notesTitle · notesBody · notesNot · toolsTitle · toolsBody · toolsLink · boardLink · back · crumb · published · responsible

### `books` (32)
tab · title · metaStrong() · metaRest · connected · bestOn() · noBoard · bonusNone · bonusWhy · where · everywhere · onlyIn() · localLink() · goTo() · affiliate · moreTitle · moreSub · sportsbook · casino · visit · compareTitle · compareSub · compareMatch · compareBest · compareChecked() · compareNone · respTitle · respBody · blockedTitle · blockedBody · blockedBack · fine

### `method` (31)
tab · title · metaStrong · metaRest · more() · blocks.blend.{k,title,body,detail,market,model} · blocks.seal.{k,title,body,detail,label} · blocks.gap.{k,title,body,detail,market,estimate,gap} · blocks.not.{k,title,body,line,detail} · board · record · tools

## community-copy (87 chiavi)

### `lb` — leaderboard (22)
tab · title · metaStrong · metaRest · rank · player · points · record · sport · podium · yourRank · notListed · notOptedIn · loading · error · retry · emptyTitle · emptyHint · note · recordLink · pts() · unit

### `inv` — invite (39)
tab · title · metaStrong · metaRest · intro · codeLabel · placeholder · hint · claimBtn · claimBusy · errTaken · errInvalid · errGeneric · yourCode · linkLabel · copy · copied · signups · paying · kpiConv · kpiEarned · zeroState · statsErr · retry · pending · loading · friendGets() · rewardsTitle · progress() · progressDone() · tierAt() · rewardDays() · rewardRoom · nextUp() · note · promo · signInTitle · signInBody · signIn

### `cm` — community (20)
tab · title · metaStrong · metaRest · create · loading · loadError · retry · emptyTitle · emptySub · open · gateNoneTitle · gateNoneSub · gatePartial · seePlans · lockedLine · combined · legs() · responsible · locale

### `legal` (4) · `profile` (2)
legal.title · legal.privacyTab · legal.termsTab · legal.note · profile.tab · profile.title

## Non si traduce qui
- Testo di privacy/terms: invariato, solo inglese (la cornice lo dice).
- Prosa SEO + FAQ di /partners e /community (`app/*/seo.ts`): inglese, finisce nel FAQPage JSON-LD della URL canonical inglese.
- Articoli del blog: contenuto del DB.
