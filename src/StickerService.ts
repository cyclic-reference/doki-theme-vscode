import * as vscode from "vscode";
import fs from "fs";
import { editorCss, editorCssCopy } from "./ENV";
import {
  forceUpdateSticker,
  NetworkError,
} from "./StickerUpdateService";
import { Sticker } from "./extension";

export enum InstallStatus {
  INSTALLED,
  NOT_INSTALLED,
  FAILURE,
  NETWORK_FAILURE,
}

const stickerComment = "/* Stickers */";
const hideComment = "/* Hide Watermark */";
const wallpaperComment = "/* Background Image */";

const getStickerIndex = (currentCss: string) =>
  currentCss.indexOf(stickerComment);
const getHideIndex = (currentCss: string) =>
  currentCss.indexOf(hideComment);
const getWallpaperIndex = (currentCss: string) =>
  currentCss.indexOf(wallpaperComment);

function buildWallpaperCss({
  backgroundImageURL: backgroundUrl,
  wallpaperImageURL: wallpaperURL,
  backgroundAnchoring,
}: DokiStickers): string {
  return `${wallpaperComment}
  [id="workbench.parts.editor"] .split-view-view .editor-container .editor-instance>.monaco-editor .overflow-guard>.monaco-scrollable-element>.monaco-editor-background{background: none;}


  [id="workbench.parts.editor"] .split-view-view .editor-container .editor-instance>.monaco-editor  .overflow-guard>.monaco-scrollable-element::before,
  .overflow-guard,
  .tab,
  /* settings UI */
  .settings-editor>.settings-body .settings-toc-container,
  /* end settings UI */
  .tabs-container,
  .monaco-pane-view, 
  .composite.title,
  /* welcome window */
  .editor-container,
  button.getting-started-category,
  /* end welcome window */
  div.header, /* extensions header */
  .content,
  .monaco-select-box,
  .pane-header, 
  .minimap-decorations-layer,
  .xterm-cursor-layer,
  .decorationsOverviewRuler,
  .monaco-workbench .part.editor>.content .editor-group-container>.title .tabs-breadcrumbs .breadcrumbs-control,
  .ref-tree, /* find usages */
  .head, /* find usages */
  .monaco-workbench .part.editor>.content .editor-group-container>.title .editor-actions,  
  .welcomePageFocusElement, /* welcome screen */
  .terminal-outer-container /* Terminal outer edge */
  {
    background-image: url('${wallpaperURL}') !important;
    background-position: ${backgroundAnchoring} !important;
    background-attachment: fixed !important;
    background-repeat: no-repeat !important;
    background-size: cover !important;
  }
  
  /*settings UI */
  .monaco-list.list_id_1 .monaco-list-rows,
  /* source control diff editor */  
  .lines-content.monaco-editor-background,
  /* output panel */
  .overflow-guard > .margin,
  .overflow-guard > .margin > .margin-view-overlays,
  .monaco-workbench .part.panel > .content .monaco-editor .monaco-editor-background,
  /* debugger panel */
  [id="workbench.panel.repl"] *
   {
    background-color: transparent !important;
  }

  .quick-input-widget
  {
    backdrop-filter: blur(5px) !important;
  }

  .monaco-breadcrumbs {
    background-color: #00000000 !important;
  }

  [id="workbench.view.explorer"] .monaco-list-rows,
  [id="workbench.view.explorer"] .pane-header,
  [id="workbench.view.explorer"] .monaco-pane-view,
  [id="workbench.view.explorer"] .split-view-view,
  [id="workbench.view.explorer"] .monaco-tl-twistie,
  [id="workbench.view.explorer"] .monaco-icon-label-container,
  .explorer-folders-view > .monaco-list > .monaco-scrollable-element > .monaco-list-rows,
  .show-file-icons > .monaco-list > .monaco-scrollable-element > .monaco-list-rows,
  .extensions-list > .monaco-list > .monaco-scrollable-element > .monaco-list-rows
  {
    background-color: #00000000 !important;
    background-image: none !important;
    border: none !important;
  }

  .monaco-icon-label-container {
    background: none !important;
  }

  .monaco-workbench .part.editor > .content {
    background-image: url('${backgroundUrl}') !important;
    background-position: ${backgroundAnchoring};
    background-attachment: fixed;
    background-repeat: no-repeat;
    background-size: cover;
    content:'';
    z-index:9001;
    width:100%;
    height:100%;
    opacity:1;
}
  `;
}

function buildStickerCss({ stickerDataURL: stickerUrl }: DokiStickers): string {
  const style =
    "content:'';pointer-events:none;position:absolute;z-index:9001;width:100%;height:100%;background-position:100% 97%;background-repeat:no-repeat;opacity:1;";
  return `
  ${stickerComment}
  body > .monaco-workbench > .monaco-grid-view > .monaco-grid-branch-node > .monaco-split-view2 > .split-view-container::after,
  body > .monaco-workbench > .monaco-grid-view > .monaco-grid-branch-node > .monaco-split-view2 > .monaco-scrollable-element > .split-view-container::after
  {background-image: url('${stickerUrl}');${style}}

  /* Makes sure notification shows on top of sticker */
  .notifications-toasts {
    z-index: 9002 !important;
  }

  /* glass pane to show sticker */
  .notification-toast {
    backdrop-filter: blur(2px) !important;
  }
`;
}

function buildHideWaterMarkCSS(): string {
  return `
  ${hideComment}
  .monaco-workbench .part.editor.has-watermark>.content.empty .editor-group-container>.editor-group-letterpress,
  .monaco-workbench .part.editor>.content.empty>.watermark>.watermark-box 
  {
    display: none !important;
  }
`;
}



function buildCSSWithStickers(dokiStickers: DokiStickers): string {
  return `${getStickerScrubbedCSS()}${buildStickerCss(dokiStickers)}`;
}

function buildCSSWithWallpaper(dokiStickers: DokiStickers): string {
  return `${getWallpaperScrubbedCSS()}${buildWallpaperCss(dokiStickers)}`;
}

function buildCSSWithoutWatermark(): string {
  return `${getWatermarkScrubbedCSS()}${buildHideWaterMarkCSS()}`;
}


function installEditorStyles(styles: string) {
  fs.writeFileSync(editorCss, styles, "utf-8");
}

function canWrite(): boolean {
  try {
    fs.accessSync(editorCss, fs.constants.W_OK);
    return true;
  } catch (error) {
    return false;
  }
}

export interface DokiStickers {
  stickerDataURL: string;
  backgroundImageURL: string;
  wallpaperImageURL: string;
  backgroundAnchoring: string;
}

export async function installStickers(
  sticker: Sticker,
  context: vscode.ExtensionContext
): Promise<InstallStatus> {
  return installStyles(sticker, context, (stickersAndWallpaper) =>
    buildCSSWithStickers(stickersAndWallpaper)
  );
}

export async function installWallPaper(
  sticker: Sticker,
  context: vscode.ExtensionContext
): Promise<InstallStatus> {
  return installStyles(sticker, context, (stickersAndWallpaper) =>
    buildCSSWithWallpaper(stickersAndWallpaper)
  );
}

export async function hideWaterMark(): Promise<InstallStatus> {
  if (!canWrite()) return InstallStatus.FAILURE;

  installEditorStyles(buildCSSWithoutWatermark())
  return InstallStatus.INSTALLED
}


async function installStyles(
  sticker: Sticker,
  context: vscode.ExtensionContext,
  cssDecorator: (assets: DokiStickers) => string
): Promise<InstallStatus> {
  if (canWrite()) {
    try {
      const stickersAndWallpaper = await forceUpdateSticker(context, sticker);
      const stickerStyles = cssDecorator(stickersAndWallpaper);
      installEditorStyles(stickerStyles);
      return InstallStatus.INSTALLED;
    } catch (e) {
      console.error("Unable to install sticker!", e);
      if (e instanceof NetworkError) {
        return InstallStatus.NETWORK_FAILURE;
      }
    }
  }

  return InstallStatus.FAILURE;
}

function getScrubbedCSS() {
  const currentCss = fs.readFileSync(editorCss, "utf-8");
  return indexGetters.reduce(
    (trimmedCss, indexFinderDude) => trimCss(trimmedCss, indexFinderDude(trimmedCss)),
    currentCss
  );
}

type IndexFinderDude = (currentCss: string) => number;

function scrubCssOfAsset(
  getOtherAssets: IndexFinderDude[],
  getAssetToRemoveIndex: IndexFinderDude
) {
  const currentCss = fs.readFileSync(editorCss, "utf-8");
  const otherAssetIndices = getOtherAssets.map(assetFinder => assetFinder(currentCss));
  const assetToRemoveIndex = getAssetToRemoveIndex(currentCss);
  const otherIndex = otherAssetIndices.reduce((accum, index) => Math.max(accum, index), -1);
  if (otherIndex < 0) {
    return trimCss(currentCss, assetToRemoveIndex);
  } else if (assetToRemoveIndex > -1) {
    const smolestGreater = otherAssetIndices
      .filter(otherIndex => assetToRemoveIndex < otherIndex)
      .reduce((accum, index) => Math.min(accum, index), Number.POSITIVE_INFINITY)
    return (
      currentCss.substring(0, assetToRemoveIndex) +
      (smolestGreater < Number.POSITIVE_INFINITY
        ? "\n" + currentCss.substring(smolestGreater, currentCss.length)
        : "")
    );
  }
  return currentCss;
}

const indexGetters = [
  getStickerIndex, getWallpaperIndex, getHideIndex
]

function getWallpaperScrubbedCSS() {
  return scrubCssOfAsset(
    indexGetters.filter(getter => getter !== getWallpaperIndex),
    getWallpaperIndex
  );
}
function getStickerScrubbedCSS() {
  return scrubCssOfAsset(
    indexGetters.filter(getter => getter !== getStickerIndex),
    getStickerIndex
  );
}
function getWatermarkScrubbedCSS() {
  return scrubCssOfAsset(
    indexGetters.filter(getter => getter !== getHideIndex),
    getHideIndex
  );
}

function trimCss(currentCss: string, index: number): string {
  if (index >= 0) {
    return currentCss.substr(0, index).trim();
  }
  return currentCss;
}

const scrubCSSFile = () => {
  const scrubbedCSS = getScrubbedCSS();
  fs.writeFileSync(editorCss, scrubbedCSS, "utf-8");
};

// :(
export function removeStickers(): InstallStatus {
  if (canWrite()) {
    try {
      if (fs.existsSync(editorCssCopy)) {
        fs.unlinkSync(editorCssCopy);
        scrubCSSFile();
        return InstallStatus.INSTALLED;
      }
      scrubCSSFile();
      return InstallStatus.NOT_INSTALLED;
    } catch (e) {
      console.error("Unable to remove stickers!", e);
      return InstallStatus.FAILURE;
    }
  }

  return InstallStatus.FAILURE;
}
