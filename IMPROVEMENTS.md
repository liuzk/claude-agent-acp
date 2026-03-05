# Claude Agent ACP 改进说明

## 概述

本项目对原始的 Claude Agent ACP 适配器进行了全面改造，增加了丰富的配置选项和增强功能，使其更加好用和灵活。

## 主要改进

### 1. 扩展的配置系统

#### 模型配置 (ModelSettings)
- **name**: 模型名称
- **provider**: 模型提供商 (anthropic/moonshot/alibaba/zhipu/minimax/custom)
- **temperature**: 温度参数 (0-1)，控制生成文本的随机性
- **maxTokens**: 最大生成 token 数
- **topP**: 核采样参数 (0-1)
- **contextWindow**: 上下文窗口大小
- **baseUrl**: API 基础 URL
- **apiKey**: API 密钥
- **capabilities**: 模型能力（图片理解、函数调用等）
- **displayName**: 模型显示名称
- **description**: 模型描述

#### 支持的模型

**默认模型**: `kimi-k2.5` (月之暗面)

**Anthropic 模型**:
- `claude-3-5-sonnet-20241022` - Claude 3.5 Sonnet
- `claude-3-5-haiku-20241022` - Claude 3.5 Haiku

**国产模型** (均支持图片理解):
- `kimi-k2.5` - 月之暗面 Kimi K2.5 (25.6万上下文)
- `qwen3.5-plus` - 阿里云通义千问 3.5 Plus (12.8万上下文)
- `glm-5` - 智谱 GLM-5 (12.8万上下文)
- `MiniMax-M2.5` - MiniMax M2.5 (10万上下文)

#### 界面配置 (UISettings)
- **theme**: 主题（light/dark/auto）
- **language**: 界面语言
- **fontSize**: 字体大小
- **lineHeight**: 行高
- **fontFamily**: 代码字体
- **showLineNumbers**: 是否显示行号
- **wordWrap**: 是否启用自动换行

#### 工具配置 (ToolSettings)
- **timeout**: 工具执行超时时间（毫秒）
- **disallowedTools**: 禁用的工具列表
- **allowedTools**: 允许的工具列表
- **bash**: Bash 工具配置（允许/禁止的命令）
- **files**: 文件操作配置（最大大小、允许的文件类型）

#### 文件配置 (FileSettings)
- **excludePatterns**: 文件排除模式（glob）
- **includePatterns**: 文件包含模式
- **search**: 搜索配置（最大结果数、大小写敏感等）
- **indexing**: 索引配置（启用状态、排除目录等）

#### 行为配置 (BehaviorSettings)
- **autoSave**: 是否自动保存对话
- **autoSaveInterval**: 自动保存间隔
- **formatOnSave**: 保存时是否格式化
- **formatters**: 格式化工具配置
- **enableSuggestions**: 是否启用智能提示
- **enableCompletion**: 是否启用代码补全
- **enableSemanticSearch**: 是否启用语义搜索

#### 会话配置 (SessionSettings)
- **defaultTitle**: 默认会话标题
- **maxHistoryMessages**: 最大历史消息数
- **enableResume**: 是否启用会话恢复
- **savePath**: 会话保存路径

#### MCP 配置 (McpSettings)
- **servers**: MCP 服务器列表配置

### 2. 权限管理增强

- **autoApprove**: 自动批准的工具列表
- **requireConfirmation**: 需要确认的工具列表（优先级高于 autoApprove）
- 支持工具级别的权限控制

### 3. 智能提示系统 (SuggestionManager)

- **命令建议**: 常用命令（/explain, /fix, /test, /doc 等）
- **文件路径建议**: 基于当前项目的文件补全
- **代码片段**: 支持 TypeScript、JavaScript、Python、Rust、Go 等语言
- **上下文感知**: 根据当前输入提供相关建议
- **项目索引**: 自动索引项目文件，支持快速搜索

### 4. 自定义工具系统 (CustomToolManager)

#### 预设工具
- **git_status**: 获取 Git 仓库状态
- **git_log**: 获取 Git 提交历史
- **npm_info**: 获取 npm 包信息
- **project_stats**: 获取项目统计信息
- **code_analysis**: 分析代码复杂度

#### 工具链
- **analyze_and_fix**: 分析代码并修复问题
- **full_git_status**: 完整的 Git 状态检查

#### 自定义工具支持
- 命令类型工具（执行 shell 命令）
- 脚本类型工具（执行脚本）
- JavaScript 类型工具（执行 JavaScript 函数）
- 工具链（串行或并行执行多个工具）

## 配置文件示例

```json
{
  "version": "1.0.0",
  "model": {
    "name": "kimi-k2.5",
    "provider": "moonshot",
    "temperature": 0.7,
    "maxTokens": 4096,
    "topP": 1.0,
    "contextWindow": 256000,
    "capabilities": {
      "vision": true,
      "functionCalling": true,
      "streaming": true,
      "longContext": true
    }
  },
  "permissions": {
    "defaultMode": "ask",
    "autoApprove": ["Read", "Glob", "Grep"],
    "requireConfirmation": ["Bash", "Write", "Edit"]
  },
  "ui": {
    "theme": "dark",
    "language": "zh-CN",
    "fontSize": 14,
    "showLineNumbers": true
  },
  "tools": {
    "timeout": 120000,
    "bash": {
      "blockedCommands": ["rm -rf /"]
    }
  },
  "files": {
    "excludePatterns": ["node_modules/**", ".git/**"],
    "search": {
      "maxResults": 100
    }
  },
  "behavior": {
    "autoSave": true,
    "enableSuggestions": true,
    "enableCompletion": true
  }
}
```

## 配置文件位置

配置按以下优先级加载（后加载的覆盖先加载的）：

1. 默认配置
2. 用户配置 (`~/.claude/settings.json`)
3. 项目配置 (`<cwd>/.claude/settings.json`)
4. 本地项目配置 (`<cwd>/.claude/settings.local.json`)
5. 企业管理配置（平台特定路径）

## API 使用示例

### 使用新的配置系统

```typescript
import { createSettingsManager, getPredefinedModel, supportsVision } from "@zed-industries/claude-agent-acp";

const settingsManager = await createSettingsManager("/path/to/project");

// 获取模型配置（默认是 kimi-k2.5）
const modelSettings = settingsManager.getModelSettings();
console.log(modelSettings.name); // "kimi-k2.5"
console.log(modelSettings.provider); // "moonshot"
console.log(modelSettings.temperature);

// 检查模型是否支持图片理解
if (supportsVision("kimi-k2.5")) {
  console.log("支持图片理解");
}

// 获取预定义模型配置
const qwenModel = getPredefinedModel("qwen3.5-plus");
console.log(qwenModel.displayName); // "通义千问 3.5 Plus"

// 获取界面配置
const uiSettings = settingsManager.getUISettings();
console.log(uiSettings.theme);

// 检查工具权限
if (settingsManager.shouldAutoApproveTool("Read")) {
  // 自动批准
}

// 保存项目配置（切换到其他模型）
await settingsManager.saveProjectSettings({
  model: { name: "qwen3.5-plus" }
});
```

### 使用智能提示

```typescript
import { createSuggestionManager } from "@zed-industries/claude-agent-acp";

const suggestionManager = await createSuggestionManager(settingsManager);

// 获取命令建议
const commands = suggestionManager.getCommandSuggestions("/ex");

// 获取文件建议
const files = await suggestionManager.getFileSuggestions("src/", "/project");

// 获取代码片段
const snippets = suggestionManager.getCodeSnippets("typescript", "func");
```

### 使用自定义工具

```typescript
import { createCustomToolManager } from "@zed-industries/claude-agent-acp";

const toolManager = await createCustomToolManager(settingsManager);

// 执行预设工具
const result = await toolManager.executeTool("git_status", {});

// 执行工具链
const results = await toolManager.executeChain("full_git_status", {});

// 注册自定义工具
toolManager.registerTool({
  name: "custom_build",
  description: "自定义构建工具",
  parameters: [
    { name: "target", type: "string", description: "构建目标", required: true }
  ],
  handler: {
    type: "command",
    command: "npm",
    args: ["run", "build", "--", "${target}"]
  }
});
```

## 与 Trae 的对比

| 功能 | 原始 ACP | 改进后 | Trae |
|------|---------|--------|------|
| 模型参数配置 | ❌ | ✅ | ✅ |
| 主题/界面配置 | ❌ | ✅ | ✅ |
| 工具超时配置 | ❌ | ✅ | ✅ |
| 自动批准工具 | ❌ | ✅ | ✅ |
| 文件排除模式 | ❌ | ✅ | ✅ |
| 智能提示 | ❌ | ✅ | ✅ |
| 代码片段 | ❌ | ✅ | ✅ |
| 自定义工具 | ❌ | ✅ | ❌ |
| 工具链 | ❌ | ✅ | ❌ |
| 项目索引 | ❌ | ✅ | ✅ |

## 技术改进

1. **类型安全**: 所有配置都有完整的 TypeScript 类型定义
2. **配置验证**: 支持配置文件的验证和默认值处理
3. **热重载**: 配置文件变更时自动重新加载
4. **模块化设计**: 配置、提示、工具等功能模块化，易于扩展
5. **完善的测试**: 新增了大量单元测试

## 后续计划

- [ ] 支持更多编程语言的代码片段
- [ ] 添加更多预设工具（如 Docker、Kubernetes 等）
- [ ] 实现配置 UI 界面
- [ ] 支持配置同步功能
- [ ] 添加更多主题选项
- [ ] 支持插件系统
