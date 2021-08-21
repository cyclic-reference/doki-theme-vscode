import * as vscode from "vscode";
import {
  activateHideWatermark,
  activateThemeSticker,
  activateThemeWallpaper,
  getCurrentThemeAndSticker,
  getSticker,
  uninstallImages,
} from "./ThemeManager";
import {DokiSticker, DokiTheme, StickerType} from "./DokiTheme";
import DokiThemeDefinitions from "./DokiThemeDefinitions";
import {StatusBarComponent} from "./StatusBar";
import {VSCodeGlobals} from "./VSCodeGlobals";
import {attemptToNotifyUpdates} from "./NotificationService";
import {showChanglog} from "./ChangelogService";
import {attemptToUpdateSticker} from "./StickerUpdateService";
import { watchConfigChanges } from "./ConfigWatcher";
import { cleanupOrigFiles as cleanupCheckSumRestorationFiles } from "./CheckSumService";

export interface Sticker {
  path: string;
  name: string;
  anchoring: string;
}

export interface DokiThemeDefinition {
  stickers: {
    default: Sticker;
    secondary?: Sticker;
  };
  information: any;
}

export interface VSCodeDokiThemeDefinition {
  extensionNames: string[];
  themeDefinition: DokiThemeDefinition;
}

const getCurrentSticker = (
  extensionCommand: string,
  dokiThemeDefinition: DokiThemeDefinition
): DokiSticker => {
  const stickerType = extensionCommand.endsWith('secondary') ?
    StickerType.SECONDARY : StickerType.DEFAULT;
  const sticker = getSticker(dokiThemeDefinition, stickerType);
  return {
    sticker,
    type: stickerType,
  };
};

function isStickerCommand(extensionCommand: string) {
  return extensionCommand.indexOf("wallpaper") < 0;
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("doki-theme.remove.sticker", () =>
      uninstallImages(context)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("doki-theme.doki.changelog", () =>
      showChanglog(context)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("doki-theme.remove.watermark", () =>
      activateHideWatermark(context)
    )
  );


  VSCodeGlobals.globalState = context.globalState;

  StatusBarComponent.initialize();
  context.subscriptions.push(StatusBarComponent);

  attemptToNotifyUpdates(context);

  const {sticker} = getCurrentThemeAndSticker();
  attemptToUpdateSticker(context, sticker.sticker)
    .catch(error => {
      console.error("Unable to update sticker for reasons", error);
    });

  DokiThemeDefinitions.map((dokiThemeDefinition: VSCodeDokiThemeDefinition) =>
    dokiThemeDefinition.extensionNames.map((extensionCommand) => ({
      extensionCommand,
      dokiThemeDefinition,
    }))
  )
    .reduce((accum, next) => accum.concat(next), [])
    .map(({dokiThemeDefinition, extensionCommand}) =>
      vscode.commands.registerCommand(extensionCommand, () => {
          const dokiTheme = new DokiTheme(dokiThemeDefinition.themeDefinition);
          const currentSticker = getCurrentSticker(extensionCommand, dokiThemeDefinition.themeDefinition);
          if (isStickerCommand(extensionCommand)) {
            activateThemeSticker(dokiTheme, currentSticker, context);
          } else {
            activateThemeWallpaper(dokiTheme, currentSticker, context);
          }
        }
      )
    )
    .forEach((disposableHero) => context.subscriptions.push(disposableHero));

    context.subscriptions.push(watchConfigChanges(context));

    cleanupCheckSumRestorationFiles();
}

export function deactivate() {
}
