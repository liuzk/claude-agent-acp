import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SettingsManager,
  DEFAULT_SETTINGS,
  DEFAULT_MODEL_SETTINGS,
  createSettingsManager,
} from "../settings.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("SettingsManager", () => {
  let tempDir: string;
  let settingsManager: SettingsManager;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "settings-test-"));
  });

  afterEach(async () => {
    settingsManager?.dispose();
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe("settings merging", () => {
    it("should merge model setting with later sources taking precedence", async () => {
      const claudeDir = path.join(tempDir, ".claude");
      await fs.promises.mkdir(claudeDir, { recursive: true });

      // Project settings with one model
      await fs.promises.writeFile(
        path.join(claudeDir, "settings.json"),
        JSON.stringify({
          model: "claude-3-5-sonnet",
        }),
      );

      settingsManager = new SettingsManager(tempDir);
      await settingsManager.initialize();

      const modelSettings = settingsManager.getModelSettings();
      expect(modelSettings.name).toBe("claude-3-5-sonnet");

      // Add local settings that override the model
      await fs.promises.writeFile(
        path.join(claudeDir, "settings.local.json"),
        JSON.stringify({
          model: "claude-3-5-haiku",
        }),
      );

      // Re-initialize to pick up local settings
      settingsManager.dispose();
      settingsManager = new SettingsManager(tempDir);
      await settingsManager.initialize();

      const newModelSettings = settingsManager.getModelSettings();
      expect(newModelSettings.name).toBe("claude-3-5-haiku");
    });

    it("should merge permissions.defaultMode with later sources taking precedence", async () => {
      const claudeDir = path.join(tempDir, ".claude");
      await fs.promises.mkdir(claudeDir, { recursive: true });

      await fs.promises.writeFile(
        path.join(claudeDir, "settings.json"),
        JSON.stringify({
          permissions: {
            defaultMode: "dontAsk",
          },
        }),
      );

      settingsManager = new SettingsManager(tempDir);
      await settingsManager.initialize();

      let settings = settingsManager.getSettings();
      expect(settings.permissions?.defaultMode).toBe("dontAsk");

      // Local settings override the mode
      await fs.promises.writeFile(
        path.join(claudeDir, "settings.local.json"),
        JSON.stringify({
          permissions: {
            defaultMode: "plan",
          },
        }),
      );

      settingsManager.dispose();
      settingsManager = new SettingsManager(tempDir);
      await settingsManager.initialize();

      settings = settingsManager.getSettings();
      expect(settings.permissions?.defaultMode).toBe("plan");
    });

    it("should support new model settings object format", async () => {
      const claudeDir = path.join(tempDir, ".claude");
      await fs.promises.mkdir(claudeDir, { recursive: true });

      await fs.promises.writeFile(
        path.join(claudeDir, "settings.json"),
        JSON.stringify({
          model: {
            name: "claude-3-5-sonnet",
            temperature: 0.5,
            maxTokens: 2048,
            topP: 0.9,
          },
        }),
      );

      settingsManager = new SettingsManager(tempDir);
      await settingsManager.initialize();

      const modelSettings = settingsManager.getModelSettings();
      expect(modelSettings.name).toBe("claude-3-5-sonnet");
      expect(modelSettings.temperature).toBe(0.5);
      expect(modelSettings.maxTokens).toBe(2048);
      expect(modelSettings.topP).toBe(0.9);
    });

    it("should merge UI settings", async () => {
      const claudeDir = path.join(tempDir, ".claude");
      await fs.promises.mkdir(claudeDir, { recursive: true });

      await fs.promises.writeFile(
        path.join(claudeDir, "settings.json"),
        JSON.stringify({
          ui: {
            theme: "dark",
            fontSize: 16,
          },
        }),
      );

      settingsManager = new SettingsManager(tempDir);
      await settingsManager.initialize();

      const uiSettings = settingsManager.getUISettings();
      expect(uiSettings.theme).toBe("dark");
      expect(uiSettings.fontSize).toBe(16);
      // 默认值应该保留
      expect(uiSettings.language).toBe(DEFAULT_SETTINGS.ui.language);
      expect(uiSettings.showLineNumbers).toBe(DEFAULT_SETTINGS.ui.showLineNumbers);
    });

    it("should merge tool settings", async () => {
      const claudeDir = path.join(tempDir, ".claude");
      await fs.promises.mkdir(claudeDir, { recursive: true });

      await fs.promises.writeFile(
        path.join(claudeDir, "settings.json"),
        JSON.stringify({
          tools: {
            timeout: 120000,
            disallowedTools: ["Bash"],
            bash: {
              blockedCommands: ["rm -rf /"],
            },
          },
        }),
      );

      settingsManager = new SettingsManager(tempDir);
      await settingsManager.initialize();

      const toolSettings = settingsManager.getToolSettings();
      expect(toolSettings.timeout).toBe(120000);
      expect(toolSettings.disallowedTools).toContain("Bash");
      expect(toolSettings.bash.blockedCommands).toContain("rm -rf /");
    });

    it("should merge file settings", async () => {
      const claudeDir = path.join(tempDir, ".claude");
      await fs.promises.mkdir(claudeDir, { recursive: true });

      await fs.promises.writeFile(
        path.join(claudeDir, "settings.json"),
        JSON.stringify({
          files: {
            excludePatterns: ["custom/**", "*.log"],
            search: {
              maxResults: 50,
              caseSensitive: true,
            },
          },
        }),
      );

      settingsManager = new SettingsManager(tempDir);
      await settingsManager.initialize();

      const fileSettings = settingsManager.getFileSettings();
      expect(fileSettings.excludePatterns).toContain("custom/**");
      expect(fileSettings.excludePatterns).toContain("*.log");
      expect(fileSettings.search.maxResults).toBe(50);
      expect(fileSettings.search.caseSensitive).toBe(true);
    });

    it("should merge behavior settings", async () => {
      const claudeDir = path.join(tempDir, ".claude");
      await fs.promises.mkdir(claudeDir, { recursive: true });

      await fs.promises.writeFile(
        path.join(claudeDir, "settings.json"),
        JSON.stringify({
          behavior: {
            autoSave: false,
            enableSuggestions: false,
            formatters: {
              typescript: "eslint",
            },
          },
        }),
      );

      settingsManager = new SettingsManager(tempDir);
      await settingsManager.initialize();

      const behaviorSettings = settingsManager.getBehaviorSettings();
      expect(behaviorSettings.autoSave).toBe(false);
      expect(behaviorSettings.enableSuggestions).toBe(false);
      expect(behaviorSettings.formatters.typescript).toBe("eslint");
    });
  });

  describe("permission checking", () => {
    it("should check if tool should be auto-approved", async () => {
      const claudeDir = path.join(tempDir, ".claude");
      await fs.promises.mkdir(claudeDir, { recursive: true });

      await fs.promises.writeFile(
        path.join(claudeDir, "settings.json"),
        JSON.stringify({
          permissions: {
            autoApprove: ["Read", "Glob"],
            requireConfirmation: ["Bash"],
          },
        }),
      );

      settingsManager = new SettingsManager(tempDir);
      await settingsManager.initialize();

      expect(settingsManager.shouldAutoApproveTool("Read")).toBe(true);
      expect(settingsManager.shouldAutoApproveTool("Glob")).toBe(true);
      expect(settingsManager.shouldAutoApproveTool("Bash")).toBe(false); // 在 requireConfirmation 中
      expect(settingsManager.shouldAutoApproveTool("Write")).toBe(false);
    });

    it("should check if tool is disallowed", async () => {
      const claudeDir = path.join(tempDir, ".claude");
      await fs.promises.mkdir(claudeDir, { recursive: true });

      await fs.promises.writeFile(
        path.join(claudeDir, "settings.json"),
        JSON.stringify({
          tools: {
            disallowedTools: ["Bash", "WebSearch"],
          },
        }),
      );

      settingsManager = new SettingsManager(tempDir);
      await settingsManager.initialize();

      expect(settingsManager.isToolDisallowed("Bash")).toBe(true);
      expect(settingsManager.isToolDisallowed("WebSearch")).toBe(true);
      expect(settingsManager.isToolDisallowed("Read")).toBe(false);
    });
  });

  describe("file exclusion", () => {
    it("should check if file should be excluded", async () => {
      const claudeDir = path.join(tempDir, ".claude");
      await fs.promises.mkdir(claudeDir, { recursive: true });

      await fs.promises.writeFile(
        path.join(claudeDir, "settings.json"),
        JSON.stringify({
          files: {
            excludePatterns: ["node_modules/**", "*.log", ".git/**"],
          },
        }),
      );

      settingsManager = new SettingsManager(tempDir);
      await settingsManager.initialize();

      expect(settingsManager.shouldExcludeFile("node_modules/test.js")).toBe(true);
      expect(settingsManager.shouldExcludeFile("debug.log")).toBe(true);
      expect(settingsManager.shouldExcludeFile(".git/config")).toBe(true);
      expect(settingsManager.shouldExcludeFile("src/index.ts")).toBe(false);
    });
  });

  describe("settings persistence", () => {
    it("should save and load project settings", async () => {
      settingsManager = new SettingsManager(tempDir);
      await settingsManager.initialize();

      await settingsManager.saveProjectSettings({
        model: {
          name: "claude-3-opus",
          temperature: 0.3,
        },
        ui: {
          theme: "light",
        },
      });

      // 重新加载验证
      settingsManager.dispose();
      settingsManager = new SettingsManager(tempDir);
      await settingsManager.initialize();

      const modelSettings = settingsManager.getModelSettings();
      expect(modelSettings.name).toBe("claude-3-opus");
      expect(modelSettings.temperature).toBe(0.3);

      const uiSettings = settingsManager.getUISettings();
      expect(uiSettings.theme).toBe("light");
    });
  });

  describe("factory function", () => {
    it("should create settings manager with factory function", async () => {
      const manager = await createSettingsManager(tempDir);
      expect(manager).toBeInstanceOf(SettingsManager);
      expect(manager.getSettings()).toBeDefined();
      manager.dispose();
    });
  });

  describe("default settings", () => {
    it("should have sensible default values", () => {
      expect(DEFAULT_MODEL_SETTINGS.name).toBeDefined();
      expect(DEFAULT_MODEL_SETTINGS.temperature).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_MODEL_SETTINGS.temperature).toBeLessThanOrEqual(1);
      expect(DEFAULT_SETTINGS.ui.theme).toBe("auto");
      expect(DEFAULT_SETTINGS.tools.timeout).toBeGreaterThan(0);
      expect(DEFAULT_SETTINGS.behavior.autoSave).toBe(true);
    });
  });
});
