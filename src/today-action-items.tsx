import { ActionPanel, List, showToast, Toast, Action, Icon, Color } from "@raycast/api";
import { useEffect, useState } from "react";
import { fetchTodayActionItems, toggleActionItemDone, updateActionItemContent, fetchProjects } from "./notion";
import { clearActionItemsCache } from "./cache";
import { useDebouncedCallback } from "use-debounce";
import ActionItemDetail from "./components/ActionItemDetail";

interface ActionItem {
  id: string;
  title: string;
  doDate: string | null;
  project: string;
  priority: string;
  priorityIcon: string;
  done: boolean;
  content: string;
}

const PRIORITY_ORDER = {
  "Immediate 🔥": 1,
  "Quick ⚡️": 2,
  "Scheduled 📅": 3,
  "1st Priority 🚀": 4,
  "2nd Priority 📘": 5,
  "3rd Priority 📙": 6,
  "4th Priority 📕": 7,
  "5th Priority 📗": 8,
  "Errand 🚗": 9,
  "Remember 💭": 10,
};

export default function TodayActionItems() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [recentlyToggled, setRecentlyToggled] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [editingContent, setEditingContent] = useState<{ [key: string]: string }>({});
  const [selectedItem, setSelectedItem] = useState<ActionItem | null>(null);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const priorities = Object.keys(PRIORITY_ORDER);

  const debouncedSave = useDebouncedCallback(async (itemId: string, content: string) => {
    try {
      await updateActionItemContent(itemId, content);
      setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, content } : item)));
      showToast({
        style: Toast.Style.Success,
        title: "Saved changes",
      });
    } catch (error) {
      console.error("Error saving content:", error);
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to save changes",
        message: String(error),
      });
    }
  }, 3000);

  async function fetchItems(forceRefresh = false) {
    setIsLoading(true);
    try {
      if (forceRefresh) {
        clearActionItemsCache();
        setRecentlyToggled(new Set());
      }
      const actionItems = await fetchTodayActionItems();
      setItems(actionItems.filter((item) => !item.done || recentlyToggled.has(item.id)));
    } catch (error) {
      console.error("Error fetching action items:", error);
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to load action items",
        message: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleDone(itemId: string) {
    try {
      await toggleActionItemDone(itemId);
      setRecentlyToggled((prev) => new Set(prev).add(itemId));
      setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)));
      showToast({
        style: Toast.Style.Success,
        title: "Updated action item status",
      });
    } catch (error) {
      console.error("Error toggling action item:", error);
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to update action item",
        message: String(error),
      });
    }
  }

  const handleContentUpdate = (itemId: string, newContent: string) => {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, content: newContent } : item)));
  };

  useEffect(() => {
    async function loadProjects() {
      const projectsList = await fetchProjects();
      setProjects(projectsList);
    }
    loadProjects();
  }, []);

  const handleItemUpdate = (itemId: string, updates: any) => {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...updates } : item)));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  if (selectedItem) {
    return (
      <ActionItemDetail
        item={selectedItem}
        onToggleDone={toggleDone}
        onContentUpdate={handleContentUpdate}
        onUpdate={handleItemUpdate}
        priorities={priorities}
        projects={projects}
      />
    );
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search action items..."
      isShowingDetail
      navigationTitle="Today's Action Items"
      actions={
        <Action
          title="Refresh"
          icon={Icon.ArrowClockwise}
          onAction={() => fetchItems(true)}
          shortcut={{ modifiers: ["cmd"], key: "r" }}
        />
      }
    >
      {items.map((item) => (
        <List.Item
          key={item.id}
          title={item.title}
          icon={item.done ? Icon.Checkmark : undefined}
          detail={
            <List.Item.Detail
              markdown={editingContent[item.id] ?? item.content}
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label
                    title="Status"
                    text={item.done ? "Done" : "Not Done"}
                    icon={item.done ? Icon.Checkmark : Icon.Circle}
                  />
                  <List.Item.Detail.Metadata.Separator />
                  <List.Item.Detail.Metadata.Label title="Priority" text={item.priority} icon={item.priorityIcon} />
                  <List.Item.Detail.Metadata.Separator />
                  <List.Item.Detail.Metadata.Label
                    title="Project"
                    text={item.project || "No Project"}
                    icon={Icon.Folder}
                  />
                  <List.Item.Detail.Metadata.Separator />
                  <List.Item.Detail.Metadata.Label
                    title="Due Date"
                    text={item.doDate ? new Date(item.doDate).toLocaleDateString() : "No date"}
                    icon={Icon.Calendar}
                  />
                </List.Item.Detail.Metadata>
              }
            />
          }
          actions={
            <ActionPanel>
              <ActionPanel.Section>
                <Action
                  title="Open in Detail"
                  icon={Icon.Sidebar}
                  onAction={() => setSelectedItem(item)}
                  shortcut={{ modifiers: [], key: "return" }}
                />
                <Action
                  title={item.done ? "Mark Not Done" : "Mark Done"}
                  icon={item.done ? Icon.Xmark : Icon.Checkmark}
                  onAction={() => toggleDone(item.id)}
                  shortcut={{ modifiers: ["cmd"], key: "t" }}
                />
                <Action.Open
                  title="Open in Notion"
                  target={`notion://notion.so/${item.id.replace(/-/g, "")}`}
                  shortcut={{ modifiers: ["cmd"], key: "return" }}
                />
                <Action
                  title="Refresh"
                  icon={Icon.ArrowClockwise}
                  onAction={() => fetchItems(true)}
                  shortcut={{ modifiers: ["cmd"], key: "r" }}
                />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

function getPriorityColor(priority: string): Color {
  switch (priority) {
    case "Immediate 🔥":
      return Color.Red;
    case "Quick ⚡️":
      return Color.Orange;
    case "Scheduled 📅":
      return Color.Yellow;
    case "1st Priority 🚀":
      return Color.Blue;
    case "2nd Priority 📘":
      return Color.Purple;
    case "3rd Priority 📙":
      return Color.Green;
    case "4th Priority 📕":
      return Color.Magenta;
    case "5th Priority 📗":
      return Color.PrimaryText;
    case "Errand 🚗":
      return Color.SecondaryText;
    case "Remember 💭":
      return Color.SecondaryText;
    default:
      return Color.SecondaryText;
  }
}
