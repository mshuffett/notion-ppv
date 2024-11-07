import { Cache } from "@raycast/api";
import { NotionProject } from "./types";

interface ActionItem {
  id: string;
  title: string;
  doDate: string | null;
  project: string;
  priority: string;
  priorityIcon: string;
}

const projectsCache = new Cache();
const actionItemsCache = new Cache();

const PROJECTS_CACHE_KEY = "notion-projects";
const ACTION_ITEMS_CACHE_KEY = "notion-today-items";
const PROJECT_TITLE_PREFIX = "project-title-";

export const cacheProjects = (projects: NotionProject[]): void => {
  projectsCache.set(PROJECTS_CACHE_KEY, JSON.stringify(projects));
};

export const getCachedProjects = (): NotionProject[] => {
  const cached = projectsCache.get(PROJECTS_CACHE_KEY);
  return cached ? JSON.parse(cached) : [];
};

export const cacheActionItems = (items: ActionItem[]): void => {
  actionItemsCache.set(ACTION_ITEMS_CACHE_KEY, JSON.stringify(items));
};

export const getCachedActionItems = (): ActionItem[] => {
  const cached = actionItemsCache.get(ACTION_ITEMS_CACHE_KEY);
  return cached ? JSON.parse(cached) : [];
};

export const cacheProjectTitle = (projectId: string, title: string): void => {
  actionItemsCache.set(`${PROJECT_TITLE_PREFIX}${projectId}`, title);
};

export const getCachedProjectTitle = (projectId: string): string | null => {
  return actionItemsCache.get(`${PROJECT_TITLE_PREFIX}${projectId}`);
};

export const clearActionItemsCache = (): void => {
  actionItemsCache.clear();
};
