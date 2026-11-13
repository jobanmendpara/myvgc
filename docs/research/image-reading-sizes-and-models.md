# Image sizes and models for reading a Team

Checked 2026-11-12 for MyVGC (DEV-119, part of the map DEV-118). It covers how Anthropic's API sizes the screenshots that the image reader sends (ADR 24, `apps/api/src/team-reader.ts`), what a read costs on `claude-sonnet-5-5` and `claude-haiku-5-5`, and what the documentation says about small text. Sources are Anthropic's own documentation only, read on the date above. No API calls were made, so every token count here comes from the documented formula, not from a measurement.

The sample is a Pokémon Champions screenshot of 2622 × 1206 px (PNG, about 3 MB). A full set is 8 images: the Replica Team's two tabs plus six Pokémon detail screens. Today a read takes 1 to 6 images of up to 10 MB each (`MAX_TEAM_IMAGES`, `MAX_TEAM_IMAGE_MB` in `packages/core/src/team.ts`).

## Summary

- **A 2622 × 1206 screenshot is downscaled slightly, to 2576 × 1185, and costs 3,956 input tokens** on both Sonnet 5.5 and Haiku 5.5. Both are on the high-resolution tier (2,576 px long edge, 4,784 visual tokens). The long edge is the limit that applies here, not the token budget.
- **High resolution is automatic.** There is no extra option or beta header to go higher. The only per-image switch is `transformations.oversized_image: "error"`, which rejects an oversized image instead of resizing it.
- **Estimated cost per read** (1,500 non-image input tokens and 2,500 output tokens assumed, thinking excluded): Sonnet 5.5 about **$0.044 for 2 images and $0.091 for 8**; Haiku 5.5 about **$0.0022 for 2 and $0.0046 for 8**. Haiku is roughly 20 times cheaper. Thinking tokens are billed as output on top of this.
- **The 10 MB per-image limit counts the base64 text, not the file.** A 10 MB file grows to about 13.3 MB in base64, so MyVGC's current 10 MB limit on the raw file can let through an image the API rejects. The 3 MB samples (about 4 MB in base64) fit.
- **On small text, the documentation only advises.** It says to keep important text legible and not too small, warns that resizing can make text less legible, and says Claude can make mistakes on very small images under 200 px. It gives no minimum text size in pixels.
- **Structured output does not change how images are read.** It adds a small injected system prompt. Server-side fallback checks `"oversized_image": "error"` images against the fallback model too. Haiku 5.5 has no server-side fallback.

## 1. The resolution an image is read at

### Tiers

The Vision page sets a maximum resolution for each model, as a long-edge limit and a visual-token limit ([Vision: Resolution and token cost](https://platform.claude.com/docs/en/build-with-claude/vision#evaluate-image-size)):

| Resolution tier | Models                      | Max long edge | Max visual tokens |
| --------------- | --------------------------- | ------------- | ----------------- |
| High-resolution | Claude 4.7 and later models | 2,576 px      | 4,784             |
| Standard        | All other models            | 1,568 px      | 1,568             |

"High-resolution support is automatic on the listed models and requires no beta header or client-side opt-in." (same page)

- **Sonnet 5.5** was released 2026-09-28 ([Sonnet 5.5 overview](https://platform.claude.com/docs/en/models/sonnet-5-5/overview)) and **Haiku 5.5** on 2026-10-07 ([Haiku 5.5 overview](https://platform.claude.com/docs/en/models/haiku-5-5/overview)). Both come after Claude 4.7, so both fall under "Claude 4.7 and later models".
- **Caveat:** neither model page names its image tier, and the Vision table names no model individually. Calling Haiku 5.5 high-resolution rests on the "and later" wording. A `count_tokens` call on one sample image would settle it (not done here: no API calls).
- **No higher setting exists.** The tier is the ceiling. There is no documented option above 2,576 px.

### The resize rule

How Claude resizes is set out in [Coordinates and bounding boxes: How Claude resizes and pads images](https://platform.claude.com/docs/en/build-with-claude/vision-coordinates#how-claude-resizes-and-pads-images):

- **The largest size that fits both limits.** Claude keeps the aspect ratio and finds the largest size where neither side exceeds the edge limit and `⌈width / 28⌉ × ⌈height / 28⌉` does not exceed the token budget.
- **Padding.** Every image is then padded on the bottom and right up to the next multiple of 28 px. The padding holds no content.
- **Which limit decides.** "For nearly all photos and screenshots, the visual token limit is what determines the final size. The edge limit takes over only for elongated images such as panoramas or tall phone screenshots."
- **Reference code.** The page has a reference implementation (`resized_size`, in Python, TypeScript and other languages). It finds the size by binary search and rounds half to even.

### The sample screenshot

The documented reference implementation was run with the high-resolution limits (2576, 4784) and, for comparison, the standard ones (1568, 1568):

| Image                        | Tier            | Size Claude reads | Visual tokens |
| ---------------------------- | --------------- | ----------------- | ------------- |
| 2622 × 1206 (as sent)        | High-resolution | 2576 × 1185       | 3,956         |
| 2622 × 1206 (as sent)        | Standard        | 1568 × 721        | 1,456         |
| 1920 × 883 (pre-resized)     | Either          | 1920 × 883 (high) / 1568 × 721 (standard) | 2,208 (high) / 1,456 (standard) |
| 1568 × 721 (pre-resized)     | Either          | not resized       | 1,456         |

- **Edge-limited.** The sample is wider than 2,576 px, so the edge limit decides. At full size it would cost 94 × 44 = 4,136 tokens, which is under the 4,784 budget.
- **A 2 % shrink.** On a high-resolution model the screenshot is reduced by about 2 % (2622 → 2576). On a standard-tier model it would be reduced by about 40 %, to 1568 × 721.
- **Portrait screenshots.** A portrait screenshot of the same size (1206 × 2622) behaves the same way with the axes swapped: 1185 × 2576 and 3,956 tokens.

## 2. Tokens and price per read

### Rates

| | Sonnet 5.5 | Haiku 5.5 (prompts up to 100,000 tokens) |
| --- | --- | --- |
| Input | $2 / MTok | $0.10 / MTok |
| Output | $10 / MTok | $0.50 / MTok |
| Cache read | $0.10 / MTok | $0.01 / MTok |
| Batch API | 50 % off | 50 % off |

Sources: [Pricing](https://platform.claude.com/docs/en/about-claude/pricing), [Sonnet 5.5 overview](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [Haiku 5.5 overview](https://platform.claude.com/docs/en/models/haiku-5-5/overview).

- **Haiku 5.5's price depends on prompt length.** Above 100,000 input tokens it costs $0.50 input and $2.50 output per MTok, and the whole request pays the higher rate ([Pricing: Long context pricing](https://platform.claude.com/docs/en/about-claude/pricing#long-context-pricing)). An 8-image read is about 33K tokens, well below that.
- **Sonnet 5.5 has one rate** across its full 1M context (same section).
- **Image tokens are billed as input tokens.** The Vision page says: "To estimate cost, multiply the token count by the per-token price of the model" ([Vision](https://platform.claude.com/docs/en/build-with-claude/vision#evaluate-image-size)).

### Assumptions for the estimates

- **Images:** 3,956 tokens each (section 1).
- **Non-image input: 1,500 tokens.** This is an assumption, not a measurement. It covers the system prompt (`INSTRUCTIONS`, a few hundred tokens), the short user text, and the system prompt that structured output injects, which the documentation says "costs you tokens like any other system prompt" ([Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)). The total is small next to the images: being off by 1,000 tokens moves the Sonnet price by $0.002.
- **Output: 2,500 tokens** of JSON, with the range for 2,000 to 3,000 tokens in brackets.
- **Thinking is not included.** Sonnet 5.5 and Haiku 5.5 have adaptive thinking on by default, with default effort `high` (Sonnet) and `medium` (Haiku) ([Models overview](https://platform.claude.com/docs/en/models/overview)). "The tokens Claude spends reasoning are billed as output tokens, even when the thinking text isn't returned to you, and they count toward `max_tokens`" ([Thinking](https://platform.claude.com/docs/en/build-with-claude/thinking)). Each 1,000 thinking tokens adds $0.010 on Sonnet 5.5 and $0.0005 on Haiku 5.5.

### Estimated price per read (no caching, no batch)

| Read | Input tokens | Sonnet 5.5 | Haiku 5.5 |
| --- | --- | --- | --- |
| 2 images | 7,912 + 1,500 = 9,412 | **$0.044** ($0.039–$0.049) | **$0.0022** ($0.0019–$0.0024) |
| 8 images | 31,648 + 1,500 = 33,148 | **$0.091** ($0.086–$0.096) | **$0.0046** ($0.0043–$0.0048) |

- **Images per read.** One image costs about $0.0079 on Sonnet 5.5 and $0.0004 on Haiku 5.5.
- **With pre-resizing.** Sending 8 images pre-resized to 1568 × 721 (1,456 tokens each) would bring an 8-image Sonnet read to about $0.051 (13,148 input tokens). Whether that loses text is a question about accuracy, covered in section 3.
- **Prompt caching** would not help much. Each read's images are new, and only the system prompt and schema repeat. The minimum cacheable prompt is 512 tokens on both models (model overview pages).

## 3. Downscaling and small text

What the documentation says, quoted:

- **Image quality guidance** ([Vision: Image quality guidance](https://platform.claude.com/docs/en/build-with-claude/vision#image-quality-guidance)):
  - "**Text:** If the image contains important text, make sure it's legible and not too small. Avoid cropping out key visual context solely to enlarge the text."
  - "**Resizing:** Take into account that your image might be resized if it is too large …; this might, for example, make text less legible. Consider pre-resizing your images, cropping them, or both."
  - "**Image compression:** … heavy JPEG compression can make text difficult to read. Confirm your compression settings are appropriate for the task by inspecting the actual images sent to the API."
- **When high resolution pays off.** "If you don't need the additional fidelity that high resolution provides for computer use, screenshot understanding, and dense documents, downsample images before sending to control token costs." ([Vision: Resolution and token cost](https://platform.claude.com/docs/en/build-with-claude/vision#evaluate-image-size)). Screenshot understanding is named as a use for the extra fidelity.
- **Limitations.** "Claude might hallucinate or make mistakes when interpreting low-quality, rotated, or very small images under 200 pixels." ([Vision: Limitations](https://platform.claude.com/docs/en/build-with-claude/vision#limitations))
- **Small elements.** "Small elements lose precision when an image is downscaled: for fine targets, crop the region of interest and send the crop …, or use a high-resolution-tier model." ([Coordinates and bounding boxes](https://platform.claude.com/docs/en/build-with-claude/vision-coordinates)). This is written about coordinates, but it is the same mechanism.

What follows from these for MyVGC's screenshots:

- **The largest size worth sending is the tier ceiling.** On the high-resolution tier that is 2,576 px on the long edge within 4,784 visual tokens. Anything larger is resized on the server to exactly that, and costs the same as sending it pre-resized. The 2622 × 1206 samples sit just above the ceiling, so pre-resizing to 2576 × 1185 changes neither the tokens nor what the model sees. It only saves upload bytes and takes the resize out of Anthropic's hands.
- **There is no minimum text size in pixels.** The only number given is the 200 px floor for whole images. The rest is qualitative ("legible and not too small"), and the documentation leaves it to testing ("inspect the actual images sent").
- **Model quality on screenshots is not compared.** The documentation contains no benchmark of Sonnet 5.5 against Haiku 5.5 on screenshots or small text. Haiku 5.5 is described as "for high-volume, latency-sensitive tasks such as classification, extraction, and routing", and Sonnet 5.5 as built for workloads including "visual understanding" ([Models overview](https://platform.claude.com/docs/en/models/overview), [Sonnet 5.5 overview](https://platform.claude.com/docs/en/models/sonnet-5-5/overview)). The "What's new" page for Haiku 5.5 says nothing about vision ([What's new in Claude Haiku 5.5](https://platform.claude.com/docs/en/models/haiku-5-5/whats-new-haiku-5-5)).

## 4. Limits for base64 images

All from [Vision: Request limits](https://platform.claude.com/docs/en/build-with-claude/vision#request-limits) unless noted.

| Limit | Claude API value |
| --- | --- |
| Images per request | 600 (100 on models with a 200k context window; Sonnet 5.5 and Haiku 5.5 have 1M) |
| Dimensions per image | 8000 × 8000 px |
| Stricter dimension limit | Applies when a request has more than 20 images; keep each side at most 3,000 px to stay safe on every platform |
| Size per image | 10 MB, base64-encoded (5 MB on Amazon Bedrock) |
| Request size (Messages) | 128 MB; a larger request returns 413 `request_too_large` ([API overview: Request size limits](https://platform.claude.com/docs/en/api/overview)) |
| Formats | JPEG, PNG, GIF, WebP (first frame only for animations) |

What this means for the samples:

- **8 images fit easily.** Eight 3 MB PNGs come to about 32 MB in base64, far under 128 MB, and 8 images is far under the 20-image threshold.
- **Base64 is about 4/3 the size of the file.** That is a property of base64 encoding, not something the Anthropic docs state. So the API's 10 MB per image means a file of about 7.5 MB at most. MyVGC's own limit is 10 MiB on the file (`MAX_TEAM_IMAGE_BYTES`), which is about 14 MB in base64. A 9 MB image passes MyVGC's check and is then rejected by the API.
- **Unit not stated.** The docs do not say whether "MB" means 10^6 or 2^20 bytes.
- **Other platforms.** Bedrock caps a request at 20 MB and the other cloud platforms at 30–32 MB. That would matter only if MyVGC ever ran on one of them.

## 5. Structured output and the fallback beta

### Structured output

Source: [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).

- **Available on every model,** Sonnet 5.5 and Haiku 5.5 included.
- **Images are allowed.** The page's own example use is "to extract data from images or text".
- **No image restriction.** The page lists no image-specific restriction. The incompatibilities it lists are citations (400 error) and assistant prefill.
- **An extra system prompt.** "Claude automatically receives an additional system prompt explaining the expected output format," which costs input tokens. Changing the format invalidates the prompt cache.
- **First-request latency.** The first request with a given schema pays a grammar-compilation delay. Compiled grammars are cached for 24 hours from last use.
- **Invalid outputs.** A `refusal` or `max_tokens` stop can produce output that does not match the schema.
- **Don't ask for reasoning in the schema.** "A property that asks for the model's thinking or step-by-step reasoning might lead to a `reasoning_extraction` refusal." `seenTeamSchema` should not have such a field.

### Server-side fallback (`server-side-fallback-2026-07-01`, `fallbacks: "default"`)

Source: [Refusals and fallback](https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback), unless noted.

- **What triggers it.** Only a safety classifier's refusal triggers fallback. Rate limits and server errors are returned as they are.
- **Where Sonnet 5.5 falls back to.** A request declined in the `cyber` or `frontier_llm` category runs again on Claude Sonnet 5. A request declined in `bio`, `reasoning_extraction` or `general_harms` is not retried ([What's new in Claude Sonnet 5.5](https://platform.claude.com/docs/en/models/sonnet-5-5/whats-new-sonnet-5-5#refusals-fallback-and-billing)). Claude Sonnet 5 is also a "4.7 and later" model, so on the reading in section 1 the images are sized the same after a fallback.
- **Haiku 5.5 has no server-side fallback.** "With `fallbacks: "default"`, a declined request stays declined, and a list of fallback models returns a 400 error." It also carries no fallback credit. So with `TEAM_READER_MODEL=claude-haiku-5-5`, the current request (`fallbacks: 'default'`) still works, but it never falls back.
- **Interaction with images.** This only matters if `"oversized_image": "error"` is used. "Default routing never draws the up-front oversized-image rejection for models you did not choose: a routed model that would resize an image marked `"oversized_image": "error"` is dropped from the routing instead, so a marked image is never served resized." When fallback models are named explicitly, they count toward the up-front check instead. Without the marker, images are simply resized for whichever model runs.
- **Billing.** A refusal before any output is billed only in the `bio`, `frontier_llm` and `reasoning_extraction` categories. A mid-stream refusal bills what was streamed. A fallback attempt is billed at its own model's rates and listed in `usage.iterations` (section "How refusals are billed").

## What this means for DEV-119

These are the facts the decision depends on. The decision itself is not made here.

1. **Sending the screenshots as they are wastes nothing in tokens.** 2622 × 1206 becomes 2576 × 1185 (3,956 tokens) on either model. Resizing on the client to that size changes only the upload bytes.
2. **Going smaller is the only way to cut image tokens.** Every step down trades legibility for cost, and the documentation gives no pixel threshold for small text; it says to test. At 1568 × 721 an image costs 1,456 tokens (37 % of full size).
3. **The model choice is mainly a cost choice in the documentation.** Haiku 5.5 costs about 1/20 of Sonnet 5.5 per read ($0.0046 against $0.091 for 8 images, before thinking). Anthropic publishes no screenshot or small-text accuracy comparison, so accuracy has to be measured on the sample screenshots (DEV-102's real-model check is the natural place).
4. **Haiku 5.5's image tier is inferred,** from "Claude 4.7 and later models". One `count_tokens` call per model on a sample image confirms it at no inference cost.
5. **Haiku 5.5 loses fallback.** Its refusals stand, with no server-side fallback and no fallback credit. Sonnet 5.5 falls back to Sonnet 5 only for `cyber` and `frontier_llm` refusals.
6. **Raising the image limit from 6 to 8 is within every API limit.** 8 images at about 4 MB of base64 each is about 32 MB, against 600 images and 128 MB.
7. **MyVGC's 10 MB file limit is looser than the API's 10 MB base64 limit.** Files between about 7.5 MB and 10 MB pass MyVGC's check and are rejected by Anthropic.
8. **Thinking adds output cost beyond the estimates.** Effort (`high` by default on Sonnet 5.5, `medium` on Haiku 5.5) is a second lever on price per read.
