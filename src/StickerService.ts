import * as vscode from "vscode";
import fs from "fs";
import {editorCss, editorCssCopy} from "./ENV";
import {attemptToUpdateSticker} from "./StickerUpdateService";
import {Sticker} from "./extension";

export enum InstallStatus {
  INSTALLED,
  NOT_INSTALLED,
  FAILURE,
}

const stickerComment = "/* Stickers */";

const getStickerIndex = (currentCss: string) => currentCss.indexOf(stickerComment);

function getVsCodeCss() {
  return getScrubbedCSS();
}

function buildStickerCss({
  stickerDataURL: stickerUrl,
  backgroundImageURL: backgroundUrl,
  wallpaperImageURL: wallpaperURL,
  backgroundAnchoring,
}: DokiStickers): string {
  const style =
    "content:'';pointer-events:none;position:absolute;z-index:9001;width:100%;height:100%;background-position:100% 97%;background-repeat:no-repeat;opacity:1;";
  const style2 =     "content:'';pointer-events:none;position:absolute;z-index:9001;width:100%;height:100%;background-position:100% 100%;background-repeat:no-repeat;opacity:1;";

  return `
  ${stickerComment}
  body > .monaco-workbench > .monaco-grid-view > .monaco-grid-branch-node > .monaco-split-view2 > .split-view-container::after,
  body > .monaco-workbench > .monaco-grid-view > .monaco-grid-branch-node > .monaco-split-view2 > .monaco-scrollable-element > .split-view-container::after
  {background-image: url('${stickerUrl}');${style}}

  .notifications-toasts {
    z-index: 9002 !important;
  }

  /* Background Image */

  [id="workbench.parts.editor"] .split-view-view .editor-container .editor-instance>.monaco-editor
  .overflow-guard>.monaco-scrollable-element::before  {
    background-image: url('${wallpaperURL}') !important;
    background-position: ${backgroundAnchoring} !important;
    background-attachment: fixed !important;
    background-repeat: no-repeat !important;
    background-size: cover !important;
  }

  [id="workbench.parts.editor"] .split-view-view .editor-container .editor-instance>.monaco-editor .overflow-guard>.monaco-scrollable-element>.monaco-editor-background{background: none;}

  .monaco-scrollable-element, .editor-scrollable,
  .overflow-guard, .tab, .split-view-view, .monaco-pane-view,
  .composite.title, .content, .xterm-cursor-layer, .monaco-select-box, 
  .pane-header, .monaco-list-rows, canvas, .decorationsOverviewRuler,
  .monaco-breadcrumbs
  {
    background-image: url('${wallpaperURL}') !important;
    background-position: ${backgroundAnchoring} !important;
    background-attachment: fixed !important;
    background-repeat: no-repeat !important;
    background-size: cover !important;
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

function buildStyles(dokiStickers: DokiStickers): string {
  return `${getVsCodeCss()}${buildStickerCss(dokiStickers)}`;
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

export async function installStickersAndWallPaper(
  sticker: Sticker,
  context: vscode.ExtensionContext
): Promise<boolean> {
  if (canWrite()) {
    try {
      const stickersAndWallpaper = await attemptToUpdateSticker(
        context,
        sticker
      );
      const stickerStyles = buildStyles(stickersAndWallpaper);
      installEditorStyles(stickerStyles);
      return true;
    } catch (e) {
      console.error("Unable to install sticker!", e);
    }
  }

  return false;
}

function getScrubbedCSS() {
  const currentCss = fs.readFileSync(editorCss, "utf-8");
  const stickerIndex = getStickerIndex(currentCss);
  if (stickerIndex >= 0) {
    return currentCss.substr(0, stickerIndex).trim();
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
