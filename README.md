# A playable ad under the network cap, measured

*One mechanic, built in PixiJS v8 as a single self-contained HTML file, with
every byte accounted for. Then the same question asked of Godot.*

Playable ad networks cap the **file**, not the download. Meta takes a single
HTML file of at most 2 MB; Mintegral about 4 MB; AppLovin and Google about 5 MB.
Compression on the wire doesn't help: the asset is inlined, so what counts is
the raw size of the file you upload.

## The result

**[Play it](https://zednaked.github.io/playable-budget/)** (or [watch it play itself](https://zednaked.github.io/playable-budget/dist/index.webgl.html?autoplay)).

`Bunny Hop`: the bunny bounces on its own, you steer left and right, five coins
open the end card. CC0 art from Kenney's Jumper Pack.

```
dist/index.webgl.html  630.1 KB                       share
  PixiJS v8 (tree-shaken, minified)         529.2 KB  84.0%
  game code                                   3.7 KB   0.6%
  art, base64 (10 PNGs, 71.7 KB raw)         95.9 KB  15.2%
  HTML shell                                  1.2 KB   0.2%

  Meta, single HTML    cap 2048 KB   used 30.8%
  Mintegral            cap 4096 KB   used 15.4%
  AppLovin / Google    cap 5120 KB   used 12.3%
```

Three things the table says:

**The library is the budget, not the art.** 84% of the file is PixiJS, after
tree-shaking. The game is 3.7 KB. The 181 KB you see quoted for Pixi is the
brotli transfer of the CDN build; a network that caps the file never sees that
number.

**Pixi ships three renderers by default.** `autoDetectRenderer` pulls in WebGL,
WebGPU and Canvas, and a bundler keeps all three. Stubbing the WebGPU and Canvas
imports (`LEAN=1`, an esbuild plugin in `tools/build.mjs`) takes the file from
695.9 KB to 630.1 KB, **66 KB**, with no change to the game. WebGL covers every
device that can show the ad.

**Inlining costs a third.** 71.7 KB of PNG becomes 95.9 KB of base64: **+33.8%**,
on every asset, every time. On a playable with real art, that tax is the line
that decides whether you fit under 2 MB.

## The same question for Godot

An empty Godot 4.7.2 project, Compatibility renderer, no threads, exported for
the web:

```
index.wasm   39,514,754 bytes
everything   39,833,145 bytes   19.0x Meta's cap, 7.6x a 5 MB cap
```

That is before a single sprite, and before base64 adds its third. Godot can't
enter this format on the default export template. A custom template with
modules stripped would shrink the wasm; I haven't built one here, so there is no
number for it.

## Run it

```sh
npm install
node tools/build.mjs            # dist/index.html, all renderers
LEAN=1 node tools/build.mjs     # dist/index.webgl.html, WebGL only
npx serve dist                  # or any static server
node tools/smoke.mjs <url>?autoplay   # headless Chromium waits for the end card
```

`?autoplay` steers the bunny by itself; both builds reach the end card in under
7 seconds in the smoke test. The PLAY NOW button goes through `mraid.open` when
the network provides it, and a normal link otherwise.

The Godot floor comes from `godot-floor/`:
`godot --headless --path godot-floor --export-release Web ../dist/godot/index.html`.

## Not measured yet

- A stripped Godot export template.
- Defold, which has an editor and a single-HTML playable toolchain.
- Real art at production scale, where the base64 tax starts to matter.

The art is CC0 (Kenney, see `assets/KENNEY-LICENSE.txt`). The code is MIT.
