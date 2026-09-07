# Media credits

`demo-480.mp4`, `demo-long.mp4`, `demo.jpg`

Two encodes of the same two-minute cut from **Big Buck Bunny**. The comparison
section plays the 480x270 one and offers the 640x360 through the quality menu:
its box is 159x89 CSS pixels on a phone, which is 477x267 real pixels on a DPR 3
screen, so anything larger is pixels no box can show.

- © copyright Blender Foundation | <https://peach.blender.org>
- Licensed under the Creative Commons Attribution 3.0 license
  (<https://creativecommons.org/licenses/by/3.0/>)
- Source: the 640x360 encode of the film, via
  <https://archive.org/details/BigBuckBunny_124>

The clip is bundled with this repository rather than hot-linked because the
network simulator used by the comparison section has to read the response body,
which is impossible for a cross-origin response served without CORS headers.

`demo.jpg` is a frame from the same cut, so the poster and the video are the
same film.

## How the two minutes were chosen

The comparison has two requirements, and they are the reason this is not simply
the opening of something.

Neither panel may go black. Two players side by side prove nothing while both
are showing nothing, and a trailer - the earlier source here was Sintel's - fades
out between shots often enough that 46% of it is black. The film was sampled for
mean luminance every five seconds across all 596 of them, and the brightest
120-second window that never drops was taken: 105s to 225s. Measured the same
way, the cut is 148 mean, 111 minimum, and no sample near black.

And it has to be too long to arrive early. At the Normal rate the section offers,
a player buffers about 1.4 seconds of video per second of wall clock, so a clip
that downloads in full before anyone reaches the Slow 2G control is one the
throttle can no longer starve - the demonstration would show nothing at all.

An earlier version met both by looping a 14-second excerpt to two minutes, which
was short enough to be noticed as a repeat while watching. This does not loop:
sampled every four seconds, nothing 40 seconds apart or more scores closer than
29 of 255, where the looped clip scored 3 for frames a full period apart.

The 480x270 encode is rate-targeted rather than quality-targeted, at 132 kbps, so
it sustains 24.7 kB/s. That number is not decoration: the section prints it, and
both throttle rates are ratios against it.

`demo-en.vtt`, `demo-tr.vtt` are written for this project and carry the same
license as the rest of the repository (MIT). They describe the player, not the
film, and are not a transcript of anything.
