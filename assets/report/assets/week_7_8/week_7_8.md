# Week 7-8: SONIC deployment

Status: Done

## Method

- Policy: SONIC pretrained whole-body motion.
- Input: VR device motion or VLA command.
- Output: Coordinated full-body G1 motion.

## Training Objective

$$
\mathcal{L}_{\text{SONIC}}
=
\mathcal{L}_{\text{PPO}}
+
\mathcal{L}_{\text{recon}}
+
\mathcal{L}_{\text{token}}
+
\mathcal{L}_{\text{cycle}},
$$

where $\mathcal{L}_{\text{PPO}}$ trains physically stable motion tracking, $\mathcal{L}_{\text{recon}}$ reconstructs robot motion from the learned tokens, $\mathcal{L}_{\text{token}}$ aligns human and robot motion tokens, and $\mathcal{L}_{\text{cycle}}$ enforces cross-embodiment consistency.

## Content

- Produces more natural whole-body motion than IK.
- Better balance during manipulation.
- Main limitation: hand and end-effector accuracy is lower than IK.

## Comparison

| Dimension | IK + RL policy | SONIC |
| --- | --- | --- |
| Hand accuracy | High | Medium |
| Whole-body naturalness | Low | High |
| Balance during manipulation | Weak | Better |
| Suitability for data collection | Risky | Promising |

## Decision

Use SONIC as the current main whole-body teleoperation direction for data collection.

## Media

- `sonic_deploy_1.mp4`
- `sonic_deploy_2.mp4`
- `sonic_deploy_3.mp4`

(note) Arranged those three videos horizontally in a row.

## HTML mapping

- Timeline label: `Week 7-8`
- Card title: `Option B - One policy for whole-body`
