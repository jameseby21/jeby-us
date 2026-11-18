# Copy ledger: jeby.us

**Every line a reader sees on the ledger pages has a row here: the text, who wrote it, the command it came from, and its state.** Owner: the jeby-us project session; written for JEBYUS-0084 on 2026-11-17 under the copy skill. James's lines move only on his word; a change to any row is a before-and-after table on its ticket, never a restore of an older version.

Pages: index, about, lab, research, qr, cooking, cooking-brisket-smoked, cooking-brisket-al-horno, real-estate, random

## How it is kept true

- `python _src/build.py` then `python _src/check_copy.py`: fails on a visible line with no row (`unlisted:`) and on a row whose text is gone from its page (`stale:`); `--missing` prints a row to fill for each unlisted line. What counts as a line is in the script's docstring.
- Page `all` is the header and the footer, and must appear on every ledger page. A text ending in "…" is the start of a long block.
- Add a row in the same change that adds a line; update **Who**, **Command** and **State** when James gives his word, with the date.

## What the columns mean

- **Who**: James (his own words), drafted for James (a worker or Patch wrote it on his ask), Chaz (the creative coworker's copy pass), or no record.
- **Command**: the ticket, commit and date the line came from, with his words when it was his ask. For rows not marked as owner lines, the commit is the newest one that added the text (`git log -S`, run by a script on 2026-11-17, with short labels placed by hand); owner lines were checked by hand against the tickets.
- **State**: owner-written (his words), owner-approved (someone else's draft that his recorded word asks for or accepts), draft awaiting his word (no recorded word from him on this line).

## Findings (2026-11-17)

- **431 rows: 20 owner-written, 9 owner-approved, 402 draft awaiting his word; 0 with no record of a source.** Every line traces to a commit and almost all to a ticket; what is missing for 402 lines is his word, not a source.
- **The hero eyebrow and the footer line were Chaz's drafts, not his 2026-11-12 commands.** Both came from b46c863 (JEBYUS-0033, 2026-11-08) and went live on 2026-11-13 under decision 114; no 2026-11-12 commit touched them. PR 22 changed both without his word; PR 24 put both back. Both are Y/N questions for him (JEBYUS-0084).
- **"Big Green Egg" left the recipe title (decision 156, James 2026-11-17, JEBYUS-0087).** The recipe is titled "Smoked brisket" on Cooking, the recipe page and Random, per his 2026-11-12 point 8.5. The equipment line inside the recipe may still name the cooker.
- **Not covered by the check:** text drawn by JavaScript (the research slideshow, the family strip from family.js), image alt text, page titles and meta descriptions, the Professional and Teach pages (not ledger pages yet).

### Header and footer (every page)

| # | Page | Text | Who | Command | State |
| --- | --- | --- | --- | --- | --- |
| 1 | all | Open-Source Software | James | JEBYUS-0083, 2026-11-17: "The others should be: 1. Open-Source Software 2. Astrophysics 3. Cooking 4. Real Estate 5. Random (random page)" | owner-written |
| 2 | all | Astrophysics | James | JEBYUS-0083, 2026-11-17: "The others should be: 1. Open-Source Software 2. Astrophysics 3. Cooking 4. Real Estate 5. Random (random page)" | owner-written |
| 3 | all | Cooking | James | JEBYUS-0083, 2026-11-17: "The others should be: 1. Open-Source Software 2. Astrophysics 3. Cooking 4. Real Estate 5. Random (random page)" | owner-written |
| 4 | all | Real Estate | James | JEBYUS-0083, 2026-11-17: "The others should be: 1. Open-Source Software 2. Astrophysics 3. Cooking 4. Real Estate 5. Random (random page)" | owner-written |
| 5 | all | Random | James | JEBYUS-0083, 2026-11-17: "The others should be: 1. Open-Source Software 2. Astrophysics 3. Cooking 4. Real Estate 5. Random (random page)" | owner-written |
| 6 | all | Insights | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 7 | all | JA Insights ↗ | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 8 | all | Home | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 9 | all | About | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 10 | all | Professional | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 11 | all | Teach | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 12 | all | No trackers and no pop-ups. Just pages. | Chaz | JEBYUS-0033, b46c863, 2026-11-08; replaced by PR 22 (498e6bf) without his word; put back by JEBYUS-0084 (PR 24, 953212d), 2026-11-17; Y/N asked | draft awaiting his word |
| 13 | all | © 2026 James Eby · Miami, FL | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 14 | all | Site | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 15 | all | Free | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 16 | all | Data report | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 17 | all | Image to QR code | drafted for James | JEBYUS-0073, 6d61e4d, 2026-11-12 | draft awaiting his word |
| 18 | all | Lab projects | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 19 | all | Elsewhere | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 20 | all | Instagram | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 21 | all | LinkedIn | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 22 | all | GitHub | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 23 | all | Email | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 24 | all | Family | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 25 | all | JA Insights · data consulting | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 26 | all | jebyLabs · projects | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 27 | all | jeby Real Estate | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 28 | all | jeby Industries | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |

### Home (index.html)

| # | Page | Text | Who | Command | State |
| --- | --- | --- | --- | --- | --- |
| 29 | index | Miami, FL | Chaz | hero eyebrow: JEBYUS-0033, b46c863, 2026-11-08; changed by PR 22 (498e6bf) without his word; put back by JEBYUS-0084 (PR 24, 953212d), 2026-11-17; Y/N asked | draft awaiting his word |
| 30 | index | Miami, FL | drafted for James | the Based fact: JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 31 | index | Interdisciplinary problem-solver | James | JEBYUS-0082, 2026-11-17: "'Interdisciplinary Problem Solver' back on my main site"; first in 6a9d762, removed by b46c863, back in 498e6bf (PR 22) | owner-written |
| 32 | index | Open-Source Software | James | JEBYUS-0083, 2026-11-17: "The others should be: 1. Open-Source Software 2. Astrophysics 3. Cooking 4. Real Estate 5. Random (random page)" | owner-written |
| 33 | index | Astrophysics | James | JEBYUS-0083, 2026-11-17: "The others should be: 1. Open-Source Software 2. Astrophysics 3. Cooking 4. Real Estate 5. Random (random page)" | owner-written |
| 34 | index | Cooking | James | JEBYUS-0083, 2026-11-17: "The others should be: 1. Open-Source Software 2. Astrophysics 3. Cooking 4. Real Estate 5. Random (random page)" | owner-written |
| 35 | index | Real Estate | James | JEBYUS-0083, 2026-11-17: "The others should be: 1. Open-Source Software 2. Astrophysics 3. Cooking 4. Real Estate 5. Random (random page)" | owner-written |
| 36 | index | Random | James | JEBYUS-0083, 2026-11-17: "The others should be: 1. Open-Source Software 2. Astrophysics 3. Cooking 4. Real Estate 5. Random (random page)" | owner-written |
| 37 | index | Super serious about my silliness. | James | JEBYUS-0071, f295317, 2026-11-12: "'Super serious about my silliness' is good enough for now."; kept on his choice (JEBYUS-0075 addendum) | owner-written |
| 38 | index | Work: Professional · JA Insights · Teach | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 39 | index | ● Free things | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 40 | index | A one-page report on your data | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 41 | index | Drop in a spreadsheet. It never leaves your browser. | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 42 | index | Turn your image into a QR code | James | JEBYUS-0075 addendum, cd08227, 2026-11-12: his wording | owner-written |
| 43 | index | A prompt that asks your chat AI to blend your image into a QR code and test it. Drew was the first. | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 44 | index | 14 projects | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 45 | index | Each says if it is live, in build or an idea. | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 46 | index | Photo: jenniferglezphotography.com | drafted for James | JEBYUS-0082, 498e6bf, 2026-11-17: "with a photo cred for jenniferglezphotography.com on my photo with Drew" | owner-approved |
| 47 | index | About | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 48 | index | Hi, I'm James. | Chaz | b46c863 (JEBYUS-0033), 2026-11-08; the same words he gave as his opening in JEBYUS-0072, 2026-11-12 | owner-approved |
| 49 | index | I live in Miami with Drew. I studied statistics at Carnegie Mellon, and I have more side projects than free evenings. | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 50 | index | Based | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 51 | index | Studied | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 52 | index | B.S. Statistics, Carnegie Mellon, 2019 | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 53 | index | Off the clock | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 54 | index | Machining, golf, SCUBA, archery, kayaking with Drew, and brisket | drafted for James | JEBYUS-0071, f295317, 2026-11-12 | draft awaiting his word |
| 55 | index | More about me | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 56 | index | Scottish Terrier | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 57 | index | Drew | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 58 | index | He's on my business cards, my QR codes and half my projects. Nobody asked him. | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 59 | index | Work | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 60 | index | Kept on its own pages. | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 61 | index | Professional Experience and résumé | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 62 | index | JA Insights Data consulting | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 63 | index | Teach Tutoring and mentorship | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 64 | index | Lab | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 65 | index | Things I build in my spare time | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 66 | index | A real-estate database, a band game, keyboard lighting, a houseplant that heckles people. A few are live; the rest are in build or still ideas. | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 67 | index | All 14 projects | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 68 | index | Research · Carnegie Mellon, 2015 | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 69 | index | Weighing galaxy clusters by how their galaxies move | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 70 | index | My undergraduate poster, rebuilt so the figures move. The short version: the standard calibration counted each cluster about ten times. | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 71 | index | Open the slideshow | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 72 | index | November 2026 | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 73 | index | Now | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 74 | index | Research Picking the galaxy-cluster work back up, ten years after the poster, to see if it holds. | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 75 | index | Building A band game that turns any song into a chart you can actually play. | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 76 | index | Teaching Taking on math, statistics and data students again. | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 77 | index | Work Looking for my next BI leadership role. | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |

### About

| # | Page | Text | Who | Command | State |
| --- | --- | --- | --- | --- | --- |
| 78 | about | About | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 79 | about | Hi, I'm James. | James | JEBYUS-0072, 45d0306, 2026-11-12: his suggested opening | owner-written |
| 80 | about | I live in Miami with Drew, a Scottish Terrier who appears on more of my projects than I do. | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 81 | about | I studied statistics at Carnegie Mellon University with a concentration in computer science, I am a senior BI manager, and I'm drawn to difficult problems. | James | JEBYUS-0072, 45d0306, 2026-11-12: his own draft of the facts line; restored in cd08227 after the voice pass replaced it | owner-written |
| 82 | about | Away from the keyboard I like things that can't be rushed: machining, golf, diving, archery, kayaking with Drew, and brisket, which is twelve hours of patience for twenty minutes of dinner. | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 83 | about | Work lives on other pages: Professional, JA Insights and Teach. | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 84 | about | Based | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 85 | about | Miami, FL | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 86 | about | Studied | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 87 | about | B.S. Statistics, Carnegie Mellon, 2019 | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 88 | about | Off the clock | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 89 | about | Machining, golf, SCUBA, archery, kayaking with Drew, and brisket | drafted for James | JEBYUS-0071, f295317, 2026-11-12 | draft awaiting his word |
| 90 | about | @jeby_d on Instagram | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 91 | about | Drew and me. Photo: jenniferglezphotography.com | drafted for James | "Drew and me." from 6a9d762, 2026-11-08; the credit is his ask, JEBYUS-0082, 498e6bf, 2026-11-17 | draft awaiting his word |
| 92 | about | Scottish Terrier | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 93 | about | Photo: jenniferglezphotography.com | drafted for James | JEBYUS-0082, 498e6bf, 2026-11-17: "with a photo cred for jenniferglezphotography.com on my photo with Drew" | owner-approved |
| 94 | about | Drew | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 95 | about | He's on my business cards, my QR codes and half my projects. Nobody asked him. | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 96 | about | The story so far | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 97 | about | How I got here. | drafted for James | JEBYUS-0072, 45d0306, 2026-11-12: "strictly personal" | draft awaiting his word |
| 98 | about | The short version, in five parts. | drafted for James | JEBYUS-0072, 45d0306, 2026-11-12: "strictly personal" | draft awaiting his word |
| 99 | about | High school | drafted for James | JEBYUS-0072, 45d0306, 2026-11-12: "strictly personal" | draft awaiting his word |
| 100 | about | The math club | drafted for James | JEBYUS-0072, 45d0306, 2026-11-12: "strictly personal" | draft awaiting his word |
| 101 | about | It started with the math club. In 2013 I took sixth place in statistics at the Mu Alpha Theta national convention. | drafted for James | JEBYUS-0072, 45d0306, 2026-11-12: "strictly personal" | draft awaiting his word |
| 102 | about | 2015 – 2019 | drafted for James | JEBYUS-0072, 45d0306, 2026-11-12: "strictly personal" | draft awaiting his word |
| 103 | about | Carnegie Mellon | drafted for James | JEBYUS-0072, 45d0306, 2026-11-12: "strictly personal" | draft awaiting his word |
| 104 | about | I studied statistics, with a concentration in computer science. My undergraduate research asked whether the usual way of… | drafted for James | JEBYUS-0072, 45d0306, 2026-11-12: "strictly personal" | draft awaiting his word |
| 105 | about | 2019 – 2025 | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 106 | about | Work | drafted for James | JEBYUS-0072, 45d0306, 2026-11-12: "strictly personal" | draft awaiting his word |
| 107 | about | Six years in business intelligence, the last of them leading analytics at a startup. The details are on the Professional page. | drafted for James | JEBYUS-0072, 45d0306, 2026-11-12: "strictly personal" | draft awaiting his word |
| 108 | about | 2025 | drafted for James | JEBYUS-0072, 45d0306, 2026-11-12: "strictly personal" | draft awaiting his word |
| 109 | about | Then my health stepped in | drafted for James | 6a9d762, 2026-11-08; JEBYUS-0072, 2026-11-12: "I love the transition portion of 'Then my health stepped in'" | owner-approved |
| 110 | about | In 2025 the startup ran out of money while I was in the hospital, and the job went with it. | drafted for James | JEBYUS-0072, 45d0306, 2026-11-12: "strictly personal" | draft awaiting his word |
| 111 | about | I had open-heart surgery. | drafted for James | JEBYUS-0072, 45d0306, 2026-11-12: his word on this line, About page only | owner-approved |
| 112 | about | I couldn't choose that part. I could choose what to do with the time I had. | drafted for James | 6a9d762, 2026-11-08; JEBYUS-0075 addendum, 2026-11-12: he chose to keep it | owner-approved |
| 113 | about | Since then | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 114 | about | I kept building | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 115 | about | I build things in my spare time: a real-estate database, a learning library, keyboard lighting software, a band game, an… | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 116 | about | Contact | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 117 | about | Email is the fastest way to reach me. | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 118 | about | jeby@jainsights.com | drafted for James | 0adff7c, 2026-11-08: brand marks pass (JEBYUS-0049) | draft awaiting his word |
| 119 | about | Copy email | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 120 | about | LinkedIn | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 121 | about | Instagram | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 122 | about | GitHub | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |

### Lab (nav: Open-Source Software)

| # | Page | Text | Who | Command | State |
| --- | --- | --- | --- | --- | --- |
| 123 | lab | Lab | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 124 | lab | The Lab. | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 125 | lab | 14 projects across data, games, hardware and tools. Each row says where it stands: live, preview, in build or idea. A fr… | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 126 | lab | All code on GitHub | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 127 | lab | Data and analytics · 4 | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 128 | lab | jRE In build | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 129 | lab | Miami real-estate analytics where every number shows its source. | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 130 | lab | A property database for Miami Springs and Virginia Gardens built around each lot's full history: owners, sales, features and valuations over time, with a review queue for records that look wrong. | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 131 | lab | Free version, planned | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 132 | lab | Schema, app scaffold, synthetic-data generator, review workflow and data-intake framework | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 133 | lab | Paid version, planned | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 134 | lab | Curated South Florida data, valuation and comparable-homes engines, market scores, advisory | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 135 | lab | Code private | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 136 | lab | Paid plan at JA Insights | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 137 | lab | learningLabs In build | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 138 | lab | A learning library. First up: a data analysis course, with fraud detection as one of its case studies. | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 139 | lab | The data analysis course is in progress, in Python, R, Power BI and Excel. Its fraud-detection case study comes with a l… | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 140 | lab | Courses, case library, the game and all original data (GPL-3.0 and CC0) | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 141 | lab | A hosted workspace for the course's investigations, and team training through JA Insights | drafted for James | 56bfcdf, 2026-11-08: "learningLabs has a data analysis course and one case study is fraud detection" | draft awaiting his word |
| 142 | lab | Code | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 143 | lab | Galaxy-cluster masses In build | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 144 | lab | Weighing galaxy clusters by how their galaxies move, revisited ten years on. | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 145 | lab | The 2015 Carnegie Mellon poster, rebuilt as an animated slideshow, and a new public repository for the follow-up work. | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 146 | lab | Everything: code, figures and data cards | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 147 | lab | No paid version planned | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 148 | lab | Open | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 149 | lab | Cell-count pipeline Preview | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 150 | lab | CSV to a normalized database to a dashboard, in one command. | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 151 | lab | Loads 52,500 measurements from 10,500 samples into a normalized SQLite schema, then summarizes them in tables, plots and a Streamlit dashboard. Written as a take-home exercise. | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 152 | lab | Free · jebyLabs | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 153 | lab | Shared on request | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 154 | lab | For small businesses · 2 | drafted for James | 19a8b10, 2026-11-08: he asked for the three missing projects | draft awaiting his word |
| 155 | lab | Route optimizer Idea | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 156 | lab | Route planning for businesses whose day is a list of stops. | drafted for James | 19a8b10, 2026-11-08: he asked for the three missing projects | draft awaiting his word |
| 157 | lab | Put in the day's stops and get a sensible order to drive them in, without a routing subscription. Not built yet; this is the brief. Meant for small route-based businesses, through JA Insights. | drafted for James | 19a8b10, 2026-11-08: he asked for the three missing projects | draft awaiting his word |
| 158 | lab | Planned as a free tool | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 159 | lab | Driver tracking Idea | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 160 | lab | Driver tracking for small businesses with several drivers and no software budget. | drafted for James | 19a8b10, 2026-11-08: he asked for the three missing projects | draft awaiting his word |
| 161 | lab | Where each driver is and what's done, for a team of a few drivers rather than a fleet department. Not built yet; this is the brief. Meant to go through JA Insights. | drafted for James | 19a8b10, 2026-11-08: he asked for the three missing projects | draft awaiting his word |
| 162 | lab | For dogs and their people · 1 | drafted for James | 19a8b10, 2026-11-08: he asked for the three missing projects | draft awaiting his word |
| 163 | lab | Dog territory app Idea | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 164 | lab | A dog game for walks: claim territory, leave scent marks, keep dogs safe. Working name. | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 165 | lab | Walks claim ground on a hex map and scent marks become a game between dogs on the same streets. The idea includes a lost-pet kit and reactive-dog warnings. Nothing is built yet. | drafted for James | 19a8b10, 2026-11-08: he asked for the three missing projects | draft awaiting his word |
| 166 | lab | Planned as a free app | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 167 | lab | Games and music · 1 | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 168 | lab | MusicalGames In build | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 169 | lab | A full-band rhythm game with karaoke, real guitars and keyboards, and charts made from audio. | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 170 | lab | One app for full-band rhythm games, karaoke with pitch scoring, a Guitar Room for real instruments, and a party mode whe… | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 171 | lab | Planned: chart generation from your own audio, karaoke and party mode | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 172 | lab | Planned: a one-time purchase | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 173 | lab | Hardware · 1 | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 174 | lab | Plantriloquist In build | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 175 | lab | A Raspberry Pi hidden in a plant pot that listens and roasts your friends. | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 176 | lab | A provider-neutral talking-character engine: speech recognition, a comedy engine and neural voices, with a simulator and a control panel. First character: Potty Mouth. | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 177 | lab | Character engine, simulator, control panel and offline voice path (on the bench) | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 178 | lab | Character and voice packs, hosted AI responses, a ready-made hardware kit | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 179 | lab | Tools and software · 5 | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 180 | lab | Desk Preview | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 181 | lab | A ticket system where nothing closes without proof. | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 182 | lab | One ticketing system for every project, personal and professional. Tickets are Markdown files in git. Done means evidenc… | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 183 | lab | The CLI, the Markdown ticket format, the local web app and the lesson library, self-hosted | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 184 | lab | Hosted sync across machines, AI-agent seats, lessons matched across projects, and proof captured from CI | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 185 | lab | Lighting Lab Preview | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 186 | lab | A keyboard lighting editor: anchors, backgrounds and reactions, layered. | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 187 | lab | A keyboard RGB editor with a preset gallery, a physical keyboard preview, live Razer Chroma control and exportable presets. 12 presets. | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 188 | lab | Editor, presets, preview and JSON export (GPL-3.0) | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 189 | lab | A Windows player, keyboard firmware export and app-based profiles | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 190 | lab | Quorum Idea | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 191 | lab | Group payments where everyone's in, or nobody's charged. Working name. | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 192 | lab | The idea: each member's card is held for their share, and charged only if enough people commit by the deadline, so nobody fronts the money. A written spec, nothing built. | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 193 | lab | Planned: the commitment engine (Apache-2.0) | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 194 | lab | Planned: a hosted app | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 195 | lab | AppForge In build | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 196 | lab | An app that makes apps: every defect becomes a case, a rule and a test. | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 197 | lab | The method behind how I build with AI coding agents. jRE and Plantriloquist were built with it. It is not packaged as a product. | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 198 | lab | The method and its reusable skills | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 199 | lab | Setup and coaching for teams, through JA Insights | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 200 | lab | jeby.us Live | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 201 | lab | This site: plain HTML, no framework, no trackers. | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 202 | lab | Static pages generated from one content file, with native page transitions and no tracking. | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 203 | lab | Everything | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |

### Research (nav: Astrophysics)

| # | Page | Text | Who | Command | State |
| --- | --- | --- | --- | --- | --- |
| 204 | research | Research · Carnegie Mellon University, 2015 | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 205 | research | Predicting the masses of galaxy clusters. | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 206 | research | My 2015 undergraduate poster at Carnegie Mellon, rebuilt so the figures move. The short version: the standard calibratio… | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 207 | research | James Eby · Carnegie Mellon University, Department of Statistics · Advisor: Peter Freeman · 2015 · The original poster (PDF) · Use the arrow keys or swipe to move between slides. | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |

### QR prompt

| # | Page | Text | Who | Command | State |
| --- | --- | --- | --- | --- | --- |
| 208 | qr | Free prompt | drafted for James | JEBYUS-0073, 6d61e4d, 2026-11-12 | draft awaiting his word |
| 209 | qr | Turn your image into a QR code. | James | JEBYUS-0075 addendum, cd08227, 2026-11-12: his wording | owner-written |
| 210 | qr | A pet, a logo, a painting, a photo of your street. The first AI-made versions I tried looked right and didn't scan. This… | drafted for James | JEBYUS-0073, 6d61e4d, 2026-11-12 | draft awaiting his word |
| 211 | qr | Copy the prompt | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 212 | qr | Follow @jeby_d | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 213 | qr | The first one: Drew. | drafted for James | JEBYUS-0073, 6d61e4d, 2026-11-12 | draft awaiting his word |
| 214 | qr | The prompt | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 215 | qr | Copy | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 216 | qr | Make me a QR code with my image blended in, and do all of it yourself here in this chat. Don't send me setup steps, and… | drafted for James | JEBYUS-0073, 6d61e4d, 2026-11-12 | draft awaiting his word |
| 217 | qr | Paste it into your chat assistant, attach your image and swap in your link. Why code: an image model draws something that looks like a QR code. Code builds one that is one, then checks it. | drafted for James | JEBYUS-0073, 6d61e4d, 2026-11-12 | draft awaiting his word |
| 218 | qr | Will it work in my AI? | drafted for James | JEBYUS-0073, 6d61e4d, 2026-11-12 | draft awaiting his word |
| 219 | qr | It needs an assistant that can run code inside the chat. Several of the big ones can, usually on a paid plan or with a setting switched on; check yours. | drafted for James | JEBYUS-0073, 6d61e4d, 2026-11-12 | draft awaiting his word |
| 220 | qr | An assistant that can only chat or draw may still try. It will probably give you something that looks like a QR code and… | drafted for James | JEBYUS-0073, 6d61e4d, 2026-11-12 | draft awaiting his word |
| 221 | qr | Nothing here is promised to scan. Point your phone at the result before you print it, and say what happened if it didn't. | drafted for James | JEBYUS-0073, 6d61e4d, 2026-11-12 | draft awaiting his word |
| 222 | qr | ● More free things | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 223 | qr | A one-page report on your data | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 224 | qr | Drop in a spreadsheet. It never leaves your browser. | Chaz | JEBYUS-0033 copy pass, b46c863, 2026-11-08; live 2026-11-13 (PR 12, decision 114) | draft awaiting his word |
| 225 | qr | Turn your image into a QR code | James | JEBYUS-0075 addendum, cd08227, 2026-11-12: his wording | owner-written |
| 226 | qr | A prompt that asks your chat AI to blend your image into a QR code and test it. Drew was the first. | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |
| 227 | qr | 14 projects | drafted for James | JEBYUS-0001 redesign, 6a9d762, 2026-11-08; live via 2b53105 (he approved the redesign going live, not line by line) | draft awaiting his word |
| 228 | qr | Each says if it is live, in build or an idea. | drafted for James | JEBYUS-0075, 865cfd1, 2026-11-12: "Make sure I'm not overpromising" | draft awaiting his word |

### Cooking

| # | Page | Text | Who | Command | State |
| --- | --- | --- | --- | --- | --- |
| 229 | cooking | Cooking | James | JEBYUS-0083, 2026-11-17: "The others should be: 1. Open-Source Software 2. Astrophysics 3. Cooking 4. Real Estate 5. Random (random page)" | owner-written |
| 230 | cooking | Cooking. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 231 | cooking | Recipes I've cooked, step by step. Where a step goes by the probe or by feel, that comes first and the clock is only an estimate. Every source is credited. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 232 | cooking | Brisket | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 233 | cooking | The same cut, two completely different dishes. Pick by how much time you have and what equipment you own. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 234 | cooking | Brisket · Smoked | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 235 | cooking | Smoked brisket | drafted for James | decision 156, James 2026-11-17: his 2026-11-12 point 8.5 (no Big Green Egg on the personal pages) applied to the recipe title; was JEBYUS-0083, aaf2169 | owner-approved |
| 236 | cooking | Low and slow on the smoker. Twelve hours of patience for twenty minutes of dinner. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 237 | cooking | Open | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 238 | cooking | Brisket · Oven-braised | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 239 | cooking | Brisket al horno | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 240 | cooking | Braised in stock and tomato in a covered pot. About four hours start to finish, no smoker, no fire management. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |

### Recipe: smoked brisket

| # | Page | Text | Who | Command | State |
| --- | --- | --- | --- | --- | --- |
| 241 | cooking-brisket-smoked | Cooking · Brisket · Smoked | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 242 | cooking-brisket-smoked | Smoked brisket | drafted for James | decision 156, James 2026-11-17: his 2026-11-12 point 8.5 (no Big Green Egg on the personal pages) applied to the recipe title; was JEBYUS-0083, aaf2169 | owner-approved |
| 243 | cooking-brisket-smoked | About 10 lb, overnight brine, roughly fourteen hours on the Egg. Twelve hours of patience for twenty minutes of dinner. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 244 | cooking-brisket-smoked | Makes 12 servings. A 10 lb packer loses roughly 40% to trim and rendering. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 245 | cooking-brisket-smoked | Ingredients | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 246 | cooking-brisket-smoked | 10 lb Whole packer brisket | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 247 | cooking-brisket-smoked | 11 g Kosher salt, per pound of trimmed weight, 10–12 g Or: Any coarse salt. Table salt at roughly half the volume — finer crystals pack tighter | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 248 | cooking-brisket-smoked | 3 tbsp Coarse black pepper | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 249 | cooking-brisket-smoked | 2 tbsp Paprika | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 250 | cooking-brisket-smoked | 1½ tbsp Garlic powder | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 251 | cooking-brisket-smoked | 1½ tbsp Onion powder | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 252 | cooking-brisket-smoked | 1 tbsp Chili powder Or: Not interchangeable with cayenne — American chili powder is a mild blend, cayenne is far hotter | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 253 | cooking-brisket-smoked | 1 tsp Cumin | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 254 | cooking-brisket-smoked | 1 tbsp Brown sugar, optional | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 255 | cooking-brisket-smoked | 3 tbsp Yellow mustard, binder only Or: Hot sauce, oil, or nothing — the binder cooks off entirely and contributes no flavour | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 256 | cooking-brisket-smoked | 2 tbsp Beef tallow, optional, at the wrap | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 257 | cooking-brisket-smoked | Equipment | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 258 | cooking-brisket-smoked | Big Green Egg or other ceramic smoker Anything that holds 250F for twelve hours with clean smoke. Or: Offset smoker; Kettle grill with a two-zone snake; Pellet smoker | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 259 | cooking-brisket-smoked | Conveggtor (ceramic heat deflector) Direct heat under a brisket for twelve hours burns the bottom long before the inside… | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 260 | cooking-brisket-smoked | Leave-in probe thermometer No substitute This cook is gated by internal temperature for its entire length. An instant-re… | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 261 | cooking-brisket-smoked | Butcher paper Or: Heavy foil, at a cost — foil traps steam and softens the bark you spent eight hours building | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 262 | cooking-brisket-smoked | Cooler and two towels The long hold is part of the cook, not storage. Or: Oven set to its lowest setting; Any insulated box | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 263 | cooking-brisket-smoked | Temperatures | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 264 | cooking-brisket-smoked | Whole brisket, at the wrap Pull at 165 °F Range 160–170F, but bark condition decides, not the number. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 265 | cooking-brisket-smoked | Whole brisket, finish Pull at 203 °F, no higher than 207 °F Commonly 195–207F. Probe feel is the real endpoint; 203 is where it often lands, not a rule. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 266 | cooking-brisket-smoked | Steps | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 267 | cooking-brisket-smoked | Trim the fat cap to about ¼ inch | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 268 | cooking-brisket-smoked | For: The whole packer | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 269 | cooking-brisket-smoked | Time: 20 min | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 270 | cooking-brisket-smoked | Take off hard, waxy fat and square up loose edges. Leave about ¼ inch of cap. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 271 | cooking-brisket-smoked | Not needed | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 272 | cooking-brisket-smoked | This is the opposite of the steak rule. On a four-minute steak you leave the cap alone because it cannot render in time.… | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 273 | cooking-brisket-smoked | Dry brine overnight | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 274 | cooking-brisket-smoked | For: The whole packer, bare — no rub yet | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 275 | cooking-brisket-smoked | Time: 10 min · 8 hours is the floor, 12–16 is better, 24 is fine. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 276 | cooking-brisket-smoked | 10–12 g kosher salt per pound of trimmed weight, every surface, uncovered on a rack in the fridge. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 277 | cooking-brisket-smoked | Binder and rub | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 278 | cooking-brisket-smoked | Time: 15 min | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 279 | cooking-brisket-smoked | Thin coat of mustard, then the rub over every surface. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 280 | cooking-brisket-smoked | No extra salt in the rub. The brine already did it, and the two stacking is the most common way a brisket comes out inedible. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 281 | cooking-brisket-smoked | The mustard is not a flavour — it cooks off entirely. It is glue. Hot sauce, oil or nothing all work the same. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 282 | cooking-brisket-smoked | Light the fire and set up indirect | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 283 | cooking-brisket-smoked | For: Nothing moves yet — the brisket stays in the fridge | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 284 | cooking-brisket-smoked | Go by sight Clean coals, thin blue or invisible smoke, no white acrid smoke. Time estimate: 55 min | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 285 | cooking-brisket-smoked | Lid closed | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 286 | cooking-brisket-smoked | Vents bottom open about an inch, top mostly closed | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 287 | cooking-brisket-smoked | Zone indirect | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 288 | cooking-brisket-smoked | Temp 255 °F | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 289 | cooking-brisket-smoked | Clean the ash out first — ash over the bottom vent is the most common reason a ceramic will not hold temperature. Conveg… | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 290 | cooking-brisket-smoked | Resist loading the firebox to the brim. A fully lit bed is harder to hold down at 250 than a conservative one is to bring up, and an over-ignited bed is exactly how this cook spiked to 390F. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 291 | cooking-brisket-smoked | Brisket on, fat cap toward the hotter side | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 292 | cooking-brisket-smoked | Time: 5 min | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 293 | cooking-brisket-smoked | Probe into the thickest part of the flat, not the point. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 294 | cooking-brisket-smoked | Hold 250–260F until the bark sets | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 295 | cooking-brisket-smoked | For: The brisket, undisturbed | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 296 | cooking-brisket-smoked | When the probe reads 165 °F Time estimate: 7 h · Roughly 7 hours, but this is an estimate only. The stall can add hours and it is normal. Go by the probe. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 297 | cooking-brisket-smoked | Vents small adjustments only | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 298 | cooking-brisket-smoked | Leave it alone. Vent changes take 5–10 minutes to register on a ceramic, so adjust once and wait rather than chasing the needle. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 299 | cooking-brisket-smoked | Do not panic at a temperature spike. On the recorded cook the dome hit about 390F for five minutes when the charcoal cau… | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 300 | cooking-brisket-smoked | Wrap — but only once the bark is right | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 301 | cooking-brisket-smoked | For: The brisket | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 302 | cooking-brisket-smoked | Go by sight Bark is dark, firm and mahogany, and does not smear when you touch it. Internal is usually 160–170F when this is true. Time estimate: 15 min | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 303 | cooking-brisket-smoked | Butcher paper, tight. Optional 2–3 tbsp tallow. Back on, probe back in. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 304 | cooking-brisket-smoked | The temperature is a signal, not the instruction. Wrapping a brisket whose bark has not set because the probe said 165 g… | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 305 | cooking-brisket-smoked | Foil works and softens the bark. That is a real trade, not a mistake — just know which one you are choosing. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 306 | cooking-brisket-smoked | Finish to probe-tender | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 307 | cooking-brisket-smoked | For: The brisket, wrapped | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 308 | cooking-brisket-smoked | Go by feel A probe slides into the thickest part of the flat with no resistance, like room-temperature butter. Internal… | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 309 | cooking-brisket-smoked | On the recorded cook the lowest reading at finish was 203F. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 310 | cooking-brisket-smoked | Do not pull at a number. 203F is where briskets often become tender, not why they become tender — collagen conversion is… | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 311 | cooking-brisket-smoked | Vent the wrap 5–10 minutes | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 312 | cooking-brisket-smoked | For: The brisket, wrap opened | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 313 | cooking-brisket-smoked | Time: 10 min | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 314 | cooking-brisket-smoked | Open the wrap and let the steam off before the long hold. Skipping this carries on cooking it inside its own packet. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 315 | cooking-brisket-smoked | Rewrap loosely and hold 1–3 hours | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 316 | cooking-brisket-smoked | Time: 2 h · This is your buffer. Stretch or shrink it to hit your serving time. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 317 | cooking-brisket-smoked | Loosely rewrapped, in a cooler under two towels. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 318 | cooking-brisket-smoked | There will be a lot of liquid in the wrap. That is normal — save it separately for slicing or for beans. Do not pour it back over the bark, which undoes the bark. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 319 | cooking-brisket-smoked | Separate the point, slice the flat across the grain | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 320 | cooking-brisket-smoked | For: The whole brisket | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 321 | cooking-brisket-smoked | The flat and the point have grain running in different directions, so find the fat seam, separate them, and slice each a… | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 322 | cooking-brisket-smoked | Rest | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 323 | cooking-brisket-smoked | Whole brisket, wrapped | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 324 | cooking-brisket-smoked | Unlike a steak, this rest is part of the cook — collagen keeps converting and the muscle reabsorbs liquid. It is also th… | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 325 | cooking-brisket-smoked | Recipe · Original | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 326 | cooking-brisket-smoked | James Eby | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |

### Recipe: brisket al horno

| # | Page | Text | Who | Command | State |
| --- | --- | --- | --- | --- | --- |
| 327 | cooking-brisket-al-horno | Cooking · Brisket (pecho de res) · Al horno | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 328 | cooking-brisket-al-horno | Brisket al horno | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 329 | cooking-brisket-al-horno | Braseado en caldo y tomate. Cuatro horas, sin ahumador y sin manejar fuego. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 330 | cooking-brisket-al-horno | Rinde 6 porciones. Según el tamaño del pecho. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 331 | cooking-brisket-al-horno | Receta · Adaptada | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 332 | cooking-brisket-al-horno | Comiendo con Lau | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 333 | cooking-brisket-al-horno | Receta de ella. Acá está reformulada en estructura propia; el texto original es suyo. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 334 | cooking-brisket-al-horno | Ingredientes | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 335 | cooking-brisket-al-horno | 2–2½ kg Brisket de res (pecho) | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 336 | cooking-brisket-al-horno | 1 cda. Sal | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 337 | cooking-brisket-al-horno | 1 cda. Pimienta, molido grueso, mejor recién molida | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 338 | cooking-brisket-al-horno | 1 cda. Paprika | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 339 | cooking-brisket-al-horno | 1 cda. Orégano | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 340 | cooking-brisket-al-horno | 3 cda. Aceite vegetal O: Cualquier aceite neutro de punto de humo alto | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 341 | cooking-brisket-al-horno | 3½ tazas Caldo de pollo O: Caldo de res; Agua con un cubito, si no hay otra cosa | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 342 | cooking-brisket-al-horno | 400 g Tomate picado O: Tomate en lata picado; Tomate fresco maduro, picado | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 343 | cooking-brisket-al-horno | 2 Hojas de laurel | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 344 | cooking-brisket-al-horno | 1 Cebolla grande, en medias lunas delgadas | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 345 | cooking-brisket-al-horno | 3 Dientes de ajo, picados finamente o triturados | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 346 | cooking-brisket-al-horno | Equipo | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 347 | cooking-brisket-al-horno | Olla de fondo grueso con tapa O: Olla de hierro fundido (ideal); Cualquier olla que vaya del fuego al horno con tapa; Fuente honda bien sellada con papel aluminio | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 348 | cooking-brisket-al-horno | Horno Sin sustituto El plato es un braseado largo a temperatura estable. No hay forma de hacerlo en sartén. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 349 | cooking-brisket-al-horno | Pasos | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 350 | cooking-brisket-al-horno | Precalentar el horno y condimentar la carne | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 351 | cooking-brisket-al-horno | Para: Toda la pieza de brisket | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 352 | cooking-brisket-al-horno | Tiempo: 15 min | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 353 | cooking-brisket-al-horno | Horno a 180 °C. Mezclar sal, pimienta, paprika y orégano, y cubrir la carne entera con la mezcla. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 354 | cooking-brisket-al-horno | Dorar por ambos lados | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 355 | cooking-brisket-al-horno | Para: El brisket | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 356 | cooking-brisket-al-horno | Tiempo: 20 min | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 357 | cooking-brisket-al-horno | Calentar la olla a fuego medio, cubrir bien el fondo con el aceite y dorar 10 minutos de cada lado. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 358 | cooking-brisket-al-horno | No hace falta | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 359 | cooking-brisket-al-horno | No hace falta quitar la grasa de la carne antes de dorar. En un braseado largo esa grasa se derrite y se va a la salsa; es sabor, no desperdicio. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 360 | cooking-brisket-al-horno | Añadir los líquidos y despegar el fondo | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 361 | cooking-brisket-al-horno | Para: La olla | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 362 | cooking-brisket-al-horno | Tiempo: 5 min | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 363 | cooking-brisket-al-horno | Escurrir el exceso de aceite si se quiere. Añadir el caldo, el tomate y el laurel, y raspar el fondo con una pala para soltar todo lo pegado. Ese fondo tostado es lo que le da sabor a la salsa final. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 364 | cooking-brisket-al-horno | Tapar y al horno, 30 minutos | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 365 | cooking-brisket-al-horno | Para: La olla tapada. La cebolla y el ajo todavía no entran | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 366 | cooking-brisket-al-horno | Tiempo: 30 min | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 367 | cooking-brisket-al-horno | Tapada, al horno, media hora. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 368 | cooking-brisket-al-horno | Añadir cebolla y ajo encima, 30 minutos más | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 369 | cooking-brisket-al-horno | Para: Cebolla y ajo, repartidos sobre la carne — no en el líquido todavía | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 370 | cooking-brisket-al-horno | Sacar la olla, repartir el ajo y la cebolla sobre el brisket, tapar y devolver al horno otra media hora. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 371 | cooking-brisket-al-horno | Pasar la cebolla y el ajo al caldo | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 372 | cooking-brisket-al-horno | Para: La cebolla y el ajo que quedaron encima de la carne | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 373 | cooking-brisket-al-horno | Sacar del horno y empujar al caldo toda la cebolla y el ajo que quedaron arriba. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 374 | cooking-brisket-al-horno | Tapar y al horno, 2 horas más | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 375 | cooking-brisket-al-horno | Para: La olla tapada | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 376 | cooking-brisket-al-horno | Tiempo: 2 h | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 377 | cooking-brisket-al-horno | Dos horas más, tapada. La receta original pide una hora extra después de esto; la fuente dice que a las 3 horas de horno… | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 378 | cooking-brisket-al-horno | Envolver en papel aluminio y reposar | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 379 | cooking-brisket-al-horno | Para: El brisket, fuera del líquido | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |
| 380 | cooking-brisket-al-horno | Pasar el brisket a una cama de papel aluminio y envolver bien. Envuelto aguanta sin problema mientras se termina el resto de la comida. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: the cooking thread's recipes handoff (COOK-01 to COOK-23) | draft awaiting his word |

### Real Estate

| # | Page | Text | Who | Command | State |
| --- | --- | --- | --- | --- | --- |
| 381 | real-estate | Real Estate | James | JEBYUS-0083, 2026-11-17: "The others should be: 1. Open-Source Software 2. Astrophysics 3. Cooking 4. Real Estate 5. Random (random page)" | owner-written |
| 382 | real-estate | jeby Real Estate. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 383 | real-estate | Market analysis for Miami Springs and Virginia Gardens, every fact traced to its source. Two cities, and only verified public data. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in 6a9d762 | draft awaiting his word |
| 384 | real-estate | Market hub · staging | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 385 | real-estate | The market hub | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 386 | real-estate | A staging build of the market hub, on verified U.S. Census data only. jebyrealestate.com is not live yet. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 387 | real-estate | Open the staging hub | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 388 | real-estate | Free · JA Insights | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in b46c863 | draft awaiting his word |
| 389 | real-estate | A one-page report on your data | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 390 | real-estate | Drop in a spreadsheet. It never leaves your browser. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 391 | real-estate | Open the report | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 392 | real-estate | jRE · In build | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in 865cfd1 | draft awaiting his word |
| 393 | real-estate | Miami real-estate analytics where every number shows its source. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in 6a9d762 | draft awaiting his word |
| 394 | real-estate | A property database for Miami Springs and Virginia Gardens built around each lot's full history: owners, sales, features and valuations over time, with a review queue for records that look wrong. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in 6a9d762 | draft awaiting his word |
| 395 | real-estate | In Open-Source Software | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |

### Random

| # | Page | Text | Who | Command | State |
| --- | --- | --- | --- | --- | --- |
| 396 | random | Random | James | JEBYUS-0083, 2026-11-17: "The others should be: 1. Open-Source Software 2. Astrophysics 3. Cooking 4. Real Estate 5. Random (random page)" | owner-written |
| 397 | random | Random. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 398 | random | One thing from this site, picked at random each time the page loads. | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 399 | random | Open | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 400 | random | Another | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 401 | random | Off the clock | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 402 | random | Machining | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in f295317 | draft awaiting his word |
| 403 | random | Golf | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 404 | random | SCUBA | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in b46c863 | draft awaiting his word |
| 405 | random | Archery | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in 6a9d762 | draft awaiting his word |
| 406 | random | Kayaking with Drew | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 407 | random | Brisket | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 408 | random | Open-Source Software · In build | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 409 | random | jRE | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 410 | random | learningLabs | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in 56bfcdf | draft awaiting his word |
| 411 | random | Open-Source Software · Preview | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 412 | random | Cell-count pipeline | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in 0adff7c | draft awaiting his word |
| 413 | random | Open-Source Software · Idea | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 414 | random | Route optimizer | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in 19a8b10 | draft awaiting his word |
| 415 | random | Driver tracking | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in 19a8b10 | draft awaiting his word |
| 416 | random | Dog territory app | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in 19a8b10 | draft awaiting his word |
| 417 | random | MusicalGames | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in 6a9d762 | draft awaiting his word |
| 418 | random | Plantriloquist | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in 0adff7c | draft awaiting his word |
| 419 | random | Desk | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 420 | random | Lighting Lab | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in 0adff7c | draft awaiting his word |
| 421 | random | Quorum | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in 0adff7c | draft awaiting his word |
| 422 | random | AppForge | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in 0adff7c | draft awaiting his word |
| 423 | random | Open-Source Software · Live | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 424 | random | jeby.us | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 425 | random | Scottish Terrier | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories; the words were first written in b46c863 | draft awaiting his word |
| 426 | random | Drew | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 427 | random | Astrophysics · Carnegie Mellon, 2015 | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 428 | random | Predicting the masses of galaxy clusters | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 429 | random | Cooking | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
| 430 | random | Smoked brisket | drafted for James | decision 156, James 2026-11-17: his 2026-11-12 point 8.5 (no Big Green Egg on the personal pages) applied to the recipe title; was JEBYUS-0083, aaf2169 | owner-approved |
| 431 | random | Brisket al horno | drafted for James | JEBYUS-0083, aaf2169, 2026-11-17: five categories | draft awaiting his word |
