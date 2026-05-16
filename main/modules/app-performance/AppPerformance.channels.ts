enum AppPerformanceChannel {
  GetState = "app-performance:get-state",
  ListCaptures = "app-performance:list-captures",
  GetCaptureState = "app-performance:get-capture-state",
  DeleteCapture = "app-performance:delete-capture",
  DeleteCaptures = "app-performance:delete-captures",
  StartCapture = "app-performance:start-capture",
  StopCapture = "app-performance:stop-capture",
  RecordRendererMetrics = "app-performance:record-renderer-metrics",
  RecordRouteMarker = "app-performance:record-route-marker",
  ApplyRetentionCleanup = "app-performance:apply-retention-cleanup",
  ExportReport = "app-performance:export-report",
  StateChanged = "app-performance:state-changed",
  SampleAdded = "app-performance:sample-added",
  RouteMarkerAdded = "app-performance:route-marker-added",
}

export { AppPerformanceChannel };
