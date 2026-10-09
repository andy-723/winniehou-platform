import os
from core import db, hash_password, verify_password, new_id, now_iso, slugify

IMG = {
    "hero": "https://images.unsplash.com/photo-1637589267610-6c66fc2a086b?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "meeting": "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "present": "https://images.unsplash.com/photo-1580894732444-8ecded7900cd?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "collab": "https://images.unsplash.com/photo-1581091877018-dac6a371d50f?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "book": "https://images.unsplash.com/photo-1621944190310-e3cca1564bd7?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
    "notebook": "https://images.unsplash.com/photo-1696960190602-7389f3b24a22?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
}
VID = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/"


def lesson(title, mins, video, preview=False, content=""):
    return {"id": new_id(), "title": title, "duration_minutes": mins, "video_url": VID + video, "bunny_video_id": "",
            "is_preview": preview, "attachments": [], "order": 0,
            "content": content or f"<h3>About this lesson</h3><p>In <strong>{title}</strong> you will practise the exact phrases senior professionals use, with model answers and a short self-check at the end.</p><ul><li>Key vocabulary and collocations</li><li>Register: formal vs. conversational</li><li>Practice script to record yourself</li></ul>"}


def module(title, desc, lessons):
    for i, l in enumerate(lessons):
        l["order"] = i
    return {"id": new_id(), "title": title, "description": desc, "lessons": lessons, "order": 0}


COURSES = [
    {"title": "Executive Presence: Speak with Authority", "subtitle": "Command the room in meetings, pitches and boardrooms.",
     "level": "Advanced", "topics": ["Presentations", "Leadership"], "price": 24900, "thumbnail_url": IMG["present"],
     "duration_hours": 6.5, "published": True,
     "outcomes": ["Open and close high-stakes presentations with confidence", "Handle hostile questions gracefully",
                  "Use rhetorical structure native executives rely on", "Eliminate filler and hedging language"],
     "audience": ["Senior professionals who already speak English and want to sound like a leader",
                  "Managers who present to executives, boards, or clients",
                  "Anyone who hedges, fills silence, or loses the room in Q&A"],
     "description": "<p>A six-module masterclass for senior professionals who already speak good English but want to <em>sound like a leader</em>. Winnie breaks down the language patterns of Fortune 500 executives and gives you repeatable frameworks.</p>",
     "modules": [
         module("Foundations of Executive Voice", "Pace, pause and precision.", [
             lesson("Welcome & how to use this course", 6, "BigBuckBunny.mp4", True),
             lesson("The three pillars of authority", 14, "ElephantsDream.mp4"),
             lesson("Eliminating hedging language", 12, "ForBiggerBlazes.mp4")]),
         module("Structuring a Powerful Message", "Frameworks that make you memorable.", [
             lesson("The PREP framework", 15, "ForBiggerEscapes.mp4"),
             lesson("Signposting for clarity", 11, "ForBiggerFun.mp4"),
             lesson("Closing with a call to action", 9, "ForBiggerJoyrides.mp4")]),
         module("Handling Q&A Under Pressure", "Stay composed when challenged.", [
             lesson("Bridging techniques", 13, "ForBiggerMeltdowns.mp4"),
             lesson("Buying time elegantly", 8, "Sintel.mp4"),
             lesson("Final assessment & next steps", 10, "TearsOfSteel.mp4")]),
     ]},
    {"title": "Business Email Mastery", "subtitle": "Write emails that get answered — fast, clear and polite.",
     "level": "Intermediate", "topics": ["Writing", "Email"], "price": 12900, "thumbnail_url": IMG["collab"],
     "duration_hours": 4, "published": True,
     "outcomes": ["Write concise emails in under 5 minutes", "Master tone: direct yet diplomatic",
                  "Templates for requests, follow-ups and bad news", "Avoid the 12 most common non-native mistakes"],
     "audience": ["Professionals who write in English every day and want a reply, not silence",
                  "Non-native writers who are polite but unclear",
                  "Teams that want one standard for requests, follow-ups, and bad news"],
     "description": "<p>The most-requested course by Winnie's corporate clients. Every lesson comes with downloadable templates you can adapt immediately.</p>",
     "modules": [
         module("Email Fundamentals", "Subject lines, openers and structure.", [
             lesson("Subject lines that get opened", 9, "BigBuckBunny.mp4", True),
             lesson("Openers and closers by register", 12, "ElephantsDream.mp4"),
             lesson("The 5-sentence rule", 10, "ForBiggerBlazes.mp4")]),
         module("Difficult Messages", "Saying no, chasing, and apologising.", [
             lesson("Polite follow-ups that work", 11, "ForBiggerEscapes.mp4"),
             lesson("Delivering bad news", 13, "ForBiggerFun.mp4"),
             lesson("Apologising without over-apologising", 8, "ForBiggerJoyrides.mp4")]),
     ]},
    {"title": "Negotiation English for Deal-Makers", "subtitle": "The language of leverage, concessions and agreement.",
     "level": "Advanced", "topics": ["Negotiation", "Meetings"], "price": 19900, "thumbnail_url": IMG["meeting"],
     "duration_hours": 5, "published": True,
     "outcomes": ["Open negotiations from a position of strength", "Make and refuse concessions diplomatically",
                  "Read and use conditional language precisely", "Summarise and close agreements"],
     "audience": ["Deal-makers working across borders",
                  "People who need precise conditional language in live negotiations",
                  "Professionals who freeze when a negotiation stalls"],
     "description": "<p>Built from real transcripts of cross-border deals. Learn how native negotiators soften, strengthen and steer.</p>",
     "modules": [
         module("Setting the Table", "Agendas, positions and interests.", [
             lesson("Course overview", 5, "BigBuckBunny.mp4", True),
             lesson("Stating positions vs. interests", 14, "Sintel.mp4"),
             lesson("Conditional language: if, provided that, unless", 12, "TearsOfSteel.mp4")]),
         module("Trading Concessions", "Give a little, get a lot.", [
             lesson("Softening and strengthening", 11, "ForBiggerMeltdowns.mp4"),
             lesson("Deadlock breakers", 10, "ElephantsDream.mp4"),
             lesson("Closing and summarising", 9, "ForBiggerBlazes.mp4")]),
     ]},
    {"title": "Small Talk & Networking Confidence", "subtitle": "Turn awkward silences into real connections.",
     "level": "Beginner", "topics": ["Speaking", "Networking"], "price": 7900, "thumbnail_url": IMG["hero"],
     "duration_hours": 3, "published": True,
     "outcomes": ["Start conversations naturally at events", "Keep conversations flowing with follow-up questions",
                  "Exit conversations gracefully", "Culture tips for global teams"],
     "audience": ["Beginners who go quiet at conferences and in the office",
                  "Professionals joining a global team",
                  "Anyone who wants a way into a conversation and a graceful way out"],
     "description": "<p>Perfect for professionals who freeze at conferences or in the office kitchen. Short, practical, and immediately useful.</p>",
     "modules": [
         module("Starting Conversations", "Icebreakers that don't feel forced.", [
             lesson("Why small talk matters", 6, "ForBiggerFun.mp4", True),
             lesson("Safe topics and openers", 10, "ForBiggerJoyrides.mp4"),
             lesson("Active listening phrases", 9, "ForBiggerEscapes.mp4")]),
     ]},
]

PRODUCTS = [
    {"title": "Business Email Templates Workbook", "price": 2900, "image_url": IMG["book"], "kind": "workbook",
     "description": "48 fill-in-the-blank email templates covering requests, follow-ups, escalations and bad news. PDF, 62 pages."},
    {"title": "Executive Vocabulary Builder", "price": 1900, "image_url": IMG["notebook"], "kind": "workbook",
     "description": "500 high-impact collocations organised by business scenario, with example sentences and audio links. PDF."},
    {"title": "Negotiation Phrasebook", "price": 2400, "image_url": IMG["meeting"], "kind": "workbook",
     "description": "Every phrase from the Negotiation course, organised by stage, plus 10 practice dialogues."},
]

POSTS = [
    {"title": "Five Phrases That Instantly Make You Sound More Senior", "tags": ["Speaking", "Leadership"], "cover_url": IMG["present"],
     "excerpt": "Small changes in phrasing signal big changes in authority. Here are five swaps I teach every executive client.",
     "content": "<p>After coaching hundreds of professionals, I've noticed the same pattern: competent people undersell themselves with language.</p><h2>1. Replace \"I think\" with \"In my assessment\"</h2><p>It signals that you've done the analysis.</p><h2>2. Drop \"just\"</h2><p>\"I just wanted to check\" becomes \"I'm checking on\". Shorter and stronger.</h2><h2>3. Use \"recommend\" not \"suggest\"</h2><p>Recommendations carry weight; suggestions can be ignored.</p><h2>4. Lead with the conclusion</h2><p>Senior people are busy. Give them the answer, then the reasoning.</p><h2>5. Own your pauses</h2><p>Silence reads as confidence. Fillers read as doubt.</p>"},
    {"title": "New Course: Negotiation English for Deal-Makers", "tags": ["Announcements"], "cover_url": IMG["meeting"],
     "excerpt": "My most requested topic is finally here — built from real cross-border deal transcripts.",
     "content": "<p>I'm thrilled to announce the launch of <strong>Negotiation English for Deal-Makers</strong>. Over the past year I collected transcripts (anonymised, with permission) from real negotiations and distilled the patterns into six practical modules.</p><p>Enrol this month and use code <strong>LAUNCH20</strong> for 20% off.</p>"},
]

SERVICE_PACKAGES = [
    {"key": "career-coaching-essentials", "name": "Career Coaching Essentials", "tagline": "[TAGLINE TO COME]",
     "price_cents": 210000, "gst_treatment": "ex_gst", "sort_order": 1, "cta_type": "book_call"},
    {"key": "interview-for-success", "name": "Interview for Success", "tagline": "[TAGLINE TO COME]",
     "price_cents": 210000, "gst_treatment": "ex_gst", "sort_order": 2, "cta_type": "book_call"},
    {"key": "business-english-quantum-leap", "name": "Business English Quantum Leap", "tagline": "[TAGLINE TO COME]",
     "price_cents": 385000, "gst_treatment": "inc_gst", "sort_order": 4, "cta_type": "enquire"},
]


async def seed_admin():
    email = os.environ["ADMIN_EMAIL"].lower()
    password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({"id": new_id(), "email": email, "name": "Winnie Hou", "role": "admin",
                                   "password_hash": hash_password(password), "created_at": now_iso(), "disabled": False})
    elif not verify_password(password, existing["password_hash"]) or existing.get("role") != "admin":
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password), "role": "admin"}})


async def seed_demo():
    if await db.courses.count_documents({}) == 0:
        for c in COURSES:
            for i, m in enumerate(c["modules"]):
                m["order"] = i
            await db.courses.insert_one({**c, "id": new_id(), "slug": slugify(c["title"]), "created_at": now_iso(),
                                         "updated_at": now_iso()})
    if await db.products.count_documents({}) == 0:
        for p in PRODUCTS:
            await db.products.insert_one({**p, "id": new_id(), "slug": slugify(p["title"]), "active": True,
                                          "file_id": "", "created_at": now_iso()})
    if await db.posts.count_documents({}) == 0:
        for p in POSTS:
            await db.posts.insert_one({**p, "id": new_id(), "slug": slugify(p["title"]), "published": True,
                                       "created_at": now_iso(), "published_at": now_iso()})
    if await db.coupons.count_documents({}) == 0:
        await db.coupons.insert_one({"id": new_id(), "code": "LAUNCH20", "kind": "percent", "value": 20, "max_uses": None,
                                     "expires_at": None, "active": True, "uses": 0, "created_at": now_iso()})
    if not await db.users.find_one({"email": "student@example.com"}):
        await db.users.insert_one({"id": new_id(), "email": "student@example.com", "name": "Demo Student", "role": "student",
                                   "password_hash": hash_password("Student123!"), "created_at": now_iso(), "disabled": False})


async def seed_services():
    for p in SERVICE_PACKAGES:
        await db.service_packages.update_one(
            {"key": p["key"]},
            {"$setOnInsert": {**p, "id": new_id(), "description": "[DESCRIPTION TO COME]",
                              "inclusions": ["[INCLUSIONS TO COME]"], "duration_label": "", "status": "published",
                              "currency": "AUD", "created_at": now_iso(), "updated_at": now_iso()}},
            upsert=True)


TIME_CATEGORIES = {
    "client": ["Coaching session", "CDP preparation", "Resume / LinkedIn review", "Mock interview", "Job search support", "Email / admin"],
    "student": ["Written activity review", "Q&A / support", "Live class", "Course admin"],
    "prospect": ["Discovery call", "CDP preparation", "Follow-up"],
    "internal": ["Content creation", "Marketing", "Business admin"],
}


async def seed_time():
    await db.service_packages.update_one({"key": "business-english-quantum-leap"}, {"$set": {"hours_included": 12}})
    await db.service_packages.update_many({"hours_included": {"$exists": False}}, {"$set": {"hours_included": None}})
    for st, names in TIME_CATEGORIES.items():
        for i, n in enumerate(names):
            await db.time_categories.update_one({"subject_type": st, "name": n},
                                                {"$setOnInsert": {"id": new_id(), "subject_type": st, "name": n, "order": i}}, upsert=True)


async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.sessions.create_index("id", unique=True)
    await db.sessions.create_index("user_id")
    await db.courses.create_index("id", unique=True)
    await db.courses.create_index("slug")
    await db.enrollments.create_index([("user_id", 1), ("course_id", 1)], unique=True)
    await db.progress.create_index([("user_id", 1), ("lesson_id", 1)], unique=True)
    await db.orders.create_index("id", unique=True)
    await db.orders.create_index("user_id")
    await db.payment_transactions.create_index("session_id", unique=True)
    await db.coupons.create_index("code", unique=True)
    await db.files.create_index("id", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await db.service_packages.create_index("key", unique=True)
    await db.coaching_clients.create_index("id", unique=True)
    await db.client_engagements.create_index("client_id")
    await db.time_entries.create_index("user_id")
    await db.time_entries.create_index("client_id")
    await db.time_entries.create_index("student_id")
    await db.time_categories.create_index([("subject_type", 1), ("name", 1)], unique=True)
