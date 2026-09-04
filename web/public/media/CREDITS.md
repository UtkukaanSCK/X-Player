# Media credits

`demo-480p.mp4`, `demo-360p.mp4`, `demo-240p.mp4`, `demo.jpg`

A 14-second excerpt from the **Sintel** trailer, re-encoded at three sizes so
the quality menu has real files to switch between. The source is 854x480, so the
ladder stops at 480p.

- © copyright Blender Foundation | <https://durian.blender.org>
- Licensed under the Creative Commons Attribution 3.0 license
  (<https://creativecommons.org/licenses/by/3.0/>)
- Source file: <https://media.w3.org/2010/05/sintel/trailer.mp4>

The clip is bundled with this repository rather than hot-linked because the
network simulator used by the comparison section has to read the response body,
which is impossible for a cross-origin response served without CORS headers.

`demo-en.vtt`, `demo-tr.vtt` are written for this project and carry the same
license as the rest of the repository (MIT). They describe the player, not the
film, and are not a transcript of the trailer.

`demo-long.mp4` is the first three seconds of the same excerpt, looped to two
minutes. The loop is deliberate: the source fades to black for seconds at a
time, and a comparison of two players is worthless when both panels are showing
black. Two minutes is long enough that neither player can buffer the whole thing
before the connection is taken away.
