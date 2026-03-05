// Export the main agent class and utilities for library usage
export {
  ClaudeAcpAgent,
  runAcp,
  toAcpNotifications,
  streamEventToAcpNotifications,
  type ToolUpdateMeta,
  type NewSessionMeta,
} from "./acp-agent.js";
export {
  loadManagedSettings,
  applyEnvironmentSettings,
  nodeToWebReadable,
  nodeToWebWritable,
  Pushable,
  unreachable,
} from "./utils.js";
export { toolInfoFromToolUse, planEntries, toolUpdateFromToolResult } from "./tools.js";
export {
  SettingsManager,
  createSettingsManager,
  DEFAULT_SETTINGS,
  DEFAULT_MODEL_SETTINGS,
  PREDEFINED_MODELS,
  getPredefinedModel,
  getAvailableModels,
  supportsVision,
  type ClaudeCodeSettings,
  type SettingsManagerOptions,
  type PermissionSettings,
  type ModelSettings,
  type ModelProvider,
  type ModelCapabilities,
  type UISettings,
  type ToolSettings,
  type FileSettings,
  type BehaviorSettings,
  type SessionSettings,
  type McpSettings,
} from "./settings.js";
export {
  SuggestionManager,
  createSuggestionManager,
  type Suggestion,
  type SuggestionType,
} from "./suggestions.js";
export {
  CustomToolManager,
  createCustomToolManager,
  type CustomTool,
  type ToolChain,
  type ToolResult,
  type ToolParameter,
} from "./custom-tools.js";

// Export types
export type { ClaudePlanEntry } from "./tools.js";
