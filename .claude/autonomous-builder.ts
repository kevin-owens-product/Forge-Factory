/**
 * Forge Factory Autonomous Builder
 * Uses Claude Agent SDK for reliable autonomous development
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Anthropic();

const PROJECT_ROOT = path.resolve(__dirname, "..");
const NEXT_TASK_FILE = path.join(PROJECT_ROOT, ".claude/NEXT_TASK.md");
const LOG_DIR = path.join(PROJECT_ROOT, ".claude/logs");

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

interface SessionResult {
  success: boolean;
  task: string;
  output: string;
  error?: string;
}

function getCurrentTask(): string {
  const content = fs.readFileSync(NEXT_TASK_FILE, "utf-8");
  const match = content.match(/## Current Task\n\n\*\*([^*]+)\*\*/);
  return match ? match[1].trim() : "Unknown task";
}

function isBuildComplete(): boolean {
  const content = fs.readFileSync(NEXT_TASK_FILE, "utf-8");
  return content.includes("**Status:** BUILD COMPLETE");
}

async function runSession(sessionNum: number): Promise<SessionResult> {
  const task = getCurrentTask();
  const logFile = path.join(
    LOG_DIR,
    `session-${String(sessionNum).padStart(3, "0")}-${Date.now()}.log`
  );

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Session ${sessionNum}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  📋 Task: ${task}`);
  console.log(`  📁 Log: ${logFile}`);
  console.log(`  🕐 Started: ${new Date().toLocaleTimeString()}`);
  console.log(`\n  🔨 Building...`);

  const systemPrompt = `You are an autonomous build agent for the Forge Factory project.
Your working directory is: ${PROJECT_ROOT}

You have access to tools to read files, write files, and execute commands.
Complete the task efficiently and thoroughly.`;

  const userPrompt = `Read .claude/NEXT_TASK.md and complete the current task:

1. Build the package/feature as specified
2. Create all required files with proper TypeScript code
3. Add comprehensive tests (80%+ coverage target)
4. Run quality checks: pnpm tsc --noEmit && pnpm lint
5. Commit your changes: git add . && git commit -m "feat(...): description"
6. Push to remote: git push
7. Update .claude/NEXT_TASK.md:
   - Mark current task as completed
   - Set the next task from the queue as current
   - Add completion details to the Completed section

Stay focused on this ONE task. Be thorough but efficient.`;

  let output = "";

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      tools: [
        {
          name: "read_file",
          description: "Read the contents of a file",
          input_schema: {
            type: "object" as const,
            properties: {
              path: { type: "string", description: "File path relative to project root" },
            },
            required: ["path"],
          },
        },
        {
          name: "write_file",
          description: "Write content to a file",
          input_schema: {
            type: "object" as const,
            properties: {
              path: { type: "string", description: "File path relative to project root" },
              content: { type: "string", description: "Content to write" },
            },
            required: ["path", "content"],
          },
        },
        {
          name: "execute_command",
          description: "Execute a shell command",
          input_schema: {
            type: "object" as const,
            properties: {
              command: { type: "string", description: "Command to execute" },
            },
            required: ["command"],
          },
        },
        {
          name: "list_directory",
          description: "List contents of a directory",
          input_schema: {
            type: "object" as const,
            properties: {
              path: { type: "string", description: "Directory path relative to project root" },
            },
            required: ["path"],
          },
        },
      ],
    });

    // Process the response - handle tool calls in a loop
    let messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];
    let currentResponse = response;

    while (currentResponse.stop_reason === "tool_use") {
      const assistantContent = currentResponse.content;
      messages.push({ role: "assistant", content: assistantContent });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of assistantContent) {
        if (block.type === "tool_use") {
          console.log(`  🔧 ${block.name}: ${JSON.stringify(block.input).slice(0, 50)}...`);
          output += `\n[Tool: ${block.name}] ${JSON.stringify(block.input)}\n`;

          let result: string;
          try {
            result = await executeTool(block.name, block.input as Record<string, string>);
            output += `[Result] ${result.slice(0, 200)}...\n`;
          } catch (err) {
            result = `Error: ${err}`;
            output += `[Error] ${result}\n`;
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        } else if (block.type === "text") {
          output += block.text + "\n";
        }
      }

      messages.push({ role: "user", content: toolResults });

      // Continue the conversation
      currentResponse = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16000,
        system: systemPrompt,
        messages,
        tools: [
          {
            name: "read_file",
            description: "Read the contents of a file",
            input_schema: {
              type: "object" as const,
              properties: {
                path: { type: "string", description: "File path relative to project root" },
              },
              required: ["path"],
            },
          },
          {
            name: "write_file",
            description: "Write content to a file",
            input_schema: {
              type: "object" as const,
              properties: {
                path: { type: "string", description: "File path relative to project root" },
                content: { type: "string", description: "Content to write" },
              },
              required: ["path", "content"],
            },
          },
          {
            name: "execute_command",
            description: "Execute a shell command",
            input_schema: {
              type: "object" as const,
              properties: {
                command: { type: "string", description: "Command to execute" },
              },
              required: ["command"],
            },
          },
          {
            name: "list_directory",
            description: "List contents of a directory",
            input_schema: {
              type: "object" as const,
              properties: {
                path: { type: "string", description: "Directory path relative to project root" },
              },
              required: ["path"],
            },
          },
        ],
      });
    }

    // Get final text response
    for (const block of currentResponse.content) {
      if (block.type === "text") {
        output += block.text + "\n";
      }
    }

    // Write log
    fs.writeFileSync(logFile, output);

    console.log(`  ✅ Session completed`);
    console.log(`\n  📋 Summary:`);
    console.log(`  ─────────────────────────────────────`);
    const lines = output.split("\n").slice(-15);
    lines.forEach((line) => console.log(`  ${line}`));
    console.log(`  ─────────────────────────────────────`);

    return { success: true, task, output };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`  ❌ Session failed: ${errorMsg}`);
    fs.writeFileSync(logFile, output + `\n\nERROR: ${errorMsg}`);
    return { success: false, task, output, error: errorMsg };
  }
}

async function executeTool(
  name: string,
  input: Record<string, string>
): Promise<string> {
  const { execSync } = await import("child_process");

  switch (name) {
    case "read_file": {
      const filePath = path.join(PROJECT_ROOT, input.path);
      if (!fs.existsSync(filePath)) {
        return `File not found: ${input.path}`;
      }
      return fs.readFileSync(filePath, "utf-8");
    }

    case "write_file": {
      const filePath = path.join(PROJECT_ROOT, input.path);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, input.content);
      return `File written: ${input.path}`;
    }

    case "execute_command": {
      try {
        const result = execSync(input.command, {
          cwd: PROJECT_ROOT,
          encoding: "utf-8",
          timeout: 120000, // 2 minute timeout
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        });
        return result || "Command completed successfully";
      } catch (err: unknown) {
        const execError = err as { stdout?: string; stderr?: string; message?: string };
        return `Command failed: ${execError.stderr || execError.stdout || execError.message}`;
      }
    }

    case "list_directory": {
      const dirPath = path.join(PROJECT_ROOT, input.path);
      if (!fs.existsSync(dirPath)) {
        return `Directory not found: ${input.path}`;
      }
      const files = fs.readdirSync(dirPath);
      return files.join("\n");
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

async function main() {
  const maxSessions = parseInt(process.argv[2] || "50", 10);

  console.log(`==============================================`);
  console.log(`  🏭 Forge Factory Autonomous Builder`);
  console.log(`==============================================`);
  console.log(`  Project: ${PROJECT_ROOT}`);
  console.log(`  Max Sessions: ${maxSessions}`);
  console.log(`  Started: ${new Date().toLocaleString()}`);
  console.log(`==============================================`);

  for (let session = 1; session <= maxSessions; session++) {
    if (isBuildComplete()) {
      console.log(`\n==============================================`);
      console.log(`  ✅ BUILD COMPLETE!`);
      console.log(`==============================================`);
      console.log(`  Finished: ${new Date().toLocaleString()}`);
      process.exit(0);
    }

    const result = await runSession(session);

    if (!result.success) {
      console.log(`\n  ⚠️  Session failed, waiting 10s before retry...`);
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    // Brief pause between sessions
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  console.log(`\n==============================================`);
  console.log(`  ⚠️  Max sessions reached (${maxSessions})`);
  console.log(`==============================================`);
  console.log(`  Run again to continue`);
}

main().catch(console.error);
