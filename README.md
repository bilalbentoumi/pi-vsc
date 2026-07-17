<div align="center">

# Pintra

<img alt="Pintra logo" src="media/icon.png" width="80" height="80">

**AI coding agent for VS Code, powered by Pi.**

[github.com/bilalbentoumi/pi-vsc](https://github.com/bilalbentoumi/pi-vsc)

<p align="center">
  <a href="https://github.com/bilalbentoumi/pi-vsc/releases">
    <img src="https://img.shields.io/github/release-date/bilalbentoumi/pi-vsc?label=Release%20Date&display_date=published_at">
 </a>
  <a href="https://github.com/bilalbentoumi/pi-vsc/issues">
    <img src="https://img.shields.io/github/issues/bilalbentoumi/pi-vsc?color=orange" />
  </a>
 <a href="https://github.com/bilalbentoumi/pi-vsc/pulls">
    <img src="https://img.shields.io/github/issues-pr/bilalbentoumi/pi-vsc?color=8B5CF6" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=bilalbentoumi.pi-vsc">
    <img src="https://img.shields.io/badge/VS%20Code-Marketplace-0078D4?logo=visualstudiocode">
  </a>
  <a href="https://open-vsx.org/extension/bilalbentoumi/pi-vsc">
    <img src="https://img.shields.io/badge/Open%20VSX-Registry-C8962E?logo=openvsx">
  </a>
</p>

</div>

## Overview

Pintra brings the [Pi coding agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) into VS Code and VSCodium as a focused chat sidebar. It spawns an external `pi` runtime and speaks its JSON-lines RPC protocol — streaming rich tool output and thinking, keeping session history and usage stats, and giving you model and reasoning controls, message forking, edit/write diffs, slash-command autocomplete, a full editor-tab chat, and HTML export.

The `pi` runtime is not bundled: install and authenticate it once, and Pintra drives it from inside the editor.

For more information, visit the [repository](https://github.com/bilalbentoumi/pi-vsc).

<div align="center">

<img alt="Pintra screenshot" src="media/screenshot.png" width="100%">

</div>

## Issues

Found a bug or have a feature request? Please open an issue on [GitHub](https://github.com/bilalbentoumi/pi-vsc/issues).

## License

Pintra is released under the MIT License. It embeds the MIT-licensed [`pi` coding agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) through its documented RPC interface.
