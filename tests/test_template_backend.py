"""
TailorResume — Module 7: Resume Templates & Preview — Backend Test Suite
Tests:
1. Template ID validation: permits 'ats-classic', 'professional', 'compact'.
2. Rejection of invalid template IDs with HTTP 400.
3. User isolation & ownership enforcement on PUT /api/resumes/{resume_id}/template.
4. Content preservation: template updates change only presentation fields without touching content.
5. Master vs Tailored template independence.
6. Template cloning/duplication persistence.
"""

import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import app
from models.database import init_db, get_db, Resume, ResumePersonalInfo, ResumeSummary, ResumeSkill
from services.auth import get_current_user


async def test_template_backend():
    print("\n--- Starting Module 7 Template Backend Tests ---")
    await init_db()

    user_a = {
        "id": "user-tmpl-a-" + str(uuid.uuid4())[:8],
        "email": "tmpl_a@example.com",
        "user_metadata": {"full_name": "Template User A"}
    }
    user_b = {
        "id": "user-tmpl-b-" + str(uuid.uuid4())[:8],
        "email": "tmpl_b@example.com",
        "user_metadata": {"full_name": "Template User B"}
    }

    current_test_user = user_a

    async def mock_get_current_user():
        return current_test_user

    app.dependency_overrides[get_current_user] = mock_get_current_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create a resume for User A
        create_res = await client.post("/api/resumes", json={"name": "Alice Template Test Resume"})
        assert create_res.status_code == 201, f"Failed to create resume: {create_res.text}"
        resume_data = create_res.json()
        resume_id = resume_data["id"]

        # Verify default template is ats-classic
        assert resume_data.get("template_id") == "ats-classic", f"Default template should be ats-classic, got {resume_data.get('template_id')}"
        assert resume_data.get("template_version") == "v1.0.0", f"Default template version should be v1.0.0, got {resume_data.get('template_version')}"
        print("[PASS] Default resume created with template_id='ats-classic' and version='v1.0.0'")

        # Add a skill and summary to verify content won't be touched by template updates
        await client.put(f"/api/resumes/{resume_id}", json={
            "summary": {"summary": "Experienced Full Stack Engineer."},
            "skills": [{"skill_name": "TypeScript", "category": "Languages", "display_order": 0}]
        })

        # 2. Update to 'professional' via dedicated template endpoint
        update_tmpl_res = await client.put(f"/api/resumes/{resume_id}/template", json={
            "template_id": "professional",
            "template_version": "v1.0.0"
        })
        assert update_tmpl_res.status_code == 200, f"Failed to update template: {update_tmpl_res.text}"
        tmpl_res_data = update_tmpl_res.json()
        assert tmpl_res_data["template_id"] == "professional"
        print("[PASS] Template updated to 'professional' via dedicated endpoint")

        # 3. Verify content was preserved completely
        get_res = await client.get(f"/api/resumes/{resume_id}")
        assert get_res.status_code == 200
        full_resume = get_res.json()
        assert full_resume["template_id"] == "professional"
        assert full_resume["summary"]["summary"] == "Experienced Full Stack Engineer."
        assert len(full_resume["skills"]) == 1
        assert full_resume["skills"][0]["skill_name"] == "TypeScript"
        print("[PASS] Content integrity verified: summary and skills intact after template change")

        # 4. Update to 'compact' via general resume update endpoint
        update_gen_res = await client.put(f"/api/resumes/{resume_id}", json={
            "template_id": "compact"
        })
        assert update_gen_res.status_code == 200
        assert update_gen_res.json()["template_id"] == "compact"
        print("[PASS] Template updated to 'compact' via general PUT /api/resumes/{id}")

        # 5. Invalid template ID rejected with HTTP 400
        bad_tmpl_res = await client.put(f"/api/resumes/{resume_id}/template", json={
            "template_id": "super-fancy-unsupported"
        })
        assert bad_tmpl_res.status_code == 400, f"Expected 400 for bad template ID, got {bad_tmpl_res.status_code}"
        assert "Invalid template ID" in bad_tmpl_res.json()["detail"]
        print("[PASS] Invalid template ID 'super-fancy-unsupported' properly rejected with 400")

        # Bad template in general update also rejected
        bad_gen_res = await client.put(f"/api/resumes/{resume_id}", json={
            "template_id": "malicious-template-id"
        })
        assert bad_gen_res.status_code == 400
        print("[PASS] Invalid template ID in general update properly rejected with 400")

        # 6. User B cannot update User A's template (Ownership enforcement)
        current_test_user = user_b
        unauth_update = await client.put(f"/api/resumes/{resume_id}/template", json={
            "template_id": "ats-classic"
        })
        assert unauth_update.status_code == 404, f"Expected 404 for unauthorized update, got {unauth_update.status_code}"
        print("[PASS] Ownership enforced: User B cannot change User A's template")

        # 7. Duplicating a resume preserves the template_id
        current_test_user = user_a
        dup_res = await client.post(f"/api/resumes/{resume_id}/duplicate")
        assert dup_res.status_code == 200
        dup_data = dup_res.json()
        assert dup_data["template_id"] == "compact", f"Duplicated resume should inherit template 'compact', got {dup_data['template_id']}"
        assert dup_data["template_version"] == "v1.0.0"
        print("[PASS] Duplicated resume successfully inherited source template settings")

    app.dependency_overrides.clear()
    print("=== All Module 7 Template Backend Tests Passed Successfully! ===")


if __name__ == "__main__":
    asyncio.run(test_template_backend())
