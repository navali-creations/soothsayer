enum CurrentSessionChannel {
  Start = "current-session:start",
  Stop = "current-session:stop",
  IsActive = "current-session:is-active",
  Get = "current-session:get",
  Info = "current-session:info",
  // Move to SessionsService
  GetAll = "current-session:get-all",
  GetById = "current-session:get-by-id",
  GetTimeline = "current-session:get-timeline",
  UpdateCardPriceVisibility = "current-session:update-card-price-visibility",
  StateChanged = "current-session:state-changed",
  TimelineDelta = "current-session:timeline-delta",
  CardDelta = "current-session:card-delta",
  DataUpdated = "session:data-updated",
}

export { CurrentSessionChannel };
