/**
 * 智能提示和建议模块
 * 提供代码补全、上下文感知建议等功能
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { SettingsManager } from "./settings.js";

/**
 * 建议类型
 */
export type SuggestionType =
  | "file" // 文件路径建议
  | "command" // 命令建议
  | "code" // 代码片段建议
  | "context" // 上下文相关建议
  | "template"; // 模板建议

/**
 * 建议项
 */
export interface Suggestion {
  type: SuggestionType;
  label: string;
  detail?: string;
  documentation?: string;
  insertText: string;
  sortText?: string;
  preselect?: boolean;
}

/**
 * 代码片段模板
 */
interface CodeSnippet {
  prefix: string;
  description: string;
  body: string | string[];
  scope?: string;
}

/**
 * 常用命令模板
 */
const COMMON_COMMANDS: Suggestion[] = [
  {
    type: "command",
    label: "/explain",
    detail: "解释选中的代码",
    documentation: "让 AI 解释当前选中的代码片段",
    insertText: "/explain ",
  },
  {
    type: "command",
    label: "/fix",
    detail: "修复代码问题",
    documentation: "让 AI 修复当前文件中的问题",
    insertText: "/fix ",
  },
  {
    type: "command",
    label: "/test",
    detail: "生成测试代码",
    documentation: "为当前代码生成单元测试",
    insertText: "/test ",
  },
  {
    type: "command",
    label: "/doc",
    detail: "生成文档",
    documentation: "为代码生成文档注释",
    insertText: "/doc ",
  },
  {
    type: "command",
    label: "/refactor",
    detail: "重构代码",
    documentation: "重构选中的代码",
    insertText: "/refactor ",
  },
  {
    type: "command",
    label: "/review",
    detail: "代码审查",
    documentation: "审查代码并提供改进建议",
    insertText: "/review ",
  },
];

/**
 * 代码片段库
 */
const CODE_SNIPPETS: Record<string, CodeSnippet[]> = {
  typescript: [
    {
      prefix: "func",
      description: "函数定义",
      body: ["function ${1:name}(${2:params}): ${3:ReturnType} {", "  ${0}", "}"],
    },
    {
      prefix: "arrow",
      description: "箭头函数",
      body: ["const ${1:name} = (${2:params}) => {", "  ${0}", "}"],
    },
    {
      prefix: "interface",
      description: "接口定义",
      body: ["interface ${1:Name} {", "  ${0}", "}"],
    },
    {
      prefix: "class",
      description: "类定义",
      body: [
        "class ${1:Name} {",
        "  constructor(${2:params}) {",
        "    ${0}",
        "  }",
        "}",
      ],
    },
    {
      prefix: "import",
      description: "导入语句",
      body: ["import { ${1:exports} } from '${2:module}';"],
    },
    {
      prefix: "async",
      description: "异步函数",
      body: ["async function ${1:name}(${2:params}): Promise<${3:void}> {", "  ${0}", "}"],
    },
    {
      prefix: "try",
      description: "try-catch 块",
      body: ["try {", "  ${1}", "} catch (error) {", "  ${0}", "}"],
    },
  ],
  javascript: [
    {
      prefix: "func",
      description: "函数定义",
      body: ["function ${1:name}(${2:params}) {", "  ${0}", "}"],
    },
    {
      prefix: "arrow",
      description: "箭头函数",
      body: ["const ${1:name} = (${2:params}) => {", "  ${0}", "}"],
    },
    {
      prefix: "class",
      description: "类定义",
      body: [
        "class ${1:Name} {",
        "  constructor(${2:params}) {",
        "    ${0}",
        "  }",
        "}",
      ],
    },
    {
      prefix: "import",
      description: "导入语句",
      body: ["import { ${1:exports} } from '${2:module}';"],
    },
    {
      prefix: "async",
      description: "异步函数",
      body: ["async function ${1:name}(${2:params}) {", "  ${0}", "}"],
    },
  ],
  python: [
    {
      prefix: "def",
      description: "函数定义",
      body: ["def ${1:name}(${2:params}):", "    ${0}"],
    },
    {
      prefix: "class",
      description: "类定义",
      body: ["class ${1:Name}:", "    def __init__(self${2:, params}):", "        ${0}"],
    },
    {
      prefix: "ifmain",
      description: "主程序入口",
      body: ["if __name__ == '__main__':", "    ${0}"],
    },
    {
      prefix: "for",
      description: "for 循环",
      body: ["for ${1:item} in ${2:iterable}:", "    ${0}"],
    },
    {
      prefix: "try",
      description: "try-except 块",
      body: ["try:", "    ${1}", "except ${2:Exception} as e:", "    ${0}"],
    },
  ],
  rust: [
    {
      prefix: "fn",
      description: "函数定义",
      body: ["fn ${1:name}(${2:params})${3: -> ReturnType} {", "    ${0}", "}"],
    },
    {
      prefix: "struct",
      description: "结构体定义",
      body: ["struct ${1:Name} {", "    ${0}", "}"],
    },
    {
      prefix: "impl",
      description: "实现块",
      body: ["impl ${1:Name} {", "    ${0}", "}"],
    },
    {
      prefix: "match",
      description: "match 表达式",
      body: ["match ${1:expr} {", "    ${2:pattern} => ${3:expr},", "    _ => ${0},", "}"],
    },
  ],
  go: [
    {
      prefix: "func",
      description: "函数定义",
      body: ["func ${1:name}(${2:params})${3: ReturnType} {", "    ${0}", "}"],
    },
    {
      prefix: "struct",
      description: "结构体定义",
      body: ["type ${1:Name} struct {", "    ${0}", "}"],
    },
    {
      prefix: "iferr",
      description: "错误处理",
      body: ["if err != nil {", "    return ${0}", "}"],
    },
  ],
};

/**
 * 智能提示管理器
 */
export class SuggestionManager {
  private settingsManager: SettingsManager;
  private fileCache: Map<string, string[]> = new Map();
  private recentFiles: string[] = [];

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
  }

  /**
   * 获取命令建议
   */
  getCommandSuggestions(query: string = ""): Suggestion[] {
    const suggestions = [...COMMON_COMMANDS];

    if (!query) {
      return suggestions;
    }

    const lowerQuery = query.toLowerCase();
    return suggestions.filter(
      (s) =>
        s.label.toLowerCase().includes(lowerQuery) ||
        s.detail?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 获取文件路径建议
   */
  async getFileSuggestions(partialPath: string = "", cwd: string): Promise<Suggestion[]> {
    const fileSettings = this.settingsManager.getFileSettings();
    const suggestions: Suggestion[] = [];

    try {
      const dir = partialPath ? path.dirname(partialPath) : cwd;
      const prefix = partialPath ? path.basename(partialPath) : "";

      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        // 检查是否应该排除
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(cwd, fullPath);

        if (this.shouldExclude(relativePath, fileSettings.excludePatterns || [])) {
          continue;
        }

        if (prefix && !entry.name.toLowerCase().startsWith(prefix.toLowerCase())) {
          continue;
        }

        suggestions.push({
          type: "file",
          label: entry.name,
          detail: entry.isDirectory() ? "文件夹" : "文件",
          insertText: entry.name,
          sortText: entry.isDirectory() ? "0" + entry.name : "1" + entry.name,
        });
      }
    } catch {
      // 忽略错误
    }

    return suggestions.sort((a, b) => (a.sortText || "").localeCompare(b.sortText || ""));
  }

  /**
   * 获取代码片段建议
   */
  getCodeSnippets(language: string, prefix: string = ""): Suggestion[] {
    const behaviorSettings = this.settingsManager.getBehaviorSettings();

    if (!behaviorSettings.enableCompletion) {
      return [];
    }

    const snippets = CODE_SNIPPETS[language] || [];
    const suggestions: Suggestion[] = [];

    for (const snippet of snippets) {
      if (!prefix || snippet.prefix.toLowerCase().startsWith(prefix.toLowerCase())) {
        suggestions.push({
          type: "code",
          label: snippet.prefix,
          detail: snippet.description,
          documentation: Array.isArray(snippet.body) ? snippet.body.join("\n") : snippet.body,
          insertText: Array.isArray(snippet.body) ? snippet.body.join("\n") : snippet.body,
        });
      }
    }

    return suggestions;
  }

  /**
   * 获取上下文相关的建议
   */
  async getContextSuggestions(
    context: string,
    _cursorPosition: number,
    _filePath: string
): Promise<Suggestion[]> {
    const behaviorSettings = this.settingsManager.getBehaviorSettings();

    if (!behaviorSettings.enableSuggestions) {
      return [];
    }

    const suggestions: Suggestion[] = [];
    const lines = context.split("\n");
    const currentLine = lines.length > 0 ? lines[lines.length - 1] : "";

    // 检测是否在输入文件路径
    if (currentLine.match(/@(file|folder|path)/)) {
      const cwd = this.settingsManager.getCwd();
      const fileSuggestions = await this.getFileSuggestions("", cwd);
      suggestions.push(...fileSuggestions);
    }

    // 检测是否在输入命令
    if (currentLine.startsWith("/")) {
      const commandSuggestions = this.getCommandSuggestions(currentLine);
      suggestions.push(...commandSuggestions);
    }

    return suggestions;
  }

  /**
   * 获取最近使用的文件
   */
  getRecentFiles(maxCount: number = 10): string[] {
    return this.recentFiles.slice(0, maxCount);
  }

  /**
   * 添加文件到最近使用列表
   */
  addRecentFile(filePath: string): void {
    // 移除已存在的相同路径
    this.recentFiles = this.recentFiles.filter((f) => f !== filePath);
    // 添加到开头
    this.recentFiles.unshift(filePath);
    // 限制数量
    const maxFiles = this.settingsManager.getFileSettings().indexing?.maxFiles || 100;
    if (this.recentFiles.length > maxFiles) {
      this.recentFiles = this.recentFiles.slice(0, maxFiles);
    }
  }

  /**
   * 检查文件是否应该被排除
   */
  private shouldExclude(filePath: string, excludePatterns: string[]): boolean {
    for (const pattern of excludePatterns) {
      const regex = new RegExp(
        pattern
          .replace(/\*\*/g, "<<<DOUBLESTAR>>>")
          .replace(/\*/g, "[^/]*")
          .replace(/<<<DOUBLESTAR>>>/g, ".*")
          .replace(/\?/g, ".")
      );
      if (regex.test(filePath)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 索引项目文件
   */
  async indexProjectFiles(cwd: string): Promise<void> {
    const fileSettings = this.settingsManager.getFileSettings();

    if (!fileSettings.indexing?.enabled) {
      return;
    }

    const indexedFiles: string[] = [];
    const maxFiles = fileSettings.indexing.maxFiles || 10000;

    const indexDir = async (dir: string, depth: number = 0): Promise<void> => {
      if (indexedFiles.length >= maxFiles || depth > 10) {
        return;
      }

      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (indexedFiles.length >= maxFiles) {
            break;
          }

          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(cwd, fullPath);

          // 检查是否应该排除
          if (
            this.shouldExclude(relativePath, fileSettings.excludePatterns || []) ||
            fileSettings.indexing?.excludeDirs?.some((d) => entry.name === d)
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            await indexDir(fullPath, depth + 1);
          } else {
            indexedFiles.push(relativePath);
          }
        }
      } catch {
        // 忽略错误
      }
    };

    await indexDir(cwd);
    this.fileCache.set(cwd, indexedFiles);
  }

  /**
   * 搜索索引的文件
   */
  searchFiles(query: string): string[] {
    if (!query) {
      return [];
    }

    const results: string[] = [];
    const lowerQuery = query.toLowerCase();

    for (const [, files] of this.fileCache) {
      for (const file of files) {
        if (file.toLowerCase().includes(lowerQuery)) {
          results.push(file);
        }
      }
    }

    const fileSettings = this.settingsManager.getFileSettings();
    return results.slice(0, fileSettings.search?.maxResults || 100);
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.fileCache.clear();
    this.recentFiles = [];
  }
}

/**
 * 创建建议管理器的工厂函数
 */
export async function createSuggestionManager(
  settingsManager: SettingsManager
): Promise<SuggestionManager> {
  const manager = new SuggestionManager(settingsManager);
  await manager.indexProjectFiles(settingsManager.getCwd());
  return manager;
}
