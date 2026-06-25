---
title: 机器人学习中三类 World Model 范式的数学本质
authors: 曹嘉航， 郭瀚中， 郑啟豪， 宋纯锋， Andrew F. Luo
affiliation: 香港大学
publishedDate: 2026年6月19日， 端午节

---

# 机器人学习中三类 World Model 范式的数学本质

> **TL;DR**  
> 本文从概率建模与结构化优化视角， 分析机器人学习中三类常见 World Model 范式：IDM-style、Single-backbone 和 MoT-style。三者最终都在近似同一个条件策略：  
> 
> $$
> \pi(a_t \mid o_{1:t}, a_{1:t-1}, l),
> $$
> 
> 但区别在于：IDM-style 显式引入未来目标 $g_t$；Single-backbone 直接用统一模型参数化动作策略；MoT-style 则先学习共享表示 $Z_t$，再由专家模块建模动作、视觉和语言等模态输出。本文重点讨论这些结构背后的概率分解、优化冲突和 Hessian 视角下的参数耦合。
>
> **推荐阅读时间：约 15 分钟**

机器人学习的核心问题，可以直接写成一个条件策略学习问题：

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l),
$$

其中处于时间 $t$ 时：

- $o_{1:t}$ 表示从初始时刻到当前时刻的观测序列；
- $a_{1:t-1}$ 表示过去已经执行过的动作序列；
- $l$ 表示语言指令；
- $a_t$ 是当前需要输出的动作。

对于真实机器人系统，当前单帧观测 $o_t$ 往往不是完整状态。首先它可能看不到速度、接触力、遮挡物后的状态，此外 $o_t$ 也无法完整表达系统的动力学历史。因此，严谨地说，策略通常不应只写成 $\pi(a_t \mid o_t,l)$，而应写成：

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l).
$$

目前机器人学习中的 World Model 核心架构大致可以分为三类（图自World Model for Robot Learning: A Comprehensive Survey [1]）：


1. **Future-conditioned / IDM-style**：先预测未来目标，再用逆动力学模型反推动作；
2. **Single-backbone**：用一个统一模型直接从视觉语言上下文输出动作；
3. **Shared-attention + Specialized Experts / MoT-style**：共享认知表示，但在专家层面分离不同模态的参数更新。

![image](https://hackmd.io/_uploads/S1cW1yezfl.png)

这三类方法表面上差异很大，但本质上都在近似同一个对象：

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l).
$$

区别在于：是否显式引入未来目标，是否共享所有参数，以及如何处理视觉、语言和动作之间的优化冲突。



# 0. 基本建模：从观测历史到动作

机器人与环境的交互可以抽象为部分可观测系统。令：

- $x_t \in \mathcal{X}$：真实环境状态，例如物体位姿、速度、接触状态、机器人关节状态等；
- $o_t \in \mathcal{O}$：机器人可观测状态，例如 RGB、深度、点云、机器人自身状态（proprioception）；
- $a_t \in \mathcal{A}$：机器人动作空间，例如末端执行器位姿增量、关节速度或夹爪开合命令；
- $l \in \mathcal{L}$：语言指令。
- $A_t =(a_t, a_{t+1}, \dots, a_{t+H-1})$：长度为H的连续动作预测 (Action Chunk)；
- $O_{t+1} =(o_{t+1}, o_{t+2}, \dots, o_{t+L})$：长度为L的连续观测预测；
- $y^L_t$：语言预测，例如下一个语言 token、子任务描述、计划文本或其他语言监督信号；

真实动力学可以写为：

$$
x_{t+1} \sim p(x_{t+1} \mid x_t, a_t),
$$

观测模型为：

$$
o_t \sim p(o_t \mid x_t).
$$

由于 $x_t$ 通常不可直接观测，机器人只能基于历史观测和历史动作进行决策：

$$
a_t \sim \pi(a_t \mid o_{1:t}, a_{1:t-1}, l).
$$

World Model 的作用，就是在这种部分可观测条件下，为动作决策提供更好的世界表示、未来预测或结构化中间变量。


# 1. 范式一：Future-conditioned / IDM-style

## 1.1 核心思想与数学建模

Future-conditioned / IDM-style 的基本思想是：

> 先预测一个未来目标，再根据当前历史和目标反推出当前动作。

这里的未来目标不一定是像素级图像。我们定义一个一般的目标变量：

$$
g_t \in \mathcal{G}, \quad\mathcal{G} \text{表示目标变量的集合}.
$$

目标变量$g_t$可以表示：

- 下一帧观测 $o_{t+1}$ 或多步之后的未来观测 $o_{t+k}$， 例如 UniPi[2]， mimic-video[3]， VLP[4] and VERA[5]；
- 未来状态的表征（latent future representation），例如FLARE [6]， VLA-JEPA [7]；
- 达到最终目标的中间目标（object-centric subgoal），例如 $\pi_{0.7}$ [8]；
- 末端执行器目标位姿；由视觉和语言共同定义的短期目标；等等。

于是策略可以写成：

\begin{align}
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
&= \int_{\mathcal{G}}p(a_t, g_t \mid o_{1:t}, a_{1:t-1}, l)dg_t.\\
&=\int_{\mathcal{G}}p(a_t \mid o_{1:t}, a_{1:t-1}, g_t, l)
p(g_t \mid o_{1:t}, a_{1:t-1}, l)
\, dg_t.
\end{align}

用神经网络近似，于是得到：
$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
\approx
\int_{\mathcal{G}}
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, g_t, l)
q_\theta(g_t \mid o_{1:t}, a_{1:t-1}, l)
\, dg_t.
$$

其中：

- $q_\theta(g_t \mid o_{1:t}, a_{1:t-1}, l)$ 是 video model 或 goal generator；
- $\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, g_t, l)$ 是 inverse dynamics model 或 goal-conditioned controller。

这个分解可以理解为：

$$
\text{history + language}
\rightarrow
\text{future goal}
\rightarrow
\text{current action}.
$$

也就是说，$q_\theta$ 负责预测“应该朝哪里去”，$\kappa_\phi$ 负责把这个目标转化为当前动作。如果目标被定义与动作相关，那world model本质上就是一个动作规划器，则不需要额外的转化 $\kappa_\phi$。本章节后面默认 $g_{t}$ 被定义成一个与动作无强相关的目标。

> 若需要得到短时动作序列 Action Chunk $A_t =(a_t, a_{t+1}, \dots, a_{t+H-1}),$ 可以在执行每个动作后重新观测，并重复调用 future model 与 IDM controller。也可以一次性预测未来目标序列并 open-loop 解码动作序列，但这种写法依赖额外的 rollout 假设，且更容易产生误差累积。

---

## 1.2 与 action-conditioned dynamics 的区别

如果令 $g_t = o_{t+1}$，则有：

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
\approx
\int_{\mathcal{O}}
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, o_{t+1}, l)
q_\theta(o_{t+1} \mid o_{1:t}, a_{1:t-1}, l)
\, do_{t+1}.
$$

这里需要区分两个不同对象。

第一类是 future prediction：

$$
q_\theta(o_{t+1} \mid o_{1:t}, a_{1:t-1}, l).
$$

它预测的是：在当前历史和语言指令下，数据分布中的未来可能长什么样。

第二类是 action-conditioned dynamics：

$$
p_\theta(o_{t+1} \mid o_{1:t}, a_{1:t-1}, a_t, l).
$$

它预测的是：如果机器人当前执行动作 $a_t$，下一步观测会如何变化。

这两者不是一回事。前者更像 future prior，后者才更接近用于 planning 的动力学模型或者模仿器 (simulator) 。  
因此，IDM-style 中的 future model $q_\theta(g|\cdot)$ 可以帮助生成目标，但不应被直接等同于 action-conditioned world dynamics。

---

## 1.3 逆动力学模型的近似假设

完整的控制器应写为：

$$
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, g_t, l).
$$

但为了简化模型，很多实现会近似为：

$$
\kappa_\phi(a_t \mid o_t, g_t, l).
$$

这相当于引入近似条件独立假设：

$$
a_t \perp (o_{1:t-1}, a_{1:t-1})
\mid o_t, g_t, l.
$$

这个假设并不总成立。单帧观测 $o_t$ 可能无法表达速度、接触、摩擦、遮挡和系统惯性等信息。更严谨的表述应是：

$$
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, g_t, l)
\approx
\kappa_\phi(a_t \mid o_t, g_t, l).
$$

这是一种工程上的 bottleneck approximation，而不是严格定理。

---

## 1.4 训练目标

Future model 可以通过目标预测训练：


$$\mathcal{L}_{\text{goal}}(\theta)=
\mathbb{E}\left[-\log q_\theta(g_t^\star \mid o_{1:t}, a_{1:t-1}, l)\right].
$$


Inverse dynamics 或 controller 可以通过动作监督训练：

$$\mathcal{L}_{\text{IDM}}(\phi)=
\mathbb{E}
\left[
-\log \kappa_\phi(a_t^\star \mid o_{1:t}, a_{1:t-1}, g_t^\star, l)
\right].
$$

如果 $g_t^\star$ 是未来图像或未来 latent，future model 可以利用无动作视频或大规模视觉序列预训练。  
但这些视频中的未来不一定对机器人可执行，因此未来仍然需要探究视频模态与机器人动作模态的对齐等问题。

---

## 1.5 推理时的积分近似

理论上，动作策略需要对所有可能目标进行边缘化：

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
\approx
\int_{\mathcal{G}}
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, g_t, l)
q_\theta(g_t \mid o_{1:t}, a_{1:t-1}, l)
\, dg_t.
$$

这个式子的含义是：  
当前动作并不是只依赖某一个确定目标，而是应该综合所有可能目标 $g_t$ 下的动作分布，并按照这些目标的概率进行加权。

其中：

- $q_\theta(g_t \mid o_{1:t}, a_{1:t-1}, l)$ 表示目标分布；
- $\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, g_t, l)$ 表示在给定目标 $g_t$ 后的动作分布。

如果 $g_t$ 是离散目标，上式对应加权求和；如果 $g_t$ 是连续目标，就对应积分。

但在真实系统中，$g_t$ 往往是图像、轨迹、waypoint 或高维 latent，完整计算这个积分通常不可行。因此，实际推理中通常需要近似。


最常见的工程实现是让神经网络直接预测一个目标：

$$
\hat{g}_t=
f_\theta(o_{1:t}, a_{1:t-1}, l).
$$

然后控制器直接根据这个目标输出动作：

$$
a_t \sim
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, \hat{g}_t, l).
$$

这可以理解为把目标分布近似成一个 Dirac delta 分布：

$$
q_\theta(g_t \mid o_{1:t}, a_{1:t-1}, l)
\approx
\delta(g_t - \hat{g}_t).
$$

将其代入原始积分：

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
\approx
\int_{\mathcal{G}}
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, g_t, l)
\delta(g_t - \hat{g}_t)
\, dg_t.
$$

根据 Dirac delta 的性质：

$$
\int f(g_t)\delta(g_t-\hat{g}_t)dg_t=
f(\hat{g}_t),
$$

因此得到：

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
\approx
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, \hat{g}_t, l).
$$

所以，神经网络直接输出一个目标 $\hat{g}_t$，本质上就是把完整的目标分布 $q_\theta(g_t \mid o_{1:t}, a_{1:t-1}, l)$ 退化成一个点估计。

---
亦或是可以使用MAP近似或者Monte Carlo近似，具体放在附录。


实际系统常因推理速度限制，使用单个预测目标 $\hat{g}_t$ 或少量采样目标。这种做法高效，但也可能带来目标单一、mode collapse、目标不可达和误差级联等问题。

---

## 1.6 误差来源

省略条件变量后，理想策略为：

$$\pi(a)=
\int
\kappa(a \mid g)q(g)dg,
$$

学习到的策略为：

$$
\hat{\pi}(a)=
\int
\hat{\kappa}(a \mid g)\hat{q}(g)dg.
$$

一个直观误差分解是：

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

这说明最终策略误差来自两部分：

1. future / goal model 的误差；
2. inverse dynamics / controller 的误差。

如果目标预测本身不可达、模糊或带有视觉伪影，控制器会被直接带偏。

---

## 1.7 优缺点

**优点：**

1. 模块清晰，便于解释和诊断；
2. future model 可以利用无动作视频或大规模视觉序列预训练；
3. 适合层级控制、子目标规划和短期 waypoint 预测；
4. 失败原因相对容易拆解：是目标预测错了，还是控制器错了。

**缺点：**

1. future prediction 不等于 action-conditioned dynamics；
2. 目标变量 $g_t$ 的设计非常敏感；
3. 高维目标空间中的积分难以计算；
4. future model 与 controller 的误差会级联；
5. 视频里“看起来合理”的未来，不一定是机器人可执行的未来。


# 2. 范式二：Single-backbone

## 2.1 核心思想与数学建模

Single-backbone 的核心思想是：

> 不显式拆分 future model 和 controller，而是用一个统一模型直接学习从观测历史、动作历史和语言指令到动作的条件策略。

因此，它的基本建模对象是：

$$
\pi_\Theta(a_t \mid o_{1:t}, a_{1:t-1}, l).
$$

这里，模型不再显式引入未来目标变量 $g_t$，也不再把策略拆成“目标预测”和“逆动力学控制”两个阶段，而是直接用一个统一参数化模型 $p_\Theta$ 近似动作策略：

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
\approx
p_\Theta(a_t \mid o_{1:t}, a_{1:t-1}, l).
$$

如果模型一次预测的不是单步动作，而是一个短时动作轨迹 (Action Chunk)，则可以写成：



$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
\approx p_\Theta(A_t \mid o_{1:t}, a_{1:t-1}, l),
$$

$$
A_t =
(a_t, a_{t+1}, \dots, a_{t+H-1}).
$$

其中 $H$ 是预测 horizon。动作解码器可以采用不同参数化方式，例如离散自回归 token 或连续 flow-based 解码。由于这不改变高层概率建模，我们将这些实现细节放在附录中讨论。

从概率建模角度看，Single-backbone 的重点不是引入新的条件独立假设，而是直接学习：

$$
(o_{1:t}, a_{1:t-1}, l)
\longmapsto
a_t /A_t.
$$


也就是说，视觉理解、语言 grounding、历史动作建模和动作生成都被压到同一个统一模型中完成。
代表工作有 $\pi$ 的系列工作 $\pi_{0}$[9]， $\pi_{0.5}$[10]，Cosmos Policy[11]，DreamZero[12]等。

---

## 2.2 训练目标

更general的 single-backbone 的数学建模可以写做：

$$
\pi(O_{t+1}, A_{t}, y_t^L \mid o_{1:t}, a_{1:t-1}, l)
\approx p_\Theta(O_{t+1}, A_{t}, y_t^L \mid o_{1:t}, a_{1:t-1}, l).
$$

这个写法只适用于模型同时生成观测，语言，动作的情况。很多 VLA 模型并不预测未来图像或语言，而是直接学习条件策略：

$$
p_\Theta(A_{t} \mid o_{1:t}, a_{1:t-1}, l).
$$

如果模型额外加入视觉预测、语言建模或重建任务，则可以写成多任务目标：

$$
\mathcal{L}(\Theta)=
\lambda_V \mathcal{L}_V(\Theta)
+
\lambda_A \mathcal{L}_A(\Theta)
+
\lambda_L \mathcal{L}_L(\Theta).
$$

其中：

- $\mathcal{L}_V$ 是视觉预测或视觉重建损失；
- $\mathcal{L}_A$ 是动作预测损失；
- $\mathcal{L}_L$ 是语言建模或语言理解损失；
- $\lambda_V,\lambda_A,\lambda_L$ 是任务权重。

这些权重非常重要。视觉、语言和动作的 token 数、尺度、噪声水平和梯度统计完全不同，不能默认等价。

---

## 2.3 多目标优化中的梯度冲突

令：

$$
g_V = \nabla_\Theta \mathcal{L}_V,
$$

$$
g_A = \nabla_\Theta \mathcal{L}_A.
$$

如果

$$
\langle g_V, g_A\rangle < 0,
$$

说明视觉任务和动作任务在共享参数上发生冲突。  
沿着降低视觉损失的方向更新，可能会增加动作损失。

如果进一步有：

$$
\|g_V\| \gg \|g_A\|,
$$

并且没有进行 loss reweighting、gradient normalization 或 task balancing，那么动作学习可能被视觉任务主导。

对于讨论语言任务建模时此情形也同理。

这不是必然定理，而是一种常见风险。它可能取决于：

- 数据比例；
- loss 权重；
- tokenization；
- optimizer；
- action head 设计；
- 是否冻结视觉 encoder；
- 是否使用 adapter、LoRA 或 partial fine-tuning；
- 是否进行梯度裁剪或梯度归一化。
- ...

---

## 2.4 Hessian 视角

总损失的 Hessian 为：

$$
H=
\nabla_\Theta^2 \mathcal{L}=
\lambda_V H_V
+
\lambda_A H_A
+
\lambda_L H_L.
$$

如果不同任务在参数空间中的曲率尺度差异很大，总 Hessian 的条件数可能变差：

$$
\kappa(H)=
\frac{\lambda_{\max}(H)}
{\lambda_{\min}(H)}.
$$

这会导致优化路径变得不稳定。直观地说，视觉任务可能更关注高维细节，动作任务则更关注低维但精确的控制信号。二者在参数空间中的敏感方向不一定一致。

但不能简单地说“视觉维度更高，所以 Hessian 必然病态”。更准确的说法是：

> 多模态共享参数可能带来梯度冲突与曲率不匹配，需要通过结构设计或优化策略缓解。

---

## 2.5 优缺点

**优点：**

1. 端到端能力强，直接学习 $\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)$；
2. 能继承视觉语言基础模型的语义知识；
3. 适合大规模多任务 imitation learning；
4. 不需要显式设计中间目标变量；
5. 有较强的 scaling 潜力。

**缺点：**

1. 多模态任务之间可能发生梯度冲突；
2. 动作 tokenization 或 action head 设计非常敏感；
3. 低层控制对实时性、稳定性和精度要求高，不能只靠模型规模解决；
4. 模型失败时较难判断是视觉、语言、历史建模还是动作输出出了问题。


# 3. 范式三：Shared-attention + Specialized Experts / MoT-style

## 3.1 核心思想与概率建模

MoT-style 可以看作 single-backbone 的结构化版本：

> 共享一部分认知计算，但在模态专属专家中分离不同任务的参数更新。

代表工作有 BagelVLA[13]， Lingbot-VA[14]，FastWAM[15]，DiT4DiT[16]，Motus[17]，Cosmos3[18]等。

它既不把感知、语言和控制完全切开，也不让所有模态共享全部参数。它的核心做法是：先通过 shared attention 或 shared backbone 得到一个统一上下文表示，再由不同专家建模不同输出分布。

定义共享表示：

$$
Z_t =
f_\Phi(o_{1:t}, a_{1:t-1}, l),
$$

其中 $\Phi$ 是 shared attention / shared backbone 的参数，$Z_t$ 是由观测历史、动作历史和语言指令共同形成的上下文表示。

在这个表示之上，不同专家负责不同预测任务。

动作专家建模动作轨迹分布：

$$
p_{\Phi,\theta_A}(A_t \mid o_{1:t}, a_{1:t-1}, l)=
p_{\theta_A}(A_t \mid Z_t),
$$

其中

$$
A_t = (a_t, a_{t+1}, \dots, a_{t+H-1}).
$$

视觉专家可以建模未来观测分布：

$$
p_{\Phi,\theta_O}(O_{t+1} \mid o_{1:t}, a_{1:t-1}, l)=
p_{\theta_O}(O_{t+1} \mid Z_t).
$$

其中

$$
O_{t+1} =(o_{t+1}, o_{t+2}, \dots, a_{t+L}).
$$

语言专家可以建模语言相关输出，例如任务描述、子目标文本、reasoning token 或 high-level plan：

$$
p_{\Phi,\theta_L}(y_t^L \mid o_{1:t}, a_{1:t-1}, l)=
p_{\theta_L}(y_t^L \mid Z_t).
$$

其中 $y_t^L$ 表示语言侧输出，可以是下一个语言 token、子任务描述、计划文本或其他语言监督信号。

因此，MoT-style 的高层结构可以写成：

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

也就是说，$Z_t$ 不是显式未来目标变量，而是 shared attention 学到的多模态上下文表示。不同专家基于同一个 $Z_t$ 建模不同输出分布。

这里的动作、未来观测和语言仅作为代表性例子；同样的形式也可以扩展到其他模态输出（例如语音，深度，分割，光流等）。

---

## 3.2 联合分布的近似分解

如果模型同时预测未来观测、动作轨迹和语言输出，那么可以从联合条件分布开始：

$$
p(O_{t+1}, A_t, y_t^L \mid o_{1:t}, a_{1:t-1}, l).
$$

MoT-style 引入共享表示：

$$
Z_t = f_\Phi(o_{1:t}, a_{1:t-1}, l),
$$

并用不同专家进行近似分解：

$$
p_{\Phi,\theta_O,\theta_A,\theta_L}
(O_{t+1}, A_t, y_t^L \mid o_{1:t}, a_{1:t-1}, l)
\approx
p_{\theta_O}(O_{t+1} \mid Z_t)
p_{\theta_A}(A_t \mid Z_t)
p_{\theta_L}(y_t^L \mid Z_t).
$$

这个分解隐含了一个条件独立近似：

$$
O_{t+1} \perp A_t \perp y_t^L
\mid Z_t.
$$

更准确地说，它表达的是：给定共享表示 $Z_t$ 后，视觉、动作和语言输出分别由各自专家建模。

这个近似是否合理，取决于 $Z_t$ 是否足够保留任务相关信息。如果 $Z_t$ 丢失了接触状态、物体几何、任务阶段、语言意图或隐藏动力学信息，那么专家分得再清楚也无法弥补表示缺失。

因此，这里的分解应理解为结构化建模近似，而不是严格等式。

---

## 3.3 Shared attention 的作用

Shared attention 的作用是提供跨模态信息交换通道。

观测历史可以提供场景几何、物体关系和任务进展；历史动作可以帮助判断当前阶段和动力学状态；语言指令提供任务目标和语义约束。Shared attention 将这些信息混合成统一表示：

$$
Z_t =
f_\Phi(o_{1:t}, a_{1:t-1}, l).
$$

但是，shared attention 本身不等于最大化互信息。除非显式加入 InfoNCE、variational mutual information bound 或 information bottleneck objective，否则不能写成：

$$
\max I(Z_t; o_{1:t}, a_{1:t-1}, l).
$$

更准确的说法是：

> Shared attention 让模型具备融合跨模态信息的能力；但哪些信息真正被保留下来，取决于训练目标、数据分布、模型容量和表示瓶颈。

因此，MoT-style 的关键不是“attention 自动得到最优表示”，而是：通过共享表示保留跨模态交互能力，同时通过专家参数分离降低不同任务之间的直接优化冲突。

---

## 3.4 多任务训练目标

如果模型同时包含视觉预测、动作预测和语言预测，训练目标可以写为：

$$
\mathcal{L}(\Phi,\theta_O,\theta_A,\theta_L)=
\lambda_O \mathcal{L}_O(\Phi,\theta_O)
+
\lambda_A \mathcal{L}_A(\Phi,\theta_A)
+
\lambda_L \mathcal{L}_L(\Phi,\theta_L).
$$

其中：

- $\mathcal{L}_O$ 是视觉预测或视觉重建损失；
- $\mathcal{L}_A$ 是动作轨迹预测损失；
- $\mathcal{L}_L$ 是语言建模、计划生成或任务描述损失；
- $\lambda_O,\lambda_A,\lambda_L$ 是不同任务的权重；
- $\Phi$ 是共享表示参数；
- $\theta_O,\theta_A,\theta_L$ 分别是视觉、动作和语言专家参数。

这个目标体现了 MoT-style 的核心结构：共享参数 $\Phi$ 接收所有任务的梯度，而专家参数只主要服务于对应任务。

---

## 3.5 Hessian 的部分块结构

MoT-style 真正有意义的数学性质在于参数分块。

因为视觉专家参数 $\theta_O$ 只出现在视觉损失中，动作专家参数 $\theta_A$ 只出现在动作损失中，语言专家参数 $\theta_L$ 只出现在语言损失中，所以专家之间的直接二阶耦合为零：

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

这说明视觉专家、动作专家和语言专家之间没有直接的二阶参数耦合。

但完整 Hessian 是关于所有参数

$$
(\Phi,\theta_O,\theta_A,\theta_L)
$$

的。其结构为：

$$
H =
\begin{bmatrix}
H_{\Phi\Phi} & H_{\Phi O} & H_{\Phi A} & H_{\Phi L} \\
H_{O\Phi} & H_{OO} & 0 & 0 \\
H_{A\Phi} & 0 & H_{AA} & 0 \\
H_{L\Phi} & 0 & 0 & H_{LL}
\end{bmatrix}.
$$

由于 $\Phi$ 是共享参数，视觉损失、动作损失和语言损失都会更新它。因此整体 Hessian 不是严格 block-diagonal。

准确地说：

> MoT-style 在专家参数层面减少直接梯度与二阶耦合，但共享表示层仍然是耦合的。

因此，它不是彻底消灭模态冲突，而是把冲突主要限制在共享表示层，同时降低专家参数之间的直接干扰。

---

## 3.6 优缺点

**优点：**

1. 保留跨模态信息融合能力；
2. 可以同时支持动作预测、视觉预测和语言预测；
3. 减少视觉、动作、语言专家之间的直接参数冲突；
4. 比完全共享的 single-backbone 更适合多模态、多任务扩展；
5. 可以为视觉、动作、语言、触觉、深度等模态分配不同容量；
6. 在结构上兼顾了统一表示与模态专门化。

**缺点：**

1. 共享 attention 或 shared backbone 仍然可能发生模态冲突；
2. 专家结构会带来显存、路由和部署复杂度；
3. 高频闭环控制中，shared attention 加 expert routing 可能造成推理延迟；
4. 需要仔细设计 loss balancing、routing 和 expert capacity；
5. 专家分离不能弥补共享表示 $Z_t$ 的信息缺失；
6. 如果共享表示被视觉或语言任务主导，动作专家仍可能收到不适合控制的表示。

# 4. 三种范式的统一视角

三种范式最终都在近似：

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l).
$$

它们的区别在于：是否引入中间目标变量，以及参数共享方式如何设计。

---

## 4.1 IDM-style：显式目标变量

IDM-style 的结构是：

$$
(o_{1:t}, a_{1:t-1}, l)
\rightarrow
g_t
\rightarrow
a_t.
$$

数学形式为：

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
\approx
\int
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, g_t, l)
q_\theta(g_t \mid o_{1:t}, a_{1:t-1}, l)
dg_t.
$$

若需要得到 $A_t$ 则不断重复上述过程。
它的关键问题是：

> $g_t$ 是否既容易预测，又足够支持控制？

如果 $g_t$ 太高维，积分和控制都难；  
如果 $g_t$ 太低维，又可能丢失语义和接触细节。

---

## 4.2 Single-backbone：隐式策略学习

Single-backbone 的结构是：

$$
(o_{1:t}, a_{1:t-1}, l)
\rightarrow
A_t, \underbrace{O_{t+1}, y_t^L}_{\text{optional}} 
$$

数学形式为：

$$
\pi(O_{t+1}, A_{t}, y_t^L \mid o_{1:t}, a_{1:t-1}, l)
\approx p_\Theta(O_{t+1}, A_{t}, y_t^L \mid o_{1:t}, a_{1:t-1}, l).
$$

它的关键问题是：

> 一个共享参数空间是否能同时服务视觉理解、语言 grounding、历史建模和精细控制？

如果数据、模型和优化都足够好，它有很强的 scaling 潜力。  
但如果梯度冲突或 loss 尺度失衡，动作能力可能被弱化。

---

## 4.3 MoT-style：共享表示，专家分工

MoT-style 的结构是：

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

数学形式为：

$$
p_{\Phi,\theta_O,\theta_A,\theta_L}
(O_{t+1}, A_t, y_t^L \mid o_{1:t}, a_{1:t-1}, l)
\approx
p_{\theta_O}(O_{t+1} \mid Z_t)
p_{\theta_A}(A_t \mid Z_t)
p_{\theta_L}(y_t^L \mid Z_t).
$$

它的关键问题是：

> 哪些信息应该共享，哪些参数应该专用？

MoT-style 的优势在于，它不走“完全共享”或“完全切分”的极端，而是在共享认知和模态专属更新之间做折中。


# 5. 对比总结

| 范式 | 数学形式 | 核心优势 | 核心风险 |
|---|---|---|---|
| Future-conditioned / IDM-style | $\pi(a_t\mid o_{1:t},a_{1:t-1},l)\approx\int \kappa_\phi(a_t\mid o_{1:t},a_{1:t-1},g_t,l)q_\theta(g_t\mid o_{1:t},a_{1:t-1},l)dg_t$, 再递归得到$A_t.$| 模块清晰；可利用无动作视频；解释性强 | future 不等于 dynamics；目标不可达；误差级联 |
| Single-backbone / VLA-style | $\pi(O_{t+1}, A_{t}, y_t^L \mid o_{1:t}, a_{1:t-1}, l)\approx p_\Theta(O_{t+1}, A_{t}, y_t^L \mid o_{1:t}, a_{1:t-1}, l).$ | 端到端；scaling 潜力大；语义迁移强 | 梯度冲突；动作表示敏感；闭环控制压力大 |
| MoT-style | $Z_t=f_\Phi(o_{1:t},a_{1:t-1},l)$，$p_{\Phi,\theta_O,\theta_A,\theta_L}(O_{t+1}, A_t, y_t^L \mid o_{1:t}, a_{1:t-1}, l)\approx p_{\theta_O}(O_{t+1} \mid Z_t)p_{\theta_A}(A_t \mid Z_t)p_{\theta_L}(y_t^L \mid Z_t).$ | 共享认知同时减少专家冲突；适合多模态扩展 | 共享层仍耦合；工程复杂；推理延迟可能更高 |


# 6. 结语

机器人学习中的 World Model 架构，不应简单理解为“谁更先进”。更准确地说，它们代表了三种不同的结构选择：

- **IDM-style** 显式引入目标变量；
- **Single-backbone** 直接学习条件策略；
- **MoT-style** 在共享表示和专家分工之间折中。

从数学上看，三者都在近似同一个对象：

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l).
$$

真正的难点不只是“预测未来”，而是预测出的未来是否可执行；不只是“统一模态”，而是共享参数是否会破坏控制学习；不只是“引入专家”，而是专家分工是否真的降低了优化冲突。

因此，更合理的判断是：

> 未来的机器人 World Model 不太可能只有一种标准答案。更可能的方向，是在共享认知、结构化分工、可执行预测和闭环控制之间找到更好的折中。




# 7. Reference

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

## IDM Style 模型推理时的积分近似

除了使用神经网络直接估计 $g_t$ 外，还可以采用MAP或者Monte Carlo 近似：

### MAP 近似

如果 $q_\theta$ 显式表示一个目标分布，可以选择概率最大的目标：

$$
\hat{g}_t =
\arg\max_g
q_\theta(g \mid o_{1:t}, a_{1:t-1}, l).
$$

然后执行：

$$
a_t \sim
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, \hat{g}_t, l).
$$

这就是 MAP 近似。它计算简单，但会丢失目标分布中的多样性和不确定性。

---

### Monte Carlo 近似

如果 $q_\theta$ 是可采样分布，例如 diffusion model、autoregressive model 或 Gaussian latent model，可以从中采样多个目标：

$$
g_t^{(i)}
\sim
q_\theta(g_t \mid o_{1:t}, a_{1:t-1}, l),
\quad i=1,\dots,N.
$$

然后用采样平均近似积分：

$$
\pi(a_t \mid o_{1:t}, a_{1:t-1}, l)
\approx
\frac{1}{N}
\sum_{i=1}^{N}
\kappa_\phi(a_t \mid o_{1:t}, a_{1:t-1}, g_t^{(i)}, l).
$$

当 $N$ 较大时，这更接近理论上的边缘化；当 $N=1$ 时，它退化为单样本近似。

---

## 动作输出参数化形式

动作输出分布可以有不同参数化方式。

如果动作被离散化为 token，可以使用自回归建模：

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

其中 $a_{t,1:K}$ 表示当前动作 $a_t$ 的离散 token 序列。

如果动作保持连续，更常见的是直接建模短时动作轨迹分布：

$$
p_\Theta(A_t \mid o_{1:t}, a_{1:t-1}, l).
$$

例如，在 Diffusion Policy 中，模型从噪声动作轨迹开始：

$$
A_t^K \sim \mathcal{N}(0,I),
$$

并逐步去噪：

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

最终得到可执行的动作轨迹：

$$
A_t^0 =
(a_t, a_{t+1}, \dots, a_{t+H-1}).
$$

在 Flow Matching 中，模型学习从噪声轨迹到真实动作轨迹的连续向量场。令 $\tau \in [0,1]$，则：

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

推理时，从噪声轨迹出发，沿着学习到的向量场积分得到动作轨迹：

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

因此，Single-backbone / VLA-style 可以统一理解为对下面这个条件分布的直接参数化：

$$
p_\Theta(A_t \mid o_{1:t}, a_{1:t-1}, l).
$$

离散动作自回归、Diffusion Policy 和 Flow Matching，本质上只是这个条件动作分布的不同实现方式。
