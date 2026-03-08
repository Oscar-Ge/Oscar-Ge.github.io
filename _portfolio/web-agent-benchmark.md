---
title: "Web Agent Version-Robust Benchmark"
excerpt: "A reproducible testing pipeline for modern LLM-based web agents."
collection: portfolio
---

* **Duration:** Jan 2026 - Present
* **Context:** EECS 545 (Machine Learning) Course Project
* **Advisor:** Prof. Honglak Lee

## Project Overview

Modern web agents often break when websites update their layouts or DOM structures. This project aims to benchmark the resilience of LLM-based web agents against historical website variations.

## Key Contributions

* Built a reproducible testing pipeline using **Docker** to deploy baseline agents like **QWen3-VL-30B** across historical snapshots of open-source websites (such as SimpleWiki).
* Formulated a taxonomy for web version variations and designed controlled experiments to isolate version-induced failure modes in **LLM-based web agents**.
* Implementing a **Knowledge Graph-based method** to automate benchmark task generation across different website versions dynamically.
