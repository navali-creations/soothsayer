import { LocalStorageKey } from "../../enums/local-storage";
import { LocalStorageEngine } from ".";

class SettingsEngine {
  private static _instance: SettingsEngine;
  private localStorage: LocalStorageEngine;

  static getInstance() {
    if (!SettingsEngine._instance) {
      SettingsEngine._instance = new SettingsEngine();
    }

    return SettingsEngine._instance;
  }

  constructor() {
    this.localStorage = LocalStorageEngine.getInstance();
    this.emitGeneralSettings();
  }

  public emitGeneralSettings() {
    this.localStorage.listenOnAndSet(LocalStorageKey.Poe1Path);
    this.localStorage.listenOnAndSet(LocalStorageKey.CollectionPath);
  }
}

export { SettingsEngine };
