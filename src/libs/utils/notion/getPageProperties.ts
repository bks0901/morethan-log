import { getTextContent, getDateValue } from "notion-utils"
import { NotionAPI } from "notion-client"
import { BlockMap, CollectionPropertySchemaMap } from "notion-types"
import { customMapImageUrl } from "./customMapImageUrl"

async function getPageProperties(
  id: string,
  block: BlockMap,
  schema: CollectionPropertySchemaMap
) {
  const api = new NotionAPI()
  const blockValue = block?.[id]?.value
  const rawProperties = blockValue?.properties || {}
  const properties: any = { id }

  for (const key in rawProperties) {
    const val = rawProperties[key]
    const s = schema?.[key]

    // 스키마에 정의가 없는 경우
    if (!s) {
      if (key === "title") {
        properties.title = getTextContent(val)
      }
      continue
    }

    const { name, type } = s

    switch (type) {
      case "date": {
        const dateValue = getDateValue(val)
        if (dateValue) {
          delete (dateValue as any).type // 불필요한 필드 제거
          properties[name] = dateValue
        }
        break
      }
      case "select":
      case "multi_select": {
        const text = getTextContent(val)
        properties[name] = text
          ? text
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
          : []
        break
      }
      case "person": {
        const users = []
        const rawUsers = Array.isArray(val)
          ? val.filter((item: any) => item?.[0] === "u")
          : []

        for (const userItem of rawUsers) {
          const userId = userItem[1] // 정확하게 UUID 위치만 추출
          if (!userId) continue

          try {
            const res: any = await api.getUsers([userId])
            const resValue =
              res?.recordMapWithRoles?.notion_user?.[userId]?.value

            if (resValue) {
              users.push({
                id: resValue.id,
                name:
                  resValue.name ||
                  `${resValue.family_name ?? ""}${
                    resValue.given_name ?? ""
                  }`.trim() ||
                  "Unknown",
                profile_photo: resValue.profile_photo || null,
              })
            }
          } catch (e) {
            console.warn(`[getPageProperties] Failed to fetch user: ${userId}`)
          }
        }

        properties[name] = users
        break
      }
      case "file": {
        try {
          const url = val[0]?.[1]?.[0]?.[1]
          properties[name] = url ? customMapImageUrl(url, blockValue) : null
        } catch {
          properties[name] = null
        }
        break
      }
      case "text":
      case "title":
      default:
        properties[name] = getTextContent(val)
        break
    }
  }

  // fallback: title이 스키마에 정의되어 있지 않은 경우, rawProperties에서 title을 찾아서 매핑
  if (!properties.title && rawProperties.title) {
    properties.title = getTextContent(rawProperties.title)
  }

  return properties
}

export { getPageProperties as default }
