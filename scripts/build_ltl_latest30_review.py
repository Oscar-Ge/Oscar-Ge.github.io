#!/usr/bin/env python3
"""Build the static latest30 review payload and its screenshot assets."""

import argparse
import json
import shutil
from collections import defaultdict
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--canonical-review", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def load_json(path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def focus_from(entry):
    if not entry:
        return None
    for snapshot in entry.get("snapshots", []):
        if snapshot.get("name") == "Tier-1 generated-website action context":
            return (snapshot.get("value") or {}).get("screenshotFocus")
    return None


def trace_entry_index(trace_path, requested):
    captured = {}
    wanted = {index for target in requested for index in range(max(0, target - 2), target + 3)}
    with trace_path.open(encoding="utf-8") as handle:
        for index, line in enumerate(handle):
            if index in wanted:
                captured[index] = json.loads(line)
            if index > max(wanted):
                break
    return captured


def local_image(source, output, copied):
    if not source:
        return None
    source = Path(source)
    if not source.is_file():
        return None
    parts = source.parts
    try:
        replay = next(part for part in parts if part.startswith("replay-"))
        attempt = next(part for part in parts if "__" in part and "replay-" in part)
    except StopIteration:
        replay, attempt = "unknown-replay", source.parent.parent.name
    relative = Path("images") / replay / attempt / source.name
    destination = output / relative
    if source not in copied:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied[source] = relative
    return copied[source].as_posix()


def main():
    args = parse_args()
    evidence_doc = load_json(args.evidence)
    canonical = load_json(args.canonical_review)
    canonical_by_id = {row["errorId"]: row for row in canonical["reviews"]}
    cases = evidence_doc["cases"]
    if len(cases) != 2358 or set(canonical_by_id) != {case["errorId"] for case in cases}:
        raise ValueError("Expected the exact 2,358-case canonical worklist")

    selected_triggers = []
    for case in cases:
        by_replay = {}
        for trigger in case["triggers"]:
            by_replay.setdefault(trigger["replay"], trigger)
        selected_triggers.extend((case["errorId"], trigger) for trigger in by_replay.values())

    requests = defaultdict(set)
    for _, trigger in selected_triggers:
        screenshot = Path(trigger["screenshot"])
        requests[screenshot.parent.parent / "trace.jsonl"].add(trigger["traceEntryIndex"])

    trace_entries = {path: trace_entry_index(path, indexes) for path, indexes in requests.items()}
    args.output.mkdir(parents=True, exist_ok=True)
    copied = {}
    trace_mismatches = []
    missing_images = []
    property_counts = defaultdict(int)
    output_cases = []

    for case in cases:
        canonical_case = canonical_by_id[case["errorId"]]
        variants = {variant.get("triggerId"): variant.get("value") for variant in case.get("observationVariants", [])}
        by_replay = {}
        for trigger in case["triggers"]:
            by_replay.setdefault(trigger["replay"], trigger)
        rendered_evidence = []
        for replay_number, trigger in sorted(by_replay.items()):
            screenshot_path = Path(trigger["screenshot"])
            trace_path = screenshot_path.parent.parent / "trace.jsonl"
            candidates = trace_entries[trace_path]
            matched_index = None
            for index in range(max(0, trigger["traceEntryIndex"] - 2), trigger["traceEntryIndex"] + 3):
                if (candidates.get(index, {}).get("state") or {}).get("screenshot") == str(screenshot_path):
                    matched_index = index
                    break
            if matched_index is None:
                trace_mismatches.append(trigger["triggerId"])
                matched_index = trigger["traceEntryIndex"]
            after_entry = candidates.get(matched_index)
            before_entry = candidates.get(matched_index - 1)
            before_source = (before_entry or {}).get("state", {}).get("screenshot")
            after_source = str(screenshot_path)
            before_image = local_image(before_source, args.output, copied)
            after_image = local_image(after_source, args.output, copied)
            if not before_image or not after_image:
                missing_images.append(trigger["triggerId"])
            snapshot = variants.get(trigger["triggerId"]) or {}
            action = snapshot.get("action") or {}
            control = action.get("control") or action.get("invoker") or {}
            key = action.get("key") or "snapshot"
            name = control.get("name") or control.get("tag") or case["identity"]
            rendered_evidence.append({
                "replay": f"replay-{replay_number}",
                "triggerId": trigger["triggerId"],
                "traceEntryIndex": trigger["traceEntryIndex"],
                "actionLabel": f"{key} on {name}",
                "before": {"image": before_image, "focus": focus_from(before_entry)},
                "after": {"image": after_image, "focus": focus_from(after_entry)},
                "propertySnapshot": snapshot,
            })

        property_counts[case["property"]] += 1
        source_matches = [{
            "path": match.get("path"),
            "offset": match.get("offset"),
            "snippet": (match.get("snippet") or "")[:1200],
        } for match in case.get("sourceMatches", [])[:3]]
        output_cases.append({
            "errorId": case["errorId"],
            "website": case["website"],
            "property": case["property"],
            "route": case["route"],
            "identity": case["identity"],
            "identityQuality": canonical_case["identityQuality"],
            "replays": canonical_case["replays"],
            "evidence": rendered_evidence,
            "suggestion": {
                "decision": case["decision"],
                "note": case["note"],
                "basis": case["basis"],
                "duplicateOf": case.get("duplicateOf"),
            },
            "historical": case.get("historical"),
            "freshDOM": case.get("freshDOM"),
            "sourceMatches": source_matches,
            "evidenceGaps": case.get("evidenceGaps", []),
        })

    dataset = {
        "schemaVersion": "ltl-ui-latest30-navigation-error-review-cases/1",
        "title": canonical["dataset"]["title"],
        "actionPolicyVersion": canonical["dataset"]["actionPolicyVersion"],
        "sourceGeneratedAt": canonical["generatedAt"],
        "expectedCaseCount": len(output_cases),
        "websiteCount": len({case["website"] for case in output_cases}),
        "propertyCounts": dict(sorted(property_counts.items())),
        "replayErrorCounts": canonical["dataset"]["replayErrorCounts"],
        "agentFirstPass": evidence_doc["summary"]["overall"],
        "cases": output_cases,
    }
    cases_path = args.output / "cases.js"
    with cases_path.open("w", encoding="utf-8") as handle:
        handle.write("window.LTL_LATEST30_NAVIGATION_ERROR_REVIEW = ")
        json.dump(dataset, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write(";\n")

    report = {
        "caseCount": len(output_cases),
        "websiteCount": dataset["websiteCount"],
        "propertyCounts": dataset["propertyCounts"],
        "selectedReplayEvidenceCount": len(selected_triggers),
        "uniqueImageCount": len(copied),
        "imageBytes": sum(path.stat().st_size for path in copied),
        "traceMismatchCount": len(trace_mismatches),
        "traceMismatches": trace_mismatches,
        "missingImageCount": len(missing_images),
        "missingImages": missing_images,
    }
    with (args.output / "dataset-summary.json").open("w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
        handle.write("\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
