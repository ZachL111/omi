"""Admin endpoint exposing shared thread-pool executor health for ops and debugging.

The shared executor pools (utils/executors.py) can saturate and starve or deadlock under
load; today that signal is only written to logs (log_executor_health), never queryable.
This surfaces it as an admin-gated endpoint. The admin-key gate mirrors
routers/fair_use_admin.py (replicated here rather than imported, since routers must not
import other routers).
"""

import hashlib
import hmac
import os

from fastapi import APIRouter, Depends, Header, HTTPException

from utils.executors import get_background_task_count, get_executor_metrics

router = APIRouter()

ADMIN_KEY = os.getenv('ADMIN_KEY', '')

_UTIL_ALERT_PCT = 70.0
_QUEUE_ALERT_DEPTH = 100


def _verify_admin_key(x_admin_key: str = Header(..., alias='X-Admin-Key')) -> str:
    """Validate the admin key with a constant-time compare; return a short audit id."""
    if not ADMIN_KEY or not hmac.compare_digest(x_admin_key, ADMIN_KEY):
        raise HTTPException(status_code=403, detail='Invalid admin key')
    return f'admin:{hashlib.sha256(x_admin_key.encode()).hexdigest()[:8]}'


@router.get('/v1/admin/executor-pools', tags=['admin'])
def get_executor_pool_health(admin_id: str = Depends(_verify_admin_key)):
    """Live health of all shared executor pools plus the tracked background-task count.

    `unhealthy` flags any pool over 70% utilization or with a queue depth above 100, the
    same thresholds log_executor_health warns on, so an operator can spot saturation at a
    glance instead of grepping logs.
    """
    pools = get_executor_metrics()
    return {
        'pools': pools,
        'background_tasks': get_background_task_count(),
        'unhealthy': [
            p['name'] for p in pools if p['utilization_pct'] > _UTIL_ALERT_PCT or p['queue_depth'] > _QUEUE_ALERT_DEPTH
        ],
    }
