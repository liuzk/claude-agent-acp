import * as fs from "node:fs";
import * as path from "node:path";
import { CLAUDE_CONFIG_DIR } from "./acp-agent.js";

/**
 * Permission rule format examples:
 * - "Read" - matches all Read tool calls
 * - "Read(./.env)" - matches specific path
 * - "Read(./.env.*)" - glob pattern
 * - "Read(./.secrets/**)" - recursive glob
 * - "Bash(npm run lint)" - exact command prefix
 * - "Bash(npm run:*)" - command prefix with wildcard
 *
 * Docs: https://code.claude.com/docs/en/iam#tool-specific-permission-rules
 */

export interface PermissionSettings {
  defaultMode?: string;
  /**
   * 自动批准的工具列表
   * 例如: ["Read", "Glob", "Grep"]
   */
  autoApprove?: string[];
  /**
   * 需要确认的工具列表（优先级高于 autoApprove）
   * 例如: ["Bash", "FileWrite"]
   */
  requireConfirmation?: string[];
}

/**
 * 支持的模型提供商
 */
export type ModelProvider = "anthropic" | "moonshot" | "alibaba" | "zhipu" | "minimax" | "custom";

/**
 * 模型能力
 */
export interface ModelCapabilities {
  /** 支持图片理解 */
  vision?: boolean;
  /** 支持函数调用 */
  functionCalling?: boolean;
  /** 支持流式输出 */
  streaming?: boolean;
  /** 支持长上下文 */
  longContext?: boolean;
  /** 最大上下文长度 */
  maxContextLength?: number;
}

/**
 * 模型配置
 */
export interface ModelSettings {
  /** 模型名称 */
  name?: string;
  /** 模型提供商 */
  provider?: ModelProvider;
  /** 温度参数 (0-1)，控制生成文本的随机性，越低越确定 */
  temperature?: number;
  /** 最大生成token数 */
  maxTokens?: number;
  /** 核采样参数 (0-1) */
  topP?: number;
  /** 上下文窗口大小 */
  contextWindow?: number;
  /** API 基础 URL */
  baseUrl?: string;
  /** API 密钥 */
  apiKey?: string;
  /** 模型能力 */
  capabilities?: ModelCapabilities;
  /** 模型显示名称 */
  displayName?: string;
  /** 模型描述 */
  description?: string;
}

/**
 * 预定义的模型配置
 */
export const PREDEFINED_MODELS: Record<string, ModelSettings> = {
  // Anthropic 模型
  "claude-3-5-sonnet-20241022": {
    name: "claude-3-5-sonnet-20241022",
    provider: "anthropic",
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1,
    contextWindow: 200000,
    displayName: "Claude 3.5 Sonnet",
    description: "Anthropic Claude 3.5 Sonnet - 强大的通用模型",
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      longContext: true,
      maxContextLength: 200000,
    },
  },
  "claude-3-5-haiku-20241022": {
    name: "claude-3-5-haiku-20241022",
    provider: "anthropic",
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1,
    contextWindow: 200000,
    displayName: "Claude 3.5 Haiku",
    description: "Anthropic Claude 3.5 Haiku - 快速轻量级模型",
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      longContext: true,
      maxContextLength: 200000,
    },
  },
  // Moonshot (月之暗面) 模型
  "kimi-k2.5": {
    name: "kimi-k2.5",
    provider: "moonshot",
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1,
    contextWindow: 256000,
    displayName: "Kimi K2.5",
    description: "月之暗面 Kimi K2.5 - 支持长文本和图片理解",
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      longContext: true,
      maxContextLength: 256000,
    },
  },
  // Alibaba (通义千问) 模型
  "qwen3.5-plus": {
    name: "qwen3.5-plus",
    provider: "alibaba",
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1,
    contextWindow: 128000,
    displayName: "通义千问 3.5 Plus",
    description: "阿里云通义千问 3.5 Plus - 支持图片理解",
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      longContext: true,
      maxContextLength: 128000,
    },
  },
  // Zhipu (智谱) 模型
  "glm-5": {
    name: "glm-5",
    provider: "zhipu",
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1,
    contextWindow: 128000,
    displayName: "GLM-5",
    description: "智谱 GLM-5 - 强大的中文大模型",
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      longContext: true,
      maxContextLength: 128000,
    },
  },
  // MiniMax 模型
  "MiniMax-M2.5": {
    name: "MiniMax-M2.5",
    provider: "minimax",
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1,
    contextWindow: 100000,
    displayName: "MiniMax M2.5",
    description: "MiniMax M2.5 - 高效的多模态模型",
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      longContext: true,
      maxContextLength: 100000,
    },
  },
};

/**
 * 界面配置
 */
export interface UISettings {
  /** 主题: light, dark, auto */
  theme?: "light" | "dark" | "auto";
  /** 界面语言 */
  language?: string;
  /** 字体大小 */
  fontSize?: number;
  /** 行高 */
  lineHeight?: number;
  /** 代码字体 */
  fontFamily?: string;
  /** 是否显示行号 */
  showLineNumbers?: boolean;
  /** 是否启用自动换行 */
  wordWrap?: boolean;
}

/**
 * 工具配置
 */
export interface ToolSettings {
  /** 工具执行超时时间（毫秒） */
  timeout?: number;
  /** 禁用的工具列表 */
  disallowedTools?: string[];
  /** 允许的工具列表（如果设置，则只允许这些工具） */
  allowedTools?: string[];
  /** Bash 工具配置 */
  bash?: {
    /** 允许的命令前缀 */
    allowedCommands?: string[];
    /** 禁止的命令 */
    blockedCommands?: string[];
    /** 默认工作目录 */
    defaultCwd?: string;
  };
  /** 文件操作配置 */
  files?: {
    /** 最大文件大小（字节） */
    maxSize?: number;
    /** 允许编辑的文件类型 */
    allowedExtensions?: string[];
    /** 禁止编辑的文件类型 */
    blockedExtensions?: string[];
  };
}

/**
 * 文件和搜索配置
 */
export interface FileSettings {
  /** 文件排除模式（glob） */
  excludePatterns?: string[];
  /** 文件包含模式（glob） */
  includePatterns?: string[];
  /** 搜索配置 */
  search?: {
    /** 最大搜索结果数 */
    maxResults?: number;
    /** 是否区分大小写 */
    caseSensitive?: boolean;
    /** 是否使用正则表达式 */
    useRegex?: boolean;
    /** 是否包含隐藏文件 */
    includeHidden?: boolean;
  };
  /** 索引配置 */
  indexing?: {
    /** 是否启用文件索引 */
    enabled?: boolean;
    /** 索引排除的目录 */
    excludeDirs?: string[];
    /** 最大索引文件数 */
    maxFiles?: number;
  };
}

/**
 * 行为配置
 */
export interface BehaviorSettings {
  /** 是否自动保存对话 */
  autoSave?: boolean;
  /** 保存间隔（毫秒） */
  autoSaveInterval?: number;
  /** 是否启用代码格式化 */
  formatOnSave?: boolean;
  /** 格式化工具配置 */
  formatters?: Record<string, string>;
  /** 是否启用智能提示 */
  enableSuggestions?: boolean;
  /** 是否启用代码补全 */
  enableCompletion?: boolean;
  /** 是否启用语义搜索 */
  enableSemanticSearch?: boolean;
}

/**
 * 快捷键配置
 */
export interface KeybindingSettings {
  /** 自定义快捷键映射 */
  bindings?: Record<string, string>;
}

/**
 * 会话配置
 */
export interface SessionSettings {
  /** 默认会话标题 */
  defaultTitle?: string;
  /** 最大历史消息数 */
  maxHistoryMessages?: number;
  /** 是否启用会话恢复 */
  enableResume?: boolean;
  /** 会话保存路径 */
  savePath?: string;
}

/**
 * MCP 服务器配置
 */
export interface McpSettings {
  /** MCP 服务器列表 */
  servers?: Array<{
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
    enabled?: boolean;
  }>;
}

/**
 * 完整的 Claude Code 配置接口
 */
export interface ClaudeCodeSettings {
  /** 权限配置 */
  permissions?: PermissionSettings;
  /** 环境变量 */
  env?: Record<string, string>;
  /** 模型配置 */
  model?: string | ModelSettings;
  /** 界面配置 */
  ui?: UISettings;
  /** 工具配置 */
  tools?: ToolSettings;
  /** 文件配置 */
  files?: FileSettings;
  /** 行为配置 */
  behavior?: BehaviorSettings;
  /** 快捷键配置 */
  keybindings?: KeybindingSettings;
  /** 会话配置 */
  session?: SessionSettings;
  /** MCP 服务器配置 */
  mcp?: McpSettings;
  /** 版本号 */
  version?: string;
}

/**
 * 默认模型配置
 */
export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  ...PREDEFINED_MODELS["kimi-k2.5"],
};

/**
 * 默认配置
 */
export const DEFAULT_SETTINGS: Required<Omit<ClaudeCodeSettings, "model">> & {
  model: ModelSettings;
} = {
  permissions: {
    defaultMode: "ask",
    autoApprove: [],
    requireConfirmation: [],
  },
  env: {},
  model: DEFAULT_MODEL_SETTINGS,
  ui: {
    theme: "auto",
    language: "zh-CN",
    fontSize: 14,
    lineHeight: 1.5,
    fontFamily: "JetBrains Mono, Fira Code, monospace",
    showLineNumbers: true,
    wordWrap: true,
  },
  tools: {
    timeout: 60000,
    disallowedTools: [],
    allowedTools: undefined,
    bash: {
      allowedCommands: [],
      blockedCommands: ["rm -rf /", "rm -rf /*"],
      defaultCwd: undefined,
    },
    files: {
      maxSize: 1048576, // 1MB
      allowedExtensions: undefined,
      blockedExtensions: [".exe", "dll", ".so", ".dylib"],
    },
  },
  files: {
    excludePatterns: [
      "node_modules/**",
      ".git/**",
      "dist/**",
      "build/**",
      ".next/**",
      "*.min.js",
      "*.min.css",
    ],
    includePatterns: [],
    search: {
      maxResults: 100,
      caseSensitive: false,
      useRegex: false,
      includeHidden: false,
    },
    indexing: {
      enabled: true,
      excludeDirs: ["node_modules", ".git", "dist", "build"],
      maxFiles: 10000,
    },
  },
  behavior: {
    autoSave: true,
    autoSaveInterval: 30000,
    formatOnSave: true,
    formatters: {},
    enableSuggestions: true,
    enableCompletion: true,
    enableSemanticSearch: true,
  },
  keybindings: {
    bindings: {},
  },
  session: {
    defaultTitle: "新会话",
    maxHistoryMessages: 100,
    enableResume: true,
    savePath: ".claude/sessions",
  },
  mcp: {
    servers: [],
  },
  version: "1.0.0",
};

/**
 * 读取并解析 JSON 设置文件，如果未找到或无效则返回空对象
 */
async function loadSettingsFile(filePath: string | null): Promise<ClaudeCodeSettings> {
  if (!filePath) {
    return {};
  }

  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(content) as ClaudeCodeSettings;
  } catch {
    return {};
  }
}

/**
 * 深度合并对象
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
  if (typeof source !== "object" || source === null) {
    return target;
  }

  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === "object" &&
        source[key] !== null &&
        !Array.isArray(source[key])
      ) {
        result[key] = deepMerge(result[key] as any, source[key] as any);
      } else {
        (result as any)[key] = source[key];
      }
    }
  }

  return result;
}

/**
 * 获取预定义模型配置
 */
export function getPredefinedModel(modelName: string): ModelSettings | undefined {
  return PREDEFINED_MODELS[modelName];
}

/**
 * 获取所有可用的预定义模型
 */
export function getAvailableModels(): ModelSettings[] {
  return Object.values(PREDEFINED_MODELS);
}

/**
 * 检查模型是否支持图片理解
 */
export function supportsVision(modelName: string): boolean {
  const model = PREDEFINED_MODELS[modelName];
  return model?.capabilities?.vision ?? false;
}

/**
 * 规范化模型配置
 */
function normalizeModelConfig(model: string | ModelSettings | undefined): ModelSettings {
  if (typeof model === "string") {
    // 检查是否是预定义模型
    const predefined = PREDEFINED_MODELS[model];
    if (predefined) {
      return { ...predefined };
    }
    // 如果不是预定义模型，使用默认配置但替换名称
    return {
      name: model,
      provider: "custom",
      temperature: DEFAULT_MODEL_SETTINGS.temperature,
      maxTokens: DEFAULT_MODEL_SETTINGS.maxTokens,
      topP: DEFAULT_MODEL_SETTINGS.topP,
      contextWindow: DEFAULT_MODEL_SETTINGS.contextWindow,
      capabilities: {
        vision: false,
        functionCalling: true,
        streaming: true,
        longContext: false,
      },
    };
  }
  // 合并用户配置和默认配置
  if (model?.name && PREDEFINED_MODELS[model.name]) {
    return deepMerge(PREDEFINED_MODELS[model.name], model);
  }
  return deepMerge(DEFAULT_MODEL_SETTINGS, model || {});
}

/**
 * 根据当前平台获取企业设置路径
 */
export function getManagedSettingsPath(): string {
  switch (process.platform) {
    case "darwin":
      return "/Library/Application Support/ClaudeCode/managed-settings.json";
    case "linux":
      return "/etc/claude-code/managed-settings.json";
    case "win32":
      return "C:\\Program Files\\ClaudeCode\\managed-settings.json";
    default:
      return "/etc/claude-code/managed-settings.json";
  }
}

export interface SettingsManagerOptions {
  onChange?: () => void;
  logger?: { log: (...args: any[]) => void; error: (...args: any[]) => void };
}

/**
 * 管理 Claude Code 设置，支持多个来源并正确处理优先级。
 *
 * 设置从以下位置加载（按优先级递增）：
 * 1. 默认设置
 * 2. 用户设置 (~/.claude/settings.json)
 * 3. 项目设置 (<cwd>/.claude/settings.json)
 * 4. 本地项目设置 (<cwd>/.claude/settings.local.json)
 * 5. 企业管理设置（平台特定路径）
 *
 * 管理器会监视所有设置文件的变化并自动重新加载。
 */
export class SettingsManager {
  private cwd: string;
  private userSettings: ClaudeCodeSettings = {};
  private projectSettings: ClaudeCodeSettings = {};
  private localSettings: ClaudeCodeSettings = {};
  private enterpriseSettings: ClaudeCodeSettings = {};
  private mergedSettings: ClaudeCodeSettings = {};
  private watchers: fs.FSWatcher[] = [];
  private onChange?: () => void;
  private logger: { log: (...args: any[]) => void; error: (...args: any[]) => void };
  private initialized = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(cwd: string, options?: SettingsManagerOptions) {
    this.cwd = cwd;
    this.onChange = options?.onChange;
    this.logger = options?.logger ?? console;
  }

  /**
   * 初始化设置管理器，加载所有设置并设置文件监视器
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.loadAllSettings();
    this.setupWatchers();
    this.initialized = true;
  }

  /**
   * 返回用户设置文件的路径
   */
  private getUserSettingsPath(): string {
    return path.join(CLAUDE_CONFIG_DIR, "settings.json");
  }

  /**
   * 返回项目设置文件的路径
   */
  private getProjectSettingsPath(): string {
    return path.join(this.cwd, ".claude", "settings.json");
  }

  /**
   * 返回本地项目设置文件的路径
   */
  private getLocalSettingsPath(): string {
    return path.join(this.cwd, ".claude", "settings.local.json");
  }

  /**
   * 从所有来源加载设置
   */
  private async loadAllSettings(): Promise<void> {
    const [userSettings, projectSettings, localSettings, enterpriseSettings] = await Promise.all([
      loadSettingsFile(this.getUserSettingsPath()),
      loadSettingsFile(this.getProjectSettingsPath()),
      loadSettingsFile(this.getLocalSettingsPath()),
      loadSettingsFile(getManagedSettingsPath()),
    ]);

    this.userSettings = userSettings;
    this.projectSettings = projectSettings;
    this.localSettings = localSettings;
    this.enterpriseSettings = enterpriseSettings;

    this.mergeSettings();
  }

  /**
   * 合并所有设置来源，正确处理优先级。
   * 对于权限，所有来源的规则会合并。
   * 拒绝规则在权限检查时始终优先。
   */
  private mergeSettings(): void {
    // 从默认设置开始
    let merged: ClaudeCodeSettings = { ...DEFAULT_SETTINGS };

    // 按优先级合并所有设置
    const allSettings = [
      this.userSettings,
      this.projectSettings,
      this.localSettings,
      this.enterpriseSettings,
    ];

    for (const settings of allSettings) {
      merged = deepMerge(merged, settings);
    }

    // 特殊处理模型配置（支持字符串或对象）
    if (merged.model) {
      merged.model = normalizeModelConfig(merged.model);
    }

    this.mergedSettings = merged;
  }

  /**
   * 设置文件监视器
   */
  private setupWatchers(): void {
    const paths = [
      this.getUserSettingsPath(),
      this.getProjectSettingsPath(),
      this.getLocalSettingsPath(),
      getManagedSettingsPath(),
    ];

    for (const filePath of paths) {
      if (!filePath) continue;

      try {
        const dir = path.dirname(filePath);
        const filename = path.basename(filePath);

        if (fs.existsSync(dir)) {
          const watcher = fs.watch(dir, (eventType, changedFilename) => {
            if (changedFilename === filename) {
              this.handleSettingsChange();
            }
          });

          watcher.on("error", (error) => {
            this.logger.error(`Settings watcher error for ${filePath}:`, error);
          });

          this.watchers.push(watcher);
        }
      } catch (error) {
        this.logger.error(`Failed to set up watcher for ${filePath}:`, error);
      }
    }
  }

  /**
   * 处理设置文件变化，使用防抖避免快速重新加载
   */
  private handleSettingsChange(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      this.debounceTimer = null;
      try {
        await this.loadAllSettings();
        this.onChange?.();
      } catch (error) {
        this.logger.error("Failed to reload settings:", error);
      }
    }, 100);
  }

  /**
   * 返回当前合并后的设置
   */
  getSettings(): Required<Omit<ClaudeCodeSettings, "model">> & { model: ModelSettings } {
    return this.mergedSettings as Required<Omit<ClaudeCodeSettings, "model">> & { model: ModelSettings };
  }

  /**
   * 获取模型配置
   */
  getModelSettings(): ModelSettings {
    return normalizeModelConfig(this.mergedSettings.model);
  }

  /**
   * 获取界面配置
   */
  getUISettings(): Required<UISettings> {
    return deepMerge(DEFAULT_SETTINGS.ui, this.mergedSettings.ui || {}) as Required<UISettings>;
  }

  /**
   * 获取工具配置
   */
  getToolSettings(): Required<ToolSettings> {
    return deepMerge(DEFAULT_SETTINGS.tools, this.mergedSettings.tools || {}) as Required<ToolSettings>;
  }

  /**
   * 获取文件配置
   */
  getFileSettings(): Required<FileSettings> {
    return deepMerge(DEFAULT_SETTINGS.files, this.mergedSettings.files || {}) as Required<FileSettings>;
  }

  /**
   * 获取行为配置
   */
  getBehaviorSettings(): Required<BehaviorSettings> {
    return deepMerge(DEFAULT_SETTINGS.behavior, this.mergedSettings.behavior || {}) as Required<BehaviorSettings>;
  }

  /**
   * 获取会话配置
   */
  getSessionSettings(): Required<SessionSettings> {
    return deepMerge(DEFAULT_SETTINGS.session, this.mergedSettings.session || {}) as Required<SessionSettings>;
  }

  /**
   * 获取 MCP 配置
   */
  getMcpSettings(): Required<McpSettings> {
    return deepMerge(DEFAULT_SETTINGS.mcp, this.mergedSettings.mcp || {}) as Required<McpSettings>;
  }

  /**
   * 获取特定工具是否应该自动批准
   */
  shouldAutoApproveTool(toolName: string): boolean {
    const permissions = this.mergedSettings.permissions;
    if (!permissions) return false;

    // 如果在需要确认的列表中，返回 false
    if (permissions.requireConfirmation?.includes(toolName)) {
      return false;
    }

    // 如果在自动批准列表中，返回 true
    if (permissions.autoApprove?.includes(toolName)) {
      return true;
    }

    return false;
  }

  /**
   * 检查工具是否被禁用
   */
  isToolDisallowed(toolName: string): boolean {
    const tools = this.mergedSettings.tools;
    if (!tools?.disallowedTools) return false;
    return tools.disallowedTools.includes(toolName);
  }

  /**
   * 检查文件是否应该被排除
   */
  shouldExcludeFile(filePath: string): boolean {
    const files = this.mergedSettings.files;
    if (!files?.excludePatterns) return false;

    // 简化的 glob 匹配
    return files.excludePatterns.some((pattern) => {
      const regex = new RegExp(
        pattern
          .replace(/\*\*/g, "<<<DOUBLESTAR>>>")
          .replace(/\*/g, "[^/]*")
          .replace(/<<<DOUBLESTAR>>>/g, ".*")
          .replace(/\?/g, ".")
      );
      return regex.test(filePath);
    });
  }

  /**
   * 返回当前工作目录
   */
  getCwd(): string {
    return this.cwd;
  }

  /**
   * 更新工作目录并重新加载项目特定设置
   */
  async setCwd(cwd: string): Promise<void> {
    if (this.cwd === cwd) {
      return;
    }

    this.dispose();
    this.cwd = cwd;
    this.initialized = false;
    await this.initialize();
  }

  /**
   * 保存设置到项目设置文件
   */
  async saveProjectSettings(settings: Partial<ClaudeCodeSettings>): Promise<void> {
    const projectPath = this.getProjectSettingsPath();
    const projectDir = path.dirname(projectPath);

    try {
      // 确保目录存在
      if (!fs.existsSync(projectDir)) {
        await fs.promises.mkdir(projectDir, { recursive: true });
      }

      // 读取现有设置
      const existing = await loadSettingsFile(projectPath);

      // 合并并保存
      const merged = deepMerge(existing, settings);
      await fs.promises.writeFile(projectPath, JSON.stringify(merged, null, 2), "utf-8");

      // 重新加载设置
      await this.loadAllSettings();
    } catch (error) {
      this.logger.error("Failed to save project settings:", error);
      throw error;
    }
  }

  /**
   * 保存设置到用户设置文件
   */
  async saveUserSettings(settings: Partial<ClaudeCodeSettings>): Promise<void> {
    const userPath = this.getUserSettingsPath();
    const userDir = path.dirname(userPath);

    try {
      // 确保目录存在
      if (!fs.existsSync(userDir)) {
        await fs.promises.mkdir(userDir, { recursive: true });
      }

      // 读取现有设置
      const existing = await loadSettingsFile(userPath);

      // 合并并保存
      const merged = deepMerge(existing, settings);
      await fs.promises.writeFile(userPath, JSON.stringify(merged, null, 2), "utf-8");

      // 重新加载设置
      await this.loadAllSettings();
    } catch (error) {
      this.logger.error("Failed to save user settings:", error);
      throw error;
    }
  }

  /**
   * 释放文件监视器并清理资源
   */
  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    this.initialized = false;
  }
}

/**
 * 创建设置管理器的工厂函数
 */
export async function createSettingsManager(
  cwd: string,
  options?: SettingsManagerOptions
): Promise<SettingsManager> {
  const manager = new SettingsManager(cwd, options);
  await manager.initialize();
  return manager;
}
