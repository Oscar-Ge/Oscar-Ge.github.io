---
permalink: /
title: "About Me"
author_profile: true
redirect_from:
  - /about/
  - /about.html
---

I am an undergraduate student pursuing a B.S.E. in Computer Science at the **University of Michigan, Ann Arbor** (expected May 2027), and a B.Eng. in Electronic and Computer Engineering at **Shanghai Jiao Tong University** (expected August 2027).

**I am seeking PhD opportunities starting in Fall 2027** in **Human–Computer Interaction (HCI), Human–AI Interaction, and Generative UI (GenUI)**. If you are recruiting PhD students or see a potential research fit, I would love to connect—please [get in touch](mailto:gecm@umich.edu).

My research explored how interaction feedback could improve AI-generated interfaces and support people and web agents. At Purdue University, I worked with **Dr. Jason Wu** on using interaction traces and feedback to improve generative UIs, contributing to **RELIEF**. I also worked with **Dr. Yue Jiang and Dr. Ben Greenman** at the University of Utah on detecting accessibility navigation failures, and with **Prof. Honglak Lee** at the University of Michigan on adapting web agents to evolving websites.

[CV (PDF)](/files/Chenming_Ge_CV.pdf) · [RELIEF Paper (PDF)](/files/RELIEF.pdf) · [Email](mailto:gecm@umich.edu)

## Research Interests

Human–Computer Interaction (HCI), Generative UI, Computer-use Agents, and Human–AI Interaction.

## Selected Publications

{% for post in site.publications reversed %}
  {% if post.category == 'preprints' %}
    {% include publication-card.html publication=post %}
  {% endif %}
{% endfor %}

## Research Experience

### [A11yLTLNav: Automatic Detection of Accessibility Navigation Failures](/portfolio/a11yltlnav/)

**Research Assistant, University of Utah** · May – Sep 2026<br>
Advisors: Dr. Yue Jiang and Dr. Ben Greenman

I developed A11yLTLNav, a property-based checker for accessibility navigation failures encountered by blind and low-vision users interacting with generated interfaces.

[arXiv](https://arxiv.org/abs/2609.17959) · [Project Page](/a11yltlnav/)

### [RELIEF: Revision-Based Learning from Interactive Experience and Feedback](/portfolio/generative-ui/)

**Research Assistant, Purdue University** · May – Oct 2026<br>
Advisor: Dr. Jason Wu

I investigated how user interaction traces provided implicit feedback for improving the usability of generated interfaces. This work contributed to RELIEF, which used feedback-guided interface revisions to construct supervision for fine-tuning code generation models.

[Paper (PDF)](/files/RELIEF.pdf) · [Publication Details](/publication/relief/)

### [WebCoEvo: Adversarial Co-Evolution for Web Agents](/portfolio/web-agent-benchmark/)

**Research Assistant, University of Michigan** · Mar – Jun 2026<br>
Advisor: Prof. Honglak Lee

I developed WebCoEvo, an adversarial co-evolution framework that helped web agents adapt to changing websites by learning generalizable reflection rules from their failures.

[More Projects →](/portfolio/)

## Contact

You can reach me at [gecm@umich.edu](mailto:gecm@umich.edu). My [CV](/cv/) includes education and additional research details.
