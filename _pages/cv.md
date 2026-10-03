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
[Download full CV (September 2026, PDF)]({{ '/files/Chenming_Ge_CV.pdf' | relative_url }})

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
arXiv:2609.17959, 2026. **Under review at CHI 2027.** First author.

A property-based checker for accessibility navigation failures affecting blind and low-vision screen-reader users. It checks temporal properties of interface interactions and achieves **88.7% precision** on generated websites.

[arXiv](https://arxiv.org/abs/2609.17959) · [Project Page](/a11yltlnav/)


## Research Experience


### [A11yLTLNav: Automatic Detection of Accessibility Navigation Failures](/portfolio/a11yltlnav/)

**Research Assistant, University of Utah** · May – Sep 2026<br>
Advisors: Dr. Yue Jiang and Dr. Ben Greenman

Detecting accessibility failures that emerge during interaction, beyond what a static page check can reveal.

- Developed a taxonomy of navigation failures affecting blind and low-vision screen-reader users, drawing on prior literature and user studies.
- Formalized navigation failures as Linear Temporal Logic (LTL) properties and implemented checks over interface interactions.
- Built a web-agent baseline that navigates through screen-reader feedback and keyboard-only interaction.
- Evaluated the checker on generated websites, achieving 88.7% precision.

### [Reinforcement Learning from Interactive Experience and Feedback](/portfolio/generative-ui/)

**Research Assistant, Purdue University** · May – Oct 2026<br>
Advisor: Dr. Jason Wu

Studying how interaction traces can improve the usability of generative UI (GenUI).

- Built a pipeline to generate websites, collect interaction traces from user studies, identify usability issues, and repair interfaces using the resulting critiques.
- Implemented Direct Preference Optimization (DPO) to fine-tune models for generating more usable interfaces.
- Explored computer-use agents and coding agents as baselines for simulating user behavior and providing usability feedback.

### [WebCoEvo: Adversarial Co-Evolution for Web Agents](/portfolio/web-agent-benchmark/)

**Research Assistant, University of Michigan** · Mar – Jun 2026<br>
Advisor: Prof. Honglak Lee

Helping web agents transfer what they learn as websites and interfaces change.

- Built an adversarial co-evolution framework that pairs a coding-agent-driven UI drift generator with a web agent.
- Extracted generalizable reflection rules from agent failures and compared them with an ExpeL baseline.
- Worked on a knowledge-graph pipeline to identify tasks affected by website version changes.
- Containerized multiple website versions with Docker using BrowserGym and AgentLab.

Earlier work is available under [More Projects](/portfolio/).

## Skills

- **Frameworks & platforms:** PyTorch, Hugging Face, CUDA, Docker, Linux, React, Vue, Vite, OpenAI SDK
- **Programming:** Python, C/C++, Java, Rust, HTML/CSS/JavaScript, TypeScript, SQL, MATLAB
- **Tools:** Figma, Illustrator, Remotion, MATLAB, Codex, Claude Code, SolidWorks, LabVIEW
