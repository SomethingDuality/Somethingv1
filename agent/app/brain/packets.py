"""SO0's Brain assembly layer (FA_/IA_), deterministic, no model calls: the packets a matcher reads.
The interim matcher uses them today; Prapti's Brain gets the same packets (P17 draft format,
`PACKET_VERSION`), so swapping the matcher changes nothing else.

Never in a packet: drafts or hidden ideas, emails, pedigree (schools, employers, titles: R10),
Nothing's verdicts (R9), or anything from a Ghost-Mode investor that a founder could see."""
from app.core import db
from app.memory import store
from app.shared import taxonomy

PACKET_VERSION = "packet_v1"
MEMORY_SLOTS = ("idea.target_customer", "idea.country", "idea.business_model")


def _labels(group: str, ids: list[str]) -> list[str]:
    return [taxonomy.label(group, i) for i in ids or []]


async def memory_facts(idea_ids: list[str]) -> dict[str, dict]:
    """Current slot facts per idea from memory, in one query."""
    keys = [store.scope_key("idea", i) for i in idea_ids]
    out: dict[str, dict] = {}
    async for n in db.col("agent_notes").find({"scope_key": {"$in": keys}, "status": "current", "slot_key": {"$in": list(MEMORY_SLOTS)}},
                                              {"idea_id": 1, "slot_key": 1, "value": 1, "provenance": 1}):
        out.setdefault(n["idea_id"], {})[n["slot_key"]] = {"value": n.get("value"), "provenance": n["provenance"]}
    return out


def idea_packet(raw: dict, facts: dict | None = None) -> dict:
    return {
        "v": PACKET_VERSION, "id": raw["id"], "founder_id": raw["founderId"],
        "title": raw["title"], "description": raw.get("description", ""),
        "text": f"{raw['title']}. {raw.get('description', '')}".strip(),
        "sectors": raw.get("tags", []), "stage": raw.get("stage"), "raising": raw.get("raising"),
        "looking_for": raw.get("lookingFor", []), "founder_location": raw.get("founderLocation", ""),
        "created_at": raw.get("createdAt"), "supports": raw.get("likes", 0), "facts": facts or {},
    }


def person_packet(raw: dict) -> dict:
    if raw["role"] == "Investor":
        stages = raw.get("stageFocus", [])
        text = " ".join([raw.get("thesis", ""), " ".join(raw.get("keywords", [])),
                         " ".join(_labels("sectors", raw.get("interests", []))), " ".join(_labels("fundingStages", stages))]).strip()
        return {
            "v": PACKET_VERSION, "id": raw["id"], "role": "Investor", "sectors": raw.get("interests", []), "stage_focus": stages,
            "min_check": raw.get("minCheck"), "max_check": raw.get("maxCheck"), "keywords": raw.get("keywords", []),
            "text": text, "exclude": set(raw.get("saved", [])) | set(raw.get("committed", [])),
            "ready": bool(raw.get("interests") or stages or raw.get("keywords") or raw.get("thesis")),
        }
    skills = raw.get("skills", [])
    text = " ".join(_labels("skills", skills) + _labels("sectors", raw.get("interests", [])))
    return {
        "v": PACKET_VERSION, "id": raw["id"], "role": "Founder", "skills": skills, "sectors": raw.get("interests", []),
        "location": raw.get("location", ""), "text": text, "exclude": set(raw.get("ownIdeas", [])), "ready": bool(skills),
    }
