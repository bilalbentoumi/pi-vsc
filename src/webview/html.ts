import * as vscode from 'vscode';
import { getNonce } from '../util/nonce';

export function renderWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  appVersion?: string,
): string {
  const nonce = getNonce();
  const asset = (...p: string[]) =>
    webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...p));

  const scriptUri = asset('dist', 'webview.js');
  const ts = Date.now();
  const styleUri = asset('dist', 'webview.css') + `?v=${ts}`;
  const recursiveFontUri = asset('media', 'fonts', 'Recursive-VF.woff2');
  const pixelFontUri = asset('media', 'fonts', 'PressStart2P-Regular.ttf');

  const cspSource = webview.cspSource;
  const csp = [
    `default-src 'none'`,
    `img-src ${cspSource} https: data:`,
    `media-src ${cspSource} data:`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `font-src ${cspSource}`,
    `script-src 'nonce-${nonce}'`,
    `connect-src ${cspSource}`,
  ].join('; ');

  const bodyClasses = [
    'always-borders',
    'density-normal',
    'caret-blink-med',
  ].join(' ');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy" content="${csp}" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<link rel="preload" href="${recursiveFontUri}" as="font" type="font/woff2" crossorigin />
	<link rel="preload" href="${pixelFontUri}" as="font" type="font/ttf" crossorigin />
	<link href="${styleUri}" rel="stylesheet" />
	<style nonce="${nonce}">
		@font-face {
			font-family: 'Pintra Mono';
			font-style: normal;
			font-weight: 300 1000;
			font-display: swap;
			src: url('${recursiveFontUri}') format('woff2-variations');
		}
		@font-face {
			font-family: 'Pintra Pixel';
			font-style: normal;
			font-weight: 400;
			font-display: swap;
			src: url('${pixelFontUri}') format('truetype');
		}
	</style>
	<title>Pintra</title>
</head>
<body
	class="${bodyClasses}"
	data-view-kind="sidebar"
	data-initial-view="chat"
	data-ext-version="${appVersion ?? ''}"
>
	<div id="root"></div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
