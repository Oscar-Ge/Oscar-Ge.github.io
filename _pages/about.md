---
permalink: /
title: "About Me"
author_profile: true
redirect_from:
  - /about/
  - /about.html
---

I am an undergraduate student pursuing a B.S.E. in Computer Science at the **University of Michigan, Ann Arbor** (expected May 2027), and a B.Eng. in Electronic and Computer Engineering at **Shanghai Jiao Tong University** (expected August 2027).

My research focuses on improving how people and AI agents interact with interfaces. With **Dr. Jason Wu** at Purdue University, I study how interaction traces and feedback can improve generative UIs, contributing to **RELIEF**. I have also worked with **Dr. Yue Jiang and Dr. Ben Greenman** at the University of Utah on detecting accessibility navigation failures, and with **Prof. Honglak Lee** at the University of Michigan on adapting web agents to evolving websites.

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

I investigated how user interaction traces provide implicit feedback for improving the usability of generated interfaces. This work contributed to RELIEF, which uses feedback-guided interface revisions to construct supervision for fine-tuning code generation models.

[Paper (PDF)](/files/RELIEF.pdf) · [Publication Details](/publication/relief/)

### [WebCoEvo: Adversarial Co-Evolution for Web Agents](/portfolio/web-agent-benchmark/)

**Research Assistant, University of Michigan** · Mar – Jun 2026<br>
Advisor: Prof. Honglak Lee

I developed WebCoEvo, an adversarial co-evolution framework that helps web agents adapt to changing websites by learning generalizable reflection rules from their failures.

[More Projects →](/portfolio/)

## Contact

You can reach me at [gecm@umich.edu](mailto:gecm@umich.edu). My [CV](/cv/) includes education and additional research details.
