import {
  Form,
  ActionPanel,
  Action,
  showToast,
  Toast,
  getPreferenceValues,
  Clipboard,
  Icon,
  closeMainWindow,
  popToRoot,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { fetchProjects, findOrCreateSparkFile, appendNoteToSparkFile, createNewNote, createActionItem } from "./notion";
import { getCachedProjects, cacheProjects } from "./cache";
import { NotionProject } from "./types";

interface FormValues {
  project: string;
  note: string;
  noteTitle?: string;
  actionItemTitle?: string;
  type: "spark" | "note" | "action";
}

interface Preferences {
  notionApiKey: string;
}

export default function Command() {
  const preferences = getPreferenceValues<Preferences>();
  const [projects, setProjects] = useState<NotionProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [entryType, setEntryType] = useState<"spark" | "note" | "action">("spark");

  useEffect(() => {
    async function loadProjects() {
      try {
        const cachedProjects = getCachedProjects();
        if (cachedProjects.length > 0) {
          setProjects(cachedProjects);
        }

        const freshProjects = await fetchProjects();
        cacheProjects(freshProjects);
        setProjects(freshProjects);
      } catch (error) {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to load projects",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadProjects();
  }, []);

  async function handleSubmit(values: FormValues) {
    try {
      const selectedProject = projects.find((p) => p.id === values.project);
      if (!selectedProject) {
        throw new Error("No project selected");
      }

      switch (values.type) {
        case "spark":
          const sparkFile = await findOrCreateSparkFile(selectedProject.title, selectedProject.id);
          await appendNoteToSparkFile(sparkFile.id, values.note);
          break;
        case "note":
          if (!values.noteTitle) throw new Error("Note title is required");
          await createNewNote(selectedProject.id, values.noteTitle, values.note);
          break;
        case "action":
          if (!values.actionItemTitle) throw new Error("Action item title is required");
          await createActionItem(selectedProject.id, values.actionItemTitle);
          break;
      }

      showToast({
        style: Toast.Style.Success,
        title: `${values.type === "action" ? "Action item" : "Note"} added successfully`,
      });

      await popToRoot();
      await closeMainWindow();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to add entry",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const handleProjectChange = (newValue: string) => {
    setSelectedProjectId(newValue);
  };

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm onSubmit={handleSubmit} />
          {selectedProjectId && (
            <Action.CreateQuicklink
              title="Create Project QuickLink"
              quicklink={{
                name: `Spark ${projects.find((p) => p.id === selectedProjectId)?.title}`,
                link: `raycast://extensions/compose-ai/notion-ppv/note-project-idea?project=${selectedProjectId}`,
              }}
              shortcut={{ modifiers: ["cmd"], key: "l" }}
            />
          )}
        </ActionPanel>
      }
    >
      <Form.Dropdown id="project" title="Project" isLoading={isLoading} onChange={handleProjectChange}>
        {projects.map((project) => (
          <Form.Dropdown.Item key={project.id} value={project.id} title={project.title} />
        ))}
      </Form.Dropdown>

      <Form.Dropdown
        id="type"
        title="Entry Type"
        value={entryType}
        onChange={(value) => setEntryType(value as typeof entryType)}
      >
        <Form.Dropdown.Item value="spark" title="Spark Note" />
        <Form.Dropdown.Item value="note" title="New Note" />
        <Form.Dropdown.Item value="action" title="Action Item" />
      </Form.Dropdown>

      {entryType === "note" && <Form.TextField id="noteTitle" title="Note Title" placeholder="Enter note title..." />}

      {entryType === "action" && (
        <Form.TextField id="actionItemTitle" title="Action Item Title" placeholder="Enter action item title..." />
      )}

      {(entryType === "spark" || entryType === "note") && (
        <Form.TextArea id="note" title="Note" placeholder="Enter your note..." />
      )}
    </Form>
  );
}
