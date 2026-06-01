# LichtFeld Studio - Gaussian Splatting Research Note

Project: Immersphere Pro SaaS
Status: Research / I+D candidate
Priority: Medium-High
Decision: Save for future pilot. Do not integrate in production yet.

## Links

Showcase:
https://lichtfeld.io/showcase/

Repository:
https://github.com/MrNeRF/LichtFeld-Studio

Docs:
https://lichtfeld.io/docs

Plugins:
https://lichtfeld.io/plugins

## What it is

LichtFeld Studio is a native workstation for 3D Gaussian Splatting workflows. It can be useful for training, inspecting, editing, exporting and automating 3D splat scenes.

Potential outputs and formats mentioned in the project ecosystem include PLY, SOG, SPZ and standalone HTML viewers.

## Why it matters for Immersphere Pro

This can become part of the future 3D capture pipeline for:

- real estate walkthroughs
- premium property showcases
- showrooms
- architecture spaces
- hotels and hospitality
- cultural spaces
- interactive web demos
- sales assets connected to CRM leads

Possible future workflow:

Capture space -> Gaussian Splat -> edit scene -> export viewer -> embed in landing -> connect CTA -> track lead in CRM.

## Strategic value

High value as a future visual differentiator.

It may help Immersphere Pro move beyond classic 360 tours and offer more advanced spatial experiences.

## Current risks

- Requires technical validation.
- May need NVIDIA GPU / CUDA workflow.
- Performance on mobile must be tested.
- Hosting weight and loading time must be measured.
- Licensing must be reviewed before commercial integration.
- Do not copy GPL code into the SaaS without legal review.
- Do not make it a production dependency yet.

## Recommended next test

Create one internal demo using a sample scene or exported viewer.

Validation checklist:

- Can the viewer be embedded in Immersphere Pro?
- Does it work on mobile?
- Does it load fast enough?
- Can it be connected to a CTA?
- Can it be used in a real estate landing?
- Can the output be reused inside the CRM commercial flow?

## Decision

Keep as:

Immersphere Pro Lab / 3D Capture Pipeline / Research Candidate

Not part of the core production roadmap yet.