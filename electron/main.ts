import { app as electronApp } from "electron";
import { installExtension, REDUX_DEVTOOLS } from "electron-devtools-installer";
import { AppService, AppSetupService, MainWindowService } from "./modules";

const app = AppService.getInstance();
const mainWindow = MainWindowService.getInstance();
const appSetup = AppSetupService.getInstance();

if (!electronApp.requestSingleInstanceLock()) {
  // Quit any new instance created to prevent multiple instances of the same app
  app.quit();
} else {
  electronApp.whenReady().then(async () => {
    installExtension(REDUX_DEVTOOLS)
      .then((ext) => console.log(`Added Extension:  ${ext.name}`))
      .catch((err) => console.log("An error occurred: ", err));

    await mainWindow.createMainWindow(app.isQuitting);
    app.emitSecondInstance(mainWindow);
    app.emitRestart();
  });
}

app.emitActivate(mainWindow);
app.quitOnAllWindowsClosed([mainWindow]);
app.beforeQuitCloseWindowsAndDestroyElements();
