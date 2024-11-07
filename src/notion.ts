import { Client } from "@notionhq/client";
import { NotionProject } from "./types";
import { getPreferenceValues } from "@raycast/api";
import { cacheActionItems, getCachedActionItems, cacheProjectTitle, getCachedProjectTitle } from "./cache";

interface Preferences {
  notionApiKey: string;
}

const preferences = getPreferenceValues<Preferences>();
const notion = new Client({ auth: preferences.notionApiKey });
const NOTES_DATABASE_ID = "e194928c96664eb6b5518b690f08ea05";
const PROJECTS_DATABASE_ID = "e0d34b0831c24e30a48ac235e425459b";
const SPARK_FILE_TAG_ID = "137577f82e28806f82c9f2b86497fe2f";
const ACTION_ITEMS_DATABASE_ID = "d1c2b6fab84843638eb88480f0d4223e";
const DEFAULT_PROJECT_TEMPLATE_ID = "137577f82e28804cabc4cddd9db0f93a";

const PRIORITY_ORDER = {
  "Immediate 🔥": 0,
  "Quick ⚡️": 1,
  "Scheduled 📅": 2,
  "1st Priority 🚀": 3,
  "2nd Priority 📘": 4,
  "3rd Priority 📙": 5,
  "4th Priority 📕": 6,
  "5th Priority 📗": 7,
  "Errand 🚗": 8,
  "Remember 💭": 9,
};

export async function fetchProjects(): Promise<NotionProject[]> {
  const response = await notion.databases.query({
    database_id: PROJECTS_DATABASE_ID,
  });

  return response.results.map((page: any) => {
    if (!("properties" in page)) return { id: page.id, title: "" };

    console.log("Page properties:", page.properties);

    const titleProperty = page.properties.Name || page.properties.Title || page.properties.Project;
    const title = titleProperty?.title?.[0]?.plain_text || "";

    return {
      id: page.id,
      title: title,
    };
  });
}

export async function findOrCreateSparkFile(projectName: string, projectId: string) {
  try {
    const response = await notion.databases.query({
      database_id: NOTES_DATABASE_ID,
      filter: {
        and: [
          {
            property: "title",
            title: {
              equals: `${projectName} Spark File`,
            },
          },
          {
            property: "Projects",
            relation: {
              contains: projectId,
            },
          },
        ],
      },
    });

    if (response.results.length > 0) {
      return response.results[0];
    }

    console.log("Creating new spark file with tag ID:", SPARK_FILE_TAG_ID);
    const newPage = await notion.pages.create({
      parent: { database_id: NOTES_DATABASE_ID },
      properties: {
        title: {
          title: [{ text: { content: `${projectName} Spark File` } }],
        },
        Projects: {
          relation: [{ id: projectId }],
        },
        "Areas / Tags": {
          relation: [{ id: SPARK_FILE_TAG_ID }],
        },
      },
    });
    return newPage;
  } catch (error) {
    console.error("Error in findOrCreateSparkFile:", error);
    throw error;
  }
}

export async function appendNoteToSparkFile(sparkFileId: string, noteContent: string) {
  return await notion.blocks.children.append({
    block_id: sparkFileId,
    children: [
      {
        type: "paragraph",
        paragraph: {
          rich_text: [{ text: { content: noteContent } }],
        },
      },
    ],
  });
}

export async function createNewNote(projectId: string, title: string, content: string) {
  try {
    const newPage = await notion.pages.create({
      parent: { database_id: NOTES_DATABASE_ID },
      properties: {
        title: {
          title: [{ text: { content: title } }],
        },
        Projects: {
          relation: [{ id: projectId }],
        },
      },
      children: [
        {
          type: "paragraph",
          paragraph: {
            rich_text: [{ text: { content: content } }],
          },
        },
      ],
    });
    return newPage;
  } catch (error) {
    console.error("Error in createNewNote:", error);
    throw error;
  }
}

export async function createActionItem(projectId: string, title: string) {
  try {
    const newPage = await notion.pages.create({
      parent: { database_id: ACTION_ITEMS_DATABASE_ID },
      properties: {
        "Action Item": {
          title: [{ text: { content: title } }],
        },
        "Projects (DB)": {
          relation: [{ id: projectId }],
        },
        Status: {
          select: {
            name: "Active",
          },
        },
      },
    });
    return newPage;
  } catch (error) {
    console.error("Error in createActionItem:", error);
    throw error;
  }
}

export async function createProject(title: string, description?: string) {
  try {
    const newPage = await notion.pages.create({
      parent: { database_id: PROJECTS_DATABASE_ID },
      properties: {
        Project: {
          title: [{ text: { content: title } }],
        },
        Status: {
          select: {
            name: "Active",
          },
        },
      },
    });
    return newPage;
  } catch (error) {
    console.error("Error in createProject:", error);
    throw error;
  }
}

export async function fetchTodayActionItems() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Try to get from cache first
  const cachedItems = getCachedActionItems();
  if (cachedItems.length > 0) {
    return cachedItems;
  }

  try {
    const response = await notion.databases.query({
      database_id: ACTION_ITEMS_DATABASE_ID,
      filter: {
        and: [
          {
            or: [
              {
                property: "Status",
                select: {
                  equals: "Active",
                },
              },
              {
                property: "Status",
                select: {
                  equals: "Waiting",
                },
              },
            ],
          },
          {
            property: "Done",
            checkbox: {
              equals: false,
            },
          },
          {
            property: "Do Date",
            date: {
              on_or_before: today.toISOString(),
            },
          },
        ],
      },
      sorts: [
        {
          property: "Priority",
          direction: "ascending",
        },
        {
          property: "Do Date",
          direction: "ascending",
        },
      ],
    });

    const items = await Promise.all(
      response.results.map(async (page: any) => {
        const projectId = page.properties["Projects (DB)"]?.relation?.[0]?.id;
        let projectTitle = "";

        if (projectId) {
          // Check project cache first
          projectTitle = getCachedProjectTitle(projectId) || "";

          if (!projectTitle) {
            try {
              const projectPage = await notion.pages.retrieve({ page_id: projectId });
              projectTitle = (projectPage as any).properties.Project?.title?.[0]?.plain_text || "";
              // Cache the project title
              cacheProjectTitle(projectId, projectTitle);
            } catch (error) {
              console.error("Error fetching project details:", error);
            }
          }
        }

        return {
          id: page.id,
          title: page.properties["Action Item"]?.title?.[0]?.plain_text || "",
          doDate: page.properties["Do Date"]?.date?.start || null,
          project: projectTitle,
          priority: page.properties["Priority"]?.select?.name || "",
          priorityIcon: page.properties["Priority"]?.select?.name || "",
          done: page.properties["Done"]?.checkbox || false,
          content: page.properties["Content"]?.rich_text?.[0]?.plain_text || "",
        };
      }),
    );

    const sortedItems = items.sort((a, b) => {
      const priorityA = PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 999;
      const priorityB = PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 999;
      return priorityA - priorityB;
    });

    // Cache the final sorted items
    cacheActionItems(sortedItems);
    return sortedItems;
  } catch (error) {
    console.error("Error in fetchTodayActionItems:", error);
    throw error;
  }
}

export async function toggleActionItemDone(pageId: string) {
  const response = await notion.pages.update({
    page_id: pageId,
    properties: {
      Done: {
        checkbox: true, // You might need to adjust this based on your Notion schema
      },
    },
  });
  return response;
}

export async function updateActionItemContent(pageId: string, content: string) {
  try {
    const response = await notion.pages.update({
      page_id: pageId,
      properties: {
        Content: {
          rich_text: [
            {
              text: {
                content: content,
              },
            },
          ],
        },
      },
    });
    return response;
  } catch (error) {
    console.error("Error updating action item content:", error);
    throw error;
  }
}

export async function updateActionItem(
  pageId: string,
  updates: {
    title?: string;
    priority?: string;
    project?: string;
    doDate?: string | null;
    content?: string;
  },
) {
  try {
    const properties: any = {};

    if (updates.title) {
      properties["Action Item"] = {
        title: [{ text: { content: updates.title } }],
      };
    }

    if (updates.priority) {
      properties["Priority"] = {
        select: { name: updates.priority },
      };
    }

    if (updates.project) {
      properties["Projects (DB)"] = {
        relation: [{ id: updates.project }],
      };
    }

    if (updates.doDate !== undefined) {
      properties["Do Date"] = updates.doDate
        ? {
            date: { start: updates.doDate },
          }
        : null;
    }

    if (updates.content) {
      properties["Content"] = {
        rich_text: [{ text: { content: updates.content } }],
      };
    }

    const response = await notion.pages.update({
      page_id: pageId,
      properties,
    });
    return response;
  } catch (error) {
    console.error("Error updating action item:", error);
    throw error;
  }
}
