---
title: "Efficient Inference for Embodied Foundation Models"
excerpt: "Investigating efficiency improvements in embodied foundational models without sacrificing success rates."
collection: portfolio
---

* **Duration:** Nov 2025 – Present
* **Role:** Research Assistant
* **Advisor:** Dr. Jiachen Liu (University of Michigan)

## Project Overview

My work focuses on improving the efficiency of embodied foundation models. I profiled **COSMOS-Policy** across denoising steps, observing that block-level residual skipping is infeasible while cross-attention outputs remain highly stable (cosine similarity > 0.999). 

## Key Contributions

* Validated **cross-attention KV caching** on **24 RoboCasa tasks**.
* Achieved an identical task success rate of 68.06% compared to the baseline across 3,600 rollout trials, ensuring consistent denoising speedup across all evaluated tasks.
* Currently designing **task-aware token compression**. This approach exploits the model's latent-frame slot structure to selectively prune image tokens via self-attention reduction, targeting further denoising acceleration on top of the validated caching strategy.
