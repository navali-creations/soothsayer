import { app as electronApp } from "electron";
import {
  AppService,
  AppSetupService,
  MainWindowService,
} from "./modules";

const app = AppService.getInstance();
const mainWindow = MainWindowService.getInstance();
const appSetup = AppSetupService.getInstance();

if (!electronApp.requestSingleInstanceLock()) {
  // Quit any new instance created to prevent multiple instances of the same app
  app.quit();
} else {
  electronApp.whenReady().then(async () => {
    await mainWindow.createMainWindow(app.isQuitting);
    app.emitSecondInstance(mainWindow);
    app.emitRestart();
  });
}

app.emitActivate(mainWindow);
app.quitOnAllWindowsClosed([mainWindow]);
app.beforeQuitCloseWindowsAndDestroyElements();
