"""
Continuity OS · Multi-Agent & Workflow Interoperability Adapters
Provides native export and compatibility with:
1. CrewAI (Agents, Tasks, and Crew definitions)
2. LangChain / LangGraph (StateGraph nodes, edges, and runnable schemas)
3. n8n (Webhook ingestion, workflow triggers, and event emission)
"""

import json
from typing import Dict, Any, List


class CrewAIAdapter:
    @staticmethod
    def export_crew(roles: Dict[str, Any], tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Converts internal agent roles and tasks into CrewAI specification."""
        crew_agents = []
        for key, r in roles.items():
            name = getattr(r, "name", key)
            prompt = getattr(r, "system_prompt", f"Specialized agent for {key}")
            crew_agents.append({
                "role": name,
                "goal": prompt,
                "backstory": f"Continuity OS autonomous {name} agent operating with zero-regression discipline.",
                "verbose": True,
                "allow_delegation": True
            })

        crew_tasks = []
        for t in tasks:
            crew_tasks.append({
                "description": t.get("title", "Execute task"),
                "expected_output": "Structured output satisfying guardrail invariants",
                "agent": t.get("role", "Builder")
            })

        return {
            "crew_name": "ContinuityOS_AutonomousCrew",
            "agents": crew_agents,
            "tasks": crew_tasks,
            "process": "sequential"
        }


class LangGraphAdapter:
    @staticmethod
    def export_graph(graph_data: Dict[str, Any]) -> Dict[str, Any]:
        """Exports Archon 2 execution DAG to LangGraph StateGraph schema."""
        nodes = []
        edges = []

        tasks = graph_data.get("tasks", [])
        for t in tasks:
            nodes.append({
                "id": t["id"],
                "name": t["title"],
                "type": "runnable_node",
                "tier": t.get("tier", "general")
            })
            for dep in t.get("dependencies", []):
                edges.append({"source": dep, "target": t["id"]})

        return {
            "graph_type": "LangGraph_StateGraph",
            "entry_point": nodes[0]["id"] if nodes else "END",
            "nodes": nodes,
            "edges": edges,
            "state_schema": "ContinuityAgentState"
        }


class N8NAdapter:
    @staticmethod
    def parse_webhook_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
        """Parses incoming n8n webhook payload into an executable job."""
        action = payload.get("action", "agent_task")
        data = payload.get("data", payload)
        return {
            "source": "n8n_workflow",
            "workflow_id": payload.get("workflowId", "n8n_default"),
            "action": action,
            "payload": data,
            "status": "received"
        }

    @staticmethod
    def format_event_for_n8n(event_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Formats an internal event payload to trigger n8n Webhook node."""
        return {
            "event": event_name,
            "timestamp": data.get("timestamp"),
            "source": "continuity-os",
            "body": data
        }


class LangChainAdapter:
    @staticmethod
    def export_chain(roles: Dict[str, Any], goal: str) -> Dict[str, Any]:
        """Exports Archon 2 agent roles to LangChain LCEL (LangChain Expression Language) pipeline schema."""
        steps = []
        for role_key, role_obj in roles.items():
            name = getattr(role_obj, "name", role_key)
            steps.append({
                "runnable": f"PromptTemplate | ChatModel({name}) | StrOutputParser",
                "role": name,
                "input_key": "input" if len(steps) == 0 else f"{steps[-1]['role']}_output",
                "output_key": f"{name}_output"
            })
        return {
            "chain_type": "LangChain_LCEL_Pipeline",
            "goal": goal,
            "steps": steps,
            "memory": "ContinuitySQLiteChatMessageHistory"
        }

    @staticmethod
    def export_tools() -> List[Dict[str, Any]]:
        """Exports Continuity OS capabilities as LangChain StructuredTools."""
        return [
            {
                "name": "continuity_rag_search",
                "description": "Searches Continuity OS hybrid vector and semantic store using cosine similarity and BM25.",
                "args_schema": {"query": "string", "limit": "integer"}
            },
            {
                "name": "continuity_jev_decision_gate",
                "description": "Evaluates policy compliance, action gating, or retry/stop decisions via Jev system-one.",
                "args_schema": {"state": "string", "bank": "string"}
            },
            {
                "name": "continuity_second_brain_audit",
                "description": "Audits 3-tier Second Brain memory for stale facts, contradictions, and rot score.",
                "args_schema": {}
            }
        ]


class LlamaIndexAdapter:
    @staticmethod
    def export_query_engine_spec() -> Dict[str, Any]:
        """Exports Continuity OS RAG engine to LlamaIndex QueryEngine specification."""
        return {
            "engine_type": "LlamaIndex_VectorIndexRetriever",
            "node_parser": "DoclingHierarchicalNodeParser",
            "vector_store": "ContinuitySQLiteVectorStore",
            "similarity_top_k": 5,
            "response_synthesizer": "compact_and_refine",
            "metadata_filters": ["doc_id", "strategy", "parent_section"]
        }
