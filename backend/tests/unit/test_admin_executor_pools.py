"""Unit tests for GET /v1/admin/executor-pools + its admin-key gate.

routers.system_admin imports cleanly (stdlib + utils.executors only), so the handler and
gate are tested directly with patch.object (no sys.modules mutation).
"""

import os

os.environ.setdefault(
    "ENCRYPTION_SECRET",
    "omi_ZwB2ZNqB2HHpMK6wStk7sTpavJiPTFg7gXUHnc4tFABPU6pZ2c2DKgehtfgi4RZv",
)
os.environ.setdefault("OPENAI_API_KEY", "test-openai-key-not-real")

from unittest.mock import patch

import pytest
from fastapi import HTTPException

from routers import system_admin


def test_pool_health_shape_and_unhealthy_flags():
    pools = [
        {"name": "db_executor", "max_workers": 24, "active_count": 2, "queue_depth": 0, "utilization_pct": 8.3},
        {"name": "hot_pool", "max_workers": 8, "active_count": 7, "queue_depth": 5, "utilization_pct": 87.5},
        {"name": "backed_up", "max_workers": 128, "active_count": 10, "queue_depth": 150, "utilization_pct": 7.8},
    ]
    with patch.object(system_admin, "get_executor_metrics", return_value=pools), patch.object(
        system_admin, "get_background_task_count", return_value=5
    ):
        resp = system_admin.get_executor_pool_health(admin_id="admin:abc")
    assert resp["pools"] == pools
    assert resp["background_tasks"] == 5
    # hot_pool over 70% util; backed_up over 100 queue depth; db_executor healthy.
    assert resp["unhealthy"] == ["hot_pool", "backed_up"]


def test_admin_key_rejects_wrong_key():
    with patch.object(system_admin, "ADMIN_KEY", "secret"):
        with pytest.raises(HTTPException) as exc:
            system_admin._verify_admin_key(x_admin_key="wrong")
    assert exc.value.status_code == 403


def test_admin_key_rejects_when_unconfigured():
    with patch.object(system_admin, "ADMIN_KEY", ""):
        with pytest.raises(HTTPException) as exc:
            system_admin._verify_admin_key(x_admin_key="anything")
    assert exc.value.status_code == 403


def test_admin_key_accepts_correct_key():
    with patch.object(system_admin, "ADMIN_KEY", "secret"):
        result = system_admin._verify_admin_key(x_admin_key="secret")
    assert result.startswith("admin:")
