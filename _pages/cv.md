---
layout: archive
title: "CV"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

{% include base_path %}

Education
======
* **B.S.E. in Computer Science**
  * University of Michigan, Ann Arbor
  * Aug 2025 - Present
  * GPA: 3.88/4.00
  * Selected Coursework: Machine Learning, Operating Systems, GPU Parallel Programming, Database Management Systems.
* **B.Eng. in Mechanical Engineering**
  * Shanghai Jiao Tong University
  * Aug 2023 - Present

Research Interests
======
Web Agents.

Selected Research Projects
======
* **WebEvolve: Robustness Benchmarking for Web Agents** (Jan 2026 – Present)
  * Advisor: Prof. Honglak Lee (Ann Arbor, MI)
  * Developed WebEvolve, a version-aware benchmark framework that evaluates MLLM-based web agent robustness under natural website version shift.
  * Designed a knowledge graph based representation pipeline with component interfaces, producing multi-view state nodes carrying structural, functional, and grounding information.
  * Built a cross-version alignment and structured diff engine using multi-signal scoring, with a 7-category drift taxonomy that maps each change to specific agent capability breakdowns.
  * Implemented an end-to-end task maintenance pipeline: template mining -> affected-task detection -> retrieval-ranked realization, automatically deciding whether to reuse, refresh, or regenerate tasks when a website version changes.
  * Designed a grounding-aware evaluation protocol requiring trajectory verification through key evidence nodes, preventing success via hallucinated shortcuts.

* **Efficient Inference for Embodied Foundation Models** (Nov 2025 – Present)
  * Advisor: Dr. Jiachen Liu (Ann Arbor, MI)
  * Profiled Video Action Models (VAM) for robotic policy, implementing cross-attention KV caching and token compression to accelerate inference in dynamic environments.
  * Explored quantization (dynamic precision) and speculative decoding on VLA models, optimizing the computational backbone required for real-time agentic decision-making.

* **Gravitational Effect on Swarming Behavior of Microorganisms** (Sep 2024 - Aug 2025)
  * Advisor: Prof. Zijie Qu (Shanghai, China)
  * Trained a U-Net model for colony boundary segmentation; diagnosed systematic failure modes, then adopted a SAM-based pipeline that achieved reliable automated detection, replacing manual annotation.

* **Probabilistic Motion Planning for Redundant Robots** (Nov 2025 – Dec 2025)
  * EECS 465 (Intro to Algorithmic Robotics) course project (Ann Arbor, MI)
  * Evaluated RRT-Connect and PRM on a 7-DOF Franka Panda; optimized sampling strategies in high-dimensional state spaces, achieving a 75% reduction in planning latency.

Skills
======
* **Frameworks**: PyTorch, Hugging Face, CUDA, Docker, Linux
* **Languages**: Python, C/C++, Java, SQL, LaTeX, Typst
