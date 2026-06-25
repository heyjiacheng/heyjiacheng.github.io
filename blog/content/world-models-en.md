---
title: The Mathematical Essence of Three World Model Paradigms in Robot Learning
publishedDate: June 19, 2026, The Dragon Boat Festival
authors: Jiahang Cao, Hanzhong Guo, Qihao Zheng, Chunfeng Song, Andrew F. Luo
---

# The Mathematical Essence of Three World Model Paradigms in Robot Learning

> **TL;DR**  
> This article analyzes three common World Model paradigms in robot learning from the perspectives of probabilistic modeling and structured optimization: IDM-style, Single-backbone, and MoT-style. All three ultimately approximate the same conditional policy:
>
> $$
> \pi(a_t \mid o_{1:t}, a_{1:t-1}, l),
> $$
>
> but they differ in how they structure the modeling problem: IDM-style explicitly introduces a future goal $g_t$; Single-backbone directly parameterizes the action policy with a unified model; MoT-style first learns a shared representation $Z_t$, then uses expert modules to to model modality-specific outputs, such as action, vision, language, and other predictions. This article focuses on the probabilistic factorization, optimization conflicts, and parameter coupling behind these architectures from a Hessian perspective.
>
> **Recommended Reading Time: About 15 Minutes**

The central problem in robot learning can be written directly as a conditional policy learning problem:

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l),
$$

where, at time $t$:

- $o_{1:t}$ denotes the observation sequence from the initial time step to the current time step;
- $a_{1:t-1}$ denotes the sequence of actions already executed in the past;
- $l$ denotes the language instruction;
- $a_t$ is the action to be produced at the current time step.

For real robotic systems, the current single-frame observation $o_t$ is usually not a complete state. It may not reveal velocity, contact force, or states behind occlusions, and it also cannot fully encode the system's dynamical history. Therefore, strictly speaking, the policy should usually not be written only as $\pi(a_t \mid o_t,l)$, but rather as:

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l).
$$

The core World Model architectures in current robot learning can be roughly divided into three categories (figure from *World Model for Robot Learning: A Comprehensive Survey* [1]):

1. **Future-conditioned / IDM-style**: first predict a future goal, then use an inverse dynamics model to recover the action;
2. **Single-backbone**: use a unified model to directly output actions from the vision-language context;
3. **Shared-attention + Specialized Experts / MoT-style**: share cognitive representations, while separating modality-specific parameter updates at the expert level.

![image](https://hackmd.io/_uploads/S1cW1yezfl.png)

These three paradigms look quite different on the surface, but in essence they all approximate the same object:

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l).
$$

The difference lies in whether a future goal is explicitly introduced, whether all parameters are shared, and how optimization conflicts among vision, language, and action are handled.

# 0. Basic Modeling: From Observation History to Action

The interaction between a robot and its environment can be abstracted as a partially observable system. Let:

- $x_t \in \mathcal{X}$: the true environment state, such as object pose, velocity, contact state, robot joint state, and so on;
- $o_t \in \mathcal{O}$: the robot's observable state, such as RGB, depth, point cloud, and robot proprioception;
- $a_t \in \mathcal{A}$: the robot action space, such as end-effector pose increments, joint velocities, or gripper commands;
- $l \in \mathcal{L}$: the language instruction;
- $A_t =(a_t, a_{t+1}, \dots, a_{t+H-1})$: a continuous action prediction of length $H$, also called an Action Chunk;
- $O_{t+1} =(o_{t+1}, o_{t+2}, \dots, o_{t+L})$: a continuous observation prediction of length $L$;
- $y^L_t$: a language prediction, such as the next language token, a subtask description, a plan text, or another language-supervised signal.

The true dynamics can be written as:

$$
x_{t+1} \sim p(x_{t+1} \mid x_t, a_t),
$$

and the observation model as:

$$
o_t \sim p(o_t \mid x_t).
$$

Since $x_t$ is usually not directly observable, the robot can only make decisions based on its observation history and action history:

$$
a_t \sim \pi(a_t \mid o_{1:t}, a_{1:t-1}, l).
$$

The role of a World Model is to provide better world representations, future predictions, or structured intermediate variables for action decision-making under this partial observability.

# 1. Paradigm I: Future-Conditioned / IDM-Style

## 1.1 Core Idea and Mathematical Modeling

The basic idea of Future-conditioned / IDM-style is:

> First predict a future goal, then infer the current action from the current history and that goal.

The future goal does not have to be a pixel-level image. We define a general goal variable:

$$
g_t \in \mathcal{G}, \quad \mathcal{G} \text{ denotes the set of goal variables}.
$$

The goal variable $g_t$ can represent:

- the next observation $o_{t+1}$ or a future observation $o_{t+k}$ several steps ahead, as in UniPi [2], mimic-video [3], VLP [4], and VERA [5];
- a latent future representation, as in FLARE [6] and VLA-JEPA [7];
- an object-centric subgoal toward the final task objective, as in $\pi_{0.7}$ [8];
- an end-effector target pose, a short-term goal jointly defined by vision and language, and so on.

Then the policy can be written as:

\begin{align}
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
&= \int_{\mathcal{G}}p(a_t, g_t \mid o_{1:t}, a_{1:t-1}, l)dg_t.\\
&=\int_{\mathcal{G}}p(a_t \mid o_{1:t}, a_{1:t-1}, g_t, l)
p(g_t \mid o_{1:t}, a_{1:t-1}, l)
\, dg_t.
\end{align}

Approximating the two distributions with neural networks gives:

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
\approx
\int_{\mathcal{G}}
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, g_t, l)
q_\theta(g_t \mid o_{1:t}, a_{1:t-1}, l)
\, dg_t.
$$

Here:

- $q_\theta(g_t \mid o_{1:t}, a_{1:t-1}, l)$ is a video model or goal generator;
- $\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, g_t, l)$ is an inverse dynamics model or goal-conditioned controller.

This factorization can be understood as:

$$
\text{history + language}
\rightarrow
\text{future goal}
\rightarrow
\text{current action}.
$$

In other words, $q_\theta$ predicts "where the robot should go," while $\kappa_\phi$ converts that goal into the current action. If the goal is defined to be strongly action-related, then the world model itself essentially becomes an action planner, and the additional conversion $\kappa_\phi$ is no longer necessary. In the rest of this section, we assume by default that $g_t$ is defined as a goal that is not strongly tied to the action space.

> If one needs to obtain a short action chunk $A_t =(a_t, a_{t+1}, \dots, a_{t+H-1})$, one can execute each action, observe again, and repeatedly call the future model and IDM controller. It is also possible to predict a future goal sequence in one shot and decode an open-loop action sequence, but that formulation depends on extra rollout assumptions and is more prone to error accumulation.

---

## 1.2 Difference from Action-Conditioned Dynamics

If we set $g_t = o_{t+1}$, then:

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
\approx
\int_{\mathcal{O}}
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, o_{t+1}, l)
q_\theta(o_{t+1} \mid o_{1:t}, a_{1:t-1}, l)
\, do_{t+1}.
$$

Here we need to distinguish two different objects.

The first is future prediction:

$$
q_\theta(o_{t+1} \mid o_{1:t}, a_{1:t-1}, l).
$$

It predicts what the future may look like under the data distribution, given the current history and language instruction.

The second is action-conditioned dynamics:

$$
p_\theta(o_{t+1} \mid o_{1:t}, a_{1:t-1}, a_t, l).
$$

It predicts how the next observation will change if the robot executes the current action $a_t$.

These two are not the same. The former is closer to a future prior, while the latter is closer to the dynamics model or simulator needed for planning. Therefore, the future model $q_\theta(g|\cdot)$ in IDM-style can help generate goals, but it should not be directly equated with an action-conditioned world dynamics model.

---

## 1.3 Approximation Assumption in the Inverse Dynamics Model

The full controller should be written as:

$$
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, g_t, l).
$$

However, for simplicity, many implementations approximate it as:

$$
\kappa_\phi(a_t \mid o_t, g_t, l).
$$

This corresponds to introducing the following approximate conditional independence assumption:

$$
a_t \perp (o_{1:t-1}, a_{1:t-1})
\mid o_t, g_t, l.
$$

This assumption does not always hold. A single-frame observation $o_t$ may fail to capture velocity, contact, friction, occlusion, inertia, and other dynamical information. A more careful statement is:

$$
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, g_t, l)
\approx
\kappa_\phi(a_t \mid o_t, g_t, l).
$$

This is an engineering bottleneck approximation, not a strict theorem.

---

## 1.4 Training Objective

The future model can be trained by goal prediction:

$$\mathcal{L}_{\text{goal}}(\theta)=
\mathbb{E}\left[-\log q_\theta(g_t^\star \mid o_{1:t}, a_{1:t-1}, l)\right].
$$

The inverse dynamics model or controller can be trained by action supervision:

$$\mathcal{L}_{\text{IDM}}(\phi)=
\mathbb{E}
\left[
-\log \kappa_\phi(a_t^\star \mid o_{1:t}, a_{1:t-1}, g_t^\star, l)
\right].
$$

If $g_t^\star$ is a future image or future latent representation, the future model can be pretrained using action-free videos or large-scale visual sequences. However, futures in such videos are not necessarily executable by a robot, so future work still needs to investigate the alignment between the video modality and the robot action modality.

---

## 1.5 Integral Approximation at Inference Time

In theory, the action policy should marginalize over all possible goals:

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
\approx
\int_{\mathcal{G}}
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, g_t, l)
q_\theta(g_t \mid o_{1:t}, a_{1:t-1}, l)
\, dg_t.
$$

The meaning of this expression is that the current action should not depend on only one deterministic goal. Instead, it should aggregate the action distributions under all possible goals $g_t$, weighted by the probabilities of those goals.

Here:

- $q_\theta(g_t \mid o_{1:t}, a_{1:t-1}, l)$ represents the goal distribution;
- $\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, g_t, l)$ represents the action distribution conditioned on a given goal $g_t$.

If $g_t$ is a discrete goal, the above expression corresponds to a weighted sum. If $g_t$ is continuous, it becomes an integral.

In real systems, however, $g_t$ is often an image, trajectory, waypoint, or high-dimensional latent variable, and computing this integral exactly is usually infeasible. Therefore, inference usually requires approximation.

The most common engineering implementation is to let a neural network directly predict a goal:

$$
\hat{g}_t=
f_\theta(o_{1:t}, a_{1:t-1}, l).
$$

Then the controller directly outputs an action conditioned on that goal:

$$
a_t \sim
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, \hat{g}_t, l).
$$

This can be understood as approximating the goal distribution by a Dirac delta distribution:

$$
q_\theta(g_t \mid o_{1:t}, a_{1:t-1}, l)
\approx
\delta(g_t - \hat{g}_t).
$$

Substituting this into the original integral gives:

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
\approx
\int_{\mathcal{G}}
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, g_t, l)
\delta(g_t - \hat{g}_t)
\, dg_t.
$$

By the defining property of the Dirac delta:

$$
\int f(g_t)\delta(g_t-\hat{g}_t)dg_t=
f(\hat{g}_t),
$$

we obtain:

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
\approx
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, \hat{g}_t, l).
$$

Therefore, directly outputting a single goal $\hat{g}_t$ with a neural network is, in essence, a point-estimate degeneration of the full goal distribution $q_\theta(g_t \mid o_{1:t}, a_{1:t-1}, l)$.

---

Alternatively, one can use MAP approximation or Monte Carlo approximation; details are given in the appendix.

In practice, systems often use a single predicted goal $\hat{g}_t$ or a small number of sampled goals due to inference-time constraints. This is efficient, but it may also lead to single-mode goals, mode collapse, unreachable goals, and error accumulation.

---

## 1.6 Sources of Error

Omitting conditioning variables, the ideal policy is:

$$\pi(a)=
\int
\kappa(a \mid g)q(g)dg,
$$

and the learned policy is:

$$
\hat{\pi}(a)=
\int
\hat{\kappa}(a \mid g)\hat{q}(g)dg.
$$

An intuitive error decomposition is:

$$
\mathrm{TV}(\pi,\hat{\pi})
\le
\mathbb{E}_{g\sim q}
\left[
\mathrm{TV}
\left(
\kappa(\cdot\mid g),
\hat{\kappa}(\cdot\mid g)
\right)
\right]
+
\mathrm{TV}(q,\hat{q}).
$$

This shows that the final policy error comes from two sources:

1. the error of the future / goal model;
2. the error of the inverse dynamics model / controller.

If the predicted goal is unreachable, ambiguous, or contaminated by visual artifacts, the controller can be directly misled.

---

## 1.7 Advantages and Limitations

**Advantages:**

1. Clear modular structure, making interpretation and diagnosis easier;
2. The future model can be pretrained using action-free videos or large-scale visual sequences;
3. Suitable for hierarchical control, subgoal planning, and short-term waypoint prediction;
4. Failure causes are relatively easy to decompose: either the goal prediction is wrong, or the controller is wrong.

**Limitations:**

1. Future prediction is not the same as action-conditioned dynamics;
2. The design of the goal variable $g_t$ is highly sensitive;
3. Integration over a high-dimensional goal space is difficult;
4. Errors from the future model and the controller can compound;
5. A future that looks plausible in video is not necessarily executable by a robot.

# 2. Paradigm II: Single-Backbone

## 2.1 Core Idea and Mathematical Modeling

The core idea of Single-backbone is:

> Do not explicitly separate the future model and the controller; instead, use a unified model to directly learn the conditional policy from observation history, action history, and language instruction to action.

Thus, the basic modeling object is:

$$
\pi_\Theta(a_t \mid o_{1:t}, a_{1:t-1}, l).
$$

Here, the model no longer explicitly introduces a future goal variable $g_t$, nor does it split the policy into two stages: "goal prediction" and "inverse dynamics control." Instead, it directly uses a unified parameterized model $p_\Theta$ to approximate the action policy:

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
\approx
p_\Theta(a_t \mid o_{1:t}, a_{1:t-1}, l).
$$

If the model predicts not a single-step action, but a short-horizon action trajectory, or Action Chunk, then it can be written as:

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
\approx p_\Theta(A_t \mid o_{1:t}, a_{1:t-1}, l),
$$

$$
A_t =
(a_t, a_{t+1}, \dots, a_{t+H-1}).
$$

Here $H$ is the prediction horizon. The action decoder can be parameterized in different ways, such as discrete autoregressive tokens or continuous flow-based decoding. Since this does not change the high-level probabilistic formulation, we leave these implementation details to the Appendix.

From the perspective of probabilistic modeling, the focus of Single-backbone is not to introduce a new conditional independence assumption, but to directly learn:

$$
(o_{1:t}, a_{1:t-1}, l)
\longmapsto
a_t /A_t.
$$

In other words, visual understanding, language grounding, action-history modeling, and action generation are all compressed into a single unified model. Representative works include the $\pi$ series, such as $\pi_0$ [9], $\pi_{0.5}$ [10], Cosmos Policy [11], DreamZero [12], and others.

---

## 2.2 Training Objective

A more general mathematical model for Single-backbone can be written as:

$$
\pi(O_{t+1}, A_{t}, y_t^L \mid o_{1:t}, a_{1:t-1}, l)
\approx p_\Theta(O_{t+1}, A_{t}, y_t^L \mid o_{1:t}, a_{1:t-1}, l).
$$

This formulation applies only when the model simultaneously generates observations, language, and actions. Many VLA models do not predict future images or language, and instead directly learn the conditional policy:

$$
p_\Theta(A_{t} \mid o_{1:t}, a_{1:t-1}, l).
$$

If the model additionally includes visual prediction, language modeling, or reconstruction tasks, the objective can be written as a multi-task loss:

$$
\mathcal{L}(\Theta)=
\lambda_V \mathcal{L}_V(\Theta)
+
\lambda_A \mathcal{L}_A(\Theta)
+
\lambda_L \mathcal{L}_L(\Theta).
$$

where:

- $\mathcal{L}_V$ is the visual prediction or visual reconstruction loss;
- $\mathcal{L}_A$ is the action prediction loss;
- $\mathcal{L}_L$ is the language modeling or language understanding loss;
- $\lambda_V,\lambda_A,\lambda_L$ are task weights.

These weights are important. Vision, language, and action have very different token counts, scales, noise levels, and gradient statistics, so they should not be treated as automatically equivalent.

---

## 2.3 Gradient Conflict in Multi-Objective Optimization

Let:

$$
g_V = \nabla_\Theta \mathcal{L}_V,
$$

$$
g_A = \nabla_\Theta \mathcal{L}_A.
$$

If

$$
\langle g_V, g_A\rangle < 0,
$$

then the visual task and the action task conflict on the shared parameters. Updating in the direction that reduces the visual loss may increase the action loss.

If, in addition,

$$
\|g_V\| \gg \|g_A\|,
$$

and no loss reweighting, gradient normalization, or task balancing is applied, then action learning may be dominated by the visual task.

The same reasoning applies when discussing language modeling tasks.

This is not a necessary theorem, but a common risk. It may depend on:

- data ratio;
- loss weights;
- tokenization;
- optimizer;
- action head design;
- whether the visual encoder is frozen;
- whether adapter, LoRA, or partial fine-tuning is used;
- whether gradient clipping or gradient normalization is applied;
- and other factors.

---

## 2.4 Hessian Perspective

The Hessian of the total loss is:

$$
H=
\nabla_\Theta^2 \mathcal{L}=
\lambda_V H_V
+
\lambda_A H_A
+
\lambda_L H_L.
$$

If different tasks have very different curvature scales in parameter space, the condition number of the total Hessian may worsen:

$$
\kappa(H)=
\frac{\lambda_{\max}(H)}
{\lambda_{\min}(H)}.
$$

This can make the optimization path unstable. Intuitively, visual tasks may focus more on high-dimensional details, while action tasks focus on low-dimensional but precise control signals. Their sensitive directions in parameter space need not be aligned.

However, one should not simply claim that "vision is higher-dimensional, so the Hessian must be ill-conditioned." A more accurate statement is:

> Multimodal parameter sharing can introduce gradient conflict and curvature mismatch, which must be mitigated through architectural design or optimization strategies.

---

## 2.5 Advantages and Limitations

**Advantages:**

1. Strong end-to-end capability, directly learning $\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)$;
2. Can inherit semantic knowledge from vision-language foundation models;
3. Suitable for large-scale multi-task imitation learning;
4. Does not require explicitly designing intermediate goal variables;
5. Strong scaling potential.

**Limitations:**

1. Multimodal tasks may conflict with one another;
2. Action tokenization or action head design can be highly sensitive;
3. Low-level control requires real-time performance, stability, and precision, which cannot be solved by model scale alone;
4. When the model fails, it is difficult to determine whether the problem lies in vision, language, history modeling, or action output.


# 3. Paradigm III: Shared-Attention + Specialized Experts / MoT-Style

## 3.1 Core Idea and Probabilistic Modeling

MoT-style can be viewed as a structured version of Single-backbone:

> Share part of the cognitive computation, but separate the parameter updates for different tasks in modality-specific experts.

Representative works include BagelVLA [13], Lingbot-VA [14], FastWAM [15], DiT4DiT [16], Motus [17], Cosmos3 [18], and others.

It neither fully separates perception, language, and control, nor forces all modalities to share all parameters. Its core idea is to first obtain a unified context representation through shared attention or a shared backbone, and then let different experts model different output distributions.

Define the shared representation:

$$
Z_t =
f_\Phi(o_{1:t}, a_{1:t-1}, l),
$$

where $\Phi$ denotes the parameters of the shared attention / shared backbone, and $Z_t$ is the context representation jointly formed from the observation history, action history, and language instruction.

On top of this representation, different experts handle different prediction tasks.

The action expert models the action trajectory distribution:

$$
p_{\Phi,\theta_A}(A_t \mid o_{1:t}, a_{1:t-1}, l)=
p_{\theta_A}(A_t \mid Z_t),
$$

where

$$
A_t = (a_t, a_{t+1}, \dots, a_{t+H-1}).
$$

The visual expert can model the future observation distribution:

$$
p_{\Phi,\theta_O}(O_{t+1} \mid o_{1:t}, a_{1:t-1}, l)=
p_{\theta_O}(O_{t+1} \mid Z_t).
$$

where

$$
O_{t+1} =(o_{t+1}, o_{t+2}, \dots, o_{t+L}).
$$

The language expert can model language-related outputs, such as task descriptions, subgoal text, reasoning tokens, or high-level plans:

$$
p_{\Phi,\theta_L}(y_t^L \mid o_{1:t}, a_{1:t-1}, l)=
p_{\theta_L}(y_t^L \mid Z_t).
$$

Here $y_t^L$ denotes a language-side output, which can be the next language token, a subtask description, a plan text, or another language-supervised signal.

Therefore, the high-level structure of MoT-style can be written as:

$$
(o_{1:t}, a_{1:t-1}, l)
\rightarrow
Z_t
\rightarrow
\begin{cases}
p_{\theta_A}(A_t \mid Z_t), \\
p_{\theta_O}(O_{t+1} \mid Z_t), \\
p_{\theta_L}(y_t^L \mid Z_t).
\end{cases}
$$

That is, $Z_t$ is not an explicit future goal variable. It is a multimodal context representation learned by shared attention. Different experts model different output distributions based on the same $Z_t$.

Here, action, future observation, and language are used only as representative examples; the same formulation can be extended to other modality-specific outputs (e.g., audio, depth, segmentation, flow, etc.).

---

## 3.2 Approximate Factorization of the Joint Distribution

If the model simultaneously predicts future observations, action trajectories, and language outputs, we can start from the joint conditional distribution:

$$
p(O_{t+1}, A_t, y_t^L \mid o_{1:t}, a_{1:t-1}, l).
$$

MoT-style introduces the shared representation:

$$
Z_t = f_\Phi(o_{1:t}, a_{1:t-1}, l),
$$

and uses different experts for an approximate factorization:

$$
p_{\Phi,\theta_O,\theta_A,\theta_L}
(O_{t+1}, A_t, y_t^L \mid o_{1:t}, a_{1:t-1}, l)
\approx
p_{\theta_O}(O_{t+1} \mid Z_t)
p_{\theta_A}(A_t \mid Z_t)
p_{\theta_L}(y_t^L \mid Z_t).
$$

This factorization implies the following approximate conditional independence:

$$
O_{t+1} \perp A_t \perp y_t^L
\mid Z_t.
$$

More precisely, it means that, given the shared representation $Z_t$, the visual, action, and language outputs are modeled separately by their corresponding experts.

Whether this approximation is reasonable depends on whether $Z_t$ sufficiently preserves task-relevant information. If $Z_t$ loses contact state, object geometry, task phase, language intent, or hidden dynamical information, then even a clean expert separation cannot recover the missing representation.

Therefore, this factorization should be understood as a structured modeling approximation, not a strict equality.

---

## 3.3 The Role of Shared Attention

Shared attention provides a cross-modal information exchange channel.

Observation history can provide scene geometry, object relationships, and task progress; action history can help infer the current phase and dynamical state; language instruction provides the task objective and semantic constraints. Shared attention mixes these signals into a unified representation:

$$
Z_t =
f_\Phi(o_{1:t}, a_{1:t-1}, l).
$$

However, shared attention itself does not maximize mutual information. Unless an InfoNCE objective, a variational mutual information bound, or an information bottleneck objective is explicitly introduced, one should not write:

$$
\max I(Z_t; o_{1:t}, a_{1:t-1}, l).
$$

A more accurate statement is:

> Shared attention gives the model the capacity to fuse cross-modal information; which information is actually preserved depends on the training objective, data distribution, model capacity, and representation bottleneck.

Thus, the key point of MoT-style is not that "attention automatically learns an optimal representation," but rather that it preserves cross-modal interaction through a shared representation while reducing direct optimization conflict among different tasks through expert parameter separation.

---

## 3.4 Multi-Task Training Objective

If the model includes visual prediction, action prediction, and language prediction, the training objective can be written as:

$$
\mathcal{L}(\Phi,\theta_O,\theta_A,\theta_L)=
\lambda_O \mathcal{L}_O(\Phi,\theta_O)
+
\lambda_A \mathcal{L}_A(\Phi,\theta_A)
+
\lambda_L \mathcal{L}_L(\Phi,\theta_L).
$$

where:

- $\mathcal{L}_O$ is the visual prediction or visual reconstruction loss;
- $\mathcal{L}_A$ is the action trajectory prediction loss;
- $\mathcal{L}_L$ is the language modeling, plan generation, or task-description loss;
- $\lambda_O,\lambda_A,\lambda_L$ are task weights;
- $\Phi$ denotes the shared representation parameters;
- $\theta_O,\theta_A,\theta_L$ denote the visual, action, and language expert parameters, respectively.

This objective reflects the core structure of MoT-style: the shared parameters $\Phi$ receive gradients from all tasks, while each expert parameter block mainly serves its corresponding task.

---

## 3.5 Partial Block Structure of the Hessian

The key mathematical property of MoT-style lies in parameter partitioning.

Since the visual expert parameters $\theta_O$ only appear in the visual loss, the action expert parameters $\theta_A$ only appear in the action loss, and the language expert parameters $\theta_L$ only appear in the language loss, the direct second-order coupling among experts is zero:

$$
\frac{\partial^2 \mathcal{L}}
{\partial \theta_O \partial \theta_A}=
0,
\quad
\frac{\partial^2 \mathcal{L}}
{\partial \theta_O \partial \theta_L}=
0,
\quad
\frac{\partial^2 \mathcal{L}}
{\partial \theta_A \partial \theta_L}=
0.
$$

This means that the visual, action, and language experts have no direct second-order parameter coupling.

However, the full Hessian is defined with respect to all parameters:

$$
(\Phi,\theta_O,\theta_A,\theta_L).
$$

Its structure is:

$$
H =
\begin{bmatrix}
H_{\Phi\Phi} & H_{\Phi O} & H_{\Phi A} & H_{\Phi L} \\
H_{O\Phi} & H_{OO} & 0 & 0 \\
H_{A\Phi} & 0 & H_{AA} & 0 \\
H_{L\Phi} & 0 & 0 & H_{LL}
\end{bmatrix}.
$$

Because $\Phi$ is shared, the visual, action, and language losses all update it. Therefore, the overall Hessian is not strictly block-diagonal.

More precisely:

> MoT-style reduces direct gradient and second-order coupling at the expert-parameter level, but the shared representation layer remains coupled.

Thus, it does not eliminate modality conflict completely. It mainly confines the conflict to the shared representation layer, while reducing direct interference among expert parameters.

---

## 3.6 Advantages and Limitations

**Advantages:**

1. Preserves cross-modal information fusion;
2. Can support action prediction, visual prediction, and language prediction at the same time;
3. Reduces direct parameter conflict among visual, action, and language experts;
4. More suitable for multimodal and multi-task scaling than a fully shared Single-backbone;
5. Allows different capacities for vision, action, language, touch, depth, and other modalities;
6. Structurally balances unified representation and modality specialization.

**Limitations:**

1. Shared attention or a shared backbone can still suffer from modality conflict;
2. Expert structures introduce memory, routing, and deployment complexity;
3. In high-frequency closed-loop control, shared attention plus expert routing may introduce inference latency;
4. Loss balancing, routing, and expert capacity need to be carefully designed;
5. Expert separation cannot compensate for missing information in the shared representation $Z_t$;
6. If the shared representation is dominated by visual or language tasks, the action expert may still receive a representation that is not suitable for control.

# 4. A Unified View of the Three Paradigms

All three paradigms ultimately approximate:

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l).
$$

They differ in whether they introduce an intermediate goal variable and how they design parameter sharing.

---

## 4.1 IDM-Style: Explicit Goal Variable

The structure of IDM-style is:

$$
(o_{1:t}, a_{1:t-1}, l)
\rightarrow
g_t
\rightarrow
a_t.
$$

Its mathematical form is:

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
\approx
\int
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, g_t, l)
q_\theta(g_t \mid o_{1:t}, a_{1:t-1}, l)
dg_t.
$$

If $A_t$ is needed, the above process can be repeated recursively.

Its key question is:

> Is $g_t$ both easy to predict and sufficient for control?

If $g_t$ is too high-dimensional, integration and control become difficult. If $g_t$ is too low-dimensional, semantic and contact details may be lost.

---

## 4.2 Single-Backbone: Implicit Policy Learning

The structure of Single-backbone is:

$$
(o_{1:t}, a_{1:t-1}, l)
\rightarrow
A_t, \underbrace{O_{t+1}, y_t^L}_{\text{optional}} 
$$

Its mathematical form is:

$$
\pi(O_{t+1}, A_{t}, y_t^L \mid o_{1:t}, a_{1:t-1}, l)
\approx p_\Theta(O_{t+1}, A_{t}, y_t^L \mid o_{1:t}, a_{1:t-1}, l).
$$

Its key question is:

> Can a shared parameter space simultaneously support visual understanding, language grounding, history modeling, and precise control?

If data, model capacity, and optimization are all sufficient, it has strong scaling potential. However, if gradient conflict or loss-scale imbalance occurs, action capability may be weakened.

---

## 4.3 MoT-Style: Shared Representation and Expert Specialization

The structure of MoT-style is:

$$
(o_{1:t}, a_{1:t-1}, l)
\rightarrow
Z_t
\rightarrow
\begin{cases}
p_{\theta_A}(A_t \mid Z_t), \\
p_{\theta_O}(O_{t+1} \mid Z_t), \\
p_{\theta_L}(y_t^L \mid Z_t).
\end{cases}
$$

Its mathematical form is:

$$
p_{\Phi,\theta_O,\theta_A,\theta_L}
(O_{t+1}, A_t, y_t^L \mid o_{1:t}, a_{1:t-1}, l)
\approx
p_{\theta_O}(O_{t+1} \mid Z_t)
p_{\theta_A}(A_t \mid Z_t)
p_{\theta_L}(y_t^L \mid Z_t).
$$

Its key question is:

> Which information should be shared, and which parameters should be specialized?

The advantage of MoT-style is that it avoids the extremes of full sharing and full separation. Instead, it creates a compromise between shared cognition and modality-specific updates.


# 5. Comparison Summary

| Paradigm | Mathematical Form | Core Strength | Core Risk |
|---|---|---|---|
| Future-conditioned / IDM-style | $\pi(a_t\mid o_{1:t},a_{1:t-1},l)\approx\int \kappa_\phi(a_t\mid o_{1:t},a_{1:t-1},g_t,l)q_\theta(g_t\mid o_{1:t},a_{1:t-1},l)dg_t$, then recursively obtain $A_t$. | Modular structure; can use action-free videos; interpretable | Future prediction is not dynamics; unreachable goals; error accumulation |
| Single-backbone / VLA-style | $\pi(O_{t+1}, A_{t}, y_t^L \mid o_{1:t}, a_{1:t-1}, l)\approx p_\Theta(O_{t+1}, A_{t}, y_t^L \mid o_{1:t}, a_{1:t-1}, l).$ | End-to-end; strong scaling potential; semantic transfer | Gradient conflict; sensitive action representation; closed-loop control pressure |
| MoT-style | $Z_t=f_\Phi(o_{1:t},a_{1:t-1},l)$, $p_{\Phi,\theta_O,\theta_A,\theta_L}(O_{t+1}, A_t, y_t^L \mid o_{1:t}, a_{1:t-1}, l)\approx p_{\theta_O}(O_{t+1} \mid Z_t)p_{\theta_A}(A_t \mid Z_t)p_{\theta_L}(y_t^L \mid Z_t).$ | Shared cognition while reducing expert-level conflict; suitable for multimodal scaling | Shared layers remain coupled; engineering complexity; possible inference latency |


# 6. Conclusion

World Model architectures in robot learning should not be understood simply as a ranking of which architecture is more advanced. More accurately, they represent three different structural choices:

- **IDM-style** explicitly introduces a goal variable;
- **Single-backbone** directly learns the conditional policy;
- **MoT-style** balances shared representation and expert specialization.

Mathematically, all three approximate the same object:

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l).
$$

The real challenge is not merely predicting the future, but predicting futures that are executable. It is not merely unifying modalities, but ensuring that shared parameters do not damage control learning. It is not merely adding experts, but designing expert specialization that truly reduces optimization conflict.

Therefore, a more reasonable conclusion is:

> The future of robot World Models is unlikely to converge to a single standard architecture. A more likely direction is to find better compromises among shared cognition, structured specialization, executable prediction, and closed-loop control.


# 7. References

[1] Hou B, Li G, Jia J, et al. World model for robot learning: A comprehensive survey[J]. arXiv preprint arXiv:2605.00080, 2026.

[2] Du Y, Yang S, Dai B, et al. Learning universal policies via text-guided video generation[J]. Advances in neural information processing systems, 2023, 36: 9156-9172.

[3] Pai J, Achenbach L, Montesinos V, et al. mimic-video: Video-action models for generalizable robot control beyond vlas[J]. arXiv preprint arXiv:2512.15692, 2025.

[4] Chen B, Zhang T, Geng H, et al. Large video planner enables generalizable robot control[J]. arXiv preprint arXiv:2512.15840, 2025.

[5] Li S L, Kim E, Bai X, et al. Turning Video Models into Generalist Robot Policies[J]. arXiv preprint arXiv:2605.27817, 2026.

[6] Zheng R, Wang J, Reed S, et al. Flare: Robot learning with implicit world modeling[J]. arXiv preprint arXiv:2505.15659, 2025.

[7] Sun J, Zhang W, Qi Z, et al. Vla-jepa: Enhancing vision-language-action model with latent world model[J]. arXiv preprint arXiv:2602.10098, 2026.

[8] Ai B, Amin A, et al. π0. 7: a steerable generalist robotic foundation model with emergent capabilities, 2026[J]. URL https://arxiv.org/abs/2604.15483.

[9] Black K, Brown N, Driess D, et al. $\pi_0 $: A Vision-Language-Action Flow Model for General Robot Control[J]. arXiv preprint arXiv:2410.24164, 2024.

[10] Black K, Brown N, et al. $\pi_ {0.5} $: a Vision-Language-Action Model with Open-World Generalization[J]. arXiv preprint arXiv:2504.16054, 2025.

[11] Kim M J, Gao Y, Lin T Y, et al. Cosmos policy: Fine-tuning video models for visuomotor control and planning[J]. arXiv preprint arXiv:2601.16163, 2026.

[12] Ye S, Ge Y, Zheng K, et al. World action models are zero-shot policies[J]. arXiv preprint arXiv:2602.15922, 2026.

[13] Hu Y, Zhang J, Luo Y, et al. Bagelvla: Enhancing long-horizon manipulation via interleaved vision-language-action generation[J]. arXiv preprint arXiv:2602.09849, 2026.

[14] Li L, Zhang Q, Luo Y, et al. Causal World Modeling for Robot Control[J]. arXiv preprint arXiv:2601.21998, 2026.

[15] Yuan T, Dong Z, Liu Y, et al. Fast-wam: Do world action models need test-time future imagination?[J]. arXiv preprint arXiv:2603.16666, 2026.

[16] Ma T, Zheng J, Wang Z, et al. Dit4dit: Jointly modeling video dynamics and actions for generalizable robot control[J]. arXiv preprint arXiv:2603.10448, 2026.

[17] Bi H, Tan H, Xie S, et al. Motus: A unified latent action world model[C]//Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition. 2026: 35101-35113.

[18] Agarwal N, Ali A, Allen J, et al. Cosmos 3: Omnimodal World Models for Physical AI[J]. arXiv preprint arXiv:2606.02800, 2026.

# Appendix

## Integral Approximation at Inference Time for IDM-Style Models

Besides directly estimating $g_t$ with a neural network, one can also use MAP or Monte Carlo approximation.

### MAP Approximation

If $q_\theta$ explicitly represents a goal distribution, one can choose the most likely goal:

$$
\hat{g}_t =
\arg\max_g
q_\theta(g \mid o_{1:t}, a_{1:t-1}, l).
$$

Then execute:

$$
a_t \sim
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, \hat{g}_t, l).
$$

This is the MAP approximation. It is simple to compute, but it loses diversity and uncertainty in the goal distribution.

---

### Monte Carlo Approximation

If $q_\theta$ is a samplable distribution, such as a diffusion model, autoregressive model, or Gaussian latent model, one can sample multiple goals:

$$
g_t^{(i)}
\sim
q_\theta(g_t \mid o_{1:t}, a_{1:t-1}, l),
\quad i=1,\dots,N.
$$

Then use the sample average to approximate the integral:

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
\approx
\frac{1}{N}
\sum_{i=1}^{N}
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, g_t^{(i)}, l).
$$

When $N$ is large, this is closer to the theoretical marginalization. When $N=1$, it degenerates into a single-sample approximation.

---

## Parameterizations of Action Output

The action output distribution can be parameterized in different ways.

If actions are discretized into tokens, autoregressive modeling can be used:

$$
p_\Theta(a_t \mid o_{1:t}, a_{1:t-1}, l)=
\prod_{k=1}^{K}
p_\Theta
\left(
a_{t,k}
\mid
a_{t,<k},
o_{1:t},
a_{1:t-1},
l
\right),
$$

where $a_{t,1:K}$ denotes the discrete token sequence of the current action $a_t$.

If actions remain continuous, it is more common to directly model a short-horizon action trajectory distribution:

$$
p_\Theta(A_t \mid o_{1:t}, a_{1:t-1}, l).
$$

For example, in Diffusion Policy, the model starts from a noisy action trajectory:

$$
A_t^K \sim \mathcal{N}(0,I),
$$

and gradually denoises it:

$$
A_t^{k-1}=
D_\Theta
\left(
A_t^k,
k,
o_{1:t},
a_{1:t-1},
l
\right),
\quad
k=K,K-1,\dots,1.
$$

The result is an executable action trajectory:

$$
A_t^0 =
(a_t, a_{t+1}, \dots, a_{t+H-1}).
$$

In Flow Matching, the model learns a continuous vector field from the noisy trajectory to the real action trajectory. Let $\tau \in [0,1]$. Then:

$$
\frac{dA_t^\tau}{d\tau}=
v_\Theta
\left(
A_t^\tau,
\tau,
o_{1:t},
a_{1:t-1},
l
\right).
$$

At inference time, starting from a noisy trajectory, we integrate along the learned vector field to obtain the action trajectory:

$$
A_t^1=
A_t^0
+
\int_0^1
v_\Theta
\left(
A_t^\tau,
\tau,
o_{1:t},
a_{1:t-1},
l
\right)
d\tau.
$$

Therefore, Single-backbone / VLA-style can be uniformly understood as directly parameterizing the following conditional distribution:

$$
p_\Theta(A_t \mid o_{1:t}, a_{1:t-1}, l).
$$

Autoregressive discrete actions, Diffusion Policy, and Flow Matching are all different implementations of this conditional action distribution.
