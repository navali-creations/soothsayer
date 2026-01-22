enum AppSetupChannel {
  // Setup state
  GetSetupState = "app-setup:get-state",
  IsSetupComplete = "app-setup:is-complete",

  // Step navigation
  AdvanceStep = "app-setup:advance-step",
  GoToStep = "app-setup:go-to-step",

  // Step validation
  ValidateCurrentStep = "app-setup:validate-current-step",

  // Complete setup
  CompleteSetup = "app-setup:complete",
  ResetSetup = "app-setup:reset",
  SkipSetup = "app-setup:skip",
}

export { AppSetupChannel };
