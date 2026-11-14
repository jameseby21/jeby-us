"""All site content in one place. Pages are generated from this by build.py."""

CONFIG = {
    "email": "jeby@jainsights.com",            # switch to hello@jeby.us once forwarding is set up
    "linkedin": "https://www.linkedin.com/in/jeby-d",
    "github": "https://github.com/jameseby21",
    "instagram": "https://www.instagram.com/jeby_d/",
    "youtube": "",                              # the channel URL once it exists; empty hides the link
    "resume_pdf": "",                           # e.g. "resume.pdf" once uploaded; empty hides the button
    # Booking: per offer, pick a provider. Empty URLs fall back to email.
    "booking": {
        "provider": "email",                    # "cal" | "calendly" | "form" | "email"
        "cal": "",                              # e.g. https://cal.com/jeby/trial
        "calendly": "",
        "form": "",
    },
}

# The words the red dot hops across on the home hero before it lands as the full stop. Personal, not a skills list.
DISCIPLINES = [("Statistics", "research.html"), ("Galaxy clusters", "research.html"), ("Machining", "about.html#interests"),
               ("Golf", "about.html#interests"), ("SCUBA", "about.html#interests"), ("Brisket", "about.html#interests"), ("Drew", "about.html#drew")]

# Voice (James, 2026-11-08): personal pages call him James, never jeby; work is a link, not a story.
# jeby is his online handle and can introduce him on professional pages only.
ABOUT_SHORT = "I live in Miami with Drew. I studied statistics at Carnegie Mellon, and I have more side projects than free evenings."
HERO = "Super serious about my silliness."

ABOUT_LONG = [
    "I live in Miami with Drew, a Scottish Terrier who appears on more of my projects than I do.",
    "I studied statistics at Carnegie Mellon University with a concentration in computer science, I am a senior BI manager, and I'm drawn to difficult problems.",
    "Away from the keyboard I like things that can't be rushed: machining, golf, diving, archery, kayaking with Drew, and brisket, which is twelve hours of patience for twenty minutes of dinner.",
]
FACTS = [("Based", "Miami, FL"), ("Studied", "B.S. Statistics, Carnegie Mellon, 2019"),
         ("Off the clock", "Machining, golf, SCUBA, archery, kayaking with Drew, and brisket")]

DREW = {
    "title": "Drew",
    "role": "Scottish Terrier",
    "short": "He's on my business cards, my QR codes and half my projects. Nobody asked him.",
}

# The story (About page, #story). DRAFT: every line is for James to check; only facts he has stated are used.
# HEALTH_DETAIL is James's own words about his health: open-heart surgery and no more (James, 2026-11-12).
HEALTH_DETAIL = "I had open-heart surgery."
STORY = {
    "title": "The story so far",
    "chapters": [
        {"when": "High school", "head": "The math club",
         "body": "It started with the math club. In 2013 I took sixth place in statistics at the Mu Alpha Theta national convention."},
        {"when": "2015 – 2019", "head": "Carnegie Mellon",
         "body": "I studied statistics, with a concentration in computer science. My undergraduate research asked whether the usual way of weighing galaxy clusters counted the same data more than once. It did. I was president of the archery club, and I taught kids to code at a summer camp."},
        {"when": "2019 – 2025", "head": "Work",
         "body": "Six years in business intelligence, the last of them leading analytics at a startup. The details are on the Professional page."},
        {"when": "2025", "head": "Then my health stepped in", "break": True,
         "body": "In 2025 the startup ran out of money while I was in the hospital, and the job went with it.",
         "after": "I couldn't choose that part. I could choose what to do with the time I had."},
        {"when": "Since then", "head": "I kept building",
         "body": "I build things in my spare time: a real-estate database, a learning library, keyboard lighting software, a band game, and a houseplant that roasts your friends. Some are out and some are still ideas; the Lab says which. I also tutor math, statistics and data. Drew handles morale."},
    ],
}
SUPPORT = {
    # Pick any providers; an empty URL shows the option as "setting up" in previews and hides it in production.
    "providers": [("GitHub Sponsors", ""), ("Ko-fi", ""), ("Open Collective", ""), ("One-time card payment", "")],
    "note": "Sponsorships go to me personally and keep the open projects free and maintained. I'm not a charity, so they aren't tax-deductible.",
    "share_url": "https://jeby.us/about#story",
}
PREVIEW_SLOTS = False  # show empty draft slots and unconfigured providers in previews; set False before deploy

# (label, text, optional link). Personal first; work gets one line and a link.
NOW = [
    ("Research", "Picking the galaxy-cluster work back up, ten years after the poster, to see if it holds.", "research.html"),
    ("Building", "A band game that turns any song into a chart you can actually play.", "lab.html#musicalgames"),
    ("Teaching", "Taking on math, statistics and data students again.", "teach.html"),
    ("Work", "Looking for my next BI leadership role.", "professional.html"),
]

PRO = {
    "headline": "I build analytics teams and the systems they run on.",
    "summary": ("I'm James Eby, jeby to most people in tech. Six years in business intelligence and data science: I founded two analytics functions, "
                "led a company-wide Power BI rollout and a Snowflake migration, and mentored the analysts on the team. "
                "I studied statistics at Carnegie Mellon and write enough code to build what the numbers need. I work in English and Spanish."),
    "stats": [("6+", "years in BI and data science"), ("2", "analytics functions founded"), ("1", "company-wide Power BI rollout led"), ("~10", "years of teaching and tutoring")],
}

# Experience from resume_extended (Nov 2026). Bracketed placeholders are left out on the web.
EXPERIENCE = [
    {"id": "overproof", "org": "Overproof, Inc", "title": "Senior BI Analyst", "start": [2022, 6], "end": [2025, 9],
     "lead": "Founded and led the analytics function; ran the Power BI rollout and the Snowflake migration.",
     "bullets": ["Founded and led the Overproof Analytics function; mentored analysts and interns across international teams",
                 "Authored quarterly industry trend reports that drew thousands of clicks from alcohol-industry professionals and sparked brand interest in our data and services",
                 "Built a “Venue Profile” scoring algorithm from menu data to generate targeted account lists for clients",
                 "Led the company-wide Power BI rollout and Power BI Embedded (Azure) client dashboards in the customer portal",
                 "Oversaw the PostgreSQL-to-Snowflake data warehouse migration and directed data QA across databases",
                 "Produced marketing analytics that increased engagement and generated leads",
                 "Analytics subject-matter expert for executives, Sales, Customer Success, and client calls"],
     "tags": ["Power BI", "Snowflake", "PostgreSQL", "Python", "Leadership"]},
    {"id": "gridlex", "org": "Gridlex, Inc", "title": "Senior Data Analyst", "start": [2021, 10], "end": [2022, 6],
     "lead": "Client insights and CRM applications; managed a dashboard team in India.",
     "bullets": ["Delivered KPI, prospect-targeting, and market-share insights from client sales data",
                 "Managed a cross-functional development team in India building client dashboards; project-managed 3 enterprise clients",
                 "Designed and implemented custom CRM applications with master data management (MDM)",
                 "Prototyped new products in Python and Excel, later built into the client portal"],
     "tags": ["Python", "Excel", "MDM", "Team lead"]},
    {"id": "autoquotes", "org": "AutoQuotes (now Revalize), LLC", "title": "Business Intelligence Analyst", "start": [2020, 6], "end": [2021, 10],
     "lead": "Founded AQ Data; built churn health scores; ran industry trend webinars.",
     "bullets": ["Founded AQ Data, delivering custom reporting, business insights, and KPI dashboards in Power BI",
                 "Presented commercial-kitchen industry trend reports in 3–4 webinars reaching roughly 1,000 participants",
                 "Built and automated customer health scores to reduce churn; set post-launch baselines and target metrics",
                 "Integrated acquired companies' business systems into Salesforce",
                 "Led data QA for customer data: deduplication, outlier detection, and accuracy controls"],
     "tags": ["Power BI", "DAX", "Salesforce", "Churn modeling"]},
    {"id": "guma", "org": "Guma Pharma", "title": "Data Analyst", "start": [2019, 2], "end": [2020, 1],
     "lead": "Turned supply-chain policy into an automated decision tool.",
     "bullets": ["Translated inventory and supply-chain policy into an automated decision tool, coordinating a cross-functional team",
                 "Developed a web dashboard that made inventory analyses accessible across the company"],
     "tags": ["Supply chain", "Dashboards"]},
    {"id": "lannett", "org": "Lannett Company, Inc.", "title": "Corporate Statistician", "start": [2018, 7], "end": [2018, 10],
     "lead": "Process-validation statistics; replaced a Minitab workflow with one R function.",
     "bullets": ["Monitored continued process validation statistics across company products and reported results",
                 "Replaced a multi-step Minitab procedure with a single R function, automating CPV preparation",
                 "Provided internal statistical consulting for engineers and management"],
     "tags": ["R", "Minitab", "SPC"]},
    {"id": "unified", "org": "Unified Life Management Group", "title": "Full-Stack Engineer", "start": [2017, 5], "end": [2018, 6],
     "lead": "Sole developer for all company data; rebuilt the site in Angular.",
     "bullets": ["Sole developer responsible for all company data, including customer, agent, and policy information",
                 "Fixed bugs in an established site; added messaging and SMS updates for agents",
                 "Rebuilt an inefficient site from scratch in Angular"],
     "tags": ["Angular", "Full stack"]},
    {"id": "codekids", "org": "Code Kids Camp", "title": "Camp Lead", "start": [2015, 5], "end": [2016, 8],
     "lead": "Taught kids 7–13 computer science; led the Coral Gables instructor team.",
     "bullets": ["Taught children aged 7–13 introductory computer science (year 1); led the Coral Gables instructor team (year 2)",
                 "Ran day-to-day operations: scheduling, learning activities, and parent communications"],
     "tags": ["Teaching", "Leadership"]},
]
VENTURES = [
    {"id": "jre", "org": "jRE, jeby Real Estate LLC", "title": "Founder", "start": [2026, 9], "end": None,
     "lead": "Market analysis for Miami Springs and Virginia Gardens, every fact traced to its source.",
     "bullets": ["Market analysis platform for Miami Springs and Virginia Gardens: property histories over time, every fact traced to its source, and a quarantine-and-review workflow for doubtful records",
                 "Analytics showcase (in development): forecasting, valuation models, and model comparison in one interactive view",
                 "Built on PostgreSQL 16, FastAPI, Angular, and Docker; setup verified repeatable from a fresh copy on Windows and macOS",
                 "Florida LLC formed Sep 16, 2026; Florida Real Estate Sales Associate license"],
     "tags": ["PostgreSQL 16", "FastAPI", "Angular", "Docker"]},
    {"id": "jai", "org": "JA Insights LLC", "title": "Founder", "start": [2025, 11], "end": None,
     "lead": "A data consulting practice for small businesses.",
     "bullets": ["Founded a data consulting practice for small businesses; sole operator for strategy, development, and delivery"], "tags": ["Consulting"]},
    {"id": "appforge", "org": "AppForge", "title": "Founder", "start": [2026, 10], "end": None,
     "lead": "A method for building software with AI coding agents.",
     "bullets": ["A method and toolkit for building software with AI coding agents, “an app that makes apps”: each defect becomes a documented case, a reusable rule, and an automated test"], "tags": ["AI agents", "Testing"]},
    {"id": "plantriloquist", "org": "Plantriloquist", "title": "Builder", "start": [2026, 10], "end": None,
     "lead": "A talking houseplant on a Raspberry Pi.",
     "bullets": ["A talking houseplant that makes fun of me and my friends: Raspberry Pi, microphone array, speaker, speech recognition, and neural voice synthesis on a hardware-neutral character engine"], "tags": ["Raspberry Pi", "Speech"]},
]
SKILLS = [("BI", "Power BI, DAX, Power BI Embedded, Looker, Excel, dashboards, KPI reporting"),
          ("Data", "SQL, Snowflake, PostgreSQL, data warehousing, data quality, MDM, Salesforce"),
          ("Analytics", "Python, R, Minitab, regression, classification, forecasting, statistical process control"),
          ("Engineering", "JavaScript, TypeScript, HTML, CSS, Angular, FastAPI, Docker, git, Jira"),
          ("Languages", "English (native), Spanish (native), French (basic)")]
EDUCATION = {"school": "Carnegie Mellon University", "degree": "B.S. Statistics, Computer Science concentration", "year": "2019",
             "coursework": "Data Mining; Advanced Data Analysis; Regression Analysis; Statistical Computing; Graphics and Visualization; Great Theoretical Ideas in CS",
             "teaching": "About ten years of teaching: tutoring, coding-camp lead instructor, college teaching assistant."}
AWARDS = ["Research: “Predicting the Masses of Galaxy Clusters Using Weighted Linear Regression”",
          "Tartan Data Science Cup, Organizer's Choice Award (most accurate predictions, undergraduate)",
          "6th place, Statistics Individual, Mu Alpha Theta National Convention, 2013",
          "Archery Club president, 2016; Sports Analytics Club treasurer, 2015–2016",
          "SCUBA certified"]

# ---------------------------------------------------------------- Teach
TUTORING = [
    {"id": "math", "name": "High-school math", "scope": "Pre-algebra through precalculus and trigonometry",
     "note": "Algebra 1 and Geometry EOC retakes run Nov 30 to Dec 18. The EOC counts for 30% of the course grade.",
     "rows": [("Trial lesson", "$45 online · $55 in home"), ("Hourly", "$75 online · $85 in home"), ("5 sessions", "$350 · $400"), ("10 sessions", "$650 · $750"),
              ("Small group", "$35–40 per student"), ("EOC bootcamp", "$199")]},
    {"id": "sat", "name": "SAT and ACT math", "scope": "Content review, timing and test strategy",
     "note": "I scored 790 on SAT Math. Upcoming SAT dates: Mar 6, May 1 and Jun 5, 2027.",
     "rows": [("Diagnostic", "$60"), ("Hourly", "$95"), ("5 sessions", "$450"), ("10 sessions", "$850"), ("8-week group", "$399")]},
    {"id": "stats", "name": "Statistics", "scope": "AP Statistics and college intro courses like STA 2023",
     "note": "Statistics is my degree. Finals for STA 2023 land in early December.",
     "rows": [("Trial lesson", "$60"), ("Hourly", "$95 online · $90 in group"), ("5 sessions", "$450"), ("10 sessions", "$850"),
              ("Exam crash group", "$120"), ("Semester pass", "$700")]},
    {"id": "data", "name": "Data analysis", "scope": "Excel, SQL, Power BI and basic Python, taught on real data",
     "note": "Taught on real, messy data, the way the job actually looks.",
     "rows": [("Trial lesson", "$60"), ("Hourly", "$110"), ("5 sessions", "$500"), ("10 sessions", "$950"), ("8-week live cohort", "$599–749")]},
]
MENTORSHIP = [("Strategy call", "$150", "60 minutes on where you are and what to build, plus a written plan"),
              ("Résumé and portfolio teardown", "$199", "Line by line, rewritten together"),
              ("Mock technical interview", "$175", "SQL and a case, recorded, with notes"),
              ("Monthly mentorship", "$199 / month", "Two calls, chat in between, one project reviewed"),
              ("90-day program", "$1,497 or 3 × $549", "Weekly calls, a portfolio project on real public data, SQL and Power BI practice, your résumé, three mock interviews, and a referral note when you've earned it")]
RESUME_SERVICES = [("ATS Tune-Up", "$129", "An edit of your current résumé, a keyword pass, one revision, three business days"),
                   ("Full Rewrite", "$299 · $449 senior", "A new résumé from a 30-minute intake call, two revisions, five business days"),
                   ("Career Launch", "$549", "Full Rewrite, LinkedIn rewrite, cover-letter template and a 30-minute strategy call"),
                   ("Add-ons", "from $75", "LinkedIn $149 · cover letter $99 · 48-hour rush $75 · personal QR mark $79")]
FAQ = [("Online or in person?", "Both. Online sessions run on video with a shared whiteboard. In-person sessions are in Miami."),
       ("English or Spanish?", "Either, or both in the same session. Clases en español disponibles."),
       ("How do I pay?", "We settle it by email before the first session; there is no online checkout yet. Packs are paid up front and don't expire for six months."),
       ("What's the cancellation policy?", "Reschedule for free up to 24 hours ahead. Later cancellations count as a session."),
       ("Do you work with younger students?", "Yes. For students under 18, a parent books, stays in the loop, and nothing is recorded without written consent.")]

# ---------------------------------------------------------------- Lab
# Every project. "open" = the free jebyLabs version; "paid" = the supported version sold through JA Insights.
LAB = [
    {"group": "Data and analytics", "items": [
        {"id": "jre", "name": "jRE", "status": "In build", "accent": "#2EC4B6", "mark": "jR",
         "line": "Miami real-estate analytics where every number shows its source.",
         "detail": "A property database for Miami Springs and Virginia Gardens built around each lot's full history: owners, sales, features and valuations over time, with a review queue for records that look wrong.",
         "stack": ["PostgreSQL 16", "FastAPI", "Angular", "Docker", "scikit-learn"],
         "open": "Schema, app scaffold, synthetic-data generator, review workflow and data-intake framework",
         "paid": "Curated South Florida data, valuation and comparable-homes engines, market scores, advisory",
         "code": None, "jai": "jre"},
        {"id": "learninglabs", "name": "learningLabs", "status": "In build", "accent": "#83DFC1", "mark": "L",
         "line": "A learning library. First up: a data analysis course, with fraud detection as one of its case studies.",
         "detail": "The data analysis course is in progress, in Python, R, Power BI and Excel. Its fraud-detection case study comes with a library of resolved real cases, an investigation game and a public-data intake desk. More labs beyond data are an idea.",
         "stack": ["Python", "R", "Power BI", "JavaScript"],
         "open": "Courses, case library, the game and all original data (GPL-3.0 and CC0)",
         "paid": "A hosted workspace for the course's investigations, and team training through JA Insights",
         "code": "https://github.com/jameseby21/Become-a-Data-Analyst", "jai": "learninglabs"},
        {"id": "research", "name": "Galaxy-cluster masses", "status": "In build", "accent": "#4084FF", "mark": "σ",
         "line": "Weighing galaxy clusters by how their galaxies move, revisited ten years on.",
         "detail": "The 2015 Carnegie Mellon poster, rebuilt as an animated slideshow, and a new public repository for the follow-up work.",
         "stack": ["Python", "R", "Statistics"],
         "open": "Everything: code, figures and data cards", "paid": None, "code": None, "jai": None, "page": "research.html"},
        {"id": "cellcount", "name": "Cell-count pipeline", "status": "Preview", "accent": "#9C8CFF", "mark": "C",
         "line": "CSV to a normalized database to a dashboard, in one command.",
         "detail": "Loads 52,500 measurements from 10,500 samples into a normalized SQLite schema, then summarizes them in tables, plots and a Streamlit dashboard. Written as a take-home exercise.",
         "stack": ["Python", "pandas", "SQLite", "Streamlit"],
         "open": "Shared on request", "paid": None, "code": None, "jai": None},
    ]},
    {"group": "For small businesses", "items": [
        {"id": "route-optimizer", "name": "Route optimizer", "status": "Idea", "accent": "#3FA7D6", "mark": "R",
         "line": "Route planning for businesses whose day is a list of stops.",
         "detail": "Put in the day's stops and get a sensible order to drive them in, without a routing subscription. Not built yet; this is the brief. Meant for small route-based businesses, through JA Insights.",
         "stack": ["Python", "Maps"],
         "open": "Planned as a free tool", "paid": None, "code": None, "jai": None},
        {"id": "driver-tracking", "name": "Driver tracking", "status": "Idea", "accent": "#5C7CFA", "mark": "D",
         "line": "Driver tracking for small businesses with several drivers and no software budget.",
         "detail": "Where each driver is and what's done, for a team of a few drivers rather than a fleet department. Not built yet; this is the brief. Meant to go through JA Insights.",
         "stack": ["Python", "Maps"],
         "open": "Planned as a free tool", "paid": None, "code": None, "jai": None},
    ]},
    {"group": "For dogs and their people", "items": [
        {"id": "territory", "name": "Dog territory app", "status": "Idea", "accent": "#F2994A", "mark": "T",
         "line": "A dog game for walks: claim territory, leave scent marks, keep dogs safe. Working name.",
         "detail": "Walks claim ground on a hex map and scent marks become a game between dogs on the same streets. The idea includes a lost-pet kit and reactive-dog warnings. Nothing is built yet.",
         "stack": ["Mobile", "Maps"],
         "open": "Planned as a free app", "paid": None, "code": None, "jai": None},
    ]},
    {"group": "Games and music", "items": [
        {"id": "musicalgames", "name": "MusicalGames", "status": "In build", "accent": "#FFCC33", "mark_img": "musicalgames.svg",
         "line": "A full-band rhythm game with karaoke, real guitars and keyboards, and charts made from audio.",
         "detail": "One app for full-band rhythm games, karaoke with pitch scoring, a Guitar Room for real instruments, and a party mode where friends add songs by scanning a QR code. Working title. The commercial route is undecided.",
         "stack": ["Python", "JavaScript", "MIDI"],
         "open": "Planned: chart generation from your own audio, karaoke and party mode",
         "paid": "Planned: a one-time purchase",
         "code": None, "jai": "musicalgames"},
    ]},
    {"group": "Hardware", "items": [
        {"id": "plantriloquist", "name": "Plantriloquist", "status": "In build", "accent": "#5FD38D", "mark_img": "plantriloquist.png",
         "line": "A Raspberry Pi hidden in a plant pot that listens and roasts your friends.",
         "detail": "A provider-neutral talking-character engine: speech recognition, a comedy engine and neural voices, with a simulator and a control panel. First character: Potty Mouth.",
         "stack": ["Python", "Raspberry Pi", "faster-whisper", "Piper"],
         "open": "Character engine, simulator, control panel and offline voice path (on the bench)",
         "paid": "Character and voice packs, hosted AI responses, a ready-made hardware kit",
         "code": None, "jai": "plantriloquist"},
    ]},
    {"group": "Tools and software", "items": [
        {"id": "desk", "name": "Desk", "status": "Preview", "accent": "#C8F03C", "mark_img": "desk.svg",
         "line": "A ticket system where nothing closes without proof.",
         "detail": "One ticketing system for every project, personal and professional. Tickets are Markdown files in git. Done means evidence, an explicit approval and a lesson. I use it on my own projects; it is not packaged for anyone else yet.",
         "stack": ["Python", "Markdown + git", "FastAPI", "htmx"],
         "open": "The CLI, the Markdown ticket format, the local web app and the lesson library, self-hosted",
         "paid": "Hosted sync across machines, AI-agent seats, lessons matched across projects, and proof captured from CI",
         "code": None, "jai": "desk"},
        {"id": "lightinglab", "name": "Lighting Lab", "status": "Preview", "accent": "#B9A5FF", "mark_img": "lighting-lab.svg",
         "line": "A keyboard lighting editor: anchors, backgrounds and reactions, layered.",
         "detail": "A keyboard RGB editor with a preset gallery, a physical keyboard preview, live Razer Chroma control and exportable presets. 12 presets.",
         "stack": ["Node", "JavaScript", "C#"],
         "open": "Editor, presets, preview and JSON export (GPL-3.0)",
         "paid": "A Windows player, keyboard firmware export and app-based profiles",
         "code": "https://github.com/jameseby21/lighting-lab", "jai": "lightinglab"},
        {"id": "quorum", "name": "Quorum", "status": "Idea", "accent": "#FFB547", "mark": "Q",
         "line": "Group payments where everyone's in, or nobody's charged. Working name.",
         "detail": "The idea: each member's card is held for their share, and charged only if enough people commit by the deadline, so nobody fronts the money. A written spec, nothing built.",
         "stack": ["Postgres", "Stripe"],
         "open": "Planned: the commitment engine (Apache-2.0)", "paid": "Planned: a hosted app",
         "code": None, "jai": "quorum"},
        {"id": "appforge", "name": "AppForge", "status": "In build", "accent": "#FF7A1A", "mark": "A",
         "line": "An app that makes apps: every defect becomes a case, a rule and a test.",
         "detail": "The method behind how I build with AI coding agents. jRE and Plantriloquist were built with it. It is not packaged as a product.",
         "stack": ["AI agents", "Testing"],
         "open": "The method and its reusable skills", "paid": "Setup and coaching for teams, through JA Insights",
         "code": None, "jai": "appforge"},
        {"id": "jebyus", "name": "jeby.us", "status": "Live", "accent": "#E3262F", "mark": "ȷ",
         "line": "This site: plain HTML, no framework, no trackers.",
         "detail": "Static pages generated from one content file, with native page transitions and no tracking.",
         "stack": ["HTML", "CSS", "JavaScript", "Python"],
         "open": "Everything", "paid": None, "code": "https://github.com/jameseby21/jeby-us", "jai": None},
    ]},
]

# Free things that bring people in. Featured on Home, in the footer and in the family strip.
QR = {
    "title": "Turn your image into a QR code",
    "lede": "A pet, a logo, a painting, a photo of your street. The first AI-made versions I tried looked right and didn't scan. This prompt has the AI build a real QR code, blend your image into it, and test it before it hands it over.",
    "card": "A prompt that asks your chat AI to blend your image into a QR code and test it. Drew was the first.",
    "will_it_work": [
        "It needs an assistant that can run code inside the chat. Several of the big ones can, usually on a paid plan or with a setting switched on; check yours.",
        "An assistant that can only chat or draw may still try. It will probably give you something that looks like a QR code and doesn't scan, or a plain one with no picture in it. If it says it can't run code, that is the honest answer.",
        "Nothing here is promised to scan. Point your phone at the result before you print it, and say what happened if it didn't.",
    ],
    # DRAFT: James approves this wording before it goes live (Joe offered to test it first).
    "prompt": """Make me a QR code with my image blended in, and do all of it yourself here in this chat. Don't send me setup steps, and don't draw it as a picture: image models can't reliably draw a QR code that scans. Use your own code tool with the libraries it already has. If you can't run code here, tell me that now and stop.

Goal: a QR code for [YOUR URL] with my image blended in, that still scans on an ordinary phone camera.

1. Generate a real QR code for [YOUR URL] with error correction level H and a quiet zone (white border) of at least 4 modules.
2. Load my image [ATTACHED]. Crop it square and raise the contrast.
3. Blend: draw each module as a dot about 60% of its size over the image, dark modules dark and light modules light, so the image shows between the dots. Leave these exactly as generated, with no image behind them: the three corner squares, the alignment squares, the timing lines, the format information and the white border.
4. Test: decode the result with whatever QR decoder your code tool has. Also decode a copy shrunk to 300 px and a slightly blurred copy. If any decode fails or returns anything except [YOUR URL], make the dots bigger or the contrast stronger and try again, up to 10 times.
5. Give me the PNG, and tell me which decoders you used and what each returned. If it never passes, say so and give me the plain QR code instead. Never tell me it scans unless your own test decoded it.""",
}
