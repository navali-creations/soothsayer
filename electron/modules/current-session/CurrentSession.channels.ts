enum CurrentSessionChannel {
  Start = "current-session:start",
  Stop = "current-session:stop",
  IsActive = "current-session:is-active",
  Get = "current-session:get",
  Info = "current-session:info",
  // Move to SessionsService
  GetAll = "current-session:get-all",
  GetById = "current-session:get-by-id",
  UpdateCardPriceVisibility = "current-session:update-card-price-visibility",
  StateChanged = "current-session:state-changed",
}

export { CurrentSessionChannel };
