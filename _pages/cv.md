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

Detects accessibility problems during web interaction, such as lost keyboard focus and missing feedback after an action. Human reviewers confirmed **274 of 309 reports (88.7% precision)** on 31 generated websites.

[arXiv](https://arxiv.org/abs/2609.17959) · [Project Page](/a11yltlnav/)


## Research Experience


### [Accessibility in Web Interactions and Tasks](/portfolio/a11yltlnav/)

**Research Assistant, University of Utah** · May – Sep 2026<br>
Advisors: Dr. Yue Jiang and Dr. Ben Greenman

I study accessibility barriers that arise as blind and low-vision screen-reader users navigate websites and complete tasks, including lost keyboard focus and missing feedback after an action. Drawing on prior user studies, I develop automated checks that follow interactions to detect these problems.

- Synthesized findings from prior literature and user studies into a taxonomy of accessibility barriers in web navigation.
- Developed checks for how interfaces respond to keyboard actions, including whether focus moves appropriately and feedback is available.
- Built a comparison agent that attempts website tasks using keyboard input and screen-reader feedback.
- Evaluated the checker on 31 generated websites; human reviewers confirmed 274 of 309 reports (88.7% precision).

### [Usability for Generative UIs (GenUI)](/portfolio/generative-ui/)

**Research Assistant, Purdue University** · May – Oct 2026<br>
Advisor: Dr. Jason Wu

I study how user interaction traces and feedback can reveal usability problems in generative UIs (GenUI), and use these insights to improve generated interfaces.

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
