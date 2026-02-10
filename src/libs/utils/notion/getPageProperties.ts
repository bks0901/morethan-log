import { NotionAPI } from "notion-client"
import { CollectionPropertySchemaMap } from "notion-types"
import { getTextContent, getDateValue, idToUuid, uuidToId } from "notion-utils"
import { customMapImageUrl } from "./customMapImageUrl"

type AnyRecord = Record<string, any>

const EXCLUDE_TYPES = new Set([
  "date",
  "select",
  "multi_select",
  "person",
  "file",
])

function getBlockEntry(block: AnyRecord, id: string) {
  const uuid = idToUuid(id)
  const raw = uuidToId(uuid)
  return {
    uuid,
    raw,
    entry: block?.[uuid] ?? block?.[raw] ?? block?.[id],
  }
}

function getBlockValue(entry: any) {
  return (
    entry?.value?.value || entry?.value || entry?.value?.value?.value || null
  )
}

function safeSplitComma(text: string) {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

async function mapPropertyValue(
  api: NotionAPI,
  schemaItem: any,
  val: any,
  blockValue: any
) {
  const type = schemaItem?.type
  if (!type) return undefined

  if (!EXCLUDE_TYPES.has(type)) {
    return getTextContent(val)
  }

  switch (type) {
    case "file": {
      try {
        const url: string = val?.[0]?.[1]?.[0]?.[1]
        if (!url) return undefined
        return customMapImageUrl(url, blockValue as any)
      } catch {
        return undefined
      }
    }
    case "date": {
      const dateProperty: any = getDateValue(val)
      if (dateProperty) delete dateProperty.type
      return dateProperty
    }
    case "select":
    case "multi_select": {
      const selects = getTextContent(val)
      if (!selects?.length) return undefined
      return safeSplitComma(selects)
    }
    case "person": {
      try {
        const rawUsers = Array.isArray(val) ? val.flat() : []
        const users: any[] = []

        for (let i = 0; i < rawUsers.length; i++) {
          const cell = rawUsers[i]
          if (!cell?.[0]?.[1]) continue

          const userId = cell[0]
          const res: any = await api.getUsers(userId)
          const resValue =
            res?.recordMapWithRoles?.notion_user?.[userId[1]]?.value

          users.push({
            id: resValue?.id,
            name:
              resValue?.name ||
              `${resValue?.family_name ?? ""}${resValue?.given_name ?? ""}` ||
              undefined,
            profile_photo: resValue?.profile_photo || null,
          })
        }
        return users
      } catch {
        return []
      }
    }
    default:
      return undefined
  }
}

export default async function getPageProperties(
  id: string,
  block: any,
  schema: CollectionPropertySchemaMap
) {
  const api = new NotionAPI()

  const { uuid, entry } = getBlockEntry(block, id)
  const v = getBlockValue(entry)

  // properties가 없으면 최소값만 반환
  const propObj: AnyRecord = v?.properties || {}
  const rawProperties = Object.entries(propObj)

  const properties: AnyRecord = { id: uuid }

  // 공통 메타데이터
  const ct = v?.created_time
  const ut = v?.last_edited_time
  if (ct) properties.createdTime = new Date(ct).toISOString()
  if (ut) properties.updatedTime = new Date(ut).toISOString()
  properties.fullWidth = v?.format?.page_full_width ?? false

  if (!schema) {
    const title = getTextContent(propObj?.title || [])
    if (title) properties.title = title
    return properties
  }

  for (let i = 0; i < rawProperties.length; i++) {
    const [key, val] = rawProperties[i]

    const s: any = (schema as any)[key]
    if (!s) {
      continue
    }

    const name = s?.name
    if (!name) continue

    const mapped = await mapPropertyValue(api, s, val, v)
    if (mapped !== undefined) {
      properties[name] = mapped
    }
  }

  if (!properties.title) {
    const title = getTextContent(propObj?.title || [])
    if (title) properties.title = title
  }

  return properties
}
