# Media credits

`demo-480.mp4`, `demo-long.mp4`, `demo.jpg`

Two encodes of the same clip, cut from the **Sintel** trailer. The comparison
section plays the 480x270 one and offers the 854x480 through the quality menu:
its box is 159x89 CSS pixels on a phone, which is 477x267 real pixels on a DPR 3
screen, so the larger encode was three times the pixels either box could show.

- © copyright Blender Foundation | <https://durian.blender.org>
- Licensed under the Creative Commons Attribution 3.0 license
  (<https://creativecommons.org/licenses/by/3.0/>)
- Source file: <https://download.blender.org/durian/trailer/sintel_trailer-720p.mp4>

The clip is bundled with this repository rather than hot-linked because the
network simulator used by the comparison section has to read the response body,
which is impossible for a cross-origin response served without CORS headers.

## Why it is a montage, and why it loops

The trailer is 52 seconds and 46% of it is black: it fades out between shots and
ends on eight seconds of title card. A comparison of two players is worthless
when both panels are showing black, so the clip is built from the two stretches
that stay lit - 3s to 9s and 23s to 43s - joined into a 27-second unit and
repeated to 110 seconds. Measured the same way, the result is 7% black.

The length is not arbitrary either. At the Normal rate the section offers, a
player buffers about 1.4 seconds of video per second of wall clock, so a clip
short enough to arrive in full before anyone reaches the Slow 2G control is a
clip the throttle can no longer starve - and the demonstration would show
nothing. 110 seconds is past that point for any plausible visit.

An earlier version looped a 14-second excerpt for the same reasons, which was
short enough to read as a repeat while watching. Twenty-seven seconds of two
different scenes is not a fix for that so much as a longer wait before it shows.
A clip that never repeats needs a source with two minutes of continuous daylight
in it, which this trailer does not have.

`demo-en.vtt`, `demo-tr.vtt` are written for this project and carry the same
license as the rest of the repository (MIT). They describe the player, not the
film, and are not a transcript of the trailer.
