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
  * Relevant Coursework: Machine Learning, Intro to Algorithmic Robotics (A), Operating Systems, Applied Parallel Programming with GPUs
* **B.Eng. in Mechanical Engineering**
  * Shanghai Jiao Tong University
  * Aug 2023 - Present

Research Interests
======
Robot Learning (VLA, VAM), Agentic Systems, and Efficient Machine Learning.

Research Experience
======
* **Research Assistant** (Nov 2025 – Present)
  * Efficient Inference for Embodied Foundation Models
  * Advisor: Dr. Jiachen Liu (University of Michigan)
  * Profiled COSMOS-Policy across denoising steps; identified that block-level residual skipping is infeasible while cross-attention outputs remain highly stable (cosine > 0.999).
  * Validated cross-attention KV caching on 24 RoboCasa tasks: achieved identical task success rate of 68.06% to the baseline across 3,600 rollout trials with consistent denoising speedup across all 24 tasks.
  * Designing task-aware token compression that exploits the model's latent-frame slot structure to selectively prune image tokens via self-attention reduction, targeting further denoising acceleration on top of the validated caching strategy.

* **Research Assistant** (Sep 2024 - Aug 2025)
  * Gravitational Effect on Swarming Behavior of Microorganisms
  * Advisor: Prof. Zijie Qu (Shanghai Jiao Tong University)
  * Trained a U-Net model for colony boundary segmentation; diagnosed systematic failure modes, then adopted a SAM-based pipeline that achieved reliable automated detection, replacing manual annotation.

Projects
======
* **Web Agent Version-Robust Benchmark** (Jan 2026 - Present)
  * EECS 545 (Machine Learning) Course Project
  * Advisor: Prof. Honglak Lee
  * Built a reproducible testing pipeline using Docker to deploy baseline agents like QWen3-VL-30B across historical snapshots of open-source websites like SimpleWiki.
  * Formulated a taxonomy for web version variations and designed controlled experiments to isolate version-induced failure modes in LLM-based web agents.
  * Implementing a Knowledge Graph-based method to automate benchmark task generation across website versions.

* **Probabilistic Motion Planning for Redundant Robots** (Nov 2025 - Dec 2025)
  * EECS 465 (Intro to Algorithmic Robotics) Course Project
  * Advisor: Prof. Dmitry Berenson
  * Reproduced and benchmarked sampling-based motion planning algorithms (RRT-Connect, PRM) for a 7-DOF Franka Panda robot in simulation; implemented a hybrid sampling strategy that reduced trajectory generation latency by ~75%.

Skills
======
* **Languages**: Mandarin (native), English (fluent, TOEFL 100)
* **Programming Languages**: Python, C/C++, MATLAB, Java, LaTeX, Typst
* **Technical Skills**: Hugging Face, PyTorch, Git, Claude Code, Linux, Docker, ssh, SolidWorks
