# Week 5-6: IK upper body plus RL lower body

Status: Hardware risk

## Method

- Upper body: IK-based joint-position control.
- Lower body: Pretrained RL locomotion policy.

## Training Objective

AMO uses upper-body IK for sparse target tracking and a lower-body policy for locomotion:
$$
(\mathbf{q}^{u}, \mathbf{c}) = \mathrm{IK}(\mathbf{x}^{\star}),
\qquad
\mathbf{a}^{l} = \pi^{l}(\mathbf{o}, \mathbf{v}^{\star}, \mathbf{c}).
$$

Here, \(\mathbf{x}^{\star}\) are head/wrist target poses, \(\mathbf{q}^{u}\) upper-body joints, \(\mathbf{c}\) torso/height commands, \(\mathbf{o}\) proprioception, \(\mathbf{v}^{\star}\) target velocity, \(\pi^{l}\) the lower-body policy, and \(\mathbf{a}^{l}\) lower-body actions.

## Content

- Under upper-body manipulation, the lower body struggled to maintain balance.
- Robot damage occurred during data collection runs.

## Trade-off observed

- IK advantage: better hand accuracy at the end-effector.
- IK problem: unnatural motion and poor stability during manipulation.

## Decision

Not suitable as the main data-collection method.

## Media

- `ik_demo.png`: Decouple whole body control.
- `robot_damage.JPG`: Hardware damage during teleoperating.

## HTML mapping

- Timeline label: `Week 5-6`
- Card title: `Option A - IK upper body + RL lower body`
- Figures: `FIG 5.1`, `FIG 5.2`
