# Family portfolio dashboard

The whole site is one file: `index.html`. It holds the page (HTML), the styling (CSS) and the logic (JavaScript). There is nothing to install and nothing to build. Double-click `index.html` and it opens in your browser.

The site runs in one of two modes:

- **Demo** (the default): a made-up family, simulated prices, and anything you add stays in your own browser.
- **Live**: real prices from Yahoo Finance, a shared activity sheet, and a sign-in for each family member. It switches on when the two Supabase details in `SETTINGS` are filled in. **`SETUP.md` is the step-by-step checklist.**

## Files

| File | What it is |
|------|------------|
| `index.html` | The whole website |
| `SETUP.md` | How to switch on live mode |
| `activity-template.csv` | A starting point for the activity sheet |
| `supabase/schema.sql` | Creates the database tables (pasted into Supabase once) |
| `supabase/functions/prices/index.ts` | The price service that fetches from Yahoo Finance (pasted into Supabase once) |

## Day to day: no code needed

Everything is worked out from the activity sheet, one row per purchase or sale.

| Column   | Needed? | Notes                                              |
|----------|---------|----------------------------------------------------|
| Date     | Yes     | Day first (12/03/2024) or year-month-day (2024-03-12) |
| Symbol   | Yes     | Yahoo Finance ticker. London shares end in `.L`     |
| Quantity | Yes     | Number of shares or units                           |
| Price    | Yes     | Price paid per share, in pounds or dollars          |
| Type     | No      | Buy or Sell. Blank means Buy                        |
| Owner    | No      | Whose holding it is                                 |
| Account  | No      | ISA, SIPP, GIA, LISA, Junior ISA                    |
| Currency | No      | GBP, USD, or GBX if the price is in pence           |

To update the dashboard, add rows to your sheet and press **Import activity sheet**, or press **Add a transaction** for a single trade. `activity-template.csv` is a starting point.

## Editing the code yourself

### The quick way: on GitHub, in the browser

1. Open the repository on github.com and click `index.html`.
2. Click the pencil icon (Edit this file).
3. Make the change, then click **Commit changes**.
4. The host (Vercel, Netlify or GitHub Pages) republishes the site by itself within a minute or so.

Every commit is saved in the file's **History**, so any change can be undone by opening an older version and restoring it.

### The comfortable way: on your computer

1. Install [VS Code](https://code.visualstudio.com) (free) and [GitHub Desktop](https://desktop.github.com) (free).
2. In GitHub Desktop, clone the repository. Open the folder in VS Code.
3. Edit `index.html`, save, and refresh the page in your browser to see the result.
4. In GitHub Desktop, write a short note about the change, click **Commit**, then **Push**.

## Where things are in index.html

Search the file (Ctrl+F or Cmd+F) for these headings.

| To change...                                   | Search for                        |
|------------------------------------------------|-----------------------------------|
| Account types, risk cut-offs, refresh speed, the benchmark, the Supabase details | `SETTINGS` |
| Colours and fonts (light and dark themes)      | `:root{` at the top of the file   |
| The wording of every explanation (the *i* buttons and the Guide tab) | `const G={`   |
| The plain-English risk checks                  | `function flags`                  |
| Which headings the importer recognises         | `const COLS=`                     |
| How positions are built from transactions      | `function derive`                 |
| How the risk numbers are calculated            | `function analyse`                |
| What each tab shows                            | `const VIEWS={`                   |
| Tab names, card titles and other page text     | the HTML between `<body>` and `<script>` |
| The sample family and tickers (demo only)      | `const CAT=` and `const SAMPLE=`  |
| Sign-in, the shared database and Yahoo prices (live only) | `LIVE MODE`            |
| How Yahoo's descriptions become type, sector and region | `function describe`      |

### Examples

**Change when a holding is flagged as large.** In `SETTINGS`, change `largestWarn:.10` to `largestWarn:.15` to flag holdings above 15% instead of 10%.

**Add an account type.** In `SETTINGS`, add it to the list: `accounts:["ISA","SIPP","GIA","LISA","Junior ISA","Cash ISA"]`.

**Reword an explanation.** Find `const G={`. Each entry has a heading `h`, what it is `w`, how to read it `r` and an optional rule of thumb `k`. Edit the text between the quotes.

**Change the main colour.** Near the top, `--accent` and `--s1` set the blue. They appear three times (light theme, and the dark theme twice); change all three.

**Change the benchmark.** In `SETTINGS`, change `benchmark:{symbol:"VWRL.L",name:"..."}` to any Yahoo Finance symbol, for example `symbol:"^FTSE"` with `name:"FTSE 100"`.

**Teach the importer a new heading.** If your broker's export calls the price column "Deal price", add `"deal price"` (lower case) to the `price:` list in `const COLS=`.

## Tips

- Change one thing at a time and refresh. If the page goes blank, press F12 in the browser, open the **Console** tab and read the red line: it names the line number of the mistake.
- The most common mistakes are a missing comma between items in a list and a missing closing quote.
- Text inside quotes is safe to edit. Leave the punctuation around it alone.
- If you get stuck, undo the change from the file's History on GitHub.
- If you change `supabase/functions/prices/index.ts`, the change only takes effect once you paste the new version into the function in the Supabase dashboard and deploy it again.
