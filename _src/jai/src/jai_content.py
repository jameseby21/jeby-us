"""All JA Insights copy and data. Prices are hours x RATE, computed in build.py, never typed twice.
Items marked DRAFT are proposals waiting for James's approval."""
CONFIG = {
    "email": "jeby@jainsights.com",            # switch to hello@jainsights.com once the alias exists
    "rate": 95,                                # DRAFT: one published hourly rate
    "report_rows": 10000, "report_cols": 12,     # free report limits; the paid Data health check has none
    "booking": {"provider": "email",           # "email" | "cal" | "calendly" | "form"; Cal.com + Stripe is the default plan
                "cal": "", "calendly": "", "form": ""},
    "linkedin": "https://www.linkedin.com/in/jeby-d",
}

HERO = {
    "label": "JA Insights · Data consulting",
    "title": "Data work you can <em>check</em>.",
    "lede": ("Dashboards, analysis and automation for small businesses and teams. Every number shows where it came from, "
             "every price shows its math, and everything built for you stays yours."),
}

FACTS = [("$95", "one hourly rate, for everything"), ("Hours × rate", "how every quote is built"),
         ("100%", "of the code and data stays yours"), ("1 business day", "to hear back")]  # DRAFT: reply time

# Service lines. Each has a tab on Services; the first three also sit on Home.
LINES = [
    {"id": "dashboards", "tab": "Dashboards", "title": "Dashboards and reporting",
     "line": "One trusted place to see the numbers you already argue about.",
     "body": "Power BI, Looker or Excel, built on your data and checked against it, with a short guide so your team can keep it running.",
     "does": ["A data model you can read, with each measure written down", "Row-level security when different people should see different things",
              "Scheduled refresh, with a warning when it fails", "A handover session, recorded"],
     "fit": "You have the data somewhere, in spreadsheets, a POS, a CRM or a database, and nobody trusts the totals.",
     "nofit": "You need a large team on site next week. JA Insights is one senior analyst, and you'll know that before you sign.",
     "tools": "Power BI · DAX · Looker · Excel · SQL", "from": "dashboard"},
    {"id": "analysis", "tab": "Analysis", "title": "Analysis and forecasting",
     "line": "A straight answer to a specific question, with the uncertainty stated.",
     "body": "Pricing, demand, churn, staffing, valuation. A written answer, the code that produced it, and how sure the answer is.",
     "does": ["A one-page answer first, with the detail behind it", "Ranges, not single numbers pretending to be certain",
              "Code you can rerun next quarter", "A plain list of what would change the answer"],
     "fit": "You have a decision coming and want evidence, not a deck.",
     "nofit": "The answer has already been chosen and needs a chart to support it.",
     "tools": "Python · R · regression · forecasting · experiment design", "from": "analysis"},
    {"id": "automation", "tab": "Automation", "title": "Automation and data cleanup",
     "line": "The report someone rebuilds by hand every Monday, built once.",
     "body": "Pipelines that pull, clean and check your data on a schedule, so the copy-and-paste work stops and the errors stop with it.",
     "does": ["Imports from the tools you already use", "Checks that flag duplicates, gaps and impossible values",
              "A log of every run", "Documentation a successor can follow"],
     "fit": "Someone on your team spends hours a week moving numbers between files.",
     "nofit": "You need a full software product. That's a bigger build, and it's quoted as one.",
     "tools": "Python · SQL · Postgres · Power Automate · scheduled jobs", "from": "automation"},
    {"id": "training", "tab": "Training", "title": "Training for teams",
     "line": "Teach your people to do it themselves.",
     "body": "Hands-on workshops in Power BI, SQL, Python and fraud analytics, built on your own data where you can share it.",
     "does": ["A half-day or full-day format", "Exercises on your data, or realistic stand-ins", "Notes and recordings your team keeps",
              "Fraud-detection material from the open learningLabs data analysis course"],
     "fit": "You'd rather grow the skill in house than rent it forever.",
     "nofit": "You want a certificate program. These are working sessions.",
     "tools": "Power BI · SQL · Python · R · Excel", "from": "workshop"},
]

# Packages: hours are the only number typed; prices are computed. DRAFT: all hours.
PACKAGES = [
    {"id": "health", "name": "Data health check", "hours": 8, "monthly": False,
     "what": "A read-through of your data sources and reports, and a written list of what's wrong and what to fix first."},
    {"id": "dashboard", "name": "Dashboard sprint", "hours": 25, "monthly": False,
     "what": "One dashboard on a data source that's already in decent shape, plus a recorded handover."},
    {"id": "analysis", "name": "Focused analysis", "hours": 20, "monthly": False,
     "what": "One question answered in writing, with the code and the uncertainty."},
    {"id": "automation", "name": "Report automation", "hours": 16, "monthly": False,
     "what": "One recurring manual report rebuilt as a scheduled, checked pipeline."},
    {"id": "workshop", "name": "Team workshop, half day", "hours": 10, "monthly": False,
     "what": "Four hours with up to 12 people. The other six hours are preparation and materials."},
    {"id": "bisetup", "name": "Small-business BI setup", "hours": 70, "monthly": False,
     "what": "A data model, two to four dashboards and refresh, for teams under 50 people."},
    {"id": "care", "name": "Care plan", "hours": 10, "monthly": True,
     "what": "Ten hours a month for fixes, changes and questions. Unused hours roll over one month."},
]

MARKET = {  # for the honest comparison on Approach
    "source": ("ECOSIRE, Power BI implementation cost 2026", "https://ecosire.com/blog/power-bi-implementation-cost-2026"),
    "rows": [("Freelance generalist", "$40–80"), ("Regional consultancy, US/EU", "$120–180"), ("Big-four advisory", "$250–450")],
    "dash": "$2,000–6,000 for a single dashboard on a clean source", "smb": "$5,000–25,000 for a small-business setup",
}

STEPS = [("Intro call", "30 minutes, free. What you need, and whether this is the right fit.", "Day 1"),  # DRAFT: free intro
         ("Written quote", "Scope, hours, rate and total. Fixed unless the scope changes, and you approve any change in writing.", "Within 2 business days"),
         ("Build in the open", "A shared folder from day one and a short update every week.", "As quoted"),
         ("Handover", "Everything transferred to you: files, code, logins and a recorded walkthrough.", "Last day")]

PRINCIPLES = [
    ("Show the source", "Every figure in a report links back to where it came from. If a number can't be traced, it doesn't ship."),
    ("Price the hours", "One rate, published. A quote is the hours times the rate, and you can see both."),
    ("Say how sure", "Forecasts come with ranges. Some answers are “we can't tell yet,” and you'll hear that early."),
    ("You own it", "The code, the data model and the documents are yours. No lock-in, no licence back to me."),
    ("Small on purpose", "One senior analyst, so you always talk to the person doing the work."),
    ("Open by default", "Most tools behind this work are free and public at jebyLabs. You pay for time, care and hosting."),
]

FAQ = [  # DRAFT: all policy answers
    ("Is it just you?", "Yes. JA Insights is James Eby. If a project needs more hands, you'll hear that before any quote, along with who else would be involved."),
    ("Why publish the rate?", "So you can compare before we talk. The rate sits between freelance generalists and regional consultancies; the comparison and its source are on this page."),
    ("What if the work takes longer than quoted?", "The quote holds. If the scope changes, you get a written change with the new hours before any extra work starts."),
    ("How do I pay?", "Projects: half to start, half on handover. Care plans: monthly, cancel any time. Card or bank transfer."),
    ("Who owns what you build?", "You do: code, data model, documentation and dashboards. I keep only general know-how and the open-source tools I already published."),
    ("Do you sign an NDA?", "Yes, before you share anything sensitive. Client data stays in your systems whenever that's possible."),
    ("Do you work outside Miami?", "Yes. Most work is remote. On-site visits in South Florida are included; travel elsewhere is billed at cost."),
]

ABOUT = {
    "lede": "JA Insights is a one-person data consultancy in Miami, run by James Eby.",
    "facts": [("Legal name", "JA Insights LLC"), ("Based", "Miami, Florida"), ("Works", "Remote, and on site in South Florida"),
              ("Languages", "English and Spanish"), ("Founder", "James Eby, B.S. Statistics, Carnegie Mellon"),
              ("Part of", "the jeby family: jeby.us, jebyLabs and jeby Real Estate")],
    "founder": ("James Eby", "Known as jeby in tech. A statistics degree from Carnegie Mellon, six years building analytics teams and BI platforms, "
                "and an undergraduate poster on weighing galaxy clusters. When the right tool doesn't exist, he builds it. More on jeby.us."),
}

# Paid editions of jebyLabs projects; the free edition lives on jeby.us/lab. Statuses are honest about what is for sale today.
PRODUCT_NOTES = {
    "jre": ("Advisory now · data products in development", True),
    "learninglabs": ("Team training now · hosted workspace planned", True),
    "appforge": ("Setup and coaching now", True),
    "musicalgames": ("Planned", False), "plantriloquist": ("Planned", False),
    "lightinglab": ("Planned", False), "quorum": ("Planned", False),
    "desk": ("In development", False),
}
