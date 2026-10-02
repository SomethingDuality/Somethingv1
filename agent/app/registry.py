"""Feature wiring in one place: which graphs the RunManager drives, which job handlers and event
routes exist, and which HTTP routers are mounted. Each phase adds its feature here."""
from fastapi import APIRouter


def register_features(manager, saver) -> None:
    """Graphs + job handlers. Importing a feature package registers its jobs and fake scripts."""
    from app.brain import deal_flow  # noqa: F401 - registers the weekly batch job and scheduler
    from app.chat import fakes as chat_fakes  # noqa: F401 - registers fake scripts
    from app.memory import confirms, fakes, ingest  # noqa: F401 - registers jobs, periodic tasks, fakes
    from app.memory.graph.builder import compile_memory_write
    from app.review import fakes as review_fakes  # noqa: F401 - registers fake scripts
    from app.review import service as review_service
    from app.review.graph.builder import compile_review

    manager.register("memory_write", compile_memory_write(saver), durability="exit")
    manager.register("review", compile_review(saver), on_finish=review_service.on_finish)


def routers() -> list[APIRouter]:
    from app.api import chat, confirms, deal_flow, reviews
    return [confirms.router, reviews.router, deal_flow.router, chat.router]
