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

Human–Computer Interaction (HCI), Generative UI, Computer-use Agents, and Human–AI Interaction.

## Education

**University of Michigan, Ann Arbor** · Aug 2025 – May 2027 (expected)<br>
B.S.E. in Computer Science · GPA: **3.86/4.00**

**Shanghai Jiao Tong University** · Aug 2023 – Aug 2027 (expected)<br>
B.Eng. in Electronic and Computer Engineering

## Publications

**A11yLTLNav: Automatic Detection of Accessibility Navigation Failures**

**Chenming Ge**, Kewen Peng, Chengyang Shi, Ben Greenman, Yue Jiang<br>
arXiv:2609.17959, 2026. **Submitted to CHI 2027.** First author.

Detects accessibility problems during web interaction, such as lost keyboard focus and missing feedback after an action. Human reviewers confirmed **274 of 309 reports (88.7% precision)** on 31 generated websites.

[arXiv](https://arxiv.org/abs/2609.17959) · [Project Page](/a11yltlnav/)

**Revision-Based Learning from Interactive Experience and Feedback (RELIEF)**

Jiawen Li, **Chenming Ge**, Alice Gao, Rishab Vempati, Yi-Hao Peng, Jason Wu<br>
Manuscript, 2026. **Submitted to NAACL 2027.**

RELIEF turns feedback-guided revisions of generated interfaces into training supervision for code generation models. We collected 355 interaction recordings and accompanying feedback from 24 users across 200 generated websites; critiques inferred from human interaction recordings led to the largest observed usability improvements across the two models tested.

[Paper (PDF)](/files/RELIEF.pdf) · [Research Project](/portfolio/generative-ui/)

## Research Experience

### [A11yLTLNav: Automatic Detection of Accessibility Navigation Failures](/portfolio/a11yltlnav/)

**Research Assistant, University of Utah** · May – Sep 2026<br>
Advisors: Dr. Yue Jiang and Dr. Ben Greenman

I developed A11yLTLNav, a property-based checker for accessibility navigation failures encountered by blind and low-vision users interacting with generated interfaces.

- Formalized common accessibility failures from prior user studies as Linear Temporal Logic (LTL) properties and tested them on randomly generated website interaction traces.
- Built a comparison web agent that detects accessibility failures through screen-reader feedback and keyboard-only interaction.
- Evaluated the checker on 31 generated websites; human reviewers confirmed 274 of 309 reports (88.7% precision).

[arXiv](https://arxiv.org/abs/2609.17959) · [Project Page](/a11yltlnav/)

### [RELIEF: Revision-Based Learning from Interactive Experience and Feedback](/portfolio/generative-ui/)

**Research Assistant, Purdue University** · May – Oct 2026<br>
Advisor: Dr. Jason Wu

I investigated how user interaction traces provide implicit feedback for improving the usability of generated interfaces. This work contributed to RELIEF, which uses feedback-guided interface revisions to construct supervision for fine-tuning code generation models.

- Built a pipeline to generate websites, collect task interaction traces in a user study, diagnose usability problems, and automatically repair websites using the resulting critiques.
- Explored fine-tuning UI generation models using websites revised with usability critiques. RELIEF reconstructs the corresponding generation traces for supervised fine-tuning.
- Explored computer-use agents and coding agents as baselines for simulating user behavior and providing usability feedback.

[Paper (PDF)](/files/RELIEF.pdf) · [Publication Details](/publication/relief/)

### [WebCoEvo: Adversarial Co-Evolution for Web Agents](/portfolio/web-agent-benchmark/)

**Research Assistant, University of Michigan** · Mar – Jun 2026<br>
Advisor: Prof. Honglak Lee

I developed WebCoEvo, an adversarial co-evolution framework that helps web agents adapt to changing websites by learning generalizable reflection rules from their failures.

- Paired a coding-agent-driven website version generator with a web agent to study adaptation to evolving interfaces.
- Extracted generalizable meta-level reflection rules from agent failure modes, improving performance by 19.6% over an ExpeL baseline.
- Worked on a knowledge-graph pipeline to automatically identify tasks affected by website version changes.
- Containerized multiple website versions with Docker using BrowserGym and AgentLab.

Earlier work is available under [More Projects](/portfolio/).

## Skills

- **Frameworks & platforms:** PyTorch, Hugging Face, CUDA, Docker, Linux, React, Vue, Vite, OpenAI SDK
- **Programming:** Python, C/C++, Java, Rust, HTML/CSS/JavaScript, TypeScript, SQL, MATLAB
- **Tools:** Figma, Illustrator, Remotion, MATLAB, Codex, Claude Code, SolidWorks, LabVIEW
