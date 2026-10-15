---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
description: "One-line pitch of the game."
kind: "indie"          # pro | indie | tool
years: "{{ now.Year }}"
studio: ""
role: ""
platforms: []
tech: []
cover: "/images/games/{{ .File.ContentBaseName }}.jpg"
featured: false
weight: 100
# youtube: "VIDEO_ID"
# itch: "ITCH_EMBED_ID"
links: []
#  - name: "Steam"
#    url: "https://..."
---

A few lines about the game and what you did on it.
