You know that 3D background on this website? The one that reacts when you move your mouse, and changes completely when you toggle between dark and light mode? That wasn't just a "let's make it look cool" decision. There's actually a story behind it, and it connects directly to what I do every day.

Let me explain.

## The Concept: Day in the Lab, Night at the Terminal

My work lives in two worlds. During the day, I'm a polymer chemist. I work with monomers, radicals, chain-growth reactions, and molecular structures. At night (well, also during the day, but you get the metaphor), I switch to machine learning... training neural networks, optimizing reward functions, watching loss curves converge.

When I was designing this website, I wanted the background to reflect that duality. Not with a static image or a gradient, but with something alive. Something that captures the *feel* of each world. Both backgrounds share the same camera system. You start far away, and as you scroll down the page, you dive deeper into the world, whether that's into the heart of a neural network or into the core of a molecular cloud. It creates this feeling of exploration, like you're zooming into something infinitely complex.

## The Dark Side: A Neural Network in Deep Space

The dark mode background is built around 500 nodes arranged in a spherical distribution sit in deep space, connected by edges when they're close enough. Each node pulses with energy, and signals travel along the connections like neurons firing.

When you move your mouse, nearby nodes get attracted toward it, creating a swirling disturbance. Click, and you trigger a cascade: one node fires, which triggers its neighbors, which trigger theirs, spreading outward like a thought propagating through a brain.

## The Light Side: A Living Polymer Reactor

A molecular simulation of free-radical polymerization... The molecules are rendered as actual 3D ball-and-stick models that look like what you'd see in a physical model kit, but floating in a digital solvent. The monomers aren't static. They drift, tumble, and bounce around the scene with Brownian motion, like real molecules in a flask.

If you watch long enough, you'll see the chemistry play out. A monomer gets activated with a golden spark, starting a new radical chain. Nearby free monomers then get pulled in, fly toward the growing chain end, and dock onto it, extending the backbone one unit at a time. Eventually, two radical chains meet and terminate, or an old chain breaks apart and releases its monomers back into the pool.

## The Infinity Illusion

Neither background has that many objects in the foreground. The dark mode has only 500 nodes, and the light mode has a couple of hundred molecules and monomers. Without some trickery, both would feel like small clusters floating in empty space.

The solution in both cases is the same idea: fill the deep background with thousands of faint particles that suggest more of the same structure fading into the distance. In dark mode, over 5,000 "cosmic dust" particles sit at varying depths and opacities, combined with volumetric nebula shells that glow with soft color. The 500 nodes feel like the brightest stars in a galaxy that extends forever. In light mode, the same role is played by a "ghost molecule field": thousands of tiny dots in molecular colors plus 2,000 short line segments that suggest bond structure dissolving into the haze. A soft white fog that gets denser with distance ties it all together.

The trick works differently on each background. On black, additive blending makes faint dots glow naturally, like distant stars. On a warm off-white background, that approach would just make things disappear, so the light mode uses normal blending with carefully tuned opacity and fog color shifted toward white. In both cases, the foreground objects feel like the sharp, nearby part of something much larger stretching in every direction.

## Under the Hood

Both backgrounds are built with Three.js and use the same architectural patterns: a scroll-driven camera path (CatmullRom spline), smoothed scroll interpolation, mouse interaction via raycasting, and a consistent animation loop. The dark mode uses additive blending and GLSL point sprites for that neon-on-black glow. The light mode uses normal blending, MeshStandardMaterial with real lighting, and InstancedMesh for performance (rendering hundreds of spheres and cylinders every frame).

When you toggle the theme, the current Three.js scene is fully disposed (every geometry, material, and texture cleaned up), and the other one initializes from scratch. CSS custom properties handle all the UI color transitions with a smooth 0.5-second ease.

## Why Bother?

Honestly? Because I think personal websites should feel personal. Anyone can slap a template together. But if your website is supposed to represent who you are and what you do, the details matter. The background isn't just decoration, it's a statement. It says: this person works at the intersection of chemistry and machine learning, and they care enough about both to build a living simulation of each.

Plus, it's just fun. Try clicking on a monomer in light mode and watch the chain grow. Or hover your mouse over the neural network in dark mode and watch the nodes swirl. These little moments of interaction make a website feel alive, and that's worth the effort.
