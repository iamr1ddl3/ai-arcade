#!/usr/bin/env python3
"""
AIdemy / TrainerCentral course scraper — text & lesson structure only.

Logs in with your credentials, walks a course (or every course inside a
bundle), and saves each lesson's title + text content locally as Markdown,
organized by course/module, plus one combined .md per course — ready to
feed to an LLM.

SETUP (run once):
    pip install playwright beautifulsoup4 html2text --break-system-packages
    playwright install chromium

USAGE:
    export TC_EMAIL="you@example.com"
    export TC_PASSWORD="yourpassword"        # omit to be prompted securely
    python3 scrape_trainercentral.py 23022000000014019

    # skip login (some course content on this site is public even
    # without logging in — the script will tell you if a course needs it):
    python3 scrape_trainercentral.py 23022000000014019 --no-login

The number is the course/bundle ID from the URL:
  https://aidemy.trainercentralsite.in/clientapp/app/course/<ID>/course-details
"""
import os
import re
import sys
import time
import getpass
from pathlib import Path

from playwright.sync_api import sync_playwright
import html2text

BASE = "https://aidemy.trainercentralsite.in"
OUT_DIR = Path("./tc_scrape_output")


def slugify(s: str) -> str:
    s = re.sub(r"[^\w\s-]", "", s or "").strip().lower()
    return re.sub(r"[-\s]+", "-", s)[:80] or "untitled"


def html_to_md(html: str) -> str:
    if not html:
        return ""
    h = html2text.HTML2Text()
    h.ignore_links = False
    h.body_width = 0
    return h.handle(html).strip()


def login(context, page, email: str, password: str) -> bool:
    page.goto(f"{BASE}/clientapp/login", wait_until="networkidle", timeout=45000)
    page.fill("#clientapp_signin_emailid", email)
    page.get_by_role("button", name="Next").click()

    # The password step is rendered inside a nested Zoho IAM iframe, not the
    # top-level page, so wait_for_selector on `page` never finds it.
    iam_frame = page.frame_locator("iframe[src*='/accounts/p/']")
    try:
        iam_frame.locator("#password").wait_for(state="visible", timeout=15000)
    except Exception:
        print("  ! password field never appeared — check the email is correct")
        return False
    iam_frame.locator("#password").fill(password)
    page.wait_for_timeout(1000)

    clicked = False
    for label in ["Sign In", "Login", "Sign in", "Submit"]:
        try:
            btn = iam_frame.get_by_role("button", name=label)
            if btn.count():
                btn.first.click()
                clicked = True
                break
        except Exception:
            continue
    if not clicked:
        iam_frame.locator("#password").press("Enter")

    try:
        page.wait_for_url(lambda url: "clientapp/login" not in url, timeout=30000)
    except Exception:
        pass
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except Exception:
        pass

    # The SPA route can lag behind the actual session cookie, so double-check
    # via an authenticated API call rather than trusting page.url alone.
    ok = "login" not in page.url
    if not ok:
        info = get_json(context, f"{BASE}/showtime/api/v4/viewer/userInfos.json")
        ok = bool(info) and "userInfo" in info
    print("  -> logged in OK" if ok else "  ! still on login page, check credentials")
    return ok


def get_json(context, url, retries=3, backoff=3000):
    for attempt in range(retries):
        resp = context.request.get(url)
        if resp.status == 200:
            try:
                return resp.json()
            except Exception:
                return None
        if attempt < retries - 1:
            # Transient "GENERAL_FAILURE" 500s happen under load — back off and retry.
            time.sleep(backoff / 1000)
    return None


def fetch_bundle_courses(context, bundle_id):
    # Modern v4 endpoint (works both logged-in and anonymous); returns every
    # sub-course with its uniqueKey in one call, no pagination needed.
    url = f"{BASE}/showtime/api/v4/viewer/course/{bundle_id}/getBundleCourses.json"
    data = get_json(context, url)
    if data and data.get("course"):
        return data["course"]

    # Legacy anonymous-only endpoint, kept as a fallback.
    courses, si, limit = [], 0, 12
    while True:
        url = f"{BASE}/trainercentral/viewer/course/{bundle_id}/getBundleCourses.json?si={si}&limit={limit}"
        data = get_json(context, url)
        if not data:
            break
        batch = data.get("course", [])
        courses.extend(batch)
        total = int(data.get("meta", {}).get("totalCoursesCount", len(courses)))
        si += limit
        if si >= total or not batch:
            break
    return courses


def fetch_sessions(context, course_id, section_id):
    url = f"{BASE}/showtime/api/v4/viewer/course/{course_id}/section/{section_id}/sessions.json"
    return (get_json(context, url) or {}).get("sessions", [])


def fetch_course_info(context, course_id, unique_key=None):
    # When authenticated, courses.json only resolves via uniqueKey — the
    # legacy courseId= query param 500s once a session cookie is present.
    if unique_key:
        return get_json(context, f"{BASE}/showtime/api/v4/viewer/courses.json?uniqueKey={unique_key}")
    return get_json(context, f"{BASE}/showtime/api/v4/viewer/courses.json?courseId={course_id}")


def scrape_course(context, course_id, out_root, seen=None, unique_key=None):
    seen = seen if seen is not None else set()
    if course_id in seen:
        return
    seen.add(course_id)

    try:
        data = fetch_course_info(context, course_id, unique_key)
    except Exception as e:
        print(f"  ! network error loading course {course_id}: {e} — skipping, run again later to retry")
        return
    if not data:
        # courseId-based lookup can fail for a bundle once authenticated
        # (no uniqueKey known yet for the top-level CLI argument) — try
        # resolving it directly as a bundle before giving up.
        bundle_courses = fetch_bundle_courses(context, course_id)
        if bundle_courses:
            print(f"[bundle] {course_id}")
            for sc in bundle_courses:
                scrape_course(context, sc["courseId"], out_root, seen, unique_key=sc.get("uniqueKey"))
            return
        print(f"  ! could not load course {course_id} (maybe needs login)")
        return

    course = data.get("course", {})
    name = course.get("courseName") or course.get("name") or course_id
    sections = data.get("sections", [])
    is_bundle = course.get("type") == "1" or not sections

    if is_bundle:
        print(f"[bundle] {name}")
        for sc in fetch_bundle_courses(context, course_id):
            scrape_course(context, sc["courseId"], out_root, seen, unique_key=sc.get("uniqueKey"))
        return

    course_dir = out_root / slugify(name)
    if (course_dir / "_combined.md").exists():
        print(f"[skip] {name} — already scraped (delete its folder to re-scrape)")
        return

    print(f"[course] {name} ({len(sections)} modules)")
    course_dir.mkdir(parents=True, exist_ok=True)

    combined = [f"# {name}\n"]
    desc_html = course.get("description", "")
    if desc_html:
        combined.append("## Course Description\n\n" + html_to_md(desc_html) + "\n")

    empty_count, total_count = 0, 0
    for sec in sorted(sections, key=lambda s: int(s.get("sectionIndex", 0))):
        sec_name = sec.get("name", "Untitled Module")
        try:
            sessions = fetch_sessions(context, course_id, sec["sectionId"])
        except Exception as e:
            print(f"   ! network error on module '{sec_name}': {e} — skipping this module")
            combined.append(f"\n## Module: {sec_name}\n\n_(failed to fetch — retry later)_\n")
            continue
        combined.append(f"\n## Module: {sec_name}\n")
        sec_dir = course_dir / slugify(sec_name)
        sec_dir.mkdir(parents=True, exist_ok=True)

        for sess in sorted(sessions, key=lambda s: int(s.get("sessionIndex", 0))):
            total_count += 1
            title = sess.get("name") or sess.get("title") or "Untitled Lesson"
            body_html = sess.get("description", "")
            if not body_html:
                empty_count += 1
            body_md = html_to_md(body_html)
            fname = f"{int(sess.get('sessionIndex', 0)) + 1:02d}-{slugify(title)}.md"
            (sec_dir / fname).write_text(f"# {title}\n\n{body_md}\n", encoding="utf-8")
            combined.append(f"\n### {title}\n\n{body_md}\n")

    (course_dir / "_combined.md").write_text("\n".join(combined), encoding="utf-8")
    print(f"   -> saved to {course_dir}  ({total_count - empty_count}/{total_count} lessons had text)")
    if empty_count:
        print("      (some lessons came back empty — try running WITHOUT --no-login, "
              "or make sure you're enrolled in this course)")


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)
    course_id = args[0]
    do_login = "--no-login" not in args
    unique_key = None
    for a in args:
        if a.startswith("--unique-key="):
            unique_key = a.split("=", 1)[1]

    OUT_DIR.mkdir(exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        if do_login:
            email = os.environ.get("TC_EMAIL") or input("Email: ")
            password = os.environ.get("TC_PASSWORD") or getpass.getpass("Password: ")
            login(context, page, email, password)

        scrape_course(context, course_id, OUT_DIR, unique_key=unique_key)
        browser.close()

    print(f"\nDone. Output in: {OUT_DIR.resolve()}")


if __name__ == "__main__":
    main()
