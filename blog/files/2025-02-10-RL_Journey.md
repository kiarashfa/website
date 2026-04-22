Hey there! I want to share something I'm really excited about. A while back, I knew very little about reinforcement learning. It wasn't nada nada, but I didn't know fundamentals like even what a Q-table was. Fast forward to today, and I'm using RL to control actual chemical reactors in real-time, optimizing polymer production, and publishing research papers about it.

But here's the thing... I didn't start with chemical reactors. I started with a simple frozen lake.

## How I Actually Learned RL (And Why I'm Sharing This)
This isn't some polished course created by a professor. These are literally the notebooks I wrote while teaching myself reinforcement learning. I've just cleaned them up and added better explanations so you can learn the same way I did. Every mistake I made, every "aha!" moment, every time something clicked... It's all in here.

I'm sharing this because when I was starting out, I couldn't find a path that took me from "what even is this" to "okay, I can actually build something real." Most tutorials were either too theoretical or jumped straight to a point where they assume you already know everything. So I made the path I wish I had. The purpose is to learn in a fun way, mostly by games...

## The Journey: Starting Simple, Getting Serious
The beauty of this approach is that each notebook builds on the last one. You're not just learning disconnected concepts... you're seeing why each new technique exists and when the old one stops working.

- **Notebook 1: FrozenLake** is where it all begins. You've got a simple grid, you want to reach a goal, and some squares are slippery. That's it. But in solving this tiny problem, you learn the absolute fundamentals of reinforcement learning. What is the RL trinity (state, action, and reward)? How do we learn which actions are good? This is your foundation, and honestly, everything else builds on these basic ideas.

- **Notebook 2: GridWorld** takes those same ideas and scales them up a bit. Now you've got a bigger grid and more complexity. This is where you start to see the power of Q-learning, but also its limitations. It connects directly to FrozenLake (same algorithm, bigger problem). You're building confidence.

- **Notebook 3: Maze** pushes even further. 400 states now. Your Q-table is getting pretty big. But it still works! This is important because it shows you exactly where tabular methods shine. It also sets you up for the big revelation coming next.

- **Notebook 4: CartPole with Tabular Q-Learning** is where things break. And this is intentional! You try to use the same tabular approach on a problem with continuous states (like a pole balancing on a cart), and it just... doesn't work. You'll get maybe 20% of the total points. This failure is crucial because it forces you to understand why you need neural networks. Without seeing this failure, you'd never really appreciate what comes next.

- **Notebook 5: CartPole with DQN** is the breakthrough. Same exact problem, but now we use a neural network instead of a table. Suddenly, you're getting a full point. Problem solved! This is where things get real. You're now using deep learning in RL, and the world of possibilities just opened up massively.

- **Notebook 6: Snake Game** Applies things we learned to something way more fun (and complex). Remember the classic game we had on our old phones? Yes, that Snake! We are going to teach an AI to beat that game. This one really shows you how to apply what you've learned to actual interesting problems. Plus, watching your agent learn to play Snake is genuinely satisfying.

- **Notebook 7: Pong with REINFORCE** introduces a completely different paradigm. Instead of learning which actions are valuable (value-based methods like DQN), you learn a policy directly. This is policy gradient learning, and it's the foundation of modern RL algorithms. You implement self-play, watch your agent learn to play Pong against itself, and understand why sometimes learning the policy directly is better than learning values.

- **Notebook 8: Lunar Lander with SAC** is the grand finale. This is state-of-the-art continuous control. You're using Soft Actor-Critic, one of the best algorithms for robotics and real-world control problems. This is the one that I am actually using in my project for reactor control.  You learn continuous actions (not just up/down/left/right, but any value between -1 and 1), automatic exploration tuning, and all the tricks that make modern RL work in practice.

## What Happened Next (And Why This Matters)
After working through all these notebooks, I had an idea (and a job to do). What if instead of teaching an AI to play games, I taught it to control chemical reactions?

Turns out, a chemical reactor is kind of like a game environment. It has states (temperature, concentrations, conversions), actions (feed rates, temperature setpoints), and rewards (how close are we to the desired product). So I took everything I learned and applied it to emulsion polymerization reactors.

The results? I now have RL agents that can autonomously control polymerization reactors to achieve specific molar mass distributions and particle morphologies. They can react to disturbances in real-time. They make decisions in milliseconds that would take a conventional first-principles model hours to compute.

I've published research papers on this:
- Reinforcement learning for the optimization and online control of emulsion polymerization reactors: Particle morphology. (you can find it [here](https://doi.org/10.1016/j.compchemeng.2024.108739)).
- Towards online control of molar mass distributions of non-linear polymers in emulsion polymerization using reinforcement learning (you can find it [here](https://doi.org/10.1016/j.compchemeng.2026.109604))

The mission is not finished. We're now working on making the training better, faster, and easier using offline RL and decision transformers.

But here's the key point: **I couldn't have done any of this without starting with FrozenLake**. You can't jump straight to controlling chemical reactors. You need to build up the intuition step by step, see what works and what doesn't, and understand the fundamentals deeply.

## How to Use These Notebooks
I've made these notebooks super easy to run. You've got two options:

**Option 1: Google Colab (Easiest – No Setup Required)**

If you just want to dive in immediately without installing anything, Google Colab is your best friend. Just download the notebooks, go to [colab.research.google.com](https://colab.research.google.com), and upload any notebook. Click "Runtime" → "Run all" and you're off to the races. Colab gives you free access to GPUs too, which is nice for the later notebooks.

**Option 2: Local Environment (Full Control)**

If you want to run everything on your own computer, here's what you need:
First, make sure you have Python 3.8 or newer. Then create a virtual environment and install the required packages:

```bash
# Create a virtual environment
python -m venv rl_env

# Activate it
# On Windows:
rl_env\Scripts\activate
# On Mac/Linux:
source rl_env/bin/activate

# Install packages
pip install torch numpy matplotlib gymnasium pygame
```

Then just fire up Jupyter:
```bash
pip install jupyter
jupyter notebook
```

Navigate to the notebook you want to run and go for it. Everything should work right out of the box.

## Resources That Helped Me Along the Way
I didn't learn in a vacuum. While working through these notebooks, I also studied [David Silver's legendary RL lectures](https://davidstarsilver.wordpress.com/teaching/). David Silver is one of the key people behind DeepMind's AlphaGo, and his lectures are incredibly clear. They give you the theoretical foundation, while these notebooks give you the hands-on practice. I found that combination really powerful... watch a lecture, then implement the concepts in code.

Recently, I also came across [this fantastic YouTube video](https://youtu.be/VnpRp7ZglfA) that explains RL comprehensively but in a really simple way. If you're the type who likes video explanations before diving into code, definitely check it out. It covers a lot of ground without getting lost in the field jargon.

The way I'd recommend using these resources together: start with the YouTube video to get the big picture, use these notebooks to learn by doing, and refer to David Silver's lectures when you want deeper theoretical understanding. They complement each other perfectly.

## Who Is This For (and What Makes This Different)
Honestly? Anyone curious about RL. I wrote this assuming you know basic Python and maybe a tiny bit about machine learning (like what a neural network is), but that's it. If you can write a for loop and understand what multiplication is, you can do this.

I've seen these notebooks help computer science students preparing for research positions, engineers wanting to add RL to their toolkit, and even folks from completely different fields who were just curious. The progressive structure means you're never overwhelmed... You always have solid ground under your feet before taking the next step.

Most RL courses either stay theoretical or dump you into complex libraries without explaining what's happening under the hood. These notebooks take a different approach. You build everything from scratch, but in digestible steps. Also, I don't hide the failures. Notebook 4 is literally designed to fail, because understanding why something doesn't work is just as important as seeing it work. In real research and real applications, things fail all the time. Learning to debug and iterate is part of the process.


## Download and Start Learning
Ready to begin? I've packaged all the notebooks together for you. Inside you'll find the complete progression from Notebook 1 (FrozenLake) through Notebook 6 (Snake), plus both bonus notebooks (Pong and Lunar Lander). Don't skip ahead – trust me, each one builds crucial intuition for the next.

**[Download the Complete RL Course Notebooks (RAR)](https://kiarashfa.github.io/assets/resources/Materials_RL.rar)**

And hey, if you end up using RL for something cool (whether it's games, robotics, optimization, or controlling chemical reactors), I'd love to hear about it. That's the best part of sharing knowledge... seeing where people take it next.

Happy learning, and welcome to the fascinating world of reinforcement learning! ✌
