enum SessionsChannel {
  GetAll = "sessions:get-all",
  GetById = "sessions:get-by-id",
  SearchByCard = "sessions:search-by-card",
  GetMostProfitable = "sessions:get-most-profitable",
  GetLongestSession = "sessions:get-longest-session",
  GetMostDecksOpened = "sessions:get-most-decks-opened",
  GetBiggestLetdown = "sessions:get-biggest-letdown",
  GetLuckyBreak = "sessions:get-lucky-break",
  GetTotalDecksOpened = "sessions:get-total-decks-opened",
  GetSessionAverages = "sessions:get-session-averages",
  GetTotalNetProfit = "sessions:get-total-net-profit",
  GetStackedDeckCardCount = "sessions:get-stacked-deck-card-count",
  GetStackedDeckCardNames = "sessions:get-stacked-deck-card-names",
  GetUncollectedCardNames = "sessions:get-uncollected-card-names",
  GetChartData = "sessions:get-chart-data",
  GetTotalTimeSpent = "sessions:get-total-time-spent",
  GetWinRate = "sessions:get-win-rate",
  GetSparklines = "sessions:get-sparklines",
  GetCardPoolBreakdown = "sessions:get-card-pool-breakdown",
}

export { SessionsChannel };
