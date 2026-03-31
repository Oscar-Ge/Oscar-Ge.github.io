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
AI Agents, with a focus on Web Agents and their memory.

Selected Research Projects
======
* **Agent Memory Decay Under Controlled Web Drift** (Jan 2026 – Present) [[Progress Report]](/files/webEvolve_progress_report.pdf)
  * Advisor: Prof. Honglak Lee (Ann Arbor, MI)
  * Investigating the robustness of test-time agent memory systems under controlled website GUI evolution.
  * Designed a reproducible evaluation testbed injecting 6 distinct drift variants (surface, structural, content, runtime, access, functional) into open-source web applications.
  * Extracted and implemented varying abstraction levels of agent memory—from raw trajectories (ExpRAG) and semantic insights (ExpeL) to procedural workflows (AWM).
  * Evaluated memory decay by measuring Experience Transfer Gap (ETG) and Decay Rate (EDR) to systematically demonstrate the vulnerability of fixed test-time experiences against DOM structure and UI visual changes.
  * Pioneering the systematic study of environmental coupling in agent memory, providing empirical guidelines for self-evolving integration.

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
