/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { createExecution } from "../services/executionService";

const ExecutionContext = createContext(null);

export function ExecutionProvider({ children }) {
  // Map of promptId -> execution task state
  // Keyed by string(promptId)
  const [executionsByPrompt, setExecutionsByPrompt] = useState({});

  // Map of promptId -> saved input text (so typing persists across navigation)
  const [inputsByPrompt, setInputsByPrompt] = useState({});

  // Active or most recent task for global dashboard header notification
  const [activeTask, setActiveTask] = useState(null);
  const [notification, setNotification] = useState(null);

  // Set of prompt IDs with active in-flight requests to prevent duplicate submissions
  const runningPromisesRef = useRef(new Set());

  const dismissNotification = useCallback(() => {
    setNotification(null);
  }, []);

  const setPromptInputText = useCallback((promptId, text) => {
    if (!promptId) return;
    const key = String(promptId);
    setInputsByPrompt((prev) => ({
      ...prev,
      [key]: text,
    }));
  }, []);

  const getPromptInputText = useCallback(
    (promptId) => {
      if (!promptId) return "";
      const key = String(promptId);
      return inputsByPrompt[key] ?? "";
    },
    [inputsByPrompt]
  );

  const clearShouldScroll = useCallback((promptId) => {
    if (!promptId) return;
    const key = String(promptId);
    setExecutionsByPrompt((prev) => {
      if (!prev[key]) return prev;
      return {
        ...prev,
        [key]: {
          ...prev[key],
          shouldScrollResponse: false,
        },
      };
    });
  }, []);

  const runExecution = useCallback(
    async ({
      promptId,
      promptTitle,
      versionId,
      versionNumber,
      model,
      inputText,
    }) => {
      if (!promptId || !versionId || !model) return;
      const key = String(promptId);

      // Prevent concurrent duplicate executions for the same prompt
      if (runningPromisesRef.current.has(key)) {
        return;
      }

      const trimmedInput = (inputText || "").trim();
      if (!trimmedInput) return;

      runningPromisesRef.current.add(key);

      const task = {
        promptId: key,
        promptTitle: promptTitle || `Prompt #${key}`,
        versionId,
        versionNumber,
        model,
        inputText: trimmedInput,
        loading: true,
        status: "running",
        result: null,
        error: "",
        shouldScrollResponse: false,
        startedAt: Date.now(),
        completedAt: null,
      };

      setExecutionsByPrompt((prev) => ({
        ...prev,
        [key]: task,
      }));
      setActiveTask(task);
      setNotification(null);

      try {
        const result = await createExecution({
          prompt_version: versionId,
          model,
          input_text: trimmedInput,
        });

        const completedTask = {
          ...task,
          loading: false,
          status: "completed",
          result,
          error: "",
          shouldScrollResponse: true,
          completedAt: Date.now(),
        };

        setExecutionsByPrompt((prev) => ({
          ...prev,
          [key]: completedTask,
        }));
        setActiveTask(completedTask);

        setNotification({
          type: "success",
          promptId: key,
          promptTitle: task.promptTitle,
          message: `Execution completed for ${task.promptTitle}!`,
          model,
          executionId: result.id,
          timestamp: Date.now(),
        });

        return { success: true, result };
      } catch (err) {
        console.error("Execution failed:", err);
        const errMsg = err.message || "Failed to execute prompt in sandbox.";

        const failedTask = {
          ...task,
          loading: false,
          status: "failed",
          result: null,
          error: errMsg,
          shouldScrollResponse: false,
          completedAt: Date.now(),
        };

        setExecutionsByPrompt((prev) => ({
          ...prev,
          [key]: failedTask,
        }));
        setActiveTask(failedTask);

        setNotification({
          type: "error",
          promptId: key,
          promptTitle: task.promptTitle,
          message: errMsg,
          model,
          timestamp: Date.now(),
        });

        return { success: false, error: errMsg };
      } finally {
        runningPromisesRef.current.delete(key);
      }
    },
    []
  );

  const getExecutionState = useCallback(
    (promptId) => {
      if (!promptId) return null;
      const key = String(promptId);
      return executionsByPrompt[key] || null;
    },
    [executionsByPrompt]
  );

  const clearExecution = useCallback((promptId) => {
    if (!promptId) return;
    const key = String(promptId);
    setExecutionsByPrompt((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setActiveTask((prev) => (prev?.promptId === key ? null : prev));
    setNotification((prev) => (prev?.promptId === key ? null : prev));
  }, []);

  const value = {
    executionsByPrompt,
    activeTask,
    notification,
    dismissNotification,
    runExecution,
    getExecutionState,
    clearExecution,
    clearShouldScroll,
    setPromptInputText,
    getPromptInputText,
  };

  return (
    <ExecutionContext.Provider value={value}>
      {children}
    </ExecutionContext.Provider>
  );
}

export function useExecution() {
  const context = useContext(ExecutionContext);
  if (!context) {
    throw new Error("useExecution must be used within an ExecutionProvider");
  }
  return context;
}
