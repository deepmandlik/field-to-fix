"""Deploy the Ask agent (agents/f2f_engine) to Vertex AI Agent Engine and print its resource name.

Usage (from the repo root, with the agents venv):  python scripts/deploy_agent_engine.py
Then set AGENT_ENGINE on the f2f-agents Cloud Run service to the printed resource name.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "agents"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "agents"))  # extra_packages paths are relative to here

import vertexai  # noqa: E402
from vertexai import agent_engines  # noqa: E402

from f2f_engine.agent import root_agent  # noqa: E402

PROJECT, REGION = "field-to-fix", "us-central1"
vertexai.init(project=PROJECT, location=REGION, staging_bucket="gs://field-to-fix-agent-engine")

app = agent_engines.AdkApp(agent=root_agent, app_name="field-to-fix-ask")
remote = agent_engines.create(
    app,
    display_name="field-to-fix-ask",
    description="Field-to-Fix Ask agent: answers questions about one warranty case with citations (Google ADK).",
    requirements=["google-adk>=2.12,<3", "google-cloud-aiplatform[agent_engines,adk]>=2.5,<3", "google-genai>=2.30,<3"],
    extra_packages=["f2f_engine"],
    # Gemini 3.8 Flash is served from the global endpoint, not us-central1.
    env_vars={"GOOGLE_CLOUD_LOCATION": "global", "GOOGLE_GENAI_USE_VERTEXAI": "TRUE", "THINKING_LEVEL": "LOW",
              "MODEL_FAST": "gemini-3.8-flash"},
    # One small warm instance keeps answers fast without paying for the default 4 vCPU.
    min_instances=1, max_instances=3, resource_limits={"cpu": "1", "memory": "2Gi"},
)
print("AGENT_ENGINE=" + remote.resource_name)
