import { app as electronApp } from "electron";
import { AppEngine, MainWindowEngine } from "./engines";

const app = AppEngine.getInstance();
const mainWindow = MainWindowEngine.getInstance();

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
