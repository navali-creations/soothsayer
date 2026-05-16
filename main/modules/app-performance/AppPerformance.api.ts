import { ipcRenderer } from "electron";

import { AppPerformanceChannel } from "./AppPerformance.channels";
import type {
  AppPerformanceBulkDeleteResultDTO,
  AppPerformanceCaptureHistoryDTO,
  AppPerformanceDeleteResultDTO,
  AppPerformanceExportResultDTO,
  AppPerformanceListCapturesInputDTO,
  AppPerformanceRetention,
  AppPerformanceRouteMarkerDTO,
  AppPerformanceRouteMarkerInputDTO,
  AppPerformanceSampleDTO,
  AppPerformanceStateDTO,
  RendererPerformanceMetricsDTO,
} from "./AppPerformance.dto";

const AppPerformanceAPI = {
  getState: (): Promise<AppPerformanceStateDTO> =>
    ipcRenderer.invoke(AppPerformanceChannel.GetState),

  listCaptures: (
    input?: AppPerformanceListCapturesInputDTO,
  ): Promise<AppPerformanceCaptureHistoryDTO> =>
    ipcRenderer.invoke(AppPerformanceChannel.ListCaptures, input),

  getCaptureState: (captureId: string): Promise<AppPerformanceStateDTO> =>
    ipcRenderer.invoke(AppPerformanceChannel.GetCaptureState, captureId),

  deleteCapture: (captureId: string): Promise<AppPerformanceDeleteResultDTO> =>
    ipcRenderer.invoke(AppPerformanceChannel.DeleteCapture, captureId),

  deleteCaptures: (
    captureIds: string[],
  ): Promise<AppPerformanceBulkDeleteResultDTO> =>
    ipcRenderer.invoke(AppPerformanceChannel.DeleteCaptures, captureIds),

  startCapture: (): Promise<AppPerformanceStateDTO> =>
    ipcRenderer.invoke(AppPerformanceChannel.StartCapture),

  stopCapture: (): Promise<AppPerformanceStateDTO> =>
    ipcRenderer.invoke(AppPerformanceChannel.StopCapture),

  recordRendererMetrics: (
    metrics: RendererPerformanceMetricsDTO,
  ): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(AppPerformanceChannel.RecordRendererMetrics, metrics),

  recordRouteMarker: (
    marker: AppPerformanceRouteMarkerInputDTO,
  ): Promise<AppPerformanceRouteMarkerDTO | null> =>
    ipcRenderer.invoke(AppPerformanceChannel.RecordRouteMarker, marker),

  applyRetentionCleanup: (
    retention?: AppPerformanceRetention,
  ): Promise<number> =>
    ipcRenderer.invoke(AppPerformanceChannel.ApplyRetentionCleanup, retention),

  exportReport: (captureId?: string): Promise<AppPerformanceExportResultDTO> =>
    ipcRenderer.invoke(AppPerformanceChannel.ExportReport, captureId),

  onStateChanged: (callback: (state: AppPerformanceStateDTO) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      state: AppPerformanceStateDTO,
    ) => callback(state);
    ipcRenderer.on(AppPerformanceChannel.StateChanged, handler);
    return () =>
      ipcRenderer.removeListener(AppPerformanceChannel.StateChanged, handler);
  },

  onSampleAdded: (callback: (sample: AppPerformanceSampleDTO) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      sample: AppPerformanceSampleDTO,
    ) => callback(sample);
    ipcRenderer.on(AppPerformanceChannel.SampleAdded, handler);
    return () =>
      ipcRenderer.removeListener(AppPerformanceChannel.SampleAdded, handler);
  },

  onRouteMarkerAdded: (
    callback: (marker: AppPerformanceRouteMarkerDTO) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      marker: AppPerformanceRouteMarkerDTO,
    ) => callback(marker);
    ipcRenderer.on(AppPerformanceChannel.RouteMarkerAdded, handler);
    return () =>
      ipcRenderer.removeListener(
        AppPerformanceChannel.RouteMarkerAdded,
        handler,
      );
  },
};

export { AppPerformanceAPI };
