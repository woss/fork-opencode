import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import { OpencodeClient, type Provider } from "@opencode-ai/sdk/v2"
import { TuiConfig } from "@/cli/cmd/tui/config/tui"
import {
  resolveDiffStyle,
  resolveFooterKeybinds,
  resolveModelInfo,
} from "@/cli/cmd/run/runtime.boot"

function model(id: string, providerID: string, context: number, variants?: Record<string, Record<string, never>>) {
  return {
    id,
    providerID,
    api: {
      id: providerID,
      url: `https://${providerID}.test`,
      npm: `@ai-sdk/${providerID}`,
    },
    name: id,
    capabilities: {
      temperature: true,
      reasoning: true,
      attachment: true,
      toolcall: true,
      input: {
        text: true,
        audio: false,
        image: false,
        video: false,
        pdf: false,
      },
      output: {
        text: true,
        audio: false,
        image: false,
        video: false,
        pdf: false,
      },
      interleaved: false,
    },
    cost: {
      input: 0,
      output: 0,
      cache: {
        read: 0,
        write: 0,
      },
    },
    limit: {
      context,
      output: 8192,
    },
    status: "active" as const,
    options: {},
    headers: {},
    release_date: "2026-01-01",
    variants,
  }
}

describe("run runtime boot", () => {
  afterEach(() => {
    mock.restore()
  })

  test("merges footer keybind config and injects leader cycle once", async () => {
    spyOn(TuiConfig, "get").mockResolvedValue({
      keybinds: {
        leader: " ctrl+g ",
        variant_cycle: " ctrl+t, <leader>t , alt+t ",
        session_interrupt: " ctrl+c ",
        command_list: " ctrl+p ",
        history_previous: " k ",
        history_next: " j ",
        input_clear: " ctrl+l ",
        input_submit: " ctrl+s ",
        input_newline: " alt+return ",
      },
    })

    await expect(resolveFooterKeybinds()).resolves.toEqual({
      leader: "ctrl+g",
      commandList: "ctrl+p",
      variantCycle: "ctrl+t,<leader>t,alt+t",
      interrupt: "ctrl+c",
      historyPrevious: "k",
      historyNext: "j",
      inputClear: "ctrl+l",
      inputSubmit: "ctrl+s",
      inputNewline: "alt+return",
    })
  })

  test("falls back to default keybinds when config load fails", async () => {
    spyOn(TuiConfig, "get").mockRejectedValue(new Error("boom"))

    await expect(resolveFooterKeybinds()).resolves.toEqual({
      leader: "ctrl+x",
      commandList: "ctrl+p",
      variantCycle: "ctrl+t,<leader>t",
      interrupt: "escape",
      historyPrevious: "up",
      historyNext: "down",
      inputClear: "ctrl+c",
      inputSubmit: "return",
      inputNewline: "shift+return,ctrl+return,alt+return,ctrl+j",
    })
  })

  test("prefers configured providers for model selector data", async () => {
    const sdk = new OpencodeClient()
    const data: {
      all: Provider[]
      default: Record<string, string>
      connected: string[]
    } = {
      all: [
        {
          id: "openai",
          name: "OpenAI",
          source: "api",
          env: [],
          options: {},
          models: {
            "gpt-5": model("gpt-5", "openai", 128000, {
              high: {},
              minimal: {},
            }),
          },
        },
        {
          id: "anthropic",
          name: "Anthropic",
          source: "api",
          env: [],
          options: {},
          models: {
            sonnet: model("sonnet", "anthropic", 200000),
          },
        },
      ],
      default: {},
      connected: [],
    }
    const configured = {
      providers: [data.all[0]!],
      default: {},
    }
    const list = spyOn(sdk.provider, "list").mockImplementation(() =>
      Promise.resolve({
        data,
        error: undefined,
        request: new Request("https://opencode.test"),
        response: new Response(),
      }),
    )
    spyOn(sdk.config, "providers").mockImplementation(() =>
      Promise.resolve({
        data: configured,
        error: undefined,
        request: new Request("https://opencode.test"),
        response: new Response(),
      }),
    )

    await expect(resolveModelInfo(sdk, "/workspace", { providerID: "openai", modelID: "gpt-5" })).resolves.toEqual({
      providers: configured.providers,
      variants: ["high", "minimal"],
      limits: {
        "openai/gpt-5": 128000,
      },
    })
    expect(list).not.toHaveBeenCalled()
  })

  test("falls back to provider list when configured providers are unavailable", async () => {
    const sdk = new OpencodeClient()
    const data: {
      all: Provider[]
      default: Record<string, string>
      connected: string[]
    } = {
      all: [
        {
          id: "openai",
          name: "OpenAI",
          source: "api",
          env: [],
          options: {},
          models: {
            "gpt-5": model("gpt-5", "openai", 128000, {
              high: {},
              minimal: {},
            }),
          },
        },
        {
          id: "anthropic",
          name: "Anthropic",
          source: "api",
          env: [],
          options: {},
          models: {
            sonnet: model("sonnet", "anthropic", 200000),
          },
        },
      ],
      default: {},
      connected: [],
    }
    spyOn(sdk.config, "providers").mockRejectedValue(new Error("boom"))
    spyOn(sdk.provider, "list").mockImplementation(() =>
      Promise.resolve({
        data,
        error: undefined,
        request: new Request("https://opencode.test"),
        response: new Response(),
      }),
    )

    await expect(resolveModelInfo(sdk, "/workspace", { providerID: "openai", modelID: "gpt-5" })).resolves.toEqual({
      providers: data.all,
      variants: ["high", "minimal"],
      limits: {
        "openai/gpt-5": 128000,
        "anthropic/sonnet": 200000,
      },
    })
  })

  test("reads diff style and falls back to auto", async () => {
    spyOn(TuiConfig, "get").mockResolvedValue({ diff_style: "stacked" })
    await expect(resolveDiffStyle()).resolves.toBe("stacked")

    mock.restore()
    spyOn(TuiConfig, "get").mockRejectedValue(new Error("boom"))
    await expect(resolveDiffStyle()).resolves.toBe("auto")
  })
})
