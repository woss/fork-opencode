/** @jsxImportSource @opentui/solid */
import { TextAttributes } from "@opentui/core"
import { createEffect, createMemo, createSignal, type Accessor } from "solid-js"
import { transparent, type RunFooterTheme } from "./theme"

export const FOOTER_MENU_ROWS = 8

export type RunFooterMenuItem = {
  display: string
  description?: string
  category?: string
}

type RunFooterMenuRow =
  | { type: "header"; label: string }
  | { type: "item"; item: RunFooterMenuItem; index: number }
  | { type: "spacer" }

export function createFooterMenuState(input: { count: Accessor<number>; limit?: number }) {
  const [selected, setSelected] = createSignal(0)
  const [offset, setOffset] = createSignal(0)
  const limit = () => input.limit ?? FOOTER_MENU_ROWS
  const rows = createMemo(() => Math.max(1, Math.min(limit(), input.count())))

  const reveal = (index: number) => {
    const count = input.count()
    if (count === 0) {
      setSelected(0)
      setOffset(0)
      return
    }

    const next = Math.max(0, Math.min(count - 1, index))
    setSelected(next)
    setOffset((value) => {
      const max = Math.max(0, count - limit())
      if (next < value) {
        return Math.min(max, next)
      }

      if (next >= value + limit()) {
        return Math.min(max, next - limit() + 1)
      }

      return Math.min(max, value)
    })
  }

  const reset = () => {
    setSelected(0)
    setOffset(0)
  }

  createEffect(() => {
    const count = input.count()
    if (count === 0) {
      reset()
      return
    }

    if (selected() >= count) {
      setSelected(count - 1)
    }

    setOffset((value) => {
      const max = Math.max(0, count - limit())
      if (selected() < value) {
        return Math.min(max, selected())
      }

      if (selected() >= value + limit()) {
        return Math.min(max, selected() - limit() + 1)
      }

      return Math.min(max, value)
    })
  })

  return {
    selected,
    offset,
    rows,
    reveal,
    reset,
    move: (dir: -1 | 1) => reveal(selected() + dir),
  }
}

export function RunFooterMenu(props: {
  id?: string
  theme: Accessor<RunFooterTheme>
  items: Accessor<RunFooterMenuItem[]>
  selected: Accessor<number>
  offset: Accessor<number>
  rows: Accessor<number>
  limit?: number
  empty?: string
  border?: boolean
  paddingLeft?: number
  paddingRight?: number
  grouped?: boolean
}) {
  const limit = () => props.limit ?? FOOTER_MENU_ROWS
  const border = () => props.border ?? true
  const rows = createMemo<RunFooterMenuRow[]>(() => {
    if (!props.grouped) {
      return props.items().slice(props.offset(), props.offset() + limit()).map((item, index) => ({
        type: "item",
        item,
        index: index + props.offset(),
      }))
    }

    const all: RunFooterMenuRow[] = []
    let category = ""
    props.items().forEach((item, index) => {
      if (item.category && item.category !== category) {
        if (all.length > 0) {
          all.push({ type: "spacer" })
        }

        category = item.category
        all.push({ type: "header", label: item.category })
      }

      all.push({ type: "item", item, index })
    })

    const selected = all.findIndex((item) => item.type === "item" && item.index === props.selected())
    if (selected === -1) {
      return all.slice(0, limit())
    }

    const start = Math.max(0, Math.min(selected - limit() + 1, all.length - limit()))
    return all.slice(start, start + limit())
  })
  const descriptionColumn = createMemo(() => {
    const width = Math.max(0, ...props.items().filter((item) => item.description).map((item) => Bun.stringWidth(item.display)))
    return width === 0 ? 0 : width + 2
  })
  const descriptionPad = (item: RunFooterMenuItem) => {
    if (!item.description) {
      return ""
    }

    return " ".repeat(Math.max(1, descriptionColumn() - Bun.stringWidth(item.display)))
  }
  return (
    <box
      id={props.id ?? "run-direct-footer-menu"}
      width="100%"
      height={props.rows()}
      backgroundColor={transparent}
      flexDirection="column"
    >
      {rows().length === 0 ? (
        <box paddingRight={0} flexDirection="row" backgroundColor={transparent}>
          {border() ? (
            <text fg={props.theme().border} wrapMode="none">
              ┃
            </text>
          ) : undefined}
          <box
            flexGrow={1}
            flexShrink={1}
            paddingLeft={props.paddingLeft ?? 1}
            paddingRight={props.paddingRight ?? 0}
            backgroundColor={props.theme().surface}
          >
            <text fg={props.theme().muted} wrapMode="none" truncate>
              {props.empty ?? "No matching items"}
            </text>
          </box>
        </box>
      ) : (
        rows().map((row) => {
          if (row.type === "spacer") {
            return <box height={1} flexShrink={0} />
          }

          if (row.type === "header") {
            return (
              <box paddingLeft={props.paddingLeft ?? 1} paddingRight={props.paddingRight ?? 1}>
                <text fg={props.theme().highlight} attributes={TextAttributes.BOLD} wrapMode="none" truncate>
                  {row.label}
                </text>
              </box>
            )
          }

          const active = () => row.index === props.selected()
          return (
            <box paddingRight={0} flexDirection="row" backgroundColor={transparent}>
              {border() ? (
                <text fg={active() ? props.theme().highlight : props.theme().border} wrapMode="none">
                  ┃
                </text>
              ) : undefined}
              <box
                flexGrow={1}
                flexShrink={1}
                paddingLeft={props.paddingLeft ?? 1}
                paddingRight={props.paddingRight ?? 0}
                backgroundColor={active() ? props.theme().highlight : props.theme().surface}
              >
                <text fg={active() ? props.theme().surface : props.theme().text} wrapMode="none" truncate>
                  {row.item.display}
                  {row.item.description ? (
                    <span style={{ fg: active() ? props.theme().surface : props.theme().muted }}>
                      {descriptionPad(row.item)}
                      {row.item.description}
                    </span>
                  ) : undefined}
                </text>
              </box>
            </box>
          )
        })
      )}
    </box>
  )
}
