import { Form, ActionPanel, Action, showToast, Toast, closeMainWindow, popToRoot } from "@raycast/api";
import { useState } from "react";
import { createProject } from "./notion";

interface FormValues {
  title: string;
  description?: string;
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(values: FormValues) {
    if (!values.title) {
      showToast({
        style: Toast.Style.Failure,
        title: "Title is required",
      });
      return;
    }

    setIsLoading(true);
    try {
      await createProject(values.title, values.description);

      showToast({
        style: Toast.Style.Success,
        title: "Project created successfully",
      });

      await popToRoot();
      await closeMainWindow();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to create project",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="title" title="Project Title" placeholder="Enter project title..." autoFocus />
      <Form.TextArea id="description" title="Description" placeholder="Enter project description... (optional)" />
    </Form>
  );
}
