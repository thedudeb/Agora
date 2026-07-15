/* Agora runtime event wiring. Loaded after app.js so shared declarations stay global. */
document.addEventListener("click", (event) => {
  const toastDismissButton = event.target.closest("[data-toast-dismiss]");
  if (toastDismissButton) {
    dismissToast(toastDismissButton.dataset.toastDismiss);
    return;
  }

  const searchResult = event.target.closest("[data-search-route]");
  if (searchResult) {
    openSearchResult(searchResult);
    return;
  }

  if (!event.target.closest(".search-control") && !event.target.closest("#search-results") && els.searchResults) {
    els.searchResults.hidden = true;
    els.searchInput?.setAttribute("aria-expanded", "false");
  }

  const sidebarToggle = event.target.closest("[data-sidebar-toggle]");
  if (sidebarToggle) {
    const groupId = sidebarToggle.dataset.sidebarToggle;
    sidebarState[groupId] = !sidebarState[groupId];
    saveSidebarState();
    renderSidebarGroups();
    return;
  }

  const settingsTabButton = event.target.closest("[data-settings-tab]");
  if (settingsTabButton && !settingsTabButton.disabled) {
    state.selectedSettingsTab = settingsTabFallback(settingsTabButton.dataset.settingsTab);
    saveState();
    render();
    if (state.selectedSettingsTab === "security") maybeRefreshApiSessionsForSecurity();
    return;
  }

  const openSettingsTabButton = event.target.closest("[data-open-settings-tab]");
  if (openSettingsTabButton) {
    state.selectedRoute = "settings";
    state.selectedSettingsTab = settingsTabFallback(openSettingsTabButton.dataset.openSettingsTab);
    openSidebarGroupForRoute("settings");
    saveState();
    render();
    if (state.selectedSettingsTab === "security") maybeRefreshApiSessionsForSecurity();
    return;
  }

  const pluginToggleButton = event.target.closest("[data-plugin-toggle]");
  if (pluginToggleButton && !pluginToggleButton.disabled) {
    togglePluginEnabled(pluginToggleButton.dataset.pluginToggle);
    return;
  }

  const trustModeToggleButton = event.target.closest("[data-trust-mode-toggle]");
  if (trustModeToggleButton) {
    toggleTrustMode();
    return;
  }

  const onboardingActionButton = event.target.closest("[data-onboarding-action]");
  if (onboardingActionButton) {
    handleOnboardingAction(onboardingActionButton.dataset.onboardingAction);
    return;
  }

  const betaWalkthroughButton = event.target.closest("[data-beta-walkthrough-action]");
  if (betaWalkthroughButton) {
    handleBetaWalkthroughAction(betaWalkthroughButton.dataset.betaWalkthroughAction);
    return;
  }

  const betaExportButton = event.target.closest("[data-beta-export-action]");
  if (betaExportButton) {
    handleBetaExportAction(betaExportButton.dataset.betaExportAction);
    return;
  }

  const evaluationActionButton = event.target.closest("[data-evaluation-action]");
  if (evaluationActionButton) {
    handleEvaluationAction(evaluationActionButton.dataset.evaluationAction);
    return;
  }

  const evaluationScoreButton = event.target.closest("[data-evaluation-score]");
  if (evaluationScoreButton) {
    setEvaluationScorecardStatus(evaluationScoreButton.dataset.evaluationScore, evaluationScoreButton.dataset.evaluationStatus);
    return;
  }

  const evaluateStartButton = event.target.closest("#evaluate-start");
  if (evaluateStartButton) {
    handleFirstTenAction("start");
    return;
  }

  const evaluateRestartDemoButton = event.target.closest("#evaluate-restart-demo");
  if (evaluateRestartDemoButton) {
    restartEvaluationDemo();
    return;
  }

  const evaluateResetScorecardButton = event.target.closest("#evaluate-reset-scorecard");
  if (evaluateResetScorecardButton) {
    resetEvaluationScorecard();
    return;
  }

  const evaluateCopyLinkButton = event.target.closest("#evaluate-copy-link");
  if (evaluateCopyLinkButton) {
    handleEvaluationAction("copy-link");
    return;
  }

  const demoReceiptActionButton = event.target.closest("[data-demo-receipt-action]");
  if (demoReceiptActionButton) {
    handleDemoReceiptAction(demoReceiptActionButton.dataset.demoReceiptAction);
    return;
  }

  const firstTenActionButton = event.target.closest("[data-first-ten-action]");
  if (firstTenActionButton) {
    handleFirstTenAction(firstTenActionButton.dataset.firstTenAction);
    return;
  }

  const onboardingStepButton = event.target.closest("[data-onboarding-step]");
  if (onboardingStepButton) {
    openOnboardingWizard(Number(onboardingStepButton.dataset.onboardingStep));
    return;
  }

  const onboardingInlineButton = event.target.closest("[data-onboarding-inline]");
  if (onboardingInlineButton) {
    handleOnboardingInlineAction(onboardingInlineButton.dataset.onboardingInline);
    return;
  }

  const projectLaunchStyleButton = event.target.closest("[data-project-launch-style]");
  if (projectLaunchStyleButton) {
    setProjectLaunchChoice("style", projectLaunchStyleButton.dataset.projectLaunchStyle);
    return;
  }

  const projectLaunchSourceButton = event.target.closest("[data-project-launch-source]");
  if (projectLaunchSourceButton) {
    setProjectLaunchChoice("source", projectLaunchSourceButton.dataset.projectLaunchSource);
    return;
  }

  const projectLaunchCreateButton = event.target.closest("#project-launch-create");
  if (projectLaunchCreateButton) {
    applyProjectLaunchWizard();
    return;
  }

  const tutorialActionButton = event.target.closest("[data-tutorial-action]");
  if (tutorialActionButton) {
    handleTutorialAction(tutorialActionButton.dataset.tutorialAction);
    return;
  }

  const commandButton = event.target.closest("[data-command-id]");
  if (commandButton) {
    executeCommand(commandButton.dataset.commandId);
    return;
  }

  const openCommandPaletteButton = event.target.closest("#open-command-palette");
  if (openCommandPaletteButton) {
    openCommandPalette();
    return;
  }

  const portfolioActionButton = event.target.closest("[data-portfolio-action]");
  if (portfolioActionButton) {
    handlePortfolioDecision(portfolioActionButton.dataset.portfolioProject, portfolioActionButton.dataset.portfolioAction);
    return;
  }

  const autopilotApplyButton = event.target.closest("[data-autopilot-apply]");
  if (autopilotApplyButton) {
    applyAutopilotScenario(autopilotApplyButton.dataset.autopilotApply);
    return;
  }

  const autopilotUndoButton = event.target.closest("[data-autopilot-undo]");
  if (autopilotUndoButton) {
    undoAutopilotScenario(autopilotUndoButton.dataset.autopilotUndo);
    return;
  }

  const autopilotRejectButton = event.target.closest("[data-autopilot-reject]");
  if (autopilotRejectButton) {
    rejectAutopilotScenario(autopilotRejectButton.dataset.autopilotReject);
    return;
  }

  const autopilotLoopQueueButton = event.target.closest("[data-autopilot-loop-queue]");
  if (autopilotLoopQueueButton) {
    const queued = queueAutopilotLoopAction(autopilotLoopQueueButton.dataset.autopilotLoopQueue);
    if (queued) {
      saveState();
      render();
      showToast("PM Autopilot loop queued for review", "success");
    }
    return;
  }

  const autopilotQueueTopLoopsButton = event.target.closest("#autopilot-queue-top-loops");
  if (autopilotQueueTopLoopsButton) {
    queueTopAutopilotLoops();
    return;
  }

  const portfolioRebalanceButton = event.target.closest("[data-portfolio-rebalance]");
  if (portfolioRebalanceButton) {
    const projectId = portfolioRebalanceButton.dataset.portfolioRebalance === "manual"
      ? document.querySelector("#portfolio-rebalance-project")?.value || ""
      : portfolioRebalanceButton.dataset.portfolioRebalance;
    const memberId = portfolioRebalanceButton.dataset.portfolioRebalance === "manual"
      ? document.querySelector("#portfolio-rebalance-member")?.value || ""
      : "";
    rebalancePortfolioProject(projectId, memberId);
    return;
  }

  const routeButton = event.target.closest("[data-route]");
  if (routeButton) setRoute(routeButton.dataset.route);

  const memoryCaptureButton = event.target.closest("#memory-capture-save");
  if (memoryCaptureButton) {
    captureProjectUpdate();
    return;
  }

  const memoryPreviewButton = event.target.closest("[data-memory-preview]");
  if (memoryPreviewButton) {
    previewProjectUpdateExtraction(memoryPreviewButton.dataset.memoryPreview);
    return;
  }

  const memoryReviewButton = event.target.closest("[data-memory-review]");
  if (memoryReviewButton) {
    reviewExtractionProposal(
      memoryReviewButton.dataset.memoryPreviewId,
      memoryReviewButton.dataset.memoryProposalId,
      memoryReviewButton.dataset.memoryReview
    );
    return;
  }

  const memoryApplyButton = event.target.closest("[data-memory-apply]");
  if (memoryApplyButton) {
    applyExtractionProposal(memoryApplyButton.dataset.memoryApply, memoryApplyButton.dataset.memoryProposalId);
    return;
  }

  const memoryContractCopyButton = event.target.closest("#memory-contract-copy");
  if (memoryContractCopyButton) {
    copyProjectMemoryIngestionContract().catch(() => showToast("Could not copy ingestion contract", "info"));
    return;
  }

  const projectBacklogPromoteButton = event.target.closest("[data-promote-project-backlog]");
  if (projectBacklogPromoteButton) {
    promoteProjectBacklogItem(projectBacklogPromoteButton.dataset.promoteProjectBacklog);
    return;
  }

  const sprintAddTaskButton = event.target.closest("[data-sprint-add-task]");
  if (sprintAddTaskButton) {
    addTaskToSprint(sprintAddTaskButton.dataset.sprintAddTask);
    return;
  }

  const sprintRemoveTaskButton = event.target.closest("[data-sprint-remove-task]");
  if (sprintRemoveTaskButton) {
    removeTaskFromSprint(sprintRemoveTaskButton.dataset.sprintRemoveTask);
    return;
  }

  const scrumMasterBriefButton = event.target.closest("[data-scrum-master-copy-brief]");
  if (scrumMasterBriefButton) {
    copyScrumMasterBrief();
    return;
  }

  const scrumMasterNoteButton = event.target.closest("[data-scrum-master-note]");
  if (scrumMasterNoteButton) {
    postScrumMasterTaskNote(scrumMasterNoteButton.dataset.scrumMasterNote);
    return;
  }

  const sprintRoadmapMoveButton = event.target.closest("[data-sprint-roadmap-move]");
  if (sprintRoadmapMoveButton) {
    moveTaskToRoadmapSprint(
      sprintRoadmapMoveButton.dataset.sprintRoadmapMove,
      sprintRoadmapMoveButton.dataset.sprintRoadmapTarget
    );
    return;
  }

  const sprintScenarioButton = event.target.closest("[data-sprint-scenario]");
  if (sprintScenarioButton) {
    applySprintScenario(sprintScenarioButton.dataset.sprintScenario);
    return;
  }

  const sprintSyncCopyButton = event.target.closest("[data-sprint-sync-copy]");
  if (sprintSyncCopyButton) {
    copySprintSyncPayload(sprintSyncCopyButton.dataset.sprintSyncCopy);
    return;
  }

  const sprintSyncMarkButton = event.target.closest("[data-sprint-sync-mark]");
  if (sprintSyncMarkButton) {
    markSprintSyncProviderSynced(sprintSyncMarkButton.dataset.sprintSyncMark);
    return;
  }

  const sprintReportCopyButton = event.target.closest("[data-sprint-report-copy]");
  if (sprintReportCopyButton) {
    copySprintReportMarkdown();
    return;
  }

  const sprintReportDownloadButton = event.target.closest("[data-sprint-report-download]");
  if (sprintReportDownloadButton) {
    downloadSprintReportJson();
    return;
  }

  const sprintClosePreviewButton = event.target.closest("[data-sprint-close-preview]");
  if (sprintClosePreviewButton) {
    setSprintClosePreview(true);
    return;
  }

  const sprintCloseConfirmButton = event.target.closest("[data-sprint-close-confirm]");
  if (sprintCloseConfirmButton) {
    closeCurrentSprint();
    return;
  }

  const sprintCloseUndoButton = event.target.closest("[data-sprint-close-undo]");
  if (sprintCloseUndoButton) {
    undoLastSprintClose();
    return;
  }

  const sprintRoadmapDeleteButton = event.target.closest("[data-sprint-roadmap-delete]");
  if (sprintRoadmapDeleteButton) {
    deleteRoadmapSprint(sprintRoadmapDeleteButton.dataset.sprintRoadmapDelete);
    return;
  }

  const sprintAutomationEnableButton = event.target.closest("[data-sprint-automation-enable]");
  if (sprintAutomationEnableButton) {
    enableSprintAutomation(sprintAutomationEnableButton.dataset.sprintAutomationEnable);
    return;
  }

  const sprintAutomationPresetButton = event.target.closest("[data-sprint-automation-preset]");
  if (sprintAutomationPresetButton) {
    installSprintAutomationPreset(sprintAutomationPresetButton.dataset.sprintAutomationPreset);
    return;
  }

  const sprintAutomationRunButton = event.target.closest("[data-sprint-automation-run]");
  if (sprintAutomationRunButton) {
    runEnabledSprintAutomations();
    return;
  }

  const openProjectButton = event.target.closest("[data-open-project]");
  if (openProjectButton) {
    openProjectFromBacklog(openProjectButton.dataset.openProject);
    return;
  }

  const createDocButton = event.target.closest("#doc-create");
  if (createDocButton) createDocument();

  const createFileButton = event.target.closest("#file-create");
  if (createFileButton) createFileRecord();

  const downloadFileButton = event.target.closest("[data-file-download]");
  if (downloadFileButton) {
    downloadFileFromApi(downloadFileButton.dataset.fileDownload);
    return;
  }

  const submitIntakeButton = event.target.closest("[data-submit-intake]");
  if (submitIntakeButton) submitIntakeRequest(submitIntakeButton.dataset.submitIntake);

  const copyFeatureLinkButton = event.target.closest("[data-copy-feature-request-link]");
  if (copyFeatureLinkButton) {
    copyFeatureRequestLink();
    return;
  }

  const promoteChatDecisionButton = event.target.closest("[data-promote-chat-decision]");
  if (promoteChatDecisionButton) {
    promoteChatMessageToDecision(promoteChatDecisionButton.dataset.promoteChatDecision);
    return;
  }

  const promoteWhiteboardDecisionButton = event.target.closest("[data-promote-whiteboard-decision]");
  if (promoteWhiteboardDecisionButton) {
    promoteWhiteboardItemToDecision(promoteWhiteboardDecisionButton.dataset.promoteWhiteboardDecision);
    return;
  }

  const inlineFeatureButton = event.target.closest("#feature-request-button-inline");
  if (inlineFeatureButton) {
    openFeatureRequestDialog();
    return;
  }

  const featureUpdateButton = event.target.closest("[data-feature-email-update]");
  if (featureUpdateButton) {
    sendFeatureRequestUpdate(featureUpdateButton.dataset.featureEmailUpdate);
    return;
  }

  const convertSubmissionButton = event.target.closest("[data-convert-submission]");
  if (convertSubmissionButton) convertSubmissionToTask(convertSubmissionButton.dataset.convertSubmission);

  const createFieldButton = event.target.closest("#field-create");
  if (createFieldButton) createCustomField();

  const copyStatusReportButton = event.target.closest("#copy-status-report");
  if (copyStatusReportButton) copyStatusReport();

  const copyPortalPacketButton = event.target.closest("[data-copy-portal-packet]");
  if (copyPortalPacketButton) {
    copyPortalSharePacket(copyPortalPacketButton.dataset.copyPortalPacket);
    return;
  }

  const emailPortalPacketButton = event.target.closest("[data-email-portal-packet]");
  if (emailPortalPacketButton) {
    emailPortalSharePacket(emailPortalPacketButton.dataset.emailPortalPacket);
    return;
  }

  const generatePortalLinkButton = event.target.closest("[data-generate-portal-link]");
  if (generatePortalLinkButton) {
    generateClientPortalLink(generatePortalLinkButton.dataset.generatePortalLink);
    return;
  }

  const copyPortalLinkButton = event.target.closest("[data-copy-portal-link]");
  if (copyPortalLinkButton) {
    copyClientPortalLink(copyPortalLinkButton.dataset.copyPortalLink);
    return;
  }

  const emailPortalLinkButton = event.target.closest("[data-email-portal-link]");
  if (emailPortalLinkButton) {
    emailClientPortalLink(emailPortalLinkButton.dataset.emailPortalLink);
    return;
  }

  const rotatePortalLinkButton = event.target.closest("[data-rotate-portal-link]");
  if (rotatePortalLinkButton) {
    generateClientPortalLink(rotatePortalLinkButton.dataset.rotatePortalLink, { rotate: true });
    return;
  }

  const revokePortalLinkButton = event.target.closest("[data-revoke-portal-link]");
  if (revokePortalLinkButton) {
    revokeClientPortalLink(revokePortalLinkButton.dataset.revokePortalLink);
    return;
  }

  const dashboardSaveLayoutButton = event.target.closest("#dashboard-save-layout");
  if (dashboardSaveLayoutButton) {
    saveDashboardLayout();
    return;
  }

  const dashboardSaveNamedLayoutButton = event.target.closest("#dashboard-save-named-layout");
  if (dashboardSaveNamedLayoutButton) {
    saveNamedDashboardLayout();
    return;
  }

  const dashboardApplyLayoutButton = event.target.closest("#dashboard-apply-layout");
  if (dashboardApplyLayoutButton) {
    applyDashboardLayout();
    return;
  }

  const chatSendButton = event.target.closest("#chat-send");
  if (chatSendButton) {
    sendWorkspaceChatMessage();
    return;
  }

  const whiteboardAddButton = event.target.closest("#whiteboard-add-note");
  if (whiteboardAddButton) {
    addWhiteboardNote();
    return;
  }

  const installMarketplaceTemplateButton = event.target.closest("[data-install-marketplace-template]");
  if (installMarketplaceTemplateButton) {
    installMarketplaceTemplate(installMarketplaceTemplateButton.dataset.installMarketplaceTemplate);
    return;
  }

  const grantTemplateEntitlementButton = event.target.closest("[data-grant-template-entitlement]");
  if (grantTemplateEntitlementButton) {
    grantMarketplaceTemplateEntitlement(grantTemplateEntitlementButton.dataset.grantTemplateEntitlement, "test");
    return;
  }

  const exportMarketplaceTemplateButton = event.target.closest("[data-export-marketplace-template]");
  if (exportMarketplaceTemplateButton) {
    downloadProjectTemplate(exportMarketplaceTemplateButton.dataset.exportMarketplaceTemplate);
    return;
  }

  const exportProjectTemplateButton = event.target.closest("[data-export-project-template]");
  if (exportProjectTemplateButton) {
    downloadProjectTemplate(exportProjectTemplateButton.dataset.exportProjectTemplate);
    return;
  }

  const importTemplateButton = event.target.closest("#template-import-button");
  if (importTemplateButton) {
    importProjectTemplateFromTextarea();
    return;
  }

  const previewTemplateImportButton = event.target.closest("#template-import-preview");
  if (previewTemplateImportButton) {
    previewProjectTemplateImportPayload();
    return;
  }

  const templateCategoryButton = event.target.closest("[data-template-category]");
  if (templateCategoryButton) {
    state.templateLibrary = {
      ...(state.templateLibrary || {}),
      category: templateCategoryButton.dataset.templateCategory || "all",
      selectedProjectTemplateId: ""
    };
    saveState();
    render();
    return;
  }

  const previewProjectTemplateButton = event.target.closest("[data-preview-project-template]");
  if (previewProjectTemplateButton) {
    state.templateLibrary = {
      ...(state.templateLibrary || {}),
      selectedProjectTemplateId: previewProjectTemplateButton.dataset.previewProjectTemplate
    };
    saveState();
    render();
    return;
  }

  const templatePreviewCreateButton = event.target.closest("#template-preview-create");
  if (templatePreviewCreateButton) {
    createProjectFromPreview();
    return;
  }

  const useProjectTemplateButton = event.target.closest("[data-use-project-template]");
  if (useProjectTemplateButton) {
    createProjectTemplateFromButton(useProjectTemplateButton);
    return;
  }

  const useTaskTemplateButton = event.target.closest("[data-use-task-template]");
  if (useTaskTemplateButton) {
    createTaskTemplateFromButton(useTaskTemplateButton);
    return;
  }

  const createProjectTemplateButton = event.target.closest("#project-template-create");
  if (createProjectTemplateButton) {
    saveProjectAsTemplate();
    return;
  }

  const createTaskTemplateButton = event.target.closest("#task-template-create");
  if (createTaskTemplateButton) {
    saveTaskAsTemplate();
    return;
  }

  const deleteProjectTemplateButton = event.target.closest("[data-delete-project-template]");
  if (deleteProjectTemplateButton) {
    deleteProjectTemplate(deleteProjectTemplateButton.dataset.deleteProjectTemplate);
    return;
  }

  const deleteTaskTemplateButton = event.target.closest("[data-delete-task-template]");
  if (deleteTaskTemplateButton) {
    deleteTaskTemplate(deleteTaskTemplateButton.dataset.deleteTaskTemplate);
    return;
  }

  const templateSubmissionButton = event.target.closest("[data-template-submission]");
  if (templateSubmissionButton) createProjectFromSubmission(templateSubmissionButton.dataset.templateSubmission);

  const runAutomationButton = event.target.closest("[data-run-automation]");
  if (runAutomationButton) runAutomation(runAutomationButton.dataset.runAutomation);

  const rollbackAutomationButton = event.target.closest("[data-automation-rollback]");
  if (rollbackAutomationButton) {
    rollbackAutomationRun(rollbackAutomationButton.dataset.automationRollback);
    return;
  }

  const toggleAutomationButton = event.target.closest("[data-toggle-automation]");
  if (toggleAutomationButton) toggleAutomation(toggleAutomationButton.dataset.toggleAutomation);

  const installAutomationPackButton = event.target.closest("[data-install-automation-pack]");
  if (installAutomationPackButton) {
    installAutomationMarketplacePack(installAutomationPackButton.dataset.installAutomationPack);
    return;
  }

  const exportAutomationPackButton = event.target.closest("[data-export-automation-pack]");
  if (exportAutomationPackButton) {
    exportAutomationMarketplacePack(exportAutomationPackButton.dataset.exportAutomationPack);
    return;
  }

  const marketplaceApiPublishButton = event.target.closest("#marketplace-api-publish");
  if (marketplaceApiPublishButton) {
    publishMarketplaceCatalogToApi();
    return;
  }

  const marketplaceApiLoadButton = event.target.closest("#marketplace-api-load");
  if (marketplaceApiLoadButton) {
    loadMarketplaceCatalogFromApi();
    return;
  }

  const automationPackImportPreviewButton = event.target.closest("#automation-pack-import-preview");
  if (automationPackImportPreviewButton) {
    previewAutomationPackImportPayload();
    return;
  }

  const automationPackImportInstallButton = event.target.closest("#automation-pack-import-install");
  if (automationPackImportInstallButton) {
    installAutomationPackImportPayload();
    return;
  }

  const automationPackSelectAllButton = event.target.closest("#automation-pack-select-all");
  if (automationPackSelectAllButton) {
    setAutomationPackAuthorSelection(true);
    return;
  }

  const automationPackClearButton = event.target.closest("#automation-pack-clear-selection");
  if (automationPackClearButton) {
    setAutomationPackAuthorSelection(false);
    return;
  }

  const automationPackExportButton = event.target.closest("#automation-pack-export");
  if (automationPackExportButton) {
    exportAuthoredAutomationPack();
    return;
  }

  const saveAutomationButton = event.target.closest("#automation-create");
  if (saveAutomationButton) {
    saveAutomationRule();
    return;
  }

  const editAutomationButton = event.target.closest("[data-edit-automation]");
  if (editAutomationButton) {
    editAutomationRule(editAutomationButton.dataset.editAutomation);
    return;
  }

  const deleteAutomationButton = event.target.closest("[data-delete-automation]");
  if (deleteAutomationButton) {
    deleteAutomationRule(deleteAutomationButton.dataset.deleteAutomation);
    return;
  }

  const runAllAutomationsButton = event.target.closest("#automation-run-all");
  if (runAllAutomationsButton) runAllAutomations();

  const runServerAutomationsButton = event.target.closest("#automation-run-server");
  if (runServerAutomationsButton) runServerAutomations();

  const automationSuggestionButton = event.target.closest("[data-automation-suggestion]");
  if (automationSuggestionButton) logAutomationSuggestion(automationSuggestionButton.dataset.automationSuggestion);

  const generateTodayButton = event.target.closest("#ai-generate-today");
  if (generateTodayButton) {
    generateTodayPlan();
    return;
  }

  const workspaceBriefButton = event.target.closest("#ai-workspace-brief");
  if (workspaceBriefButton) {
    generateWorkspaceBrief();
    return;
  }

  const projectBriefButton = event.target.closest("[data-ai-project-brief]");
  if (projectBriefButton) {
    generateProjectBrief(projectBriefButton.dataset.aiProjectBrief);
    return;
  }

  const operatorActionButton = event.target.closest("[data-operator-action]");
  if (operatorActionButton) {
    runOperatorAction(operatorActionButton.dataset.operatorAction, operatorActionButton.dataset.operatorProject);
    return;
  }

  const agentReviewRefreshButton = event.target.closest("[data-agent-review-refresh]");
  if (agentReviewRefreshButton) {
    refreshOperatorReviewQueue();
    return;
  }

  const agentReviewApproveButton = event.target.closest("[data-agent-review-approve]");
  if (agentReviewApproveButton) {
    decideOperatorReviewItem(agentReviewApproveButton.dataset.agentReviewApprove, "approved");
    return;
  }

  const agentReviewRejectButton = event.target.closest("[data-agent-review-reject]");
  if (agentReviewRejectButton) {
    decideOperatorReviewItem(agentReviewRejectButton.dataset.agentReviewReject, "rejected");
    return;
  }

  const operatorCommandButton = event.target.closest("[data-operator-command]");
  if (operatorCommandButton) {
    runOperatorCommand(operatorCommandButton.dataset.operatorCommand);
    return;
  }

  const operatorApplyButton = event.target.closest("[data-operator-apply]");
  if (operatorApplyButton) {
    applyOperatorSuggestion(
      operatorApplyButton.dataset.operatorApply,
      operatorApplyButton.dataset.operatorProject,
      operatorApplyButton.dataset.operatorTask || "",
      operatorApplyButton.dataset.operatorApproval || "",
      operatorApplyButton.dataset.operatorCompany || ""
    );
    return;
  }

  const operatorUndoButton = event.target.closest("[data-operator-undo]");
  if (operatorUndoButton) {
    undoOperatorAction(operatorUndoButton.dataset.operatorUndo);
    return;
  }

  const approvalActionButton = event.target.closest("[data-approval-action]");
  if (approvalActionButton) {
    updateApprovalStatus(
      approvalActionButton.dataset.approvalId,
      approvalActionButton.dataset.approvalAction,
      approvalActionButton.dataset.inboxId || ""
    );
    return;
  }

  const hostedApprovalActionButton = event.target.closest("[data-hosted-approval-action]");
  if (hostedApprovalActionButton) {
    submitHostedApprovalAction(
      hostedApprovalActionButton.dataset.hostedApprovalId,
      hostedApprovalActionButton.dataset.hostedApprovalAction
    );
    return;
  }

  const companyUpdateButton = event.target.closest("[data-company-update]");
  if (companyUpdateButton) {
    draftCompanyUpdate(companyUpdateButton.dataset.companyUpdate);
    return;
  }

  const workspaceSaveButton = event.target.closest("#workspace-save");
  if (workspaceSaveButton) saveWorkspaceSettings();

  const aiSaveButton = event.target.closest("#ai-save-settings");
  if (aiSaveButton) {
    saveAiSettings();
    return;
  }

  const operatorContextExportButton = event.target.closest("#operator-context-export");
  if (operatorContextExportButton) {
    downloadOperatorContextBundle();
    return;
  }

  const operatorLocalModeButton = event.target.closest("#operator-local-mode");
  if (operatorLocalModeButton) {
    enableLocalOperatorMode();
    return;
  }

  const operatorPermissionPresetButton = event.target.closest("[data-operator-permission-preset]");
  if (operatorPermissionPresetButton) {
    applyOperatorPermissionPreset(operatorPermissionPresetButton.dataset.operatorPermissionPreset);
    return;
  }

  const operatorPermissionsSaveButton = event.target.closest("#operator-permissions-save");
  if (operatorPermissionsSaveButton) {
    saveOperatorPermissions();
    return;
  }

  const integrationsSaveButton = event.target.closest("#integrations-save");
  if (integrationsSaveButton) {
    saveIntegrationSettings();
    return;
  }

  const integrationTestButton = event.target.closest("#integration-test-event");
  if (integrationTestButton) {
    recordIntegrationTestEvent();
    return;
  }

  const githubCopySyncPayloadButton = event.target.closest("#github-copy-sync-payload");
  if (githubCopySyncPayloadButton) {
    copyGitHubSyncPayload();
    return;
  }

  const githubCopyWebhookUrlButton = event.target.closest("#github-copy-webhook-url");
  if (githubCopyWebhookUrlButton) {
    copyGitHubWebhookUrl();
    return;
  }

  const githubQueueSyncButton = event.target.closest("#github-queue-sync");
  if (githubQueueSyncButton && !githubQueueSyncButton.disabled) {
    queueGitHubIntegrationSync();
    return;
  }

  const githubSendTestEventButton = event.target.closest("#github-send-test-event");
  if (githubSendTestEventButton && !githubSendTestEventButton.disabled) {
    sendGitHubTestWebhookEvent();
    return;
  }

  const githubConflictResolutionButton = event.target.closest("[data-github-conflict-resolution]");
  if (githubConflictResolutionButton && !githubConflictResolutionButton.disabled) {
    resolveGitHubIntegrationConflict(githubConflictResolutionButton.dataset.githubConflictId, githubConflictResolutionButton.dataset.githubConflictResolution);
    return;
  }

  const paymentsSaveButton = event.target.closest("#payments-save");
  if (paymentsSaveButton) {
    savePaymentSettings();
    return;
  }

  const paymentGrantEntitlementButton = event.target.closest("#payment-grant-entitlement");
  if (paymentGrantEntitlementButton) {
    grantSelectedPaymentEntitlement();
    return;
  }

  const paymentTestButton = event.target.closest("#payment-test-event");
  if (paymentTestButton) {
    recordTestPaymentEvent();
    return;
  }

  const pwaInstallButton = event.target.closest("#pwa-install");
  if (pwaInstallButton) installPwa();

  const notificationRequestButton = event.target.closest("#notification-request");
  if (notificationRequestButton) requestNotificationPermission();

  const notificationTestButton = event.target.closest("#notification-test");
  if (notificationTestButton) sendTestNotification();

  const notificationSaveDeliveryButton = event.target.closest("#notification-save-delivery");
  if (notificationSaveDeliveryButton) {
    saveNotificationDeliverySettings();
    return;
  }

  const notificationTestEmailButton = event.target.closest("#notification-test-email");
  if (notificationTestEmailButton) {
    sendServerNotificationTestEmail();
    return;
  }

  const notificationReminderCheckButton = event.target.closest("#notification-reminder-check");
  if (notificationReminderCheckButton) {
    runNotificationReminderScheduler({ silent: false });
    return;
  }

  const notificationServerSchedulerButton = event.target.closest("#notification-server-scheduler");
  if (notificationServerSchedulerButton) {
    runServerNotificationScheduler();
    return;
  }

  const digestRunButton = event.target.closest("[data-digest-run]");
  if (digestRunButton) {
    runNotificationDigest(digestRunButton.dataset.digestRun);
    return;
  }

  const digestPayloadButton = event.target.closest("[data-digest-payload]");
  if (digestPayloadButton) {
    copyDigestPayload(digestPayloadButton.dataset.digestPayload).catch(() => showToast("Could not copy payload", "info"));
    return;
  }

  const importJsonButton = event.target.closest("#import-json");
  if (importJsonButton) importWorkspaceFromTextarea();

  const importJsonNewWorkspaceButton = event.target.closest("#import-json-new-workspace");
  if (importJsonNewWorkspaceButton) importWorkspaceAsNewFromTextarea();

  const portableImportPreviewButton = event.target.closest("#portable-import-preview");
  if (portableImportPreviewButton) {
    previewPortableImportPayload();
    return;
  }

  const portableImportNewButton = event.target.closest("#portable-import-new");
  if (portableImportNewButton) {
    importPortablePayload("new-workspace");
    return;
  }

  const portableImportReplaceButton = event.target.closest("#portable-import-replace");
  if (portableImportReplaceButton) {
    importPortablePayload("replace");
    return;
  }

  const switcherImportButton = event.target.closest("#switcher-import-button");
  if (switcherImportButton) {
    importSwitcherPayload();
    return;
  }
  const switcherPresetButton = event.target.closest("[data-switcher-preset]");
  if (switcherPresetButton) {
    selectSwitcherPreset(switcherPresetButton.dataset.switcherPreset);
    return;
  }

  const switcherSampleButton = event.target.closest("#switcher-sample-csv");
  if (switcherSampleButton) {
    copySwitcherSampleCsv();
    return;
  }

  const switcherSampleTrelloButton = event.target.closest("#switcher-sample-trello");
  if (switcherSampleTrelloButton) {
    copySwitcherSampleTrello();
    return;
  }

  const switcherApplyPreviewButton = event.target.closest("#switcher-apply-preview");
  if (switcherApplyPreviewButton) {
    applySwitcherImportPreview();
    return;
  }

  const switcherClearPreviewButton = event.target.closest("#switcher-clear-preview");
  if (switcherClearPreviewButton) {
    clearSwitcherImportPreview();
    return;
  }

  const refreshExportButton = event.target.closest("#refresh-export");
  if (refreshExportButton) renderDataManagement();

  const downloadExportButton = event.target.closest("#download-json-export");
  if (downloadExportButton) downloadWorkspaceExport();

  const downloadPortableBundleButton = event.target.closest("#download-portable-bundle");
  if (downloadPortableBundleButton) {
    downloadPortableWorkspaceBundle();
    return;
  }

  const recoveryActionButton = event.target.closest("[data-recovery-action]");
  if (recoveryActionButton) {
    if (recoveryActionButton.dataset.recoveryAction === "download-bundle") downloadPortableWorkspaceBundle();
    if (recoveryActionButton.dataset.recoveryAction === "create-backup") createWorkspaceBackup("Recovery plan checkpoint");
    if (recoveryActionButton.dataset.recoveryAction === "download-manifest") downloadPortableWorkspaceManifest();
    return;
  }

  const downloadPortableManifestButton = event.target.closest("#download-portable-manifest");
  if (downloadPortableManifestButton) {
    downloadPortableWorkspaceManifest();
    return;
  }

  const backupCreateButton = event.target.closest("#backup-create");
  if (backupCreateButton) createWorkspaceBackup();

  const portableBackupCreateButton = event.target.closest("#backup-create-from-portable");
  if (portableBackupCreateButton) createWorkspaceBackup("Portable bundle checkpoint");

  const backupRestoreButton = event.target.closest("[data-backup-restore]");
  if (backupRestoreButton) {
    restoreWorkspaceBackup(backupRestoreButton.dataset.backupRestore);
    return;
  }

  const backupDeleteButton = event.target.closest("[data-backup-delete]");
  if (backupDeleteButton) {
    deleteWorkspaceBackup(backupDeleteButton.dataset.backupDelete);
    return;
  }

  const apiConnectButton = event.target.closest("#api-connect");
  if (apiConnectButton) connectApiSession();

  const apiUrlSaveButton = event.target.closest("#api-url-save");
  if (apiUrlSaveButton) saveApiBaseUrl();

  const apiEmailLoginButton = event.target.closest("#api-email-login");
  if (apiEmailLoginButton) signInWithEmail();

  const apiPasswordSignupButton = event.target.closest("#api-password-signup");
  if (apiPasswordSignupButton) signUpWithPassword();

  const apiPasswordLoginButton = event.target.closest("#api-password-login");
  if (apiPasswordLoginButton) signInWithPassword();

  const apiSupabasePasswordSignupButton = event.target.closest("#api-supabase-password-signup");
  if (apiSupabasePasswordSignupButton) signUpWithSupabasePassword();

  const apiSupabasePasswordLoginButton = event.target.closest("#api-supabase-password-login");
  if (apiSupabasePasswordLoginButton) signInWithSupabasePassword();

  const apiPasswordChangeButton = event.target.closest("#api-password-change");
  if (apiPasswordChangeButton) changeApiPassword();

  const apiPasswordResetRequestButton = event.target.closest("#api-password-reset-request");
  if (apiPasswordResetRequestButton) requestApiPasswordReset();

  const apiPasswordResetConfirmButton = event.target.closest("#api-password-reset-confirm");
  if (apiPasswordResetConfirmButton) confirmApiPasswordReset();

  const apiSupabaseLoginButton = event.target.closest("#api-supabase-login");
  if (apiSupabaseLoginButton) signInWithSupabaseToken();

  const apiDisconnectButton = event.target.closest("#api-disconnect");
  if (apiDisconnectButton) disconnectApiSession();

  const localSessionClearButton = event.target.closest("#local-session-clear");
  if (localSessionClearButton) {
    disconnectApiSession();
    return;
  }

  const backendHealthRefreshButton = event.target.closest("[data-backend-health-refresh], #backend-health-refresh");
  if (backendHealthRefreshButton) {
    refreshBackendHealth();
    return;
  }

  const readinessExportButton = event.target.closest("[data-readiness-export]");
  if (readinessExportButton) {
    exportProductionReadinessReport(readinessExportButton.dataset.readinessExport);
    return;
  }

  const apiSessionsRefreshButton = event.target.closest("#api-sessions-refresh");
  if (apiSessionsRefreshButton) {
    refreshApiSessions();
    return;
  }

  const apiSessionRotateButton = event.target.closest("#api-session-rotate");
  if (apiSessionRotateButton) {
    rotateApiSession();
    return;
  }

  const apiSessionsRevokeOthersButton = event.target.closest("#api-sessions-revoke-others");
  if (apiSessionsRevokeOthersButton) {
    revokeOtherApiSessions();
    return;
  }

  const apiSessionRevokeButton = event.target.closest("[data-api-session-revoke]");
  if (apiSessionRevokeButton) {
    revokeApiSession(apiSessionRevokeButton.dataset.apiSessionRevoke);
    return;
  }

  const backendJobActionButton = event.target.closest("[data-backend-job-action]");
  if (backendJobActionButton) {
    runBackendJobAction(backendJobActionButton.dataset.backendJobId, backendJobActionButton.dataset.backendJobAction);
    return;
  }

  const serverBackupRunButton = event.target.closest("[data-server-backup-run]");
  if (serverBackupRunButton) {
    runServerWorkspaceBackup();
    return;
  }

  const adminDiagnosticsButton = event.target.closest("[data-admin-diagnostics]");
  if (adminDiagnosticsButton) {
    exportAdminDiagnostics(adminDiagnosticsButton.dataset.adminDiagnostics);
    return;
  }

  const auditRefreshButton = event.target.closest("#audit-refresh");
  if (auditRefreshButton) {
    loadAuditLogFromApi();
    return;
  }

  const auditEvidenceExportButton = event.target.closest("#audit-evidence-export");
  if (auditEvidenceExportButton) {
    downloadAuditEvidencePack();
    return;
  }

  const auditSavedViewButton = event.target.closest("[data-audit-saved-view]");
  if (auditSavedViewButton) {
    auditFilters = {
      ...auditFilters,
      savedView: auditSavedViewButton.dataset.auditSavedView || "all"
    };
    selectedAuditEventKey = "";
    renderAuditLog();
    return;
  }

  const auditClearFiltersButton = event.target.closest("#audit-clear-filters");
  if (auditClearFiltersButton) {
    auditFilters = {
      query: "",
      actor: "all",
      action: "all",
      impact: "all",
      source: "all",
      project: "all",
      date: "all",
      savedView: "all"
    };
    selectedAuditEventKey = "";
    renderAuditLog();
    return;
  }

  const auditDetailButton = event.target.closest("[data-audit-detail]");
  if (auditDetailButton) {
    selectedAuditEventKey = auditDetailButton.dataset.auditDetail || "";
    renderAuditLog();
    return;
  }

  const auditDetailCloseButton = event.target.closest("[data-audit-detail-close]");
  if (auditDetailCloseButton) {
    selectedAuditEventKey = "";
    renderAuditLog();
    return;
  }

  const releaseSelectButton = event.target.closest("[data-release-select]");
  if (releaseSelectButton) {
    state.selectedReleaseId = releaseSelectButton.dataset.releaseSelect || "";
    saveState();
    renderReleaseManagement();
    return;
  }

  const releaseNotesGenerateButton = event.target.closest("[data-release-notes-generate]");
  if (releaseNotesGenerateButton) {
    generateReleaseNotes(releaseNotesGenerateButton.dataset.releaseNotesGenerate);
    return;
  }

  const releaseNotesDownloadButton = event.target.closest("[data-release-notes-download]");
  if (releaseNotesDownloadButton) {
    downloadReleaseNotes(releaseNotesDownloadButton.dataset.releaseNotesDownload);
    return;
  }

  const releaseEvidenceExportButton = event.target.closest("#release-evidence-export");
  if (releaseEvidenceExportButton) {
    const release = selectedReleaseRecord(releaseProjectCandidates());
    if (release) downloadReleaseEvidencePack(release.id);
    return;
  }

  const releasePacketExportButton = event.target.closest("#release-packet-export, #release-packet-export-inline");
  if (releasePacketExportButton) {
    downloadReleaseReadinessPacket();
    return;
  }

  const clientVisibilityPreviewButton = event.target.closest("#client-visibility-preview, [data-preview-client-company]");
  if (clientVisibilityPreviewButton) {
    startClientPortalPreview(clientVisibilityPreviewButton.dataset.previewClientCompany || selectedVisibilityReviewCompanyId());
    return;
  }

  const clientPreviewExitButton = event.target.closest("[data-client-preview-exit]");
  if (clientPreviewExitButton) {
    exitClientPortalPreview();
    return;
  }

  const clientLinkExitButton = event.target.closest("[data-client-link-exit]");
  if (clientLinkExitButton) {
    exitClientPortalLinkSession();
    return;
  }

  const apiSyncRetryButton = event.target.closest("#api-sync-retry");
  if (apiSyncRetryButton) {
    retryApiSyncQueue();
    return;
  }

  const apiSyncCopySupportButton = event.target.closest("#api-sync-copy-support");
  if (apiSyncCopySupportButton) {
    copyApiSyncSupportDetails();
    return;
  }

  const syncItemActionButton = event.target.closest("[data-sync-item-action]");
  if (syncItemActionButton) {
    const action = syncItemActionButton.dataset.syncItemAction;
    const itemId = syncItemActionButton.dataset.syncId || "";
    if (action === "retry") retryApiSyncQueueItem(itemId);
    if (action === "dismiss") dismissApiSyncQueueItem(itemId);
    if (action === "copy") copyApiSyncSupportDetails(itemId);
    if (action === "open") openApiSyncQueueTarget(itemId);
    return;
  }

  const syncConflictButton = event.target.closest("[data-sync-conflict]");
  if (syncConflictButton) {
    resolveApiSyncConflict(syncConflictButton.dataset.syncId, syncConflictButton.dataset.syncConflict);
    return;
  }

  const inviteMemberButton = event.target.closest("#invite-member");
  if (inviteMemberButton) inviteWorkspaceMember();

  const inviteResendButton = event.target.closest("[data-invite-resend]");
  if (inviteResendButton) {
    resendWorkspaceInvite(inviteResendButton.dataset.inviteResend);
    return;
  }

  const inviteRevokeButton = event.target.closest("[data-invite-revoke]");
  if (inviteRevokeButton) {
    revokeWorkspaceInvite(inviteRevokeButton.dataset.inviteRevoke);
    return;
  }

  const acceptInviteButton = event.target.closest("#invite-accept");
  if (acceptInviteButton) acceptWorkspaceInvite();

  const apiSaveButton = event.target.closest("#api-save-workspace");
  if (apiSaveButton) saveWorkspaceToApi();

  const apiLoadButton = event.target.closest("#api-load-workspace");
  if (apiLoadButton) loadWorkspaceFromApi();

  const apiRestoreSnapshotButton = event.target.closest("#api-restore-workspace-snapshot");
  if (apiRestoreSnapshotButton) restoreWorkspaceSnapshotFromApi();

  const apiImportButton = event.target.closest("#api-import-workspace");
  if (apiImportButton) importWorkspaceToApi();

  const switcherRollbackButton = event.target.closest("#switcher-rollback-import");
  if (switcherRollbackButton) {
    rollbackLastSwitcherImport();
    return;
  }

  const taskPlanTodayButton = event.target.closest("[data-task-plan-today]");
  if (taskPlanTodayButton) {
    planTaskToday(taskPlanTodayButton.dataset.taskPlanToday);
    return;
  }

  const taskCompleteButton = event.target.closest("[data-task-complete]");
  if (taskCompleteButton) {
    completeTask(taskCompleteButton.dataset.taskComplete);
    return;
  }

  const archiveProjectButton = event.target.closest("[data-archive-project]");
  if (archiveProjectButton) {
    archiveProject(archiveProjectButton.dataset.archiveProject);
    return;
  }

  const editProjectButton = event.target.closest("[data-edit-project]");
  if (editProjectButton) {
    const project = byId(state.projects, editProjectButton.dataset.editProject);
    if (project) {
      populateProjectForm(project);
      openDialog(els.projectDialog);
    }
    return;
  }

  const duplicateProjectButton = event.target.closest("[data-duplicate-project]");
  if (duplicateProjectButton) {
    duplicateProject(duplicateProjectButton.dataset.duplicateProject);
    return;
  }

  const archiveTaskButton = event.target.closest("[data-archive-task]");
  if (archiveTaskButton) {
    archiveTask(archiveTaskButton.dataset.archiveTask);
    return;
  }

  const projectButton = event.target.closest("[data-project-id]");
  if (projectButton) setProject(projectButton.dataset.projectId);

  const companyButton = event.target.closest("[data-company-id]");
  if (companyButton) setCompany(companyButton.dataset.companyId);

  const newCompanyButton = event.target.closest("#new-company-button");
  if (newCompanyButton) {
    if (!canWrite("projects:write")) {
      showToast("Your role cannot manage companies", "info");
      return;
    }
    populateCompanyForm();
    openDialog(els.companyDialog);
  }

  const newProjectTaskButton = event.target.closest("#new-task-button-project");
  if (newProjectTaskButton) {
    if (!canWrite("tasks:write")) {
      showToast("Your role cannot create tasks", "info");
      return;
    }
    populateTaskForm();
    openDialog(els.taskDialog);
  }

  const editCompanyButton = event.target.closest("[data-edit-company]");
  if (editCompanyButton) {
    if (!canWrite("projects:write")) {
      showToast("Your role cannot edit companies", "info");
      return;
    }
    populateCompanyForm(byId(state.companies, editCompanyButton.dataset.editCompany));
    openDialog(els.companyDialog);
  }

  const subtaskButton = event.target.closest("#subtask-submit");
  if (subtaskButton) addDraftSubtask();

  const deleteSubtaskButton = event.target.closest("[data-delete-subtask]");
  if (deleteSubtaskButton) deleteDraftSubtask(deleteSubtaskButton.dataset.deleteSubtask);

  const previousMonthButton = event.target.closest("[data-calendar-shift]");
  if (previousMonthButton) {
    state.selectedCalendarMonth = shiftMonth(state.selectedCalendarMonth, Number(previousMonthButton.dataset.calendarShift));
    saveState();
    render();
  }

  const todayButton = event.target.closest("[data-calendar-today]");
  if (todayButton) {
    state.selectedCalendarMonth = new Date().toISOString().slice(0, 7);
    saveState();
    render();
  }

  const dailyPlanButton = event.target.closest("[data-daily-plan]");
  if (dailyPlanButton) {
    planTaskForDate(dailyPlanButton.dataset.taskId, dailyPlanButton.dataset.dailyPlan);
    saveState();
    render();
    showToast("Task planned for Today", "success");
  }

  const boardMoveButton = event.target.closest("[data-board-move]");
  if (boardMoveButton) {
    moveTaskOnBoard(boardMoveButton.dataset.boardMove, boardMoveButton.dataset.boardMoveStatus);
    return;
  }

  const boardUndoButton = event.target.closest("[data-board-undo]");
  if (boardUndoButton) {
    undoBoardAction();
    return;
  }

  const boardSelectButton = event.target.closest("[data-board-select]");
  if (boardSelectButton) {
    selectBoardTask(boardSelectButton.dataset.boardSelect);
    return;
  }

  const boardPromoteButton = event.target.closest("[data-board-promote]");
  if (boardPromoteButton) {
    promoteBoardBacklogTask(boardPromoteButton.dataset.boardPromote);
    return;
  }

  const boardBacklogButton = event.target.closest("[data-board-backlog]");
  if (boardBacklogButton) {
    sendTaskToBoardBacklog(boardBacklogButton.dataset.boardBacklog);
    return;
  }

  const boardMobileButton = event.target.closest("[data-board-mobile-column]");
  if (boardMobileButton) {
    setBoardMobileColumn(boardMobileButton.dataset.boardMobileColumn);
    return;
  }

  const boardSaveViewButton = event.target.closest("[data-board-save-view]");
  if (boardSaveViewButton) {
    saveBoardViewFromControls();
    return;
  }

  const boardDeleteViewButton = event.target.closest("[data-board-delete-view]");
  if (boardDeleteViewButton) {
    deleteBoardViewFromControls(boardDeleteViewButton.dataset.boardDeleteView);
    return;
  }

  const boardAutomationSaveButton = event.target.closest("[data-board-automation-save]");
  if (boardAutomationSaveButton) {
    saveBoardAutomationRuleFromControls();
    return;
  }

  const boardAutomationPresetButton = event.target.closest("[data-board-automation-preset]");
  if (boardAutomationPresetButton) {
    saveBoardAutomationRuleFromControls(boardAutomationPresetButton.dataset.boardAutomationPreset);
    return;
  }

  const boardTemplateCreateButton = event.target.closest("[data-board-template-create]");
  if (boardTemplateCreateButton) {
    createBoardTaskFromTemplate();
    return;
  }

  const boardRecipeButton = event.target.closest("[data-board-recipe]");
  if (boardRecipeButton) {
    createBoardTaskFromRecipe(boardRecipeButton.dataset.boardRecipe);
    return;
  }

  const ganttZoomButton = event.target.closest("[data-gantt-zoom]");
  if (ganttZoomButton) {
    state.selectedGanttZoom = ganttZoomButton.dataset.ganttZoom;
    saveState();
    render();
    return;
  }

  const sprintChartModeButton = event.target.closest("[data-sprint-chart-mode]");
  if (sprintChartModeButton) {
    state.selectedSprintChartMode = sprintChartModeButton.dataset.sprintChartMode;
    saveState();
    render();
    return;
  }

  const ganttShiftButton = event.target.closest("[data-gantt-shift]");
  if (ganttShiftButton) {
    shiftGanttTask(ganttShiftButton.dataset.ganttShift, Number(ganttShiftButton.dataset.ganttShiftDays || 0));
    return;
  }

  const ganttBaselineButton = event.target.closest("[data-gantt-baseline]");
  if (ganttBaselineButton) {
    setGanttTaskBaseline(ganttBaselineButton.dataset.ganttBaseline);
    return;
  }

  const exportTimelineButton = event.target.closest("[data-export-timeline]");
  if (exportTimelineButton) {
    exportProjectTimeline(exportTimelineButton.dataset.projectId, exportTimelineButton.dataset.exportTimeline);
    return;
  }

  const boardMenuButton = event.target.closest("[data-board-menu]");
  if (boardMenuButton) {
    openBoardMenuColumn = openBoardMenuColumn === boardMenuButton.dataset.boardMenu ? "" : boardMenuButton.dataset.boardMenu;
    render();
    return;
  }

  const boardMenuAction = event.target.closest("[data-board-menu-action]");
  if (boardMenuAction) {
    const columnId = boardMenuAction.dataset.boardMenuColumn;
    const action = boardMenuAction.dataset.boardMenuAction;
    openBoardMenuColumn = "";
    if (action === "add") {
      render();
      document.querySelector(`[data-board-quick-add="${CSS.escape(columnId)}"] input`)?.focus();
      return;
    }
    if (action === "rename") {
      render();
      document.querySelector(`[data-board-label="${CSS.escape(columnId)}"]`)?.focus();
      return;
    }
    if (action === "wip") {
      render();
      document.querySelector(`[data-board-wip="${CSS.escape(columnId)}"]`)?.focus();
      return;
    }
    if (action === "collapse") {
      toggleBoardColumn(columnId);
      return;
    }
    if (action === "archive") {
      archiveBoardColumn(columnId);
      return;
    }
    if (action === "move-all") {
      moveBoardColumnTasks(columnId, boardMenuAction.dataset.boardMenuTarget);
      return;
    }
  }

  const boardCollapseButton = event.target.closest("[data-board-collapse]");
  if (boardCollapseButton) {
    toggleBoardColumn(boardCollapseButton.dataset.boardCollapse);
    return;
  }

  const dailyActionButton = event.target.closest("[data-daily-action]");
  if (dailyActionButton) {
    const taskId = dailyActionButton.dataset.taskId;
    const action = dailyActionButton.dataset.dailyAction;
    const plan = dailyPlan(taskId);

    if (action === "done") {
      updateTask(taskId, { status: "done" });
      return;
    }

    if (action === "tomorrow") {
      planTaskForDate(taskId, plan?.lane || "next", shiftDate(state.selectedDailyDate, 1));
      saveState();
      render();
      showToast("Task moved to tomorrow", "success");
      return;
    }

    if (action === "log") {
      addQuickDailyTime(taskId);
      return;
    }
  }

  const dailyShiftButton = event.target.closest("[data-daily-shift]");
  if (dailyShiftButton) {
    state.selectedDailyDate = shiftDate(state.selectedDailyDate, Number(dailyShiftButton.dataset.dailyShift));
    saveState();
    render();
    showToast("Daily date updated", "success");
  }

  const dailyTodayButton = event.target.closest("[data-daily-today]");
  if (dailyTodayButton) {
    state.selectedDailyDate = todayKey();
    saveState();
    render();
    showToast("Showing today", "success");
  }

  const inboxPlanButton = event.target.closest("[data-inbox-plan]");
  if (inboxPlanButton) {
    planTaskForDate(inboxPlanButton.dataset.inboxPlan, "next", todayKey());
    markInboxRead(inboxPlanButton.dataset.inboxId);
    state.selectedRoute = "daily";
    state.selectedDailyDate = todayKey();
    saveState();
    render();
    showToast("Task planned for Today", "success");
  }

  const inboxReadButton = event.target.closest("[data-inbox-read]");
  if (inboxReadButton) {
    const id = inboxReadButton.dataset.inboxRead;
    state.inboxRead = isInboxRead(id)
      ? state.inboxRead.filter((itemId) => itemId !== id)
      : [...state.inboxRead, id];
    syncInboxStateToApi();
    saveState();
    render();
    showToast(isInboxRead(id) ? "Notification marked read" : "Notification marked unread", "success");
  }

  const inboxClearButton = event.target.closest("[data-inbox-clear]");
  if (inboxClearButton) {
    archiveInboxItem(inboxClearButton.dataset.inboxClear);
    syncInboxStateToApi();
    saveState();
    render();
    showToast("Notification cleared", "success");
  }

  const inboxSnoozeButton = event.target.closest("[data-inbox-snooze]");
  if (inboxSnoozeButton) {
    snoozeInboxItem(inboxSnoozeButton.dataset.inboxSnooze);
    syncInboxStateToApi();
    saveState();
    render();
    showToast("Notification snoozed until tomorrow", "success");
    return;
  }

  const inboxRemindButton = event.target.closest("[data-inbox-remind]");
  if (inboxRemindButton) {
    scheduleInboxReminder(inboxRemindButton.dataset.inboxId, inboxRemindButton.dataset.inboxRemind);
    return;
  }

  const reminderDismissButton = event.target.closest("[data-reminder-dismiss]");
  if (reminderDismissButton) {
    dismissNotificationReminder(reminderDismissButton.dataset.reminderDismiss);
    return;
  }

  const inboxBulkButton = event.target.closest("[data-inbox-bulk]");
  if (inboxBulkButton) {
    const items = getInboxItems();
    if (inboxBulkButton.dataset.inboxBulk === "read") {
      state.inboxRead = Array.from(new Set([...state.inboxRead, ...items.map((item) => item.id)]));
      showToast("All notifications marked read", "success");
    }
    if (inboxBulkButton.dataset.inboxBulk === "archive-read") {
      const readIds = items.filter((item) => isInboxRead(item.id)).map((item) => item.id);
      state.inboxArchived = Array.from(new Set([...state.inboxArchived, ...readIds]));
      showToast("Read notifications cleared", "success");
    }
    syncInboxStateToApi();
    saveState();
    render();
  }

  const projectTabButton = event.target.closest("[data-project-tab]");
  if (projectTabButton) {
    state.selectedProjectTab = projectTabButton.dataset.projectTab;
    saveState();
    render();
  }

  const commentButton = event.target.closest("#comment-submit");
  if (commentButton) addTaskComment();

  const commentReplyButton = event.target.closest("[data-comment-reply]");
  if (commentReplyButton) {
    setCommentReplyTarget(commentReplyButton.dataset.commentReply);
    return;
  }

  const commentStatusButton = event.target.closest("[data-comment-status]");
  if (commentStatusButton) {
    updateCommentRecord(commentStatusButton.dataset.commentId, { status: commentStatusButton.dataset.commentStatus });
    return;
  }

  const commentKindButton = event.target.closest("[data-comment-kind]");
  if (commentKindButton) {
    updateCommentRecord(commentKindButton.dataset.commentId, { kind: commentKindButton.dataset.commentKind });
    return;
  }

  const watchTaskButton = event.target.closest("[data-toggle-watch-task]");
  if (watchTaskButton) {
    toggleTaskWatch(watchTaskButton.dataset.toggleWatchTask);
    return;
  }

  const timeButton = event.target.closest("#time-submit");
  if (timeButton) addTaskTimeEntry();

  const editButton = event.target.closest("[data-edit-task]");
  if (editButton) {
    if (!canWrite("tasks:write")) {
      showToast("Your role cannot edit tasks", "info");
      return;
    }
    if (editButton.dataset.inboxId) {
      markInboxRead(editButton.dataset.inboxId);
      syncInboxStateToApi();
      saveState();
      renderNotificationBadges();
    }
    populateTaskForm(byId(state.tasks, editButton.dataset.editTask));
    openDialog(els.taskDialog);
  }

  const closeButton = event.target.closest("[data-close-dialog]");
  if (closeButton) closeDialog(document.querySelector(`#${closeButton.dataset.closeDialog}`));
});

document.addEventListener("change", (event) => {
  const memberRoleSelect = event.target.closest("[data-member-role]");
  if (memberRoleSelect) {
    updateMemberRole(memberRoleSelect.dataset.memberRole, memberRoleSelect.value);
    return;
  }

  const memberCompanySelect = event.target.closest("[data-member-company]");
  if (memberCompanySelect) {
    updateMemberCompanyAccess(memberCompanySelect.dataset.memberCompany, memberCompanySelect.value);
    return;
  }

  const taskProjectSelect = event.target.closest("#task-project");
  if (taskProjectSelect) {
    const taskId = document.querySelector("#task-id")?.value;
    renderTaskDependencies(taskId ? byId(state.tasks, taskId) : null);
  }

  const portfolioProjectSelect = event.target.closest("#portfolio-rebalance-project");
  if (portfolioProjectSelect) {
    const memberSelect = document.querySelector("#portfolio-rebalance-member");
    const recommended = portfolioRecommendedReceiver(portfolioProjectSelect.value);
    if (memberSelect && recommended) memberSelect.value = recommended;
    return;
  }

  const subtaskCheckbox = event.target.closest("[data-toggle-subtask]");
  if (subtaskCheckbox) toggleDraftSubtask(subtaskCheckbox.dataset.toggleSubtask, subtaskCheckbox.checked);

  const notificationEventToggle = event.target.closest("[data-notification-event]");
  if (notificationEventToggle) {
    updateNotificationEventPreference(notificationEventToggle.dataset.notificationEvent, notificationEventToggle.checked);
    return;
  }

  const notificationChannelToggle = event.target.closest("[data-notification-channel]");
  if (notificationChannelToggle) {
    updateNotificationChannel(notificationChannelToggle.dataset.notificationChannel, notificationChannelToggle.checked);
    return;
  }

  const digestRuleToggle = event.target.closest("[data-digest-rule]");
  if (digestRuleToggle) {
    updateDigestPreference(digestRuleToggle.dataset.digestRule, digestRuleToggle.checked);
    return;
  }

  const notificationCadenceSelect = event.target.closest("#notification-cadence");
  if (notificationCadenceSelect) {
    updateNotificationCadence(notificationCadenceSelect.value);
    return;
  }

  const evaluationNoteInput = event.target.closest("[data-evaluation-note]");
  if (evaluationNoteInput) {
    setEvaluationScorecardNote(evaluationNoteInput.dataset.evaluationNote, evaluationNoteInput.value);
    return;
  }
});

document.addEventListener("keydown", (event) => {
  if (handleGlobalShortcut(event)) return;
  if (handleBoardKeyboard(event)) return;

  if (event.key === "Enter" && event.target.closest("#subtask-title")) {
    event.preventDefault();
    addDraftSubtask();
  }
});

document.querySelector("#new-task-button").addEventListener("click", () => {
  if (!canWrite("tasks:write")) {
    showToast("Your role cannot create tasks", "info");
    return;
  }
  populateTaskForm();
  openDialog(els.taskDialog);
});

document.querySelector("#feature-request-button").addEventListener("click", openFeatureRequestDialog);

document.querySelector("#new-project-button").addEventListener("click", () => {
  if (!canWrite("projects:write")) {
    showToast("Your role cannot create projects", "info");
    return;
  }
  populateProjectForm();
  openDialog(els.projectDialog);
});

[els.taskDialog, els.featureRequestDialog, els.projectDialog, els.companyDialog, els.workspaceDialog, els.commandDialog, els.shortcutsDialog].filter(Boolean).forEach((dialog) => {
  dialog.addEventListener("close", () => {
    if (dialog === els.taskDialog) {
      const taskId = document.querySelector("#task-id")?.value || "";
      if (taskId) taskEditSnapshots.delete(taskId);
      staleTaskOverrideId = "";
      heartbeatPresence({ force: true });
    }
    restoreDialogFocus();
  });
});

els.workspaceForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  saveWorkspaceDialog();
});

document.querySelector("#seed-reset").addEventListener("click", () => {
  state = structuredClone(seedData);
  saveState();
  render();
  showToast("Sample data reset", "success");
});

els.workspaceSwitcher?.addEventListener("change", (event) => {
  switchWorkspace(event.target.value);
});

els.workspaceCreate?.addEventListener("click", createWorkspaceFromSwitcher);
els.workspaceDuplicate?.addEventListener("click", duplicateWorkspaceFromSwitcher);
els.workspaceArchive?.addEventListener("click", archiveActiveWorkspace);

els.commandInput?.addEventListener("input", () => {
  commandPaletteSelection = 0;
  renderCommandPalette();
});

els.searchInput.addEventListener("input", (event) => {
  state.filters.query = event.target.value;
  saveState();
  render();
});

els.searchInput.addEventListener("focus", renderSearchResults);

els.companyFilter.addEventListener("change", (event) => {
  state.filters.company = event.target.value;
  state.selectedProject = "all";
  if (state.selectedRoute === "company") {
    state.selectedCompany = event.target.value;
    state.selectedRoute = event.target.value === "all" ? "companies" : "company";
  }
  saveState();
  render();
});

els.projectFilter.addEventListener("change", (event) => {
  setProject(event.target.value);
});

els.assigneeFilter.addEventListener("change", (event) => {
  state.filters.assignee = event.target.value;
  saveState();
  render();
});

els.statusFilter.addEventListener("change", (event) => {
  state.filters.status = event.target.value;
  saveState();
  render();
});

els.priorityFilter.addEventListener("change", (event) => {
  state.filters.priority = event.target.value;
  saveState();
  render();
});

els.savedViewFilter?.addEventListener("change", (event) => {
  if (event.target.value) applySavedView(event.target.value);
});

els.saveViewButton?.addEventListener("click", saveCurrentView);
els.updateViewButton?.addEventListener("click", updateCurrentSavedView);
els.renameViewButton?.addEventListener("click", renameCurrentSavedView);
els.pinViewButton?.addEventListener("click", togglePinnedSavedView);
els.deleteViewButton?.addEventListener("click", deleteCurrentSavedView);

els.appView.addEventListener("change", (event) => {
  const dailyDateInput = event.target.closest("[data-daily-date]");
  if (dailyDateInput) {
    state.selectedDailyDate = dailyDateInput.value || todayKey();
    saveState();
    render();
    return;
  }

  const select = event.target.closest("[data-inline-field]");
  if (select) {
    updateTask(select.dataset.taskId, { [select.dataset.inlineField]: select.value });
    return;
  }

  const clientVisibilitySelect = event.target.closest("[data-client-visibility-kind]");
  if (clientVisibilitySelect) {
    updateClientVisibility(clientVisibilitySelect.dataset.clientVisibilityKind, clientVisibilitySelect.dataset.clientVisibilityId, clientVisibilitySelect.value);
    return;
  }

  const featureStatusSelect = event.target.closest("[data-feature-status-task]");
  if (featureStatusSelect) {
    updateFeatureRequestStatus(featureStatusSelect.dataset.featureStatusTask, featureStatusSelect.value);
    return;
  }

  const featureFilterSelect = event.target.closest("[data-feature-filter]");
  if (featureFilterSelect) {
    state.featureRequestFilters = {
      status: "all",
      source: "all",
      impact: "all",
      ...(state.featureRequestFilters || {}),
      [featureFilterSelect.dataset.featureFilter]: featureFilterSelect.value
    };
    saveState();
    render();
    return;
  }

  const projectBacklogStatusSelect = event.target.closest("[data-project-backlog-status]");
  if (projectBacklogStatusSelect) {
    updateProjectBacklogStatus(projectBacklogStatusSelect.dataset.projectBacklogStatus, projectBacklogStatusSelect.value);
    return;
  }

  const retroActionStatusSelect = event.target.closest("[data-retro-action-status]");
  if (retroActionStatusSelect) {
    updateRetroActionStatus(retroActionStatusSelect.dataset.retroActionStatus, retroActionStatusSelect.value);
    return;
  }

  const boardSwimlaneSelect = event.target.closest("#board-swimlane");
  if (boardSwimlaneSelect) {
    updateBoardSetting({ swimlane: boardSwimlaneSelect.value });
    return;
  }

  const boardSwimlaneValueInput = event.target.closest("[data-board-swimlane-value]");
  if (boardSwimlaneValueInput) {
    updateBoardSetting({ swimlaneValue: boardSwimlaneValueInput.value.trim() });
    return;
  }

  const boardTemplateSelect = event.target.closest("#board-template");
  if (boardTemplateSelect) {
    applyBoardTemplate(boardTemplateSelect.value);
    return;
  }

  const boardSortSelect = event.target.closest("#board-sort");
  if (boardSortSelect) {
    updateBoardSetting({ sort: boardSortSelect.value });
    return;
  }

  const boardDensitySelect = event.target.closest("#board-density");
  if (boardDensitySelect) {
    updateBoardSetting({ density: boardDensitySelect.value });
    return;
  }

  const boardViewSelect = event.target.closest("#board-view-select");
  if (boardViewSelect) {
    if (boardViewSelect.value) applySavedView(boardViewSelect.value);
    return;
  }

  const boardCardFieldToggle = event.target.closest("[data-board-card-field]");
  if (boardCardFieldToggle) {
    updateBoardCardField(boardCardFieldToggle.dataset.boardCardField, boardCardFieldToggle.checked);
    return;
  }

  const boardWipInput = event.target.closest("[data-board-wip]");
  if (boardWipInput) {
    updateBoardColumn(boardWipInput.dataset.boardWip, { wipLimit: Number(boardWipInput.value || 0) });
    return;
  }

  const boardLabelInput = event.target.closest("[data-board-label]");
  if (boardLabelInput) {
    updateBoardColumn(boardLabelInput.dataset.boardLabel, { label: boardLabelInput.value.trim() || boardColumnLabel(boardLabelInput.dataset.boardLabel) });
    return;
  }

  const taskDateInput = event.target.closest("[data-task-date]");
  if (taskDateInput) {
    updateTask(taskDateInput.dataset.taskDate, { dueDate: taskDateInput.value });
    return;
  }

  const taskStartInput = event.target.closest("[data-task-start]");
  if (taskStartInput) {
    updateTask(taskStartInput.dataset.taskStart, { startDate: taskStartInput.value });
    return;
  }

  const milestoneDateInput = event.target.closest("[data-milestone-date]");
  if (milestoneDateInput) {
    updateMilestoneDate(milestoneDateInput.dataset.milestoneDate, milestoneDateInput.value);
    return;
  }

  const projectDateInput = event.target.closest("[data-project-date]");
  if (projectDateInput) {
    updateProjectDate(projectDateInput.dataset.projectId, projectDateInput.dataset.projectDate, projectDateInput.value);
    return;
  }

  const auditFilterField = event.target.closest("[data-audit-filter]");
  if (auditFilterField) {
    auditFilters = {
      ...auditFilters,
      [auditFilterField.dataset.auditFilter]: auditFilterField.value
    };
    selectedAuditEventKey = "";
    renderAuditLog();
    return;
  }

  const releaseGateSelect = event.target.closest("[data-release-gate]");
  if (releaseGateSelect) {
    const releaseId = releaseGateSelect.dataset.releaseId || "";
    const gateId = releaseGateSelect.dataset.releaseGate || "";
    const value = releaseGateSelect.value === "waived" ? "waived" : "required";
    state.releaseGateOverrides = {
      ...(state.releaseGateOverrides || {}),
      [releaseId]: {
        ...releaseGateOverrides(releaseId),
        [gateId]: value
      }
    };
    addAuditEvent({
      action: "release_gate_configured",
      detail: `${value === "waived" ? "Waived" : "Required"} release gate ${gateId}`,
      targetType: "release",
      targetId: releaseId,
      metadata: { releaseId, gateId, mode: value },
      impact: value === "waived" ? "medium" : "low",
      restoreHint: "Set the release gate back to Required from Release Management."
    });
    saveState();
    renderReleaseManagement();
  }
});

els.appView.addEventListener("input", (event) => {
  const auditQueryInput = event.target.closest("input[data-audit-filter='query']");
  if (auditQueryInput) {
    auditFilters = {
      ...auditFilters,
      query: auditQueryInput.value
    };
    selectedAuditEventKey = "";
    renderAuditLog();
    const nextInput = document.querySelector("input[data-audit-filter='query']");
    if (nextInput) {
      nextInput.focus();
      nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
    }
    return;
  }

  const templateSearch = event.target.closest("#template-search");
  if (templateSearch) {
    const cursor = templateSearch.selectionStart || templateSearch.value.length;
    state.templateLibrary = {
      ...(state.templateLibrary || {}),
      query: templateSearch.value,
      selectedProjectTemplateId: ""
    };
    saveState();
    render();
    const nextSearch = document.querySelector("#template-search");
    if (nextSearch) {
      nextSearch.focus();
      nextSearch.setSelectionRange(cursor, cursor);
    }
    return;
  }

  const dailyNote = event.target.closest("#daily-note");
  if (!dailyNote) return;
  state.dailyNotes = {
    ...state.dailyNotes,
    [state.selectedDailyDate]: dailyNote.value
  };
  saveState();
});

els.appView.addEventListener("dragstart", (event) => {
  const sprintBar = event.target.closest("[data-sprint-timeline-drag]");
  if (sprintBar) {
    event.dataTransfer.setData("application/agora-sprint-task", sprintBar.dataset.sprintTimelineDrag);
    event.dataTransfer.setData("text/plain", sprintBar.dataset.sprintTimelineDrag);
    return;
  }

  const ganttBar = event.target.closest("[data-gantt-drag]");
  if (ganttBar) {
    event.dataTransfer.setData("application/agora-gantt-task", ganttBar.dataset.ganttDrag);
    event.dataTransfer.setData("text/plain", ganttBar.dataset.ganttDrag);
    return;
  }

  const card = event.target.closest("[data-task-id]");
  if (!card) return;
  event.dataTransfer.setData("text/plain", card.dataset.taskId);
});

function clearBoardDropIndicators() {
  els.appView.querySelectorAll(".is-drag-over, .is-drop-before, .is-drop-after").forEach((element) => {
    element.classList.remove("is-drag-over", "is-drop-before", "is-drop-after");
  });
  els.appView.querySelectorAll("[data-drop-before-task]").forEach((element) => {
    delete element.dataset.dropBeforeTask;
  });
}

function markBoardDropTarget(event) {
  const dropZone = event.target.closest("[data-drop-status]");
  if (!dropZone) return;
  clearBoardDropIndicators();
  dropZone.classList.add("is-drag-over");
  const targetCard = event.target.closest("[data-task-id]");
  if (!targetCard || !dropZone.contains(targetCard)) return;
  const rect = targetCard.getBoundingClientRect();
  const dropAfter = event.clientY > rect.top + rect.height / 2;
  const beforeTask = dropAfter
    ? targetCard.nextElementSibling?.matches?.("[data-task-id]") ? targetCard.nextElementSibling : null
    : targetCard;
  targetCard.classList.add(dropAfter ? "is-drop-after" : "is-drop-before");
  dropZone.dataset.dropBeforeTask = beforeTask?.dataset.taskId || "";
}

els.appView.addEventListener("dragover", (event) => {
  if (event.target.closest("[data-sprint-timeline-track]")) {
    event.preventDefault();
    return;
  }
  if (event.target.closest("[data-gantt-start]")) {
    event.preventDefault();
    return;
  }
  if (event.target.closest("[data-drop-status]")) {
    event.preventDefault();
    markBoardDropTarget(event);
  }
});

els.appView.addEventListener("drop", (event) => {
  const sprintDropZone = event.target.closest("[data-sprint-timeline-track]");
  const sprintTaskId = event.dataTransfer.getData("application/agora-sprint-task");
  if (sprintDropZone && sprintTaskId) {
    event.preventDefault();
    const rect = sprintDropZone.getBoundingClientRect();
    const pct = clamp(((event.clientX - rect.left) / Math.max(1, rect.width)) * 100, 0, 100);
    const totalDays = Number(sprintDropZone.dataset.sprintTotalDays || 1);
    const targetStart = shiftDate(sprintDropZone.dataset.sprintStart, Math.round(((totalDays - 1) * pct) / 100));
    rescheduleSprintTimelineTask(sprintTaskId, targetStart, sprintDropZone.dataset.sprintLane || "");
    return;
  }

  const ganttDropZone = event.target.closest("[data-gantt-start]");
  const ganttTaskId = event.dataTransfer.getData("application/agora-gantt-task");
  if (ganttDropZone && ganttTaskId) {
    event.preventDefault();
    const task = byId(state.tasks, ganttTaskId);
    if (!task) return;
    const rect = ganttDropZone.getBoundingClientRect();
    const pct = clamp(((event.clientX - rect.left) / Math.max(1, rect.width)) * 100, 0, 100);
    const targetStart = shiftDate(ganttDropZone.dataset.ganttStart, Math.round((Number(ganttDropZone.dataset.ganttTotalDays || 1) * pct) / 100));
    const delta = daysBetween(taskStartDate(task), targetStart);
    shiftGanttTask(ganttTaskId, delta);
    return;
  }

  const dropZone = event.target.closest("[data-drop-status]");
  if (!dropZone) return;
  event.preventDefault();
  const targetCard = event.target.closest("[data-task-id]");
  const draggedId = event.dataTransfer.getData("text/plain");
  const beforeTaskId = dropZone.dataset.dropBeforeTask && dropZone.dataset.dropBeforeTask !== draggedId
    ? dropZone.dataset.dropBeforeTask
    : targetCard && targetCard.dataset.taskId !== draggedId ? targetCard.dataset.taskId : "";
  clearBoardDropIndicators();
  moveTaskOnBoard(draggedId, dropZone.dataset.dropStatus, beforeTaskId);
});

els.appView.addEventListener("dragend", clearBoardDropIndicators);

els.appView.addEventListener("submit", (event) => {
  const milestoneForm = event.target.closest("[data-timeline-milestone-create]");
  if (milestoneForm) {
    event.preventDefault();
    createTimelineMilestone(milestoneForm);
    return;
  }

  const boardBacklogForm = event.target.closest("[data-board-backlog-create]");
  if (boardBacklogForm) {
    event.preventDefault();
    createBoardBacklogTask(boardBacklogForm.elements.title?.value || "");
    return;
  }

  const projectBacklogForm = event.target.closest("[data-project-backlog-create]");
  if (projectBacklogForm) {
    event.preventDefault();
    createProjectBacklogItem(projectBacklogForm);
    return;
  }

  const sprintSettingsForm = event.target.closest("[data-sprint-settings]");
  if (sprintSettingsForm) {
    event.preventDefault();
    saveSprintSettings(sprintSettingsForm);
    return;
  }

  const sprintRoadmapCreateForm = event.target.closest("[data-sprint-roadmap-create]");
  if (sprintRoadmapCreateForm) {
    event.preventDefault();
    createRoadmapSprint(sprintRoadmapCreateForm);
    return;
  }

  const sprintRoadmapUpdateForm = event.target.closest("[data-sprint-roadmap-update]");
  if (sprintRoadmapUpdateForm) {
    event.preventDefault();
    updateRoadmapSprint(sprintRoadmapUpdateForm, sprintRoadmapUpdateForm.dataset.sprintRoadmapUpdate);
    return;
  }

  const boardQuickAddForm = event.target.closest("[data-board-quick-add]");
  if (boardQuickAddForm) {
    event.preventDefault();
    createBoardTask(boardQuickAddForm.dataset.boardQuickAdd, boardQuickAddForm.elements.title?.value || "");
    return;
  }
  if (event.target.closest("#public-feature-request-form")) {
    event.preventDefault();
    submitPublicFeatureRequest();
  }
  const hostedCommentForm = event.target.closest("[data-hosted-comment-form]");
  if (hostedCommentForm) {
    event.preventDefault();
    submitHostedComment(hostedCommentForm);
  }
  if (event.target.closest("#hosted-feature-request-form")) {
    event.preventDefault();
    submitHostedFeatureRequest();
  }
});

els.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canWrite("tasks:write")) {
    showToast("Your role cannot save tasks", "info");
    return;
  }
  const id = document.querySelector("#task-id").value || uid("task");
  const existingTask = byId(state.tasks, id);
  if (existingTask && staleTaskOverrideId !== id && taskEditSnapshots.get(id) && taskEditSnapshots.get(id) !== taskRevision(existingTask)) {
    staleTaskOverrideId = id;
    showTaskEditWarning(existingTask);
    showToast("Task changed since you opened it", "info");
    return;
  }
  const now = new Date().toISOString();
  const task = {
    id,
    projectId: document.querySelector("#task-project").value,
    title: document.querySelector("#task-title").value.trim(),
    description: document.querySelector("#task-description").value.trim(),
    assignee: document.querySelector("#task-assignee").value,
    status: document.querySelector("#task-status").value,
    priority: document.querySelector("#task-priority").value,
    startDate: document.querySelector("#task-start-date").value,
    dueDate: document.querySelector("#task-due-date").value,
    blockedBy: Array.from(document.querySelectorAll("[data-task-dependency]:checked")).map((input) => input.value),
    tags: document.querySelector("#task-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
    subtasks: draftSubtasks,
    customFields: Array.from(document.querySelectorAll("[data-custom-field]")).reduce((values, input) => {
      if (input.value !== "") values[input.dataset.customField] = input.value;
      return values;
    }, {}),
    createdAt: existingTask?.createdAt || now,
    updatedAt: now
  };

  if (existingTask) {
    state.tasks = state.tasks.map((item) => item.id === id ? task : item);
    recordTaskChanges(existingTask, task);
  } else {
    state.tasks = [task, ...state.tasks];
    addActivity({
      projectId: task.projectId,
      taskId: task.id,
      type: "task_create",
      message: `created ${task.title}`
    });
  }

  saveState();
  taskEditSnapshots.delete(id);
  staleTaskOverrideId = "";
  closeDialog(els.taskDialog);
  render();
  showToast(existingTask ? "Task updated" : "Task created", "success");
  syncTaskToApi(task, existingTask ? "Task synced to API" : "Task created in API", !existingTask, taskEditSnapshots.get(id) || recordRevisionValue(existingTask));
});

els.featureRequestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canWrite("tasks:write")) {
    showToast("Your role cannot submit feature requests", "info");
    return;
  }

  const title = document.querySelector("#feature-request-title-input").value.trim();
  const projectId = document.querySelector("#feature-request-project").value;
  if (!title || !projectId) {
    showToast("Feature requests need a title and project", "info");
    return;
  }

  createFeatureRequestTask({
    projectId,
    projectName: byId(state.projects, projectId)?.name || projectId,
    title,
    details: document.querySelector("#feature-request-details").value.trim(),
    requester: document.querySelector("#feature-request-requester").value.trim(),
    email: document.querySelector("#feature-request-email").value.trim(),
    impact: document.querySelector("#feature-request-impact").value,
    impactLabel: featureRequestImpactLabel(document.querySelector("#feature-request-impact").value)
  });
});

els.projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canWrite("projects:write")) {
    showToast("Your role cannot save projects", "info");
    return;
  }
  const id = document.querySelector("#project-id").value || uid("project");
  const existingProject = byId(state.projects, id);
  const now = new Date().toISOString();
  const project = {
    id,
    name: document.querySelector("#project-name").value.trim(),
    companyId: document.querySelector("#project-company").value,
    description: document.querySelector("#project-description").value.trim(),
    owner: document.querySelector("#project-owner").value,
    startDate: document.querySelector("#project-start-date").value,
    dueDate: document.querySelector("#project-due-date").value,
    createdAt: existingProject?.createdAt || now,
    updatedAt: now,
    archivedAt: existingProject?.archivedAt || "",
    archivedBy: existingProject?.archivedBy || ""
  };

  if (existingProject) {
    state.projects = state.projects.map((item) => item.id === id ? project : item);
    addActivity({
      projectId: project.id,
      type: "project_update",
      message: `updated project ${project.name}`
    });
  } else {
    state.projects = [project, ...state.projects];
    addActivity({
      projectId: project.id,
      type: "project_create",
      message: `created project ${project.name}`
    });
  }
  state.selectedProject = project.id;
  state.selectedRoute = "project";
  state.selectedProjectTab = "overview";
  saveState();
  closeDialog(els.projectDialog);
  render();
  showToast(existingProject ? "Project updated" : "Project created", "success");
  syncProjectToApi(project, existingProject ? "Project synced to API" : "Project created in API", !existingProject, recordRevisionValue(existingProject));
});

els.companyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canWrite("projects:write")) {
    showToast("Your role cannot manage companies", "info");
    return;
  }
  const id = document.querySelector("#company-id").value || uid("company");
  const existingCompany = byId(state.companies, id);
  const company = {
    id,
    name: document.querySelector("#company-name").value.trim(),
    description: document.querySelector("#company-description").value.trim(),
    type: document.querySelector("#company-type").value,
    owner: document.querySelector("#company-owner").value,
    status: document.querySelector("#company-status").value
  };

  if (existingCompany) {
    state.companies = state.companies.map((item) => item.id === id ? company : item);
  } else {
    state.companies = [company, ...state.companies];
  }

  state.selectedCompany = id;
  state.filters.company = id;
  state.selectedProject = "all";
  state.selectedRoute = "company";
  saveState();
  closeDialog(els.companyDialog);
  render();
  showToast(existingCompany ? "Company updated" : "Company created", "success");
  syncRecordToApi("companies", company, existingCompany ? "Company synced to API" : "Company created in API");
});

window.addEventListener("hashchange", () => {
  if (!routePortalFromLocation({ shouldRender: true }) && !routeInviteFromLocation({ shouldRender: true })) {
    routeFeedbackFromLocation({ shouldRender: true });
  }
});

window.addEventListener("pointermove", handlePointerPresence, { passive: true });

window.addEventListener("focus", () => {
  heartbeatPresence({ force: true });
  refreshLiveCollaborationFromApi({ rerender: ["dashboard", "inbox"].includes(state.selectedRoute) });
  pollApiForWorkspaceChanges();
});

document.addEventListener("visibilitychange", () => {
  heartbeatPresence({ force: true });
  if (!document.hidden) pollApiForWorkspaceChanges();
});

window.addEventListener("online", handleNetworkOnline);
window.addEventListener("offline", handleNetworkOffline);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  pwaInstallPrompt = event;
  pwaInstallReady = true;
  if (state.selectedRoute === "settings") render();
});

window.addEventListener("appinstalled", () => {
  pwaInstallPrompt = null;
  pwaInstallReady = false;
  showToast("Agora installed", "success");
  if (state.selectedRoute === "settings") render();
});

if (reducedMotionQuery?.addEventListener) {
  reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
} else if (reducedMotionQuery?.addListener) {
  reducedMotionQuery.addListener(handleReducedMotionChange);
}

function handleColorSchemeChange() {
  if (state.workspace.theme?.preset !== "auto") return;
  applyWorkspaceTheme();
  if (state.selectedRoute === "settings") render();
}

if (darkModeQuery?.addEventListener) {
  darkModeQuery.addEventListener("change", handleColorSchemeChange);
} else if (darkModeQuery?.addListener) {
  darkModeQuery.addListener(handleColorSchemeChange);
}

initSmoothScroll();
registerServiceWorker();
hydrateSecureApiSession();
loadReleaseEvidenceIndex();
startRealtimePolling();
window.setInterval(() => {
  runNotificationReminderScheduler();
}, 60000);
runNotificationReminderScheduler();
window.setInterval(() => {
  const taskId = document.querySelector("#task-dialog[open] #task-id")?.value || "";
  heartbeatPresence({ taskId });
  refreshLiveCollaborationFromApi();
}, 15000);

if (!routePortalFromLocation() && !routeInviteFromLocation() && !routeFeedbackFromLocation() && !routeFromLocation()) {
  openSidebarGroupForRoute(state.selectedRoute);
}
render();
runDemoActionFromLocation();
runGoldenActionFromLocation();
document.documentElement.dataset.agoraBoot = "ready";
