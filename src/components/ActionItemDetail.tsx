import { Action, ActionPanel, Form, Icon, showToast, Toast } from "@raycast/api";
import { useState, useEffect } from "react";
import { updateActionItem } from "../notion";

interface ActionItemDetailProps {
  item: {
    id: string;
    title: string;
    content: string;
    done: boolean;
    priority: string;
    project: string;
    doDate: string | null;
  };
  onToggleDone: (id: string) => void;
  onContentUpdate: (id: string, content: string) => void;
  onUpdate: (id: string, updates: any) => void;
  priorities: string[];
  projects: { id: string; title: string }[];
}

export default function ActionItemDetail({
  item,
  onToggleDone,
  onContentUpdate,
  onUpdate,
  priorities,
  projects,
}: ActionItemDetailProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formValues, setFormValues] = useState({
    title: item.title,
    content: item.content,
    priority: item.priority,
    project: item.project,
    doDate: item.doDate,
  });

  async function handleSubmit(values: typeof formValues) {
    setIsSubmitting(true);
    try {
      await updateActionItem(item.id, values);
      onUpdate(item.id, values);
      showToast({
        style: Toast.Style.Success,
        title: "Updated action item",
      });
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to update action item",
        message: String(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form
      isLoading={isSubmitting}
      navigationTitle={item.title}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.SubmitForm title="Save Changes" onSubmit={handleSubmit} />
            <Action
              title={item.done ? "Mark Not Done" : "Mark Done"}
              icon={item.done ? Icon.Xmark : Icon.Checkmark}
              onAction={() => onToggleDone(item.id)}
              shortcut={{ modifiers: ["cmd"], key: "t" }}
            />
            <Action.Open
              title="Open in Notion"
              target={`notion://notion.so/${item.id.replace(/-/g, "")}`}
              shortcut={{ modifiers: ["cmd"], key: "return" }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    >
      <Form.TextField
        id="title"
        title="Title"
        defaultValue={formValues.title}
        onChange={(value) => setFormValues((prev) => ({ ...prev, title: value }))}
      />

      <Form.Dropdown
        id="priority"
        title="Priority"
        defaultValue={formValues.priority}
        onChange={(value) => setFormValues((prev) => ({ ...prev, priority: value }))}
      >
        {priorities.map((priority) => (
          <Form.Dropdown.Item key={priority} value={priority} title={priority} />
        ))}
      </Form.Dropdown>

      <Form.Dropdown
        id="project"
        title="Project"
        defaultValue={formValues.project}
        onChange={(value) => setFormValues((prev) => ({ ...prev, project: value }))}
      >
        {projects.map((project) => (
          <Form.Dropdown.Item key={project.id} value={project.id} title={project.title} />
        ))}
      </Form.Dropdown>

      <Form.DatePicker
        id="doDate"
        title="Due Date"
        type={Form.DatePicker.Type.Date}
        defaultValue={formValues.doDate ? new Date(formValues.doDate) : undefined}
        onChange={(value) =>
          setFormValues((prev) => ({
            ...prev,
            doDate: value ? value.toISOString() : null,
          }))
        }
      />

      <Form.TextArea
        id="content"
        title="Content"
        defaultValue={formValues.content}
        onChange={(value) => {
          setFormValues((prev) => ({ ...prev, content: value }));
          onContentUpdate(item.id, value);
        }}
      />
    </Form>
  );
}
