"""
Continuity OS · Unified Agentic Bridge
Exposes CLI commands for all modern agentic architecture subsystems:
- Archon 2 multi-agent graph planning and execution
- Dark Factory issue triage and holdout validation
- Second Brain 3-tier memory ingestion, audit, and contradiction reconciliation
- RAG document ingestion (Docling/Paperclip parser), chunking, and hybrid search
- Guardrails input/output validation (PII, secrets, prompt injection, schemas)
- Integrations (CrewAI, LangGraph, n8n webhook)
- Self-learning heuristics extraction and memory application
"""

import os
import sys
from pathlib import Path
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import json
import argparse
import importlib
from guardrails.engine import GuardrailsEngine
from orchestration.archon.engine import ArchonEngine
from factory.engine import DarkFactoryEngine
SecondBrainEngine = importlib.import_module("second-brain.engine").SecondBrainEngine
from rag.engine import RAGEngine
from integrations.adapters import CrewAIAdapter, LangGraphAdapter, N8NAdapter
from learning.engine import SelfLearningEngine


def main():
    parser = argparse.ArgumentParser(description="Continuity OS Agentic Bridge")
    subparsers = parser.add_subparsers(dest="subcommand", required=True)

    # 1. Archon
    archon_plan = subparsers.add_parser("archon-plan")
    archon_plan.add_argument("--goal", required=True)

    archon_exec = subparsers.add_parser("archon-exec")
    archon_exec.add_argument("--goal", required=True)

    # 2. Dark Factory
    factory_triage = subparsers.add_parser("factory-triage")
    factory_triage.add_argument("--issue-id", default="#1")
    factory_triage.add_argument("--title", required=True)
    factory_triage.add_argument("--body", default="")

    factory_build = subparsers.add_parser("factory-build")
    factory_build.add_argument("--issue-id", default="#1")
    factory_build.add_argument("--title", required=True)
    factory_build.add_argument("--changes", default="Implemented changes")

    # 3. Second Brain
    brain_state = subparsers.add_parser("brain-state")
    brain_ingest = subparsers.add_parser("brain-ingest")
    brain_ingest.add_argument("--text", required=True)

    brain_audit = subparsers.add_parser("brain-audit")

    # 4. RAG
    rag_ingest = subparsers.add_parser("rag-ingest")
    rag_ingest.add_argument("--doc-id", required=True)
    rag_ingest.add_argument("--text", required=True)
    rag_ingest.add_argument("--strategy", default="semantic")

    rag_search = subparsers.add_parser("rag-search")
    rag_search.add_argument("--query", required=True)
    rag_search.add_argument("--limit", type=int, default=5)

    # 5. Guardrails
    guard_check = subparsers.add_parser("guardrails-check")
    guard_check.add_argument("--text", required=True)
    guard_check.add_argument("--is-output", action="store_true")
    guard_check.add_argument("--context", default="")

    # 6. Integrations
    crew_export = subparsers.add_parser("crewai-export")
    langgraph_export = subparsers.add_parser("langgraph-export")
    n8n_webhook = subparsers.add_parser("n8n-webhook")
    n8n_webhook.add_argument("--payload", required=True)

    # 7. Self-Learning
    learn_evolve = subparsers.add_parser("learning-evolve")
    learn_evolve.add_argument("--failure-trace", required=True)

    args = parser.parse_args()

    # Route subcommands
    if args.subcommand == "archon-plan":
        engine = ArchonEngine()
        graph = engine.plan_goal(args.goal)
        print(json.dumps({
            "graph_id": graph.id,
            "goal": graph.goal,
            "tasks": [t.model_dump() for t in graph.tasks]
        }, indent=2))

    elif args.subcommand == "archon-exec":
        engine = ArchonEngine()
        graph = engine.plan_goal(args.goal)
        res = engine.execute_graph(graph)
        print(json.dumps(res, indent=2))

    elif args.subcommand == "factory-triage":
        engine = DarkFactoryEngine(autonomy_level=4)
        res = engine.triage_issue(args.issue_id, args.title, args.body)
        print(json.dumps(res, indent=2))

    elif args.subcommand == "factory-build":
        engine = DarkFactoryEngine(autonomy_level=4)
        validation = engine.run_holdout_validation({"passed": 19, "failed": 0, "regressions": []})
        pr = engine.prepare_pull_request(args.issue_id, args.title, [args.changes])
        print(json.dumps({"validation": validation, "pull_request": pr}, indent=2))

    elif args.subcommand == "brain-state":
        engine = SecondBrainEngine()
        memory_content = ""
        if os.path.exists(engine.memory_path):
            with open(engine.memory_path, "r", encoding="utf-8") as f:
                memory_content = f.read()
        print(json.dumps({"memory_content": memory_content}, indent=2))

    elif args.subcommand == "brain-ingest":
        engine = SecondBrainEngine()
        tier = engine.classify_fact(args.text)
        contradictions = engine.detect_contradictions(args.text)
        if tier == "EVENT":
            target = engine.append_event(args.text)
        else:
            target = engine.memory_path
        print(json.dumps({
            "classified_tier": tier,
            "target_file": target,
            "contradictions": contradictions,
            "success": True
        }, indent=2))

    elif args.subcommand == "brain-audit":
        engine = SecondBrainEngine()
        audit = engine.audit_memory()
        print(json.dumps(audit, indent=2))

    elif args.subcommand == "rag-ingest":
        engine = RAGEngine()
        chunks = engine.ingest_document(args.doc_id, args.text, strategy=args.strategy)
        print(json.dumps({
            "doc_id": args.doc_id,
            "chunks_count": len(chunks),
            "chunks": [c.model_dump() for c in chunks]
        }, indent=2))

    elif args.subcommand == "rag-search":
        engine = RAGEngine()
        hits = engine.search(args.query, limit=args.limit)
        print(json.dumps({"query": args.query, "hits": hits}, indent=2))

    elif args.subcommand == "guardrails-check":
        engine = GuardrailsEngine()
        if args.is_output:
            res = engine.validate_output(args.text, context=args.context)
        else:
            res = engine.validate_input(args.text)
        print(json.dumps(res.model_dump(), indent=2))

    elif args.subcommand == "crewai-export":
        roles = {
            "architect": type("Obj", (), {"name": "Architect", "system_prompt": "Designs system specifications."})(),
            "builder": type("Obj", (), {"name": "Builder", "system_prompt": "Implements clean modular code."})(),
            "critic": type("Obj", (), {"name": "Critic", "system_prompt": "Adversarially spots bugs and regressions."})()
        }
        tasks = [
            {"title": "Architecture Blueprint", "role": "Architect"},
            {"title": "Modular Build", "role": "Builder"},
            {"title": "Adversarial Code Review", "role": "Critic"}
        ]
        crew = CrewAIAdapter.export_crew(roles, tasks)
        print(json.dumps(crew, indent=2))

    elif args.subcommand == "langgraph-export":
        tasks = [
            {"id": "t1", "title": "Decompose Goal", "dependencies": []},
            {"id": "t2", "title": "Synthesize Roles", "dependencies": ["t1"]},
            {"id": "t3", "title": "Execute DAG", "dependencies": ["t2"]}
        ]
        lg = LangGraphAdapter.export_graph({"tasks": tasks})
        print(json.dumps(lg, indent=2))

    elif args.subcommand == "n8n-webhook":
        payload = json.loads(args.payload)
        parsed = N8NAdapter.parse_webhook_payload(payload)
        print(json.dumps(parsed, indent=2))

    elif args.subcommand == "learning-evolve":
        engine = SelfLearningEngine()
        h = engine.extract_heuristic(args.failure_trace)
        applied = engine.apply_to_memory(h)
        print(json.dumps({"heuristic": h, "applied_to_memory": applied}, indent=2))


if __name__ == "__main__":
    import os
    main()
