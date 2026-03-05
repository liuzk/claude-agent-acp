/**
 * 自定义工具模块
 * 支持用户定义的工具和工具链
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { SettingsManager } from "./settings.js";

/**
 * 自定义工具定义
 */
export interface CustomTool {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 工具参数定义 */
  parameters: ToolParameter[];
  /** 工具执行方式 */
  handler: ToolHandler;
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * 工具参数定义
 */
export interface ToolParameter {
  /** 参数名称 */
  name: string;
  /** 参数类型 */
  type: "string" | "number" | "boolean" | "array" | "object";
  /** 参数描述 */
  description: string;
  /** 是否必需 */
  required?: boolean;
  /** 默认值 */
  default?: unknown;
  /** 枚举值（如果有） */
  enum?: unknown[];
}

/**
 * 工具处理器类型
 */
export type ToolHandler =
  | { type: "command"; command: string; args?: string[]; cwd?: string }
  | { type: "script"; script: string; interpreter?: string }
  | { type: "javascript"; function: string };

/**
 * 工具执行结果
 */
export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: unknown;
}

/**
 * 工具链定义
 */
export interface ToolChain {
  /** 工具链名称 */
  name: string;
  /** 工具链描述 */
  description: string;
  /** 工具链步骤 */
  steps: ToolChainStep[];
  /** 是否并行执行 */
  parallel?: boolean;
}

/**
 * 工具链步骤
 */
export interface ToolChainStep {
  /** 步骤名称 */
  name: string;
  /** 使用的工具 */
  tool: string;
  /** 参数映射 */
  parameters: Record<string, string | number | boolean>;
  /** 条件执行 */
  condition?: string;
  /** 输出变量名 */
  outputAs?: string;
}

/**
 * 预设工具集
 */
const PRESET_TOOLS: CustomTool[] = [
  {
    name: "git_status",
    description: "获取 Git 仓库状态",
    parameters: [
      {
        name: "cwd",
        type: "string",
        description: "工作目录",
        required: false,
      },
    ],
    handler: {
      type: "command",
      command: "git",
      args: ["status", "--short"],
    },
    enabled: true,
  },
  {
    name: "git_log",
    description: "获取 Git 提交历史",
    parameters: [
      {
        name: "limit",
        type: "number",
        description: "显示条数",
        required: false,
        default: 10,
      },
      {
        name: "format",
        type: "string",
        description: "格式",
        required: false,
        default: "oneline",
        enum: ["oneline", "short", "medium", "full"],
      },
    ],
    handler: {
      type: "command",
      command: "git",
      args: ["log"],
    },
    enabled: true,
  },
  {
    name: "npm_info",
    description: "获取 npm 包信息",
    parameters: [
      {
        name: "package",
        type: "string",
        description: "包名",
        required: true,
      },
      {
        name: "field",
        type: "string",
        description: "特定字段",
        required: false,
      },
    ],
    handler: {
      type: "command",
      command: "npm",
      args: ["info", "--json"],
    },
    enabled: true,
  },
  {
    name: "project_stats",
    description: "获取项目统计信息",
    parameters: [
      {
        name: "cwd",
        type: "string",
        description: "项目目录",
        required: false,
      },
    ],
    handler: {
      type: "javascript",
      function: "getProjectStats",
    },
    enabled: true,
  },
  {
    name: "code_analysis",
    description: "分析代码复杂度",
    parameters: [
      {
        name: "file",
        type: "string",
        description: "文件路径",
        required: true,
      },
    ],
    handler: {
      type: "javascript",
      function: "analyzeCode",
    },
    enabled: true,
  },
];

/**
 * 预设工具链
 */
const PRESET_CHAINS: ToolChain[] = [
  {
    name: "analyze_and_fix",
    description: "分析代码并修复问题",
    steps: [
      {
        name: "analyze",
        tool: "code_analysis",
        parameters: { file: "${file}" },
        outputAs: "analysis",
      },
      {
        name: "fix",
        tool: "auto_fix",
        parameters: { file: "${file}", issues: "${analysis.issues}" },
        condition: "analysis.hasIssues",
      },
    ],
  },
  {
    name: "full_git_status",
    description: "完整的 Git 状态检查",
    steps: [
      {
        name: "status",
        tool: "git_status",
        parameters: {},
        outputAs: "status",
      },
      {
        name: "log",
        tool: "git_log",
        parameters: { limit: 5 },
        outputAs: "recentCommits",
      },
    ],
  },
];

/**
 * 自定义工具管理器
 */
export class CustomToolManager {
  private settingsManager: SettingsManager;
  private tools: Map<string, CustomTool> = new Map();
  private chains: Map<string, ToolChain> = new Map();
  private toolResults: Map<string, unknown> = new Map();

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
    this.loadPresetTools();
    this.loadPresetChains();
  }

  /**
   * 加载预设工具
   */
  private loadPresetTools(): void {
    for (const tool of PRESET_TOOLS) {
      this.tools.set(tool.name, tool);
    }
  }

  /**
   * 加载预设工具链
   */
  private loadPresetChains(): void {
    for (const chain of PRESET_CHAINS) {
      this.chains.set(chain.name, chain);
    }
  }

  /**
   * 从配置文件加载自定义工具
   */
  async loadFromConfig(configPath: string): Promise<void> {
    try {
      const content = await fs.promises.readFile(configPath, "utf-8");
      const config = JSON.parse(content);

      if (config.customTools) {
        for (const tool of config.customTools) {
          this.registerTool(tool);
        }
      }

      if (config.toolChains) {
        for (const chain of config.toolChains) {
          this.registerChain(chain);
        }
      }
    } catch {
      // 配置文件不存在或无效时忽略
    }
  }

  /**
   * 注册自定义工具
   */
  registerTool(tool: CustomTool): void {
    this.tools.set(tool.name, { ...tool, enabled: tool.enabled ?? true });
  }

  /**
   * 注册工具链
   */
  registerChain(chain: ToolChain): void {
    this.chains.set(chain.name, chain);
  }

  /**
   * 获取所有可用工具
   */
  getAvailableTools(): CustomTool[] {
    return Array.from(this.tools.values()).filter((t) => t.enabled !== false);
  }

  /**
   * 获取所有可用工具链
   */
  getAvailableChains(): ToolChain[] {
    return Array.from(this.chains.values());
  }

  /**
   * 获取特定工具
   */
  getTool(name: string): CustomTool | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取特定工具链
   */
  getChain(name: string): ToolChain | undefined {
    return this.chains.get(name);
  }

  /**
   * 执行工具
   */
  async executeTool(name: string, parameters: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Tool '${name}' not found` };
    }

    if (tool.enabled === false) {
      return { success: false, error: `Tool '${name}' is disabled` };
    }

    // 验证必需参数
    for (const param of tool.parameters) {
      if (param.required && !(param.name in parameters)) {
        return { success: false, error: `Missing required parameter: ${param.name}` };
      }
    }

    // 应用默认值
    const finalParams: Record<string, unknown> = {};
    for (const param of tool.parameters) {
      if (param.name in parameters) {
        finalParams[param.name] = parameters[param.name];
      } else if (param.default !== undefined) {
        finalParams[param.name] = param.default;
      }
    }

    try {
      return await this.runHandler(tool.handler, finalParams);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 执行工具链
   */
  async executeChain(
    name: string,
    initialParameters: Record<string, unknown>
  ): Promise<ToolResult[]> {
    const chain = this.chains.get(name);
    if (!chain) {
      return [{ success: false, error: `Chain '${name}' not found` }];
    }

    const results: ToolResult[] = [];
    const context: Record<string, unknown> = { ...initialParameters };

    if (chain.parallel) {
      // 并行执行
      const promises = chain.steps.map((step) =>
        this.executeChainStep(step, context).then((result) => {
          results.push(result);
          if (step.outputAs) {
            this.toolResults.set(step.outputAs, result.data);
            context[step.outputAs] = result.data;
          }
        })
      );
      await Promise.all(promises);
    } else {
      // 串行执行
      for (const step of chain.steps) {
        // 检查条件
        if (step.condition && !this.evaluateCondition(step.condition, context)) {
          continue;
        }

        const result = await this.executeChainStep(step, context);
        results.push(result);

        if (step.outputAs) {
          this.toolResults.set(step.outputAs, result.data);
          context[step.outputAs] = result.data;
        }
      }
    }

    return results;
  }

  /**
   * 执行工具链步骤
   */
  private async executeChainStep(
    step: ToolChainStep,
    context: Record<string, unknown>
  ): Promise<ToolResult> {
    // 解析参数中的变量引用
    const resolvedParams: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(step.parameters)) {
      if (typeof value === "string" && value.startsWith("${") && value.endsWith("}")) {
        const varPath = value.slice(2, -1);
        resolvedParams[key] = this.resolveVariable(varPath, context);
      } else {
        resolvedParams[key] = value;
      }
    }

    return this.executeTool(step.tool, resolvedParams);
  }

  /**
   * 解析变量路径
   */
  private resolveVariable(path: string, context: Record<string, unknown>): unknown {
    const parts = path.split(".");
    let value: unknown = context;

    for (const part of parts) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * 评估条件表达式
   */
  private evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
    try {
      // 简单的条件评估，支持基本的比较
      const value = this.resolveVariable(condition, context);
      return !!value;
    } catch {
      return false;
    }
  }

  /**
   * 运行工具处理器
   */
  private async runHandler(
    handler: ToolHandler,
    parameters: Record<string, unknown>
  ): Promise<ToolResult> {
    switch (handler.type) {
      case "command":
        return this.runCommand(handler, parameters);
      case "script":
        return this.runScript(handler, parameters);
      case "javascript":
        return this.runJavaScript(handler, parameters);
      default:
        return { success: false, error: "Unknown handler type" };
    }
  }

  /**
   * 运行命令处理器
   */
  private async runCommand(
    handler: Extract<ToolHandler, { type: "command" }>,
    parameters: Record<string, unknown>
  ): Promise<ToolResult> {
    return new Promise((resolve) => {
      const cwd = (parameters.cwd as string) || handler.cwd || this.settingsManager.getCwd();
      const args = [...(handler.args || [])];

      // 替换参数占位符
      for (let i = 0; i < args.length; i++) {
        for (const [key, value] of Object.entries(parameters)) {
          args[i] = args[i].replace(new RegExp(`\\$\\{${key}\\}`, "g"), String(value));
        }
      }

      const toolSettings = this.settingsManager.getToolSettings();
      const timeout = toolSettings.timeout || 60000;

      const child = spawn(handler.command, args, {
        cwd,
        shell: true,
        timeout,
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout.trim(), data: { stdout, stderr } });
        } else {
          resolve({
            success: false,
            error: stderr.trim() || `Command exited with code ${code}`,
            output: stdout.trim(),
          });
        }
      });

      child.on("error", (error) => {
        resolve({ success: false, error: error.message });
      });
    });
  }

  /**
   * 运行脚本处理器
   */
  private async runScript(
    handler: Extract<ToolHandler, { type: "script" }>,
    parameters: Record<string, unknown>
  ): Promise<ToolResult> {
    return new Promise((resolve) => {
      const interpreter = handler.interpreter || "bash";
      let script = handler.script;

      // 替换参数占位符
      for (const [key, value] of Object.entries(parameters)) {
        script = script.replace(new RegExp(`\\$\\{${key}\\}`, "g"), String(value));
      }

      const toolSettings = this.settingsManager.getToolSettings();
      const timeout = toolSettings.timeout || 60000;

      const child = spawn(interpreter, ["-c", script], {
        cwd: this.settingsManager.getCwd(),
        timeout,
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout.trim(), data: { stdout, stderr } });
        } else {
          resolve({
            success: false,
            error: stderr.trim() || `Script exited with code ${code}`,
            output: stdout.trim(),
          });
        }
      });

      child.on("error", (error) => {
        resolve({ success: false, error: error.message });
      });
    });
  }

  /**
   * 运行 JavaScript 处理器
   */
  private async runJavaScript(
    handler: Extract<ToolHandler, { type: "javascript" }>,
    parameters: Record<string, unknown>
  ): Promise<ToolResult> {
    try {
      switch (handler.function) {
        case "getProjectStats":
          return await this.getProjectStats(parameters);
        case "analyzeCode":
          return await this.analyzeCode(parameters);
        default:
          return { success: false, error: `Unknown JavaScript function: ${handler.function}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取项目统计信息
   */
  private async getProjectStats(
    parameters: Record<string, unknown>
  ): Promise<ToolResult> {
    const cwd = (parameters.cwd as string) || this.settingsManager.getCwd();

    try {
      const stats = {
        files: 0,
        directories: 0,
        totalSize: 0,
        byExtension: {} as Record<string, number>,
      };

      const countFiles = async (dir: string): Promise<void> => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(cwd, fullPath);

          if (this.settingsManager.shouldExcludeFile(relativePath)) {
            continue;
          }

          if (entry.isDirectory()) {
            stats.directories++;
            await countFiles(fullPath);
          } else {
            stats.files++;
            const ext = path.extname(entry.name) || "(no extension)";
            stats.byExtension[ext] = (stats.byExtension[ext] || 0) + 1;

            try {
              const fileStat = await fs.promises.stat(fullPath);
              stats.totalSize += fileStat.size;
            } catch {
              // 忽略无法访问的文件
            }
          }
        }
      };

      await countFiles(cwd);

      return {
        success: true,
        output: `项目统计:\n- 文件数: ${stats.files}\n- 目录数: ${stats.directories}\n- 总大小: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 分析代码复杂度
   */
  private async analyzeCode(parameters: Record<string, unknown>): Promise<ToolResult> {
    const filePath = parameters.file as string;

    if (!filePath) {
      return { success: false, error: "File parameter is required" };
    }

    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      const lines = content.split("\n");

      const analysis = {
        totalLines: lines.length,
        codeLines: 0,
        commentLines: 0,
        blankLines: 0,
        functions: 0,
        classes: 0,
        complexity: 0,
        issues: [] as string[],
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "") {
          analysis.blankLines++;
        } else if (
          trimmed.startsWith("//") ||
          trimmed.startsWith("#") ||
          trimmed.startsWith("/*") ||
          trimmed.startsWith("*") ||
          trimmed.startsWith("'")
        ) {
          analysis.commentLines++;
        } else {
          analysis.codeLines++;
        }

        // 简单的函数/类计数
        if (/\b(function|def|fn|func)\b/.test(trimmed)) {
          analysis.functions++;
        }
        if (/\b(class|struct|interface)\b/.test(trimmed)) {
          analysis.classes++;
        }
      }

      // 简单的复杂度估算
      analysis.complexity = analysis.functions * 2 + analysis.classes;

      // 检查潜在问题
      if (analysis.codeLines > 500) {
        analysis.issues.push("文件过长，建议拆分");
      }
      if (analysis.functions > 20) {
        analysis.issues.push("函数过多，建议重构");
      }
      if (analysis.commentLines / analysis.totalLines < 0.1) {
        analysis.issues.push("注释不足，建议添加更多注释");
      }

      return {
        success: true,
        output: `代码分析结果:\n- 总行数: ${analysis.totalLines}\n- 代码行: ${analysis.codeLines}\n- 注释行: ${analysis.commentLines}\n- 空行: ${analysis.blankLines}\n- 函数数: ${analysis.functions}\n- 类/结构数: ${analysis.classes}\n- 复杂度: ${analysis.complexity}\n- 问题: ${analysis.issues.length > 0 ? analysis.issues.join(", ") : "无"}`,
        data: analysis,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 禁用工具
   */
  disableTool(name: string): void {
    const tool = this.tools.get(name);
    if (tool) {
      tool.enabled = false;
    }
  }

  /**
   * 启用工具
   */
  enableTool(name: string): void {
    const tool = this.tools.get(name);
    if (tool) {
      tool.enabled = true;
    }
  }

  /**
   * 导出工具配置
   */
  exportConfig(): { customTools: CustomTool[]; toolChains: ToolChain[] } {
    return {
      customTools: Array.from(this.tools.values()).filter(
        (t) => !PRESET_TOOLS.some((p) => p.name === t.name)
      ),
      toolChains: Array.from(this.chains.values()).filter(
        (c) => !PRESET_CHAINS.some((p) => p.name === c.name)
      ),
    };
  }
}

/**
 * 创建自定义工具管理器的工厂函数
 */
export async function createCustomToolManager(
  settingsManager: SettingsManager,
  configPath?: string
): Promise<CustomToolManager> {
  const manager = new CustomToolManager(settingsManager);

  if (configPath) {
    await manager.loadFromConfig(configPath);
  }

  return manager;
}
