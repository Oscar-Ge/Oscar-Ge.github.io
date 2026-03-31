---
title: "Agent Memory Decay Under Controlled Web Drift"
excerpt: "Measuring experience decay for LLM-based web agents under controlled UI drift."
collection: portfolio
---

* **Duration:** Jan 2026 - Present
* **Context:** EECS 545 (Machine Learning) Course Project
* **Advisor:** Prof. Honglak Lee
* **Link:** [Progress Report](/files/webEvolve_progress_report.pdf)

## Project Overview

While agentic memory is a rapidly growing area, existing methods primarily focus on static environments or cross-task generalization. This project investigates a critical unanswered question: how does test-time agent memory (e.g., semantic insights vs. procedural workflows) degrade when the underlying website environment evolves?

## Key Contributions

* Developed a fully reproducible testbed using **Docker**, injecting 6 controlled drift types (surface, structural, access, content, process, runtime) into a self-hosted open-source web application.
* Extracted and implemented different abstraction levels of agent memory, comparing semantic insights (ExpeL) with procedural workflows (AWM) injected into LLM contexts.
* Formulated an evaluation framework measuring **Experience Transfer Gap (ETG)** and **Experience Decay Rate (EDR)**.
* Evaluated agent robustness under varying drift settings, uncovering critical empirical correlations between environment coupling and memory vulnerability.
