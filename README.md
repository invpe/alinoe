# ALINOE

**Because my smart home shouldn't just sit there idling.**

Turning the ESP32 devices already scattered around my home into a tiny distributed supercomputer — because it's fun, and because they're already there.

## What is it?
I've spent years building systems that connect unrelated devices and make them work together.

There was [GridShell](https://github.com/invpe/GridShell), Tesselator, GridMan, GPIOT, and a bunch of other experiments.

At different points I used iPhones, servers, laptops, gaming consoles and GPUs. Sometimes computation happened through shaders, sometimes OpenCL, sometimes ordinary CPU pipelines. The goal was usually the same: combine heterogeneous hardware and make it compute something together. Those systems ended up doing distributed rendering, cryptographic experiments, data analysis, quantitative calculations, automatons, distributed sensing and plenty of things that probably didn't need a distributed system at all. They worked.

But I also had a tendency to keep building the system instead of building things **with** it.

ALINOE is my attempt to change that.

Instead of asking:
> *How do I build a distributed computing platform?*

I'm asking:
> *What can I actually do with one?*

## The computers hiding in my walls

My home has around **60 ESP32-powered devices**.

Light bulbs.
Light switches.
Temperature sensors.
Water-level sensors.
Air-quality sensors.
Garage-door controllers.
And various custom-built things.

Most of the time they're doing almost nothing.
A temperature sensor might wake up occasionally to take a measurement. A light switch waits for somebody to press it. A bulb waits for somebody to ask it to turn on.
Meanwhile each of them contains a small microcontroller with Wi-Fi, cryptography, memory and processing capability.

So I decided to give them another job.
They still remain lights, switches and sensors.
But when they're idle, they can compute.
Together.

## How does it work?

The basic idea is deliberately simple.
A server accepts ESP32 nodes and distributes small pieces of computational work between them.
Each device keeps doing its original smart-home job, but gains an additional execution layer capable of receiving and running my workloads.
That means I don't need to reflash every device whenever I want to try something new.
The firmware provides the compute environment.
The projects provide the work.

So instead of building another complicated distributed platform with storage layers, volunteer-computing abstractions and endless infrastructure, ALINOE stays focused on one thing:
**using the tiny computers I already own to build interesting things.**

The smart home becomes the cluster.

## Projects

ALINOE itself is intentionally boring infrastructure.
The interesting part is what runs on it.

Each project is an experiment designed around the strange constraints of dozens of tiny, slow and physically distributed computers.
Some may be useful.
Some may be pointless.
Some may simply make a good visualization.
And that's fine.

The goal is to explore what happens when the devices already sitting around my house are treated not only as appliances, but as one distributed computational organism.

## Enough talking
See what ALINOE is doing right now at:

**[alinoe.cc](https://alinoe.cc/)**

The website focuses on the projects, their progress and their results.
The heavier technical details live here on GitHub - if i find time.
