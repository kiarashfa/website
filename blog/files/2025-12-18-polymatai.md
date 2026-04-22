One of the things that bothered me most during my PhD was how much useful research stays locked behind papers. You spend months developing a model, you publish it, someone reads the paper and thinks "hey, this could be useful for my work"... but then they'd have to reimplement everything from scratch just to use it. That's a huge barrier, and honestly, most people won't bother.

That's why we built [PolymatAI](https://polymatai.pythonanywhere.com/).

## What Is PolymatAI?

PolymatAI is a free, open-access web tool that lets anyone predict polymer and monomer properties using machine learning models we developed at [POLYMAT](https://www.polymat.eu/). No installation, no coding, no subscription, and no registration even. You just go to the website, type in a SMILES string, click predict, and get your result in seconds.

The idea is simple: if we've already trained these models and validated them against experimental data, why not make them available to everyone? A researcher in Tokyo, a student in Brazil, an engineer in Germany... they should all be able to use these predictions without needing to dig through our codebase or retrain anything.

## What Can It Predict?

Right now, PolymatAI offers four prediction models:

**⚖️ Reactivity Ratios (r₁, r₂)** — If you're working with copolymerization, you know how important these are. Reactivity ratios define how two monomers incorporate into the polymer chain relative to each other. Getting them experimentally is tedious (you need multiple copolymerization experiments and compositional analysis). Our model takes the SMILES strings of both monomers and gives you r₁ and r₂ directly.

**⚡ Propagation Rate Constant (Kp)** — This is a fundamental kinetic parameter for radical polymerization. Measuring it experimentally typically requires pulsed-laser polymerization coupled with size exclusion chromatography (PLP-SEC), which is not exactly something every lab has access to. Enter the monomer SMILES, and you get Kp in L/mol/s.

**🌡️ Glass Transition Temperature (Tg)** — Probably the most widely used thermal property in polymer science. It tells you when your material goes from glassy to rubbery, and it affects basically everything from processing to end-use performance. For this one, you input the polymer repeating unit SMILES (since Tg is a polymer property, not a monomer one).

**💧 Water Solubility (Ws)** — How soluble is your monomer in water? This matters a lot for emulsion polymerization, where mass transfer between phases is a key factor. Input the monomer SMILES and get the predicted solubility.

## How Does It Work?

Behind the scenes, each model takes your SMILES string and converts it into a set of molecular descriptors — numerical features that capture the chemical structure. These descriptors are then fed into trained neural networks (or in some cases, ensemble models like CatBoost combined with neural networks) that output the predicted property.

If you want to know the technical details, including the model architectures, training procedures, feature engineering, and validation results, they are all described in our paper (citation below).

## The Website

The interface is intentionally simple. The [main page](https://polymatai.pythonanywhere.com/) gives you an overview of all four models with links to each one. Each prediction page has a single input field (or two for reactivity ratios), a predict button, and the result displayed right there. There's also a [Guide page](https://polymatai.pythonanywhere.com/guide) that helps you with SMILES notation if you're not familiar with it.

I also recently integrated PolymatAI directly into my [personal website's Resources page](https://kiarashfa.github.io/pages/resources.html), so you can run predictions without even leaving the page. Just click on any of the four property icons, and a prediction panel opens up right there.

## Why Free and Open-Access?

Because that's the whole point. Research should be useful beyond the journal it's published in. If someone can benefit from predicting a Tg or a Kp value for their work, they shouldn't have to implement the model themselves. By making these tools freely available, we hope more people actually use the knowledge that came out of years of research.

## Citation

If you find PolymatAI useful in your research, we'd appreciate a citation. The models and methodology are described in:

> Farajzadehahary, K., Telleria-Allika, X., Asua, J. M., & Ballard, N. (2023). An artificial neural network to predict reactivity ratios in radical copolymerization. *Polymer Chemistry*, 14, 2779–2787. [https://doi.org/10.1039/D3PY00246B](https://doi.org/10.1039/D3PY00246B)

---

Give it a try at **[polymatai.pythonanywhere.com](https://polymatai.pythonanywhere.com/)** and let me know what you think. If you have suggestions for new properties to add or feedback on the models, I'd love to hear from you.
