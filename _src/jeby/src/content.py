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

DISCIPLINES = ["Statistics", "Software", "Business intelligence", "Teaching", "Astrophysics", "Real estate", "Music games"]

ABOUT_SHORT = ("I studied statistics at Carnegie Mellon, spent six years building analytics teams "
               "from scratch, and I can't leave a hard problem alone, whether it's a churn model, a galaxy cluster or a houseplant that talks back. "
               "I live in Miami and work in English and Spanish.")

ABOUT_LONG = [
    "I'm James Eby, jeby for short. I'm a statistician by training, a builder by habit and a teacher by choice.",
    "At Carnegie Mellon I studied statistics with a computer science concentration, and my undergraduate research asked whether the way astronomers weigh galaxy clusters was quietly double-counting its data. It was.",
    "Since then I've founded two analytics functions, led a company-wide Power BI rollout, moved a data warehouse to Snowflake, and mentored the analysts who now run those systems. Along the way I kept teaching: about ten years of tutoring, a coding camp for kids, and college TA work.",
    "Today I run JA Insights, my data practice, and jebyLabs, where the side projects live: a real-estate analytics platform, a band game that turns any song into a chart, keyboard lighting software, and a Raspberry Pi houseplant with opinions.",
]
FACTS = [("Based", "Miami, FL"), ("Roots", "Nicaraguan"), ("Studied", "B.S. Statistics, Carnegie Mellon, 2019"), ("Speaks", "English, Spanish, some French"),
         ("Off the clock", "Gunsmithing and machining, golf, SCUBA, archery, kayaking with Drew, and brisket on the Big Green Egg")]

DREW = {
    "title": "Drew",
    "role": "Chief Morale Officer",
    "short": "My dog, the face on my QR codes, and the reason most of what I build ships with a little tongue out.",
}

# The story (About page, #story). DRAFT: every line is for James to check; only facts he has stated are used.
# HEALTH_DETAIL is James's own words about his health, as much or as little as he wants. Empty = the sentence is left out.
HEALTH_DETAIL = "The health part is real: open-heart surgery, a Bentall procedure, a new mechanical heart valve, and a kidney transplant may be next."
STORY = {
    "title": "The story so far",
    "chapters": [
        {"when": "2015", "head": "A problem I couldn't leave alone",
         "body": "My undergraduate research at Carnegie Mellon asked whether the way astronomers weigh galaxy clusters was quietly counting the same data more than once. It was. That's still my favorite kind of problem: one where the accepted answer is a little bit wrong and nobody has checked."},
        {"when": "2019 – 2025", "head": "Building teams from nothing",
         "body": "Six years in business intelligence. I founded two analytics functions, led a company-wide Power BI rollout, moved a warehouse to Snowflake, and mentored the analysts who run those systems now. I kept teaching the whole way: about ten years of tutoring, a coding camp for kids, and college TA work."},
        {"when": "2025 – now", "head": "Then my health stepped in", "break": True,
         "body": "In 2025 the startup where I'd built the analytics function ran out of money while I was in the hospital, and the job went with it.",
         "after": "I couldn't choose that part. I could choose what to do with the time I had."},
        {"when": "Since then", "head": "So I kept building",
         "body": "The Lab now holds more than a dozen projects: a real-estate analytics platform, a free learning library that starts with a data analysis course, keyboard lighting software, a band game, a houseplant that roasts your friends, and the galaxy research, rebuilt. Every one of them gets a free version. Along the way I worked out a way of building with AI coding agents where every mistake becomes a test, so it can't happen twice."},
        {"when": "Next", "head": "What I'm after",
         "body": "Happiness is the goal, and trying new things is what makes me happy. Right now that means teaching again, taking on data work through JA Insights, and finding my next role leading a BI team. Drew handles morale."},
    ],
}
SUPPORT = {
    # Pick any providers; an empty URL shows the option as "setting up" in previews and hides it in production.
    "providers": [("GitHub Sponsors", ""), ("Ko-fi", ""), ("Open Collective", ""), ("One-time card payment", "")],
    "note": "Sponsorships go to me personally and keep the open projects free and maintained. I'm not a charity, so they aren't tax-deductible.",
    "share_url": "https://jeby.us/about#story",
}
PREVIEW_SLOTS = False  # show empty draft slots and unconfigured providers in previews; set False before deploy

NOW = [
    ("Teaching", "Opening tutoring in math, SAT, statistics and data analysis, plus a first-job mentorship program."),
    ("jRE", "Building the analytics layer: forecasting and valuation for Miami Springs and Virginia Gardens."),
    ("Research", "Returning to galaxy-cluster masses, ten years after the poster."),
    ("Lab", "Sketching a band game that turns any song into a playable chart."),
    ("Work", "Open to Director and Manager of BI roles."),
]

PRO = {
    "headline": "Business intelligence, data science, and the teams behind them.",
    "summary": ("Business intelligence leader and data scientist with 6+ years turning ambiguous business questions into strategy, data infrastructure, "
                "statistical models, and customer-facing analytics. Statistics training from Carnegie Mellon paired with hands-on software engineering. "
                "Founded two analytics functions, mentors analysts, and works directly with executives and clients. Bilingual English and Spanish."),
    "stats": [("6+", "years in BI and data science"), ("2", "analytics functions founded"), ("~1,000", "webinar attendees reached"), ("2", "languages, native")],
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
     "lead": "Founded AQ Data; built churn health scores and presented to about 1,000 webinar attendees.",
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
     "note": "Taught by someone who has run analytics teams, not from a textbook.",
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
       ("How do I pay?", "Through a secure payment link before the session. Packs are paid up front and don't expire for six months."),
       ("What's the cancellation policy?", "Reschedule for free up to 24 hours ahead. Later cancellations count as a session."),
       ("Do you work with younger students?", "Yes. For students under 18, a parent books, stays in the loop, and nothing is recorded without written consent.")]

# ---------------------------------------------------------------- Lab
# Every project. "open" = the free jebyLabs version; "paid" = the supported version sold through JA Insights.
LAB = [
    {"group": "Data and analytics", "items": [
        {"id": "jre", "name": "jRE", "status": "Prototype · v0.4", "accent": "#2EC4B6", "mark": "jR",
         "line": "Miami real-estate analytics where every number shows its source.",
         "detail": "A property database for Miami Springs and Virginia Gardens built around each lot's full history: owners, sales, features and valuations over time, with a review queue for records that look wrong.",
         "stack": ["PostgreSQL 16", "FastAPI", "Angular", "Docker", "scikit-learn"],
         "open": "Schema, app scaffold, synthetic-data generator, review workflow and data-intake framework",
         "paid": "Curated South Florida data, valuation and comparable-homes engines, market scores, advisory",
         "code": None, "jai": "jre"},
        {"id": "learninglabs", "name": "learningLabs", "status": "Open source · 164 tests", "accent": "#83DFC1", "mark": "L",
         "line": "A free learning library. First up: a data analysis course, with fraud detection as one of its case studies.",
         "detail": "The data analysis course runs in Python, R, Power BI and Excel. Its fraud-detection case study comes with a library of resolved real cases, an investigation game and a public-data intake desk, all on the Python standard library. More labs are planned beyond data.",
         "stack": ["Python", "R", "Power BI", "JavaScript"],
         "open": "Courses, case library, the game and all original data (GPL-3.0 and CC0)",
         "paid": "A hosted workspace for the course's investigations, and team training through JA Insights",
         "code": "https://github.com/jameseby21/Become-a-Data-Analyst", "jai": "learninglabs"},
        {"id": "research", "name": "Galaxy-cluster masses", "status": "Research · active", "accent": "#4084FF", "mark": "σ",
         "line": "Weighing galaxy clusters by how their galaxies move, revisited ten years on.",
         "detail": "The 2015 Carnegie Mellon poster, rebuilt as an animated slideshow, and a new public repository for the follow-up work.",
         "stack": ["Python", "R", "Statistics"],
         "open": "Everything: code, figures and data cards", "paid": None, "code": None, "jai": None, "page": "research.html"},
        {"id": "cellcount", "name": "Cell-count pipeline", "status": "Case study", "accent": "#9C8CFF", "mark": "C",
         "line": "CSV to a normalized database to a dashboard, in one command.",
         "detail": "Loads 52,500 measurements from 10,500 samples into a normalized SQLite schema, then summarizes them in tables, plots and a Streamlit dashboard. Written as a take-home exercise.",
         "stack": ["Python", "pandas", "SQLite", "Streamlit"],
         "open": "Shared on request", "paid": None, "code": None, "jai": None},
    ]},
    {"group": "For small businesses", "items": [
        {"id": "route-optimizer", "name": "Route optimizer", "status": "Planned · free", "accent": "#3FA7D6", "mark": "R",
         "line": "Route planning for businesses whose day is a list of stops. Free.",
         "detail": "Put in the day's stops and get a sensible order to drive them in, without a routing subscription. Built for small route-based businesses, through JA Insights.",
         "stack": ["Python", "Maps"],
         "open": "The free tool", "paid": None, "code": None, "jai": None},
        {"id": "driver-tracking", "name": "Driver tracking", "status": "Planned · free", "accent": "#5C7CFA", "mark": "D",
         "line": "Driver tracking for small businesses with several drivers and no software budget. Free.",
         "detail": "Where each driver is and what's done, for a team of a few drivers rather than a fleet department. Built through JA Insights.",
         "stack": ["Python", "Maps"],
         "open": "The free tool", "paid": None, "code": None, "jai": None},
    ]},
    {"group": "For dogs and their people", "items": [
        {"id": "territory", "name": "Dog territory app", "status": "Planned · working name", "accent": "#F2994A", "mark": "T",
         "line": "A dog game and network for walks: claim territory, leave scent marks, keep dogs safe. Working name.",
         "detail": "Walks claim ground on a hex map and scent marks become a game between dogs on the same streets. The safety side keeps a lost-pet kit and reactive-dog warnings one tap away.",
         "stack": ["Mobile", "Maps"],
         "open": "The app, free", "paid": None, "code": None, "jai": None},
    ]},
    {"group": "Games and music", "items": [
        {"id": "musicalgames", "name": "MusicalGames", "status": "Working build", "accent": "#FFCC33", "mark_img": "musicalgames.svg",
         "line": "A full-band rhythm game with karaoke, real guitars and keyboards, and charts made from any audio.",
         "detail": "One app for full-band rhythm games, karaoke with pitch scoring, a Guitar Room for real instruments, and a party mode where friends add songs by scanning a QR code. Working title.",
         "stack": ["Python", "JavaScript", "MIDI"],
         "open": "The app, chart generation from your own audio, karaoke and party mode",
         "paid": "A one-time purchase, with an optional subscription for updates and new features",
         "code": None, "jai": "musicalgames"},
    ]},
    {"group": "Hardware", "items": [
        {"id": "plantriloquist", "name": "Plantriloquist", "status": "v0.1 · bench hardware", "accent": "#5FD38D", "mark_img": "plantriloquist.png",
         "line": "A Raspberry Pi hidden in a plant pot that listens, and roasts your friends in English or Spanish.",
         "detail": "A provider-neutral talking-character engine: speech recognition, a comedy engine and neural voices, with a simulator and a control panel. First character: Potty Mouth.",
         "stack": ["Python", "Raspberry Pi", "faster-whisper", "Piper"],
         "open": "Character engine, simulator, control panel and the offline voice path",
         "paid": "Character and voice packs, hosted AI responses, a ready-made hardware kit",
         "code": None, "jai": "plantriloquist"},
    ]},
    {"group": "Tools and software", "items": [
        {"id": "desk", "name": "Desk", "status": "Mockup · build starting", "accent": "#C8F03C", "mark_img": "desk.svg",
         "line": "Tickets that can't close without proof, and every fix leaves a lesson behind.",
         "detail": "One ticketing system for every project, personal and professional. Tickets are Markdown files in git. Done means evidence, an explicit approval and a lesson, and Drew digs up old lessons when a new problem looks familiar.",
         "stack": ["Python", "Markdown + git", "FastAPI", "htmx"],
         "open": "The CLI, the Markdown ticket format, the local web app and the lesson library, self-hosted",
         "paid": "Hosted sync across machines, AI-agent seats, lessons matched across projects, and proof captured from CI",
         "code": None, "jai": "desk"},
        {"id": "lightinglab", "name": "Lighting Lab", "status": "v0.2 · open source", "accent": "#B9A5FF", "mark_img": "lighting-lab.svg",
         "line": "Keyboard lighting you can actually design: anchors, backgrounds and reactions, layered.",
         "detail": "A keyboard RGB editor with a preset gallery, a physical keyboard preview, live Razer Chroma control and exportable presets. 12 presets, 120 automated checks.",
         "stack": ["Node", "JavaScript", "C#"],
         "open": "Editor, presets, preview and JSON export (GPL-3.0)",
         "paid": "A Windows player, keyboard firmware export and app-based profiles",
         "code": "https://github.com/jameseby21/lighting-lab", "jai": "lightinglab"},
        {"id": "quorum", "name": "Quorum", "status": "Spec", "accent": "#FFB547", "mark": "Q",
         "line": "Group payments where everyone's in, or nobody's charged. Working name.",
         "detail": "Each member's card is held for their share, and charged only if enough people commit by the deadline. Nobody fronts the money.",
         "stack": ["Postgres", "Stripe"],
         "open": "The commitment engine (Apache-2.0)", "paid": "The hosted app, with a small per-person fee shown up front",
         "code": None, "jai": "quorum"},
        {"id": "appforge", "name": "AppForge", "status": "In use", "accent": "#FF7A1A", "mark": "A",
         "line": "An app that makes apps: every defect becomes a case, a rule and a test.",
         "detail": "The method behind how I build with AI coding agents. jRE and Plantriloquist run on it today.",
         "stack": ["AI agents", "Testing"],
         "open": "The method and its reusable skills", "paid": "Setup and coaching for teams, through JA Insights",
         "code": None, "jai": "appforge"},
        {"id": "jebyus", "name": "jeby.us", "status": "Live", "accent": "#E3262F", "mark": "ȷ",
         "line": "This site: plain HTML pages, no framework, built in the open.",
         "detail": "Static pages generated from one content file, with native page transitions and no tracking.",
         "stack": ["HTML", "CSS", "JavaScript", "Python"],
         "open": "Everything", "paid": None, "code": "https://github.com/jameseby21/jeby-us", "jai": None},
    ]},
]

# Free things that bring people in. Featured on Home, in the footer and in the family strip.
QR = {
    "title": "How I turned my dog into a QR code that actually scans",
    "lede": "The first AI-made versions looked right and didn't scan. This prompt fixes that: it has the AI write code that builds a real QR code, blends your picture in, and tests that it scans before handing it over.",
    # DRAFT: James approves this wording before it goes live (Joe offered to test it first).
    "prompt": """Write and run code for this. Don't draw it: image models can't reliably draw a QR code that scans.

Goal: a QR code for [YOUR URL] with my picture blended in, that still scans on an ordinary phone camera.

1. Generate a real QR code for [YOUR URL] in Python with the segno or qrcode library. Use error correction level H and a quiet zone (white border) of at least 4 modules.
2. Load my picture [ATTACHED]. Crop it square and raise the contrast.
3. Blend: draw each module as a dot about 60% of its size over the picture, dark modules dark and light modules light, so the picture shows between the dots. Leave these exactly as generated, with no picture behind them: the three corner squares, the alignment squares, the timing lines, the format information and the white border.
4. Test: decode the result with two different decoders, for example OpenCV and zxing-cpp. Also decode a copy shrunk to 300 px and a slightly blurred copy. If any decode fails or returns anything except [YOUR URL], make the dots bigger or the contrast stronger and try again, up to 10 times.
5. Give me the PNG at 2000 px, the code, and every decode result. If it never passes, say so and give me the plain QR code instead. Never tell me it scans unless your own test decoded it.""",
}
