---
name: motion
title: Motion
tokens:
  - duration.*
version: 1.0.0
---

# Motion

## Purpose

Motion confirms a state change and nothing more.

## Durations

- Quick, 150 ms: color changes on controls and links.
- Base, 200 ms: reserved for opening surfaces.

## Rules

- No entrance animation, parallax, or looping decoration.
- The loading placeholder pulses opacity only.
- Reduced motion removes all transitions and animations.
- Charts do not animate.

## Do and do not

- Animate color or opacity only.
- Never animate layout properties.
