"""Typed failures. Each one maps to a user-safe SSE/HTTP error code; none carries idea text."""


class AgentError(Exception):
    code = "internal"
    status = 500
    retryable = False
    message = "Something went wrong on our side. Please try again."

    def __init__(self, detail: str = "", **extra):
        super().__init__(detail or self.message)
        self.detail = detail
        self.extra = extra

    def public(self) -> dict:
        return {"code": self.code, "message": self.message, "retryable": self.retryable, **self.extra}


class QuotaExceeded(AgentError):
    code, status, retryable = "quota_exceeded", 429, False
    message = "You've used today's reviews. They come back tomorrow."


class BudgetPaused(AgentError):
    code, status, retryable = "budget_paused", 503, True
    message = "Reviews are paused for today. Please try again tomorrow."


class ProviderUnavailable(AgentError):
    code, status, retryable = "provider_unavailable", 503, True
    message = "The review couldn't finish just now. Please try again in a minute."


class AllProvidersFailed(ProviderUnavailable):
    def __init__(self, causes: list[str]):
        super().__init__("; ".join(causes))
        self.causes = causes


class JudgeRefused(AgentError):
    code, status, retryable = "judge_refused", 422, False
    message = "This one couldn't be reviewed. Try describing the idea differently."


class Truncated(ProviderUnavailable):
    pass


class InvalidInput(AgentError):
    code, status, retryable = "invalid_input", 422, False
    message = "That input can't be reviewed."


class NotFound(AgentError):
    code, status, retryable = "not_found", 404, False
    message = "Not found."


class NodeUnavailable(AgentError):
    code, status, retryable = "node_unavailable", 502, True
    message = "The app couldn't be reached. Please try again."
