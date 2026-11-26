# Spec: P2, Pulse (26-Nov-2026)

P1 works but looks cheap, feels basic and doesn't tell the owner **what matters**. P2 turns Pulse into a fast,
polished market desk: fresh data, a clear sense of impact, real stock and forex prices, and a proper design.
All P1 rules still apply (free, no accounts, no API keys, no secrets, public repo, neutral, news with respect to
publishers, personal data stays on the device) unless this spec changes them.

## Owner's complaints (what P2 must fix)
1. **Too basic, looks cheap:** narrow column with empty sides on desktop, emoji icons, every card looks the same.
2. **No sense of impact:** nothing says which news matters, which asset it hits or how big it is.
3. **Not efficient, not set up:** data 8 hours old, no stocks (where are Nvidia and Apple?), no forex prices,
   junk at the top of Memes and Crypto, empty screens with no guidance.

## Build rules (read first)
1. **Plan before code.** Write `PLAN.md` from this spec: tasks in the order below, the files each task may touch and
   **one check per task** that proves it done. Show the plan, then build.
2. **Fail twice, park it.** If a task fails its check twice, stop, write what failed under **"Needs fixing"** in
   `PLAN.md` and move on.
3. **Diff check at the end.** List every change that is **not** required by this spec: file, what it does, and
   whether it changes existing behavior. The summary is your opinion; the diff is the fact.
4. **No commit, no push.** The owner tests and commits herself.
5. **Spend rules.** Every subagent gets a model set. Search, read and tagging work goes to a cheaper model. Don't
   start subagents for work this session can do.
6. **Never invent a number.** Every price shows its source and time; delayed data says "delayed". If a source
   lacks a field, leave it out; don't estimate it.
7. Keep the storage prefix `p1.` (or migrate it) so her saved items, read marks, lists and keywords survive.
8. Tests prefix `p2`, one command (`npm run p2`). P1 tests keep passing, or you list each one you changed and why.

## Parts, in order

### 0. Fix the stale data (first, before anything else)
The app showed "Updated 8 h ago" while `datos.yml` is scheduled every 15 minutes, so scheduled runs aren't happening
or are failing.
- Diagnose with `gh run list --workflow datos.yml` if `gh` is installed and signed in; otherwise ask the owner for a
  screenshot of the repo's **Actions** tab. Find out whether scheduled runs **fail** (fix the error) or **never
  start** (check the workflow is on `main`, the cron syntax, and GitHub's notes on delayed or skipped schedules).
- Report the cause in plain words. Don't guess a fix you can't verify.
- Whatever the cause, the app must never hide staleness (see part 2).

### 1. Design system and layout
- **Tokens** in one CSS block: colors, spacing scale (4/8/12/16/24/32), type scale, radii, borders. Keep the dark
  terminal look (near-black, thin lines, monospace numbers, neon green up / pink-red down, cyan selected) but give
  it hierarchy: surfaces at 2–3 depths, clear section headers, one accent per state.
- **Icons:** replace every emoji with one consistent line-icon set, stored locally as inline SVG (an MIT or ISC
  licensed set is fine; no CDN). Same stroke, same size.
- **Navigation:**
  - Phone: **5 tabs** with a solid background (nothing shows through): **Now · Markets · Memes · Calendar · More**.
    Markets has segments **Stocks / Crypto / Forex**. More holds **Saved, Posts (X lists), Settings, Sources**.
  - Desktop (≥ 1024 px): left nav rail instead of the bottom bar, **center** feed, **right rail** with the
    watchlist, next high-impact event countdown and a market snapshot. No big empty sides.
  - Tablet (768 px): feed plus a collapsible right rail.
- **Cards:** denser. A headline card shows impact, asset chips, source, time and title; the summary line only when
  expanded or on desktop. Phone fits at least 7 cards per screen at 390 px.
- **Ticker bar:** shorter, scrolls smoothly, nothing cut off mid-number. Tap an item to open it.
- Widths: 320, 390, 768, 1440 px, no sideways scroll, tap targets ≥ 44 px.

### 2. Freshness and source status (take-now #2)
- Every section shows **last checked** time. If data is older than **45 min**, show a calm banner (not red):
  "Data is X old. Last update: HH:MM". If a source failed, the section says which one and when it last worked.
- **Sources** screen (More → Sources): each source, OK or failing, last success time, item count, from `status.json`.
- An empty state is never a blank screen: it says why it's empty and what to do.

### 3. Stories and impact (take-now #1, the core of P2)
Built in the Action (`scripts/impact.mjs`, rules in `scripts/impact-rules.mjs` so they're easy to tune). No AI, no
paid API. Label shown in the app: **"Impact is estimated by rules."**
- **One card per story.** Group headlines about the same event (title similarity within 72 h). The card shows the
  first source plus "+N sources". Items that reappear later are marked **repeat** and never jump back to the top.
- **Asset chips:** map each story to assets with a dictionary: tickers and company names in the stock universe,
  coins, currencies, central banks (Fed → USD, ECB → EUR, Banxico → MXN…), indices.
- **Impact level: High / Medium / Low**, from:
  - keyword classes (High: rate decisions, CPI/PCE/jobs/GDP releases, tariffs and sanctions, bankruptcy or default,
    exchange hacks, ETF approval or denial, enforcement against a top asset, mega-cap earnings or guidance changes;
    Medium: other earnings, regulation proposals, analyst moves, macro commentary; Low: features, opinion, how-to),
  - a High event in the economic calendar within ±2 h,
  - number of sources covering it,
  - **observed price reaction** (see below).
- **Reaction, not prediction.** Pulse never predicts direction from the text. It shows what actually happened:
  "BTC +1.4% since this headline", from the Action's own price snapshots (part 4). If there's no data, show nothing.
- **"Why it matters":** one templated line per rule ("Tariff news: usually moves USD, MXN and stock indices").
  Neutral wording, never buy or sell.
- **Ranking:** impact × recency, + sources, + boost if it touches her watchlist or keywords (computed on the device,
  so nothing personal leaves it). Toggle: **Top / Latest**.

### 4. Stocks (the big gap)
- The Action fetches quotes for a fixed **universe** in `config.js`: mega caps (NVDA, AAPL, MSFT, AMZN, GOOGL, META,
  TSLA…), the largest S&P 500 names, popular names (AMD, PLTR, COIN, MSTR…), major ETFs (SPY, QQQ, DIA, IWM) and
  Mexican stocks if the source returns them. Use the CNBC quote service already in P1; batch symbols; verify each
  with `p2:fuentes`.
- **Snapshots:** each run stores compact price points (universe + BTC/ETH/SOL + FX pairs) and carries them through
  `--prev`, about 5 trading days at 15-min resolution. These power sparklines and price reactions.
- **Markets → Stocks:** index row, **top gainers / losers** from the universe, sector moves if the data allows, and
  **her watchlist** (stored on the device, starts with NVDA, AAPL, MSFT, TSLA, SPY, QQQ).
- **Search any ticker or company in the universe.** If it's not tracked: "Not tracked yet (add it to the universe
  in `config.js`)."
- **Stock detail:** price, % change, sparkline from snapshots, delayed label, news about that company, next earnings
  date **only if the source provides it**, links out to the company's page on CNBC and a TradingView chart.

### 5. Markets fixes
- **Forex:** a **pairs table** (EUR/USD, GBP/USD, USD/JPY, USD/MXN, AUD/USD, USD/CAD, USD/CHF, EUR/JPY, CAD/JPY,
  plus DXY, US 10Y, gold and oil if the source returns them) with sparklines. The "no high-impact events" message
  becomes a neutral info line, not a red error box.
- **Calendar** (own tab): impact filter chips (High / Medium / Low), countdown to the next High event, today first,
  her time zone. Show "actual" when the source provides it.
- **Crypto:** hide stablecoins and tokenized non-crypto assets (USDT, USDC, FIGR_HELOC…): a deny list plus a
  "price ≈ $1 and flat" rule. Add total market cap, BTC dominance and Fear & Greed **if** those sources pass the
  check (CoinGecko global, alternative.me), with sparklines from CoinGecko.
- **Memes:** default sort **volume**, default filters **liquidity ≥ $10k and age ≥ 1 h** (editable). "New launches"
  stays available but shows a one-line warning. Compact rows instead of big cards. Promoted stays labeled
  "Promoted".
- **Posts:** a first-run guide ("how to add an X list in 3 steps") plus **cashtag links** for her watchlist (opens X
  search for `$NVDA` etc.: links only, no X data fetched).

### 6. Language
EN / ES switch in Settings, instant, no reload. **First open: English.** Every label in both languages; headlines
stay in their original language. Number and date formats follow the chosen language.

### 7. Now screen (default tab)
Top to bottom: **Top 3 right now** (highest-ranked stories), **next High event** with countdown, **watchlist
movers**, then the story feed (Top / Latest). On desktop, the right rail repeats watchlist and calendar.

### 8. Live Map (polish, last)
A toggle on Now: stories as glowing nodes clustered around the assets they touch; node size = impact; tap a node to
open the story. Canvas, 60 fps on desktop, falls back to the list on low-end phones and respects reduced motion.
If it costs performance budget, ship it desktop-only.

## Tests (`p2`, one command, fixtures offline)
1. Stale data shows the banner; a failing source shows on its section and on Sources.
2. Story grouping: duplicates across sources become one card with "+N"; a reappearing story is marked repeat.
3. Impact rules: fixture headlines get the expected level and asset chips (a table of at least 30 cases).
4. Reactions come only from snapshots; with no snapshot, nothing is shown. No text predicts direction or says buy/sell.
5. Stocks: universe quotes parse; gainers/losers are correct; search finds by ticker and name; untracked symbol
   shows the right message; watchlist stays on the device (no request contains it).
6. Crypto hides stablecoins; Memes default filters apply; promoted is never "trending".
7. EN/ES complete (no missing keys); 320/390/768/1440 px with nothing off-screen; tap targets ≥ 44 px; the tab bar is
   opaque; no emoji left in the UI.
8. Speed: open < 2 s, tab switch < 150 ms with 4× CPU slowdown; Live Map doesn't drop the list below that.

## Delivery
After each part, run the tests. At the end send **one summary**: the stale-data cause and fix, sources kept and
dropped (and why), what's under "Needs fixing", the **diff check list**, and screenshots at 390 and 1440 px in
`capturas/`. **Don't commit.** Pushing is hers, and never between 5:30 and 9:30 Mexico City time.
