---
layout: archive
title: "CV"
author_profile: true
permalink: /cv/
redirect_from:
  - /resume
  - /cv-json/
  - /resume-json
---
[Download CV (PDF)]({{ '/files/Chenming_Ge_CV.pdf' | relative_url }})

## Research Interests

Human–Computer Interaction (HCI), Generative UI, Computer-use Agents, Human–AI Interaction.

## Education

**University of Michigan, Ann Arbor** · Aug 2025 – Present<br>
B.S.E. in Computer Science · GPA: **3.86/4.00**

Selected coursework: Machine Learning, Natural Language Processing, Computer Vision, Operating Systems, Database Management Systems, Applied Parallel Programming for GPUs.

**Shanghai Jiao Tong University** · Aug 2023 – Present<br>
B.Eng. in Electronic and Computer Engineering

## Publications

**[A11yLTLNav: Automatic Detection of Accessibility Navigation Failures](https://arxiv.org/abs/2609.17959)**

**Chenming Ge**<sup>*</sup>, Kewen Peng<sup>*</sup>, Chengyang Shi<sup>*</sup>, Ben Greenman, Yue Jiang<br>
arXiv:2609.17959, 2026. **Under review at CHI 2027.** (Equal contribution.)

A property-based checker for accessibility navigation failures affecting blind and low-vision screen-reader users. It checks temporal properties of interface interactions and achieves **88.7% precision** on generated websites.

[Paper](https://arxiv.org/abs/2609.17959) · [PDF](https://arxiv.org/pdf/2609.17959) · [BibTeX](/files/a11yltlnav.bib)


## Research Experience


### [A11yLTLNav: Automatic Detection of Accessibility Navigation Failures](/portfolio/a11yltlnav/)

**Research Assistant, University of Utah** · May – Sep 2026<br>
Advisors: Dr. Yue Jiang and Dr. Ben Greenman

Detecting accessibility failures that emerge during interaction, beyond what a static page check can reveal.

- Developed a taxonomy of navigation failures affecting blind and low-vision screen-reader users, drawing on prior literature and user studies.
- Formalized navigation failures as Linear Temporal Logic (LTL) properties and implemented checks over interface interactions.
- Built a web-agent baseline that navigates through screen-reader feedback and keyboard-only interaction.
- Evaluated the checker on generated websites, achieving 88.7% precision.

### [Improving Generative UIs from Use](/portfolio/generative-ui/)

**Research Assistant, Purdue University** · May 2026 – Present<br>
Advisor: Dr. Jason Wu

Studying how interaction traces can help AI-generated interfaces become more usable.

- Built a pipeline to generate websites, collect task interaction traces, diagnose usability issues, and repair interfaces with coding agents.
- Used trained computer-use agents as baselines for simulating user behavior and providing usability feedback.
- Investigating PPO-based fine-tuning and preference optimization using interaction feedback, with controlled experiments on task usability.

### [WebCoEvo: Adversarial Co-Evolution for Web Agents](/portfolio/web-agent-benchmark/)

**Research Assistant, University of Michigan** · Mar – Jun 2026<br>
Advisor: Prof. Honglak Lee

Helping web agents transfer what they learn as websites and interfaces change.

- Built an adversarial co-evolution framework that pairs a coding-agent-driven UI drift generator with a web agent.
- Extracted generalizable reflection rules from agent failures and compared them with an ExpeL baseline.
- Worked on a knowledge-graph pipeline to identify tasks affected by website version changes.
- Containerized multiple website versions with Docker and evaluated out-of-distribution generalization using BrowserGym and AgentLab.

### [Gravitational Effects on Microorganism Swarming](/portfolio/swarming-microorganisms/)

**Research Assistant, Shanghai Jiao Tong University** · Sep 2024 – Aug 2025<br>
Advisor: Dr. Zijie Qu

Automating colony boundary segmentation for the study of microorganism swarming.

- Trained a U-Net for colony boundary segmentation and diagnosed systematic failure modes.
- Adopted a zero-shot Segment Anything Model (SAM) pipeline for reliable automated detection, replacing a manual annotation pipeline.


## Selected Projects


### [Efficient Inference for Embodied Foundation Models](/portfolio/efficient-inference/)

Nov 2025 – Mar 2026<br>
Advisor: Dr. Jiachen Liu

Accelerating world action models for real-time robotic decision-making.

- Analyzed inference efficiency in world action models (WAMs) for robotic policies.
- Implemented cross-attention KV caching and token compression to accelerate inference.
- Explored dynamic-precision quantization and speculative decoding for more efficient agent decisions.

### [Probabilistic Motion Planning for Redundant Robots](/portfolio/probabilistic-motion-planning/)

Sep – Dec 2025<br>
Advisor: Prof. Dmitry Berenson

Benchmarking sampling-based planners on a simulated 7-DOF Franka Panda.

- Reproduced and benchmarked RRT-Connect and PRM in simulation.
- Implemented a hybrid sampling strategy that reduced trajectory generation latency by approximately 75%.


## Awards & Honors

- **Dean’s List**, University of Michigan · Apr 2026, Dec 2025
- **Meritorious Winner (10%)**, Interdisciplinary Contest in Modeling, COMAP · May 2025
- **Undergraduate Merit Scholarship (Class C)**, Shanghai Jiao Tong University · Oct 2024

## Skills

- **Frameworks & platforms:** PyTorch, Hugging Face, CUDA, Docker, Linux, React, Vue, Vite, OpenAI SDK
- **Programming:** Python, C/C++, Java, Rust, HTML/CSS/JavaScript, TypeScript, SQL, MATLAB
- **Tools:** Figma, Illustrator, Remotion, MATLAB, Codex, Claude Code, SolidWorks, LabVIEW
