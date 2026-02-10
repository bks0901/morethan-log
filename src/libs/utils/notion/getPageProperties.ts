import { NotionAPI } from "notion-client"
import { BlockMap, CollectionPropertySchemaMap } from "notion-types"
import { getTextContent, getDateValue, idToUuid, uuidToId } from "notion-utils"
import { customMapImageUrl } from "./customMapImageUrl"

async function getPageProperties(
  id: string,
  block: any,
  schema: CollectionPropertySchemaMap
) {
  const api = new NotionAPI()

  const uuid = idToUuid(id)
  const raw = uuidToId(uuid)
  const b = block?.[uuid] ?? block?.[raw] ?? block?.[id]
  const rawProperties = Object.entries(b?.value?.properties || [])

  const excludeProperties = ["date", "select", "multi_select", "person", "file"]
  const properties: any = {}

  for (let i = 0; i < rawProperties.length; i++) {
    const [key, val]: any = rawProperties[i]
    properties.id = uuid // 통일해두는 게 편함

    // const s = schema?.[key]
    // if (!s) {
    //   console.log("[schema-miss]", { id: uuid, key })
    // }

    if (schema[key]?.type && !excludeProperties.includes(schema[key].type)) {
      properties[schema[key].name] = getTextContent(val)
    } else {
      switch (schema[key]?.type) {
        case "file": {
          try {
            const Block = b?.value
            const url: string = val[0][1][0][1]
            const newurl = customMapImageUrl(url, Block as any)
            properties[schema[key].name] = newurl
          } catch {
            properties[schema[key].name] = undefined
          }
          break
        }
        case "date": {
          const dateProperty: any = getDateValue(val)
          delete dateProperty.type
          properties[schema[key].name] = dateProperty
          break
        }
        case "select":
        case "multi_select": {
          const selects = getTextContent(val)
          if (selects?.length) {
            properties[schema[key].name] = selects
              .split(",")
              .map((s) => s.trim())
          }
          break
        }
        case "person": {
          const rawUsers = val.flat()
          const users = []
          for (let i = 0; i < rawUsers.length; i++) {
            if (rawUsers[i][0][1]) {
              const userId = rawUsers[i][0]
              const res: any = await api.getUsers(userId)
              const resValue =
                res?.recordMapWithRoles?.notion_user?.[userId[1]]?.value
              users.push({
                id: resValue?.id,
                name:
                  resValue?.name ||
                  `${resValue?.family_name}${resValue?.given_name}` ||
                  undefined,
                profile_photo: resValue?.profile_photo || null,
              })
            }
          }
          properties[schema[key].name] = users
          break
        }
      }
    }
  }

  return properties
}
export { getPageProperties as default }
