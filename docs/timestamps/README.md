# Cryptographic timestamps

The `.ots` files in this folder are OpenTimestamps proofs. Each one ties a file's SHA-256 to the Bitcoin blockchain, which
proves that the file existed in that exact form on the date it was stamped.

| Proof | File it proves | SHA-256 of that file |
|---|---|---|
| `the-patch-1.2.50.zip.ots` | the software deposit, https://doi.org/10.5281/zenodo.24046421 (the repository at commit 2d6628c) | `0a1214686dfa7ba0a39d60babd661a17cd2bfad7ef6c4abf5be31d2bebb0bcc4` |
| `the-patch-method-v1.pdf.ots` | [`../the-patch-method-v1.pdf`](../the-patch-method-v1.pdf), also https://doi.org/10.5281/zenodo.24046691 | `86d7c8334b957251ce5446eb1d6dff888c52584e1f403ffa0720b4d8822f5015` |
| `the-patch-1.2.50-app.html.ots` | `patch/app/index.html` at commit 2d6628c | `91284ad09988f377d062dd2550f4b47816f65c1d311204365c952c343e761c35` |

To verify:

1. Install the OpenTimestamps client: `pip install opentimestamps-client`
2. Run, for example: `ots verify the-patch-method-v1.pdf.ots -f ../the-patch-method-v1.pdf`
3. The verifier returns the Bitcoin block number and date that anchor the proof.

For the app, first write the file out of git: `git show 2d6628c:patch/app/index.html > the-patch-1.2.50-app.html`.
For the zip, download it from the software DOI.

Or drop any `.ots` file and its original file on https://opentimestamps.org.

**Status: confirmed.** All three proofs are anchored in the Bitcoin blockchain at block 975020 (the night of 7 November 2026
MST, which is 8 November UTC), with later attestations at blocks 975023 and 975026 from the other calendars. The proofs in this
folder are the complete, upgraded ones, so they verify without contacting the OpenTimestamps calendars.

These timestamps establish prior art for The Patch's method and reference implementation. All three files were timestamped
on 8 November 2026 (UTC).
